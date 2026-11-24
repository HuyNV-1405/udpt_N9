import prisma from '../config/prisma';
import { TrangThaiPhieu, LoaiChuyenKho, TrangThaiViTri } from '@prisma/client';
import { generateTransferCode } from '../utils/code-generator.util';
import { emitTransferEvent } from '../config/kafka';

export interface SagaTransferPayload {
  khoNguonId: string;
  khoDichId: string;
  hangHoaId: string;
  viTriDiId: string;
  viTriDenId: string;
  slChuyen: number;
  userId: string;
  ghiChu?: string;
  simulateFailureAtDest?: boolean; // Tùy chọn mô phỏng lỗi tại đích để test Compensating Transaction
}

export interface SagaStepLog {
  step: number;
  name: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'COMPENSATED';
  message: string;
  timestamp: string;
}

export class SagaTransferService {
  /**
   * Thực hiện giao dịch phân tán chuyển kho liên Site qua mô hình SAGA
   */
  static async executeInterSiteTransfer(payload: SagaTransferPayload) {
    const logs: SagaStepLog[] = [];
    const maPC = await generateTransferCode();

    const addLog = (step: number, name: string, status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'COMPENSATED', message: string) => {
      logs.push({ step, name, status, message, timestamp: new Date().toISOString() });
    };

    addLog(1, 'Khởi tạo SAGA Coordinator', 'SUCCESS', `Bắt đầu giao dịch chuyển liên Site mã ${maPC}`);

    // BƯỚC 1: Kiểm tra và Trừ kho tại Site Nguồn (Local Transaction 1)
    let transferRecordId: string | null = null;
    let sourceDeducted = false;

    try {
      addLog(2, 'Site Nguồn: Kiểm tra & Trừ tồn kho (Phase 1)', 'PENDING', `Kiểm tra vị trí xuất ${payload.viTriDiId}`);

      const result = await prisma.$transaction(async (tx) => {
        // Kiểm tra tồn
        const sourceStock = await tx.tonKho.findUnique({
          where: {
            khoId_hangHoaId_viTriId: {
              khoId: payload.khoNguonId,
              hangHoaId: payload.hangHoaId,
              viTriId: payload.viTriDiId,
            },
          },
          include: { hangHoa: true, viTri: true },
        });

        if (!sourceStock || sourceStock.soLuongTon < payload.slChuyen) {
          throw new Error(`Không đủ hàng tồn tại kho nguồn (Tồn: ${sourceStock?.soLuongTon || 0}, Cần chuyển: ${payload.slChuyen})`);
        }

        // Tạo phiếu chuyển trạng thái IN_TRANSIT (đang chuyển)
        const transfer = await tx.phieuChuyenKho.create({
          data: {
            maPC,
            loaiChuyen: LoaiChuyenKho.LIEN_KHO,
            khoNguonId: payload.khoNguonId,
            khoDichId: payload.khoDichId,
            nguoiLapId: payload.userId,
            trangThai: TrangThaiPhieu.APPROVED, // Đã trừ nguồn
            ghiChu: `[SAGA Transaction] ${payload.ghiChu || 'Chuyển hàng liên Site'}`,
            chiTiet: {
              create: [
                {
                  hangHoaId: payload.hangHoaId,
                  viTriDiId: payload.viTriDiId,
                  viTriDenId: payload.viTriDenId,
                  slChuyen: payload.slChuyen,
                },
              ],
            },
          },
        });

        // Trừ tồn kho nguồn
        const newTon = sourceStock.soLuongTon - payload.slChuyen;
        await tx.tonKho.update({
          where: { id: sourceStock.id },
          data: {
            soLuongTon: newTon,
            soLuongKhaDung: Math.max(0, newTon - sourceStock.soLuongTamGiu),
          },
        });

        return transfer;
      });

      transferRecordId = result.id;
      sourceDeducted = true;
      addLog(2, 'Site Nguồn: Đã trừ tồn kho nguồn thành công', 'SUCCESS', `Đã trừ ${payload.slChuyen} sản phẩm tại kho nguồn`);

      // Bắn sự kiện lên Kafka Topic wms.transfer.events
      emitTransferEvent({
        transferCode: maPC,
        khoNguonId: payload.khoNguonId,
        khoDichId: payload.khoDichId,
        status: 'IN_TRANSIT',
        phase: 'PHASE_1_SOURCE_DEDUCTED',
        items: [{ hangHoaId: payload.hangHoaId, slChuyen: payload.slChuyen }],
      });
    } catch (err: any) {
      addLog(2, 'Site Nguồn: Thất bại tại Phase 1', 'FAILED', err.message);
      return {
        success: false,
        sagaState: 'ABORTED_AT_SOURCE',
        logs,
        error: err.message,
      };
    }

    // BƯỚC 2: Gửi thông điệp & Thực hiện cộng tồn kho tại Site Đích (Phase 2)
    try {
      addLog(3, 'Site Đích: Nhận hàng & Cộng tồn kho (Phase 2)', 'PENDING', `Đang ghi nhận vào vị trí đích ${payload.viTriDenId}`);

      if (payload.simulateFailureAtDest) {
        throw new Error('Mô phỏng lỗi: Mất kết nối tới Site Đích hoặc ô lưu trữ bị quá tải!');
      }

      await prisma.$transaction(async (tx) => {
        // Kiểm tra vị trí đích
        const destSlot = await tx.viTriLuuTru.findUnique({ where: { id: payload.viTriDenId } });
        if (!destSlot) throw new Error('Không tìm thấy ô lưu trữ đích tại chi nhánh nhận');

        // Tìm hoặc tạo bản ghi tồn tại kho đích
        const destStock = await tx.tonKho.findUnique({
          where: {
            khoId_hangHoaId_viTriId: {
              khoId: payload.khoDichId,
              hangHoaId: payload.hangHoaId,
              viTriId: payload.viTriDenId,
            },
          },
        });

        if (destStock) {
          await tx.tonKho.update({
            where: { id: destStock.id },
            data: {
              soLuongTon: destStock.soLuongTon + payload.slChuyen,
              soLuongKhaDung: destStock.soLuongKhaDung + payload.slChuyen,
            },
          });
        } else {
          await tx.tonKho.create({
            data: {
              khoId: payload.khoDichId,
              hangHoaId: payload.hangHoaId,
              viTriId: payload.viTriDenId,
              soLuongTon: payload.slChuyen,
              soLuongKhaDung: payload.slChuyen,
            },
          });
        }

        // Cập nhật trạng thái vị trí đích nếu trước đó EMPTY
        if (destSlot.trangThai === TrangThaiViTri.EMPTY) {
          await tx.viTriLuuTru.update({
            where: { id: destSlot.id },
            data: { trangThai: TrangThaiViTri.PARTIAL },
          });
        }
      });

      addLog(3, 'Site Đích: Hoàn tất nhận hàng', 'SUCCESS', `Đã cộng ${payload.slChuyen} sản phẩm vào kho đích thành công`);
      addLog(4, 'SAGA Coordinator: Hoàn tất giao dịch phân tán', 'SUCCESS', 'Giao dịch liên Site thành công 100%');

      // Bắn sự kiện hoàn tất lên Kafka
      emitTransferEvent({
        transferCode: maPC,
        khoNguonId: payload.khoNguonId,
        khoDichId: payload.khoDichId,
        status: 'COMMITTED',
        phase: 'PHASE_2_DESTINATION_COMMITTED',
        items: [{ hangHoaId: payload.hangHoaId, slChuyen: payload.slChuyen }],
      });

      return {
        success: true,
        sagaState: 'COMMITTED',
        transferCode: maPC,
        logs,
      };
    } catch (err: any) {
      addLog(3, 'Site Đích: Thất bại tại Phase 2', 'FAILED', err.message);

      // BƯỚC 3: KÍCH HOẠT GIAO DỊCH BÙ TRỪ (COMPENSATING TRANSACTION)
      addLog(4, 'SAGA Compensation: Kích hoạt hoàn tác tại Site Nguồn', 'PENDING', 'Đang hoàn trả lại số lượng đã trừ tại kho nguồn...');

      if (sourceDeducted) {
        try {
          await prisma.$transaction(async (tx) => {
            const sourceStock = await tx.tonKho.findUnique({
              where: {
                khoId_hangHoaId_viTriId: {
                  khoId: payload.khoNguonId,
                  hangHoaId: payload.hangHoaId,
                  viTriId: payload.viTriDiId,
                },
              },
            });

            if (sourceStock) {
              await tx.tonKho.update({
                where: { id: sourceStock.id },
                data: {
                  soLuongTon: sourceStock.soLuongTon + payload.slChuyen,
                  soLuongKhaDung: sourceStock.soLuongKhaDung + payload.slChuyen,
                },
              });
            }

            if (transferRecordId) {
              await tx.phieuChuyenKho.update({
                where: { id: transferRecordId },
                data: {
                  trangThai: TrangThaiPhieu.REJECTED,
                  ghiChu: `[SAGA ROLLBACK] Giao dịch thất bại tại Site đích: ${err.message}`,
                },
              });
            }
          });

          addLog(4, 'SAGA Compensation: Hoàn tác thành công (Compensated)', 'COMPENSATED', `Đã hoàn lại ${payload.slChuyen} sản phẩm vào vị trí nguồn.`);
        } catch (compErr: any) {
          addLog(4, 'SAGA Compensation: Thất bại nghiêm trọng!', 'FAILED', compErr.message);
        }
      }

      return {
        success: false,
        sagaState: 'COMPENSATED',
        error: err.message,
        logs,
      };
    }
  }
}

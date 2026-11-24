import { PrismaClient, Role, UserStatus, TrangThaiViTri, TrangThaiPhieu } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const site = process.env.SITE_TARGET || 'ALL'; // 'CENTRAL', 'HN', 'HCM', 'ALL'
const prisma = new PrismaClient();

async function seed() {
  console.log(`\n🌱 [SEED-DISTRIBUTED] Đang nạp dữ liệu cho Site: ${site}...`);

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Admin@123', salt);

  // 1. Tạo Users Master
  console.log('   👤 Tạo tài khoản người dùng chuẩn...');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      maNV: 'ADMIN01',
      username: 'admin',
      password: passwordHash,
      hoTen: 'Nguyễn Văn Quản Trị Hệ Thống',
      email: 'admin@wms.com',
      role: Role.ADMIN,
      trangThai: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'quanlykho' },
    update: {},
    create: {
      maNV: 'QL01',
      username: 'quanlykho',
      password: bcrypt.hashSync('Quanly@123', salt),
      hoTen: 'Trần Đình Trưởng Kho',
      email: 'quanly@wms.com',
      role: Role.QUAN_LY_KHO,
      trangThai: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'nhanvienkho' },
    update: {},
    create: {
      maNV: 'NV01',
      username: 'nhanvienkho',
      password: bcrypt.hashSync('Nhanvien@123', salt),
      hoTen: 'Lê Hoàng Nhân Viên',
      email: 'nhanvien@wms.com',
      role: Role.NHAN_VIEN_KHO,
      trangThai: UserStatus.ACTIVE,
    },
  });

  // Tạo tài khoản chuyên biệt cho 2 Chi nhánh Kho miền Bắc & miền Nam
  await prisma.user.upsert({
    where: { username: 'kho_hn' },
    update: {},
    create: {
      maNV: 'NV_HN01',
      username: 'kho_hn',
      password: bcrypt.hashSync('Khohn@123', salt),
      hoTen: 'Nguyễn Văn Bắc - Thủ kho Hà Nội',
      email: 'kho_hn@wms.com',
      role: Role.QUAN_LY_KHO,
      trangThai: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'kho_hcm' },
    update: {},
    create: {
      maNV: 'NV_HCM01',
      username: 'kho_hcm',
      password: bcrypt.hashSync('Khohcm@123', salt),
      hoTen: 'Lê Văn Nam - Thủ kho TP.HCM',
      email: 'kho_hcm@wms.com',
      role: Role.QUAN_LY_KHO,
      trangThai: UserStatus.ACTIVE,
    },
  });

  // 2. Tạo Danh mục dùng chung (Master Data)
  console.log('   🏷️ Tạo danh mục dùng chung (Master Data)...');
  const catDienTu = await prisma.loaiHang.upsert({
    where: { maLoai: 'LH-DIENTU' },
    update: {},
    create: { maLoai: 'LH-DIENTU', tenLoai: 'Thiết Bị Điện Tử & Công Nghệ' },
  });

  const catGiaDung = await prisma.loaiHang.upsert({
    where: { maLoai: 'LH-GIADUNG' },
    update: {},
    create: { maLoai: 'LH-GIADUNG', tenLoai: 'Điện Gia Dụng & Nhà Cửa' },
  });

  const catThucPham = await prisma.loaiHang.upsert({
    where: { maLoai: 'LH-THUCPHAM' },
    update: {},
    create: { maLoai: 'LH-THUCPHAM', tenLoai: 'Thực Phẩm & Đồ Uống' },
  });

  // 3. Tạo Nhà cung cấp & Khách hàng
  const nccSS = await prisma.nhaCungCap.upsert({
    where: { maNCC: 'NCC-SS' },
    update: {},
    create: { maNCC: 'NCC-SS', tenNCC: 'Samsung Electronics VN', sdt: '0243888999' },
  });

  const nccSun = await prisma.nhaCungCap.upsert({
    where: { maNCC: 'NCC-SUN' },
    update: {},
    create: { maNCC: 'NCC-SUN', tenNCC: 'Tập đoàn Sunhouse', sdt: '0243736666' },
  });

  const khFPT = await prisma.khachHang.upsert({
    where: { maKH: 'KH-FPT' },
    update: {},
    create: { maKH: 'KH-FPT', tenKH: 'Công ty Cổ phần Bán lẻ Kỹ thuật số FPT', sdt: '02873006666' },
  });

  // 4. Tạo Mặt hàng (HangHoa)
  console.log('   📦 Tạo danh mục hàng hóa...');
  const spS24 = await prisma.hangHoa.upsert({
    where: { maHH: 'SP-SS-S24' },
    update: {},
    create: {
      maHH: 'SP-SS-S24',
      tenHH: 'Điện thoại Samsung Galaxy S24 256GB',
      donViTinh: 'Chiếc',
      giaNhap: 16500000,
      giaXuat: 19990000,
      dinhMucToiThieu: 10,
      dinhMucToiDa: 100,
      loaiHangId: catDienTu.id,
      nhaCungCapId: nccSS.id,
    },
  });

  const spM27 = await prisma.hangHoa.upsert({
    where: { maHH: 'SP-SS-M27' },
    update: {},
    create: {
      maHH: 'SP-SS-M27',
      tenHH: 'Màn hình máy tính Samsung 27 inch IPS FHD',
      donViTinh: 'Chiếc',
      giaNhap: 2800000,
      giaXuat: 3690000,
      dinhMucToiThieu: 15,
      dinhMucToiDa: 120,
      loaiHangId: catDienTu.id,
      nhaCungCapId: nccSS.id,
    },
  });

  const spNoiCom = await prisma.hangHoa.upsert({
    where: { maHH: 'SP-SUN-NC18' },
    update: {},
    create: {
      maHH: 'SP-SUN-NC18',
      tenHH: 'Nồi cơm điện tử Sunhouse 1.8L',
      donViTinh: 'Chiếc',
      giaNhap: 680000,
      giaXuat: 920000,
      dinhMucToiThieu: 20,
      dinhMucToiDa: 200,
      loaiHangId: catGiaDung.id,
      nhaCungCapId: nccSun.id,
    },
  });

  // 5. Tạo Phân mảnh Kho & Vị trí
  console.log('   🗺️ Thiết lập phân mảnh kho và vị trí lưu trữ...');

  // Kho HN
  if (site === 'ALL' || site === 'HN' || site === 'CENTRAL') {
    const khoHN = await prisma.kho.upsert({
      where: { maKho: 'KHO-HN' },
      update: {},
      create: {
        maKho: 'KHO-HN',
        tenKho: 'Kho Miền Bắc - Chi nhánh Hà Nội',
        diaChi: 'Lô CN5, Cụm CN Ngọc Hồi, Thanh Trì, Hà Nội',
      },
    });

    const kvHN_A = await prisma.khuVuc.upsert({
      where: { khoId_maKhuVuc: { khoId: khoHN.id, maKhuVuc: 'HN-KV-A' } },
      update: {},
      create: { maKhuVuc: 'HN-KV-A', tenKhuVuc: 'Khu A Hà Nội - Hàng Điện Tử', khoId: khoHN.id },
    });

    const vtHN_1 = await prisma.viTriLuuTru.upsert({
      where: { maViTri: 'HN-KVA-K1-T1-O1' },
      update: {},
      create: {
        maViTri: 'HN-KVA-K1-T1-O1',
        khoId: khoHN.id,
        khuVucId: kvHN_A.id,
        ke: 'K1',
        tang: 'T1',
        o: 'O1',
        sucChua: 100,
        trangThai: TrangThaiViTri.PARTIAL,
      },
    });

    const vtHN_2 = await prisma.viTriLuuTru.upsert({
      where: { maViTri: 'HN-KVA-K1-T1-O2' },
      update: {},
      create: {
        maViTri: 'HN-KVA-K1-T1-O2',
        khoId: khoHN.id,
        khuVucId: kvHN_A.id,
        ke: 'K1',
        tang: 'T1',
        o: 'O2',
        sucChua: 100,
        trangThai: TrangThaiViTri.EMPTY,
      },
    });

    // Tồn kho phân mảnh TON_KHO_HN
    await prisma.tonKho.upsert({
      where: { khoId_hangHoaId_viTriId: { khoId: khoHN.id, hangHoaId: spS24.id, viTriId: vtHN_1.id } },
      update: {},
      create: {
        khoId: khoHN.id,
        hangHoaId: spS24.id,
        viTriId: vtHN_1.id,
        soLuongTon: 45,
        soLuongKhaDung: 45,
      },
    });

    await prisma.tonKho.upsert({
      where: { khoId_hangHoaId_viTriId: { khoId: khoHN.id, hangHoaId: spM27.id, viTriId: vtHN_1.id } },
      update: {},
      create: {
        khoId: khoHN.id,
        hangHoaId: spM27.id,
        viTriId: vtHN_1.id,
        soLuongTon: 30,
        soLuongKhaDung: 30,
      },
    });
  }

  // Kho HCM
  if (site === 'ALL' || site === 'HCM' || site === 'CENTRAL') {
    const khoHCM = await prisma.kho.upsert({
      where: { maKho: 'KHO-HCM' },
      update: {},
      create: {
        maKho: 'KHO-HCM',
        tenKho: 'Kho Miền Nam - Chi nhánh TP. Hồ Chí Minh',
        diaChi: 'Lô B2, KCN Tân Bình, Tân Phú, TP. Hồ Chí Minh',
      },
    });

    const kvHCM_B = await prisma.khuVuc.upsert({
      where: { khoId_maKhuVuc: { khoId: khoHCM.id, maKhuVuc: 'HCM-KV-B' } },
      update: {},
      create: { maKhuVuc: 'HCM-KV-B', tenKhuVuc: 'Khu B Sài Gòn - Hàng Gia Dụng', khoId: khoHCM.id },
    });

    const vtHCM_1 = await prisma.viTriLuuTru.upsert({
      where: { maViTri: 'HCM-KVB-K1-T1-O1' },
      update: {},
      create: {
        maViTri: 'HCM-KVB-K1-T1-O1',
        khoId: khoHCM.id,
        khuVucId: kvHCM_B.id,
        ke: 'K1',
        tang: 'T1',
        o: 'O1',
        sucChua: 150,
        trangThai: TrangThaiViTri.PARTIAL,
      },
    });

    const vtHCM_2 = await prisma.viTriLuuTru.upsert({
      where: { maViTri: 'HCM-KVB-K1-T1-O2' },
      update: {},
      create: {
        maViTri: 'HCM-KVB-K1-T1-O2',
        khoId: khoHCM.id,
        khuVucId: kvHCM_B.id,
        ke: 'K1',
        tang: 'T1',
        o: 'O2',
        sucChua: 150,
        trangThai: TrangThaiViTri.EMPTY,
      },
    });

    // Tồn kho phân mảnh TON_KHO_HCM
    await prisma.tonKho.upsert({
      where: { khoId_hangHoaId_viTriId: { khoId: khoHCM.id, hangHoaId: spNoiCom.id, viTriId: vtHCM_1.id } },
      update: {},
      create: {
        khoId: khoHCM.id,
        hangHoaId: spNoiCom.id,
        viTriId: vtHCM_1.id,
        soLuongTon: 60,
        soLuongKhaDung: 60,
      },
    });

    await prisma.tonKho.upsert({
      where: { khoId_hangHoaId_viTriId: { khoId: khoHCM.id, hangHoaId: spS24.id, viTriId: vtHCM_1.id } },
      update: {},
      create: {
        khoId: khoHCM.id,
        hangHoaId: spS24.id,
        viTriId: vtHCM_1.id,
        soLuongTon: 25,
        soLuongKhaDung: 25,
      },
    });
  }

  console.log(`✅ [SEED-DISTRIBUTED] Hoàn tất nạp dữ liệu phân tán cho Site: ${site}!\n`);
}

seed()
  .catch((e) => {
    console.error('❌ Lỗi Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

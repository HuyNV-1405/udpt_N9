import { Kafka, Producer, logLevel } from 'kafkajs';

const kafkaBrokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const siteId = process.env.SITE_ID || 'SITE_CENTRAL';

const kafka = new Kafka({
  clientId: `wms-${siteId.toLowerCase()}`,
  brokers: kafkaBrokers,
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 300,
    retries: 3,
  },
});

let producer: Producer | null = null;
let isConnected = false;

export async function getKafkaProducer(): Promise<Producer | null> {
  if (isConnected && producer) return producer;

  try {
    producer = kafka.producer();
    await producer.connect();
    isConnected = true;
    console.log(`📡 [KAFKA] Đã kết nối thành công tới Kafka Broker: ${kafkaBrokers.join(', ')}`);
    return producer;
  } catch (err: any) {
    console.warn(`⚠️ [KAFKA] Chưa thể kết nối tới Kafka Broker (${err.message}). Bỏ qua để không chặn tiến trình.`);
    return null;
  }
}

/**
 * Bắn sự kiện biến động tồn kho vào Kafka Topic: wms.inventory.events
 */
export async function emitInventoryEvent(data: {
  eventType: 'STOCK_IN' | 'STOCK_OUT' | 'STOCK_ADJUST' | 'STOCK_TRANSFER';
  khoId: string;
  hangHoaId: string;
  soLuong: number;
  viTriId?: string;
  maPhieu?: string;
  ghiChu?: string;
}) {
  try {
    const prod = await getKafkaProducer();
    if (!prod) return;

    const payload = {
      sourceSite: siteId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await prod.send({
      topic: 'wms.inventory.events',
      messages: [
        {
          key: data.khoId,
          value: JSON.stringify(payload),
          headers: {
            site: siteId,
            eventType: data.eventType,
          },
        },
      ],
    });

    console.log(`📨 [KAFKA-PRODUCER] Đã bắn sự kiện "${data.eventType}" lên topic "wms.inventory.events" (Site: ${siteId})`);
  } catch (err: any) {
    console.warn(`⚠️ [KAFKA-PRODUCER] Gửi sự kiện thất bại: ${err.message}`);
  }
}

/**
 * Bắn sự kiện điều chuyển liên kho vào Kafka Topic: wms.transfer.events
 */
export async function emitTransferEvent(data: {
  transferCode: string;
  khoNguonId: string;
  khoDichId: string;
  status: string;
  phase: string;
  items: any[];
}) {
  try {
    const prod = await getKafkaProducer();
    if (!prod) return;

    const payload = {
      sourceSite: siteId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await prod.send({
      topic: 'wms.transfer.events',
      messages: [
        {
          key: data.transferCode,
          value: JSON.stringify(payload),
          headers: {
            site: siteId,
            phase: data.phase,
          },
        },
      ],
    });

    console.log(`📨 [KAFKA-PRODUCER] Đã bắn sự kiện chuyển kho "${data.transferCode}" (${data.phase}) lên topic "wms.transfer.events"`);
  } catch (err: any) {
    console.warn(`⚠️ [KAFKA-PRODUCER] Gửi sự kiện chuyển kho thất bại: ${err.message}`);
  }
}

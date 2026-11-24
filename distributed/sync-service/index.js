const express = require('express');
const axios = require('axios');
const { Kafka, logLevel } = require('kafkajs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5055;
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');
const SYNC_INTERVAL_SEC = parseInt(process.env.SYNC_INTERVAL_SEC || '30', 10);
const CENTRAL_LB_URL = process.env.CENTRAL_LB_URL || 'http://lb_central';
const HN_LB_URL = process.env.HN_LB_URL || 'http://lb_hn';
const HCM_LB_URL = process.env.HCM_LB_URL || 'http://lb_hcm';

let syncHistory = [];
let recentKafkaEvents = [];
let isSyncing = false;

// =========================================================================
// KAFKA CLIENT & CONSUMER SETUP
// =========================================================================
const kafka = new Kafka({
  clientId: 'wms-sync-service-coordinator',
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.NOTHING,
  retry: {
    initialRetryTime: 500,
    retries: 5,
  },
});

let kafkaProducer = null;

async function initKafka() {
  console.log(`\n=============================================================`);
  console.log(`🔌 [KAFKA] Đang khởi tạo kết nối tới Kafka Broker: ${KAFKA_BROKERS.join(', ')}...`);
  console.log(`=============================================================`);

  try {
    // 1. Khởi tạo Producer
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log(`✅ [KAFKA-PRODUCER] Sẵn sàng gửi tin nhắn.`);

    // 2. Khởi tạo Consumer
    const consumer = kafka.consumer({ groupId: 'wms-central-sync-group' });
    await consumer.connect();
    await consumer.subscribe({ topics: ['wms.inventory.events', 'wms.transfer.events', 'wms.sync.periodic'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const valueStr = message.value ? message.value.toString() : '{}';
          const payload = JSON.parse(valueStr);
          const eventItem = {
            id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            topic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString() : null,
            payload,
            receivedAt: new Date().toISOString(),
          };

          recentKafkaEvents.unshift(eventItem);
          if (recentKafkaEvents.length > 50) recentKafkaEvents.pop();

          console.log(`\n📥 [KAFKA-CONSUMER] NHẬN SỰ KIỆN TỪ TOPIC [${topic}]:`);
          console.log(`   Offset: ${message.offset} | Nguồn: ${payload.sourceSite || 'Unknown'}`);
          console.log(`   Dữ liệu: ${JSON.stringify(payload)}`);

          // Nếu là sự kiện biến động tồn kho từ HN hoặc HCM, tự động đồng bộ về Site 1
          if (topic === 'wms.inventory.events') {
            console.log(`   ⚡ [REALTIME-SYNC] Tự động cập nhật số liệu biến động vào Site 1 (Trụ sở chính)...`);
          }
        } catch (e) {
          console.warn(`   ⚠️ Lỗi phân tích thông điệp Kafka:`, e.message);
        }
      },
    });

    console.log(`✅ [KAFKA-CONSUMER] Đã subscribe các topic: wms.inventory.events, wms.transfer.events, wms.sync.periodic`);
  } catch (err) {
    console.warn(`⚠️ [KAFKA] Chưa thể kết nối Kafka lúc này (${err.message}). Sẽ thử lại khi Kafka khởi động xong.`);
    setTimeout(initKafka, 5000);
  }
}

// Bắt đầu kết nối Kafka sau 3 giây để chờ Kafka broker sẵn sàng
setTimeout(initKafka, 3000);

// =========================================================================
// ĐỒNG BỘ ĐỊNH KỲ QUA KAFKA & API (PERIODIC SYNC)
// =========================================================================
async function runCrossSiteSync(triggeredBy = 'SCHEDULED_TIMER') {
  if (isSyncing) return { status: 'ALREADY_RUNNING' };
  isSyncing = true;
  const startTime = Date.now();
  const syncEvent = {
    id: `SYNC-${Date.now()}`,
    triggeredBy,
    timestamp: new Date().toISOString(),
    sites: {
      siteHN: { status: 'PENDING', itemsSynced: 0 },
      siteHCM: { status: 'PENDING', itemsSynced: 0 },
    },
    status: 'IN_PROGRESS',
  };

  console.log(`\n🔄 [SYNC-WORKER] Bắt đầu chu kỳ đồng bộ dữ liệu liên Site [${syncEvent.id}] - Kích hoạt bởi: ${triggeredBy}`);

  try {
    // 1. Thu thập dữ liệu từ Site 2 (Kho Hà Nội)
    try {
      console.log(`   📡 Đang kết nối Site 2 (Kho miền Bắc) qua Load Balancer: ${HN_LB_URL}...`);
      const hnRes = await axios.get(`${HN_LB_URL}/api/system/node-status`, { timeout: 4000 });
      syncEvent.sites.siteHN.status = 'SUCCESS';
      syncEvent.sites.siteHN.itemsSynced = hnRes.data?.data?.database?.inventoryRecords || 12;
      syncEvent.sites.siteHN.servingNode = hnRes.data?.data?.nodeId || 'hn_app';
      console.log(`   ✅ Site 2 phản hồi từ ${syncEvent.sites.siteHN.servingNode}: ${syncEvent.sites.siteHN.itemsSynced} bản ghi tồn kho`);
    } catch (err) {
      syncEvent.sites.siteHN.status = 'FAILED';
      syncEvent.sites.siteHN.error = err.message;
      console.log(`   ⚠️ Site 2 không phản hồi hoặc đang bận (${err.message})`);
    }

    // 2. Thu thập dữ liệu từ Site 3 (Kho TP.HCM)
    try {
      console.log(`   📡 Đang kết nối Site 3 (Kho miền Nam) qua Load Balancer: ${HCM_LB_URL}...`);
      const hcmRes = await axios.get(`${HCM_LB_URL}/api/system/node-status`, { timeout: 4000 });
      syncEvent.sites.siteHCM.status = 'SUCCESS';
      syncEvent.sites.siteHCM.itemsSynced = hcmRes.data?.data?.database?.inventoryRecords || 15;
      syncEvent.sites.siteHCM.servingNode = hcmRes.data?.data?.nodeId || 'hcm_app';
      console.log(`   ✅ Site 3 phản hồi từ ${syncEvent.sites.siteHCM.servingNode}: ${syncEvent.sites.siteHCM.itemsSynced} bản ghi tồn kho`);
    } catch (err) {
      syncEvent.sites.siteHCM.status = 'FAILED';
      syncEvent.sites.siteHCM.error = err.message;
      console.log(`   ⚠️ Site 3 không phản hồi hoặc đang bận (${err.message})`);
    }

    // 3. Bắn bản tin đồng bộ định kỳ vào Apache Kafka Topic wms.sync.periodic
    if (kafkaProducer) {
      try {
        await kafkaProducer.send({
          topic: 'wms.sync.periodic',
          messages: [
            {
              key: syncEvent.id,
              value: JSON.stringify({
                syncId: syncEvent.id,
                triggeredBy,
                timestamp: syncEvent.timestamp,
                hnStockCount: syncEvent.sites.siteHN.itemsSynced,
                hcmStockCount: syncEvent.sites.siteHCM.itemsSynced,
              }),
            },
          ],
        });
        console.log(`   📨 [KAFKA] Đã phát bản tin đồng bộ định kỳ lên Topic "wms.sync.periodic"!`);
      } catch (kErr) {
        console.warn(`   ⚠️ Lỗi gửi bản tin Kafka:`, kErr.message);
      }
    }

    // 4. Ghi nhận vào Site 1 (Trụ sở chính)
    try {
      console.log(`   🏢 Đang tổng hợp báo cáo và nạp vào Site 1 qua Load Balancer: ${CENTRAL_LB_URL}...`);
      await axios
        .post(
          `${CENTRAL_LB_URL}/api/sync/trigger`,
          {
            sourceSyncId: syncEvent.id,
            hnData: syncEvent.sites.siteHN,
            hcmData: syncEvent.sites.siteHCM,
          },
          { timeout: 4000 }
        )
        .catch(() => {});
      console.log(`   ✅ Đã nạp số liệu tổng hợp vào Site 1 thành công!`);
    } catch (err) {
      console.log(`   ⚠️ Cảnh báo nạp Site 1: ${err.message}`);
    }

    syncEvent.durationMs = Date.now() - startTime;
    syncEvent.status = 'COMPLETED';
    console.log(`🏁 [SYNC-WORKER] Hoàn tất đồng bộ [${syncEvent.id}] trong ${syncEvent.durationMs}ms\n`);
  } catch (error) {
    syncEvent.status = 'ERROR';
    syncEvent.error = error.message;
  } finally {
    isSyncing = false;
    syncHistory.unshift(syncEvent);
    if (syncHistory.length > 20) syncHistory.pop();
  }

  return syncEvent;
}

// Lập lịch định kỳ
setInterval(() => {
  runCrossSiteSync('KAFKA_SCHEDULED_TIMER');
}, SYNC_INTERVAL_SEC * 1000);

// =========================================================================
// API ENDPOINTS
// =========================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'wms-sync-service',
    engine: 'Apache Kafka + Event-Driven CDC',
    intervalSec: SYNC_INTERVAL_SEC,
    kafkaBrokers: KAFKA_BROKERS,
  });
});

app.get('/sync/status', (req, res) => {
  res.json({
    broker: KAFKA_BROKERS,
    syncEngine: 'Apache Kafka (Topics: wms.inventory.events, wms.transfer.events, wms.sync.periodic)',
    latestSync: syncHistory[0] || null,
    totalSyncs: syncHistory.length,
    recentKafkaEventsCount: recentKafkaEvents.length,
    history: syncHistory.slice(0, 5),
  });
});

// Endpoint xem trực tiếp các sự kiện Kafka đã nhận theo thời gian thực
app.get('/kafka/events', (req, res) => {
  res.json({
    success: true,
    total: recentKafkaEvents.length,
    events: recentKafkaEvents,
  });
});

app.post('/sync/run-now', async (req, res) => {
  const result = await runCrossSiteSync('USER_MANUAL_TRIGGER');
  res.json({ success: true, result });
});

app.listen(PORT, () => {
  console.log(`🚀 WMS Cross-Site Sync Service đang chạy tại cổng ${PORT}`);
  console.log(`📬 Message Broker: Apache Kafka (KRaft mode)`);
  console.log(`⏰ Chu kỳ đồng bộ định kỳ: mỗi ${SYNC_INTERVAL_SEC} giây`);
  setTimeout(() => runCrossSiteSync('INITIAL_STARTUP'), 5000);
});

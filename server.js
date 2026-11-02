const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
const path = require('path');
app.use(express.static(__dirname)); // Phục vụ file tĩnh
app.use(express.json());

// Middleware xác thực API key từ Agent
function authenticateAgent(req, res, next) {
  const key = req.headers['x-api-key'];
   console.log("--- BẮT ĐẦU KIỂM TRA ---");
  console.log("1. Key Client gửi lên:", `"${key}"`);
  console.log("2. Key Server đang lưu:", `"${process.env.AGENT_API_KEY}"`);
  if (key !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Endpoint nhận dữ liệu từ Wazuh Agent
app.post('/api/wazuh-alert', authenticateAgent, async (req, res) => {
  try {
    const data = req.body;

    // 1. ETL: Map rule.level -> severity
    const level = data.rule?.level || 0;
    let severity = 'INFO';
    if (level >= 12) severity = 'CRITICAL';
    else if (level >= 10) severity = 'HIGH';
    else if (level >= 7) severity = 'MEDIUM';
    else if (level >= 4) severity = 'LOW';

    // 2. Trích xuất thông tin thiết bị
    const deviceIp = data.agent?.ip || null;
    const deviceMac = data.data?.win?.eventdata?.mac || data.data?.srcmac || null;
    const description = data.rule?.description || 'Unknown alert';

    // 3. Lưu vào database
    const result = await pool.query(
      `INSERT INTO alerts (severity, alert_type, description, device_ip, device_mac, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [severity, 'MALWARE', description, deviceIp, deviceMac, JSON.stringify(data)]
    );
    const alertId = result.rows[0].id;

    // 4. Nếu là CRITICAL và có MAC, tự động gọi ISE để cách ly
    if (severity === 'CRITICAL' && deviceMac) {
      await quarantineDevice(deviceMac, alertId);
    }

    res.json({ success: true, alertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Hàm gọi Cisco ISE ERS API để cách ly
async function quarantineDevice(macAddress, alertId) {
  try {
    const iseAgent = new https.Agent({ rejectUnauthorized: false }); // Bỏ qua SSL self-signed
    const auth = Buffer.from(`${process.env.ISE_USER}:${process.env.ISE_PASSWORD}`).toString('base64');

    await axios.post(
      `${process.env.ISE_BASE_URL}/ers/config/ancendpoint/apply`,
      {
        OperationResult: {
          macAddress: macAddress,
          policyName: 'Quarantine_Policy'
        }
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        httpsAgent: iseAgent
      }
    );

    // Cập nhật trạng thái đã cách ly trong DB
    await pool.query('UPDATE alerts SET is_quarantined = TRUE WHERE id = $1', [alertId]);
    console.log(`✅ Đã cách ly thiết bị ${macAddress}`);
  } catch (err) {
    console.error(`❌ Lỗi khi gọi ISE:`, err.response?.data || err.message);
  }
}

// Endpoint cho Frontend lấy danh sách cảnh báo
app.get('/api/alerts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 50'
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Web Server đang chạy tại http://0.0.0.0:${PORT}`);
});
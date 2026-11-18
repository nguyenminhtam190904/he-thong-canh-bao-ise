const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const pool = require('./db');
const { router: authRouter, requireAuth, initAuth } = require('./auth');
require('dotenv').config();

const app = express();
app.use(cors());
const path = require('path');
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// Đăng nhập / đăng xuất (tài khoản lưu ở database riêng, xem auth-db.js)
app.use('/api/auth', authRouter);

// ---------- Realtime: đẩy sự kiện tới trình duyệt qua Server-Sent Events ----------
const liveClients = new Set();

function broadcastAlertChange(type, data = {}) {
  const message = `event: alerts\ndata: ${JSON.stringify({ type, ...data, at: new Date().toISOString() })}\n\n`;
  for (const client of liveClients) client.write(message);
}

app.get('/api/alerts/stream', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  res.write(`event: ready\ndata: {}\n\n`);
  liveClients.add(res);

  // Giữ kết nối sống qua proxy/firewall
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    liveClients.delete(res);
  });
});

// Middleware for validating the API key from the agent
function authenticateAgent(req, res, next) {
  const key = req.headers['x-api-key'];
  console.log("--- AUTHENTICATION CHECK ---");
  console.log("1. Client key:", `"${key}"`);
  console.log("2. Configured server key:", `"${process.env.AGENT_API_KEY}"`);
  
  if (key !== process.env.AGENT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Endpoint for receiving data from the Wazuh agent
app.post('/api/wazuh-alert', authenticateAgent, async (req, res) => {
  try {
    const data = req.body;
    let severity = 'INFO';
    if (data.severity && typeof data.severity === 'string') {
      severity = data.severity.trim().toUpperCase();
    } else {
      const level = Number(data.rule?.level) || 0;
      if (level >= 12) severity = 'CRITICAL';
      else if (level >= 10) severity = 'HIGH';
      else if (level >= 7) severity = 'MEDIUM';
      else if (level >= 4) severity = 'LOW';
    }

    // 2. Trích xuất thông tin thiết bị động từ nhiều định dạng payload của agent
    const deviceIp = data.device_ip || data.ip || data.agent?.ip || data.data?.srcip || null;
    const rawMac =
      data.device_mac ||
      data.mac ||
      data.agent?.mac ||
      data.data?.win?.eventdata?.mac ||
      data.data?.srcmac ||
      null;
    const deviceMac = rawMac ? String(rawMac).trim() : null;

    const alertType = data.alert_type || 'MALWARE';
    const description = data.description || data.rule?.description || 'Unknown alert';

    console.log(`📩 Received Alert | Severity: ${severity} | IP: ${deviceIp} | MAC: ${deviceMac}`);

    // 3. Lưu cảnh báo vào database
    const result = await pool.query(
      `INSERT INTO alerts (severity, alert_type, description, device_ip, device_mac, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [severity, alertType, description, deviceIp, deviceMac, JSON.stringify(data)]
    );
    const alertId = result.rows[0].id;
    broadcastAlertChange('created', { id: alertId, severity });

    // 4. Kích hoạt cách ly qua Cisco ISE nếu severity từ MEDIUM trở lên (MEDIUM, HIGH, CRITICAL) và có MAC
    const quarantineSeverities = ['MEDIUM', 'HIGH', 'CRITICAL'];
    let quarantineTriggered = false;

    if (quarantineSeverities.includes(severity)) {
      if (deviceMac) {
        await quarantineDevice(deviceMac, alertId);
        quarantineTriggered = true;
      } else {
        console.warn(`⚠️ Alert [${alertId}] có mức độ ${severity} nhưng thiếu địa chỉ MAC nên bỏ qua bước cách ly ISE.`);
      }
    }

    res.json({
      success: true,
      alertId,
      severity,
      quarantineTriggered
    });
  } catch (err) {
    console.error('❌ Error processing /api/wazuh-alert:', err);
    res.status(500).json({ error: err.message });
  }
});

// Call the Cisco ISE ERS API to quarantine a device
async function quarantineDevice(macAddress, alertId) {
  try {
    const iseAgent = new https.Agent({ rejectUnauthorized: false });
    const policyName = process.env.ISE_QUARANTINE_POLICY || 'Quarantine_Policy';

    await axios({
      method: 'PUT',
      url: `${process.env.ISE_BASE_URL}/ers/config/ancendpoint/apply`,
      data: {
        OperationAdditionalData: {
          additionalData: [
            {
              name: 'macAddress',
              value: macAddress
            },
            {
              name: 'policyName',
              value: policyName
            }
          ]
        }
      },
      auth: {
        username: process.env.ISE_USER,
        password: process.env.ISE_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: iseAgent
    });

    // Update the quarantine status in the database
    await pool.query('UPDATE alerts SET is_quarantined = TRUE WHERE id = $1', [alertId]);
    broadcastAlertChange('quarantined', { id: alertId });
    console.log(`✅ Successfully sent the quarantine command for MAC [${macAddress}] (Policy: ${policyName}) to Cisco ISE.`);
  } catch (err) {
    console.error(`❌ Failed to call the ISE API to quarantine MAC [${macAddress}]:`);
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

app.post('/api/agents/clear-quarantine', requireAuth, async (req, res) => {
  const macAddress = typeof req.body?.macAddress === 'string' ? req.body.macAddress.trim() : '';
  const isValidMac = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(macAddress)
    || /^[0-9a-f]{12}$/i.test(macAddress);

  if (!isValidMac) {
    return res.status(400).json({ error: 'A valid device MAC address is required.' });
  }

  try {
    const iseAgent = new https.Agent({ rejectUnauthorized: false });
    await axios({
      method: 'PUT',
      url: `${process.env.ISE_BASE_URL}/ers/config/ancendpoint/clear`,
      data: {
        OperationAdditionalData: {
          additionalData: [
            {
              name: 'macAddress',
              value: macAddress
            }
          ]
        }
      },
      auth: {
        username: process.env.ISE_USER,
        password: process.env.ISE_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      httpsAgent: iseAgent
    });
  } catch (err) {
    console.error(`❌ Failed to clear quarantine for MAC [${macAddress}]:`, err.message);
    return res.status(502).json({ error: 'Cisco ISE could not remove quarantine for this device.' });
  }

  try {
    await pool.query(
      'UPDATE alerts SET is_quarantined = FALSE WHERE LOWER(device_mac) = LOWER($1)',
      [macAddress]
    );
  } catch (err) {
    console.error(`Cisco ISE cleared quarantine for MAC [${macAddress}], but the local status update failed:`, err);
    return res.status(500).json({ error: 'Cisco ISE cleared quarantine, but the local status could not be updated. Reload device data.' });
  }

  broadcastAlertChange('quarantine-cleared', { macAddress });
  return res.json({ success: true, macAddress });
});

// Endpoint for the frontend to retrieve alerts
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 50'
    );
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retrieve aggregate statistics and the seven-day trend for the dashboard
app.get('/api/dashboard-summary', requireAuth, async (req, res) => {
  try {
    const [summary, trend] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical,
          COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS high,
          COUNT(*) FILTER (WHERE severity = 'MEDIUM')::int AS medium,
          COUNT(*) FILTER (WHERE severity = 'LOW')::int AS low,
          COUNT(*) FILTER (WHERE is_quarantined = TRUE)::int AS quarantined
        FROM alerts
      `),
      pool.query(`
        SELECT
          TO_CHAR(days.day, 'YYYY-MM-DD') AS day,
          COUNT(alerts.id)::int AS total,
          COUNT(alerts.id) FILTER (WHERE alerts.severity = 'CRITICAL')::int AS critical
        FROM GENERATE_SERIES(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS days(day)
        LEFT JOIN alerts
          ON alerts.timestamp >= days.day
          AND alerts.timestamp < days.day + INTERVAL '1 day'
        GROUP BY days.day
        ORDER BY days.day ASC
      `)
    ]);

    res.json({ stats: summary.rows[0], trend: trend.rows });
  } catch (err) {
    console.error('Could not load dashboard statistics:', err);
    res.status(500).json({ error: err.message });
  }
});

// Client-side dashboard routes resolve to the Vite entry point; API routes above remain unchanged.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3000;
initAuth()
  .then(() => {
    app.listen(PORT, '0.0.0.0', (err) => {
      if (err) {
        if (err.code === 'EADDRINUSE') {
          console.error(`❌ Cổng ${PORT} đang bị một chương trình khác chiếm (có thể là server cũ chưa tắt).`);
          console.error(`   Tắt nó bằng Ctrl+C trong terminal đang chạy, hoặc: taskkill /F /IM node.exe`);
        } else {
          console.error('❌ Không khởi động được server:', err.message);
        }
        process.exit(1);
      }
      console.log(`🚀 Web server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Không khởi tạo được database tài khoản:', err.message);
    process.exit(1);
  });
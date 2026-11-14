const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
const path = require('path');
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

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

// Endpoint for the frontend to retrieve alerts
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

// Retrieve aggregate statistics and the seven-day trend for the dashboard
app.get('/api/dashboard-summary', async (req, res) => {
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Web server is running at http://0.0.0.0:${PORT}`);
});
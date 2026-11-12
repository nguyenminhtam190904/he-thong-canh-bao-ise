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

    // 1. ETL: Map rule.level -> severity
    const level = data.rule?.level || 0;
    let severity = 'INFO';
    if (level >= 12) severity = 'CRITICAL';
    else if (level >= 10) severity = 'HIGH';
    else if (level >= 7) severity = 'MEDIUM';
    else if (level >= 4) severity = 'LOW';

    // 2. Extract device information
    const deviceIp = data.agent?.ip || null;
    const deviceMac = data.data?.win?.eventdata?.mac || data.data?.srcmac || null;
    const description = data.rule?.description || 'Unknown alert';

    // 3. Save to the database
    const result = await pool.query(
      `INSERT INTO alerts (severity, alert_type, description, device_ip, device_mac, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [severity, 'MALWARE', description, deviceIp, deviceMac, JSON.stringify(data)]
    );
    const alertId = result.rows[0].id;

    // 4. If severity is CRITICAL and a MAC address is available, quarantine through ISE
    if (severity === 'CRITICAL' && deviceMac) {
      await quarantineDevice(deviceMac, alertId);
    }

    res.json({ success: true, alertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Call the Cisco ISE ERS API to quarantine a device
async function quarantineDevice(macAddress, alertId) {
  try {
    const iseAgent = new https.Agent({ rejectUnauthorized: false }); 

    await axios({
      method: 'PUT',
      url: `${process.env.ISE_BASE_URL}/ers/config/ancendpoint/apply`,
      data: {
        "OperationAdditionalData": {
          "additionalData": [
            {
              "name": "macAddress",
              "value": macAddress
            },
            {
              "name": "policyName",
              "value": "Quarantine_Policy" // Ensure this policy name exactly matches the one configured in ISE
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
    console.log(`✅ Successfully sent the quarantine command for MAC [${macAddress}] to Cisco ISE.`);
  } catch (err) {
    console.error(`❌ Failed to call the ISE API to quarantine MAC [${macAddress}]:`);
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      // Use JSON.stringify to print the full error instead of [Object]
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

// Start the server
// ============================================================================
// TEST ENDPOINT: Test the ISE API when no agent is available
// Open http://localhost:3000/api/test-ise in a browser
// ============================================================================
app.get('/api/test-ise', async (req, res) => {
  // Create a mock MAC address in the expected format
  const mockIp = '172.16.10.100';
  const mockMac = '50:00:00:08:00:00'; 
  const mockAlertId = 9999; // Mock alert ID

  console.log(`[TEST] Sending a simulated quarantine command for IP: ${mockIp}, MAC: ${mockMac}`);
  
  try {
    // Call the quarantineDevice function directly
    await quarantineDevice(mockMac, mockAlertId);
    res.json({ 
      success: true, 
      message: `Quarantine was requested for MAC ${mockMac}. Check the Node.js terminal logs for details.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
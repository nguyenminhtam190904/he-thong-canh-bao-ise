const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const pool = require('./db');
const { router: authRouter, requireAuth, initAuth } = require('./auth');
const {
  QUARANTINE_THRESHOLDS,
  ensureSettingsTable,
  getSettings,
  getSettingsMeta,
  validateSettings,
  saveSettings,
  shouldAutoQuarantine,
} = require('./settings');
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

// Kiểm tra API key do agent gửi lên (header x-api-key).
// Không ghi key ra log; so sánh bằng timingSafeEqual trên giá trị băm để không lộ key qua thời gian phản hồi.
function hashKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function authenticateAgent(req, res, next) {
  const configuredKey = process.env.AGENT_API_KEY;
  const key = req.headers['x-api-key'];

  if (!configuredKey) {
    console.error('❌ AGENT_API_KEY chưa được cấu hình trong .env — từ chối mọi cảnh báo từ agent.');
    return res.status(503).json({ error: 'Agent ingestion is not configured.' });
  }
  if (typeof key !== 'string' || !crypto.timingSafeEqual(hashKey(key), hashKey(configuredKey))) {
    console.warn(`⚠️ Từ chối cảnh báo từ ${req.ip}: API key không hợp lệ.`);
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

    // 4. Tự động cách ly qua Cisco ISE theo cấu hình trên trang Settings
    //    (mặc định: bật, từ mức HIGH trở lên) và chỉ khi có MAC
    let quarantineTriggered = false;
    let quarantineError = null;

    if (shouldAutoQuarantine(severity)) {
      if (deviceMac) {
        const outcome = await quarantineDevice(deviceMac, alertId);
        quarantineTriggered = outcome.ok;
        quarantineError = outcome.error;
      } else {
        quarantineError = 'Alert has no device MAC address; quarantine was skipped.';
        await pool.query('UPDATE alerts SET quarantine_error = $1 WHERE id = $2', [quarantineError, alertId]);
        console.warn(`⚠️ Alert [${alertId}] có mức độ ${severity} nhưng thiếu địa chỉ MAC nên bỏ qua bước cách ly ISE.`);
      }
    }

    res.json({
      success: true,
      alertId,
      severity,
      quarantineTriggered,
      quarantineError
    });
  } catch (err) {
    console.error('❌ Error processing /api/wazuh-alert:', err);
    res.status(500).json({ error: err.message });
  }
});

const ISE_TIMEOUT_MS = Number(process.env.ISE_TIMEOUT_MS) || 15000;
const MAC_PATTERN = /^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$|^[0-9a-f]{12}$/i;

function describeIseError(err) {
  if (err.response) return `Cisco ISE responded with HTTP ${err.response.status}.`;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'Cisco ISE did not respond (timeout).';
  if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'EHOSTUNREACH' || err.code === 'ENOTFOUND') {
    return `Could not connect to Cisco ISE (${err.code}).`;
  }
  return err.message || 'Unknown error while calling Cisco ISE.';
}

// Gọi Cisco ISE ERS API để cách ly thiết bị.
// Trả về { ok: true } khi ISE chấp nhận, ngược lại { ok: false, error } và lưu lỗi vào alert.
async function quarantineDevice(macAddress, alertId) {
  const policyName = getSettings().ise_quarantine_policy;
  try {
    await axios({
      method: 'PUT',
      url: `${process.env.ISE_BASE_URL}/ers/config/ancendpoint/apply`,
      data: {
        OperationAdditionalData: {
          additionalData: [
            { name: 'macAddress', value: macAddress },
            { name: 'policyName', value: policyName }
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
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: ISE_TIMEOUT_MS
    });
  } catch (err) {
    const error = describeIseError(err);
    console.error(`❌ Failed to call the ISE API to quarantine MAC [${macAddress}]: ${error}`);
    if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
    await pool.query('UPDATE alerts SET quarantine_error = $1 WHERE id = $2', [error, alertId]);
    broadcastAlertChange('quarantine-failed', { id: alertId, macAddress });
    return { ok: false, error };
  }

  // ISE đã nhận lệnh -> đánh dấu alert là đã cách ly và xoá các lỗi cũ của thiết bị này
  await pool.query('UPDATE alerts SET is_quarantined = TRUE, quarantine_error = NULL WHERE id = $1', [alertId]);
  await pool.query('UPDATE alerts SET quarantine_error = NULL WHERE LOWER(device_mac) = LOWER($1)', [macAddress]);
  broadcastAlertChange('quarantined', { id: alertId, macAddress });
  console.log(`✅ Successfully sent the quarantine command for MAC [${macAddress}] (Policy: ${policyName}) to Cisco ISE.`);
  return { ok: true, error: null };
}

// Thử cách ly lại thủ công một thiết bị đã bị "Quarantine failed"
app.post('/api/agents/quarantine', requireAuth, async (req, res) => {
  const macAddress = typeof req.body?.macAddress === 'string' ? req.body.macAddress.trim() : '';
  if (!MAC_PATTERN.test(macAddress)) {
    return res.status(400).json({ error: 'A valid device MAC address is required.' });
  }

  try {
    // Ưu tiên alert đang mang lỗi cách ly; nếu không có thì lấy alert HIGH/CRITICAL mới nhất của MAC này
    const latest = await pool.query(
      `SELECT id FROM alerts
       WHERE LOWER(device_mac) = LOWER($1) AND severity = ANY($2)
       ORDER BY (quarantine_error IS NOT NULL) DESC, timestamp DESC LIMIT 1`,
      [macAddress, QUARANTINE_THRESHOLDS]
    );
    if (latest.rows.length === 0) {
      return res.status(404).json({ error: 'No HIGH or CRITICAL alert found for this device.' });
    }
    const outcome = await quarantineDevice(macAddress, latest.rows[0].id);
    if (!outcome.ok) return res.status(502).json({ error: outcome.error });
    return res.json({ success: true, macAddress, alertId: latest.rows[0].id });
  } catch (err) {
    console.error(`❌ Failed to retry quarantine for MAC [${macAddress}]:`, err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents/clear-quarantine', requireAuth, async (req, res) => {
  const macAddress = typeof req.body?.macAddress === 'string' ? req.body.macAddress.trim() : '';
  if (!MAC_PATTERN.test(macAddress)) {
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
      httpsAgent: iseAgent,
      timeout: ISE_TIMEOUT_MS
    });
  } catch (err) {
    console.error(`❌ Failed to clear quarantine for MAC [${macAddress}]:`, err.message);
    return res.status(502).json({ error: 'Cisco ISE could not remove quarantine for this device.' });
  }

  try {
    await pool.query(
      'UPDATE alerts SET is_quarantined = FALSE, quarantine_error = NULL WHERE LOWER(device_mac) = LOWER($1)',
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

// Mỗi alert được gắn một "device_key" để gom theo thiết bị (giống cách frontend nhận diện):
// agent id -> tên máy -> IP -> MAC. Dùng chung cho danh sách thiết bị và thống kê dashboard.
const DEVICE_ALERTS_CTE = `
  alert_devices AS (
    SELECT
      alerts.*,
      COALESCE(
        NULLIF(raw_payload->'agent'->>'id', ''),
        NULLIF(raw_payload->>'agent_id', ''),
        NULLIF(raw_payload->'data'->>'agent_id', '')
      ) AS agent_id,
      COALESCE(
        NULLIF(raw_payload->'agent'->>'name', ''),
        NULLIF(raw_payload->'agent'->>'hostname', ''),
        NULLIF(raw_payload->>'agent_name', ''),
        NULLIF(raw_payload->'data'->>'hostname', '')
      ) AS hostname,
      COALESCE(host(device_ip), NULLIF(raw_payload->'agent'->>'ip', '')) AS ip,
      COALESCE(
        NULLIF(device_mac, ''),
        NULLIF(raw_payload->'data'->'win'->'eventdata'->>'mac', ''),
        NULLIF(raw_payload->'data'->>'srcmac', '')
      ) AS mac,
      COALESCE(
        NULLIF(raw_payload->'agent'->'os'->>'name', ''),
        NULLIF(raw_payload->'agent'->'os'->>'platform', ''),
        CASE WHEN jsonb_typeof(raw_payload->'agent'->'os') = 'string' THEN raw_payload->'agent'->>'os' END,
        CASE WHEN jsonb_typeof(raw_payload->'os') = 'string' THEN raw_payload->>'os' END
      ) AS os
    FROM alerts
  ),
  keyed AS (
    SELECT *, COALESCE(agent_id, hostname, ip, LOWER(mac)) AS device_key
    FROM alert_devices
  )`;

// Danh sách thiết bị tính trên TOÀN BỘ cảnh báo trong database (không giới hạn 50 bản ghi).
// Thiết bị "Quarantined" nếu có bất kỳ alert nào đang cách ly (cho tới khi gỡ cách ly).
app.get('/api/agents', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      WITH ${DEVICE_ALERTS_CTE}
      SELECT
        device_key AS id,
        (ARRAY_AGG(agent_id ORDER BY timestamp DESC) FILTER (WHERE agent_id IS NOT NULL))[1] AS agent_id,
        (ARRAY_AGG(hostname ORDER BY timestamp DESC) FILTER (WHERE hostname IS NOT NULL))[1] AS hostname,
        (ARRAY_AGG(ip ORDER BY timestamp DESC) FILTER (WHERE ip IS NOT NULL))[1] AS ip,
        (ARRAY_AGG(mac ORDER BY timestamp DESC) FILTER (WHERE mac IS NOT NULL))[1] AS mac,
        (ARRAY_AGG(os ORDER BY timestamp DESC) FILTER (WHERE os IS NOT NULL))[1] AS os,
        COUNT(*)::int AS alert_count,
        MAX(timestamp) AS last_alert,
        BOOL_OR(is_quarantined) AS is_quarantined,
        (ARRAY_AGG(quarantine_error ORDER BY timestamp DESC) FILTER (WHERE quarantine_error IS NOT NULL))[1] AS quarantine_error
      FROM keyed
      WHERE device_key IS NOT NULL
      GROUP BY device_key
      ORDER BY MAX(timestamp) DESC
    `);
    const data = result.rows.map((row) => ({
      ...row,
      status: row.is_quarantined ? 'quarantined' : row.quarantine_error ? 'quarantine_failed' : 'running',
      quarantine_error: row.is_quarantined ? null : row.quarantine_error,
    }));
    res.json({ data });
  } catch (err) {
    console.error('Could not load devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Retrieve aggregate statistics and the seven-day trend for the dashboard
app.get('/api/dashboard-summary', requireAuth, async (req, res) => {
  try {
    const [summary, trend] = await Promise.all([
      pool.query(`
        WITH ${DEVICE_ALERTS_CTE}
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical,
          COUNT(*) FILTER (WHERE severity = 'HIGH')::int AS high,
          COUNT(*) FILTER (WHERE severity = 'MEDIUM')::int AS medium,
          COUNT(*) FILTER (WHERE severity = 'LOW')::int AS low,
          COUNT(*) FILTER (WHERE is_quarantined = TRUE)::int AS quarantined_alerts,
          COUNT(DISTINCT device_key) FILTER (WHERE is_quarantined = TRUE)::int AS quarantined_devices,
          COUNT(DISTINCT device_key)::int AS devices
        FROM keyed
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

// ---------- Cấu hình hệ thống (trang Settings) ----------
function iseConnectionInfo() {
  let host = null;
  try {
    host = process.env.ISE_BASE_URL ? new URL(process.env.ISE_BASE_URL).host : null;
  } catch {
    host = null;
  }
  return {
    host,
    configured: Boolean(process.env.ISE_BASE_URL && process.env.ISE_USER && process.env.ISE_PASSWORD),
  };
}

app.get('/api/settings', requireAuth, (req, res) => {
  res.json({
    settings: getSettings(),
    meta: getSettingsMeta(),
    ise: iseConnectionInfo(),
    thresholds: QUARANTINE_THRESHOLDS,
    canEdit: req.user.role === 'admin',
  });
});

app.put('/api/settings', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can change system settings.' });
  }
  const { values, error } = validateSettings(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const settings = await saveSettings(values, req.user.username);
    console.log(`⚙️  ${req.user.username} đã cập nhật cấu hình:`, values);
    res.json({ settings, meta: getSettingsMeta() });
  } catch (err) {
    console.error('Could not save settings:', err);
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

// Kiểm tra kết nối tới Cisco ISE và xem ANC policy đang cấu hình có tồn tại không
app.post('/api/settings/test-ise', requireAuth, async (req, res) => {
  const ise = iseConnectionInfo();
  if (!ise.configured) {
    return res.json({ ok: false, error: 'ISE_BASE_URL, ISE_USER and ISE_PASSWORD must be set in .env.' });
  }
  const policyName = getSettings().ise_quarantine_policy;
  const startedAt = Date.now();
  try {
    const response = await axios({
      method: 'GET',
      url: `${process.env.ISE_BASE_URL}/ers/config/ancpolicy`,
      params: { size: 100 },
      auth: { username: process.env.ISE_USER, password: process.env.ISE_PASSWORD },
      headers: { Accept: 'application/json' },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: ISE_TIMEOUT_MS,
    });
    const policies = (response.data?.SearchResult?.resources || []).map((item) => item.name).filter(Boolean);
    res.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      policies,
      policyFound: policies.includes(policyName),
      policyName,
    });
  } catch (err) {
    const error = err.response?.status === 401
      ? 'Cisco ISE rejected the credentials (HTTP 401). Check ISE_USER / ISE_PASSWORD and ERS permissions.'
      : describeIseError(err);
    res.json({ ok: false, error, latencyMs: Date.now() - startedAt });
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
pool.query('ALTER TABLE alerts ADD COLUMN IF NOT EXISTS quarantine_error TEXT')
  .then(() => ensureSettingsTable())
  .then(() => initAuth())
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
    console.error('❌ Không khởi tạo được database:', err.message);
    process.exit(1);
  });
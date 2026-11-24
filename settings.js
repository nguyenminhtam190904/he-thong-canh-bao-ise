// Cấu hình hệ thống lưu trong database cảnh báo (bảng app_settings), dùng chung cho mọi người dùng.
// Server đọc các giá trị này khi xử lý cảnh báo, nên thay đổi trên trang Settings có hiệu lực ngay.
const pool = require('./db');

// Thứ tự mức độ để so sánh "từ mức X trở lên"
const SEVERITY_RANK = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
// Các mức được phép chọn làm ngưỡng tự động cách ly
const QUARANTINE_THRESHOLDS = ['HIGH', 'CRITICAL'];

const DEFAULTS = Object.freeze({
  auto_quarantine_enabled: true,
  auto_quarantine_min_severity: 'HIGH',
  ise_quarantine_policy: process.env.ISE_QUARANTINE_POLICY || 'Quarantine_Policy',
});

let cache = null;
let meta = { updated_at: null, updated_by: null };

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        VARCHAR(64) PRIMARY KEY,
      value      JSONB       NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by VARCHAR(64)
    )
  `);
  await loadSettings();
}

async function loadSettings() {
  const result = await pool.query('SELECT key, value, updated_at, updated_by FROM app_settings');
  const next = { ...DEFAULTS };
  meta = { updated_at: null, updated_by: null };
  for (const row of result.rows) {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, row.key)) next[row.key] = row.value;
    if (!meta.updated_at || row.updated_at > meta.updated_at) {
      meta = { updated_at: row.updated_at, updated_by: row.updated_by };
    }
  }
  cache = next;
  return cache;
}

function getSettings() {
  return cache || { ...DEFAULTS };
}

function getSettingsMeta() {
  return meta;
}

// Kiểm tra và chuẩn hoá dữ liệu gửi lên. Trả về { values } hoặc { error }.
function validateSettings(input = {}) {
  const values = {};
  if ('auto_quarantine_enabled' in input) {
    if (typeof input.auto_quarantine_enabled !== 'boolean') return { error: 'auto_quarantine_enabled must be true or false.' };
    values.auto_quarantine_enabled = input.auto_quarantine_enabled;
  }
  if ('auto_quarantine_min_severity' in input) {
    const severity = String(input.auto_quarantine_min_severity || '').toUpperCase();
    if (!QUARANTINE_THRESHOLDS.includes(severity)) return { error: 'The minimum severity must be HIGH or CRITICAL.' };
    values.auto_quarantine_min_severity = severity;
  }
  if ('ise_quarantine_policy' in input) {
    const policy = String(input.ise_quarantine_policy || '').trim();
    if (!/^[\w.\- ]{1,64}$/.test(policy)) {
      return { error: 'The ANC policy name must be 1–64 characters (letters, numbers, space, _ . -).' };
    }
    values.ise_quarantine_policy = policy;
  }
  if (Object.keys(values).length === 0) return { error: 'No settings to update.' };
  return { values };
}

async function saveSettings(values, username) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(values)) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [key, JSON.stringify(value), username]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return loadSettings();
}

// Cảnh báo mức `severity` có phải tự động cách ly theo cấu hình hiện tại không
function shouldAutoQuarantine(severity) {
  const settings = getSettings();
  if (!settings.auto_quarantine_enabled) return false;
  const rank = SEVERITY_RANK[String(severity).toUpperCase()];
  return rank !== undefined && rank >= SEVERITY_RANK[settings.auto_quarantine_min_severity];
}

module.exports = {
  DEFAULTS,
  QUARANTINE_THRESHOLDS,
  ensureSettingsTable,
  getSettings,
  getSettingsMeta,
  validateSettings,
  saveSettings,
  shouldAutoQuarantine,
};

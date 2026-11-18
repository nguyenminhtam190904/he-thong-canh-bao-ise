// Kết nối tới database RIÊNG dùng để lưu tài khoản đăng nhập (tách khỏi database cảnh báo).
const { Pool } = require('pg');
require('dotenv').config();

const AUTH_DB_NAME = process.env.AUTH_DB_NAME || 'alert_auth';

function connectionConfig(database) {
  return {
    host: process.env.AUTH_DB_HOST || process.env.DB_HOST,
    port: process.env.AUTH_DB_PORT || process.env.DB_PORT,
    user: process.env.AUTH_DB_USER || process.env.DB_USER,
    password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
    database,
  };
}

const authPool = new Pool(connectionConfig(AUTH_DB_NAME));

// Tạo database (nếu chưa có) và bảng users.
async function ensureAuthDatabase() {
  const admin = new Pool(connectionConfig('postgres'));
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [AUTH_DB_NAME]);
    if (exists.rowCount === 0) {
      // Tên database không truyền được qua tham số => chỉ cho phép ký tự an toàn.
      if (!/^[a-z_][a-z0-9_]*$/i.test(AUTH_DB_NAME)) {
        throw new Error(`Tên AUTH_DB_NAME không hợp lệ: ${AUTH_DB_NAME}`);
      }
      await admin.query(`CREATE DATABASE "${AUTH_DB_NAME}"`);
      console.log(`🗄️  Đã tạo database tài khoản "${AUTH_DB_NAME}".`);
    }
  } finally {
    await admin.end();
  }

  await authPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(64)  NOT NULL UNIQUE,
      password_hash TEXT         NOT NULL,
      full_name     VARCHAR(128),
      role          VARCHAR(16)  NOT NULL DEFAULT 'admin',
      is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `);
}

module.exports = { authPool, ensureAuthDatabase, AUTH_DB_NAME };

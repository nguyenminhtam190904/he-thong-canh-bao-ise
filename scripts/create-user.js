// Tạo tài khoản mới hoặc đặt lại mật khẩu cho tài khoản có sẵn.
// Cách dùng: npm run create-user -- <tai_khoan> <mat_khau> ["Ho ten"]
const { authPool, ensureAuthDatabase } = require('../auth-db');
const { hashPassword } = require('../auth');

async function main() {
  const [username, password, fullName] = process.argv.slice(2);
  if (!username || !password) {
    console.log('Cách dùng: npm run create-user -- <tai_khoan> <mat_khau> ["Ho ten"]');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Mật khẩu phải có ít nhất 8 ký tự.');
    process.exitCode = 1;
    return;
  }

  await ensureAuthDatabase();
  const result = await authPool.query(
    `INSERT INTO users (username, password_hash, full_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name = COALESCE(EXCLUDED.full_name, users.full_name),
           is_active = TRUE
     RETURNING id, (xmax = 0) AS created`,
    [username, hashPassword(password), fullName || null]
  );
  const { id, created } = result.rows[0];
  console.log(created ? `✅ Đã tạo tài khoản "${username}" (id ${id}).` : `✅ Đã đặt lại mật khẩu cho "${username}".`);
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exitCode = 1;
  })
  .finally(() => authPool.end());

const db = require('./src/config/database.js');

async function check() {
  try {
    // Check all users
    const users = await db.query(`SELECT id, email, role FROM users LIMIT 10`);
    console.log('📌 All Users:');
    console.log(JSON.stringify(users[0], null, 2));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
check();

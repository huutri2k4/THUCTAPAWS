const db = require('./src/config/database.js');

async function check() {
  try {
    const result = await db.query(`
      SELECT id, userId, fullName, companyName FROM mentors
    `);
    console.log('📌 All Mentors in DB:');
    console.log(JSON.stringify(result[0], null, 2));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
check();

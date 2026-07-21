const db = require('./src/config/database.js');

async function fix() {
  try {
    // Delete mentor with userId 2 (admin)
    const result = await db.query(`
      DELETE FROM mentors WHERE userId = 2
    `);
    console.log('✅ Deleted mentor for admin (userId 2)');
    
    // Verify
    const remaining = await db.query(`SELECT id, userId FROM mentors`);
    console.log('📌 Remaining mentors:', JSON.stringify(remaining[0], null, 2));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
fix();

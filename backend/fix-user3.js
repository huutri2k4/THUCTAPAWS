const db = require('./src/config/database.js');

async function setup() {
  try {
    // Get mentor ID (should be 1 from before)
    const [mentor] = await db.query(`SELECT id FROM mentors WHERE userId = 2 LIMIT 1`);
    const mentorId = mentor[0].id;
    console.log('📌 Mentor ID:', mentorId);

    // Assign mentor to user 3's student
    const updateResult = await db.query(`
      UPDATE students SET mentorId = ? WHERE userId = 3
    `, { replacements: [mentorId] });
    console.log('✅ Mentor assigned to user 3');

    // Verify
    const [verify] = await db.query(`
      SELECT s.id, s.userId, s.mentorId FROM students s WHERE s.userId = 3
    `);
    console.log('📌 Updated student:', JSON.stringify(verify[0], null, 2));

  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
setup();

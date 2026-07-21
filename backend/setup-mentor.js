const db = require('./src/config/database.js');

async function setup() {
  try {
    // Create mentor for user 2
    const mentorResult = await db.query(`
      INSERT INTO mentors (userId, createdAt, updatedAt)
      SELECT 2, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM mentors WHERE userId = 2)
    `);
    console.log('✅ Mentor created/exists');

    // Get the mentor ID
    const [mentor] = await db.query(`SELECT id FROM mentors WHERE userId = 2 LIMIT 1`);
    const mentorId = mentor[0].id;
    console.log('📌 Mentor ID:', mentorId);

    // Assign mentor to student (userId 1, studentId 2)
    const updateResult = await db.query(`
      UPDATE students SET mentorId = ? WHERE userId = 1
    `, { replacements: [mentorId] });
    console.log('✅ Mentor assigned to student');

    // Verify
    const [verify] = await db.query(`
      SELECT s.id, s.mentorId, m.userId FROM students s
      LEFT JOIN mentors m ON s.mentorId = m.id
      WHERE s.userId = 1
    `);
    console.log('📌 Updated student:', JSON.stringify(verify[0], null, 2));

  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
setup();

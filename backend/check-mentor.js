const db = require('./src/config/database.js');

async function check() {
  try {
    // Check mentors
    const mentors = await db.query(`
      SELECT 
        m.id as mentorId,
        m.userId,
        u.email,
        COUNT(s.id) as studentCount
      FROM mentors m
      LEFT JOIN users u ON m.userId = u.id
      LEFT JOIN students s ON s.mentorId = m.id
      GROUP BY m.id
      LIMIT 5
    `);
    console.log('📌 Available Mentors:');
    console.log(JSON.stringify(mentors[0], null, 2));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
check();

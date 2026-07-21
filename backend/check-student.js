const db = require('./src/config/database.js');

async function check() {
  try {
    const result = await db.query(`
      SELECT 
        u.id as userId, 
        s.id as studentId, 
        s.periodId,
        s.mentorId,
        COUNT(i.id) as internshipCount
      FROM users u
      LEFT JOIN students s ON u.id = s.userId
      LEFT JOIN internships i ON s.id = i.studentId
      WHERE u.id = 1
      GROUP BY u.id, s.id
    `);
    console.log('📌 User/Student/Internship Data:');
    console.log(JSON.stringify(result[0], null, 2));
  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
check();

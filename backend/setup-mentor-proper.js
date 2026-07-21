const db = require('./src/config/database.js');

async function setup() {
  try {
    // Create a new user for mentor (if doesn't exist)
    const [users] = await db.query(`
      SELECT id FROM users WHERE email = 'mentor@company.com' LIMIT 1
    `);
    
    let mentorUserId;
    if (users.length === 0) {
      const result = await db.query(`
        INSERT INTO users (email, password, role, createdAt, updatedAt)
        VALUES ('mentor@company.com', '$2b$10$abcdefghijklmnopqrstuvwxyz', 'MENTOR', NOW(), NOW())
      `);
      mentorUserId = result[0].insertId;
      console.log('✅ Created mentor user (ID:', mentorUserId, ')');
    } else {
      mentorUserId = users[0].id;
      console.log('📌 Mentor user already exists (ID:', mentorUserId, ')');
    }

    // Create mentor record
    const [existingMentors] = await db.query(`
      SELECT id FROM mentors WHERE userId = ${mentorUserId}
    `);

    let mentorId;
    if (existingMentors.length === 0) {
      await db.query(`
        INSERT INTO mentors (userId, fullName, companyName, phone, createdAt, updatedAt)
        VALUES (${mentorUserId}, 'Lê Cung Tưởng', 'Tech Company', '0909999999', NOW(), NOW())
      `);
      // Get the created mentor ID
      const [newMentor] = await db.query(`SELECT id FROM mentors WHERE userId = ${mentorUserId}`);
      mentorId = newMentor[0].id;
      console.log('✅ Created mentor record (ID:', mentorId, ')');
    } else {
      mentorId = existingMentors[0].id;
      console.log('📌 Mentor record already exists (ID:', mentorId, ')');
    }

    // Assign mentor to all students
    const [students] = await db.query(`SELECT id FROM students`);
    for (const student of students) {
      await db.query(`
        UPDATE students SET mentorId = ${mentorId} WHERE id = ${student.id}
      `);
    }
    console.log('✅ Assigned mentor to', students.length, 'students');

    // Verify
    const [verify] = await db.query(`
      SELECT m.id, m.fullName, COUNT(s.id) as studentCount 
      FROM mentors m
      LEFT JOIN students s ON s.mentorId = m.id
      GROUP BY m.id
    `);
    console.log('📌 Mentor status:', JSON.stringify(verify[0], null, 2));

  } catch(e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}
setup();

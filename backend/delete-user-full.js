require('dotenv').config();
const sequelize = require('./src/config/database');
const User = require('./src/models/user');
const Student = require('./src/models/student');
const Internship = require('./src/models/internship');
const Report = require('./src/models/report');
const WeeklyReport = require('./src/models/weeklyReport');
const Task = require('./src/models/task');

const deleteUserAndAllData = async () => {
    const transaction = await sequelize.transaction();
    try {
        const email = 'huutri2307@gmail.com'; // ← Email của bạn
        
        console.log(`🔍 Đang tìm user: ${email}...`);
        const user = await User.findOne({ where: { email } }, { transaction });
        
        if (!user) {
            console.log(`❌ Không tìm thấy user với email: ${email}`);
            await transaction.rollback();
            process.exit(0);
        }
        
        console.log(`✅ Tìm thấy user: ID=${user.id}, Email=${user.email}`);
        
        // Tìm tất cả student records của user này
        const students = await Student.findAll(
            { where: { userId: user.id } },
            { transaction }
        );
        
        console.log(`📋 Tìm thấy ${students.length} student record(s)`);
        
        const studentIds = students.map(s => s.id);
        
        if (studentIds.length > 0) {
            // Xóa tasks
            console.log(`🗑️  Xóa tasks...`);
            await Task.destroy({ where: { studentId: studentIds }, transaction });
            
            // Xóa reports
            console.log(`🗑️  Xóa reports...`);
            await Report.destroy({ where: { studentId: studentIds }, transaction });
            
            // Xóa internships (cascade)
            console.log(`🗑️  Xóa internships...`);
            const internships = await Internship.findAll(
                { where: { studentId: studentIds } },
                { transaction }
            );
            await Internship.destroy({ where: { studentId: studentIds }, transaction });
            
            // Xóa student records
            console.log(`🗑️  Xóa student records...`);
            await Student.destroy({ where: { userId: user.id } }, { transaction });
        }
        
        // Xóa user
        console.log(`🗑️  Xóa user account...`);
        await user.destroy({ transaction });
        
        await transaction.commit();
        console.log(`\n✅ XÓA THÀNH CÔNG!\n`);
        console.log(`🔑 Bây giờ bạn có thể:`);
        console.log(`   1. Đăng ký lại với email: ${email}`);
        console.log(`   2. Dữ liệu sẽ hoàn toàn mới`);
        console.log(`\n💡 Nhớ clear cache browser (F12 → Application → Clear storage)`);
        
        process.exit(0);
    } catch (error) {
        await transaction.rollback();
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

deleteUserAndAllData();

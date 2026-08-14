require('dotenv').config();
const sequelize = require('./src/config/database');
const User = require('./src/models/user');
const Student = require('./src/models/student');

const resetAdminUser = async () => {
    try {
        const email = 'admin@example.com'; // Thay bằng email bạn muốn reset
        
        console.log(`🔍 Tìm user: ${email}...`);
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            console.log(`❌ Không tìm thấy user với email: ${email}`);
            process.exit(0);
        }
        
        console.log(`✅ Tìm thấy user: ID=${user.id}, Email=${user.email}`);
        
        // Xóa student profile nếu có
        console.log(`🗑️  Xóa student profile...`);
        await Student.destroy({ where: { userId: user.id } });
        
        // Xóa user
        console.log(`🗑️  Xóa user...`);
        await user.destroy();
        
        console.log(`✅ Xóa thành công! Bạn có thể đăng ký lại với email này.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

resetAdminUser();

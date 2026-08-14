require('dotenv').config();
const sequelize = require('./src/config/database');
const { execSync } = require('child_process');

const resetDatabase = async () => {
    try {
        console.log('⚠️  Cảnh báo: Thao tác này sẽ XÓA TẤT CẢ DỮ LIỆU trong database!');
        console.log('   (kỳ thực tập, sinh viên, báo cáo, chuyên ngành, v.v.)\n');
        
        // Drop all tables
        console.log('🗑️  Đang xóa tất cả bảng...');
        await sequelize.truncate({ cascade: true, force: true });
        
        console.log('✅ Xóa thành công!\n');
        console.log('📝 Bây giờ hãy:');
        console.log('   1. Restart backend: npm start');
        console.log('   2. Backend sẽ tự tạo lại schema mới');
        console.log('   3. Dữ liệu hoàn toàn trắng');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

resetDatabase();

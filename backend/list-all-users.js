require('dotenv').config();
const User = require('./src/models/user');

const listUsers = async () => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'email', 'role', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        
        if (users.length === 0) {
            console.log('❌ Không có user nào trong database');
            process.exit(0);
        }
        
        console.log(`\n📋 Tất cả users (${users.length}):\n`);
        users.forEach((user, index) => {
            console.log(`${index + 1}. Email: ${user.email}`);
            console.log(`   ID: ${user.id}, Role: ${user.role}`);
            console.log(`   Tạo lúc: ${user.createdAt}\n`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

listUsers();

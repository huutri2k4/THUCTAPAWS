const { Sequelize } = require('sequelize');
require('dotenv').config();

const useSsl = String(process.env.DB_SSL || 'true').toLowerCase() === 'true';
const dbPort = Number(process.env.DB_PORT || 3306);

// Khởi tạo kết nối Sequelize
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || 'localhost',
        port: dbPort,
        dialect: 'mysql',
        logging: false, // Tắt log câu lệnh SQL trên terminal cho đỡ rối
        dialectOptions: useSsl ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        } : undefined
    }
);

// Test kết nối
sequelize.authenticate()
    .then(() => console.log('✅ Đã kết nối thành công tới MySQL (Sequelize)!'))
    .catch(err => console.error('❌ Lỗi kết nối Database:', err));

module.exports = sequelize;
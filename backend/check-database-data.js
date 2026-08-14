require('dotenv').config();
const InternshipPeriod = require('./src/models/internshipPeriod');
const Major = require('./src/models/major');
const Report = require('./src/models/report');

const checkData = async () => {
    try {
        const periods = await InternshipPeriod.findAll();
        const majors = await Major.findAll();
        const reports = await Report.findAll();
        
        console.log('\n📊 DỮ LIỆU TRONG DATABASE:\n');
        console.log(`📅 Kỳ thực tập: ${periods.length}`);
        if (periods.length > 0) {
            periods.forEach(p => console.log(`   - ${p.name}`));
        }
        
        console.log(`\n📚 Chuyên ngành: ${majors.length}`);
        if (majors.length > 0) {
            majors.forEach(m => console.log(`   - ${m.name}`));
        }
        
        console.log(`\n📄 Báo cáo: ${reports.length}`);
        if (reports.length > 0) {
            console.log(`   Có ${reports.length} báo cáo`);
        }
        
        console.log('\n' + '='.repeat(50));
        if (periods.length > 0 || majors.length > 0 || reports.length > 0) {
            console.log('⚠️  CÒN DỮ LIỆU CŨ TRONG DATABASE');
            console.log('👉 Hãy chạy: node reset-all-database.js');
        } else {
            console.log('✅ DATABASE SẠCH');
            console.log('👉 Vấn đề từ FRONTEND CACHE');
            console.log('   Clear: F12 → Application → Clear all');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

checkData();

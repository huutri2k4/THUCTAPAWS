const Schedule = require('../models/schedule');
const { Op } = require('sequelize');

const validateSchedule = (data, partial = false) => {
    const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date());
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    const validTypes = ['WORK', 'MEETING', 'CHECKIN', 'CHECKOUT', 'DEADLINE', 'OTHER'];

    if (data.startDate && data.startDate < today) throw new Error('Ngày bắt đầu không được nhỏ hơn hôm nay');
    if (data.endDate && data.endDate < today) throw new Error('Ngày kết thúc không được nhỏ hơn hôm nay');
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
        throw new Error('Ngày kết thúc phải từ ngày bắt đầu trở đi');
    }
    if (!partial && (!data.type || !validTypes.includes(data.type))) {
        throw new Error('Loại lịch không hợp lệ');
    }
    if (data.type != null && data.type !== '' && !validTypes.includes(data.type)) {
        throw new Error('Loại lịch không hợp lệ');
    }
    if (data.startTime && !timePattern.test(String(data.startTime).slice(0, 5))) {
        throw new Error('Giờ bắt đầu không hợp lệ');
    }
    if (data.endTime && !timePattern.test(String(data.endTime).slice(0, 5))) {
        throw new Error('Giờ kết thúc không hợp lệ');
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
        throw new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc');
    }
    if (!partial && (!data.startTime || !data.endTime)) {
        throw new Error('Vui lòng nhập giờ bắt đầu và giờ kết thúc');
    }
};

const createSchedule = async (data) => {
    if (!data.title || !data.startDate || !data.endDate) {
        throw new Error('Thiếu thông tin lịch làm việc');
    }

    if (data.audience === 'SPECIFIC_PERIOD' && !data.periodId) {
        throw new Error('Vui lòng chọn kỳ thực tập cho lịch theo kỳ.');
    }
    validateSchedule(data);

    return Schedule.create(data);
};

const getSchedules = async (filters = {}) => {
    const where = {};

    console.log('🔍 getSchedules called with filters:', filters);

    // Nếu có periodId, filter theo period hoặc show ALL_STUDENTS
    if (filters.periodId) {
        where[Op.or] = [
            { periodId: filters.periodId },
            { audience: 'ALL_STUDENTS' }
        ];
    } else {
        // Không có periodId, chỉ show ALL_STUDENTS
        where.audience = 'ALL_STUDENTS';
    }

    console.log('📋 Query where:', JSON.stringify(where));

    const result = await Schedule.findAll({
        where,
        order: [['startDate', 'ASC'], ['startTime', 'ASC']]
    });

    console.log('✅ Found schedules:', result.map(s => ({ id: s.id, title: s.title, startDate: s.startDate, endDate: s.endDate, audience: s.audience })));

    return result;
};

const getScheduleById = async (id) => {
    const schedule = await Schedule.findByPk(id);
    if (!schedule) {
        throw new Error('Không tìm thấy lịch này');
    }
    return schedule;
};

const updateSchedule = async (id, data) => {
    const schedule = await getScheduleById(id);
    validateSchedule({
        startDate: data.startDate ?? schedule.startDate,
        endDate: data.endDate ?? schedule.endDate,
        startTime: data.startTime ?? schedule.startTime,
        endTime: data.endTime ?? schedule.endTime
    }, true);
    return schedule.update(data);
};

const deleteSchedule = async (id) => {
    const schedule = await getScheduleById(id);
    await schedule.destroy();
    return true;
};

module.exports = { createSchedule, getSchedules, getScheduleById, updateSchedule, deleteSchedule };
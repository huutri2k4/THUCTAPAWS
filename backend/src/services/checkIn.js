const CheckIn = require('../models/checkIn');
const Internship = require('../models/internship');
const Student = require('../models/student');
const Position = require('../models/position');
const Mentor = require('../models/mentor');
const Schedule = require('../models/schedule');
const { Op } = require('sequelize');

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const parseTimeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = String(value).split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const formatMinutesToTime = (minutes) => {
    if (minutes == null || Number.isNaN(minutes)) return '00:00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
};

const getEffectiveCheckInWindow = async ({ student, currentDate = null, currentMinutes = null } = {}) => {
    const now = getVietnamNow();
    const date = currentDate || now.date;
    const minutes = currentMinutes ?? now.minutes;

    const scheduledItems = await Schedule.findAll({
        where: {
            startDate: { [Op.lte]: date },
            endDate: { [Op.gte]: date }
        },
        order: [['startTime', 'ASC']]
    });

    const todaySchedules = (scheduledItems || []).filter((item) => item && item.type !== 'CHECKOUT');

    console.log('[getEffectiveCheckInWindow] Searching for schedules:', {
        date,
        minutes,
        studentPeriodId: student?.periodId,
        foundSchedules: todaySchedules.map(s => ({
            id: s.id,
            title: s.title,
            startDate: s.startDate,
            endDate: s.endDate,
            startTime: s.startTime,
            endTime: s.endTime,
            type: s.type,
            audience: s.audience,
            periodId: s.periodId
        }))
    });

    // Find schedule that matches student's period (if applicable)
    // First, try to find current/matching schedule where current time falls within it
    const matchingSchedule = todaySchedules.find((item) => {
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && item.periodId && Number(item.periodId) !== Number(student.periodId)) {
            return false;
        }
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && (!item.periodId || Number(item.periodId) !== Number(student.periodId))) {
            return false;
        }
        const startMinutes = parseTimeToMinutes(item.startTime);
        const endMinutes = parseTimeToMinutes(item.endTime);
        console.log('[matchingSchedule check]', {
            title: item.title,
            startTime: item.startTime,
            endTime: item.endTime,
            startMinutes,
            endMinutes,
            currentMinutes: minutes,
            matches: startMinutes != null && endMinutes != null && minutes >= startMinutes && minutes <= endMinutes
        });
        return startMinutes != null && endMinutes != null && minutes >= startMinutes && minutes <= endMinutes;
    });

    if (matchingSchedule) {
        const result = {
            startMinutes: parseTimeToMinutes(matchingSchedule.startTime),
            endMinutes: parseTimeToMinutes(matchingSchedule.endTime),
            source: 'schedule'
        };
        console.log('[getEffectiveCheckInWindow] Using current matching schedule:', result);
        return result;
    }

    // If no schedule found where current time falls within, find the first applicable schedule
    const firstApplicableSchedule = todaySchedules.find((item) => {
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && item.periodId && Number(item.periodId) !== Number(student.periodId)) {
            return false;
        }
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && (!item.periodId || Number(item.periodId) !== Number(student.periodId))) {
            return false;
        }
        const startMinutes = parseTimeToMinutes(item.startTime);
        const endMinutes = parseTimeToMinutes(item.endTime);
        return startMinutes != null && endMinutes != null;
    });

    if (firstApplicableSchedule) {
        const result = {
            startMinutes: parseTimeToMinutes(firstApplicableSchedule.startTime),
            endMinutes: parseTimeToMinutes(firstApplicableSchedule.endTime),
            source: 'schedule'
        };
        console.log('[getEffectiveCheckInWindow] Using first applicable schedule:', result);
        return result;
    }

    console.log('[getEffectiveCheckInWindow] No schedule found for today');
    return null;
};

const getEffectiveCheckOutWindow = async ({ student, currentDate = null, currentMinutes = null } = {}) => {
    const now = getVietnamNow();
    const date = currentDate || now.date;
    const minutes = currentMinutes ?? now.minutes;

    const todaySchedules = await Schedule.findAll({
        where: {
            startDate: { [Op.lte]: date },
            endDate: { [Op.gte]: date },
            type: 'CHECKOUT'
        },
        order: [['startTime', 'ASC']]
    });

    const applicableSchedules = todaySchedules.filter((item) => {
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && item.periodId && Number(item.periodId) !== Number(student.periodId)) {
            return false;
        }
        if (item.audience === 'SPECIFIC_PERIOD' && student?.periodId && (!item.periodId || Number(item.periodId) !== Number(student.periodId))) {
            return false;
        }
        return true;
    });

    const matchingSchedule = applicableSchedules.find((item) => {
        const startMinutes = parseTimeToMinutes(item.startTime);
        const endMinutes = parseTimeToMinutes(item.endTime);
        return startMinutes != null && endMinutes != null && minutes >= startMinutes && minutes <= endMinutes;
    });

    if (matchingSchedule) {
        return {
            startMinutes: parseTimeToMinutes(matchingSchedule.startTime),
            endMinutes: parseTimeToMinutes(matchingSchedule.endTime),
            source: 'schedule'
        };
    }

    const firstApplicableSchedule = applicableSchedules[0];
    if (firstApplicableSchedule) {
        return {
            startMinutes: parseTimeToMinutes(firstApplicableSchedule.startTime),
            endMinutes: parseTimeToMinutes(firstApplicableSchedule.endTime),
            source: 'schedule'
        };
    }

    return null;
};

const getVietnamNow = () => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
            weekday: 'short'
        }).formatToParts(new Date())
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}:${parts.second}`,
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
        weekday: parts.weekday
    };
};

const ensureStudentInternship = async (student, periodId = null) => {
    const targetPeriodId = periodId || student.periodId;
    if (!targetPeriodId) {
        throw new Error('Sinh viên chưa được gán kỳ thực tập. Vui lòng liên hệ quản trị để cập nhật kỳ thực tập trước khi check-in.');
    }

    let internship = await Internship.findOne({
        where: {
            studentId: student.id,
            periodId: targetPeriodId
        },
        order: [['createdAt', 'DESC']]
    });

    if (internship) return internship;

    let position = await Position.findOne({ where: { name: 'Chưa phân công' } });
    if (!position) {
        position = await Position.create({ name: 'Chưa phân công', description: 'Vị trí mặc định cho sinh viên chưa phân công' });
    }

    if (!student.mentorId) {
        throw new Error('Sinh viên chưa được phân công mentor. Vui lòng liên hệ quản trị.');
    }
    const mentor = await Mentor.findByPk(student.mentorId);
    if (!mentor || Number(mentor.userId) === Number(student.userId)) {
        throw new Error('Mentor được phân công không hợp lệ.');
    }

    return Internship.create({
        studentId: student.id,
        periodId: targetPeriodId,
        positionId: position.id,
        mentorId: mentor.id,
        status: 'IN_PROGRESS'
    });
};

const resolveInternship = async (userId, internshipId = null) => {
    const student = await Student.findOne({ where: { userId } });
    if (!student) throw new Error('Không tìm thấy hồ sơ sinh viên.');
    if (!student.periodId) throw new Error('Sinh viên chưa được gán kỳ thực tập.');

    let internship = internshipId ? await Internship.findByPk(internshipId) : null;
    if (internship && Number(internship.studentId) !== Number(student.id)) {
        throw new Error('Bạn không có quyền điểm danh cho kỳ thực tập này.');
    }
    if (!internship) {
        internship = await Internship.findOne({
            where: {
                studentId: student.id,
                status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] }
            },
            order: [['updatedAt', 'DESC']]
        });
    }
    if (!internship) internship = await ensureStudentInternship(student, student.periodId);
    return internship;
};

const createCheckIn = async ({ userId, internshipId, note }) => {
    const now = getVietnamNow();
    const student = await Student.findOne({ where: { userId } });
    const window = await getEffectiveCheckInWindow({ student, currentDate: now.date, currentMinutes: now.minutes });

    console.log('[CHECK-IN]', {
        userId,
        date: now.date,
        time: now.time,
        minutes: now.minutes,
        window,
        studentPeriodId: student?.periodId
    });

    if (!window) {
        throw new Error('Chưa có lịch check-in do admin tạo cho hôm nay.');
    }
    if (now.minutes < window.startMinutes) {
        throw new Error(`Check-in chỉ mở từ ${String(Math.floor(window.startMinutes / 60)).padStart(2, '0')}:${String(window.startMinutes % 60).padStart(2, '0')}.`);
    }
    if (now.minutes > window.endMinutes) {
        throw new Error(`Đã quá ${String(Math.floor(window.endMinutes / 60)).padStart(2, '0')}:${String(window.endMinutes % 60).padStart(2, '0')}. Hôm nay bạn được ghi nhận vắng mặt.`);
    }

    const internship = await resolveInternship(userId, internshipId);
    const existing = await CheckIn.findOne({ where: { internshipId: internship.id, date: now.date } });
    if (existing) {
        throw new Error('Bạn đã check-in cho ngày hôm nay rồi');
    }
    const onTimeEnd = window.startMinutes + 30; // on-time is 30 mins after window start
    return CheckIn.create({
        date: now.date,
        time: now.time,
        status: now.minutes <= onTimeEnd ? 'PRESENT' : 'LATE',
        internshipId: internship.id,
        note
    });
};

const recordCheckOut = async ({ userId, internshipId }) => {
    const now = getVietnamNow();
    const student = await Student.findOne({ where: { userId } });
    const internship = await resolveInternship(userId, internshipId);
    const checkIn = await CheckIn.findOne({
        where: { internshipId: internship.id, date: now.date }
    });
    if (!checkIn) {
        throw new Error('Bạn chưa check-in hôm nay.');
    }
    if (checkIn.checkOutTime) {
        throw new Error('Bạn đã check-out hôm nay.');
    }
    const checkoutWindow = await getEffectiveCheckOutWindow({ student, currentDate: now.date, currentMinutes: now.minutes });
    if (!checkoutWindow) {
        throw new Error('Chưa có lịch checkout hôm nay.');
    }
    if (now.minutes < checkoutWindow.startMinutes) {
        throw new Error(`Checkout chỉ mở từ ${String(Math.floor(checkoutWindow.startMinutes / 60)).padStart(2, '0')}:${String(checkoutWindow.startMinutes % 60).padStart(2, '0')}.`);
    }
    if (now.minutes > checkoutWindow.endMinutes) {
        throw new Error(`Đã quá ${String(Math.floor(checkoutWindow.endMinutes / 60)).padStart(2, '0')}:${String(checkoutWindow.endMinutes % 60).padStart(2, '0')}.`);
    }
    checkIn.checkOutTime = now.time;
    return await checkIn.save();
};

const getCheckInsByUser = async (userId) => {
    const student = await Student.findOne({ where: { userId } });
    if (!student) {
        return [];
    }

    const internships = await Internship.findAll({ where: { studentId: student.id }, attributes: ['id'] });
    const internshipIds = internships.map((internship) => internship.id);
    if (internshipIds.length === 0) {
        return [];
    }
    const currentInternship = await Internship.findOne({
        where: {
            studentId: student.id,
            status: { [Op.in]: ['PENDING', 'IN_PROGRESS'] }
        },
        order: [['updatedAt', 'DESC']],
        attributes: ['id']
    });

    const now = getVietnamNow();
    const todayRecord = await CheckIn.findOne({
        where: { internshipId: { [Op.in]: internshipIds }, date: now.date }
    });

    return CheckIn.findAll({
        where: { internshipId: internshipIds },
        include: [{ model: Internship, include: [{ model: Student }] }],
        order: [['createdAt', 'DESC']],
    });
};

const getAdminSummary = async (periodId = null) => {
    const studentWhere = periodId ? { periodId: Number(periodId) } : {};
    const students = await Student.findAll({
        where: studentWhere,
        order: [['fullName', 'ASC']]
    });

    return Promise.all(students.map(async (student) => {
        const internshipWhere = { studentId: student.id };
        if (periodId) internshipWhere.periodId = Number(periodId);
        const internships = await Internship.findAll({
            where: internshipWhere,
            attributes: ['id']
        });
        const internshipIds = internships.map((item) => item.id);
        const records = internshipIds.length
            ? await CheckIn.findAll({
                where: { internshipId: { [Op.in]: internshipIds } },
                attributes: ['status']
            })
            : [];
        return {
            studentId: student.id,
            studentCode: student.studentCode,
            fullName: student.fullName,
            className: student.className,
            majorName: student.majorName,
            onTime: records.filter((item) => item.status === 'PRESENT').length,
            late: records.filter((item) => item.status === 'LATE').length,
            absent: records.filter((item) => item.status === 'ABSENT').length,
            total: records.length
        };
    }));
};

const getAdminDetail = async ({ studentId, status, periodId }) => {
    const student = await Student.findByPk(studentId);
    if (!student) throw new Error('Không tìm thấy sinh viên');
    const internshipWhere = { studentId: student.id };
    if (periodId) internshipWhere.periodId = Number(periodId);
    const internships = await Internship.findAll({
        where: internshipWhere,
        attributes: ['id']
    });
    const internshipIds = internships.map((item) => item.id);
    if (!internshipIds.length) return { student, records: [] };
    const where = { internshipId: { [Op.in]: internshipIds } };
    if (status && ['PRESENT', 'LATE', 'ABSENT'].includes(status)) where.status = status;
    const records = await CheckIn.findAll({
        where,
        order: [['date', 'DESC'], ['time', 'DESC']]
    });
    return { student, records };
};

module.exports = {
    createCheckIn,
    recordCheckOut,
    getCheckInsByUser,
    getAdminSummary,
    getAdminDetail,
    getEffectiveCheckInWindow
};
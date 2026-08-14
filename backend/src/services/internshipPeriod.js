const { Op } = require('sequelize');
const InternshipPeriod = require('../models/internshipPeriod');
const Internship = require('../models/internship');
const Student = require('../models/student');
const Mentor = require('../models/mentor');
const Report = require('../models/report');
const WeeklyReport = require('../models/weeklyReport');
const PeriodDocument = require('../models/periodDocument');

const parseDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAcademicYear = (startDate, endDate) => {
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    return `${startYear}-${endYear}`;
};

const getCurrentStatus = (period, today = new Date()) => {
    const startDate = parseDate(period.startDate);
    const endDate = parseDate(period.endDate);
    if (!startDate || !endDate) return 'UPCOMING';
    if (today < startDate) return 'UPCOMING';
    if (today > endDate) return 'COMPLETED';
    return 'ONGOING';
};

const getProgress = (period, today = new Date()) => {
    const startDate = parseDate(period.startDate);
    const endDate = parseDate(period.endDate);
    if (!startDate || !endDate) {
        return {
            totalDays: 0,
            passedDays: 0,
            remainingDays: 0,
            percentComplete: 0
        };
    }

    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    const rawPassedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const passedDays = Math.min(Math.max(rawPassedDays, 0), totalDays);
    const remainingDays = Math.max(totalDays - passedDays, 0);
    const percentComplete = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)));

    return { totalDays, passedDays, remainingDays, percentComplete };
};

const decoratePeriod = (period) => {
    const plain = period.get({ plain: true });
    const status = getCurrentStatus(plain);
    const progress = getProgress(plain);

    return {
        ...plain,
        academicYear: plain.academicYear || formatAcademicYear(plain.startDate, plain.endDate),
        computedStatus: status,
        statusLabel: status === 'UPCOMING' ? 'Sắp diễn ra' : status === 'ONGOING' ? 'Đang diễn ra' : 'Đã kết thúc',
        progress,
        description: plain.description || ''
    };
};

const buildTimeline = (period) => {
    const startDate = parseDate(period.startDate);
    const endDate = parseDate(period.endDate);
    if (!startDate || !endDate) return [];

    const totalDays = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    const offset = (days) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
    };

    return [
        { title: 'Bắt đầu kỳ', date: period.startDate, note: 'Khởi động và phổ biến kế hoạch thực tập.' },
        { title: 'Đăng ký doanh nghiệp', date: offset(Math.min(3, totalDays - 1)), note: 'Sinh viên hoàn tất lựa chọn doanh nghiệp.' },
        { title: 'Phân công mentor', date: offset(Math.min(5, totalDays - 1)), note: 'Chốt người hướng dẫn và nhóm theo dõi.' },
        { title: 'Báo cáo tuần', date: offset(Math.min(Math.floor(totalDays / 3), totalDays - 1)), note: 'Sinh viên nộp báo cáo tiến độ định kỳ.' },
        { title: 'Báo cáo giữa kỳ', date: offset(Math.min(Math.floor(totalDays / 2), totalDays - 1)), note: 'Đánh giá giữa kỳ với mentor/doanh nghiệp.' },
        { title: 'Báo cáo cuối kỳ', date: offset(Math.max(totalDays - 7, 0)), note: 'Hoàn thiện tổng hợp kết quả thực tập.' },
        { title: 'Bảo vệ', date: offset(Math.max(totalDays - 3, 0)), note: 'Trình bày và phản biện kết quả.' },
        { title: 'Kết thúc kỳ', date: period.endDate, note: 'Đóng kỳ và tổng kết.' }
    ];
};

const getPeriodDocuments = async (periodId) => {
    return PeriodDocument.findAll({
        where: { periodId },
        order: [['createdAt', 'DESC']]
    });
};

const getPeriodStudents = async (periodId) => {
    const internships = await Internship.findAll({
        where: { periodId },
        include: [
            { model: Student, attributes: ['id', 'studentCode', 'fullName', 'className', 'majorName', 'enterpriseName', 'mentorName', 'phoneNumber', 'address'] },
            { model: Mentor, attributes: ['id', 'fullName', 'companyName', 'phone'] }
        ],
        order: [[{ model: Student, as: 'Student' }, 'fullName', 'ASC']]
    });

    return internships.map((internship) => {
        const student = internship.Student?.get ? internship.Student.get({ plain: true }) : internship.Student;
        const mentor = internship.Mentor?.get ? internship.Mentor.get({ plain: true }) : internship.Mentor;
        return {
            internshipId: internship.id,
            studentId: student?.id || null,
            studentCode: student?.studentCode || '',
            fullName: student?.fullName || '',
            className: student?.className || '',
            enterpriseName: student?.enterpriseName || mentor?.companyName || '',
            mentorName: mentor?.fullName || student?.mentorName || '',
            internshipStatus: internship.status,
            phoneNumber: student?.phoneNumber || '',
            address: student?.address || ''
        };
    });
};

const getPeriodStats = async (periodId) => {
    const internships = await Internship.findAll({
        where: { periodId },
        include: [
            { model: Student, attributes: ['id', 'enterpriseName'] },
            { model: Mentor, attributes: ['id', 'companyName'] }
        ]
    });
    const weeklyReports = await WeeklyReport.findAll({ where: { periodId } });
    const internshipIds = internships.map((item) => item.id);

    const reportsSubmitted = internshipIds.length
        ? await Report.count({ where: { internshipId: { [Op.in]: internshipIds } } })
        : 0;

    const enterpriseNames = new Set();
    const mentorIds = new Set();
    internships.forEach((internship) => {
        const student = internship.Student?.get ? internship.Student.get({ plain: true }) : internship.Student;
        const mentor = internship.Mentor?.get ? internship.Mentor.get({ plain: true }) : internship.Mentor;
        if (student?.enterpriseName) enterpriseNames.add(student.enterpriseName);
        if (mentor?.companyName) enterpriseNames.add(mentor.companyName);
        if (mentor?.id) mentorIds.add(mentor.id);
    });

    const totalStudents = internships.length;
    const ongoingStudents = internships.filter((item) => item.status === 'IN_PROGRESS').length;
    const completedStudents = internships.filter((item) => item.status === 'COMPLETED').length;
    const expectedReports = weeklyReports.length * Math.max(totalStudents, 1);
    const missingReports = Math.max(expectedReports - reportsSubmitted, 0);

    return {
        totalStudents,
        ongoingStudents,
        completedStudents,
        enterpriseCount: enterpriseNames.size,
        mentorCount: mentorIds.size,
        reportsSubmitted,
        reportsMissing: missingReports,
        weeklyReportCount: weeklyReports.length
    };
};

const buildNotifications = (period, stats, weeklyReports) => {
    const notifications = [];
    const now = new Date();
    const startDate = parseDate(period.startDate);
    const endDate = parseDate(period.endDate);

    if (startDate && now < startDate) {
        const days = Math.max(0, Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)));
        notifications.push(`Còn ${days} ngày nữa kỳ thực tập bắt đầu.`);
    } else if (endDate && now <= endDate) {
        const days = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        notifications.push(`Còn ${days} ngày nữa kỳ thực tập kết thúc.`);
    } else {
        notifications.push('Kỳ thực tập đã kết thúc.');
    }

    const upcomingReport = weeklyReports
        .filter((item) => item.dueDate)
        .map((item) => ({ ...item.get({ plain: true }), dueDateValue: parseDate(item.dueDate) }))
        .filter((item) => item.dueDateValue && item.dueDateValue >= now)
        .sort((a, b) => a.dueDateValue - b.dueDateValue)[0];

    if (upcomingReport) {
        const days = Math.max(0, Math.ceil((upcomingReport.dueDateValue - now) / (1000 * 60 * 60 * 24)));
        notifications.push(`Sắp đến hạn nộp ${upcomingReport.title} trong ${days} ngày.`);
    }

    if (stats.reportsMissing > 0) {
        notifications.push(`Còn ${stats.reportsMissing} báo cáo chưa nộp trong kỳ này.`);
    }

    return notifications;
};

const createPeriod = async (data) => {
    const startDate = data.startDate;
    const endDate = data.endDate;
    
    // Validation
    if (!data.name || !data.name.trim()) throw new Error('Tên kỳ là bắt buộc');
    if (!startDate) throw new Error('Ngày bắt đầu là bắt buộc');
    if (!endDate) throw new Error('Ngày kết thúc là bắt buộc');
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime())) throw new Error('Ngày bắt đầu không hợp lệ');
    if (isNaN(end.getTime())) throw new Error('Ngày kết thúc không hợp lệ');
    if (end <= start) throw new Error('Ngày kết thúc phải sau ngày bắt đầu');

    // Auto-generate academicYear if not provided
    const academicYear = data.academicYear && data.academicYear.trim() 
        ? data.academicYear.trim() 
        : formatAcademicYear(startDate, endDate);

    return await InternshipPeriod.create({
        name: data.name.trim(),
        academicYear: academicYear,
        startDate,
        endDate,
        description: (data.description || '').trim()
    });
};

const getAllPeriods = async (query = {}) => {
    const periods = await InternshipPeriod.findAll({ order: [['startDate', 'ASC']] });
    const mapped = periods.map(decoratePeriod);

    const search = String(query.search || '').trim().toLowerCase();
    const statusFilter = String(query.status || '').trim().toUpperCase();
    const sortBy = ['startDate', 'endDate', 'name', 'academicYear'].includes(query.sortBy) ? query.sortBy : 'startDate';
    const sortOrder = String(query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(query.limit || 10)));

    let filtered = mapped;
    if (search) {
        filtered = filtered.filter((period) => {
            const haystack = `${period.name || ''} ${period.academicYear || ''} ${period.description || ''}`.toLowerCase();
            return haystack.includes(search);
        });
    }

    if (statusFilter && ['UPCOMING', 'ONGOING', 'COMPLETED'].includes(statusFilter)) {
        filtered = filtered.filter((period) => period.computedStatus === statusFilter);
    }

    filtered.sort((a, b) => {
        const aValue = sortBy === 'name' || sortBy === 'academicYear'
            ? String(a[sortBy] || '').toLowerCase()
            : new Date(a[sortBy] || 0).getTime();
        const bValue = sortBy === 'name' || sortBy === 'academicYear'
            ? String(b[sortBy] || '').toLowerCase()
            : new Date(b[sortBy] || 0).getTime();
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    if (!Object.keys(query).length) {
        return mapped;
    }

    return {
        items,
        pagination: {
            totalItems,
            totalPages,
            currentPage,
            limit
        }
    };
};

const getPeriodById = async (id) => {
    const period = await InternshipPeriod.findByPk(id);
    if (!period) throw new Error('Không tìm thấy đợt thực tập này!');

    const decorated = decoratePeriod(period);
    const [stats, students, documents, weeklyReports] = await Promise.all([
        getPeriodStats(period.id),
        getPeriodStudents(period.id),
        getPeriodDocuments(period.id),
        WeeklyReport.findAll({ where: { periodId: period.id }, order: [['weekNumber', 'ASC']] })
    ]);

    const notifications = buildNotifications(decorated, stats, weeklyReports);

    return {
        ...decorated,
        stats,
        students,
        documents: documents.map((document) => document.get({ plain: true })),
        timeline: buildTimeline(decorated),
        notifications,
        weeklyReports: weeklyReports.map((item) => item.get({ plain: true }))
    };
};

const updatePeriod = async (id, data) => {
    const period = await InternshipPeriod.findByPk(id);
    if (!period) throw new Error('Không tìm thấy đợt thực tập này!');

    const currentStatus = getCurrentStatus(period.get({ plain: true }));
    if (currentStatus === 'COMPLETED' && process.env.ALLOW_EDIT_ENDED_PERIODS !== 'true') {
        throw new Error('Không thể sửa kỳ thực tập đã kết thúc');
    }

    const startDate = data.startDate || period.startDate;
    const endDate = data.endDate || period.endDate;
    if (new Date(endDate) < new Date(startDate)) throw new Error('Ngày kết thúc phải sau ngày bắt đầu');

    return await period.update({
        name: data.name ?? period.name,
        academicYear: data.academicYear ?? period.academicYear ?? formatAcademicYear(startDate, endDate),
        startDate,
        endDate,
        description: data.description ?? period.description
    });
};

const deletePeriod = async (id) => {
    const period = await InternshipPeriod.findByPk(id);
    if (!period) throw new Error('Không tìm thấy đợt thực tập này!');

    const studentCount = await Internship.count({ where: { periodId: id } });
    if (studentCount > 0) {
        throw new Error('Không thể xóa kỳ đã có sinh viên tham gia');
    }

    await PeriodDocument.destroy({ where: { periodId: id } });
    await WeeklyReport.destroy({ where: { periodId: id } });
    await period.destroy();
    return true;
};

const createPeriodDocument = async (periodId, data, file, userId) => {
    const period = await InternshipPeriod.findByPk(periodId);
    if (!period) throw new Error('Không tìm thấy đợt thực tập này!');
    if (!file) throw new Error('Vui lòng chọn tệp tài liệu');
    if (!data.title) throw new Error('Tiêu đề tài liệu là bắt buộc');

    return PeriodDocument.create({
        periodId,
        uploadedBy: userId,
        title: data.title,
        category: data.category || 'TÀI LIỆU',
        fileName: file.originalname,
        fileType: file.mimetype,
        fileUrl: `/uploads/period-documents/${file.filename}`
    });
};

module.exports = {
    createPeriod,
    getAllPeriods,
    getPeriodById,
    updatePeriod,
    deletePeriod,
    createPeriodDocument
};

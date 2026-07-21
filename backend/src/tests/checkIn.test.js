const test = require('node:test');
const assert = require('node:assert/strict');
const checkInService = require('../services/checkIn');
const Schedule = require('../models/schedule');
const Student = require('../models/student');
const Internship = require('../models/internship');
const CheckIn = require('../models/checkIn');

test('uses admin-created non-checkout schedule window when checking in', async () => {
  const originalFindAll = Schedule.findAll;
  Schedule.findAll = async () => [
    {
      type: 'WORK',
      startDate: '2026-07-20',
      endDate: '2026-07-20',
      startTime: '11:00',
      endTime: '15:00',
      audience: 'ALL_STUDENTS',
      periodId: null
    }
  ];

  try {
    const window = await checkInService.getEffectiveCheckInWindow({
      student: { periodId: 1 },
      currentDate: '2026-07-20',
      currentMinutes: 660
    });

    assert.equal(window.startMinutes, 660);
    assert.equal(window.endMinutes, 900);
    assert.equal(window.source, 'schedule');
  } finally {
    Schedule.findAll = originalFindAll;
  }
});

test('ignores checkout schedules for student check-in window', async () => {
  const originalFindAll = Schedule.findAll;
  Schedule.findAll = async () => [
    {
      type: 'CHECKOUT',
      startDate: '2026-07-20',
      endDate: '2026-07-20',
      startTime: '09:30',
      endTime: '10:30',
      audience: 'ALL_STUDENTS',
      periodId: null
    }
  ];

  try {
    const window = await checkInService.getEffectiveCheckInWindow({
      student: { periodId: 1 },
      currentDate: '2026-07-20',
      currentMinutes: 570
    });

    assert.equal(window, null);
  } finally {
    Schedule.findAll = originalFindAll;
  }
});

test('does not auto-create absent records when no admin check-in schedule exists', async () => {
  const originalScheduleFindAll = Schedule.findAll;
  const originalStudentFindOne = Student.findOne;
  const originalInternshipFindAll = Internship.findAll;
  const originalInternshipFindOne = Internship.findOne;
  const originalCheckInFindOne = CheckIn.findOne;
  const originalCheckInCreate = CheckIn.create;
  const originalCheckInFindAll = CheckIn.findAll;

  Schedule.findAll = async () => [];
  Student.findOne = async () => ({ id: 1, periodId: 1, userId: 1 });
  Internship.findAll = async () => [{ id: 42 }];
  Internship.findOne = async () => ({ id: 42 });
  CheckIn.findOne = async () => null;
  CheckIn.findAll = async () => [];

  let createdPayload = null;
  CheckIn.create = async (payload) => {
    createdPayload = payload;
    return payload;
  };

  try {
    await checkInService.getCheckInsByUser(1);
    assert.equal(createdPayload, null);
  } finally {
    Schedule.findAll = originalScheduleFindAll;
    Student.findOne = originalStudentFindOne;
    Internship.findAll = originalInternshipFindAll;
    Internship.findOne = originalInternshipFindOne;
    CheckIn.findOne = originalCheckInFindOne;
    CheckIn.create = originalCheckInCreate;
    CheckIn.findAll = originalCheckInFindAll;
  }
});

test('throws when there is no today schedule for check-in', async () => {
  const originalFindAll = Schedule.findAll;
  Schedule.findAll = async () => [];

  try {
    await assert.rejects(
      checkInService.createCheckIn({ userId: 1, internshipId: null, note: 'test' }),
      {
        message: 'Chưa có lịch check-in do admin tạo cho hôm nay.'
      }
    );
  } finally {
    Schedule.findAll = originalFindAll;
  }
});

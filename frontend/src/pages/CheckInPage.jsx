import '../App.css';
import { useEffect, useMemo, useState } from 'react';
import {
  submitCheckIn,
  submitCheckOut,
  getMyCheckIns,
  getCachedCheckIns,
  getAdminCheckInSummary,
  getAdminCheckInDetail,
} from '../services/checkInService';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule } from '../services/scheduleService';
import { getMeetings, createMeeting, updateMeeting, deleteMeeting } from '../services/meetingService';
import { getMyProfile, getStoredProfile } from '../services/studentService';
import { getAllPeriods } from '../services/periodService';

const initialAdminForm = {
  title: '',
  type: 'WORK',
  audience: 'ALL_STUDENTS',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  location: '',
  description: '',
  meetingDate: '',
  meetingTime: '',
  meetingEndTime: '',
  agenda: '',
  periodId: null,
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const pad = (value) => String(value).padStart(2, '0');

const toISODateLocal = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const parseISODateLocal = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatLongDate = (value) => {
  const date = typeof value === 'string' ? parseISODateLocal(value) : value;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const formatMonthLabel = (value) => {
  const date = parseISODateLocal(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date);
};

const formatDayShort = (value) => {
  const date = parseISODateLocal(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(date);
};

// Normalize a date string to local YYYY-MM-DD regardless of incoming format
const toLocalDateOnly = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatClock = (value) => {
  if (!value) return '--:--';
  const parts = String(value).split(':');
  if (parts.length < 2) return String(value);
  return `${pad(parts[0])}:${pad(parts[1])}`;
};

const formatMinutesToTimeString = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return '--:--';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const getCheckoutTooltip = (checkoutWindow) => {
  if (!checkoutWindow) return 'Chưa có lịch checkout';
  return `Checkout mở từ ${formatMinutesToTimeString(checkoutWindow.startMinutes)} đến ${formatMinutesToTimeString(checkoutWindow.endMinutes)}`;
};

const getCheckoutTimeRangeLabel = (checkoutWindow) => {
  if (!checkoutWindow) return 'chưa có lịch checkout';
  return `${formatClock(formatMinutesToTimeString(checkoutWindow.startMinutes))}–${formatClock(formatMinutesToTimeString(checkoutWindow.endMinutes))}`;
};

const parseTimeValue = (value) => {
  if (!value) return null;
  
  // Handle object (Buffer or object from database)
  if (typeof value === 'object') {
    if (value.toString && typeof value.toString === 'function') {
      try {
        value = value.toString();
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }

  const text = String(value).trim();

  // Standard 24h format: 15:50
  const colonMatch = /^([0-2]?\d)\s*:\s*([0-5]?\d)/.exec(text);
  if (colonMatch) {
    const hour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      console.log('[parseTimeValue] Parsed from colon format:', { text, hour, minute, result: hour * 60 + minute });
      return hour * 60 + minute;
    }
  }

  // Vietnamese format: 15 giờ 50 phút, 15 giờ, 15h50, 15h
  const vietnameseMatch = /^([0-2]?\d)\s*(?:giờ|h)(?:\s*([0-5]?\d)\s*(?:phút|p)?)?$/i.exec(text);
  if (vietnameseMatch) {
    const hour = Number(vietnameseMatch[1]);
    const minute = vietnameseMatch[2] ? Number(vietnameseMatch[2]) : 0;
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      console.log('[parseTimeValue] Parsed from vietnamese format:', { text, hour, minute, result: hour * 60 + minute });
      return hour * 60 + minute;
    }
  }

  // Fallback numeric formats like 1550 or 750
  const numericMatch = /^([0-2]?\d)([0-5]?\d)$/.exec(text);
  if (numericMatch) {
    const hour = Number(numericMatch[1]);
    const minute = Number(numericMatch[2]);
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      console.log('[parseTimeValue] Parsed from numeric format:', { text, hour, minute, result: hour * 60 + minute });
      return hour * 60 + minute;
    }
  }

  console.log('[parseTimeValue] Failed to parse:', { value, text });
  return null;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const getEffectiveCheckInWindow = (schedules, date, now = new Date()) => {
  // Get work schedules for the given date
  const dateStr = typeof date === 'string' ? date : toISODateLocal(date);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todaySchedules = schedules.filter((schedule) => {
    if (!schedule.startDate || !schedule.endDate) return false;
    const startDate = toLocalDateOnly(schedule.startDate);
    const endDate = toLocalDateOnly(schedule.endDate);
    return startDate && endDate && startDate <= dateStr && dateStr <= endDate && schedule.type !== 'CHECKOUT';
  });

  console.log('[getEffectiveCheckInWindow]', {
    dateStr,
    currentMinutes,
    totalSchedules: schedules.length,
    todaySchedules: todaySchedules.map(s => ({
      title: s.title,
      startDate: s.startDate,
      endDate: s.endDate,
      startTime: s.startTime,
      endTime: s.endTime,
      type: s.type
    }))
  });

  const matchingSchedule = todaySchedules.find((schedule) => {
    const startMinutes = parseTimeValue(schedule.startTime);
    const endMinutes = parseTimeValue(schedule.endTime);
    return startMinutes != null && endMinutes != null && currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });

  const fallbackSchedule = matchingSchedule || todaySchedules[0];
  if (fallbackSchedule) {
    const startMinutes = parseTimeValue(fallbackSchedule.startTime);
    const endMinutes = parseTimeValue(fallbackSchedule.endTime);
    console.log('[getEffectiveCheckInWindow] Found schedule:', {
      title: fallbackSchedule.title,
      startTime: fallbackSchedule.startTime,
      endTime: fallbackSchedule.endTime,
      startMinutes,
      endMinutes
    });
    if (startMinutes != null && endMinutes != null) {
      return { startMinutes, endMinutes, source: 'schedule' };
    }
  }

  return null;
};

const getEffectiveCheckOutWindow = (schedules, date, now = new Date()) => {
  const dateStr = typeof date === 'string' ? date : toISODateLocal(date);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayCheckoutSchedules = schedules.filter((schedule) => {
    if (!schedule.startDate || !schedule.endDate) return false;
    const startDate = toLocalDateOnly(schedule.startDate);
    const endDate = toLocalDateOnly(schedule.endDate);
    return (
      startDate &&
      endDate &&
      startDate <= dateStr &&
      dateStr <= endDate &&
      schedule.type === 'CHECKOUT'
    );
  });

  const matchingSchedule = todayCheckoutSchedules.find((schedule) => {
    const startMinutes = parseTimeValue(schedule.startTime);
    const endMinutes = parseTimeValue(schedule.endTime);
    return startMinutes != null && endMinutes != null && currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });

  const fallbackSchedule = matchingSchedule || todayCheckoutSchedules[0];
  if (fallbackSchedule) {
    const startMinutes = parseTimeValue(fallbackSchedule.startTime);
    const endMinutes = parseTimeValue(fallbackSchedule.endTime);
    if (startMinutes != null && endMinutes != null) {
      return { startMinutes, endMinutes, source: 'schedule' };
    }
  }

  return null;
};

const getExpectedCheckInStatus = (schedules, selectedDate, now = new Date()) => {
  const window = getEffectiveCheckInWindow(schedules, selectedDate, now);
  if (!window) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const onTimeEnd = window.startMinutes + 30; // on-time is 30 mins after window start
  return currentMinutes <= onTimeEnd ? 'PRESENT' : 'LATE';
};

const buildCalendarCells = (monthValue) => {
  const monthDate = parseISODateLocal(monthValue);
  if (!monthDate || Number.isNaN(monthDate.getTime())) return [];

  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - offset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    return toISODateLocal(new Date(year, monthIndex, dayNumber));
  });
};

function CheckInPage() {
  const today = toISODateLocal(new Date());
  const [monthCursor, setMonthCursor] = useState(`${today.slice(0, 7)}-01`);
  const [selectedDate, setSelectedDate] = useState(today);
  const [checkIns, setCheckIns] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [adminForm, setAdminForm] = useState(initialAdminForm);
  const [periods, setPeriods] = useState([]);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [checkInNote, setCheckInNote] = useState('');
  const [adminAttendance, setAdminAttendance] = useState([]);
  const [attendanceDetail, setAttendanceDetail] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (error) {
        setUser(null);
      }
    }
  }, []);

  const loadCheckIns = async () => {
    const cachedCheckIns = getCachedCheckIns();
    if (Array.isArray(cachedCheckIns) && cachedCheckIns.length > 0) {
      setCheckIns(cachedCheckIns);
    }

    setLoading(true);
    try {
      const [profileRes, periodsRes] = await Promise.allSettled([getMyProfile(), getAllPeriods()]);

      let periodId = getStoredProfile()?.periodId || null;
      let loadedPeriods = [];
      if (profileRes.status === 'fulfilled' && profileRes.value?.success) {
        const nextProfile = profileRes.value.data || null;
        setUser((current) => ({ ...(current || {}), ...nextProfile }));
        localStorage.setItem('user', JSON.stringify({ ...(JSON.parse(localStorage.getItem('user') || '{}')), ...nextProfile }));
        periodId = nextProfile?.periodId || periodId;
      }

      if (periodsRes.status === 'fulfilled' && periodsRes.value?.success) {
        loadedPeriods = periodsRes.value.data || [];
        setPeriods(loadedPeriods);
      }

      if (!periodId && loadedPeriods.length > 0) {
        const activePeriod = loadedPeriods.find((period) => period.status === 'ONGOING')
          || loadedPeriods.find((period) => {
            const start = new Date(period.startDate).getTime();
            const end = new Date(period.endDate).getTime();
            const now = Date.now();
            return !Number.isNaN(start) && !Number.isNaN(end) && start <= now && now <= end;
          })
          || loadedPeriods[0];
        periodId = activePeriod?.id || null;
      }

      const storedRole = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}').role; } catch { return null; }
      })();
      const [checkInResult, scheduleResult, meetingResult, adminSummaryResult] = await Promise.allSettled([
        storedRole === 'STUDENT' ? getMyCheckIns() : Promise.resolve({ success: true, data: [] }),
        getSchedules(periodId),
        getMeetings(periodId),
        storedRole === 'ADMIN' ? getAdminCheckInSummary() : Promise.resolve([]),
      ]);

      if (checkInResult.status === 'fulfilled' && checkInResult.value?.success) setCheckIns(checkInResult.value.data || []);
      if (scheduleResult.status === 'fulfilled' && scheduleResult.value?.success) {
        console.log('📅 Schedules received:', scheduleResult.value.data);
        setSchedules(scheduleResult.value.data || []);
      }
      if (meetingResult.status === 'fulfilled' && meetingResult.value?.success) setMeetings(meetingResult.value.data || []);
      if (adminSummaryResult.status === 'fulfilled') setAdminAttendance(adminSummaryResult.value || []);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Không tải được danh sách check-in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCheckIns();
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const isStudent = user?.role === 'STUDENT';
  const calendarCells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);
  const currentMonthLabel = useMemo(() => formatMonthLabel(monthCursor), [monthCursor]);

  const monthCheckIns = useMemo(() => {
    const monthPrefix = monthCursor.slice(0, 7);
    return checkIns.filter((item) => String(item.date || '').startsWith(monthPrefix));
  }, [checkIns, monthCursor]);

  const monthlyStats = useMemo(() => {
    const present = monthCheckIns.filter((item) => item.status === 'PRESENT').length;
    const late = monthCheckIns.filter((item) => item.status === 'LATE').length;
    const absent = monthCheckIns.filter((item) => item.status === 'ABSENT').length;

    return {
      present,
      late,
      absent,
      total: monthCheckIns.length,
    };
  }, [monthCheckIns]);

  const todayItem = useMemo(() => checkIns.find((item) => item.date === today), [checkIns, today]);
  const selectedDayCheckIn = useMemo(() => checkIns.find((item) => item.date === selectedDate), [checkIns, selectedDate]);

  const selectedDaySchedules = useMemo(() => {
    const result = schedules.filter((schedule) => {
      if (!schedule.startDate || !schedule.endDate) return false;
      const startDate = toLocalDateOnly(schedule.startDate);
      const endDate = toLocalDateOnly(schedule.endDate);
      const matches = startDate && endDate && startDate <= selectedDate && selectedDate <= endDate;
      if (matches) {
        console.log('[selectedDaySchedules] Found matching schedule:', {
          title: schedule.title,
          startDate,
          endDate,
          selectedDate,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        });
      }
      return matches;
    });
    console.log('[selectedDaySchedules] Filtered schedules for', selectedDate, ':', result.length, 'matches from', schedules.length);
    return result;
  }, [schedules, selectedDate]);

  const selectedDayMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      if (!meeting.meetingDate) return false;
      
      // Convert to local date string (YYYY-MM-DD)
      const d = new Date(meeting.meetingDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const meetingDate = `${year}-${month}-${day}`;
      
      return meetingDate === selectedDate;
    });
  }, [meetings, selectedDate]);

  const selectedDayExpectedStatus = useMemo(() => {
    if (selectedDayCheckIn) return selectedDayCheckIn.status;
    if (selectedDate !== today) return null;
    return getExpectedCheckInStatus(schedules, selectedDate, new Date());
  }, [selectedDayCheckIn, selectedDate, today, schedules]);

  const todayWindow = useMemo(() => getEffectiveCheckInWindow(schedules, today), [schedules, today]);

  const selectedDayCheckInLabel = useMemo(() => {
    if (todayItem) {
      return todayItem.status === 'ABSENT' ? 'Đã vắng' : 'Đã check-in';
    }
    if (selectedDate !== today) return 'Chỉ check-in hôm nay';
    if (!todayWindow) return 'Chưa có lịch check-in do admin tạo';
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    if (currentMinutes < todayWindow.startMinutes) {
      const hours = String(Math.floor(todayWindow.startMinutes / 60)).padStart(2, '0');
      const minutes = String(todayWindow.startMinutes % 60).padStart(2, '0');
      return `Mở lúc ${hours}:${minutes}`;
    }
    if (currentMinutes > todayWindow.endMinutes) return 'Đã quá giờ — Vắng';
    const onTimeEnd = todayWindow.startMinutes + 30;
    return currentMinutes <= onTimeEnd ? 'Check-in đúng giờ' : 'Check-in đi muộn';
  }, [selectedDate, today, todayItem, todayWindow]);

  const canCheckInNow = useMemo(() => {
    if (selectedDate !== today) return false;
    if (todayItem) return false;
    const window = getEffectiveCheckInWindow(schedules, today);
    if (!window) return false;
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const canCheck = currentMinutes >= window.startMinutes && currentMinutes <= window.endMinutes;
    console.log('[canCheckInNow]', {
      schedules: schedules.length,
      today,
      selectedDate,
      window,
      currentMinutes,
      canCheck
    });
    return canCheck;
  }, [selectedDate, today, todayItem, schedules]);

  const todayCheckoutWindow = useMemo(() => getEffectiveCheckOutWindow(schedules, today), [schedules, today]);

  const canCheckOutNow = useMemo(() => {
    if (selectedDate !== today || !todayItem || todayItem.checkOutTime) return false;
    if (!todayCheckoutWindow) return false;
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    return currentMinutes >= todayCheckoutWindow.startMinutes && currentMinutes <= todayCheckoutWindow.endMinutes;
  }, [selectedDate, today, todayItem, todayCheckoutWindow]);

  const checkInDisabledReason = useMemo(() => {
    if (selectedDate !== today) return 'Chỉ có thể check-in cho ngày hôm nay.';
    if (todayItem) return 'Bạn đã check-in hôm nay rồi.';
    if (!todayWindow) return 'Chưa có lịch check-in do admin tạo cho hôm nay.';
    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    if (currentMinutes < todayWindow.startMinutes) {
      const hours = String(Math.floor(todayWindow.startMinutes / 60)).padStart(2, '0');
      const minutes = String(todayWindow.startMinutes % 60).padStart(2, '0');
      return `Check-in chỉ mở từ ${hours}:${minutes}.`;
    }
    if (currentMinutes > todayWindow.endMinutes) {
      const hours = String(Math.floor(todayWindow.endMinutes / 60)).padStart(2, '0');
      const mins = String(todayWindow.endMinutes % 60).padStart(2, '0');
      return `Đã quá ${hours}:${mins}, hôm nay được tính vắng.`;
    }
    return null;
  }, [selectedDate, today, todayItem, todayWindow]);

  const getEventsForDate = (date) => {
    // Use centralized local date normalizer

    const scheduleEvents = schedules
      .filter((schedule) => {
        if (!schedule.startDate || !schedule.endDate) return false;
        const startDate = toLocalDateOnly(schedule.startDate);
        const endDate = toLocalDateOnly(schedule.endDate);
        return startDate && endDate && startDate <= date && date <= endDate;
      })
      .map((schedule) => ({
        kind: 'work',
        title: schedule.title,
        time: `${formatClock(schedule.startTime)} • ${formatClock(schedule.endTime)}`,
        location: schedule.location || 'Chưa có địa điểm',
        note: schedule.description || 'Chưa có ghi chú',
        status: schedule.type || 'WORK',
        rawTime: schedule.startTime,
      }));

    const meetingEvents = meetings
      .filter((meeting) => {
        if (!meeting.meetingDate) return false;
        const meetingDate = toLocalDateOnly(meeting.meetingDate);
        return meetingDate && meetingDate === date;
      })
      .map((meeting) => ({
        kind: 'meeting',
        title: meeting.title,
        time: `${formatClock(meeting.meetingTime)}${meeting.duration ? ` • ${meeting.duration}` : ''}`,
        location: meeting.location || 'Chưa có địa điểm',
        note: meeting.agenda || 'Chưa có ghi chú',
        status: meeting.status || 'Sắp diễn ra',
        rawTime: meeting.meetingTime,
      }));

    return [...scheduleEvents, ...meetingEvents];
  };

  const selectedDayEvents = useMemo(() => getEventsForDate(selectedDate), [schedules, meetings, selectedDate]);

  const weekStart = useMemo(() => getWeekStart(new Date(today)), [today]);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const weeklyCheckIns = useMemo(() => {
    return checkIns.filter((item) => {
      if (!item?.date) return false;
      const date = parseISODateLocal(item.date);
      return date && date >= weekStart && date <= weekEnd;
    });
  }, [checkIns, weekStart, weekEnd]);

  const weeklySummary = useMemo(
    () => ({
      present: weeklyCheckIns.filter((item) => item.status === 'PRESENT').length,
      late: weeklyCheckIns.filter((item) => item.status === 'LATE').length,
      absent: weeklyCheckIns.filter((item) => item.status === 'ABSENT').length,
      total: weeklyCheckIns.length,
    }),
    [weeklyCheckIns]
  );

  const upcomingEvent = useMemo(() => {
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const futureEvents = selectedDayEvents
      .map((event) => ({
        ...event,
        minutes: parseTimeValue(event.rawTime),
      }))
      .filter((event) => event.minutes != null && event.minutes >= nowMinutes)
      .sort((a, b) => a.minutes - b.minutes);
    return futureEvents[0] || null;
  }, [selectedDayEvents]);

  const dayStatusHeadline = useMemo(() => {
    if (upcomingEvent) return `Sắp có ${upcomingEvent.kind === 'meeting' ? 'cuộc họp' : 'công việc'} lúc ${formatClock(upcomingEvent.rawTime)}`;
    if (
      selectedDayEvents.length > 0 &&
      selectedDayEvents.every((event) => {
        const minutes = parseTimeValue(event.rawTime);
        return minutes != null && minutes < new Date().getHours() * 60 + new Date().getMinutes();
      })
    ) {
      return 'Đã hoàn thành nhiệm vụ trong ngày';
    }
    return 'Không có sự kiện thêm';
  }, [selectedDayEvents, upcomingEvent]);

  const handleDayClick = (dateKey) => {
    setSelectedDate(dateKey);
    setDayModalOpen(getEventsForDate(dateKey).length > 0);
  };

  const openAttendanceDetail = async (row, status) => {
    try {
      const data = await getAdminCheckInDetail({
        studentId: row.studentId,
        status,
        periodId: undefined,
      });
      setAttendanceDetail(data);
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Không tải được chi tiết điểm danh.');
    }
  };

  const selectedCheckInStatus = useMemo(() => {
    if (selectedDayCheckIn) return selectedDayCheckIn.status;
    if (selectedDate !== today) return null;
    return selectedDayExpectedStatus;
  }, [selectedDayCheckIn, selectedDate, today, selectedDayExpectedStatus]);

  const selectedStatusLabel = selectedDayCheckIn
    ? selectedDayCheckIn.checkOutTime
      ? 'Complete'
      : selectedDayCheckIn.status === 'PRESENT'
        ? 'Đúng giờ'
        : selectedDayCheckIn.status === 'LATE'
          ? 'Đi muộn'
          : 'Vắng'
    : selectedDate === today
      ? (getEffectiveCheckInWindow(schedules, today) ? 'Chưa check-in' : 'Chưa có lịch')
      : 'Chưa có dữ liệu';

  const selectedStatusClass = selectedDayCheckIn
    ? selectedDayCheckIn.status === 'PRESENT'
      ? 'status-done'
      : selectedDayCheckIn.status === 'LATE'
        ? 'status-warning'
        : 'status-pending'
    : 'status-pending';

  const handleCheckIn = async () => {
    console.log('[CheckInPage] handleCheckIn', { selectedDate, today, todayItem, canCheckInNow, checkInDisabledReason });
    if (!isStudent) {
      setStatusMessage('Chỉ sinh viên được phép check-in.');
      return;
    }

    if (selectedDate !== today) {
      setStatusMessage('Chỉ có thể check-in cho ngày hôm nay.');
      return;
    }

    if (todayItem) {
      setStatusMessage('Bạn đã check-in hôm nay rồi.');
      return;
    }

    if (!canCheckInNow) {
      setStatusMessage(checkInDisabledReason || 'Chưa tới giờ check-in.');
      return;
    }

    try {
      const now = new Date();
      const payload = {
        date: selectedDate,
        time: now.toTimeString().split(' ')[0],
        status: getExpectedCheckInStatus(schedules, selectedDate, now),
        note: checkInNote || undefined,
      };
      const res = await submitCheckIn(payload);
      if (res && res.success) {
        setStatusMessage('Đã check-in thành công!');
        loadCheckIns();
      } else {
        setStatusMessage(res?.message || 'Không thể check-in.');
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Lỗi khi gửi check-in.');
    }
  };

  const handleCheckOut = async () => {
    if (!isStudent) {
      setStatusMessage('Chỉ sinh viên được phép check-out.');
      return;
    }

    if (selectedDate !== today) {
      setStatusMessage('Chỉ có thể check-out cho ngày hôm nay.');
      return;
    }

    if (!todayItem) {
      setStatusMessage('Bạn cần check-in trước khi check-out.');
      return;
    }

    if (todayItem.checkOutTime) {
      setStatusMessage('Bạn đã check-out cho ngày hôm nay rồi.');
      return;
    }
    if (!todayCheckoutWindow) {
      setStatusMessage('Chưa có lịch check-out hôm nay.');
      return;
    }
    if (!canCheckOutNow) {
      const hours = String(Math.floor(todayCheckoutWindow.startMinutes / 60)).padStart(2, '0');
      const mins = String(todayCheckoutWindow.startMinutes % 60).padStart(2, '0');
      const endHours = String(Math.floor(todayCheckoutWindow.endMinutes / 60)).padStart(2, '0');
      const endMins = String(todayCheckoutWindow.endMinutes % 60).padStart(2, '0');
      setStatusMessage(`Checkout chỉ mở từ ${hours}:${mins} đến ${endHours}:${endMins}.`);
      return;
    }

    try {
      const res = await submitCheckOut({ date: selectedDate });
      if (res && res.success) {
        setStatusMessage('Đã check-out thành công!');
        loadCheckIns();
      } else {
        setStatusMessage(res?.message || 'Không thể check-out.');
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Lỗi khi gửi check-out.');
    }
  };

  const handleMonthChange = (offset) => {
    const current = parseISODateLocal(monthCursor) || new Date();
    const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    const nextMonth = toISODateLocal(next);
    setMonthCursor(nextMonth);
    setSelectedDate(nextMonth);
  };

  const handleAdminSave = async (kind) => {
    try {
      const minDate = toISODateLocal(new Date());
      if (adminForm.audience === 'SPECIFIC_PERIOD' && !adminForm.periodId) {
        setStatusMessage('Vui lòng chọn kỳ thực tập khi chọn lịch theo kỳ.');
        return;
      }

      if (kind === 'schedule') {
        if (!adminForm.startDate || !adminForm.endDate || adminForm.startDate < minDate || adminForm.endDate < minDate) {
          setStatusMessage('Ngày bắt đầu/kết thúc không được nhỏ hơn hôm nay.');
          return;
        }
        if (!adminForm.startTime || !adminForm.endTime || adminForm.startTime >= adminForm.endTime) {
          setStatusMessage('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
          return;
        }
        const payload = {
          title: adminForm.title,
          type: adminForm.type,
          audience: adminForm.audience,
          startDate: adminForm.startDate,
          endDate: adminForm.endDate,
          startTime: adminForm.startTime,
          endTime: adminForm.endTime,
          location: adminForm.location,
          description: adminForm.description,
          periodId: adminForm.audience === 'SPECIFIC_PERIOD' ? adminForm.periodId || null : undefined,
        };
        if (editingScheduleId) {
          await updateSchedule(editingScheduleId, payload);
        } else {
          await createSchedule(payload);
        }
      } else {
        if (adminForm.audience === 'SPECIFIC_PERIOD' && !adminForm.periodId) {
          setStatusMessage('Vui lòng chọn kỳ thực tập khi tạo cuộc họp theo kỳ.');
          return;
        }
        if (!adminForm.meetingDate || adminForm.meetingDate < minDate) {
          setStatusMessage('Ngày họp không được nhỏ hơn hôm nay.');
          return;
        }
        if (!adminForm.meetingTime || !adminForm.meetingEndTime || adminForm.meetingTime >= adminForm.meetingEndTime) {
          setStatusMessage('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
          return;
        }
        const payload = {
          title: adminForm.title,
          audience: adminForm.audience,
          meetingDate: adminForm.meetingDate,
          meetingTime: adminForm.meetingTime,
          endTime: adminForm.meetingEndTime,
          location: adminForm.location,
          agenda: adminForm.agenda,
          periodId: adminForm.audience === 'SPECIFIC_PERIOD' ? adminForm.periodId || null : undefined,
        };
        if (editingMeetingId) {
          await updateMeeting(editingMeetingId, payload);
        } else {
          await createMeeting(payload);
        }
      }

      setStatusMessage('Đã lưu lịch thành công.');
      setEditingScheduleId(null);
      setEditingMeetingId(null);
      setAdminForm(initialAdminForm);
      loadCheckIns();
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Không lưu được lịch.');
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditingMeetingId(null);
    setEditingScheduleId(schedule.id);
    setAdminForm({
      ...adminForm,
      title: schedule.title || '',
      type: schedule.type || 'WORK',
      audience: schedule.audience || 'ALL_STUDENTS',
      startDate: schedule.startDate || '',
      endDate: schedule.endDate || '',
      startTime: schedule.startTime || '',
      endTime: schedule.endTime || '',
      location: schedule.location || '',
      description: schedule.description || '',
      periodId: schedule.periodId || null,
    });
  };

  const handleEditMeeting = (meeting) => {
    setEditingScheduleId(null);
    setEditingMeetingId(meeting.id);
    setAdminForm({
      ...adminForm,
      title: meeting.title || '',
      audience: meeting.audience || 'ALL_STUDENTS',
      meetingDate: meeting.meetingDate || '',
      meetingTime: meeting.meetingTime || '',
      meetingEndTime: meeting.endTime || '',
      location: meeting.location || '',
      agenda: meeting.agenda || '',
      periodId: meeting.periodId || null,
    });
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteSchedule(id);
      setStatusMessage('Đã xóa lịch làm việc.');
      loadCheckIns();
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Không xóa được lịch.');
    }
  };

  const handleDeleteMeeting = async (id) => {
    try {
      await deleteMeeting(id);
      setStatusMessage('Đã xóa cuộc họp.');
      loadCheckIns();
    } catch (error) {
      setStatusMessage(error.response?.data?.message || 'Không xóa được cuộc họp.');
    }
  };

  return (
    <div className="page-shell checkin-page">
      <section className="checkin-hero card">
        <div>
          <p className="subtle-text">Hôm nay • {formatLongDate(today)}</p>
          <h1>Check-in & Lịch làm việc</h1>
          <p className="hero-text">Điểm danh hàng ngày, rồi bấm vào từng ngày trên lịch để xem chi tiết check-in và lịch liên quan.</p>
        </div>
        <div className="checkin-hero-actions">
          {isStudent && (
            <button
              type="button"
              className="btn"
              onClick={handleCheckIn}
              disabled={selectedDate !== today || Boolean(todayItem) || !canCheckInNow}
              title={checkInDisabledReason || ''}
            >
              {selectedDayCheckInLabel}
            </button>
          )}
          <button type="button" className="btn outline" onClick={() => setSelectedDate(today)}>
            Về ngày hôm nay
          </button>
        </div>
      </section>

      {statusMessage && <div className="info-card"><p>{statusMessage}</p></div>}

      {isStudent && (
        <div className="checkin-summary-grid">
          <div className="checkin-summary-card highlight">
            <p className="subtle-text">Ngày được chọn</p>
            <h2>{formatLongDate(selectedDate)}</h2>
            <div className={`status-chip ${selectedStatusClass}`}>{selectedStatusLabel}</div>
            <div className="checkin-summary-values">
              <div>
                <span>Check-in</span>
                <strong>{selectedDayCheckIn?.time || '--:--'}</strong>
              </div>
              <div>
                <span>Check-out</span>
                <strong>{selectedDayCheckIn?.checkOutTime || '--:--'}</strong>
              </div>
            </div>
            <p className="box-meta">
              {selectedDate === today
                ? todayWindow
                  ? `Đúng giờ ${formatClock(formatMinutesToTimeString(todayWindow.startMinutes))}–${formatClock(formatMinutesToTimeString(todayWindow.startMinutes + 30))} · Đi muộn ${formatClock(formatMinutesToTimeString(todayWindow.startMinutes + 31))}–${formatClock(formatMinutesToTimeString(todayWindow.endMinutes))} · Checkout ${getCheckoutTimeRangeLabel(todayCheckoutWindow)}`
                  : 'Chưa có lịch check-in hôm nay.'
                : 'Chọn một ngày khác trên lịch để xem thông tin.'}
            </p>
          </div>

          <div className="checkin-summary-card stats-card">
            <p className="subtle-text">Thống kê tháng</p>
            <div className="stats-list">
              <div className="stats-item green">
                <span>Có mặt</span>
                <strong>{monthlyStats.present}</strong>
              </div>
              <div className="stats-item yellow">
                <span>Đi muộn</span>
                <strong>{monthlyStats.late}</strong>
              </div>
              <div className="stats-item red">
                <span>Vắng mặt</span>
                <strong>{monthlyStats.absent}</strong>
              </div>
              <div className="stats-item gray">
                <span>Tổng ngày công</span>
                <strong>{monthlyStats.total}</strong>
              </div>
            </div>
          </div>

          <div className="checkin-summary-card quick-card">
            <p className="subtle-text">Check-in tuần</p>
            <h2>{weeklySummary.total} lần</h2>
            <div className="mini-stats-row">
              <span>Có mặt {weeklySummary.present}</span>
              <span>Muộn {weeklySummary.late}</span>
            </div>
            <div className="mini-stats-row">
              <span>Vắng {weeklySummary.absent}</span>
              <span>Hôm nay: {todayItem ? 'Đã xong' : 'Chưa check-in'}</span>
            </div>
            <div className="box-meta">{dayStatusHeadline}</div>
          </div>
        </div>
      )}

      <div className="checkin-main-grid">
        <section className="card calendar-card">
          <div className="card-header">
            <div>
              <h3>{currentMonthLabel}</h3>
              <p>Bấm vào một ngày để xem chi tiết check-in của ngày đó.</p>
            </div>
            <div className="calendar-nav">
              <button className="btn outline" type="button" onClick={() => handleMonthChange(-1)}>{'←'}</button>
              <button className="btn outline" type="button" onClick={() => handleMonthChange(1)}>{'→'}</button>
            </div>
          </div>

          <div className="calendar-legend">
            <span><span className="legend-dot on-time" /> Đúng giờ</span>
            <span><span className="legend-dot late" /> Đi muộn</span>
            <span><span className="legend-dot absent" /> Vắng</span>
            <span><span className="legend-dot none" /> Chưa có dữ liệu</span>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>

          <div className="checkin-calendar-grid">
            {calendarCells.map((dateKey, index) => {
              if (!dateKey) {
                return <div key={`empty-${index}`} className="calendar-cell empty" />;
              }

              const dayCheckIn = checkIns.find((item) => item.date === dateKey);
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedDate;
              
              // Convert to local date string for comparison
              const toLocalDateString = (dateStr) => {
                // Nếu đã là YYYY-MM-DD, trả về ngay
                if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                  return dateStr;
                }
                // Nếu là ISO format, parse và convert sang local
                const d = new Date(dateStr);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              };
              
              const hasSchedule = schedules.some((schedule) => {
                if (!schedule.startDate || !schedule.endDate) return false;
                const startDate = toLocalDateOnly(schedule.startDate);
                const endDate = toLocalDateOnly(schedule.endDate);
                return startDate && endDate && startDate <= dateKey && dateKey <= endDate;
              });
              const hasMeeting = meetings.some((meeting) => {
                if (!meeting.meetingDate) return false;
                const meetingDate = toLocalDateOnly(meeting.meetingDate);
                return meetingDate && meetingDate === dateKey;
              });

              const dayClass = dayCheckIn
                ? dayCheckIn.status === 'PRESENT'
                  ? 'on-time'
                  : dayCheckIn.status === 'LATE'
                    ? 'late'
                    : 'absent'
                : 'none';

              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`calendar-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleDayClick(dateKey)}
                >
                  <span className="calendar-day-number">{parseISODateLocal(dateKey)?.getDate()}</span>
                  <span className={`day-dot ${dayClass}`} />
                  <span className="calendar-day-note">
                    {dayCheckIn
                      ? dayCheckIn.status === 'PRESENT'
                        ? 'Đã check-in'
                        : dayCheckIn.status === 'LATE'
                          ? 'Đi muộn'
                          : 'Vắng'
                      : hasMeeting
                        ? 'Có họp'
                        : hasSchedule
                          ? 'Có việc'
                          : 'Trống'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card selected-day-card">
          <div className="card-header">
            <div>
              <h3>{formatLongDate(selectedDate)}</h3>
              <p>{selectedDate === today ? 'Thông tin check-in của hôm nay.' : 'Thông tin chi tiết theo ngày đã chọn.'}</p>
            </div>
            <span className={`status-chip ${selectedStatusClass}`}>{selectedStatusLabel}</span>
          </div>

          <div className="two-box-row">
            <div className="box-light">
              <p className="box-label">Check-in</p>
              <h3>{selectedDayCheckIn?.time || 'Chưa có'}</h3>
              <p className="box-meta">{selectedDayCheckIn ? 'Đã ghi nhận' : selectedDate === today ? 'Sẵn sàng check-in' : 'Chưa có dữ liệu'}</p>
            </div>
            <div className="box-light">
              <p className="box-label">Check-out</p>
              <h3>{selectedDayCheckIn?.checkOutTime || '--:--'}</h3>
              <p className="box-meta">
                {selectedDayCheckIn?.checkOutTime
                  ? 'Đã ghi nhận'
                  : selectedDate === today
                    ? 'Dự kiến'
                    : 'Không áp dụng'}
              </p>
            </div>
          </div>

          <div className="selected-day-events">
            <div className="card-subhead">Lịch trong ngày</div>
            {selectedDayEvents.length === 0 ? (
              <p className="empty-text">Không có lịch họp hoặc công việc cho ngày này.</p>
            ) : (
              <div className="timeline-list compact-list">
                {selectedDayEvents.map((event, index) => (
                  <div key={`${event.kind}-${index}`} className="timeline-item">
                    <div className={`timeline-marker ${event.kind}`} />
                    <div className="timeline-content">
                      <div className="timeline-row">
                        <div>
                          <p className="meeting-date">{event.status}</p>
                          <h4>{event.title}</h4>
                        </div>
                      </div>
                      <div className="meeting-meta">
                        <span>{event.time}</span>
                        <span>{event.location}</span>
                      </div>
                      <p className="meeting-note">{event.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="checkin-actions">
            {!isAdmin && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCheckIn}
                  disabled={!isStudent || selectedDate !== today || Boolean(todayItem) || !canCheckInNow}
                  title={checkInDisabledReason || ''}
                >
                  {selectedDayCheckInLabel}
                </button>
                <button type="button" className="btn" onClick={handleCheckOut} disabled={!isStudent || !canCheckOutNow} title={getCheckoutTooltip(todayCheckoutWindow)}>
                  {todayItem?.checkOutTime ? 'Complete' : 'Check-out hôm nay'}
                </button>
              </>
            )}
            <button className="btn outline" type="button" onClick={() => setSelectedDate(today)}>
              Chuyển về hôm nay
            </button>
          </div>
        </section>
      </div>

      {dayModalOpen && (
        <div className="modal-backdrop" onClick={() => setDayModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Chi tiết ngày {formatDayShort(selectedDate)}</h3>
                <p>{selectedDayEvents.length > 0 ? 'Danh sách lịch họp và công việc' : 'Không có sự kiện nào cho ngày này.'}</p>
              </div>
              <button className="modal-close" onClick={() => setDayModalOpen(false)}>×</button>
            </div>

            <div className="form-stack">
              {isStudent && <div className="box-light">
                <p className="box-label">Trạng thái check-in</p>
                <h3>{selectedStatusLabel}</h3>
                {selectedDate === today && !selectedDayCheckIn && selectedCheckInStatus === 'LATE' ? (
                  <p className="modal-note">Bạn đã trễ hơn 10 phút so với giờ dự kiến.</p>
                ) : null}
              </div>}

              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event, idx) => (
                  <div key={`${event.kind}-${idx}`} className="box-light event-box">
                    <div className="event-pill">{event.kind === 'work' ? 'Công việc' : 'Họp'}</div>
                    <h4>{event.title}</h4>
                    <p className="meeting-meta">{event.time} • {event.location}</p>
                    <p className="meeting-note">{event.note}</p>
                  </div>
                ))
              ) : (
                <p className="empty-text">Không có lịch hôm nay.</p>
              )}

              {isStudent && <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>Ghi chú khi check-in (tùy chọn)</label>
                <textarea
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  placeholder="Ghi chú ngắn (ví dụ: Đã tham gia buổi học, vắng học phần...)"
                  style={{ width: '100%', minHeight: 64, padding: 8, borderRadius: 8, border: '1px solid #e6e9ee' }}
                />
              </div>}

              <div className="checkin-actions modal-actions">
                {!isAdmin && (
                  <>
                    <button type="button" className="btn" onClick={handleCheckIn} disabled={!isStudent || selectedDate !== today || Boolean(todayItem) || !canCheckInNow} title={checkInDisabledReason || ''}>
                      {selectedDayCheckInLabel}
                    </button>
                    <button type="button" className="btn outline" onClick={handleCheckOut} disabled={!isStudent || !canCheckOutNow} title={getCheckoutTooltip(todayCheckoutWindow)}>
                      {todayItem?.checkOutTime ? 'Complete' : 'Check-out'}
                    </button>
                  </>
                )}
                <button className="btn outline" type="button" onClick={() => setDayModalOpen(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Lịch họp và lịch làm việc</h3>
            <p>Lịch được tạo từ backend sẽ hiển thị bên dưới để bạn đối chiếu nhanh.</p>
          </div>
          <div className="calendar-legend">
            <span><span className="legend-dot on-time" /> Công việc</span>
            <span><span className="legend-dot late" /> Họp</span>
          </div>
        </div>

        {loading ? (
          <p className="empty-text">Đang tải lịch...</p>
        ) : selectedDaySchedules.length === 0 && selectedDayMeetings.length === 0 ? (
          <p className="empty-text">Chưa có lịch nào được tạo.</p>
        ) : (
          <div className="timeline-list">
            {selectedDaySchedules.map((schedule) => (
              <div key={`schedule-${schedule.id}`} className="timeline-item">
                <div className="timeline-marker work" />
                <div className="timeline-content">
                  <div className="timeline-row">
                    <div>
                      <p className="meeting-date">{formatDayShort(schedule.startDate)} - {formatDayShort(schedule.endDate)}</p>
                      <h4>{schedule.title}</h4>
                    </div>
                    <span className="status-chip status-pending">{schedule.type}</span>
                  </div>
                  <div className="meeting-meta">
                    <span>{formatClock(schedule.startTime)} - {formatClock(schedule.endTime)}</span>
                    <span>{schedule.location || 'Chưa có địa điểm'}</span>
                    <span>{schedule.audience === 'ALL_STUDENTS' ? 'Tất cả sinh viên' : 'Theo kỳ thực tập'}</span>
                  </div>
                  <p className="meeting-note">{schedule.description}</p>
                  {isAdmin && (
                    <div className="button-row">
                      <button className="btn outline" type="button" onClick={() => handleEditSchedule(schedule)}>Sửa</button>
                      <button className="btn outline" type="button" onClick={() => handleDeleteSchedule(schedule.id)}>Xóa</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {selectedDayMeetings.map((meeting) => (
              <div key={`meeting-${meeting.id}`} className="timeline-item">
                <div className="timeline-marker meeting" />
                <div className="timeline-content">
                  <div className="timeline-row">
                    <div>
                      <p className="meeting-date">{formatDayShort(meeting.meetingDate)}</p>
                      <h4>{meeting.title}</h4>
                    </div>
                    <span className={`status-chip ${meeting.status === 'DONE' ? 'status-done' : 'status-pending'}`}>
                      {meeting.status || 'Sắp diễn ra'}
                    </span>
                  </div>
                  <div className="meeting-meta">
                    <span>{formatClock(meeting.meetingTime)}{meeting.endTime ? ` - ${formatClock(meeting.endTime)}` : ''}</span>
                    <span>{meeting.location || 'Chưa có địa điểm'}</span>
                    <span>{meeting.audience === 'ALL_STUDENTS' ? 'Tất cả sinh viên' : 'Theo kỳ thực tập'}</span>
                  </div>
                  <p className="meeting-note">{meeting.agenda}</p>
                  {isAdmin && (
                    <div className="button-row">
                      <button className="btn outline" type="button" onClick={() => handleEditMeeting(meeting)}>Sửa</button>
                      <button className="btn outline" type="button" onClick={() => handleDeleteMeeting(meeting.id)}>Xóa</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Tổng hợp điểm danh sinh viên</h3>
              <p>Chọn vào số buổi để xem thời gian check-in/check-out chi tiết.</p>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Mã SV</th>
                  <th>Họ tên</th>
                  <th>Lớp</th>
                  <th>Chuyên ngành</th>
                  <th>Đúng giờ</th>
                  <th>Đi trễ</th>
                  <th>Vắng</th>
                  <th>Tổng buổi</th>
                </tr>
              </thead>
              <tbody>
                {adminAttendance.length === 0 ? (
                  <tr><td colSpan="8">Chưa có dữ liệu điểm danh.</td></tr>
                ) : adminAttendance.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.studentCode || '—'}</td>
                    <td>{row.fullName || '—'}</td>
                    <td>{row.className || '—'}</td>
                    <td>{row.majorName || '—'}</td>
                    <td><button type="button" className="btn outline small" onClick={() => openAttendanceDetail(row, 'PRESENT')}>{row.onTime}</button></td>
                    <td><button type="button" className="btn outline small" onClick={() => openAttendanceDetail(row, 'LATE')}>{row.late}</button></td>
                    <td><button type="button" className="btn outline small" onClick={() => openAttendanceDetail(row, 'ABSENT')}>{row.absent}</button></td>
                    <td><button type="button" className="btn small" onClick={() => openAttendanceDetail(row, null)}>{row.total}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h3>Quản lý lịch cho sinh viên</h3>
          <div className="form-stack">
            <input placeholder="Tiêu đề" value={adminForm.title} onChange={(e) => setAdminForm({ ...adminForm, title: e.target.value })} />
            <div className="two-box-row">
              <select value={adminForm.type} onChange={(e) => setAdminForm({ ...adminForm, type: e.target.value })}>
                <option value="WORK">Công việc</option>
                <option value="MEETING">Họp</option>
                <option value="CHECKIN">Check-in</option>
                <option value="CHECKOUT">Check-out</option>
                <option value="DEADLINE">Deadline</option>
                <option value="OTHER">Khác</option>
              </select>
              <select value={adminForm.audience} onChange={(e) => setAdminForm({ ...adminForm, audience: e.target.value })}>
                <option value="ALL_STUDENTS">Tất cả sinh viên</option>
                <option value="SPECIFIC_PERIOD">Theo kỳ thực tập</option>
              </select>
            </div>
            {adminForm.audience === 'SPECIFIC_PERIOD' && (
              <div className="two-box-row">
                <select value={adminForm.periodId || ''} onChange={(e) => setAdminForm({ ...adminForm, periodId: e.target.value || null })}>
                  <option value="">-- Chọn kỳ thực tập --</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || (`Kỳ ${p.id} (${p.startDate || ''} - ${p.endDate || ''})`)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="two-box-row">
              <input type="date" min={today} value={adminForm.startDate} onChange={(e) => setAdminForm({ ...adminForm, startDate: e.target.value })} />
              <input type="date" min={adminForm.startDate || today} value={adminForm.endDate} onChange={(e) => setAdminForm({ ...adminForm, endDate: e.target.value })} />
            </div>
            <div className="two-box-row">
              <input type="time" aria-label="Giờ bắt đầu" value={adminForm.startTime} onChange={(e) => setAdminForm({ ...adminForm, startTime: e.target.value })} />
              <input type="time" aria-label="Giờ kết thúc" value={adminForm.endTime} onChange={(e) => setAdminForm({ ...adminForm, endTime: e.target.value })} />
            </div>
            <input placeholder="Địa điểm" value={adminForm.location} onChange={(e) => setAdminForm({ ...adminForm, location: e.target.value })} />
            <textarea rows="3" placeholder="Mô tả" value={adminForm.description} onChange={(e) => setAdminForm({ ...adminForm, description: e.target.value })} />
            <div className="button-row">
              <button className="btn" type="button" onClick={() => handleAdminSave('schedule')}>Lưu lịch làm việc</button>
              <button className="btn outline" type="button" onClick={() => setAdminForm(initialAdminForm)}>Xóa form</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h3>Quản lý họp</h3>
          <div className="form-stack">
            <input placeholder="Tiêu đề cuộc họp" value={adminForm.title} onChange={(e) => setAdminForm({ ...adminForm, title: e.target.value })} />
            <div className="two-box-row">
              <input type="date" min={today} value={adminForm.meetingDate} onChange={(e) => setAdminForm({ ...adminForm, meetingDate: e.target.value })} />
              <input type="time" aria-label="Giờ bắt đầu họp" value={adminForm.meetingTime} onChange={(e) => setAdminForm({ ...adminForm, meetingTime: e.target.value })} />
              <input type="time" aria-label="Giờ kết thúc họp" value={adminForm.meetingEndTime} onChange={(e) => setAdminForm({ ...adminForm, meetingEndTime: e.target.value })} />
            </div>
            <input placeholder="Địa điểm" value={adminForm.location} onChange={(e) => setAdminForm({ ...adminForm, location: e.target.value })} />
            <textarea rows="3" placeholder="Agenda" value={adminForm.agenda} onChange={(e) => setAdminForm({ ...adminForm, agenda: e.target.value })} />
            <div className="button-row">
              <button className="btn" type="button" onClick={() => handleAdminSave('meeting')}>Lưu cuộc họp</button>
              <button className="btn outline" type="button" onClick={() => setAdminForm(initialAdminForm)}>Xóa form</button>
            </div>
          </div>
        </div>
      )}

      {attendanceDetail && (
        <div className="modal-backdrop" onClick={() => setAttendanceDetail(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết điểm danh — {attendanceDetail.student?.fullName}</h3>
              <button type="button" className="modal-close" onClick={() => setAttendanceDetail(null)}>×</button>
            </div>
            <div className="table-wrapper">
              <table className="simple-table">
                <thead>
                  <tr><th>Ngày</th><th>Trạng thái</th><th>Check-in</th><th>Check-out</th></tr>
                </thead>
                <tbody>
                  {attendanceDetail.records?.length ? attendanceDetail.records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.status === 'PRESENT' ? 'Đúng giờ' : record.status === 'LATE' ? 'Đi trễ' : 'Vắng'}</td>
                      <td>{record.time || '—'}</td>
                      <td>{record.checkOutTime || '—'}</td>
                    </tr>
                  )) : <tr><td colSpan="4">Không có buổi phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckInPage;
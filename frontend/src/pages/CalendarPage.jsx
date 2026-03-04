import React, { useEffect, useMemo, useState } from 'react';
import {
  Title,
  Stack,
  Modal,
  Text,
  Loader,
  Center,
  Badge,
  Group,
  Box,
  Button,
  ActionIcon,
  Divider,
  useMantineTheme,
  Select,
  TextInput,
  Textarea,
  SimpleGrid,
  ThemeIcon,
  Pagination
} from '@mantine/core';
import { IconCalendar, IconClock, IconMapPin, IconUser, IconInfoCircle, IconChevronLeft, IconX } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import dayjs from 'dayjs';
import { DatePickerInput, DatePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, cancelCalendarEvent, deleteCalendarEvent } from '../api/calendar.js';
import { createAnnouncement } from '../api/announcements.js';
import { getActiveCounselors } from '../api/counselors.js';
import { useAuth } from '../context/AuthContext.jsx';
import { HOURS_12, MINUTES_COMMON, MERIDIEMS, to24hTime, compareTimes24 } from '../utils/time.js';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal.jsx';

// Approximate footer height (navbar + footer spacing) used to keep list area tall enough
// so that pagination sits just above the footer in a stable position.
const LAYOUT_FOOTER_HEIGHT = 260;

const SAN_FABIAN_BARANGAYS = [
  'Alacan','Ambalangan-Dalin','Angio','Anonang','Aramal','Bigbiga','Binday','Bolaoen','Bolasi','Cabaruan','Cayanga','Colisao','Gomot','Inmalog','Inmalog Norte','Lekep-Butao','Lipit-Tomeeng','Longos','Longos Proper','Longos-Amangonan-Parac-Parac (Fabrica)','Mabilao','Nibaliw Central','Nibaliw East','Nibaliw Magliba','Nibaliw Narvarte (Nibaliw West Compound)','Nibaliw Vidal (Nibaliw West Proper)','Palapad','Poblacion','Rabon','Sagud-Bahley','Sobol','Tempra-Guilig','Tiblong','Tocok'
];

function to12hParts(dateObj) {
  const d = dayjs(dateObj);
  const h24 = d.hour();
  const minute = String(d.minute()).padStart(2, '0');
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour: String(h12).padStart(2, '0'), minute, meridiem };
}

function toDayKey(date) {
  return dayjs(date).format('YYYY-MM-DD');
}

function normalizeDay(date) {
  return dayjs(date).startOf('day');
}

function isSameOrBefore(a, b, unit = 'day') {
  return a.isSame(b, unit) || a.isBefore(b, unit);
}

function isSameOrAfter(a, b, unit = 'day') {
  return a.isSame(b, unit) || a.isAfter(b, unit);
}

export function getEventStatus(event, now = new Date()) {
  if (String(event?.status || '').toLowerCase() === 'cancelled') return 'CANCELLED';
  const n = dayjs(now);
  const start = dayjs(event.startDate);
  const rawEnd = event.endDate ? dayjs(event.endDate) : null;
  const end = !rawEnd || rawEnd.isSame(start) ? start.add(1, 'hour') : rawEnd;

  if (n.isBefore(start)) return 'UPCOMING';
  if (n.isSame(start) || (n.isAfter(start) && n.isBefore(end)) || n.isSame(end)) return 'ONGOING';
  return 'FINISHED';
}

function getEventTypeNormalized(ev) {
  const t = ev?.type || ev?.category || ev?.kind || '';
  return String(t).toUpperCase();
}

function getEventColor(ev, now = new Date()) {
  const type = getEventTypeNormalized(ev);
  // Event type colors (used across calendar and legends):
  // Pre-Marriage Orientation -> purple (Mantine 'grape')
  // Usapan-Series           -> orange
  // Event/Activity          -> yellow
  if (type === 'PRE-MARRIAGE ORIENTATION') return 'grape';
  if (type === 'USAPAN-SERIES') return 'orange';
  return 'yellow';
}

function getDayColor({ date, events, now = new Date() }) {
  const types = events.map(getEventTypeNormalized);
  if (types.includes('PRE-MARRIAGE ORIENTATION')) return 'grape';
  if (types.includes('USAPAN-SERIES')) return 'orange';
  return 'yellow';
}

function sortEventsUpcomingFirst(items, now = new Date()) {
  const today = normalizeDay(now);
  return [...items].sort((a, b) => {
    const sa = normalizeDay(a.startDate);
    const ea = a.endDate ? normalizeDay(a.endDate) : sa;
    const sb = normalizeDay(b.startDate);
    const eb = b.endDate ? normalizeDay(b.endDate) : sb;

    const aOngoing = isSameOrBefore(sa, today, 'day') && isSameOrAfter(ea, today, 'day');
    const bOngoing = isSameOrBefore(sb, today, 'day') && isSameOrAfter(eb, today, 'day');

    if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;

    const aPast = ea.isBefore(today, 'day');
    const bPast = eb.isBefore(today, 'day');

    if (aPast !== bPast) return aPast ? 1 : -1;

    const ta = sa.valueOf();
    const tb = sb.valueOf();
    if (ta !== tb) return ta - tb;

    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function getCalendarGridDays(targetMonth) {
  const monthStart = dayjs(targetMonth).startOf('month');
  // Ensure the grid always starts on Sunday to match the Sun–Sat headers,
  // regardless of locale start-of-week settings.
  const weekday = monthStart.day(); // 0 = Sunday, 1 = Monday, ...
  const gridStart = monthStart.subtract(weekday, 'day');

  const days = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(gridStart.add(i, 'day').toDate());
  }
  return days;
}

function expandEventsByDate(events, rangeStart, rangeEnd) {
  const start = normalizeDay(rangeStart);
  const end = normalizeDay(rangeEnd);
  const grouped = {};

  events.forEach((ev) => {
    const evStart = normalizeDay(ev.startDate);
    const evEnd = ev.endDate ? normalizeDay(ev.endDate) : evStart;

    const cursorStart = evStart.isAfter(start, 'day') ? evStart : start;
    const cursorEnd = evEnd.isBefore(end, 'day') ? evEnd : end;

    if (cursorEnd.isBefore(cursorStart, 'day')) return;

    let cursor = cursorStart;
    while (isSameOrBefore(cursor, cursorEnd, 'day')) {
      const key = cursor.format('YYYY-MM-DD');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
      cursor = cursor.add(1, 'day');
    }
  });

  return grouped;
}

export function CalendarPage() {
  const auth = useAuth() || {};
  const { isAdmin } = auth;
  const theme = useMantineTheme();
  const smBreakpoint = theme.breakpoints.sm;
  const smMaxWidth = typeof smBreakpoint === 'number' ? `${smBreakpoint}px` : smBreakpoint;
  const isMobile = useMediaQuery(`(max-width: ${smMaxWidth})`);
  const [month, setMonth] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [addModalOpened, setAddModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [activeCounselors, setActiveCounselors] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [deleteEventId, setDeleteEventId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelEventId, setCancelEventId] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [sidebarMonth, setSidebarMonth] = useState(month); // month shown in popup calendar only
  const [sidebarDate, setSidebarDate] = useState(null); // still used to filter main list
  const [sidebarPickerOpened, setSidebarPickerOpened] = useState(false);
  const [sidebarPopupDate, setSidebarPopupDate] = useState(null); // selection inside popup calendar
  const [sidebarHoverDate, setSidebarHoverDate] = useState(null); // hover state for popup tiles
  const [sidebarHoverEventId, setSidebarHoverEventId] = useState(null); // hover state for popup event cards

  const addForm = useForm({
    initialValues: {
      title: '',
      type: 'Pre-Marriage Orientation',
      date: null,
      startHour: '09',
      startMinute: '00',
      startMeridiem: 'AM',
      endHour: '10',
      endMinute: '00',
      endMeridiem: 'AM',
      counselorID: null,
      barangay: '',
      location: '',
      description: '',
      lead: '',
      status: 'Scheduled',
      details: ''
    },
    validate: {
      title: (v, values) => (values.type === 'Event/Activity' && !String(v || '').trim() ? 'Title is required' : null),
      date: (v) => (v ? null : 'Date is required'),
      startHour: (v) => (String(v || '').trim() ? null : 'Start hour is required'),
      startMinute: (v) => (String(v || '').trim() ? null : 'Start minute is required'),
      startMeridiem: (v) => (String(v || '').trim() ? null : 'Start AM/PM is required'),
      endHour: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End hour is required')),
      endMinute: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End minute is required')),
      endMeridiem: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End AM/PM is required')),
      counselorID: (v, values) =>
        values.type === 'Pre-Marriage Orientation' ? (v ? null : 'Counselor is required for this type') : null,
      lead: () => null,
      barangay: (v, values) => (values.type === 'Usapan-Series' ? (String(v || '').trim() ? null : 'Barangay is required') : null)
    }
  });

  const editForm = useForm({
    initialValues: {
      title: '',
      type: 'Pre-Marriage Orientation',
      date: null,
      startHour: '09',
      startMinute: '00',
      startMeridiem: 'AM',
      endHour: '10',
      endMinute: '00',
      endMeridiem: 'AM',
      counselorID: null,
      barangay: '',
      location: '',
      description: '',
      lead: '',
      status: 'Scheduled'
    },
    validate: {
      title: () => null,
      date: (v) => (v ? null : 'Date is required'),
      startHour: (v) => (String(v || '').trim() ? null : 'Start hour is required'),
      startMinute: (v) => (String(v || '').trim() ? null : 'Start minute is required'),
      startMeridiem: (v) => (String(v || '').trim() ? null : 'Start AM/PM is required'),
      endHour: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End hour is required')),
      endMinute: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End minute is required')),
      endMeridiem: (v, values) => (values.type === 'Usapan-Series' ? null : (String(v || '').trim() ? null : 'End AM/PM is required')),
      counselorID: (v, values) =>
        values.type === 'Pre-Marriage Orientation' ? (v ? null : 'Counselor is required for this type') : null,
      lead: () => null,
      barangay: (v, values) => (values.type === 'Usapan-Series' ? (String(v || '').trim() ? null : 'Barangay is required') : null)
    }
  });

  useEffect(() => {
    if (addForm.values.type === 'Pre-Marriage Orientation') {
      if (addForm.values.title) addForm.setFieldValue('title', '');
    }
    // Reset counselor when switching types
    if (addForm.values.type !== 'Pre-Marriage Orientation') {
      if (addForm.values.counselorID) addForm.setFieldValue('counselorID', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addForm.values.type]);

  useEffect(() => {
    if (editForm.values.type === 'Pre-Marriage Orientation') {
      if (editForm.values.title) editForm.setFieldValue('title', '');
    }
    if (editForm.values.type !== 'Pre-Marriage Orientation') {
      if (editForm.values.counselorID) editForm.setFieldValue('counselorID', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.values.type]);

  useEffect(() => {
    if (!isAdmin) return;
    getActiveCounselors()
      .then((res) => setActiveCounselors(res.data.data || []))
      .catch((err) => {
        console.error(err);
        setActiveCounselors([]);
      });
  }, [isAdmin]);

  const fetchEvents = async (targetMonth) => {
    setLoading(true);
    try {
      // Load a full year window so popup calendar can browse across months
      const start = dayjs(targetMonth).startOf('year').toISOString();
      const end = dayjs(targetMonth).endOf('year').toISOString();
      const res = await getCalendarEvents({ start, end });
      const all = res.data.data || [];
      // Filter out deleted announcement-backed events to avoid showing removed Event/Activity
      const filtered = all.filter((ev) => !(ev && ev.type === 'Event/Activity' && String(ev.status).toLowerCase() === 'deleted'));
      setEvents(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(month).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const monthRange = useMemo(() => {
    // Expand eventsByDate over the same yearly window used in fetchEvents
    const start = dayjs(month).startOf('year').toDate();
    const end = dayjs(month).endOf('year').toDate();
    return { start, end };
  }, [month]);

  const visibleEvents = useMemo(() => {
    const list = Array.isArray(events) ? events : [];
    return list.filter((ev) => {
      if (!ev) return false;
      const type = String(ev.type || '').toUpperCase();
      const rawStatus = String(ev.status || '').toUpperCase();
      if (type === 'USAPAN-SERIES' && rawStatus === 'PENDING') {
        return false;
      }
      return true;
    });
  }, [events]);

  const gridDays = useMemo(() => getCalendarGridDays(sidebarMonth), [sidebarMonth]);

  useEffect(() => {
    // keep popup calendar initially in sync with main month,
    // but allow independent navigation inside the popup
    setSidebarMonth(month);
  }, [month]);

  const eventsByDate = useMemo(() => {
    return expandEventsByDate(visibleEvents, monthRange.start, monthRange.end);
  }, [visibleEvents, monthRange.start, monthRange.end]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[toDayKey(selectedDate)] || [];
  }, [eventsByDate, selectedDate]);

  const sortedEventsForList = useMemo(() => {
    const now = new Date();
    const startOfMonth = dayjs(month).startOf('month');
    const endOfMonth = dayjs(month).endOf('month');
    const list = (visibleEvents || []).filter((ev) => {
      const s = dayjs(ev.startDate).startOf('day');
      const e = ev.endDate ? dayjs(ev.endDate).startOf('day') : s;
      return !(e.isBefore(startOfMonth, 'day') || s.isAfter(endOfMonth, 'day'));
    });

    list.sort((a, b) => {
      const statusA = getEventStatus(a, now);
      const statusB = getEventStatus(b, now);

      const isDoneA = statusA === 'FINISHED' || statusA === 'CANCELLED';
      const isDoneB = statusB === 'FINISHED' || statusB === 'CANCELLED';

      if (isDoneA !== isDoneB) {
        // Non-finished/non-cancelled events first, finished/cancelled events last
        return isDoneA ? 1 : -1;
      }

      const startA = dayjs(a.startDate);
      const startB = dayjs(b.startDate);

      if (startA.isBefore(startB)) return -1;
      if (startA.isAfter(startB)) return 1;
      return 0;
    });

    return list;
  }, [visibleEvents, month]);

  const typeOptions = useMemo(
    () => ([
      { value: 'Event/Activity', label: 'Event/Activity' },
      { value: 'Pre-Marriage Orientation', label: 'Pre-Marriage Orientation' },
      { value: 'Usapan-Series', label: 'Usapan-Series' },
    ]),
    []
  );

  const statusOptions = useMemo(
    () => ([
      { value: 'UPCOMING', label: 'Upcoming' },
      { value: 'ONGOING', label: 'Ongoing' },
      { value: 'FINISHED', label: 'Finished' },
      { value: 'CANCELLED', label: 'Cancelled' }
    ]),
    []
  );

  const locationOptions = useMemo(() => {
    const set = new Set();
    (visibleEvents || []).forEach((ev) => {
      const loc = ev?.location || ev?.barangay;
      const value = String(loc || '').trim();
      if (value) set.add(value);
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ value: v, label: v }));
  }, [visibleEvents]);

  const filteredEvents = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const lq = locationQuery.trim().toLowerCase();
    const selectedDay = sidebarDate ? normalizeDay(sidebarDate) : null;

    return sortedEventsForList.filter((ev) => {
      const matchesType = typeFilter ? String(ev.type) === String(typeFilter) : true;

      const status = getEventStatus(ev, new Date());
      const matchesStatus = statusFilter ? status === statusFilter : true;

      const title = String(ev.title || ev.type || '').toLowerCase();
      const loc = String(ev.location || ev.barangay || '').toLowerCase();
      const counselorName = String(ev.counselor || '').toLowerCase();
      const lead = String(ev.lead || '').toLowerCase();
      const desc = String(ev.description || '').toLowerCase();
      const barangay = String(ev.barangay || '').toLowerCase();

      const haystack = [
        title,
        loc,
        counselorName,
        lead,
        desc,
        barangay,
        String(ev.type || '').toLowerCase(),
        String(ev.status || '').toLowerCase()
      ].join(' ');

      const matchesKeyword = q ? haystack.includes(q) : true;
      const matchesLocation = lq ? loc.includes(lq) : true;

      let matchesDate = true;
      if (selectedDay) {
        const s = normalizeDay(ev.startDate);
        const e = ev.endDate ? normalizeDay(ev.endDate) : s;
        matchesDate = !(selectedDay.isBefore(s, 'day') || selectedDay.isAfter(e, 'day'));
      }

      return matchesType && matchesStatus && matchesKeyword && matchesLocation && matchesDate;
    });
  }, [sortedEventsForList, keyword, locationQuery, typeFilter, statusFilter, sidebarDate]);

  useEffect(() => {
    setPage(1);
  }, [keyword, locationQuery, typeFilter, statusFilter, sidebarDate]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((filteredEvents.length || 0) / pageSize);
    return n > 0 ? n : 1;
  }, [filteredEvents.length]);

  const pagedEvents = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, page, totalPages]);

  // Events that occur within the visible month (overlap by date range)
  const monthEvents = useMemo(() => {
    const start = dayjs(month).startOf('month');
    const end = dayjs(month).endOf('month');
    return (visibleEvents || []).filter((ev) => {
      const s = dayjs(ev.startDate).startOf('day');
      const e = ev.endDate ? dayjs(ev.endDate).startOf('day') : s;
      return !(e.isBefore(start, 'day') || s.isAfter(end, 'day'));
    });
  }, [visibleEvents, month]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return selectedEvents.find((ev) => String(ev.id) === String(selectedEventId)) || null;
  }, [selectedEventId, selectedEvents]);

  const selectedEventForList = useMemo(() => {
    if (!selectedEventId) return null;
    return sortedEventsForList.find((ev) => String(ev.id) === String(selectedEventId)) || null;
  }, [selectedEventId, sortedEventsForList]);

  const sidebarEvents = useMemo(() => {
    if (!sidebarPopupDate) return [];
    return eventsByDate[toDayKey(sidebarPopupDate)] || [];
  }, [eventsByDate, sidebarPopupDate]);

  const calendarWeeks = useMemo(() => {
    const weeks = [];
    for (let i = 0; i < gridDays.length; i += 7) {
      weeks.push(gridDays.slice(i, i + 7));
    }
    return weeks;
  }, [gridDays]);

  const hasEventActivity = useMemo(
    () => (visibleEvents || []).some((ev) => ev && ev.type === 'Event/Activity'),
    [visibleEvents]
  );

  const handleDayClick = (date) => {
    const dayEvents = eventsByDate[toDayKey(date)] || [];
    if (dayEvents.length === 0) {
      return;
    }
    setSelectedDate(date);
    setSelectedEventId(dayEvents.length === 1 ? dayEvents[0].id : null);
    setModalOpened(true);
  };

  const handleEventClick = (ev) => {
    setSelectedDate(null);
    setSelectedEventId(ev.id);
    setModalOpened(true);
  };

  const openEditForEvent = (ev) => {
    if (!ev) return;
    const startParts = to12hParts(ev.startDate);
    const endParts = to12hParts(ev.endDate || ev.startDate);
    editForm.setValues({
      title: ev.title || '',
      type: ev.type,
      date: ev.startDate ? new Date(ev.startDate) : null,
      startHour: startParts.hour,
      startMinute: startParts.minute,
      startMeridiem: startParts.meridiem,
      endHour: endParts.hour,
      endMinute: endParts.minute,
      endMeridiem: endParts.meridiem,
      counselorID: ev.counselorID || null,
      barangay: ev.type === 'Usapan-Series' ? (ev.location || '') : '',
      location: ev.type === 'Pre-Marriage Orientation' ? (ev.location || '') : '',
      status: ev.status || 'Scheduled',
      description: ev.description || '',
      details: ev.details || ''
    });
    editForm.resetDirty();
    setEditModalOpened(true);
  };

  const renderDay = (date) => {
    const key = toDayKey(date);
    const dayEvents = eventsByDate[key] || [];
    const hasEvents = dayEvents.length > 0;
    const dayColor = hasEvents ? getDayColor({ date, events: dayEvents, now: new Date() }) : null;
    const count = dayEvents.length;

    const isCurrentMonth = dayjs(date).isSame(dayjs(month), 'month');
    const isToday = dayjs(date).isSame(dayjs(), 'day');

    const bgColor =
      dayColor === 'green'
        ? theme.colors.green[2]
        : dayColor === 'gray'
          ? theme.colors.gray[2]
          : dayColor === 'red'
            ? theme.colors.red[2]
            : dayColor === 'orange'
              ? theme.colors.orange[2]
              : theme.colors.blue[2];

    const borderColor = isToday ? theme.colors.blue[6] : theme.colors.gray[3];

    return (
      <Box
        role={hasEvents ? 'button' : undefined}
        tabIndex={hasEvents ? 0 : -1}
        onClick={() => handleDayClick(date)}
        onKeyDown={(e) => {
          if (!hasEvents) return;
          if (e.key === 'Enter' || e.key === ' ') handleDayClick(date);
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          background: hasEvents ? bgColor : theme.white,
          opacity: isCurrentMonth ? 1 : 0.5,
          cursor: hasEvents ? 'pointer' : 'default',
          padding: 8,
          overflow: 'hidden'
        }}
      >

        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Text size="sm" fw={isToday ? 700 : 500} c={isToday ? 'blue.7' : 'dark'}>
            {date.getDate()}
          </Text>
          {hasEvents && (
            <Badge size="xs" variant="filled" color={dayColor}>
              {count}
            </Badge>
          )}
        </Group>
      </Box>
    );
  };

  return (
    <Stack spacing="lg" px="lg">
    <Title order={1} className="hover-underline">Schedule of Activities</Title>
      {/* Mobile month controls */}
      {isMobile && (
        <Stack gap="xs">
          <Group gap="xs" wrap="wrap">
            <ActionIcon variant="default" onClick={() => setMonth(dayjs(month).subtract(1, 'month').toDate())}>
              {'<'}
            </ActionIcon>
            <Text fw={600}>{dayjs(month).format('MMMM YYYY')}</Text>
            <ActionIcon variant="default" onClick={() => setMonth(dayjs(month).add(1, 'month').toDate())}>
              {'>'}
            </ActionIcon>
            <Button size="xs" variant="light" onClick={() => setMonth(new Date())}>
              Today
            </Button>
            {isAdmin && (
              <Button size="xs" onClick={() => setAddModalOpened(true)}>
                Add Schedule
              </Button>
            )}
          </Group>
        </Stack>
      )}

      {/* Mobile Calendar View card (above filters) */}
      {isMobile && (
        <div>
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title h6 mb-2">Event Type Legends</h5>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff' }}>Pre-Marriage Orientation</span>
                <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }}>Usapan-Series</span>
                <span className="badge text-bg-warning">Event/Activity</span>
              </div>
            </div>
            <div className="card-body">
              <h5 className="card-title h6 mb-2">Status Legends</h5>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge text-bg-primary">ONGOING</span>
                <span className="badge text-bg-secondary">UPCOMING</span>
                <span className="badge text-bg-success">FINISHED</span>
                <span className="badge text-bg-danger">CANCELLED</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters + desktop month controls */}
      <Divider />
      <Stack gap="xs">
        <Group wrap="wrap" justify="space-between" align="center" gap="xs">
          <Group wrap="wrap" gap="xs" align="stretch">
            <Select
              placeholder="Location"
              data={locationOptions}
              value={locationQuery || null}
              onChange={(v) => setLocationQuery(v || '')}
              searchable
              clearable
              nothingFoundMessage="No locations"
              style={{ minWidth: 180 }}
            />
            <Select
              placeholder="Select Event Type"
              data={typeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              searchable
              clearable
              style={{ minWidth: 200 }}
            />
            <Select
              placeholder="Status"
              data={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 160 }}
            />
          </Group>

          {!isMobile && (
            <Group gap="xs" wrap="nowrap">
              <ActionIcon variant="default" onClick={() => setMonth(dayjs(month).subtract(1, 'month').toDate())}>
                {'<'}
              </ActionIcon>
              <Text fw={600}>{dayjs(month).format('MMMM YYYY')}</Text>
              <ActionIcon variant="default" onClick={() => setMonth(dayjs(month).add(1, 'month').toDate())}>
                {'>'}
              </ActionIcon>
              <Button size="xs" variant="light" onClick={() => setMonth(new Date())}>
                Today
              </Button>
              {isAdmin && (
                <Button size="xs" onClick={() => setAddModalOpened(true)}>
                  Add Schedule
                </Button>
              )}
            </Group>
          )}
        </Group>
        <Text size="sm" c="dimmed">Total Events: {filteredEvents.length}</Text>
      </Stack>
      {loading && (
        <Center>
          <Loader size="sm" />
        </Center>
      )}

      <Group align="flex-start" wrap="nowrap">
        {/* List */}
        <Stack style={{ flex: 1 }} gap="sm">
          {/* Make the list area fill the viewport minus the footer height so pagination stays just above footer */}
          <Box style={{ minHeight: `calc(100vh - ${LAYOUT_FOOTER_HEIGHT}px)` }}>
            <Stack gap="sm">
              {filteredEvents.length === 0 ? (
                <Text c="dimmed" size="sm">No events found.</Text>
              ) : (
                pagedEvents.map((ev) => {
                const status = getEventStatus(ev, new Date());
                const typeColor = getEventColor(ev, new Date());
                const statusColor =
                  status === 'ONGOING'
                    ? 'blue'
                    : status === 'UPCOMING'
                      ? 'gray'
                      : status === 'FINISHED'
                        ? 'green'
                        : 'red';
                const start = dayjs(ev.startDate);
                const end = ev.endDate ? dayjs(ev.endDate) : null;
                const dateLabel = !end || end.isSame(start, 'day')
                  ? start.format('MMM D, YYYY')
                  : `${start.format('MMM D, YYYY')} - ${end.format('MMM D, YYYY')}`;
                const type = ev.type || 'Event/Activity';
                const isUsapanSeries = String(type).toUpperCase() === 'USAPAN-SERIES';
                const timeLabel = isUsapanSeries
                  ? start.format('h:mm A')
                  : (!end
                      ? start.format('h:mm A')
                      : `${start.format('h:mm A')} - ${end.format('h:mm A')}`);
                const initials = type.split(/\s|\//).filter(Boolean).map(s => s[0]).slice(0,2).join('').toUpperCase();

                return (
                  <Button
                  key={ev.id}
                  variant="subtle"
                  color="dark"
                  onClick={() => handleEventClick(ev)}
                  styles={{ root: { padding: 0, height: 'auto', justifyContent: 'stretch' }, inner: { width: '100%' }, label: { width: '100%' } }}
                >
                  <Box style={{ width: '100%', border: `1px solid ${theme.colors.gray[3]}`, borderRadius: 10, padding: 12, background: theme.white }}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Group gap="md" wrap="nowrap" align="center">
                        <Box style={{ width: 48, height: 48, borderRadius: 999, background: theme.colors[typeColor][1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          {initials}
                        </Box>
                        <Box style={{ minWidth: 0 }}>
                          <Text fw={700} lineClamp={1} style={{ textAlign: 'left' }}>
                            {type}
                          </Text>
                          <Group gap="md" c="dimmed" wrap="wrap">
                            <Group gap={4} wrap="nowrap">
                              <IconMapPin size={16} />
                              <Text size="sm" lineClamp={1}>{ev.location || ev.barangay || '—'}</Text>
                            </Group>
                            <Group gap={4} wrap="nowrap">
                              <IconCalendar size={16} />
                              <Text size="sm">{dateLabel}</Text>
                            </Group>
                            <Group gap={4} wrap="nowrap">
                              <IconClock size={16} />
                              <Text size="sm">{timeLabel}</Text>
                            </Group>
                          </Group>
                        </Box>
                      </Group>
                      <Badge
                        color={statusColor}
                        variant="light"
                        tt="none"
                        styles={{ root: { flexShrink: 0, paddingInline: 12 } }}
                      >
                        {status}
                      </Badge>
                    </Group>
                  </Box>
                  </Button>
                );
              })
              )}
            </Stack>
          </Box>

          {filteredEvents.length > pageSize ? (
            <Group justify="center" mt="xs">
              <Pagination
                total={totalPages}
                value={page}
                onChange={(value) => {
                  setPage(value);
                  // Smoothly scroll back to top of the page after changing page
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </Group>
          ) : null}
        </Stack>

        {/* Right sidebar (desktop) */}
        <div
          className="d-none d-lg-block"
          style={{ width: 340, flex: '0 0 340px' }}
        >
          <div className="vstack gap-3">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2 hover-underline">Calendar View</h5>
                <Button
                  variant="outline"
                  leftSection={<IconCalendar size={16} />}
                  fullWidth
                  onClick={() => setSidebarPickerOpened(true)}
                >
                  {sidebarDate
                    ? dayjs(sidebarDate).format('MMMM D, YYYY')
                    : 'Open calendar'}
                </Button>
              </div>
            </div>
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2">Event Type Legends</h5>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge" style={{ backgroundColor: '#6f42c1', color: '#fff' }}>Pre-Marriage Orientation</span>
                  <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }}>Usapan-Series</span>
                  <span className="badge text-bg-warning">Event/Activity</span>
                </div>
              </div>
            </div>
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title h6 mb-2">Status Legends</h5>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge text-bg-primary">ONGOING</span>
                  <span className="badge text-bg-secondary">UPCOMING</span>
                  <span className="badge text-bg-success">FINISHED</span>
                  <span className="badge text-bg-danger">CANCELLED</span>
                </div>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-header py-2 px-3 bg-light">
                <h5 className="card-title h6 mb-0">Services</h5>
              </div>
              <div className="card-body">
                <ul className="small mb-0">
                  <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                  <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                  <li><a href="/services/rpfp" className="text-decoration-none">Responsible Parenthood &amp; Family Development (RPFP)</a></li>
                  <li><a href="/services/ahdp" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                  <li><a href="/services/iec" className="text-decoration-none">Population Awareness &amp; IEC Activities</a></li>
                  <li><a href="/services/population-profiling" className="text-decoration-none">Demographic Data Collection &amp; Population Profiling</a></li>
                  <li><a href="/services/community-events" className="text-decoration-none">Support During Community Events</a></li>
                  <li><a href="/services/other-assistance" className="text-decoration-none">Other Assistance</a></li>
                </ul>
              </div>
            </div>

            <div className="card shadow-sm">
              <div className="card-header py-2 px-3 bg-light">
                <h5 className="card-title h6 mb-0">Population Office Location</h5>
              </div>
              <div className="card-body">
                <div className="ratio ratio-4x3 rounded overflow-hidden">
                  <iframe
                    title="San Fabian Population Office Location"
                    src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Group>

      {/* Sidebar content for mobile (shown below the list, minus Calendar View which is above filters) */}
      {isMobile && (
        <Stack gap="md" mt="md">
          <div className="card shadow-sm">
            <div className="card-header py-2 px-3 bg-light">
              <h5 className="card-title h6 mb-0">Quick Links</h5>
            </div>
            <div className="card-body">
              <ul className="small mb-0">
                <li><a href="/services/pre-marriage-orientation" className="text-decoration-none">Pre-Marriage Orientation (PMOC)</a></li>
                <li><a href="/services/usapan-series" className="text-decoration-none">Usapan Series</a></li>
                <li><a href="/services/rpfp" className="text-decoration-none">Responsible Parenthood &amp; Family Development (RPFP)</a></li>
                <li><a href="/services/ahdp" className="text-decoration-none">Adolescent Health and Development Program (AHDP)</a></li>
                <li><a href="/services/iec" className="text-decoration-none">Population Awareness &amp; IEC Activities</a></li>
                <li><a href="/services/population-profiling" className="text-decoration-none">Demographic Data Collection &amp; Population Profiling</a></li>
                <li><a href="/services/community-events" className="text-decoration-none">Support During Community Events</a></li>
                <li><a href="/services/other-assistance" className="text-decoration-none">Other Assistance</a></li>
              </ul>
            </div>
          </div>

          <div className="card shadow-sm">
            <div className="card-header py-2 px-3 bg-light">
              <h5 className="card-title h6 mb-0">Location Map</h5>
            </div>
            <div className="card-body">
              <div className="ratio ratio-4x3 rounded overflow-hidden">
                <iframe
                  title="San Fabian Population Office Location"
                  src="https://www.google.com/maps?q=16.120723263859666,120.40280245009167&z=15&output=embed"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </Stack>
      )}
      
      <Modal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setSelectedEventId(null);
          setSelectedDate(null);
        }}
        title={
          <Text fw={700} size="lg">
            {selectedDate ? `Events for ${dayjs(selectedDate).format('MMMM D, YYYY')}` : 'Event Details'}
          </Text>
        }
        centered
        size="md"
        radius="md"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <Stack gap="md">
          {selectedDate && !selectedEvent && selectedEvents.length > 1 ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">Multiple activities scheduled for this day:</Text>
              {selectedEvents.map((ev) => (
                <Button
                  key={ev.id}
                  variant="light"
                  color={getEventColor(ev)}
                  fullWidth
                  justify="flex-start"
                  onClick={() => setSelectedEventId(ev.id)}
                  leftSection={<IconInfoCircle size={16} />}
                >
                  {ev.title || ev.type}
                </Button>
              ))}
            </Stack>
          ) : (
            (() => {
              const ev = selectedEvent || (selectedEvents.length === 1 ? selectedEvents[0] : selectedEventForList);
              if (!ev) return <Text size="sm" c="dimmed" ta="center">No details found.</Text>;

              const status = getEventStatus(ev);
              const color = getEventColor(ev);
              const start = dayjs(ev.startDate);
              const rawEnd = ev.endDate ? dayjs(ev.endDate) : null;
              const end = !rawEnd || rawEnd.isSame(start) ? start.add(1, 'hour') : rawEnd;
              const typeUpper = String(ev.type || '').toUpperCase();
              const isUsapanSeries = typeUpper === 'USAPAN-SERIES';
              const isPmo = typeUpper === 'PRE-MARRIAGE ORIENTATION';
              const canBookPmo = isPmo && status !== 'FINISHED';

              return (
                <Stack gap="lg">
                  <Box>
                    {selectedEvents.length > 1 && (
                      <Button
                        variant="subtle"
                        size="compact-xs"
                        leftSection={<IconChevronLeft size={14} />}
                        onClick={() => setSelectedEventId(null)}
                        mb="xs"
                      >
                        Back to list
                      </Button>
                    )}
                    <Group justify="space-between" align="flex-start">
                      <Title order={3} style={{ lineHeight: 1.2 }}>
                        {ev.type}
                      </Title>
                      <Badge size="lg" variant="filled" color={color} radius="sm">
                        {status}
                      </Badge>
                    </Group>
                  </Box>

                  <Divider />

                  <Stack gap="sm">
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <ThemeIcon variant="light" color="gray" size="md" radius="md">
                        <IconCalendar size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text size="xs" c="dimmed" fw={500}>DATE</Text>
                        <Text size="sm" fw={600}>
                          {start.format('MMMM D, YYYY')}
                          {end && !end.isSame(start, 'day') ? ` — ${end.format('MMMM D, YYYY')}` : ''}
                        </Text>
                      </Box>
                    </Group>

                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <ThemeIcon variant="light" color="gray" size="md" radius="md">
                        <IconClock size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text size="xs" c="dimmed" fw={500}>TIME</Text>
                        <Text size="sm" fw={600}>
                          {isUsapanSeries
                            ? start.format('h:mm A')
                            : start.format('h:mm A')}
                        </Text>
                      </Box>
                    </Group>

                    {ev.location && (
                      <Group wrap="nowrap" align="flex-start" gap="sm">
                        <ThemeIcon variant="light" color="red" size="md" radius="md">
                          <IconMapPin size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xs" c="dimmed" fw={500}>LOCATION</Text>
                          <Text size="sm" fw={600}>{ev.location}</Text>
                        </Box>
                      </Group>
                    )}

                    {ev.counselor && (
                      <Group wrap="nowrap" align="flex-start" gap="sm">
                        <ThemeIcon variant="light" color="blue" size="md" radius="md">
                          <IconUser size={18} />
                        </ThemeIcon>
                        <Box>
                          <Text size="xs" c="dimmed" fw={500}>ASSIGNED COUNSELOR</Text>
                          <Text size="sm" fw={600}>{ev.counselor}</Text>
                        </Box>
                      </Group>
                    )}
                  </Stack>

                  <Box p="sm" style={{ backgroundColor: theme.colors.gray[0], borderRadius: theme.radius.md }}>
                    <Text size="xs" fw={700} c="dimmed" mb={4}>DESCRIPTION</Text>
                    {ev.description && (
                      <Text size="sm" mb={ev.details ? 4 : 0}>{ev.description}</Text>
                    )}
                    {ev.details && (
                      <Text size="sm">{ev.details}</Text>
                    )}
                    {!ev.description && !ev.details && (
                      <Text size="sm" align="justify">
                        {(() => {
                          const t = typeUpper;
                          if (t === 'USAPAN-SERIES') {
                            return 'A family planning demand-generation program developed by the Commission on Population and Development in the Philippines. It uses conversational, participatory methods (like group discussions and one-on-one counseling) to link reproductive health information with actual service delivery, including access to contraception and referrals.';
                          }
                          if (t === 'PRE-MARRIAGE ORIENTATION') {
                            return 'Pre-Marriage Orientation (PMO) is a mandatory half-day to full-day program for couples applying for a marriage license in the Philippines. It is designed to provide a realistic overview of marriage by covering essential topics such as the concept of marriage, husband-wife relationships, parent-child dynamics, family and home management, fertility awareness, and responsible parenthood.';
                          }
                          return '-';
                        })()}
                      </Text>
                    )}
                  </Box>

                  {isPmo && (
                    <Group justify="flex-end" mt="sm">
                      <Button
                        component="a"
                        href={canBookPmo ? '/services?book=pmo' : undefined}
                        target="_self"
                        disabled={!canBookPmo}
                      >
                        Book An Appointment
                      </Button>
                    </Group>
                  )}

                  {/* Admin Controls removed for public calendar view */}
                </Stack>
              );
            })()
          )}
        </Stack>
      </Modal>

      <Modal
        opened={sidebarPickerOpened}
        onClose={() => setSidebarPickerOpened(false)}
        withCloseButton={false}
        centered
        size="lg"
        radius="lg"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      >
        <Stack gap="sm">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => setSidebarMonth(dayjs(sidebarMonth).subtract(1, 'month').toDate())}
              >
                &lt;
              </Button>
              <Text fw={600}>{dayjs(sidebarMonth).format('MMMM YYYY')}</Text>
              <Button
                variant="subtle"
                size="compact-sm"
                onClick={() => setSidebarMonth(dayjs(sidebarMonth).add(1, 'month').toDate())}
              >
                &gt;
              </Button>
            </div>

            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label="Close popup calendar"
              onClick={() => setSidebarPickerOpened(false)}
            >
              <IconX size={16} />
            </ActionIcon>
          </div>

          <div className="text-center small text-muted mb-1">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                <div key={label}>{label}</div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
            {gridDays.map((date) => {
              const d = dayjs(date);
              const isCurrentMonth = d.isSame(dayjs(sidebarMonth), 'month');
              const isSelected = sidebarPopupDate && d.isSame(dayjs(sidebarPopupDate), 'day');
              const isHovered = sidebarHoverDate && d.isSame(dayjs(sidebarHoverDate), 'day');
              const key = toDayKey(date);
              const dayEvents = eventsByDate[key] || [];
              const hasEvents = dayEvents.length > 0;
              const dayColor = hasEvents ? getDayColor({ date, events: dayEvents, now: new Date() }) : null;
              const uniqueTypes = hasEvents
                ? Array.from(new Set(dayEvents.map((ev) => getEventTypeNormalized(ev))))
                : [];
              const hasMultipleTypes = uniqueTypes.length > 1;

              const tileClasses = ['w-100', 'rounded-3', 'text-center', 'py-2'];
              let bg = '#f8f9fa';
              let color = '#212529';

              if (!isCurrentMonth) {
                // For days outside the active month, render an empty, non-interactive cell
                return (
                  <div key={key} style={{ minWidth: 0 }}>
                    <div className={tileClasses.join(' ')} style={{ background: '#f8f9fa', color: '#adb5bd' }} />
                  </div>
                );
              }
              // Base event color backgrounds
              const eventBg =
                dayColor === 'grape'
                  ? '#f4e5ff'
                  : dayColor === 'orange'
                    ? '#ffe5d0'
                    : dayColor === 'yellow'
                      ? '#fff4cc'
                      : '#f8f9fa';

              if (hasEvents) {
                // If this day has multiple different event types, use a soft gradient background
                // matching the legend (purple -> yellow -> orange). Otherwise, use the
                // single-type tinted background.
                bg = hasMultipleTypes
                  ? 'linear-gradient(135deg, rgba(111, 66, 193, 0.225), rgba(255, 193, 7, 0.225), rgba(253, 126, 20, 0.225))'
                  : eventBg;
              }

              if (isSelected) {
                bg = '#2051d8ff';
                color = '#ffffff';
              }

              return (
                <div key={key} style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    className="border-0 p-0 bg-transparent w-100"
                    onClick={() => {
                      setSidebarPopupDate(date);
                      setSidebarHoverDate(null);
                    }}
                    onMouseEnter={() => setSidebarHoverDate(date)}
                    onMouseLeave={() => setSidebarHoverDate(null)}
                  >
                    <div
                      className={tileClasses.join(' ')}
                      style={{
                        background: bg,
                        color,
                        boxShadow: isSelected
                          ? '0 4px 12px rgba(0,0,0,0.18)'
                          : isHovered
                            ? '0 2px 8px rgba(0,0,0,0.12)'
                            : 'none',
                        transform: isHovered && !isSelected ? 'translateY(-1px)' : 'none',
                        transition: 'box-shadow 120ms ease, transform 120ms ease',
                      }}
                    >
                      <div className="fw-semibold small">{d.date()}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <Divider my="xs" />

          {sidebarPopupDate && sidebarEvents.length > 1 && (
            <Group justify="flex-start" gap="xs" mb={4}>
              <Box
                style={{
                  width: 32,
                  height: 12,
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, rgba(111, 66, 193, 0.5), rgba(255, 193, 7, 0.5), rgba(253, 126, 20, 0.5))',
                }}
              />
              <Text size="xs" c="dimmed">
                Multiple event types on this date
              </Text>
            </Group>
          )}

          <Box style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
            {sidebarPopupDate && sidebarEvents.length > 0 ? (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Showing all {sidebarEvents.length} event
                  {sidebarEvents.length > 1 ? 's' : ''} for{' '}
                  {dayjs(sidebarPopupDate).format('MMMM D, YYYY')}
                </Text>
                {sidebarEvents.map((ev) => {
                  const typeColor = getEventColor(ev);
                  const start = dayjs(ev.startDate);
                  const end = ev.endDate ? dayjs(ev.endDate) : null;
                  const isUsapanSeries = String(ev.type || '').toUpperCase() === 'USAPAN-SERIES';
                  const timeLabel = isUsapanSeries
                    ? start.format('h:mm A')
                    : (!end
                        ? start.format('h:mm A')
                        : `${start.format('h:mm A')} - ${end.format('h:mm A')}`);
                  const location = ev.location || ev.barangay || '—';

                  const isHovered = sidebarHoverEventId === ev.id;

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className="border-0 bg-transparent w-100 text-start p-0"
                      onClick={() => {
                        setSidebarPickerOpened(false);
                        handleEventClick(ev);
                      }}
                      onMouseEnter={() => setSidebarHoverEventId(ev.id)}
                      onMouseLeave={() => setSidebarHoverEventId(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Box
                        style={{
                          borderRadius: 10,
                          padding: 10,
                          border: `1px solid ${theme.colors.gray[3]}`,
                          backgroundColor: isHovered ? theme.colors.gray[0] : theme.white,
                          boxShadow: isHovered ? '0 3px 10px rgba(0,0,0,0.12)' : 'none',
                          transition: 'background-color 120ms ease, box-shadow 120ms ease',
                        }}
                      >
                        <Text fw={600} size="sm" mb={4}>
                          {ev.title || ev.type}
                        </Text>
                        <Group justify="space-between" gap="xs" align="center">
                          <Group gap={6} align="center">
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor:
                                  theme.colors[typeColor]?.[6] || theme.colors.blue[6],
                              }}
                            />
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {location}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {timeLabel}
                          </Text>
                        </Group>
                      </Box>
                    </button>
                  );
                })}
              </Stack>
            ) : (
              <Center py="md">
                <Text size="sm" c="dimmed">
                  {sidebarPopupDate
                    ? 'No events scheduled for this date.'
                    : 'Pick a date to see its events.'}
                </Text>
              </Center>
            )}
          </Box>
        </Stack>
      </Modal>

      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        withCloseButton={false}
        centered
        size="xl"
      >
        <form
          onSubmit={editForm.onSubmit(async (values) => {
            if (!selectedEventId) return;
            if (!values.date) return;

            const today = dayjs();
            const dateStr = dayjs(values.date).format('YYYY-MM-DD');
            const startTime = to24hTime(values.startHour, values.startMinute, values.startMeridiem);
            const endTime = values.type === 'Usapan-Series'
              ? null
              : to24hTime(values.endHour, values.endMinute, values.endMeridiem);

            const startDateTime = dayjs(`${dateStr}T${startTime}`);
            if (startDateTime.isBefore(today)) {
              editForm.setFieldError('date', 'Past dates and times cannot be selected.');
              showNotification({ title: 'Invalid schedule', message: 'Past dates and times cannot be selected.', color: 'red' });
              return;
            }

            if (values.type !== 'Usapan-Series' && compareTimes24(startTime, endTime) <= 0) {
              editForm.setFieldError('endHour', 'End time must be after start time');
              return;
            }

            const payload = {
              type: values.type,
              date: dayjs(values.date).format('YYYY-MM-DD'),
              startTime,
              endTime,
              counselorID: values.type === 'Pre-Marriage Orientation' ? values.counselorID : null,
              lead: null,
              barangay: values.type === 'Usapan-Series' ? values.barangay : null,
              location: values.type === 'Pre-Marriage Orientation' ? (values.location || null) : null,
              status: values.status
            };

            try {
              await updateCalendarEvent(selectedEventId, payload);
              showNotification({ title: 'Saved', message: 'Event updated successfully', color: 'green' });
              setEditModalOpened(false);
              await fetchEvents(month);
            } catch (err) {
              console.error(err);
              const msg = err?.response?.data?.error?.message || 'Failed to update event';
              showNotification({ title: 'Error', message: msg, color: 'red' });
            }
          })}
        >
          <div className="row g-0 align-items-stretch">
            <div
              className="col-md-5 d-none d-md-block bg-light"
              style={{ borderRight: '1px solid #e5e7eb' }}
            >
              <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
                <div className="mb-3 small text-muted">Schedule Preview</div>
                <Stack gap="xs">
                  <Text fw={600}>
                    {editForm.values.date ? dayjs(editForm.values.date).format('MMMM D, YYYY') : ''}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Type: {editForm.values.type}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Time: {editForm.values.startHour}:{editForm.values.startMinute} {editForm.values.startMeridiem}
                    {editForm.values.type !== 'Usapan-Series' && editForm.values.endHour && editForm.values.endMinute
                      ? ` - ${editForm.values.endHour}:${editForm.values.endMinute} ${editForm.values.endMeridiem}`
                      : ''}
                  </Text>
                  <Badge mt="sm" variant="filled">{editForm.values.status}</Badge>
                </Stack>
              </div>
            </div>

            <div className="col-12 col-md-7 p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div className="text-uppercase small text-muted mb-1">Calendar Schedule</div>
                  <h2 className="h5 mb-0">Edit Schedule</h2>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setEditModalOpened(false)}
                />
              </div>

              <Stack>
                {editForm.values.type === 'Usapan-Series' ? (
                  <Select
                    label="Barangay"
                    placeholder="Select barangay"
                    data={SAN_FABIAN_BARANGAYS.map((b) => ({ value: b, label: b }))}
                    value={editForm.values.barangay || null}
                    onChange={(v) => editForm.setFieldValue('barangay', v || '')}
                    searchable
                    nothingFoundMessage="No barangays"
                    error={editForm.errors.barangay}
                  />
                ) : (
                  <TextInput
                    label="Title"
                    placeholder={editForm.values.type === 'Pre-Marriage Orientation' ? 'Automatically set to empty' : ''}
                    disabled={editForm.values.type === 'Pre-Marriage Orientation'}
                    {...editForm.getInputProps('title')}
                  />
                )}
                <Select
                  label="Type"
                  data={[
                    { value: 'Pre-Marriage Orientation', label: 'Pre-Marriage Orientation' },
                    { value: 'Usapan-Series', label: 'Usapan-Series' },
                  ]}
                  value={editForm.values.type}
                  disabled
                />
                <DatePickerInput
                  label="Date"
                  required
                  value={editForm.values.date}
                  onChange={(value) => editForm.setFieldValue('date', value)}
                  firstDayOfWeek={0}
                />

                <SimpleGrid cols={3} spacing="sm">
                  <Select label="Start" data={HOURS_12} value={editForm.values.startHour} onChange={(v) => editForm.setFieldValue('startHour', v)} />
                  <Select label=" " data={MINUTES_COMMON} value={editForm.values.startMinute} onChange={(v) => editForm.setFieldValue('startMinute', v)} />
                  <Select label=" " data={MERIDIEMS} value={editForm.values.startMeridiem} onChange={(v) => editForm.setFieldValue('startMeridiem', v)} />
                </SimpleGrid>

                {editForm.values.type !== 'Usapan-Series' ? (
                  <SimpleGrid cols={3} spacing="sm">
                    <Select label="End Time" data={HOURS_12} value={editForm.values.endHour} onChange={(v) => editForm.setFieldValue('endHour', v)} />
                    <Select label=" " data={MINUTES_COMMON} value={editForm.values.endMinute} onChange={(v) => editForm.setFieldValue('endMinute', v)} />
                    <Select label=" " data={MERIDIEMS} value={editForm.values.endMeridiem} onChange={(v) => editForm.setFieldValue('endMeridiem', v)} onChangeCapture={() => {}} />
                  </SimpleGrid>
                ) : null}

                {editForm.values.type === 'Pre-Marriage Orientation' ? (
                  <Select
                    label="Counselor"
                    required
                    data={(activeCounselors || []).map((c) => ({ value: String(c.id), label: c.name }))}
                    value={editForm.values.counselorID ? String(editForm.values.counselorID) : null}
                    onChange={(v) => editForm.setFieldValue('counselorID', v ? Number(v) : null)}
                    searchable
                    nothingFoundMessage="No counselors"
                  />
                ) : null}
                {editForm.values.type === 'Pre-Marriage Orientation' ? (
                  <TextInput
                    label="Location"
                    placeholder="Enter specific venue or room"
                    {...editForm.getInputProps('location')}
                  />
                ) : null}

                <Select
                  label="Status"
                  data={[
                    { value: 'Scheduled', label: 'Scheduled' },
                    { value: 'Ongoing', label: 'Ongoing' },
                    { value: 'Finished', label: 'Finished' },
                    { value: 'Cancelled', label: 'Cancelled' }
                  ]}
                  value={editForm.values.status}
                  disabled
                />

                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button variant="default" type="button" onClick={() => setEditModalOpened(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </Stack>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        opened={addModalOpened}
        onClose={() => setAddModalOpened(false)}
        withCloseButton={false}
        centered
        size="xl"
      >
        <form
          onSubmit={addForm.onSubmit(async (values) => {
            if (!values.date) return;

            const normalizedStatus = values.status === 'Upcoming' ? 'Scheduled' : values.status;
            const today = dayjs();
            const dateStr = dayjs(values.date).format('YYYY-MM-DD');
            const startTime = to24hTime(values.startHour, values.startMinute, values.startMeridiem);
            const endTime = values.type === 'Usapan-Series'
              ? null
              : to24hTime(values.endHour, values.endMinute, values.endMeridiem);

            const startDateTime = dayjs(`${dateStr}T${startTime}`);
            if (startDateTime.isBefore(today)) {
              addForm.setFieldError('date', 'Past dates and times cannot be selected.');
              showNotification({ title: 'Invalid schedule', message: 'Past dates and times cannot be selected.', color: 'red' });
              return;
            }

            // For Usapan-Series, end time is required (backend will reject if missing)
            if (values.type === 'Usapan-Series' && !endTime) {
              addForm.setFieldError('endHour', 'End time is required for Usapan-Series.');
              showNotification({ title: 'Invalid schedule', message: 'End time is required for Usapan-Series.', color: 'red' });
              return;
            }

            if (values.type !== 'Usapan-Series' && compareTimes24(startTime, endTime) <= 0) {
              addForm.setFieldError('endHour', 'End time must be after start time');
              return;
            }

            try {
              if (values.type === 'Event/Activity') {
                // Create via Announcements endpoint using announcements schema
                let annPayload = {
                  title: values.title,
                  description: values.description,
                  date: dayjs(values.date).format('YYYY-MM-DD'),
                  location: values.location,
                  status: normalizedStatus,
                  lead: values.lead,
                  startTime: startTime,
                  endTime: endTime,
                };
                annPayload = Object.fromEntries(
                  Object.entries(annPayload).filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''))
                );
                await createAnnouncement(annPayload);
                showNotification({ title: 'Saved', message: 'Event/Activity created in Announcements', color: 'green' });
              } else {
                // Build payload for calendar endpoint
                let payload = {
                  type: values.type,
                  date: dayjs(values.date).format('YYYY-MM-DD'),
                  startTime,
                  endTime,
                  status: normalizedStatus,
                  description: values.description || null
                };
                if (values.type === 'Pre-Marriage Orientation') {
                  payload.counselorID = values.counselorID;
                  if (values.location) payload.location = values.location;
                } else if (values.type === 'Usapan-Series') {
                  if (values.barangay) payload.barangay = values.barangay;
                }
                payload = Object.fromEntries(
                  Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''))
                );
                await createCalendarEvent(payload);
                showNotification({ title: 'Saved', message: 'Schedule created successfully', color: 'green' });
              }
              setAddModalOpened(false);
              addForm.reset();
              await fetchEvents(month);
            } catch (err) {
              const raw = err?.response?.data;
              let serverMsg = raw?.message ?? raw?.error ?? err?.message ?? 'Failed to create schedule';
              if (typeof serverMsg !== 'string') {
                try {
                  serverMsg = JSON.stringify(serverMsg);
                } catch (_) {
                  serverMsg = String(serverMsg);
                }
              }
              console.error('Create schedule failed:', serverMsg, raw);
              showNotification({ title: 'Error', message: serverMsg, color: 'red' });
            }
          })}
        >
          <div className="row g-0 align-items-stretch">
            <div
              className="col-md-4 d-none d-md-block bg-light"
              style={{ borderRight: '1px solid #e5e7eb' }}
            >
              <div className="h-100 w-100 p-4 d-flex flex-column justify-content-center" align="left">
                <div className="mb-3 small text-muted">Schedule Preview</div>
                <Stack gap="xs">
                  <Text fw={600}>
                    {addForm.values.date ? dayjs(addForm.values.date).format('MMMM D, YYYY') : ''}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Type: {addForm.values.type}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Time: {addForm.values.startHour}:{addForm.values.startMinute} {addForm.values.startMeridiem}
                    {addForm.values.endHour && addForm.values.endMinute
                      ? ` - ${addForm.values.endHour}:${addForm.values.endMinute} ${addForm.values.endMeridiem}`
                      : ''}
                  </Text>
                  <Badge mt="sm" variant="filled">{addForm.values.status}</Badge>
                </Stack>
              </div>
            </div>

            <div className="col-12 col-md-8 p-4">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div className="text-uppercase small text-muted mb-1">Calendar Schedule</div>
                  <h2 className="h5 mb-0">Add Schedule</h2>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setAddModalOpened(false)}
                />
              </div>

              <Stack>
                <Select
                  label="Type"
                  data={[
                    { value: 'Pre-Marriage Orientation', label: 'Pre-Marriage Orientation' },
                    { value: 'Usapan-Series', label: 'Usapan-Series' },
                    { value: 'Event/Activity', label: 'Event/Activity' },
                  ]}
                  value={addForm.values.type}
                  onChange={(v) => addForm.setFieldValue('type', v)}
                />
                {addForm.values.type === 'Usapan-Series' && (
                  <Select
                    label="Barangay"
                    placeholder="Select barangay"
                    data={SAN_FABIAN_BARANGAYS.map((b) => ({ value: b, label: b }))}
                    value={addForm.values.barangay || null}
                    onChange={(v) => addForm.setFieldValue('barangay', v || '')}
                    searchable
                    nothingFoundMessage="No barangays"
                    error={addForm.errors.barangay}
                  />
                )}
                {addForm.values.type === 'Pre-Marriage Orientation' && (
                  <>
                    <TextInput
                      label="Title"
                      placeholder="Automatically set to empty"
                      disabled
                      {...addForm.getInputProps('title')}
                    />
                    <TextInput
                      label="Location"
                      placeholder="Enter specific venue or room"
                      {...addForm.getInputProps('location')}
                    />
                  </>
                )}
                {addForm.values.type === 'Event/Activity' && (
                  <>
                    <TextInput
                      label="Title"
                      placeholder="Enter title"
                      required
                      {...addForm.getInputProps('title')}
                      error={addForm.errors.title}
                    />
                    <Textarea
                      label="Description"
                      placeholder="Enter description"
                      autosize
                      minRows={2}
                      {...addForm.getInputProps('description')}
                    />
                    <TextInput
                      label="Location"
                      placeholder="Enter location"
                      {...addForm.getInputProps('location')}
                    />
                    <TextInput
                      label="Lead"
                      placeholder="Enter lead person/office"
                      {...addForm.getInputProps('lead')}
                    />
                  </>
                )}
                <DatePickerInput
                  label="Date"
                  placeholder="Select date"
                  value={addForm.values.date}
                  onChange={(value) => addForm.setFieldValue('date', value)}
                  firstDayOfWeek={0}
                  error={addForm.errors.date}
                  minDate={new Date()}
                />

                <Stack gap={10}>
                  <Stack gap={6}>
                    <Text size="sm" fw={500}>Start time</Text>
                    <Group gap={6} wrap="nowrap">
                      <Select w={110} data={HOURS_12} value={addForm.values.startHour} onChange={(v)=>addForm.setFieldValue('startHour', v)} />
                      <Text>:</Text>
                      <Select w={110} data={MINUTES_COMMON} value={addForm.values.startMinute} onChange={(v)=>addForm.setFieldValue('startMinute', v)} />
                      <Select w={110} data={MERIDIEMS} value={addForm.values.startMeridiem} onChange={(v)=>addForm.setFieldValue('startMeridiem', v)} />
                    </Group>
                  </Stack>
                  <Stack gap={6}>
                    <Text size="sm" fw={500}>End time</Text>
                    <Group gap={6} wrap="nowrap">
                      <Select w={110} data={HOURS_12} value={addForm.values.endHour} onChange={(v)=>addForm.setFieldValue('endHour', v)} />
                      <Text>:</Text>
                      <Select w={110} data={MINUTES_COMMON} value={addForm.values.endMinute} onChange={(v)=>addForm.setFieldValue('endMinute', v)} />
                      <Select w={110} data={MERIDIEMS} value={addForm.values.endMeridiem} onChange={(v)=>addForm.setFieldValue('endMeridiem', v)} />
                    </Group>
                    {addForm.errors.endHour && (<Text size="xs" c="red">{addForm.errors.endHour}</Text>)}
                  </Stack>
                </Stack>

                {addForm.values.type === 'Pre-Marriage Orientation' ? (
                  <Select
                    label="Counselor"
                    placeholder="Select counselor"
                    required
                    data={(activeCounselors || []).map((c) => ({ value: String(c.id), label: c.name }))}
                    value={addForm.values.counselorID ? String(addForm.values.counselorID) : null}
                    onChange={(v) => addForm.setFieldValue('counselorID', v ? Number(v) : null)}
                    error={addForm.errors.counselorID}
                  />
                ) : null}
                <Select
                  label="Status"
                  data={['Scheduled', 'Ongoing', 'Finished', 'Cancelled']}
                  value={addForm.values.status}
                  disabled
                />
                <div className="d-flex justify-content-end gap-2 pt-2 mt-1 border-top">
                  <Button variant="default" type="button" onClick={() => setAddModalOpened(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Submit</Button>
                </div>
              </Stack>
            </div>
          </div>
        </form>
      </Modal>

      <DeleteConfirmModal
        opened={deleteEventId != null}
        onCancel={() => { if (!deleteLoading) setDeleteEventId(null); }}
        onConfirm={async () => {
          if (!deleteEventId) return;
          setDeleteLoading(true);
          try {
            await deleteCalendarEvent(deleteEventId);
            showNotification({ title: 'Deleted', message: 'Event deleted', color: 'green' });
            setDeleteEventId(null);
            setModalOpened(false);
            await fetchEvents(month);
          } catch (err) {
            const msg = err?.response?.data?.error?.message || 'Failed to delete event';
            showNotification({ title: 'Error', message: msg, color: 'red' });
          } finally {
            setDeleteLoading(false);
          }
        }}
        confirmLabel="Delete event"
        message="This action cannot be undone. The selected event will be removed from the calendar."
        loading={deleteLoading}
      />

      <DeleteConfirmModal
        opened={cancelEventId != null}
        onCancel={() => { if (!cancelLoading) setCancelEventId(null); }}
        onConfirm={async () => {
          if (!cancelEventId) return;
          setCancelLoading(true);
          try {
            await cancelCalendarEvent(cancelEventId);
            await fetchEvents(month);
            setCancelEventId(null);
            showNotification({ title: 'Cancelled', message: 'Event marked as cancelled.', color: 'yellow' });
          } catch (err) {
            const msg = err?.response?.data?.error?.message || 'Failed to cancel event';
            showNotification({ title: 'Error', message: msg, color: 'red' });
          } finally {
            setCancelLoading(false);
          }
        }}
        confirmLabel="Cancel event"
        message="Are you sure you want to cancel this schedule? Existing bookings may be affected."
        loading={cancelLoading}
      />
    </Stack>
  );
}

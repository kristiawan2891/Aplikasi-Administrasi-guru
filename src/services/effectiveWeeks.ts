import type { CalendarConfig, CalendarEvent, SemesterNumber } from '../types/domain';

export interface MonthEffectiveSummary {
  monthIndex: number; // 0..11
  year: number;
  monthLabel: string;
  semester: SemesterNumber;
  totalDays: number;
  totalWeeks: number;
  ineffectiveWeeks: number;
  effectiveWeeks: number;
  holidayDays: number;
  effectiveDays: number;
  hoursAllocation: number;
  notes: string[];
}

export interface SemesterEffectiveSummary {
  semester: SemesterNumber;
  totalCalendarDays: number;
  holidayAndWeekendDays: number;
  effectiveDays: number;
  totalWeeks: number;
  ineffectiveWeeks: number;
  effectiveWeeks: number;
  totalHoursAvailable: number; // JP
  months: MonthEffectiveSummary[];
}

export interface FullEffectiveSummary {
  semester1: SemesterEffectiveSummary;
  semester2: SemesterEffectiveSummary;
  totalCalendarDays: number;
  totalHolidayDays: number;
  totalEffectiveDays: number;
  totalEffectiveWeeks: number;
  totalHoursAvailable: number;
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeSemesterSummary(
  semester: SemesterNumber,
  startIso: string,
  endIso: string,
  config: CalendarConfig,
  events: CalendarEvent[]
): SemesterEffectiveSummary {
  const start = parseDate(startIso);
  const end = parseDate(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return {
      semester,
      totalCalendarDays: 0,
      holidayAndWeekendDays: 0,
      effectiveDays: 0,
      totalWeeks: 0,
      ineffectiveWeeks: 0,
      effectiveWeeks: 0,
      totalHoursAvailable: 0,
      months: [],
    };
  }

  const holidayDateSet = new Set<string>();
  const nonTeachingDateSet = new Set<string>();
  const eventTitlesByDate = new Map<string, string[]>();

  for (const ev of events) {
    const evStart = parseDate(ev.startDate);
    const evEnd = parseDate(ev.endDate || ev.startDate);
    const cursor = new Date(evStart);
    while (cursor <= evEnd) {
      const iso = toIsoDate(cursor);
      if (ev.type === 'Libur Nasional' || ev.type === 'Libur Sekolah') {
        holidayDateSet.add(iso);
      } else if (
        ev.type === 'PTS/STS' ||
        ev.type === 'PAS/SAS' ||
        ev.type === 'Kegiatan Sekolah' ||
        ev.type === 'Projek' ||
        ev.type === 'Kegiatan Khusus'
      ) {
        nonTeachingDateSet.add(iso);
      }
      const list = eventTitlesByDate.get(iso) ?? [];
      if (!list.includes(ev.title)) list.push(ev.title);
      eventTitlesByDate.set(iso, list);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const monthMap = new Map<string, MonthEffectiveSummary>();
  let totalCalendarDays = 0;
  let holidayAndWeekendDays = 0;
  let effectiveDays = 0;

  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const iso = toIsoDate(cursor);
    const dow = cursor.getDay(); // 0 = Sun, 6 = Sat

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        monthIndex: m,
        year: y,
        monthLabel: `${MONTH_NAMES_ID[m]} ${y}`,
        semester,
        totalDays: 0,
        totalWeeks: 0,
        ineffectiveWeeks: 0,
        effectiveWeeks: 0,
        holidayDays: 0,
        effectiveDays: 0,
        hoursAllocation: 0,
        notes: [],
      });
    }

    const entry = monthMap.get(key)!;
    entry.totalDays += 1;
    totalCalendarDays += 1;

    const isWeekend =
      dow === 0 || (config.learningDaysPerWeek === 5 && dow === 6);
    const isHoliday = holidayDateSet.has(iso);
    const isNonTeaching = nonTeachingDateSet.has(iso);

    if (isWeekend || isHoliday) {
      holidayAndWeekendDays += 1;
      if (isHoliday && !isWeekend) {
        entry.holidayDays += 1;
      }
    } else if (isNonTeaching) {
      holidayAndWeekendDays += 1;
      entry.holidayDays += 1;
    } else {
      effectiveDays += 1;
      entry.effectiveDays += 1;
    }

    const titles = eventTitlesByDate.get(iso);
    if (titles) {
      for (const t of titles) {
        if (!entry.notes.includes(t)) entry.notes.push(t);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const months: MonthEffectiveSummary[] = [];
  let sumTotalWeeks = 0;
  let sumIneffectiveWeeks = 0;
  let sumEffectiveWeeks = 0;

  for (const entry of monthMap.values()) {
    const learningDays = config.learningDaysPerWeek;
    const approxTotalWeeks = Math.max(1, Math.round(entry.totalDays / 7));
    const effectiveWeeks = Math.min(
      approxTotalWeeks,
      Math.max(0, Math.round(entry.effectiveDays / learningDays))
    );
    const ineffectiveWeeks = Math.max(0, approxTotalWeeks - effectiveWeeks);

    entry.totalWeeks = approxTotalWeeks;
    entry.effectiveWeeks = effectiveWeeks;
    entry.ineffectiveWeeks = ineffectiveWeeks;
    entry.hoursAllocation = effectiveWeeks * config.hoursPerWeek;

    sumTotalWeeks += approxTotalWeeks;
    sumIneffectiveWeeks += ineffectiveWeeks;
    sumEffectiveWeeks += effectiveWeeks;
    months.push(entry);
  }

  return {
    semester,
    totalCalendarDays,
    holidayAndWeekendDays,
    effectiveDays,
    totalWeeks: sumTotalWeeks,
    ineffectiveWeeks: sumIneffectiveWeeks,
    effectiveWeeks: sumEffectiveWeeks,
    totalHoursAvailable: sumEffectiveWeeks * config.hoursPerWeek,
    months,
  };
}

export function calculateEffectiveWeeks(
  config: CalendarConfig,
  events: CalendarEvent[]
): FullEffectiveSummary {
  const s1Events = events.filter((e) => e.semester === 1);
  const s2Events = events.filter((e) => e.semester === 2);

  const semester1 = computeSemesterSummary(
    1,
    config.sem1StartDate,
    config.sem1EndDate,
    config,
    s1Events.length > 0 ? s1Events : events
  );
  const semester2 = computeSemesterSummary(
    2,
    config.sem2StartDate,
    config.sem2EndDate,
    config,
    s2Events.length > 0 ? s2Events : events
  );

  return {
    semester1,
    semester2,
    totalCalendarDays: semester1.totalCalendarDays + semester2.totalCalendarDays,
    totalHolidayDays:
      semester1.holidayAndWeekendDays + semester2.holidayAndWeekendDays,
    totalEffectiveDays: semester1.effectiveDays + semester2.effectiveDays,
    totalEffectiveWeeks: semester1.effectiveWeeks + semester2.effectiveWeeks,
    totalHoursAvailable:
      semester1.totalHoursAvailable + semester2.totalHoursAvailable,
  };
}

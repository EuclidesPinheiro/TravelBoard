// src/utils/dateUtils.ts
import { differenceInDays, parseISO, format, addDays, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';

export function getDaysBetween(start: string, end: string) {
  return differenceInDays(parseISO(end), parseISO(start));
}

export function getTimelineDays(startDate: string, endDate: string) {
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });
}

export function formatDate(date: Date | string, formatStr: string = 'dd/MM') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

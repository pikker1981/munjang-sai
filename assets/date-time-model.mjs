// Civil dates use UTC only for arithmetic, so browser time zones and DST cannot
// move a selected calendar day. Values sent to the form stay YYYY-MM-DD / HH:mm.
const pad = value => String(value).padStart(2, '0');
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) return 0;
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return day >= 1 && day <= daysInMonth(year, month) ? {year, month, day} : null;
}

export function formatDateValue(date) {
  if (!date || date.day < 1 || date.day > daysInMonth(date.year, date.month)) return '';
  return `${String(date.year).padStart(4, '0')}-${pad(date.month)}-${pad(date.day)}`;
}

function utcDate(date) {
  const result = new Date(0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function weekDay(date) {
  return utcDate(date).getUTCDay();
}

export function addCalendarDays(date, amount) {
  const result = utcDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  const next = {year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate()};
  return next.year >= 1 && next.year <= 9999 ? next : null;
}

export function addCalendarMonths(date, amount) {
  const index = (date.year - 1) * 12 + date.month - 1 + amount;
  if (index < 0 || index >= 9999 * 12) return null;
  const year = Math.floor(index / 12) + 1;
  const month = index % 12 + 1;
  return {year, month, day: Math.min(date.day, daysInMonth(year, month))};
}

export function calendarCells(date) {
  const first = {...date, day: 1};
  const offset = weekDay(first);
  return Array.from({length: 42}, (_, index) => addCalendarDays(first, index - offset));
}

export function seoulToday(now = new Date()) {
  // Seoul has no daylight-saving transition; the civil date is UTC +09:00.
  const local = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate()};
}

export function formatDateLabel(date, full = false) {
  if (!date) return '';
  return full
    ? `${date.year}년 ${date.month}월 ${date.day}일 ${weekdays[weekDay(date)]}요일`
    : `${date.year}. ${pad(date.month)}. ${pad(date.day)}. (${weekdays[weekDay(date)]})`;
}

export function parseTimeValue(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? '');
  return match ? {hour: Number(match[1]), minute: Number(match[2])} : null;
}

export function formatTimeValue(time) {
  return time && Number.isInteger(time.hour) && time.hour >= 0 && time.hour < 24
    && Number.isInteger(time.minute) && time.minute >= 0 && time.minute < 60
    ? `${pad(time.hour)}:${pad(time.minute)}` : '';
}

export function toTwelveHour(time) {
  return {period: time.hour >= 12 ? 'pm' : 'am', hour: time.hour % 12 || 12, minute: time.minute};
}

export function fromTwelveHour(time) {
  if (!time || !['am', 'pm'].includes(time.period) || !Number.isInteger(time.hour)
    || time.hour < 1 || time.hour > 12 || !Number.isInteger(time.minute) || time.minute < 0 || time.minute > 59) return null;
  return {hour: time.hour % 12 + (time.period === 'pm' ? 12 : 0), minute: time.minute};
}

export function formatTimeLabel(time) {
  if (!time) return '';
  const civil = toTwelveHour(time);
  return `${civil.period === 'am' ? '오전' : '오후'} ${civil.hour}:${pad(civil.minute)}`;
}

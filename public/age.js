export const ZONE = 'America/New_York';
export const BIRTH = Date.parse('2012-05-21T15:02:00-04:00');
const DAY = 86400000;
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
export function localParts(ms) {
  return Object.fromEntries(partsFormatter.formatToParts(ms)
    .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
const wallUTC = p => Date.UTC(p.year, p.month - 1, p.day, p.hour ?? 15, p.minute ?? 2, p.second ?? 0);
// Our calendar anchors are always at 15:02, outside DST gaps and folds.
export function localInstant(p) {
  const wall = wallUTC(p);
  let result = wall;
  for (let i = 0; i < 4; i++) {
    const difference = wall - wallUTC(localParts(result));
    if (difference === 0) return result;
    result += difference;
  }
  throw new RangeError('Could not resolve Maryland calendar time');
}
export function anniversary(year) {
  return localInstant({year, month: 5, day: 21, hour: 15, minute: 2, second: 0});
}
function monthAnchor(years, months) {
  const date = new Date(Date.UTC(2012 + years, 4 + months, 21));
  return {year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 21, hour: 15, minute: 2, second: 0};
}
function plusDays(p, days) {
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return {...p, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate()};
}
export function duration(seconds) {
  return {days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600),
    minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60};
}
export function birthdayCountdown(inputMs, age) {
  if (!Number.isFinite(inputMs) || inputMs < BIRTH || !Number.isInteger(age) || age < 1) {
    throw new RangeError('A valid timestamp and birthday age are required');
  }
  const now = Math.floor(inputMs / 1000) * 1000;
  const target = anniversary(2012 + age);
  const remainingSeconds = Math.max(0, (target - now) / 1000);
  return {age, target, remainingSeconds, remaining: duration(remainingSeconds)};
}
export function calculateAge(inputMs) {
  if (!Number.isFinite(inputMs) || inputMs < BIRTH) throw new RangeError('Timestamp must be on or after birth');
  const now = Math.floor(inputMs / 1000) * 1000;
  const local = localParts(now);
  let years = local.year - 2012;
  if (anniversary(2012 + years) > now) years--;
  let months = (local.year - (2012 + years)) * 12 + local.month - 5;
  if (localInstant(monthAnchor(years, months)) > now) months--;
  const base = monthAnchor(years, months);
  let days = Math.floor((Date.UTC(local.year, local.month - 1, local.day) - Date.UTC(base.year, base.month - 1, base.day)) / DAY);
  if (localInstant(plusDays(base, days)) > now) days--;
  const anchor = localInstant(plusDays(base, days));
  const remainder = (now - anchor) / 1000;
  const seconds = (now - BIRTH) / 1000;
  const yearStart = anniversary(2012 + years);
  const nextBirthday = anniversary(2013 + years);
  const yearElapsed = (now - yearStart) / 1000;
  const yearLength = (nextBirthday - yearStart) / 1000;
  return {
    now, years, months, days, hours: Math.floor(remainder / 3600),
    minutes: Math.floor(remainder % 3600 / 60), seconds: remainder % 60,
    calendarAnchor: anchor, totalSeconds: seconds, fullDays: Math.floor(seconds / 86400),
    fullHours: Math.floor(seconds / 3600), fullMinutes: Math.floor(seconds / 60),
    totalHours: seconds / 3600, totalMinutes: seconds / 60,
    decimalYears: years + yearElapsed / yearLength, yearElapsed, yearLength,
    yearProgress: yearElapsed / yearLength, nextBirthday,
    remainingSeconds: (nextBirthday - now) / 1000, remaining: duration((nextBirthday - now) / 1000)
  };
}
export function timestamp(ms) {
  const p = localParts(ms);
  const pad = n => String(n).padStart(2, '0');
  const zone = new Intl.DateTimeFormat('en-US', {timeZone: ZONE, timeZoneName: 'short'}).formatToParts(ms).find(p => p.type === 'timeZoneName').value;
  const offsetMinutes = (wallUTC(p) - Math.floor(ms / 1000) * 1000) / 60000;
  const offset = `${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${zone} (UTC${offset})`;
}

import {calculateAge, birthdayCountdown, timestamp, ZONE} from './age.js';
import {createCustomDashboard} from './custom-dashboard.js';
const $ = id => document.getElementById(id);
const number = n => n.toLocaleString('en-US');
const pad = n => String(n).padStart(2, '0');
const decimal = (n, digits) => n.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
let base = null, clockSource = '', frozen = null, current = null, syncing = false, lastSample = null, toastTimer;
let selectedBirthdayAge = null, birthdayOptionsStart = null;
const customDashboard = createCustomDashboard({now:()=>base===null?null:base+performance.now(),clock:()=>({source:clockSource,lastSample,syncing}),resync:()=>sync(3),notify:toast});
function set(id, value) { const el = $(id); if (el.textContent !== String(value)) el.textContent = value; }
function selectedBirthday(a) {
  return birthdayCountdown(a.now, selectedBirthdayAge ?? a.years + 1);
}
function updateBirthdayOptions(a) {
  const nextAge = a.years + 1;
  if (selectedBirthdayAge !== null && selectedBirthdayAge < nextAge) selectedBirthdayAge = null;
  if (birthdayOptionsStart !== nextAge) {
    const options = [];
    for (let age = nextAge; age <= Math.max(75, nextAge); age++) {
      const option = document.createElement('option');
      option.value = age === nextAge ? 'next' : String(age);
      option.textContent = String(age);
      options.push(option);
    }
    $('birthday-age').replaceChildren(...options);
    birthdayOptionsStart = nextAge;
  }
  const selectedValue = selectedBirthdayAge === null ? 'next' : String(selectedBirthdayAge);
  if ($('birthday-age').value !== selectedValue) $('birthday-age').value = selectedValue;
  $('birthday-age').disabled = false;
}
function render() {
  if (base === null) return;
  const a = calculateAge(frozen ?? base + performance.now());
  current = a;
  for (const key of ['years','months','days','hours','minutes','seconds']) set(key, pad(a[key]));
  set('timestamp', timestamp(a.now));
  $('timestamp').dateTime = new Date(a.now).toISOString();
  set('decimal', decimal(a.decimalYears, 9));
  set('decimal-exact', `Exact: ${a.years} + ${number(a.yearElapsed)} / ${number(a.yearLength)}`);
  set('total-days', number(a.fullDays));
  set('days-exact', `+ ${Math.floor(a.totalSeconds % 86400 / 3600)} h ${Math.floor(a.totalSeconds % 3600 / 60)} m ${a.totalSeconds % 60} s`);
  set('total-hours', decimal(a.totalHours, 3));
  set('hours-exact', `Exact: ${number(a.fullHours)} h + ${Math.floor(a.totalSeconds % 3600 / 60)} m ${a.totalSeconds % 60} s`);
  set('total-minutes', decimal(a.totalMinutes, 3));
  set('minutes-exact', `Exact: ${number(a.fullMinutes)} m + ${a.totalSeconds % 60} s`);
  set('total-seconds', number(a.totalSeconds));
  updateBirthdayOptions(a);
  const birthday = selectedBirthday(a);
  $('birthday-panel').classList.toggle('extended-countdown', birthday.remaining.days >= 1000);
  set('birthday-label', selectedBirthdayAge === null ? 'NEXT BIRTHDAY' : 'BIRTHDAY COUNTDOWN');
  set('birthday-date', `${new Intl.DateTimeFormat('en-US', {timeZone:ZONE, month:'long',day:'numeric',year:'numeric'}).format(birthday.target)} · 3:02:00 PM EDT`);
  for (const key of ['days','hours','minutes','seconds']) set('remaining-' + key, pad(birthday.remaining[key]));
  set('remaining-total', `${number(birthday.remainingSeconds)} seconds remaining`);
  set('year-progress', decimal(a.yearProgress * 100, 2) + '%');
  set('age-progress-label', `OF AGE ${a.years} COMPLETED`);
  $('orbit-progress').style.strokeDashoffset = String(615.752 * (1 - a.yearProgress));
  $('age-panel').setAttribute('aria-busy', 'false');
  $('freeze').disabled = false;
  $('copy').disabled = false;
  customDashboard.render();
}
function updateStatus() {
  const isFrozen = frozen !== null;
  $('mode-label').classList.toggle('frozen', isFrozen || clockSource === 'Device clock');
  $('mode-label').replaceChildren(Object.assign(document.createElement('span'), {className:'dot'}), document.createTextNode(isFrozen ? ' FROZEN' : clockSource === 'Device clock' ? ' DEVICE TIME' : ' LIVE'));
  if (lastSample) {
    const when = new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(lastSample.unixMs);
    set('sync-status', `${isFrozen ? 'Snapshot frozen · ' : ''}Server synced at ${when} · ±${Math.ceil(lastSample.rtt / 2)} ms transit estimate`);
    set('sync-detail', `Last sample: ${new Date(lastSample.unixMs).toISOString()}. Round trip: ${Math.ceil(lastSample.rtt)} ms. Transit estimate: ±${Math.ceil(lastSample.rtt / 2)} ms, excluding server-clock error and network asymmetry.`);
  } else set('sync-status', 'Device clock · server sync unavailable. Retry to verify time.');
}
async function sync(samples = 1) {
  if (syncing) return;
  syncing = true;
  $('resync').disabled = true;
  let best = null;
  try {
    for (let i = 0; i < samples; i++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const start = performance.now();
        const response = await fetch(`/api/time?sample=${Date.now()}-${i}`, {cache:'no-store',signal:controller.signal});
        if (!response.ok) throw new Error('Clock endpoint unavailable');
        const data = await response.json();
        const end = performance.now();
        if (!Number.isFinite(data.unixMs) || data.unixMs < 1337626920000) throw new Error('Invalid clock sample');
        const rtt = end - start;
        if (!best || rtt < best.rtt) {
          best = {unixMs:data.unixMs,rtt,base:data.unixMs - (start + end) / 2};
          base = best.base;
          clockSource = data.source;
          lastSample = best;
          render(); updateStatus();
        }
      } catch { /* Keep a successful sample when another probe fails. */ }
      finally { clearTimeout(timeout); }
    }
    if (!best) {
      if (base === null) {base = Date.now() - performance.now(); clockSource = 'Device clock';render();updateStatus();}
      else set('sync-status', `${frozen !== null ? 'Snapshot frozen · ' : ''}Resync failed · continuing from the last clock sample`);
    }
  } finally {syncing = false; $('resync').disabled = false;}
}
function toast(message) {
  set('toast', message); $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}
$('freeze').addEventListener('click', () => {
  if (!current) return;
  frozen = frozen === null ? current.now : null;
  $('freeze').replaceChildren(Object.assign(document.createElement('span'), {textContent:frozen === null ? 'Ⅱ' : '▷',ariaHidden:'true'}), document.createTextNode(frozen === null ? ' Freeze moment' : ' Resume live'));
  updateStatus();render();
  toast(frozen === null ? 'Live resumed' : 'Snapshot frozen');
});
$('resync').addEventListener('click', () => sync(3));
$('birthday-age').addEventListener('change', () => {
  selectedBirthdayAge = $('birthday-age').value === 'next' ? null : Number($('birthday-age').value);
  render();
});
$('copy').addEventListener('click', async () => {
  if (!current) return;
  const a = current;
  const text = `DATE FROM MY BIRTH\nTimestamp: ${timestamp(a.now)}\nUTC: ${new Date(a.now).toISOString()}\nBirth: 2012-05-21 15:02:00 EDT (2012-05-21T19:02:00Z)\n\nAge: ${a.years} years, ${a.months} months, ${a.days} days, ${a.hours} hours, ${a.minutes} minutes, ${a.seconds} seconds\nDecimal years: approximately ${a.decimalYears.toFixed(12)}\nExact year expression: ${a.years} + ${a.yearElapsed}/${a.yearLength}\nFull 24-hour days: ${a.fullDays}\nTotal hours: ${a.totalSeconds}/3600 (exact); ${a.fullHours} hours + ${Math.floor(a.totalSeconds % 3600 / 60)} minutes + ${a.totalSeconds % 60} seconds\nTotal minutes: ${a.totalSeconds}/60 (exact); ${a.fullMinutes} minutes + ${a.totalSeconds % 60} seconds\nTotal seconds: ${a.totalSeconds}\nNext birthday: ${timestamp(a.nextBirthday)}\nRemaining: ${a.remaining.days} days, ${a.remaining.hours} hours, ${a.remaining.minutes} minutes, ${a.remaining.seconds} seconds (${a.remainingSeconds} seconds)\n\nCalendar units use America/New_York. Totals use standard Unix time; leap seconds excluded. ${clockSource}.`;
  const birthday = selectedBirthday(a);
  const selectedText = selectedBirthdayAge === null ? '' : `\n\nSelected birthday: Age ${birthday.age}, ${timestamp(birthday.target)}\nSelected countdown: ${birthday.remaining.days} days, ${birthday.remaining.hours} hours, ${birthday.remaining.minutes} minutes, ${birthday.remaining.seconds} seconds (${birthday.remainingSeconds} seconds)`;
  try {await navigator.clipboard.writeText(text + selectedText);toast('Snapshot copied');}
  catch {toast('Clipboard unavailable. You can select and copy the numbers.');}
});
document.addEventListener('visibilitychange', () => {if (!document.hidden) sync(3);});
window.addEventListener('online', () => sync(3));
setInterval(render, 100);
setInterval(() => {if (!document.hidden) sync();}, 60000);
sync(3);

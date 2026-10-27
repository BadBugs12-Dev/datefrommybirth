const SECOND = 1000, DAY = 86400000;
const formatters = new Map();
function formatter(zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-US', {
    timeZone:zone, calendar:'gregory', numberingSystem:'latn', hourCycle:'h23',
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'
  }));
  return formatters.get(zone);
}
function utc(p) {
  const date = new Date(0);
  date.setUTCFullYear(p.year,p.month-1,p.day);
  date.setUTCHours(p.hour??0,p.minute??0,p.second??0,0);
  return date.getTime();
}
function parts(ms,zone) {
  return Object.fromEntries(formatter(zone).formatToParts(ms).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
const same = (a,b) => ['year','month','day','hour','minute','second'].every(k=>a[k]===b[k]);
function offsetsFor(wall,zone) {
  return [...new Set([-2,-1,0,1,2].map(day=>{
    const instant=wall+day*DAY;
    return utc(parts(instant,zone))-instant;
  }))];
}
function resolve(p,zone,{strict=false,later=false}={}) {
  const wall=utc(p), offsets=offsetsFor(wall,zone);
  const choices=offsets.map(offset=>wall-offset).filter(ms=>same(parts(ms,zone),p)).sort((a,b)=>a-b);
  if (choices.length) return {instant:later?choices.at(-1):choices[0],choices};
  if (strict) throw new RangeError('That local birth time did not occur because the clocks moved forward. Enter a valid birth time.');
  // Calendar anchors in a DST gap move forward by the gap (compatible disambiguation).
  return {instant:wall-Math.min(...offsets),choices:[]};
}
function monthDays(year,month) {
  const next=month===12?{year:year+1,month:1,day:1}:{year,month:month+1,day:1};
  return new Date(utc(next)-DAY).getUTCDate();
}
function shifted(p,months=0,days=0) {
  const index=p.year*12+p.month-1+months;
  const year=Math.floor(index/12),month=index%12+1;
  const date=new Date(utc({...p,year,month,day:Math.min(p.day,monthDays(year,month))+days}));
  return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:p.hour,minute:p.minute,second:p.second};
}
export function createBirthProfile({date,time='',zone='America/New_York',occurrence='earlier'}) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date??'');
  if (!match) throw new RangeError('Enter a valid birth date.');
  const [year,month,day]=match.slice(1).map(Number);
  if (year<1||month<1||month>12||day<1||day>monthDays(year,month)) throw new RangeError('Enter a valid birth date.');
  const clock=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time||'00:00:00');
  if (!clock) throw new RangeError('Enter a valid birth time.');
  const hour=Number(clock[1]),minute=Number(clock[2]),second=Number(clock[3]??0);
  if(hour>23||minute>59||second>59) throw new RangeError('Enter a valid birth time.');
  try {formatter(zone);} catch {throw new RangeError('Choose a valid birth time zone.');}
  const wall={year,month,day,hour,minute,second};
  const resolved=resolve(wall,zone,{strict:true,later:occurrence==='later'});
  return {birth:resolved.instant,wall,zone,choices:resolved.choices,timeAssumed:!time,date,time:time||'00:00:00'};
}
export function customAnniversary(profile,age) {
  if(!Number.isInteger(age)||age<0) throw new RangeError('Birthday age must be a nonnegative integer.');
  if(age===0) return profile.birth;
  const p=profile.wall,year=p.year+age;
  return resolve({...p,year,day:Math.min(p.day,monthDays(year,p.month))},profile.zone).instant;
}
export function customDuration(seconds) {
  return {days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
export function customBirthdayCountdown(now,profile,age) {
  const target=customAnniversary(profile,age);
  const remainingSeconds=Math.max(0,(target-Math.floor(now/SECOND)*SECOND)/SECOND);
  return {age,target,remainingSeconds,remaining:customDuration(remainingSeconds)};
}
export function calculateCustomAge(inputMs,profile) {
  if(!Number.isFinite(inputMs)||inputMs<profile.birth) throw new RangeError('Birth date and time must be in the past or present.');
  const now=Math.floor(inputMs/SECOND)*SECOND,local=parts(now,profile.zone);
  let years=local.year-profile.wall.year;
  if(customAnniversary(profile,years)>now) years--;
  const yearStart=customAnniversary(profile,years),yearParts=parts(yearStart,profile.zone);
  let months=(local.year-yearParts.year)*12+local.month-yearParts.month;
  const monthAt=n=>n===0?yearStart:resolve(shifted(yearParts,n),profile.zone).instant;
  if(monthAt(months)>now) months--;
  const monthStart=monthAt(months),base=parts(monthStart,profile.zone);
  let days=Math.floor((utc({...local,hour:0,minute:0,second:0})-utc({...base,hour:0,minute:0,second:0}))/DAY);
  const dayAt=n=>n===0?monthStart:resolve(shifted(base,0,n),profile.zone).instant;
  while(dayAt(days)>now) days--;
  const calendarAnchor=dayAt(days),remainder=(now-calendarAnchor)/SECOND;
  const totalSeconds=(now-profile.birth)/SECOND,nextBirthday=customAnniversary(profile,years+1);
  const yearElapsed=(now-yearStart)/SECOND,yearLength=(nextBirthday-yearStart)/SECOND;
  return {now,years,months,days,hours:Math.floor(remainder/3600),minutes:Math.floor(remainder%3600/60),seconds:remainder%60,
    calendarAnchor,totalSeconds,fullDays:Math.floor(totalSeconds/86400),fullHours:Math.floor(totalSeconds/3600),
    fullMinutes:Math.floor(totalSeconds/60),totalHours:totalSeconds/3600,totalMinutes:totalSeconds/60,
    decimalYears:years+yearElapsed/yearLength,yearElapsed,yearLength,yearProgress:yearElapsed/yearLength,nextBirthday,
    remainingSeconds:(nextBirthday-now)/SECOND,remaining:customDuration((nextBirthday-now)/SECOND)};
}
export function customTimestamp(ms,zone) {
  const p=parts(ms,zone),pad=n=>String(n).padStart(2,'0');
  const offset=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(ms).find(p=>p.type==='timeZoneName').value;
  return `${String(p.year).padStart(4,'0')}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${offset}`;
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BIRTH, calculateAge, birthdayCountdown, anniversary, localInstant, timestamp} from './public/age.js';
import {createBirthProfile,calculateCustomAge,customAnniversary,customBirthdayCountdown} from './public/custom-age.js';
const ageAt = iso => calculateAge(Date.parse(iso));
const fields = a => [a.years,a.months,a.days,a.hours,a.minutes,a.seconds];
test('birth instant and exact first second', () => {
  assert.deepEqual(fields(calculateAge(BIRTH)), [0,0,0,0,0,0]);
  assert.equal(BIRTH, Date.parse('2012-05-21T19:02:00Z'));
  assert.deepEqual(fields(calculateAge(BIRTH + 1000)), [0,0,0,0,0,1]);
});
test('birthday rollover is at 15:02 local, not midnight', () => {
  assert.deepEqual(fields(ageAt('2027-05-21T19:01:59Z')), [14,11,29,23,59,59]);
  const birthday = ageAt('2027-05-21T19:02:00Z');
  assert.deepEqual(fields(birthday), [15,0,0,0,0,0]);
  assert.equal(birthday.decimalYears,15);
  assert.equal(birthday.nextBirthday, anniversary(2028));
  assert.equal(ageAt('2027-05-21T19:01:59Z').remainingSeconds,1);
});
test('February leap day and differing month lengths', () => {
  assert.deepEqual(fields(ageAt('2024-02-29T20:02:00Z')), [11,9,8,0,0,0]);
  assert.deepEqual(fields(ageAt('2024-03-21T19:02:00Z')), [11,10,0,0,0,0]);
  assert.equal((anniversary(2024)-anniversary(2023))/86400000,366);
  assert.equal((anniversary(2025)-anniversary(2024))/86400000,365);
});
test('spring-forward calendar day has 23 elapsed hours', () => {
  const a = ageAt('2026-03-07T20:02:00Z'), b = ageAt('2026-03-08T19:02:00Z');
  assert.deepEqual(fields(a),[13,9,14,0,0,0]);
  assert.deepEqual(fields(b),[13,9,15,0,0,0]);
  assert.equal(b.totalSeconds-a.totalSeconds,23*3600);
});
test('fall-back calendar day has 25 elapsed hours', () => {
  const before = ageAt('2026-10-31T19:02:00Z'), after = ageAt('2026-11-01T20:02:00Z');
  assert.equal(after.totalSeconds-before.totalSeconds,25*3600);
  assert.deepEqual(fields(ageAt('2026-11-01T20:01:59Z')),[14,5,10,24,59,59]);
  assert.deepEqual(fields(after),[14,5,11,0,0,0]);
});
test('DST repeated hour still counts different real seconds', () => {
  const first = ageAt('2026-11-01T01:30:00-04:00'), second = ageAt('2026-11-01T01:30:00-05:00');
  assert.equal(second.totalSeconds-first.totalSeconds,3600);
  assert.match(timestamp(first.now),/EDT \(UTC-04:00\)/);
  assert.match(timestamp(second.now),/EST \(UTC-05:00\)/);
});
test('same second for every number and exact reconstruction across 400 instants', () => {
  for(let i=0;i<400;i++) {
    const ms=BIRTH + i*1234567890;
    const a=calculateAge(ms);
    assert.equal(a.now % 1000,0);
    assert.equal(a.calendarAnchor+(a.hours*3600+a.minutes*60+a.seconds)*1000,a.now);
    assert.equal(BIRTH+a.totalSeconds*1000,a.now);
    assert.equal(a.now+a.remainingSeconds*1000,a.nextBirthday);
    assert.ok(a.months>=0 && a.months<12 && a.days>=0 && a.days<32);
    assert.ok(a.yearProgress>=0 && a.yearProgress<1);
  }
});
test('local afternoon anchors resolve in summer and winter', () => {
  assert.equal(localInstant({year:2026,month:7,day:1}),Date.parse('2026-07-01T19:02:00Z'));
  assert.equal(localInstant({year:2026,month:12,day:1}),Date.parse('2026-12-01T20:02:00Z'));
});
test('invalid and prebirth timestamps are rejected', () => {
  assert.throws(()=>calculateAge(NaN),RangeError);
  assert.throws(()=>calculateAge(BIRTH-1),RangeError);
});
test('selected 75th birthday is May 21 2087 at the Maryland birth time', () => {
  const now = Date.parse('2026-10-27T23:00:00Z');
  const birthday = birthdayCountdown(now,75);
  assert.equal(birthday.target,Date.parse('2087-05-21T19:02:00Z'));
  assert.equal(now+birthday.remainingSeconds*1000,birthday.target);
  assert.equal(birthday.remaining.days*86400+birthday.remaining.hours*3600+birthday.remaining.minutes*60+birthday.remaining.seconds,birthday.remainingSeconds);
});
test('selected countdown agrees with next birthday and handles exact rollover', () => {
  const now=Date.parse('2026-10-27T23:00:00.999Z');
  const a=calculateAge(now), birthday=birthdayCountdown(now,15);
  assert.equal(birthday.remainingSeconds,a.remainingSeconds);
  assert.deepEqual(birthday.remaining,a.remaining);
  assert.equal(birthdayCountdown(anniversary(2087)-1000,75).remainingSeconds,1);
  assert.equal(birthdayCountdown(anniversary(2087),75).remainingSeconds,0);
  assert.equal(birthdayCountdown(anniversary(2087)+1000,75).remainingSeconds,0);
});
test('all upcoming birthdays through 75 keep exact zoned targets across leap years and DST', () => {
  for(const now of ['2026-10-27T23:00:00Z','2026-11-01T20:00:00Z','2028-02-29T20:00:00Z']) {
    const a=ageAt(now);
    for(let age=a.years+1;age<=75;age++) {
      const birthday=birthdayCountdown(a.now,age);
      assert.equal(birthday.target,Date.parse(`${2012+age}-05-21T19:02:00Z`));
      assert.equal(birthday.remainingSeconds,(birthday.target-a.now)/1000);
    }
  }
  assert.throws(()=>birthdayCountdown(BIRTH,1.5),RangeError);
  assert.throws(()=>birthdayCountdown(BIRTH,0),RangeError);
});
test('custom calculator matches the original dashboard across 400 timestamps', () => {
  const profile=createBirthProfile({date:'2012-05-21',time:'15:02:00'});
  assert.equal(profile.birth,BIRTH);
  for(let i=0;i<400;i++)assert.deepEqual(calculateCustomAge(BIRTH+i*1234567890,profile),calculateAge(BIRTH+i*1234567890));
});
test('custom birthdays support leap day and sequential month-end clamping', () => {
  const leap=createBirthProfile({date:'2000-02-29',zone:'UTC'});
  assert.equal(customAnniversary(leap,25),Date.parse('2025-02-28T00:00:00Z'));
  assert.deepEqual(fields(calculateCustomAge(Date.parse('2025-02-28T00:00:00Z'),leap)),[25,0,0,0,0,0]);
  assert.deepEqual(fields(calculateCustomAge(Date.parse('2025-03-28T00:00:00Z'),leap)),[25,1,0,0,0,0]);
  const end=createBirthProfile({date:'2020-01-31',zone:'UTC'});
  assert.deepEqual(fields(calculateCustomAge(Date.parse('2020-02-29T00:00:00Z'),end)),[0,1,0,0,0,0]);
  assert.deepEqual(fields(calculateCustomAge(Date.parse('2020-03-30T00:00:00Z'),end)),[0,1,30,0,0,0]);
});
test('custom time zones and omitted birth time are explicit', () => {
  const nepal=createBirthProfile({date:'2000-01-01',time:'12:34:56',zone:'Asia/Kathmandu'});
  assert.equal(nepal.birth,Date.parse('2000-01-01T06:49:56Z'));
  const midnight=createBirthProfile({date:'2000-01-01',zone:'America/New_York'});
  assert.equal(midnight.birth,Date.parse('2000-01-01T05:00:00Z'));
  assert.equal(midnight.timeAssumed,true);
  assert.throws(()=>calculateCustomAge(midnight.birth-1,midnight),RangeError);
  assert.throws(()=>createBirthProfile({date:'2025-02-29'}),RangeError);
});
test('custom DST birth gaps are rejected and repeated times can select either occurrence', () => {
  assert.throws(()=>createBirthProfile({date:'2026-03-08',time:'02:30:00'}),/did not occur/);
  const first=createBirthProfile({date:'2026-11-01',time:'01:30:00'});
  const second=createBirthProfile({date:'2026-11-01',time:'01:30:00',occurrence:'later'});
  assert.equal(first.choices.length,2);
  assert.equal(first.birth,Date.parse('2026-11-01T05:30:00Z'));
  assert.equal(second.birth-first.birth,3600000);
  assert.deepEqual(fields(calculateCustomAge(second.birth,second)),[0,0,0,0,0,0]);
});
test('custom calendar anniversaries shift through a DST gap consistently', () => {
  const profile=createBirthProfile({date:'2025-03-08',time:'02:30:00'});
  assert.equal(customAnniversary(profile,1),Date.parse('2026-03-08T07:30:00Z'));
  const a=calculateCustomAge(Date.parse('2026-03-08T07:30:00Z'),profile);
  assert.deepEqual(fields(a),[1,0,0,0,0,0]);
  const birthday=customBirthdayCountdown(a.now,profile,75);
  assert.equal(a.now+birthday.remainingSeconds*1000,birthday.target);
});
test('custom age anchors reconstruct elapsed seconds for diverse dates and zones', () => {
  for(const birth of [
    {date:'1950-12-31',time:'23:59:59',zone:'Pacific/Auckland'},
    {date:'2000-02-29',time:'02:30:00',zone:'America/New_York'},
    {date:'1988-04-30',time:'00:00:00',zone:'Europe/London'},
    {date:'2024-11-03',time:'01:30:00',zone:'America/New_York',occurrence:'later'}
  ]){
    const profile=createBirthProfile(birth);
    for(let i=0;i<120;i++){
      const a=calculateCustomAge(profile.birth+i*7890123456,profile);
      assert.equal(a.calendarAnchor+(a.hours*3600+a.minutes*60+a.seconds)*1000,a.now);
      assert.equal(profile.birth+a.totalSeconds*1000,a.now);
      assert.ok(a.months>=0&&a.months<12&&a.days>=0&&a.days<32);
      assert.ok(a.yearProgress>=0&&a.yearProgress<1);
    }
  }
});

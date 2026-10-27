import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BIRTH, calculateAge, anniversary, localInstant, timestamp} from './public/age.js';
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

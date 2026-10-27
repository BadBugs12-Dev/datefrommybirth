import {createBirthProfile,calculateCustomAge,customBirthdayCountdown,customTimestamp} from './custom-age.js';
const number=n=>n.toLocaleString('en-US'),pad=n=>String(n).padStart(2,'0');
const decimal=(n,digits)=>n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export function createCustomDashboard({now,clock,resync,notify}) {
  const $=id=>document.getElementById('custom-'+id);
  const set=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
  let profile=null,frozen=null,current=null,selectedAge=null,optionsStart=null,lastSecond=null;
  for(const id of ['age-panel','numbers-grid','birthday-panel']) {
    const source=id==='numbers-grid'?document.querySelector('.numbers-grid'):document.getElementById(id);
    const clone=source.cloneNode(true);
    for(const el of [clone,...clone.querySelectorAll('*')]) {
      if(el.id)el.id='custom-'+el.id;
      for(const attr of ['aria-labelledby','aria-describedby'])if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).split(' ').map(id=>'custom-'+id).join(' '));
    }
    if(id==='numbers-grid')clone.id='custom-numbers-grid';
    $('dashboard').append(clone);
  }
  set('age-title','CUSTOM AGE');
  const location=$('age-panel').querySelector('.timestamp-info .small-label');
  $('copy').setAttribute('aria-label','Copy custom age snapshot');
  $('copy').title='Copy custom age snapshot';
  $('birthday-age').setAttribute('aria-label','Custom birthday age');
  const zones=[...new Set(['America/New_York','UTC',...(Intl.supportedValuesOf?.('timeZone')??[])])];
  for(const zone of zones){const option=document.createElement('option');option.value=zone;option.textContent=zone==='America/New_York'?'America/New_York (Maryland)':zone;$('zone').append(option);}
  const selectedBirthday=()=>customBirthdayCountdown(current.now,profile,selectedAge??current.years+1);
  function renderStatus() {
    const {source,lastSample,syncing}=clock();
    const isFrozen=frozen!==null;
    $('mode-label').classList.toggle('frozen',isFrozen||source==='Device clock');
    const label=isFrozen?' FROZEN':source==='Device clock'?' DEVICE TIME':' LIVE';
    if($('mode-label').textContent.trim()!==label.trim())$('mode-label').replaceChildren(Object.assign(document.createElement('span'),{className:'dot'}),document.createTextNode(label));
    set('sync-status',lastSample?`${isFrozen?'Snapshot frozen · ':''}Server synced at ${new Intl.DateTimeFormat('en-US',{timeZone:profile.zone,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(lastSample.unixMs)} · ±${Math.ceil(lastSample.rtt/2)} ms transit estimate`:'Device clock · server sync unavailable. Retry to verify time.');
    $('resync').disabled=syncing;
  }
  function render(force=false) {
    $('calculate').disabled=now()===null;
    if(!profile||now()===null)return;
    renderStatus();
    const second=Math.floor((frozen??now())/1000);
    if(second===lastSecond&&!force)return;
    lastSecond=second;
    current=calculateCustomAge(second*1000,profile);
    const a=current;
    $('age-panel').classList.toggle('wide-age',a.years>=100);
    for(const key of ['years','months','days','hours','minutes','seconds'])set(key,pad(a[key]));
    set('timestamp',customTimestamp(a.now,profile.zone));$('timestamp').dateTime=new Date(a.now).toISOString();
    location.textContent=profile.zone;
    set('decimal',decimal(a.decimalYears,9));set('decimal-exact',`Exact: ${a.years} + ${number(a.yearElapsed)} / ${number(a.yearLength)}`);
    set('total-days',number(a.fullDays));set('days-exact',`+ ${Math.floor(a.totalSeconds%86400/3600)} h ${Math.floor(a.totalSeconds%3600/60)} m ${a.totalSeconds%60} s`);
    set('total-hours',decimal(a.totalHours,3));set('hours-exact',`Exact: ${number(a.fullHours)} h + ${Math.floor(a.totalSeconds%3600/60)} m ${a.totalSeconds%60} s`);
    set('total-minutes',decimal(a.totalMinutes,3));set('minutes-exact',`Exact: ${number(a.fullMinutes)} m + ${a.totalSeconds%60} s`);set('total-seconds',number(a.totalSeconds));
    const nextAge=a.years+1;
    if(selectedAge!==null&&selectedAge<nextAge)selectedAge=null;
    if(optionsStart!==nextAge){const options=[];for(let age=nextAge;age<=Math.max(75,nextAge);age++){const option=document.createElement('option');option.value=age===nextAge?'next':String(age);option.textContent=String(age);options.push(option);}$('birthday-age').replaceChildren(...options);optionsStart=nextAge;}
    const value=selectedAge===null?'next':String(selectedAge);if($('birthday-age').value!==value)$('birthday-age').value=value;$('birthday-age').disabled=false;
    const birthday=selectedBirthday();$('birthday-panel').classList.toggle('extended-countdown',birthday.remaining.days>=1000);
    set('birthday-label',selectedAge===null?'NEXT BIRTHDAY':'BIRTHDAY COUNTDOWN');
    const day=new Intl.DateTimeFormat('en-US',{timeZone:profile.zone,month:'long',day:'numeric',year:'numeric'}).format(birthday.target);
    const time=new Intl.DateTimeFormat('en-US',{timeZone:profile.zone,hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(birthday.target);
    set('birthday-date',`${day} · ${time}`);
    for(const key of ['days','hours','minutes','seconds'])set('remaining-'+key,pad(birthday.remaining[key]));
    set('remaining-total',`${number(birthday.remainingSeconds)} seconds remaining`);set('year-progress',decimal(a.yearProgress*100,2)+'%');set('age-progress-label',`OF AGE ${a.years} COMPLETED`);
    $('orbit-progress').style.strokeDashoffset=String(615.752*(1-a.yearProgress));
    $('age-panel').setAttribute('aria-busy','false');$('freeze').disabled=false;$('copy').disabled=false;
  }
  $('form').addEventListener('submit',event=>{
    event.preventDefault();set('error','');
    try {
      if(now()===null)throw new RangeError('Wait for the clock to sync.');
      const candidate=createBirthProfile({date:$('date').value,time:$('time').value,zone:$('zone').value,occurrence:$('occurrence').value});
      calculateCustomAge(now(),candidate);
      profile=candidate;frozen=null;selectedAge=null;optionsStart=null;lastSecond=null;
      $('occurrence-field').hidden=profile.choices.length<2;
      if(profile.choices.length>1){for(const option of $('occurrence').options){const index=option.value==='later'?profile.choices.length-1:0;option.textContent=`${option.value==='later'?'Second':'First'} (${customTimestamp(profile.choices[index],profile.zone).split(' ').at(-1)})`;}}
      set('birth-note',`Birth: ${customTimestamp(profile.birth,profile.zone)} · ${profile.zone}${profile.timeAssumed?' · Birth time not entered; using midnight.':''}`);
      $('dashboard').hidden=false;
      $('freeze').replaceChildren(Object.assign(document.createElement('span'),{textContent:'Ⅱ',ariaHidden:'true'}),document.createTextNode(' Freeze moment'));
      render(true);
    } catch(error){set('error',error.message);}
  });
  for(const id of ['date','time','zone'])$(id).addEventListener('input',()=>{$('occurrence-field').hidden=true;$('occurrence').value='earlier';});
  $('freeze').addEventListener('click',()=>{if(!current)return;frozen=frozen===null?current.now:null;$('freeze').replaceChildren(Object.assign(document.createElement('span'),{textContent:frozen===null?'Ⅱ':'▷',ariaHidden:'true'}),document.createTextNode(frozen===null?' Freeze moment':' Resume live'));render(true);notify(frozen===null?'Custom age live resumed':'Custom snapshot frozen');});
  $('resync').addEventListener('click',resync);
  $('birthday-age').addEventListener('change',()=>{selectedAge=$('birthday-age').value==='next'?null:Number($('birthday-age').value);render(true);});
  $('copy').addEventListener('click',async()=>{
    if(!current)return;
    const a=current,b=selectedBirthday();
    const text=`CUSTOM AGE\nBirth: ${customTimestamp(profile.birth,profile.zone)} · ${profile.zone}${profile.timeAssumed?' (birth time assumed midnight)':''}\nTimestamp: ${customTimestamp(a.now,profile.zone)}\nUTC: ${new Date(a.now).toISOString()}\nAge: ${a.years} years, ${a.months} months, ${a.days} days, ${a.hours} hours, ${a.minutes} minutes, ${a.seconds} seconds\nDecimal years: approximately ${a.decimalYears.toFixed(12)}\nExact year expression: ${a.years} + ${a.yearElapsed}/${a.yearLength}\nFull 24-hour days: ${a.fullDays}\nTotal hours (exact): ${a.totalSeconds}/3600\nTotal minutes (exact): ${a.totalSeconds}/60\nTotal seconds: ${a.totalSeconds}\nSelected birthday: Age ${b.age}, ${customTimestamp(b.target,profile.zone)}\nRemaining: ${b.remaining.days} days, ${b.remaining.hours} hours, ${b.remaining.minutes} minutes, ${b.remaining.seconds} seconds (${b.remainingSeconds} seconds)\nLeap-day anniversaries use February 28 in non-leap years. Unix time excludes leap seconds. ${clock().source}.`;
    try{await navigator.clipboard.writeText(text);notify('Custom snapshot copied');}catch{notify('Clipboard unavailable. You can select and copy the numbers.');}
  });
  return {render};
}

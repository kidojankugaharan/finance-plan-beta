import {numberValue,monthValue} from '../validation.js';

export const PAY_FREQUENCIES={weekly:{label:'Weekly',perYear:52,days:7},biweekly:{label:'Every two weeks',perYear:26,days:14},semimonthly:{label:'Twice a month',perYear:24},monthly:{label:'Monthly',perYear:12}};
export function paydaysInMonth(schedule,year,month) {
  if(!schedule?.freq)return null;
  const frequency=PAY_FREQUENCIES[schedule.freq];
  if(!frequency)throw new Error('Choose a pay frequency.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(schedule.start||''))throw new Error('Enter the first payday as a calendar date.');
  const [y,m,d]=schedule.start.split('-').map(Number),start=Date.UTC(y,m-1,d);
  if(new Date(start).toISOString().slice(0,10)!==schedule.start)throw new Error('Enter a valid first payday.');
  const from=Date.UTC(year,month,1),to=Date.UTC(year,month+1,1);
  if(start>=to)return 0;
  if(frequency.days){const step=frequency.days*86400000,first=start>=from?start:start+Math.ceil((from-start)/step)*step;return first<to?Math.floor((to-1-first)/step)+1:0;}
  const days=frequency.perYear===12?[d]:[d,d<=15?d+15:d-15],maxDay=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return [...new Set(days.map(day=>Math.min(day,maxDay)))].filter(day=>Date.UTC(year,month,day)>=start).length;
}
export function paydayPlan(state,year,salary,schedules) {
  const row=state.years.find(y=>y.year===year);if(!row)throw new Error('Choose a projected year.');
  return row.months.map((m,index)=>{
    if(m.locked)return {month:index,status:'locked'};
    let amount=0,started=false;
    for(const p of state.singlePerson?['A']:['A','B']){
      const count=paydaysInMonth(schedules[p],year,index),income=salary['at'+p]||0;
      if(count){amount+=income/PAY_FREQUENCIES[schedules[p].freq].perYear*count;started=true;}else amount+=income/12;
    }
    return {month:index,status:started?'set':'unchanged',amount:Math.round(amount)};
  });
}

const INTERVALS={once:0,monthly:1,every2months:2,quarterly:3,semiannual:6,annual:12};
/** Materialize extra cash-flow schedules; individual occurrences stay editable. */
export function saveExtraSeries(state,input,existingGroup=null) {
  const start=monthValue(input.start,false),end=input.frequency==='once'?start:monthValue(input.end,false);
  const serial=value=>{const [y,m]=value.split('-').map(Number);return y*12+m-1;};
  const first=serial(start),last=serial(end);
  if(last<first)throw new Error('End month must be on or after start month.');
  if(!Object.hasOwn(INTERVALS,input.frequency))throw new Error('Choose a repeat frequency.');
  if(!['income','loss'].includes(input.type)||!['A','B'].includes(input.person))throw new Error('Choose an entry type and person.');
  const amount=numberValue(input.amount,{whole:true}),note=String(input.note||'').trim();
  if(!note||note.length>120)throw new Error('Enter a description up to 120 characters.');
  const group=existingGroup||crypto.randomUUID(),series={...input,amount,note};
  // Editing a series preserves completed historical occurrences.
  if(existingGroup)for(const y of state.years)for(const m of y.months)if(!m.locked)m.extraEntries=m.extraEntries.filter(e=>e.seriesId!==existingGroup);
  const step=INTERVALS[input.frequency];let count=0;
  for(let serial=first;serial<=last;serial+=step||last-first+1){
    const y=state.years.find(y=>y.year===Math.floor(serial/12)),m=y?.months[serial%12];
    if(!m||m.locked)continue;
    if(m.extraEntries.length>=100)throw new Error('A month can have at most 100 extra entries.');
    m.extraEntries.push({type:input.type,person:input.person,amount,note,seriesId:group,series});count++;
  }
  if(!count)throw new Error('The schedule has no unlocked months within your projection.');
  return count;
}

export function numberValue(value, { min = 0, max = 1e9, optional = false, whole = false } = {}) {
  if (value === '' || value === null || value === undefined) {
    if (optional) return null;
    throw new Error('Enter a number, including 0 when the amount is zero.');
  }
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Enter a valid number.');
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Enter a number from ${min} to ${max}.`);
  return whole ? Math.round(n) : n;
}
export function monthValue(value, optional = true) {
  if (!value && optional) return '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) throw new Error('Enter a month in YYYY-MM format.');
  const year = Number(value.slice(0, 4));
  if (year < 2026 || year > 2086) throw new Error('Choose a month between 2026 and 2086.');
  return value;
}
export function validateExpense(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid expense.');
  if (typeof item.expense !== 'string' || !item.expense.trim() || item.expense.length > 120) throw new Error('Give the expense a name (up to 120 characters).');
  if (typeof item.category !== 'string' || item.category.length > 80) throw new Error('Invalid category.');
  numberValue(item.cost);
  if (!['A','B','Both','n/a'].includes(item.owner)) throw new Error('Choose an expense owner.');
  if (!['once','daily','weekly','biweekly','semimonthly','monthly','bimonthly','quarterly','semiannual','annual','custom','none'].includes(item.recurrenceType)) throw new Error('Choose a frequency.');
  monthValue(item.startDate); monthValue(item.endDate);
  if (item.recurrenceType === 'once' && !item.startDate) throw new Error('A one-time expense needs a start month.');
  if (item.startDate && item.endDate && item.endDate < item.startDate) throw new Error('End month must be on or after start month.');
  if (item.recurrenceType === 'custom') {
    numberValue(item.repeatEvery, { min: 1, max: 120 });
    if (!['days','weeks','months','years'].includes(item.repeatUnit)) throw new Error('Invalid recurrence unit.');
  }
}
export function validatePlan(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('The backup has no plan.');
  const scan = (v, depth = 0) => {
    if (depth > 18) throw new Error('Backup nesting is too deep.');
    if (typeof v === 'number' && (!Number.isFinite(v) || Math.abs(v) > 1e15)) throw new Error('Invalid number in backup.');
    if (typeof v === 'string' && v.length > 10000) throw new Error('Text in the backup is too long.');
    if (v && typeof v === 'object') for (const [k,x] of Object.entries(v)) {
      if (['__proto__','prototype','constructor'].includes(k)) throw new Error('Unsafe backup field.');
      scan(x, depth + 1);
    }
  };
  scan(state);
  const object = v => !!v && typeof v==='object' && !Array.isArray(v);
  const flag = (v,label) => {if(v!==undefined && typeof v!=='boolean')throw new Error('Invalid '+label+'.');};
  const integer = (v,min,max,label) => {if(!Number.isInteger(v)||v<min||v>max)throw new Error('Invalid '+label+'.');};
  if(!['auto','year'].includes(state.budgetMode))throw new Error('Invalid budget mode.');
  if(!['bracket','flat'].includes(state.taxModel))throw new Error('Invalid tax model.');
  numberValue(state.flatRate,{max:100});
  if(!['yearly','monthly','spread'].includes(state.investMode)||!['pool','cashflow'].includes(state.investMonthlyBase))throw new Error('Invalid investment schedule.');
  integer(state.investMonth,0,11,'investment month');
  if(!Array.isArray(state.investMonths)||!state.investMonths.length||state.investMonths.length>12)throw new Error('Invalid investment months.');
  state.investMonths.forEach(m=>integer(m,0,11,'investment month'));
  if(!Array.isArray(state.investmentPriority)||state.investmentPriority.length!==4||new Set(state.investmentPriority).size!==4||state.investmentPriority.some(id=>!['tfsaA','tfsaB','rrspA','rrspB'].includes(id)))throw new Error('Invalid account priority.');
  flag(state.singlePerson,'household size');flag(state.retirementAuto,'retirement setting');
  for(const key of ['taxDeductions','drawdownPlans','pensions','budgetByYear','brackets','setup','ui'])if(!object(state[key]))throw new Error('Invalid '+key+'.');
  for(const key of ['federal','ontario']){
    const list=state.brackets[key];
    if(!Array.isArray(list)||!list.length||list.length>12)throw new Error('Invalid tax brackets.');
    for(const row of list){if(!object(row))throw new Error('Invalid tax bracket.');numberValue(row.threshold);numberValue(row.rate,{max:.6});}
  }
  for (const key of ['nameA','nameB']) if (typeof state[key] !== 'string' || state[key].length > 40) throw new Error('Invalid household names.');
  numberValue(state.baseYear, {min:2026,max:2086});
  if (!Number.isInteger(state.baseYear)) throw new Error('Base year must be a whole year.');
  for (const key of ['ageA','ageB']) numberValue(state[key], {min:18,max:110,optional:true});
  numberValue(state.retirementAge, {min:18,max:100});
  numberValue(state.inflationRate, {min:0,max:20});
  numberValue(state.raiseA, {min:-50,max:50});
  numberValue(state.raiseB, {min:-50,max:50});
  numberValue(state.investPct, {max:100});
  numberValue(state.returnRateA, {min:-99,max:100});
  numberValue(state.returnRateB, {min:-99,max:100});
  for (const key of ['startCashA','startCashB','startTFSAA','startTFSAB','startRRSPA','startRRSPB']) numberValue(state[key]);
  if (!['ON','AB','BC','MB','NB','NL','NS','NT','NU','PE','QC','SK','YT'].includes(state.province)) throw new Error('Choose a Canadian province or territory.');
  if (!Array.isArray(state.budgetItems) || state.budgetItems.length > 500 || !Array.isArray(state.years) || state.years.length > 61 || !Array.isArray(state.goals) || state.goals.length > 100) throw new Error('Invalid plan lists.');
  state.budgetItems.forEach(validateExpense);
  for (const [year,list] of Object.entries(state.budgetByYear || {})) { integer(Number(year),2026,2086,'budget year');if (!Array.isArray(list) || list.length > 500) throw new Error('Invalid annual budget.'); list.forEach(validateExpense); }
  if(state.archivedYears!==undefined&&(!Array.isArray(state.archivedYears)||state.archivedYears.length>61))throw new Error('Invalid archived years.');
  const seenYears=new Set();
  for (const y of [...state.years, ...(state.archivedYears || [])]) {
    if(!object(y))throw new Error('Invalid year.');integer(y.year,2026,2086,'projection year');
    if(seenYears.has(y.year))throw new Error('Duplicate projection year.');seenYears.add(y.year);
    if (!Array.isArray(y.months) || y.months.length !== 12) throw new Error('Each year needs 12 months.');
    for (const k of ['grossA','grossB']) numberValue(y[k], {optional:true});
    for (const k of ['annualReturnPct','annualReturnOverrideA','annualReturnOverrideB']) numberValue(y[k], {optional:true,min:-99,max:100});
    numberValue(y.salaryGrowthPct, {optional:true,min:-50,max:50});
    if (y.pensionModeOverride != null && typeof y.pensionModeOverride !== 'boolean') throw new Error('Invalid retirement override.');
    flag(y.planAutoOff,'automatic investment choice');flag(y.annualReturnPctManual,'return override');
    numberValue(y.rrspPlanPct,{optional:true,max:100});
    for(const p of ['A','B'])for(const account of ['TFSA','RRSP'])numberValue(y['start'+account+'Override'+p],{optional:true});
    numberValue(y.startCashCombinedOverride,{optional:true,min:-1e9});
    for(const key of ['planRoomCaps','planRoomManual','planRoomDerived'])if(!object(y[key]))throw new Error('Invalid account room.');
    for (const cap of Object.values(y.planRoomCaps || {})) numberValue(cap,{optional:true});
    for (const m of y.months) {
      if (!m || typeof m !== 'object') throw new Error('Invalid month.');
      flag(m.locked,'completed month');flag(m.rrspElectPriorA,'RRSP election');flag(m.rrspElectPriorB,'RRSP election');
      for (const k of ['expense','earning']) numberValue(m[k],{optional:true});
      for (const k of ['tfsaA','tfsaB','rrspA','rrspB']) numberValue(m[k]);
      for (const k of ['monthlyReturnOverrideA','monthlyReturnOverrideB']) numberValue(m[k], {optional:true,min:-100,max:100});
      if (!Array.isArray(m.extraEntries) || m.extraEntries.length > 100) throw new Error('Invalid extra income/expenses.');
      for (const e of m.extraEntries) { if(!object(e))throw new Error('Invalid extra entry.');numberValue(e.amount); if (!['income','loss'].includes(e.type) || !['A','B'].includes(e.person) || (e.note!==undefined&&typeof e.note!=='string')) throw new Error('Invalid extra entry.'); }
    }
  }
  for (const g of state.goals) {
    if (!g || typeof g !== 'object') throw new Error('Invalid goal.');
    numberValue(g.targetAmount,{optional:true}); integer(g.targetYear,2026,2086,'goal year');integer(g.targetMonth,0,11,'goal month');
    if(g.description!==undefined&&typeof g.description!=='string')throw new Error('Invalid goal description.');
    if(g.fundingPlan!==undefined){
      const p=g.fundingPlan;if(!object(p))throw new Error('Invalid savings schedule.');
      for(const key of ['startingAmount','amount'])numberValue(p[key]??0);
      integer(p.startYear,2026,2086,'savings start year');integer(p.endYear,2026,2086,'savings end year');integer(p.startMonth,0,11,'savings month');integer(p.endMonth,0,11,'savings month');
      if(p.endYear*12+p.endMonth<p.startYear*12+p.startMonth)throw new Error('Savings schedule ends before it starts.');
    }
  }
  for(const p of ['A','B']){
    if(!object(state.pensions[p]))throw new Error('Invalid pension settings.');
    integer(state.pensions[p].cppStartAge,60,70,'CPP start age');integer(state.pensions[p].oasStartAge,65,70,'OAS start age');numberValue(state.pensions[p].cppPct,{max:100,optional:true});
  }
  for(const [year,people] of Object.entries(state.taxDeductions)){
    integer(Number(year),2025,2086,'deduction year');if(!object(people))throw new Error('Invalid deductions.');
    for(const p of ['A','B']){if(!Array.isArray(people[p])||people[p].length>100)throw new Error('Invalid deduction list.');for(const row of people[p])numberValue(row?.amount);}
  }
  for(const [year,plan] of Object.entries(state.drawdownPlans)){
    integer(Number(year),2026,2086,'withdrawal year');
    if(!object(plan)||!['fill','tfsaLow','manual','fixed'].includes(plan.strategy)||!['monthly','lump'].includes(plan.mode))throw new Error('Invalid withdrawal plan.');
    integer(plan.month,0,11,'withdrawal month');numberValue(plan.rrspPct,{max:100});
  }
  if(state.setup.step!==undefined)integer(state.setup.step,0,6,'setup step');
  for(const key of ['started','paused','completed'])flag(state.setup[key],'setup status');
  if(!object(state.setup.seen))throw new Error('Invalid setup progress.');
  if(state.setup.drafts!==undefined){if(!object(state.setup.drafts))throw new Error('Invalid setup drafts.');for(const [step,fields] of Object.entries(state.setup.drafts)){integer(Number(step),0,6,'draft step');if(!object(fields)||Object.values(fields).some(v=>typeof v!=='string'))throw new Error('Invalid draft fields.');}}
  const range=state.ui.analysis;
  if(range!==undefined){if(!object(range))throw new Error('Invalid analysis settings.');flag(range.realDollars,'dollar display');for(const key of ['from','to'])if(range[key]!==undefined)integer(range[key],2026,2086,'analysis year');if((range.from||state.baseYear)>(range.to||2086))throw new Error('Invalid analysis range.');}
}

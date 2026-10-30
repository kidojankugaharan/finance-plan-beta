// Calculation logic ported from the reference; independent of browser APIs.
export function registerInvestments(api) {
const CRA_RRSP_DOLLAR_LIMITS = {2025:32490, 2026:33810, 2027:35390};

const CRA_TFSA_DOLLAR_LIMITS = {2024:7000, 2025:7000, 2026:7000};

const INVESTMENT_ACCOUNT_IDS = api.state.singlePerson ? ["rrspA","tfsaA"] : ["rrspA","tfsaA","rrspB","tfsaB"];

const LATEST_PUBLISHED_TFSA_LIMIT_YEAR = Math.max(...Object.keys(CRA_TFSA_DOLLAR_LIMITS).map(Number));

const LATEST_PUBLISHED_TFSA_LIMIT = CRA_TFSA_DOLLAR_LIMITS[LATEST_PUBLISHED_TFSA_LIMIT_YEAR];

function investmentPlanPctIsActive(raw){
  return raw!==null && raw!==undefined && raw!=="" && Number.isFinite(Number(raw));
}

function normalizeInvestmentPlanPct(raw){
  if(raw===null || raw===undefined || raw==="") return null;
  const n = Number(raw);
  if(!Number.isFinite(n)) return null;
  return Math.max(0,Math.min(100,n));
}

function investmentPlanPctSame(a,b){
  const x = normalizeInvestmentPlanPct(a);
  const y = normalizeInvestmentPlanPct(b);
  if(x===null || y===null) return x===y;
  return Math.abs(x-y) < 0.0000001;
}

function deriveInvestmentPlanPctBreakpointsFromValues(){
  const years = api.state.years || [];
  let carry = normalizeInvestmentPlanPct(api.state.investPct);
  years.forEach(y=>{
    const value = normalizeInvestmentPlanPct(y.rrspPlanPct);
    // A blank year is only a breakpoint (plan off) if it was flagged so; otherwise it inherits the Auto plan %.
    const manual = value===null ? y.planStopped===true : !investmentPlanPctSame(value,carry);
    y.rrspPlanPctManual = manual;
    if(manual) carry = value;
    else y.rrspPlanPct = carry;
  });
}

function rebuildInvestmentPlanPctInheritance(beforeValues){
  const years = api.state.years || [];
  let carry = normalizeInvestmentPlanPct(api.state.investPct);

  years.forEach(y=>{
    // Older saves marked a blank first year "manual" without it being a stop: that year inherits.
    if(y.rrspPlanPctManual===true && normalizeInvestmentPlanPct(y.rrspPlanPct)===null && y.planStopped!==true) y.rrspPlanPctManual = false;
    if(normalizeInvestmentPlanPct(y.rrspPlanPct)!==null && y.planStopped) y.planStopped = false;
    if(y.rrspPlanPctManual===true){
      carry = normalizeInvestmentPlanPct(y.rrspPlanPct);
    }else{
      y.rrspPlanPctManual = false;
      y.rrspPlanPct = carry;
    }
  });

  if(Array.isArray(beforeValues)){
    years.forEach((y,idx)=>{
      if(isInvestmentPlanYearLocked(y)) return;
      const wasActive = investmentPlanPctIsActive(beforeValues[idx]);
      const isActive = investmentPlanPctIsActive(y.rrspPlanPct);

      if(!wasActive && isActive){
        captureInvestmentPlanPreAuto(y);
      }else if(wasActive && !isActive){
        restoreInvestmentPlanPreAuto(y);
        clearInvestmentPlanPreAuto(y);
      }else if(isActive && !isValidInvestmentPlanBackup(y.investmentPlanPreAutoFeb)){
        recoverInvestmentPlanPreAutoFromDatabase(y);
      }
    });
  }
}

function migrateInvestmentPlanPctInheritance(){
  const years = api.state.years || [];
  if(!years.length) return;

  const hasMarkers = years.some(y=>typeof y.rrspPlanPctManual==="boolean");
  if(!hasMarkers){
    // v70 migration: infer historical breakpoints from the values already
    // present so opening an older revision does not change its plan.
    deriveInvestmentPlanPctBreakpointsFromValues();
    return;
  }

  years.forEach(y=>{
    if(typeof y.rrspPlanPctManual!=="boolean") y.rrspPlanPctManual=false;
  });
  rebuildInvestmentPlanPctInheritance();
}

function legacyAnnualReturnDefault(){
  const a = Number(api.state.returnRateA);
  if(Number.isFinite(a)) return a;
  const b = Number(api.state.returnRateB);
  return Number.isFinite(b) ? b : 7;
}

function normalizeAnnualReturnPct(raw){
  if(raw===null || raw===undefined || raw==="") return null;
  const n = Number(raw);
  if(!Number.isFinite(n)) return null;
  return Math.max(-99.9,Math.min(1000,n));
}

function annualReturnPctSame(a,b){
  const x = normalizeAnnualReturnPct(a);
  const y = normalizeAnnualReturnPct(b);
  if(x===null || y===null) return x===y;
  return Math.abs(x-y) < 0.0000001;
}

function rebuildAnnualReturnPctInheritance(){
  const years = api.state.years || [];
  if(!years.length) return;
  let carry = normalizeAnnualReturnPct(years[0].annualReturnPct);
  if(carry===null) carry = legacyAnnualReturnDefault();

  years.forEach((y,idx)=>{
    if(idx===0){
      y.annualReturnPct = normalizeAnnualReturnPct(y.annualReturnPct) ?? carry;
      y.annualReturnPctManual = true;
      carry = y.annualReturnPct;
      return;
    }
    if(y.annualReturnPctManual===true){
      const own = normalizeAnnualReturnPct(y.annualReturnPct);
      if(own!==null) carry = own;
      else y.annualReturnPctManual = false;
    }
    if(y.annualReturnPctManual!==true){
      y.annualReturnPctManual = false;
      y.annualReturnPct = carry;
    }else{
      y.annualReturnPct = carry;
    }
  });
  api.state.returnRateA = Number(years[0].annualReturnPct)||0;
  api.state.returnRateB = Number(years[0].annualReturnPct)||0;
}

function migrateAnnualReturnPctInheritance(){
  const years = api.state.years || [];
  if(!years.length) return;
  const hasRealSchedule = years.some(y=>normalizeAnnualReturnPct(y.annualReturnPct)!==null);
  const hasManualMarkers = years.some(y=>y.annualReturnPctManual===true);

  if(!hasRealSchedule){
    const seed = legacyAnnualReturnDefault();
    const legacyA = Number(api.state.returnRateA);
    const legacyB = Number(api.state.returnRateB);
    years.forEach((y,idx)=>{
      y.annualReturnPct = seed;
      y.annualReturnPctManual = idx===0;
      if(y.annualReturnOverrideA===undefined) y.annualReturnOverrideA = null;
      if(y.annualReturnOverrideB===undefined) y.annualReturnOverrideB = null;
      if(Number.isFinite(legacyA) && Number.isFinite(legacyB) && Math.abs(legacyA-legacyB)>0.0000001 &&
         (y.annualReturnOverrideB===null || y.annualReturnOverrideB==="")){
        y.annualReturnOverrideB = legacyB;
      }
    });
    rebuildAnnualReturnPctInheritance();
    return;
  }

  if(!hasManualMarkers){
    let carry = normalizeAnnualReturnPct(years[0].annualReturnPct) ?? legacyAnnualReturnDefault();
    years.forEach((y,idx)=>{
      const value = normalizeAnnualReturnPct(y.annualReturnPct);
      if(idx===0){
        y.annualReturnPct = value ?? carry;
        y.annualReturnPctManual = true;
        carry = y.annualReturnPct;
      }else{
        const manual = value!==null && !annualReturnPctSame(value,carry);
        y.annualReturnPctManual = manual;
        if(manual) carry = value;
        y.annualReturnPct = carry;
      }
    });
  }else{
    years.forEach((y,idx)=>{
      if(idx===0) y.annualReturnPctManual = true;
      else if(typeof y.annualReturnPctManual!=="boolean") y.annualReturnPctManual = false;
    });
  }
  rebuildAnnualReturnPctInheritance();
}

function computeAnnualReturnPctChain(){
  const years = api.state.years || [];
  if(!years.length) return [];
  let carry = normalizeAnnualReturnPct(years[0].annualReturnPct) ?? legacyAnnualReturnDefault();
  return years.map((y,idx)=>{
    const raw = normalizeAnnualReturnPct(y.annualReturnPct);
    const manual = idx===0 || y.annualReturnPctManual===true;
    if(manual && raw!==null) carry = raw;
    return {pct:carry, manual, source:manual?"manual":"inherited"};
  });
}

function effectiveAnnualReturnForPerson(yearIdx,person,chain=null){
  const schedule = chain || computeAnnualReturnPctChain();
  const shared = Number(schedule?.[yearIdx]?.pct);
  return Number.isFinite(shared) ? shared : legacyAnnualReturnDefault();
}

function readFebruaryInvestmentValues(yearObj){
  const feb = yearObj?.months?.[1];
  return {
    tfsaA:Number(feb?.tfsaA)||0,
    rrspA:Number(feb?.rrspA)||0,
    tfsaB:Number(feb?.tfsaB)||0,
    rrspB:Number(feb?.rrspB)||0
  };
}

function isValidInvestmentPlanBackup(value){
  return value && typeof value==="object" && INVESTMENT_ACCOUNT_IDS.every(id=>Number.isFinite(Number(value[id])));
}

function captureInvestmentPlanPreAuto(yearObj){
  if(!yearObj || isValidInvestmentPlanBackup(yearObj.investmentPlanPreAutoFeb)) return false;
  yearObj.investmentPlanPreAutoFeb = readFebruaryInvestmentValues(yearObj);
  yearObj.investmentPlanPreAutoAll = (yearObj.months||[]).map(m=>({tfsaA:Number(m?.tfsaA)||0,rrspA:Number(m?.rrspA)||0,tfsaB:Number(m?.tfsaB)||0,rrspB:Number(m?.rrspB)||0}));
  return true;
}

function restoreInvestmentPlanPreAuto(yearObj){
  if(!yearObj?.months?.[1] || !isValidInvestmentPlanBackup(yearObj.investmentPlanPreAutoFeb)) return false;
  let changed=false;
  const all = Array.isArray(yearObj.investmentPlanPreAutoAll) && yearObj.investmentPlanPreAutoAll.length===12 ? yearObj.investmentPlanPreAutoAll : null;
  if(all){
    yearObj.months.forEach((m,mi)=>{
      if(m.locked) return;
      INVESTMENT_ACCOUNT_IDS.forEach(id=>{
        const prior = Number(all[mi]?.[id])||0;
        if((Number(m[id])||0)!==prior){ m[id]=prior; changed=true; }
      });
    });
    return changed;
  }
  const feb = yearObj.months[1];
  INVESTMENT_ACCOUNT_IDS.forEach(id=>{
    const prior = Number(yearObj.investmentPlanPreAutoFeb[id])||0;
    if((Number(feb[id])||0)!==prior){ feb[id]=prior; changed=true; }
  });
  return changed;
}

function clearInvestmentPlanPreAuto(yearObj){
  if(!yearObj || yearObj.investmentPlanPreAutoFeb===undefined) return false;
  delete yearObj.investmentPlanPreAutoFeb;
  delete yearObj.investmentPlanPreAutoAll;
  return true;
}

function databaseLogValueAsMoney(raw){
  if(raw===null || raw===undefined || raw==="") return 0;
  const cleaned = String(raw).replace(/[$,]/g,"").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function recoverInvestmentPlanPreAutoFromDatabase(yearObj){
  if(!yearObj || isValidInvestmentPlanBackup(yearObj.investmentPlanPreAutoFeb)) return false;
  const logs = Array.isArray(api.state.databaseLog) ? api.state.databaseLog : [];
  const yearText = String(yearObj.year);
  const planField = "Pooled investment allocation of available income (%)";
  let activationIndex = -1;

  // Find the most recent inactive -> active transition for this currently-active year.
  for(let i=0;i<logs.length;i++){
    const row = logs[i];
    if(row?.reverted) continue;
    if(row?.section!=="Investment Plan" || String(row.location)!==yearText || row.field!==planField) continue;
    const oldActive = investmentPlanPctIsActive(row.oldValue);
    const newActive = investmentPlanPctIsActive(row.newValue);
    if(!oldActive && newActive) activationIndex = i;
    if(oldActive && !newActive) activationIndex = -1;
  }

  // If history predates the plan feature or cannot identify the transition,
  // fall back to the current values rather than inventing numbers.
  const backup = readFebruaryInvestmentValues(yearObj);
  if(activationIndex>=0){
    const wanted = {
      tfsaA:"Person A TFSA contribution",
      rrspA:"Person A RRSP contribution",
      tfsaB:"Person B TFSA contribution",
      rrspB:"Person B RRSP contribution"
    };
    const found = {};
    for(let i=activationIndex+1;i<logs.length;i++){
      const row = logs[i];
      if(row?.section==="Investment Plan" && String(row.location)===yearText && row.field===planField && !investmentPlanPctIsActive(row.newValue)) break;
      if(row?.section!=="Year-by-Year" || String(row.location)!==`${yearObj.year} · February`) continue;
      for(const [id,label] of Object.entries(wanted)){
        if(found[id] || row.field!==label) continue;
        backup[id] = databaseLogValueAsMoney(row.oldValue);
        found[id] = true;
      }
      if(Object.keys(found).length===4) break;
    }
  }
  yearObj.investmentPlanPreAutoFeb = backup;
  return true;
}

function getInvestmentPriority(){
  const raw = Array.isArray(api.state.investmentPriority) ? api.state.investmentPriority.slice() : [];
  const ALL = ["rrspA","tfsaA","rrspB","tfsaB"];
  const cleaned = raw.filter((v,i,a)=>ALL.includes(v) && a.indexOf(v)===i);
  ALL.forEach(v=>{ if(!cleaned.includes(v)) cleaned.push(v); });
  api.state.investmentPriority = cleaned.slice(0,4);
  // In a single-person household Person B's accounts are left out (but their saved order is kept).
  return api.state.investmentPriority.filter(v=>INVESTMENT_ACCOUNT_IDS.includes(v) && (!api.state.singlePerson || v.endsWith('A')));
}

const RRSP_LAST_CONTRIBUTION_AGE = 71;

const RRIF_FACTORS = {71:.0528,72:.054,73:.0553,74:.0567,75:.0582,76:.0598,77:.0617,78:.0636,79:.0658,80:.0682,
  81:.0708,82:.0738,83:.0771,84:.0808,85:.0851,86:.0899,87:.0955,88:.1021,89:.1099,90:.1192,
  91:.1306,92:.1449,93:.1634,94:.1879};

function rrifMinimumFactor(ageAtStartOfYear){
  const age = Math.floor(Number(ageAtStartOfYear));
  if(!Number.isFinite(age)) return 0;
  if(age >= 95) return 0.20;
  if(age >= 71) return RRIF_FACTORS[age];
  return 1/(90-age);
}

function rrspClosedFor(person, year){
  const age = api.personAgeInYear(person, year);
  return age!==null && age > RRSP_LAST_CONTRIBUTION_AGE;
}

function getPlanRoomCap(yearObj,accountId){
  if(String(accountId).startsWith("rrsp") && yearObj && rrspClosedFor(String(accountId).slice(-1), yearObj.year)) return 0;
  const raw = yearObj?.planRoomCaps?.[accountId];
  if(raw===null || raw===undefined || raw==="") return null;
  const n = Number(raw);
  if(!Number.isFinite(n)) return null;
  return Math.max(0,n);
}

function ensurePlanRoomMeta(yearObj){
  if(!yearObj.planRoomCaps || typeof yearObj.planRoomCaps!=="object") yearObj.planRoomCaps={rrspA:null,tfsaA:null,rrspB:null,tfsaB:null};
  if(!yearObj.planRoomManual || typeof yearObj.planRoomManual!=="object") yearObj.planRoomManual={rrspA:false,tfsaA:false,rrspB:false,tfsaB:false};
  if(!yearObj.planRoomDerived || typeof yearObj.planRoomDerived!=="object") yearObj.planRoomDerived={rrspA:false,tfsaA:false,rrspB:false,tfsaB:false};
  INVESTMENT_ACCOUNT_IDS.forEach(id=>{
    if(yearObj.planRoomCaps[id]===undefined) yearObj.planRoomCaps[id]=null;
    if(yearObj.planRoomManual[id]===undefined) yearObj.planRoomManual[id]=false;
    if(yearObj.planRoomDerived[id]===undefined) yearObj.planRoomDerived[id]=false;
  });
}

function annualAccountContribTotal(yearObj,accountId){
  return (yearObj?.months||[]).reduce((sum,m)=>sum+Math.max(0,Number(m?.[accountId])||0),0);
}

function indexedPublishedLimit(table, year, roundTo){
  const years = Object.keys(table).map(Number);
  const latest = Math.max(...years);
  if(table[year]!==undefined) return Number(table[year])||0;
  if(year < latest) return Number(table[Math.max(...years.filter(y=>y<=year), Math.min(...years))])||0;
  const inflation = api.inflationFraction();
  return Math.round(Number(table[latest]) * Math.pow(1+inflation, year-latest) / roundTo) * roundTo;
}

function projectedTfsaAnnualLimit(year){
  const published = CRA_TFSA_DOLLAR_LIMITS[year];
  if(published!==undefined) return {value:Number(published)||0,published:true,sourceYear:year};
  return {value:indexedPublishedLimit(CRA_TFSA_DOLLAR_LIMITS, Number(year), 500),published:false,sourceYear:LATEST_PUBLISHED_TFSA_LIMIT_YEAR};
}

function projectedRrspNewRoom(yearIdx,accountId,salaryChain){
  if(yearIdx<=0) return {value:0,earned18:0,publishedCap:null,priorGross:0,published:true};
  const currentYear = Number(api.state.years?.[yearIdx]?.year)||0;
  const personA = accountId.endsWith("A");
  // Only earned income (salary) creates room; CPP, OAS and other pension
  // income don't.
  const prior = salaryChain?.[yearIdx-1];
  const priorGross = prior?.pensionActive ? 0 : Math.max(0,Number(personA ? prior?.grossA : prior?.grossB)||0);
  const earned18 = priorGross*0.18;
  const published = CRA_RRSP_DOLLAR_LIMITS[currentYear]!==undefined;
  const publishedCap = indexedPublishedLimit(CRA_RRSP_DOLLAR_LIMITS, currentYear, 10);
  const value = api.roundDollar(Math.min(earned18,publishedCap));
  return {value,earned18,publishedCap,priorGross,published};
}

function deriveContributionRoomForYear(yearIdx,accountId,salaryChain){
  if(yearIdx<=0) return {value:null,details:null};
  const prev = api.state.years?.[yearIdx-1];
  const current = api.state.years?.[yearIdx];
  if(accountId.startsWith("rrsp") && rrspClosedFor(accountId.slice(-1), current?.year)){
    // Past 71 the RRSP is a RRIF: no room. This must agree with
    // getPlanRoomCap(), or the investment-plan sync never settles.
    return {value:0, details:{kind:"RRSP", prevRoom:0, priorContrib:0, unused:0, newRoom:0, rrifConverted:true}};
  }
  const prevRoom = getPlanRoomCap(prev,accountId);
  if(prevRoom===null) return {value:null,details:null};
  const priorContrib = annualAccountContribTotal(prev,accountId);
  const unused = Math.max(0,prevRoom-priorContrib);
  const kind = accountId.startsWith("rrsp") ? "RRSP" : "TFSA";
  if(kind==="RRSP"){
    const earned = projectedRrspNewRoom(yearIdx,accountId,salaryChain);
    return {
      value:api.roundDollar(unused+earned.value),
      details:{kind,prevRoom,priorContrib,unused,newRoom:earned.value,priorGross:earned.priorGross,earned18:earned.earned18,publishedCap:earned.publishedCap,published:earned.published}
    };
  }
  const tfsa = projectedTfsaAnnualLimit(Number(current?.year));
  // A TFSA withdrawal restores contribution room on January 1 of the next year.
  // Unknown opening room remains unknown (handled above), never guessed here.
  const withdrawalKey = accountId.endsWith('A') ? 'autoWithdrawalTfsaA' : 'autoWithdrawalTfsaB';
  const restored = (planSeries()[yearIdx-1]?.months || []).reduce((sum,m)=>sum+(Number(m[withdrawalKey])||0),0);
  return {
    value:api.roundDollar(unused+tfsa.value+restored),
    details:{kind,prevRoom,priorContrib,unused,newRoom:tfsa.value,restored,published:tfsa.published,sourceYear:tfsa.sourceYear}
  };
}

function updateProjectedContributionRoomForYear(yearIdx,salaryChain){
  const y = api.state.years?.[yearIdx];
  if(!y) return false;
  ensurePlanRoomMeta(y);
  let changed=false;
  INVESTMENT_ACCOUNT_IDS.forEach(accountId=>{
    if(y.planRoomManual[accountId]){
      if(y.planRoomDerived[accountId]){ y.planRoomDerived[accountId]=false; changed=true; }
      return;
    }
    const derived = deriveContributionRoomForYear(yearIdx,accountId,salaryChain);
    const next = derived.value===null ? null : Math.max(0,Number(derived.value)||0);
    const old = getPlanRoomCap(y,accountId);
    const same = (old===null && next===null) || (old!==null && next!==null && Math.abs(old-next)<0.5);
    if(!same){ y.planRoomCaps[accountId]=next; changed=true; }
    const shouldDerived = next!==null;
    if(!!y.planRoomDerived[accountId]!==shouldDerived){ y.planRoomDerived[accountId]=shouldDerived; changed=true; }
  });
  return changed;
}

function refreshProjectedContributionRooms(){
  if(!Array.isArray(api.state.years) || !api.state.years.length) return false;
  const salaryChain = api.computeSalaryChain();
  let changed=false;
  api.state.years.forEach((_,idx)=>{ if(updateProjectedContributionRoomForYear(idx,salaryChain)) changed=true; });
  return changed;
}

function computeInvestmentPlanAvailableIncome(){
  // v97: Locked years are completed history and have $0 planning availability.
  //
  // The first unlocked year after any locked period starts a fresh planning
  // cycle:
  //   opening combined bank balance
  // + January cash flow
  // + February cash flow BEFORE the current February investment.
  //
  // Each following unlocked year in the same continuous planning cycle uses:
  //   prior-year March ... December cash flow
  // + current-year January cash flow
  // + current-year February cash flow BEFORE the current February investment.
  //
  // If another locked year appears, availability is $0 for that row and the
  // next unlocked year starts a new cycle from its own opening bank balance.
  const monthlySeries = api.computeMonthlySeries();

  const monthCashFlow = (month,{excludeInvestment=false}={})=>{
    if(!month) return 0;
    // Locked (completed) months are already reflected in the bank balance, so
    // they never count toward projected cash flow or planning availability.
    if(month.isCompleted || month.locked) return 0;
    let value = Number(month.displayNetCashFlow)||0;
    if(excludeInvestment){
      value += Math.max(0,Number(month.tfsaContrib)||0);
      value += Math.max(0,Number(month.rrspContrib)||0);
    }
    return value;
  };

  let priorYearWasUnlocked = false;

  return (api.state.years||[]).map((y,yIdx)=>{
    const series = monthlySeries[yIdx];
    const yearLocked = isInvestmentPlanYearLocked(y);

    const januaryCashFlow = monthCashFlow(series?.months?.[0]);
    const februaryCashFlowBeforeInvestment = monthCashFlow(
      series?.months?.[1],
      {excludeInvestment:true}
    );

    if(yearLocked){
      priorYearWasUnlocked = false;
      return {
        year:Number(y.year),
        yearLocked:true,
        isFirstUnlockedYear:false,
        windowLabel:`${y.year} locked`,
        startingBank:0,
        priorMarchToDecemberCashFlow:0,
        januaryCashFlow,
        februaryCashFlowBeforeInvestment,
        rollingCashFlow:0,
        combined:0,
        positiveCombined:0
      };
    }

    const isFirstUnlockedYear = !priorYearWasUnlocked;

    if(isFirstUnlockedYear){
      const startingBank = Number(series?.openingCashCombined)||0;
      const rollingCashFlow = januaryCashFlow + februaryCashFlowBeforeInvestment;
      const combined = startingBank + rollingCashFlow;

      priorYearWasUnlocked = true;
      return {
        year:Number(y.year),
        yearLocked:false,
        isFirstUnlockedYear:true,
        windowLabel:`Start ${y.year} → Feb ${y.year}`,
        startingBank,
        priorMarchToDecemberCashFlow:0,
        januaryCashFlow,
        februaryCashFlowBeforeInvestment,
        rollingCashFlow,
        combined,
        positiveCombined:Math.max(0,combined)
      };
    }

    const prevSeries = monthlySeries?.[yIdx-1];
    const priorMarchToDecemberCashFlow = (prevSeries?.months||[])
      .slice(2,12)
      .reduce((sum,month)=>sum+monthCashFlow(month),0);

    const rollingCashFlow =
      priorMarchToDecemberCashFlow +
      januaryCashFlow +
      februaryCashFlowBeforeInvestment;

    priorYearWasUnlocked = true;
    return {
      year:Number(y.year),
      yearLocked:false,
      isFirstUnlockedYear:false,
      windowLabel:`Mar ${Number(y.year)-1} → Feb ${y.year}`,
      startingBank:0,
      priorMarchToDecemberCashFlow,
      januaryCashFlow,
      februaryCashFlowBeforeInvestment,
      rollingCashFlow,
      combined:rollingCashFlow,
      positiveCombined:Math.max(0,rollingCashFlow)
    };
  });
}

function investModeOf(y){
  if(y && (y.planMode==="monthly" || y.planMode==="yearly" || y.planMode==="spread")) return y.planMode;
  return (api.state.investMode==="monthly"||api.state.investMode==="spread") ? api.state.investMode : "yearly";
}

function investSpreadMonths(y){
  const src = (y && Array.isArray(y.planMonths) && y.planMonths.length) ? y.planMonths : api.state.investMonths;
  const a = Array.isArray(src) ? src.filter(n=>Number.isInteger(n)&&n>=0&&n<=11) : [];
  const u = [...new Set(a)].sort((x,y)=>x-y);
  return u.length ? u : [1];
}

function investMonthOf(y){
  const v = Number.isInteger(y?.planMonth) ? y.planMonth : (Number.isInteger(api.state.investMonth) ? api.state.investMonth : 1);
  return Math.min(11,Math.max(0,v));
}

function investMonthlyBase(y){
  const v = (y && (y.planBase==="pool"||y.planBase==="cashflow")) ? y.planBase : api.state.investMonthlyBase;
  return v==="pool" ? "pool" : "cashflow";
}

function planMonthsForYear(y){
  const m = investModeOf(y);
  if(m==="monthly") return [0,1,2,3,4,5,6,7,8,9,10,11];
  if(m==="spread") return investSpreadMonths(y);
  return [investMonthOf(y)];
}

function yearPlanPct(y){
  const own = normalizeInvestmentPlanPct(y?.rrspPlanPct);
  if(own!==null) return own;
  const years = api.state.years || [];
  for(let i=years.indexOf(y); i>=0; i--){
    const v = normalizeInvestmentPlanPct(years[i].rrspPlanPct);
    // A manual % wins; a blank one only means "off" if the user stopped the plan (older saves have blank
    // manual years that were never a stop, and those inherit).
    if(years[i].rrspPlanPctManual===true && (v!==null || years[i].planStopped===true)) return v;
  }
  return normalizeInvestmentPlanPct(api.state.investPct);
}

function isInvestmentPlanYearLocked(yearObj){
  const months = planMonthsForYear(yearObj);
  return months.length>0 && months.every(mi=>!!yearObj?.months?.[mi]?.locked);
}

function annualAccountContribExcludingFebruary(yearObj,accountId){
  const managed = new Set(planMonthsForYear(yearObj));
  return (yearObj?.months||[]).reduce((sum,m,mIdx)=>{
    if(managed.has(mIdx) && !m?.locked) return sum;
    return sum + Math.max(0,Number(m?.[accountId])||0);
  },0);
}

let planSeriesCache = null;

function planSeries(){
  if(!planSeriesCache) planSeriesCache = api.computeMonthlySeries();
  return planSeriesCache;
}

function calculateInvestmentPlanAllocation(yearObj,row){
  const pct = yearPlanPct(yearObj);
  const active = investmentPlanPctIsActive(pct) && !yearObj?.planAutoOff;
  const mode = investModeOf(yearObj);
  const months = planMonthsForYear(yearObj);
  const base = investMonthlyBase(yearObj);
  const allocation = {rrspA:0,tfsaA:0,rrspB:0,tfsaB:0};
  const monthly = Array.from({length:12},()=>({rrspA:0,tfsaA:0,rrspB:0,tfsaB:0}));
  const room = {};
  const capacity = {};
  const roomSet = {};
  const otherContrib = {};

  INVESTMENT_ACCOUNT_IDS.forEach(accountId=>{
    const cap = getPlanRoomCap(yearObj,accountId);
    const usedOutside = annualAccountContribExcludingFebruary(yearObj,accountId);
    room[accountId] = cap;
    roomSet[accountId] = cap!==null;
    otherContrib[accountId] = usedOutside;
    capacity[accountId] = cap===null ? 0 : Math.max(0,cap-usedOutside);
  });

  let target = 0;
  let remainingTotal = 0;
  const priority = getInvestmentPriority();
  const fill = (amount,capLeft)=>{
    const out = {rrspA:0,tfsaA:0,rrspB:0,tfsaB:0};
    let remaining = amount;
    priority.forEach(accountId=>{
      if(remaining<=0) return;
      const a = Math.min(remaining, capLeft[accountId]||0);
      out[accountId] = api.roundDollar(a);
      capLeft[accountId] = Math.max(0,(capLeft[accountId]||0)-out[accountId]);
      remaining = Math.max(0,api.roundDollar(remaining-out[accountId]));
    });
    return {out,remaining};
  };

  if(active){
    const capLeft = Object.assign({},capacity);
    if(mode==="monthly" && base==="cashflow"){
      // Each month: pct of that month's net cash flow before investing.
      const yIdx = api.state.years.indexOf(yearObj);
      const ys = planSeries()[yIdx];
      months.forEach(mi=>{
        if(yearObj.months?.[mi]?.locked) return;
        const c = ys?.months?.[mi];
        const net = (Number(c?.displayNetCashFlow)||0) + (Number(c?.tfsaContrib)||0) + (Number(c?.rrspContrib)||0);
        const t = api.roundDollar(Math.max(0,net) * pct / 100);
        target += t;
        const r = fill(t,capLeft);
        INVESTMENT_ACCOUNT_IDS.forEach(id=>{ monthly[mi][id]=r.out[id]; allocation[id]+=r.out[id]; });
        remainingTotal += r.remaining;
      });
    }else{
      target = api.roundDollar((Number(row?.positiveCombined)||0) * pct / 100);
      // Amounts already recorded in locked plan months count toward the target.
      const openMonths = months.filter(mi=>!yearObj.months?.[mi]?.locked);
      const alreadyIn = months.filter(mi=>yearObj.months?.[mi]?.locked)
        .reduce((sum,mi)=>sum + INVESTMENT_ACCOUNT_IDS.reduce((t,id)=>t + Math.max(0,Number(yearObj.months[mi][id])||0),0),0);
      const r = fill(Math.max(0, target - alreadyIn),capLeft);
      INVESTMENT_ACCOUNT_IDS.forEach(id=>{ allocation[id]=r.out[id]; });
      remainingTotal = r.remaining;
      if((mode==="monthly" || mode==="spread") && openMonths.length){
        // Yearly pool split evenly across the unlocked chosen months (remainder in the last).
        const n = openMonths.length;
        INVESTMENT_ACCOUNT_IDS.forEach(id=>{
          const each = Math.floor(allocation[id]/n);
          let left = allocation[id];
          openMonths.forEach((mi,k)=>{
            const v = k===n-1 ? left : each;
            monthly[mi][id] = v; left -= v;
          });
        });
      }else{
        INVESTMENT_ACCOUNT_IDS.forEach(id=>{ monthly[months[0]][id]=allocation[id]; });
      }
    }
  }

  return {
    active,pct,target,allocation,monthly,mode,months,room,roomSet,capacity,otherContrib,
    unallocated:Math.max(0,remainingTotal),
    allRoomsSet:INVESTMENT_ACCOUNT_IDS.every(id=>roomSet[id])
  };
}

function syncInvestmentPlanToFebruary(){
  // (Name kept for compatibility.) Writes the auto plan into its target month(s).
  if(!Array.isArray(api.state.years) || !api.state.years.length) return false;
  let changed=false;
  const maxPasses = Math.min(40, api.state.years.length + 3);
  for(let pass=0; pass<maxPasses; pass++){
    planSeriesCache = null;
    api.invalidateDrawdownCache();
    const roomChanged = refreshProjectedContributionRooms();
    const rows = computeInvestmentPlanAvailableIncome();
    let passChanged = roomChanged;
    api.state.years.forEach((y,idx)=>{
      const plan = calculateInvestmentPlanAllocation(y,rows[idx]);
      if(!plan.active || !y.months || isInvestmentPlanYearLocked(y)) return;
      const targets = new Set(plan.months);
      const prev = Array.isArray(y.planMonthsWritten) ? y.planMonthsWritten : [1];
      // Clear months written by an earlier setting (e.g. switched month or mode).
      prev.forEach(mi=>{
        if(targets.has(mi)) return;
        const m = y.months[mi];
        if(!m || m.locked) return;
        INVESTMENT_ACCOUNT_IDS.forEach(id=>{ if((Number(m[id])||0)!==0){ m[id]=0; passChanged=true; } });
      });
      plan.months.forEach(mi=>{
        const m = y.months[mi];
        if(!m || m.locked) return;
        INVESTMENT_ACCOUNT_IDS.forEach(accountId=>{
          const amount = Number(plan.monthly[mi][accountId])||0;
          if((Number(m[accountId])||0)!==amount){ m[accountId]=amount; passChanged=true; }
        });
      });
      const written = plan.months.slice();
      if(JSON.stringify(y.planMonthsWritten)!==JSON.stringify(written)){ y.planMonthsWritten = written; passChanged=true; }
    });
    changed = changed || passChanged;
    if(!passChanged) break;
  }
  planSeriesCache = null;
  refreshProjectedContributionRooms();
  return changed;
}

const TFSA_HISTORICAL_LIMITS = {2009:5000,2010:5000,2011:5000,2012:5000,2013:5500,2014:5500,2015:10000,2016:5500,2017:5500,2018:5500,2019:6000,2020:6000,2021:6000,2022:6000,2023:6500,2024:7000,2025:7000,2026:7000};

function estimatePlanRoomSeed(yearIdx,accountId){
  const y = api.state.years[yearIdx];
  const Y = Number(y.year);
  const personA = accountId.endsWith("A");
  if(accountId.startsWith("tfsa")){
    const age = Number(personA ? api.state.ageA : api.state.ageB);
    const base = Number(api.state.baseYear)||Y;
    const first = Number.isFinite(age) && age>0 ? Math.max(2009, base-age+18) : 2009;
    let total = 0;
    for(let yr=first; yr<=Y; yr++) total += TFSA_HISTORICAL_LIMITS[yr] ?? LATEST_PUBLISHED_TFSA_LIMIT;
    const existing = Number(personA ? api.state.startTFSAA : api.state.startTFSAB)||0;
    return {value:api.roundDollar(Math.max(0,total-existing)), note:`cumulative TFSA limits from ${first} to ${Y} (${api.fmt(total)}) minus current TFSA balance (${api.fmt(existing)})`};
  }
  const chain = api.computeSalaryChain();
  const gross = Math.max(0,Number(personA ? chain?.[yearIdx]?.grossA : chain?.[yearIdx]?.grossB)||0);
  const cap = CRA_RRSP_DOLLAR_LIMITS[Y] ?? null;
  const v = cap===null ? gross*0.18 : Math.min(gross*0.18,cap);
  return {value:api.roundDollar(v), note:`18% of ${api.fmt(gross)} gross income${cap===null?'':`, capped at the ${Y} limit of ${api.fmt(cap)}`} (unused past room not included)`};
}
Object.assign(api, {CRA_RRSP_DOLLAR_LIMITS, CRA_TFSA_DOLLAR_LIMITS, INVESTMENT_ACCOUNT_IDS, LATEST_PUBLISHED_TFSA_LIMIT_YEAR, LATEST_PUBLISHED_TFSA_LIMIT, investmentPlanPctIsActive, normalizeInvestmentPlanPct, investmentPlanPctSame, deriveInvestmentPlanPctBreakpointsFromValues, rebuildInvestmentPlanPctInheritance, migrateInvestmentPlanPctInheritance, legacyAnnualReturnDefault, normalizeAnnualReturnPct, annualReturnPctSame, rebuildAnnualReturnPctInheritance, migrateAnnualReturnPctInheritance, computeAnnualReturnPctChain, effectiveAnnualReturnForPerson, readFebruaryInvestmentValues, isValidInvestmentPlanBackup, captureInvestmentPlanPreAuto, restoreInvestmentPlanPreAuto, clearInvestmentPlanPreAuto, databaseLogValueAsMoney, recoverInvestmentPlanPreAutoFromDatabase, getInvestmentPriority, RRSP_LAST_CONTRIBUTION_AGE, RRIF_FACTORS, rrifMinimumFactor, rrspClosedFor, getPlanRoomCap, ensurePlanRoomMeta, annualAccountContribTotal, indexedPublishedLimit, projectedTfsaAnnualLimit, projectedRrspNewRoom, deriveContributionRoomForYear, updateProjectedContributionRoomForYear, refreshProjectedContributionRooms, computeInvestmentPlanAvailableIncome, investModeOf, investSpreadMonths, investMonthOf, investMonthlyBase, planMonthsForYear, yearPlanPct, isInvestmentPlanYearLocked, annualAccountContribExcludingFebruary, planSeriesCache, planSeries, calculateInvestmentPlanAllocation, syncInvestmentPlanToFebruary, TFSA_HISTORICAL_LIMITS, estimatePlanRoomSeed});
}

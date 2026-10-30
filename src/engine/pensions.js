// Calculation logic ported from the reference; independent of browser APIs.
export function registerPensions(api) {
function computePensionModeChain(){
  let carry = null;
  return (api.state.years||[]).map(y=>{
    const manual = typeof y.pensionModeOverride==="boolean";
    if(manual) carry = y.pensionModeOverride;
    const eligible = api.isRetirementYear(y.year);
    return {
      active: eligible && (carry ?? api.state.retirementAuto !== false),
      carried: carry,
      manual,
      source: manual ? (carry ? "start" : "stop") : "inherited"
    };
  });
}

function personAgeInYear(person, year){
  const raw = person==="B" ? api.state.ageB : api.state.ageA;
  if(raw===null || raw===undefined || raw==="" || !Number.isFinite(Number(raw))) return null;
  const base = Number(api.state.baseYear)||api.PENSION_ESTIMATE_BASE_YEAR;
  return Number(raw) + (Number(year) - base);
}

const CPP_START_AGE_RANGE = [60, 70];

const OAS_START_AGE_RANGE = [65, 70];

const CPP_CONTRIBUTORY_START_AGE = 18;

const CPP_DROPOUT_SHARE = 0.17;

function pensionSettings(person){
  const p = (api.state.pensions && api.state.pensions[person]) || {};
  const age = (v, [lo,hi])=>{ const n = Math.round(Number(v)); return Number.isFinite(n) && v!==null && v!=="" ? Math.min(hi, Math.max(lo, n)) : 65; };
  const pct = (p.cppPct===null || p.cppPct===undefined || p.cppPct==="" || !Number.isFinite(Number(p.cppPct))) ? null : Math.min(100, Math.max(0, Number(p.cppPct)));
  return {cppStartAge:age(p.cppStartAge, CPP_START_AGE_RANGE), oasStartAge:age(p.oasStartAge, OAS_START_AGE_RANGE), cppPct:pct};
}

function ensurePensionSettings(){
  if(!api.state.pensions || typeof api.state.pensions!=="object") api.state.pensions = {};
  ["A","B"].forEach(person=>{
    const s = pensionSettings(person);
    api.state.pensions[person] = {cppStartAge:s.cppStartAge, oasStartAge:s.oasStartAge, cppPct:s.cppPct};
  });
}

function cppStartFactor(startAge){ return startAge<65 ? 1 - 0.006*12*(65-startAge) : 1 + 0.007*12*(startAge-65); }

function oasStartFactor(startAge){ return 1 + 0.006*12*(Math.max(65,startAge)-65); }

function estimateCppShare(person, salaryRows){
  const settings = pensionSettings(person);
  if(settings.cppPct!==null) return settings.cppPct/100;
  const base = Number(api.state.baseYear)||api.PENSION_ESTIMATE_BASE_YEAR;
  const ageAtBase = personAgeInYear(person, base);
  if(ageAtBase===null) return 1;
  const ratioFor = (salary, year)=>{
    const earnings = Math.max(0, Number(salary)||0);
    return earnings > api.TAX_RULES_2026.cpp.ybe ? Math.min(1, earnings / (api.TAX_RULES_2026.cpp.ympe*api.taxIndexFactor(year))) : 0;
  };
  const baseRow = salaryRows[0];
  const baseRatio = baseRow ? ratioFor(baseRow.salary, base) : 0;
  // Years before 65 (or the start age) get the 17% dropout. Years worked after
  // 65 can replace lower earlier years, but never lower the average.
  const ratios = [], after65 = [];
  for(let age=CPP_CONTRIBUTORY_START_AGE; age<settings.cppStartAge; age++){
    const year = base + (age - ageAtBase);
    const row = year < base ? null : salaryRows[year - base];
    const ratio = year < base ? baseRatio : (row && !row.pensionActive ? ratioFor(row.salary, year) : 0);
    (age < 65 ? ratios : after65).push(ratio);
  }
  if(!ratios.length) return baseRatio;
  ratios.sort((a,b)=>b-a);
  const kept = ratios.slice(0, Math.max(1, ratios.length - Math.floor(ratios.length*CPP_DROPOUT_SHARE)));
  after65.sort((a,b)=>b-a).forEach(r=>{
    if(r > kept[kept.length-1]){ kept[kept.length-1] = r; kept.sort((a,b)=>b-a); }
  });
  return kept.reduce((s,r)=>s+r,0) / kept.length;
}

function estimatedPublicPension(person, year, cppShare){
  const age = personAgeInYear(person, year);
  const s = pensionSettings(person);
  const inflation = api.inflationFraction();
  const indexFactor = Math.pow(1+inflation, Math.max(0, Number(year)-api.PENSION_ESTIMATE_BASE_YEAR));
  const share = Number.isFinite(cppShare) ? cppShare : 1;
  // Without an age the start ages can't be checked, so both are paid (the old behaviour).
  const cppOn = age===null || age >= s.cppStartAge;
  const oasOn = age===null || age >= s.oasStartAge;
  const oasMonthly = (age!==null && age>=75) ? api.OAS_MAX_MONTHLY_75_PLUS_2026 : api.OAS_MAX_MONTHLY_65_74_2026;
  const cpp = cppOn ? api.CPP_MAX_MONTHLY_2026*12*share*cppStartFactor(s.cppStartAge)*indexFactor : 0;
  const oasYear = Number(year)===api.PENSION_ESTIMATE_BASE_YEAR
    ? ((age!==null && age>=75) ? api.OAS_2026_ANNUAL_75_PLUS : api.OAS_2026_ANNUAL_65_74)
    : oasMonthly*12;
  const oas = oasOn ? oasYear*oasStartFactor(s.oasStartAge)*indexFactor : 0;
  return {cpp, oas, total:cpp+oas, age, share, settings:s};
}

function computeSalaryGrowthChain(){
  const sharedDefault = Number(api.state.raiseA)||0;
  let carry = sharedDefault;
  return api.state.years.map((y,idx)=>{
    if(idx===0) return {pct:0, manual:false, source:"base"};
    const raw = y.salaryGrowthPct;
    const manual = raw!==null && raw!=="" && raw!==undefined && Number.isFinite(Number(raw));
    if(manual) carry = Number(raw);
    return {pct:carry, manual, source:manual?"manual":"auto"};
  });
}

function computeSalaryPath(){
  const growthChain = computeSalaryGrowthChain();
  const pensionChain = computePensionModeChain();
  let prevA = null, prevB = null;
  return api.state.years.map((y,idx)=>{
    const growth = growthChain[idx];
    let salaryGrossA, salaryGrossB;
    if(idx===0){
      salaryGrossA = Number(y.grossA)||0;
      salaryGrossB = api.state.singlePerson ? 0 : (Number(y.grossB)||0);
    } else {
      const rate = growth.pct/100;
      const set = v=>v!==null && v!=="" && v!==undefined;
      salaryGrossA = set(y.grossA) ? Number(y.grossA) : prevA*(1+rate);
      salaryGrossB = api.state.singlePerson ? 0 : (set(y.grossB) ? Number(y.grossB) : prevB*(1+rate));
    }
    prevA = salaryGrossA; prevB = salaryGrossB;
    return {year:y.year, salaryGrossA, salaryGrossB, growth, pension:pensionChain[idx] || {active:false,manual:false}};
  });
}

function salaryRowsFor(person, path){
  return (path || computeSalaryPath()).map(r=>({year:r.year, salary:person==="B" ? r.salaryGrossB : r.salaryGrossA, pensionActive:!!r.pension.active}));
}

function computeSalaryChain(){
  const path = computeSalaryPath();
  const cppShareA = estimateCppShare("A", salaryRowsFor("A", path));
  const cppShareB = api.state.singlePerson ? 0 : estimateCppShare("B", salaryRowsFor("B", path));

  return path.map(r=>{
    const year = r.year;
    const personRow = (person, salaryGross, cppShare)=>{
      const age = personAgeInYear(person, year);
      if(person==="B" && api.state.singlePerson) return {gross:0, at:0, ctx:{year, age}, tax:api.personTax({year, age}), pension:null};
      if(r.pension.active){
        const pension = estimatedPublicPension(person, year, cppShare);
        // CPP and OAS are taxable but don't qualify for the pension credit.
        const ctx = {year, age, other:pension.total, oas:pension.oas};
        const tax = api.personTax(ctx);
        return {gross:pension.total, at:pension.total - tax.total, ctx, tax, pension};
      }
      const ctx = {year, age, employment:salaryGross};
      const tax = api.personTax(ctx);
      return {gross:salaryGross, at:salaryGross - tax.total, ctx, tax, pension:null};
    };
    const a = personRow("A", r.salaryGrossA, cppShareA);
    const b = personRow("B", r.salaryGrossB, cppShareB);
    return {
      grossA:a.gross, atA:a.at, grossB:b.gross, atB:b.at, totalAfterTax:a.at+b.at,
      growthPct:r.growth.pct, growthManual:r.growth.manual,
      pensionActive:!!r.pension.active, pensionManual:!!r.pension.manual,
      salaryGrossA:r.salaryGrossA, salaryGrossB:r.salaryGrossB,
      // Tax detail per person: the context for withdrawals/refunds, and the breakdown.
      taxCtxA:a.ctx, taxCtxB:b.ctx, taxA:a.tax, taxB:b.tax,
      pensionA:a.pension, pensionB:b.pension, cppShareA, cppShareB
    };
  });
}
Object.assign(api, {computePensionModeChain, personAgeInYear, CPP_START_AGE_RANGE, OAS_START_AGE_RANGE, CPP_CONTRIBUTORY_START_AGE, CPP_DROPOUT_SHARE, pensionSettings, ensurePensionSettings, cppStartFactor, oasStartFactor, estimateCppShare, estimatedPublicPension, computeSalaryGrowthChain, computeSalaryPath, salaryRowsFor, computeSalaryChain});
}

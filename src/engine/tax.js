// Calculation logic ported from the reference; independent of browser APIs.
import { provincialTax } from './provinces.js';
export function registerTax(api) {
const TAX_RULES_YEAR = 2026;

const TAX_RULES_2026 = {
  fed:{bpaMax:16452, bpaMin:14829, bpaPhaseStart:181440, bpaPhaseEnd:258482,
       employmentAmount:1501, ageAmount:9208, ageThreshold:46432,
       pensionAmount:2000},                 // pension amount is not indexed
  on:{bpa:12989, ageAmount:6342, ageThreshold:47210, pensionAmount:1796,
      surtax1:5818, surtax2:7446, reductionBasic:300,
      unindexedFrom:150000},                // the $150,000 and $220,000 brackets are not indexed
  cpp:{ympe:74600, ybe:3500, yampe:85000,   // the $3,500 basic exemption is not indexed
       rate:0.0595, baseRate:0.0495, cpp2Rate:0.04},
  ei:{maxInsurable:68900, rate:0.0163},
  oas:{recoveryThreshold:95323, recoveryRate:0.15},
  ageCreditReduction:0.15
};

const LEGACY_DEFAULT_BRACKETS_JSON = JSON.stringify({
  federal:[{threshold:235675,rate:0.33},{threshold:165430,rate:0.29},{threshold:106717,rate:0.26},{threshold:53359,rate:0.205},{threshold:0,rate:0.15}],
  ontario:[{threshold:220000,rate:0.1316},{threshold:150000,rate:0.1216},{threshold:98460,rate:0.1116},{threshold:49230,rate:0.0915},{threshold:0,rate:0.0505}]
});

function bracketsMatch(a, b){
  const norm = list=>[...(list||[])].map(x=>[Number(x.threshold)||0, Number(x.rate)||0]).sort((p,q)=>p[0]-q[0]);
  const same = (p,q)=>p.length===q.length && p.every((x,i)=>Math.abs(x[0]-q[i][0])<0.5 && Math.abs(x[1]-q[i][1])<1e-6);
  return same(norm(a?.federal), norm(b?.federal)) && same(norm(a?.ontario), norm(b?.ontario));
}

function migrateTaxRules(){
  if(!api.state.brackets || !Array.isArray(api.state.brackets.federal) || !Array.isArray(api.state.brackets.ontario)
     || bracketsMatch(api.state.brackets, JSON.parse(LEGACY_DEFAULT_BRACKETS_JSON))){
    api.state.brackets = JSON.parse(JSON.stringify(api.defaultBrackets));
  }
}

function taxIndexFactor(year){
  const inflation = api.inflationFraction();
  return Math.pow(1+inflation, Math.max(0, (Number(year)||TAX_RULES_YEAR) - TAX_RULES_YEAR));
}

function indexedBrackets(list, factor, unindexedFrom=Infinity){
  return (list||[]).map(b=>({threshold: b.threshold>=unindexedFrom ? b.threshold : b.threshold*factor, rate:b.rate}))
    .sort((a,b)=>b.threshold-a.threshold);
}

let taxBracketCache = {brackets:null, inflation:null, years:new Map()};

function taxBracketsForYear(year, factor){
  const inflation = Number(api.state.inflationRate)||0;
  if(taxBracketCache.brackets!==api.state.brackets || taxBracketCache.inflation!==inflation){
    taxBracketCache = {brackets:api.state.brackets, inflation, years:new Map()};
  }
  const key = Number(year)||TAX_RULES_YEAR;
  let entry = taxBracketCache.years.get(key);
  if(!entry){
    entry = {
      fed:indexedBrackets(api.state.brackets.federal, factor),
      on:indexedBrackets(api.state.brackets.ontario, factor, TAX_RULES_2026.on.unindexedFrom),
      fedLow:lowestBracketRate(api.state.brackets.federal),
      onLow:lowestBracketRate(api.state.brackets.ontario)
    };
    taxBracketCache.years.set(key, entry);
  }
  return entry;
}

function sortedBracketTax(income, sorted){
  let tax = 0;
  for(let i=0;i<sorted.length;i++){
    const lower = sorted[i].threshold;
    if(income > lower){
      const upper = i===0 ? Infinity : sorted[i-1].threshold;
      tax += (Math.min(income, upper) - lower) * sorted[i].rate;
    }
  }
  return tax;
}

function lowestBracketRate(list){
  const sorted = [...(list||[])].sort((a,b)=>a.threshold-b.threshold);
  return sorted.length ? Number(sorted[0].rate)||0 : 0;
}

function personTax(ctx){
  ctx = ctx || {};
  const employment = Math.max(0, Number(ctx.employment)||0);
  const other = Math.max(0, Number(ctx.other)||0);
  const deduction = Math.max(0, Number(ctx.deduction)||0);
  if(api.state.taxModel === "flat"){
    const incomeTax = Math.max(0, employment + other - deduction) * (api.state.flatRate/100);
    return {incomeTax, cpp:0, ei:0, oasClawback:0, total:incomeTax, netIncome:Math.max(0, employment + other - deduction)};
  }
  const R = TAX_RULES_2026;
  const province = api.state.province || 'ON';
  const quebec = province === 'QC';
  const f = taxIndexFactor(ctx.year);
  const age = Number.isFinite(Number(ctx.age)) && ctx.age!==null ? Number(ctx.age) : null;
  const senior = age!==null && age>=65;

  // CPP and EI on employment income. CPP is paid from 18 until 70; without a
  // birth month, the year someone turns 18 counts and the year they turn 70 doesn't.
  const ympe = R.cpp.ympe*f, yampe = R.cpp.yampe*f;
  const cppEmployment = (age!==null && (age < 18 || age >= (quebec ? 73 : 70))) ? 0 : employment;
  const cppBaseEarnings = Math.max(0, Math.min(cppEmployment, ympe) - R.cpp.ybe);
  const cppContribution = cppBaseEarnings * (quebec ? 0.063 : R.cpp.rate);
  const cppBasePart = cppBaseEarnings * (quebec ? 0.053 : R.cpp.baseRate);
  const cppEnhancedPart = cppContribution - cppBasePart;         // deduction
  const cpp2 = Math.max(0, Math.min(cppEmployment, yampe) - ympe) * R.cpp.cpp2Rate;   // deduction
  const ei = Math.min(employment, R.ei.maxInsurable*f) * (quebec ? 0.013 : R.ei.rate);
  const qpip = quebec ? Math.min(employment, 103000*f)*0.0043 : 0;

  const incomeBeforeRepayment = Math.max(0, employment + other - deduction - cppEnhancedPart - cpp2);
  // OAS recovery is worked out on income before it, then deducted (line 23500),
  // so tax and income-tested credits use income after the repayment.
  const oas = Math.max(0, Number(ctx.oas)||0);
  const oasClawback = oas>0 ? Math.min(oas, R.oas.recoveryRate*Math.max(0, incomeBeforeRepayment - R.oas.recoveryThreshold*f)) : 0;
  const netIncome = incomeBeforeRepayment - oasClawback;
  const eligiblePension = senior ? Math.max(0, Number(ctx.eligiblePension)||0) : 0;
  const ageAmount = (amount, threshold)=> senior ? Math.max(0, amount*f - R.ageCreditReduction*Math.max(0, netIncome - threshold*f)) : 0;

  const brackets = taxBracketsForYear(ctx.year, f);

  // Federal
  let bpa = R.fed.bpaMax*f;
  if(netIncome > R.fed.bpaPhaseStart*f){
    const span = (R.fed.bpaPhaseEnd - R.fed.bpaPhaseStart)*f;
    bpa = R.fed.bpaMax*f - Math.min(1, (netIncome - R.fed.bpaPhaseStart*f)/span) * (R.fed.bpaMax - R.fed.bpaMin)*f;
  }
  const fedCredits = bpa + Math.min(employment, R.fed.employmentAmount*f) + cppBasePart + ei + qpip
    + ageAmount(R.fed.ageAmount, R.fed.ageThreshold) + Math.min(R.fed.pensionAmount, eligiblePension);
  const fedTax = Math.max(0, sortedBracketTax(netIncome, brackets.fed) - brackets.fedLow*fedCredits) * (quebec ? 0.835 : 1);

  // Ontario
  const onCredits = R.on.bpa*f + cppBasePart + ei
    + ageAmount(R.on.ageAmount, R.on.ageThreshold) + Math.min(R.on.pensionAmount*f, eligiblePension);
  const onBasic = Math.max(0, sortedBracketTax(netIncome, brackets.on) - brackets.onLow*onCredits);
  const surtax = 0.20*Math.max(0, onBasic - R.on.surtax1*f) + 0.36*Math.max(0, onBasic - R.on.surtax2*f);
  const beforeReduction = onBasic + surtax;
  const reduction = Math.min(beforeReduction, Math.max(0, 2*R.on.reductionBasic*f - beforeReduction));
  const onTax = province==='ON' ? beforeReduction - reduction : 0;
  const provTax = province==='ON' ? onTax : provincialTax(province,{netIncome,employment,cppBasePart,ei,qpip,factor:f,federalBpa:bpa,year:Number(ctx.year)||2026,inflation:api.inflationFraction()});
  const healthPremium = province==='ON' ? ontarioHealthPremium(netIncome) : 0;

  const incomeTax = fedTax + provTax + healthPremium;
  const payroll = cppContribution + cpp2 + ei + qpip;
  return {incomeTax, cpp:cppContribution + cpp2, ei, oasClawback, total:incomeTax + payroll + oasClawback, netIncome,
    fedTax, onTax, provTax, qpip, healthPremium};
}

function ontarioHealthPremium(income){
  const a = Number(income)||0;
  if(a<=20000) return 0;
  if(a<=36000) return Math.min(300, 0.06*(a-20000));
  if(a<=48000) return Math.min(450, 300 + 0.06*(a-36000));
  if(a<=72000) return Math.min(600, 450 + 0.25*(a-48000));
  if(a<=200000) return Math.min(750, 600 + 0.25*(a-72000));
  return Math.min(900, 750 + 0.25*(a-200000));
}

function taxContextFor(base){
  return (base && typeof base==="object") ? base : {other:Math.max(0, Number(base)||0)};
}

function incomeTaxOn(ctx){ const t = personTax(ctx); return t.incomeTax + t.oasClawback; }

function withContextIncome(ctx, extra){
  const c = taxContextFor(ctx);
  return Object.assign({}, c, {
    other:(Number(c.other)||0) + extra,
    // Only RRIF income qualifies for the pension credit; in this model the RRSP
    // becomes a RRIF from the year after the person turns 71.
    eligiblePension:(Number(c.eligiblePension)||0) + (Number(c.age) > api.RRSP_LAST_CONTRIBUTION_AGE ? extra : 0)
  });
}

function withdrawalTaxIncrement(base, ytdWithdrawn, gross){
  const ytd = Math.max(0, Number(ytdWithdrawn)||0);
  return incomeTaxOn(withContextIncome(base, ytd + gross)) - incomeTaxOn(withContextIncome(base, ytd));
}

function grossUpWithdrawal(netNeeded, base, ytdWithdrawn, maxGross){
  netNeeded = Math.max(0, Number(netNeeded)||0);
  const cap = Number.isFinite(maxGross) ? Math.max(0, maxGross) : Infinity;
  if(netNeeded <= 0 || cap <= 0) return {gross:0, net:0, tax:0};
  const ytd = Math.max(0, Number(ytdWithdrawn)||0);
  const baseTax = incomeTaxOn(withContextIncome(base, ytd));   // the same for every candidate
  const taxOf = g => incomeTaxOn(withContextIncome(base, ytd + g)) - baseTax;
  const netOf = g => g - taxOf(g);
  if(netOf(cap) <= netNeeded + 0.005){
    const tax = taxOf(cap);
    return {gross:cap, net:cap - tax, tax};
  }
  let lo = 0, hi = Math.min(cap, Math.max(netNeeded, 1));
  for(let i=0; i<60 && netOf(hi) < netNeeded; i++){
    lo = hi; hi = Math.min(cap, hi*2);
    if(hi >= cap) break;
  }
  // 50 halvings narrow any realistic range to well under a cent.
  for(let i=0; i<50; i++){
    const mid = (lo+hi)/2;
    if(netOf(mid) < netNeeded) lo = mid; else hi = mid;
  }
  const gross = hi;
  const tax = taxOf(gross);
  return {gross, net:gross - tax, tax};
}
Object.assign(api, {TAX_RULES_YEAR, TAX_RULES_2026, LEGACY_DEFAULT_BRACKETS_JSON, bracketsMatch, migrateTaxRules, taxIndexFactor, indexedBrackets, taxBracketCache, taxBracketsForYear, sortedBracketTax, lowestBracketRate, personTax, ontarioHealthPremium, taxContextFor, incomeTaxOn, withContextIncome, withdrawalTaxIncrement, grossUpWithdrawal});
}

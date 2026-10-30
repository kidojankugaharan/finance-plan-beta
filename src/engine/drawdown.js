// Calculation logic ported from the reference; independent of browser APIs.
import {PROVINCES} from './provinces.js';
export function registerDrawdown(api) {
const DEFAULT_DRAW_POLICY = {mode:"monthly", month:0, strategy:"fixed", ceiling:0, rrspPct:0};

const DRAW_STRATEGIES = {
  fill:{label:"RRSP bracket-fill", tag:"Automatic",
    desc:"Draws RRSP first up to the income level that saves the most tax over the following years, then TFSA. Uses cheap low-bracket room in low-income years."},
  tfsaLow:{label:"TFSA-preserving", tag:"Automatic",
    desc:"Keeps TFSA for higher-income years. Uses RRSP only for the low-income room (bottom federal bracket), whichever of that or TFSA-first saves more tax."},
  manual:{label:"Manual", tag:"You choose",
    desc:"You choose what share of every withdrawal comes from RRSP; the rest comes from TFSA."},
  fixed:{label:"Simple order", tag:"Basic",
    desc:"TFSA first, then RRSP. No tax planning."}
};

const DRAW_EVAL_YEARS_AFTER_WINDOW = 10;

const DRAW_TERMINAL_SPREAD_YEARS = 10;

let drawdownCache = null;

function invalidateDrawdownCache(){ drawdownCache = null; }

function drawdownBracketThresholds(){
  const set = new Set();
  [api.state.brackets?.federal, api.state.province && api.state.province!=='ON' ? PROVINCES[api.state.province]?.brackets : api.state.brackets?.ontario].forEach(list=>{
    (list||[]).forEach(b=>{ const t = Number(b.threshold); if(t>0) set.add(Math.round(t)); });
  });
  return [...set].sort((a,b)=>a-b);
}

function drawdownLowIncomeLimit(){
  const fed = (api.state.brackets?.federal||[]).map(b=>Number(b.threshold)).filter(t=>t>0).sort((a,b)=>a-b);
  return fed.length ? fed[0] : 0;
}

function detectDrawdownWindows(series){
  const wins = [];
  let cur = null;
  (series||[]).forEach(ys=>{
    const has = ys.months.some(m=>(Number(m.bankDeficitBeforeWithdrawal)||0)>0.005);
    if(!has) return;
    if(cur && cur.end===ys.year-1) cur.end = ys.year;
    else { cur = {start:ys.year, end:ys.year}; wins.push(cur); }
  });
  return wins;
}

function windowPlanYear(win, claimStart=win.start){
  const plans = api.state.drawdownPlans || {};
  let best = null;
  Object.keys(plans).map(Number).filter(y=>Number.isFinite(y) && y>=claimStart && y<=win.end && plans[y]).forEach(y=>{
    if(best===null || Math.abs(y-win.start) < Math.abs(best-win.start) || (Math.abs(y-win.start)===Math.abs(best-win.start) && y>=win.start)) best = y;
  });
  return best;
}

function getWindowPlan(win, claimStart=win.start){
  const plans = api.state.drawdownPlans || {};
  const planYear = windowPlanYear(win, claimStart);
  let p = planYear===null ? null : plans[planYear];
  const saved = !!p;
  p = p || {};
  const strategy = DRAW_STRATEGIES[p.strategy] ? p.strategy : "fill";
  const mode = p.mode==="lump" ? "lump" : "monthly";
  const month = Math.min(11, Math.max(0, Number(p.month)||0));
  const rrspPct = Number.isFinite(Number(p.rrspPct)) && p.rrspPct!==undefined && p.rrspPct!=="" ? Math.min(100,Math.max(0,Number(p.rrspPct))) : 50;
  return {strategy, mode, month, rrspPct, saved};
}

function drawdownMetrics(series, salaryChain, evalYear){
  let idx = series.findIndex(ys=>ys.year===evalYear);
  if(idx<0) idx = series.length-1;
  let tax = 0, uncovered = 0;
  for(let i=0;i<=idx;i++) series[i].months.forEach(m=>{
    tax += Number(m.autoWithdrawalTax)||0;
    uncovered += Number(m.autoWithdrawalUncovered)||0;
  });
  const end = series[idx].months[11];
  const sal = salaryChain[idx] || {};
  const N = DRAW_TERMINAL_SPREAD_YEARS;
  const term = (rrsp, ctx)=> rrsp>0 ? N*api.withdrawalTaxIncrement(ctx || {}, 0, rrsp/N) : 0;
  const termTax = term(end.rrspBalA, sal.taxCtxA) + (api.state.singlePerson ? 0 : term(end.rrspBalB, sal.taxCtxB));
  const afterTaxNetWorth = end.cashA + end.cashB + end.tfsaBalA + end.tfsaBalB + end.rrspBalA + end.rrspBalB - termTax;
  return {tax, termTax, lifetimeTax:tax+termTax, afterTaxNetWorth, uncovered, evalYear:series[idx].year};
}

function resolveDrawdown(){
  if(drawdownCache) return drawdownCache;
  const empty = {policies:{}, windows:[]};
  drawdownCache = empty;                      // guards against re-entry
  const base = api.computeMonthlySeriesCore({});
  const wins = detectDrawdownWindows(base);
  const policies = {};
  const salaryChain = api.computeSalaryChain();
  const lastYear = base.length ? base[base.length-1].year : 0;
  const out = [];
  const thresholds = drawdownBracketThresholds();
  const lowLimit = drawdownLowIncomeLimit();

  let claimStart = -Infinity;
  wins.forEach(win=>{
    win.claimStart = claimStart;
    claimStart = win.end + 1;
    const plan = getWindowPlan(win, win.claimStart);
    const years = [];
    for(let y=win.start; y<=win.end; y++) years.push(y);
    const apply = (pol)=>{ years.forEach(y=>{ policies[y] = pol; }); };
    const mk = (extra)=>Object.assign({}, DEFAULT_DRAW_POLICY, {mode:plan.mode, month:plan.month}, extra);
    const evalYear = Math.min(lastYear, win.end + DRAW_EVAL_YEARS_AFTER_WINDOW);
    const measure = ()=>drawdownMetrics(api.computeMonthlySeriesCore(policies), salaryChain, evalYear);

    // Baseline: the simple fixed order with the same monthly / lump timing.
    apply(mk({strategy:"fixed"}));
    const fixedMetrics = measure();
    let chosen = mk({strategy:"fixed"});
    let chosenMetrics = fixedMetrics;
    const candidates = [];

    if(plan.strategy==="fill" || plan.strategy==="tfsaLow"){
      let ceilings = plan.strategy==="fill" ? [...thresholds, Infinity] : (lowLimit>0 ? [lowLimit] : []);
      ceilings.forEach(c=>{
        apply(mk({strategy:"ceiling", ceiling:c}));
        const m = measure();
        candidates.push({ceiling:c, lifetimeTax:m.lifetimeTax, afterTaxNetWorth:m.afterTaxNetWorth});
        // Empty portfolios still differ in how much spending they leave unfunded.
        if(m.afterTaxNetWorth - m.uncovered > chosenMetrics.afterTaxNetWorth - chosenMetrics.uncovered + 1){
          chosen = mk({strategy:"ceiling", ceiling:c});
          chosenMetrics = m;
        }
      });
    } else if(plan.strategy==="manual"){
      chosen = mk({strategy:"manual", rrspPct:plan.rrspPct});
      apply(chosen);
      chosenMetrics = measure();
    }
    apply(chosen);
    out.push({
      start:win.start, end:win.end, claimStart:win.claimStart, plan,
      chosen:{strategy:chosen.strategy, ceiling:chosen.ceiling, rrspPct:chosen.rrspPct},
      metrics:chosenMetrics, fixedMetrics, candidates
    });
  });
  drawdownCache = {policies, windows:out};
  return drawdownCache;
}
Object.assign(api, {DEFAULT_DRAW_POLICY, DRAW_STRATEGIES, DRAW_EVAL_YEARS_AFTER_WINDOW, DRAW_TERMINAL_SPREAD_YEARS, drawdownCache, invalidateDrawdownCache, drawdownBracketThresholds, drawdownLowIncomeLimit, detectDrawdownWindows, windowPlanYear, getWindowPlan, drawdownMetrics, resolveDrawdown});
}

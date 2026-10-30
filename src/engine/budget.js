// Calculation logic ported from the reference; independent of browser APIs.
export function registerBudget(api) {
function isNAValue(v){
  const x = String(v??"").trim().toLowerCase().replace(/\s+/g,"");
  return x==="n/a" || x==="na";
}

function budgetItemExcluded(item){ return isNAValue(item.owner) || isNAValue(item.category); }

const BUDGET_OWNER_IDS = ["A","B","Both","n/a"];

function budgetOwnerId(owner){
  if(BUDGET_OWNER_IDS.includes(owner)) return owner;
  if(isNAValue(owner)) return "n/a";
  if(String(owner??"").trim().toLowerCase()==="both") return "Both";
  if(owner===api.state.nameA) return "A";
  if(owner===api.state.nameB) return "B";
  return null;   // a name that no longer matches either person
}

function budgetMode(){ return api.state.budgetMode==="year" ? "year" : "auto"; }

function budgetYearLists(){
  if(!api.state.budgetByYear || typeof api.state.budgetByYear!=="object" || Array.isArray(api.state.budgetByYear)) api.state.budgetByYear = {};
  return api.state.budgetByYear;
}

function budgetListYearFor(year){
  const y = Number(year);
  const keys = Object.keys(budgetYearLists()).map(Number).filter(k=>Number.isFinite(k) && Array.isArray(api.state.budgetByYear[k]) && k<=y);
  return keys.length ? Math.max(...keys) : null;
}

function budgetItemsForYear(year){
  if(budgetMode()==="auto") return Array.isArray(api.state.budgetItems) ? api.state.budgetItems : [];
  const k = budgetListYearFor(year);
  return k===null ? [] : api.state.budgetByYear[k];
}

function budgetYearOf(value){ const v = normalizeMonthValue(value); return v ? Number(v.slice(0,4)) : null; }

function budgetEffectiveItem(item,year){
  if(budgetMode()==="auto") return item;
  const s = normalizeMonthValue(item.startDate), e = normalizeMonthValue(item.endDate);
  if(!s && !e) return item;
  const L = budgetListYearFor(year);
  if(L===null) return null;
  const sy = budgetYearOf(s), ey = budgetYearOf(e);
  if((sy!==null && sy>L) || (ey!==null && ey<L)) return null;
  return Object.assign({}, item, {
    startDate: sy===L ? `${Number(year)}-${s.slice(5)}` : "",
    endDate: ey===L ? `${Number(year)}-${e.slice(5)}` : ""
  });
}

function normalizeMonthValue(value){
  if(!value) return "";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value));
  if(!m) return "";
  const month = Number(m[2]);
  if(month<1 || month>12) return "";
  return `${m[1]}-${m[2]}`;
}

function budgetInflationFactor(year){
  if(budgetMode()==="year") return 1;   // per-year lists hold the amounts for that year as entered
  const n=Math.max(0,Number(year)-Number(api.state.baseYear));
  return Math.pow(1+(Number(api.state.inflationRate)||0)/100,n);
}

function budgetAnnualFrequency(item){
  if(budgetItemExcluded(item) || item.recurrenceType==="none") return 0;
  const t=item.recurrenceType;
  if(t==="once") return 1;
  if(t==="daily") return 365.2425;
  if(t==="weekly") return 365.2425/7;
  if(t==="biweekly") return 365.2425/14;
  if(t==="semimonthly") return 24;
  if(t==="monthly") return 12;
  if(t==="bimonthly") return 6;
  if(t==="quarterly") return 4;
  if(t==="semiannual") return 2;
  if(t==="annual") return 1;
  if(t==="custom") {
    const n=Math.max(1,Number(item.repeatEvery)||1);
    const unit=item.repeatUnit||"months";
    if(unit==="days") return 365.2425/n;
    if(unit==="weeks") return (365.2425/7)/n;
    if(unit==="months") return 12/n;
    if(unit==="years") return 1/n;
  }
  return Number(item.freq)||0;
}

function budgetItemActiveInMonth(item,year,monthIdx){
  if(budgetItemExcluded(item) || item.recurrenceType==="none") return false;
  const monthKey=Number(year)*12+Number(monthIdx);
  const s=normalizeMonthValue(item.startDate);
  const e=normalizeMonthValue(item.endDate);
  if(s){ const [sy,sm]=s.split("-").map(Number); if(monthKey < sy*12+(sm-1)) return false; }
  if(e){ const [ey,em]=e.split("-").map(Number); if(monthKey > ey*12+(em-1)) return false; }
  return true;
}

function budgetMonthly(item,year){
  year = Number(year ?? api.state.baseYear);
  return (Number(item.cost)||0) * budgetAnnualFrequency(item) / 12 * budgetInflationFactor(year);
}

function budgetAmountForMonth(item,year,monthIdx){
  item = budgetEffectiveItem(item,year);
  if(!item || !budgetItemActiveInMonth(item,year,monthIdx)) return 0;
  // A one-time expense with a date is a single lump sum in that month (not a monthly average that runs forever).
  if(item.recurrenceType==="once"){
    const s = normalizeMonthValue(item.startDate);
    if(s){
      const [sy,sm] = s.split("-").map(Number);
      if(Number(year)!==sy || Number(monthIdx)!==sm-1) return 0;
      return (Number(item.cost)||0) * budgetInflationFactor(year);
    }
  }
  return budgetMonthly(item,year);
}

function budgetAnnual(item,year){
  year = Number(year ?? api.state.baseYear);
  let total=0; for(let m=0;m<12;m++) total += budgetAmountForMonth(item,year,m);
  return total;
}

function budgetTotalAnnual(year){ return budgetItemsForYear(year).reduce((s,i)=>s+budgetAnnual(i,year),0); }

function budgetTotalForMonth(year,monthIdx){ return budgetItemsForYear(year).reduce((s,i)=>s+budgetAmountForMonth(i,year,monthIdx),0); }

function budgetOwnerAmountsForMonth(year,monthIdx){
  let a=0,b=0;
  budgetItemsForYear(year).forEach(item=>{
    const amt=budgetAmountForMonth(item,year,monthIdx);
    if(!amt) return;
    const owner=budgetOwnerId(item.owner);
    if(owner==="A") a+=amt;
    else if(owner==="B") b+=amt;
    else if(owner==="Both"){a+=amt/2;b+=amt/2;}
  });
  const total=a+b;
  return total>0 ? {A:a/total,B:b/total,amountA:a,amountB:b} : {A:.5,B:.5,amountA:0,amountB:0};
}
Object.assign(api, {isNAValue, budgetItemExcluded, BUDGET_OWNER_IDS, budgetOwnerId, budgetMode, budgetYearLists, budgetListYearFor, budgetItemsForYear, budgetYearOf, budgetEffectiveItem, normalizeMonthValue, budgetInflationFactor, budgetAnnualFrequency, budgetItemActiveInMonth, budgetMonthly, budgetAmountForMonth, budgetAnnual, budgetTotalAnnual, budgetTotalForMonth, budgetOwnerAmountsForMonth});
}

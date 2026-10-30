// Calculation logic ported from the reference; independent of browser APIs.
export function registerModel(api) {
const PROJECTION_END_YEAR = 2086;

const PENSION_ESTIMATE_BASE_YEAR = 2026;

const CPP_MAX_MONTHLY_2026 = 1507.65;

const OAS_MAX_MONTHLY_65_74_2026 = 762.50;

const OAS_MAX_MONTHLY_75_PLUS_2026 = 838.75;

const OAS_2026_ANNUAL_65_74 = 3*(742.31 + 743.05 + 751.97 + 762.50);

const OAS_2026_ANNUAL_75_PLUS = 3*(816.54 + 817.36 + 827.17 + 838.75);

function retirementStartYear(){
  const base = Number(state?.baseYear);
  const retirementAge = Number(state?.retirementAge);
  const ages = [Number(state?.ageA), ...(state?.singlePerson ? [] : [Number(state?.ageB)])].filter(v=>Number.isFinite(v) && v>0); // a blank age counts as "not entered", so one-person households work
  if(!Number.isFinite(base) || !Number.isFinite(retirementAge) || !ages.length) return Infinity;
  // Household retirement highlighting begins when both people have reached the shared retirement age.
  const youngestAge = Math.min(...ages);
  return Math.round(base + Math.max(0, retirementAge - youngestAge));
}

function isRetirementYear(year){ return Number(year) >= retirementStartYear(); }

function clampReturnPct(v){
  if(v===null || v===undefined || v==="") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(-100, n)) : null;
}

function inflationFraction(){
  return Math.max(-0.99, (Number(state.inflationRate)||0) / 100);
}

function isValidBaseYear(v){
  const n = Number(v);
  return v!==null && v!=="" && Number.isInteger(n) && n>=1900 && n<=PROJECTION_END_YEAR;
}

const defaultBrackets = {
  federal:[
    {threshold:258482, rate:0.33},
    {threshold:181440, rate:0.29},
    {threshold:117045, rate:0.26},
    {threshold:58523,  rate:0.205},
    {threshold:0,      rate:0.14}
  ],
  ontario:[
    {threshold:220000, rate:0.1316},
    {threshold:150000, rate:0.1216},
    {threshold:107785, rate:0.1116},
    {threshold:53891,  rate:0.0915},
    {threshold:0,      rate:0.0505}
  ]
};

function makeDefaultMonths(){
  return Array.from({length:12},(_,i)=>({
    expense:null, earning:null, extraEntries:[], locked:false,
    tfsaA:0, rrspA:0, monthlyReturnOverrideA:null, tfsaReturnOverrideA:null, rrspReturnOverrideA:null, rrspElectPriorA:(i<=1),
    tfsaB:0, rrspB:0, monthlyReturnOverrideB:null, tfsaReturnOverrideB:null, rrspReturnOverrideB:null, rrspElectPriorB:(i<=1)
  }));
}

function defaultBudgetItems(){
  // Fresh install: no budget items.
  return [];
}

let state = {
  nameA:"", nameB:"", ageA:null, ageB:null, baseYear:new Date().getFullYear(), baseYearUserSet:false, retirementAge:65, retirementAuto:true, retirementGoal:null, province:"ON", payGrowthChoice:"",
  inflationRate:2.5, raiseA:0, raiseB:0,
  taxModel:"bracket", flatRate:27,
  brackets: JSON.parse(JSON.stringify(defaultBrackets)),
  singlePerson:false, investPct:20, investMode:"yearly", investMonth:1, investMonthlyBase:"cashflow", investMonths:[2,5,8,11], investmentPriority:["rrspA","tfsaA","rrspB","tfsaB"], investmentRoomPanelOpen:false, returnRateA:7, returnRateB:7, startTFSAA:0, startTFSAB:0, startRRSPA:0, startRRSPB:0, startCashA:0, startCashB:0,
  currentYearIndex:0, activeYearIndex:0,
  ui:{yearFlowPct:42},
  setup:{seen:{}, completed:false},
  taxDeductions:{},
  drawdownPlans:{},
  goals:[],
  budgetItems: defaultBudgetItems(),
  budgetMode:"auto", budgetByYear:{},
  lessons:[],
  years:[]
};

function ensureYearsRange(){
  api.invalidateDrawdownCache();
  if(!state.taxDeductions || typeof state.taxDeductions!=="object") state.taxDeductions = {};
  if(!state.drawdownPlans || typeof state.drawdownPlans!=="object") state.drawdownPlans = {};
  api.migrateTaxRules();
  api.ensurePensionSettings();
  // Years outside the projection range (e.g. after the base year is moved
  // later) are kept in archivedYears rather than deleted, and come back if the
  // base year is moved earlier again.
  const old = [
    ...(Array.isArray(state.years) ? state.years : []),
    ...(Array.isArray(state.archivedYears) ? state.archivedYears : [])
  ].filter(y=>y && typeof y==="object" && Number.isFinite(Number(y.year)));
  const arr = [];
  if(!isValidBaseYear(state.baseYear)){
    state.baseYear = old.length ? Math.min(...old.map(y=>Number(y.year))) : new Date().getFullYear();
    if(!isValidBaseYear(state.baseYear)) state.baseYear = new Date().getFullYear();
  }
  const baseYear = Number(state.baseYear);
  const projectionYears = Math.max(1, PROJECTION_END_YEAR - baseYear + 1);
  const archived = [];
  const seenYears = new Set();
  old.forEach(y=>{
    const yr = Number(y.year);
    if(seenYears.has(yr)) return;
    seenYears.add(yr);
    if(yr<baseYear || yr>PROJECTION_END_YEAR) archived.push(y);
  });
  state.archivedYears = archived.sort((a,b)=>Number(a.year)-Number(b.year));
  for(let i=0;i<projectionYears;i++){
    const yr = baseYear+i;
    let existing = old.find(y=>Number(y.year)===yr);
    if(existing){
      if(!existing.months || existing.months.length!==12) existing.months = makeDefaultMonths();
      // v55: optional shared salary-growth override for this year. Blank/null
      // inherits the latest prior override, or the shared default at the top.
      if(existing.salaryGrowthPct===undefined) existing.salaryGrowthPct = null;
      // v76: optional pension-mode breakpoint. null inherits the latest pension
      // mode above it; true starts pension mode, false stops it.
      if(existing.pensionModeOverride===undefined) existing.pensionModeOverride = null;
      // v83: shared annual investment-return schedule. Investment Plan owns the
      // carry-forward rate; Year-by-Year can override either person for one year.
      if(existing.annualReturnPct===undefined) existing.annualReturnPct = null;
      if(existing.annualReturnPctManual===undefined) existing.annualReturnPctManual = false;
      if(existing.annualReturnOverrideA===undefined) existing.annualReturnOverrideA = null;
      if(existing.annualReturnOverrideB===undefined) existing.annualReturnOverrideB = null;
      // v46: pooled Investment Plan contribution-room caps. Blank/null room means
      // "not verified" and the automatic allocator skips that account.
      if(!existing.planRoomCaps || typeof existing.planRoomCaps!=="object"){
        existing.planRoomCaps = {rrspA:null,tfsaA:null,rrspB:null,tfsaB:null};
        // Preserve legacy v45 auto-plan years by seeding only the February RRSP
        // amounts that were already being managed. The user can replace these
        // with exact CRA room values in Investment Plan.
        if(api.investmentPlanPctIsActive(existing.rrspPlanPct) && existing.months?.[1]){
          const feb = existing.months[1];
          if((Number(feb.rrspA)||0)>0) existing.planRoomCaps.rrspA = Number(feb.rrspA)||0;
          if((Number(feb.rrspB)||0)>0) existing.planRoomCaps.rrspB = Number(feb.rrspB)||0;
        }
      }else{
        ["rrspA","tfsaA","rrspB","tfsaB"].forEach(k=>{
          if(existing.planRoomCaps[k]===undefined) existing.planRoomCaps[k]=null;
        });
      }
      // v49: room values can be either manual anchors or auto-projected values.
      // Existing v48 values are preserved as manual anchors during migration.
      if(!existing.planRoomManual || typeof existing.planRoomManual!=="object"){
        existing.planRoomManual = {};
        ["rrspA","tfsaA","rrspB","tfsaB"].forEach(k=>{
          existing.planRoomManual[k] = existing.planRoomCaps[k]!==null && existing.planRoomCaps[k]!==undefined && existing.planRoomCaps[k]!=="";
        });
      }else{
        ["rrspA","tfsaA","rrspB","tfsaB"].forEach(k=>{ if(existing.planRoomManual[k]===undefined) existing.planRoomManual[k]=false; });
      }
      if(!existing.planRoomDerived || typeof existing.planRoomDerived!=="object"){
        existing.planRoomDerived = {rrspA:false,tfsaA:false,rrspB:false,tfsaB:false};
      }
      // v53: optional pre-auto February investment snapshot. It is populated
      // only when auto-planning starts (or recovered from the audit log).
      if(existing.investmentPlanPreAutoFeb===null) delete existing.investmentPlanPreAutoFeb;
      // v24: migrate the old two-field manual bank balance into one combined field.
      // Keep the legacy fields in saved data for backward compatibility, but the
      // combined field becomes the source of truth whenever it is present.
      if(existing.startCashCombinedOverride===undefined){
        const hasA = existing.startCashAOverride!==undefined && existing.startCashAOverride!==null && existing.startCashAOverride!=="";
        const hasB = existing.startCashBOverride!==undefined && existing.startCashBOverride!==null && existing.startCashBOverride!=="";
        if(hasA || hasB){
          existing.startCashCombinedOverride = (hasA ? Number(existing.startCashAOverride)||0 : 0) +
                                               (hasB ? Number(existing.startCashBOverride)||0 : 0);
        }
      }

      existing.months.forEach(m=>{
        // migrate old single tfsa/rrsp+person fields into per-person fields
        if(m.tfsaA===undefined){
          const wasA = m.tfsaPerson!=="B";
          m.tfsaA = wasA ? (Number(m.tfsa)||0) : 0;
          m.tfsaB = !wasA ? (Number(m.tfsa)||0) : 0;
        }
        if(m.rrspA===undefined){
          const wasA = m.rrspPerson!=="B";
          m.rrspA = wasA ? (Number(m.rrsp)||0) : 0;
          m.rrspB = !wasA ? (Number(m.rrsp)||0) : 0;
          const prior = m.rrspElectPrior!==undefined ? !!m.rrspElectPrior : true;
          m.rrspElectPriorA = prior;
          m.rrspElectPriorB = prior;
        }
        if(m.tfsaReturnOverrideA===undefined) m.tfsaReturnOverrideA = null;
        if(m.tfsaReturnOverrideB===undefined) m.tfsaReturnOverrideB = null;
        if(m.rrspReturnOverrideA===undefined) m.rrspReturnOverrideA = null;
        if(m.rrspReturnOverrideB===undefined) m.rrspReturnOverrideB = null;

        // v63: TFSA and RRSP use one shared monthly return override per person.
        // When upgrading older files, keep an existing TFSA override when present;
        // otherwise carry over the RRSP override. Legacy fields remain synced so
        // older backup/data shapes stay compatible.
        if(m.monthlyReturnOverrideA===undefined){
          m.monthlyReturnOverrideA = m.tfsaReturnOverrideA!==null && m.tfsaReturnOverrideA!==""
            ? Number(m.tfsaReturnOverrideA)
            : (m.rrspReturnOverrideA!==null && m.rrspReturnOverrideA!=="" ? Number(m.rrspReturnOverrideA) : null);
        }
        if(m.monthlyReturnOverrideB===undefined){
          m.monthlyReturnOverrideB = m.tfsaReturnOverrideB!==null && m.tfsaReturnOverrideB!==""
            ? Number(m.tfsaReturnOverrideB)
            : (m.rrspReturnOverrideB!==null && m.rrspReturnOverrideB!=="" ? Number(m.rrspReturnOverrideB) : null);
        }
        m.monthlyReturnOverrideA = clampReturnPct(m.monthlyReturnOverrideA);
        m.monthlyReturnOverrideB = clampReturnPct(m.monthlyReturnOverrideB);
        m.tfsaReturnOverrideA = m.monthlyReturnOverrideA;
        m.rrspReturnOverrideA = m.monthlyReturnOverrideA;
        m.tfsaReturnOverrideB = m.monthlyReturnOverrideB;
        m.rrspReturnOverrideB = m.monthlyReturnOverrideB;
        if(m.locked===undefined) m.locked=false;
        if(!m.extraEntries){
          m.extraEntries = [];
          if(m.extraIncome) m.extraEntries.push({amount:Number(m.extraIncome), type:"income", person:"A", note:"Carried over"});
          if(m.extraLosses) m.extraEntries.push({amount:Number(m.extraLosses), type:"loss", person:"A", note:"Carried over"});
        }
      });
      arr.push(existing);
    } else {
      arr.push({year:yr, grossA:(i===0?0:null), atA:null, grossB:(i===0?0:null), atB:null, salaryGrowthPct:null, pensionModeOverride:null, annualReturnPct:null, annualReturnPctManual:false, annualReturnOverrideA:null, annualReturnOverrideB:null, rrspPlanPct:null, planRoomCaps:{rrspA:null,tfsaA:null,rrspB:null,tfsaB:null}, planRoomManual:{rrspA:false,tfsaA:false,rrspB:false,tfsaB:false}, planRoomDerived:{rrspA:false,tfsaA:false,rrspB:false,tfsaB:false}, months:makeDefaultMonths()});
    }
  }
  state.years = arr;
  api.migrateInvestmentPlanPctInheritance();
  api.migrateAnnualReturnPctInheritance();
  const validPriorityIds = ["rrspA","tfsaA","rrspB","tfsaB"];
  if(!Array.isArray(state.investmentPriority)) state.investmentPriority = validPriorityIds.slice();
  state.investmentPriority = state.investmentPriority.filter((v,i,a)=>validPriorityIds.includes(v) && a.indexOf(v)===i);
  validPriorityIds.forEach(v=>{ if(!state.investmentPriority.includes(v)) state.investmentPriority.push(v); });
  state.investmentPriority = state.investmentPriority.slice(0,4);
  if(state.investmentRoomPanelOpen===undefined) state.investmentRoomPanelOpen = false;
  if(!Number.isInteger(state.activeYearIndex) || state.activeYearIndex < 0 || state.activeYearIndex >= arr.length) state.activeYearIndex = 0;
  if(state.currentYearIndex >= arr.length) state.currentYearIndex = 0;
}

function dbNextEntityId(prefix){
  state.databaseEntitySeq = (Number(state.databaseEntitySeq)||0) + 1;
  return prefix + state.databaseEntitySeq;
}

function goalCategoryCatalog(){
  return {
    saving:{label:"Saving for something"},
    wealth:{label:"Wealth & net-worth milestones"},
    investing:{label:"Investments & registered accounts"},
    performance:{label:"Income, spending & annual performance"},
    resilience:{label:"Financial resilience"},
    retirement:{label:"Retirement"},
    other:{label:"Other / custom"}
  };
}

function goalCatalog(){
  return {
    emergencyFund:{category:"saving",label:"Emergency fund",metric:"dedicatedSavings",defaultMode:"dedicated"},
    homeDownPayment:{category:"saving",label:"Home down payment",metric:"dedicatedSavings",defaultMode:"dedicated"},
    homeClosingCosts:{category:"saving",label:"Home closing costs",metric:"dedicatedSavings",defaultMode:"dedicated"},
    vehiclePurchase:{category:"saving",label:"Vehicle purchase",metric:"dedicatedSavings",defaultMode:"dedicated"},
    travelFund:{category:"saving",label:"Travel / vacation fund",metric:"dedicatedSavings",defaultMode:"dedicated"},
    weddingEvent:{category:"saving",label:"Wedding / major event",metric:"dedicatedSavings",defaultMode:"dedicated"},
    educationFund:{category:"saving",label:"Education / tuition fund",metric:"dedicatedSavings",defaultMode:"dedicated"},
    renovationFund:{category:"saving",label:"Home renovation",metric:"dedicatedSavings",defaultMode:"dedicated"},
    familyLeaveReserve:{category:"saving",label:"Parental / family leave reserve",metric:"dedicatedSavings",defaultMode:"dedicated"},
    medicalReserve:{category:"saving",label:"Medical / health reserve",metric:"dedicatedSavings",defaultMode:"dedicated"},
    businessFund:{category:"saving",label:"Business / startup fund",metric:"dedicatedSavings",defaultMode:"dedicated"},
    taxReserve:{category:"saving",label:"Tax reserve",metric:"dedicatedSavings",defaultMode:"dedicated"},
    annualExpenseReserve:{category:"saving",label:"Large annual expense reserve",metric:"dedicatedSavings",defaultMode:"dedicated"},
    givingFund:{category:"saving",label:"Giving / charity fund",metric:"dedicatedSavings",defaultMode:"dedicated"},
    largePurchase:{category:"saving",label:"Large purchase / sinking fund",metric:"dedicatedSavings",defaultMode:"dedicated"},

    netWorthMilestone:{category:"wealth",label:"Household net-worth milestone",metric:"netWorth",defaultMode:"automatic"},
    cashMilestone:{category:"wealth",label:"Combined cash milestone",metric:"bank",defaultMode:"automatic"},
    portfolioMilestone:{category:"wealth",label:"Investment portfolio milestone",metric:"portfolio",defaultMode:"automatic"},
    investedPrincipalMilestone:{category:"wealth",label:"Invested principal milestone",metric:"investedPrincipal",defaultMode:"automatic"},
    growthMilestone:{category:"wealth",label:"Lifetime investment-growth milestone",metric:"cumulativeGrowthGenerated",defaultMode:"automatic"},

    combinedTfsa:{category:"investing",label:"Combined TFSA milestone",metric:"tfsa",defaultMode:"automatic"},
    combinedRrsp:{category:"investing",label:"Combined RRSP milestone",metric:"rrsp",defaultMode:"automatic"},
    personATfsa:{category:"investing",label:()=>`${state.nameA} TFSA milestone`,metric:"tfsaA",defaultMode:"automatic"},
    personBTfsa:{category:"investing",label:()=>`${state.nameB} TFSA milestone`,metric:"tfsaB",defaultMode:"automatic"},
    personARrsp:{category:"investing",label:()=>`${state.nameA} RRSP milestone`,metric:"rrspA",defaultMode:"automatic"},
    personBRrsp:{category:"investing",label:()=>`${state.nameB} RRSP milestone`,metric:"rrspB",defaultMode:"automatic"},
    annualInvestContrib:{category:"investing",label:"Annual investment-contribution target",metric:"annualInvestContrib",defaultMode:"automatic"},
    annualTfsaContrib:{category:"investing",label:"Annual TFSA contribution target",metric:"annualTfsaContrib",defaultMode:"automatic"},
    annualRrspContrib:{category:"investing",label:"Annual RRSP contribution target",metric:"annualRrspContrib",defaultMode:"automatic"},

    annualSavings:{category:"performance",label:"Annual savings target",metric:"annualSavings",defaultMode:"automatic"},
    savingsRate:{category:"performance",label:"Savings-rate target",metric:"savingsRate",defaultMode:"automatic"},
    afterTaxIncome:{category:"performance",label:"Annual after-tax income target",metric:"annualIncome",defaultMode:"automatic"},
    spendingCeiling:{category:"performance",label:"Annual spending ceiling",metric:"annualExpenses",defaultMode:"automatic"},
    netCashFlow:{category:"performance",label:"Annual net-cash-flow target",metric:"annualNetCashFlow",defaultMode:"automatic"},
    annualGrowth:{category:"performance",label:"Annual investment-growth target",metric:"annualGrowth",defaultMode:"automatic"},

    emergencyMonths:{category:"resilience",label:"Cash coverage — months of expenses",metric:"emergencyMonths",defaultMode:"automatic"},
    portfolioCoverage:{category:"resilience",label:"Portfolio coverage — years of expenses",metric:"portfolioCoverageYears",defaultMode:"automatic"},
    netWorthCoverage:{category:"resilience",label:"Net-worth coverage — years of expenses",metric:"netWorthCoverageYears",defaultMode:"automatic"},
    withdrawalCeiling:{category:"resilience",label:"Annual portfolio-withdrawal ceiling",metric:"annualAutoWithdrawals",defaultMode:"automatic"},

    retirementPortfolio:{category:"retirement",label:"Retirement portfolio target",metric:"portfolio",defaultMode:"automatic"},
    retirementNetWorth:{category:"retirement",label:"Net worth at retirement",metric:"netWorth",defaultMode:"automatic"},
    retirementCash:{category:"retirement",label:"Cash reserve at retirement",metric:"bank",defaultMode:"automatic"},
    retirementCoverage:{category:"retirement",label:"Portfolio years of expenses at retirement",metric:"portfolioCoverageYears",defaultMode:"automatic"},

    customSavings:{category:"other",label:"Custom dedicated savings goal",metric:"dedicatedSavings",defaultMode:"dedicated"},
    customNetWorth:{category:"other",label:"Custom net-worth goal",metric:"netWorth",defaultMode:"automatic"},
    customPortfolio:{category:"other",label:"Custom investment-portfolio goal",metric:"portfolio",defaultMode:"automatic"},
    customCash:{category:"other",label:"Custom cash-balance goal",metric:"bank",defaultMode:"automatic"}
  };
}

function goalLabel(goalKey){
  const item=goalCatalog()[goalKey];
  if(!item) return "Goal";
  return typeof item.label==="function" ? item.label() : item.label;
}

function firstGoalKeyForCategory(category){
  return Object.keys(goalCatalog()).find(id=>goalCatalog()[id].category===category) || "customNetWorth";
}

function goalMetricCatalog(){
  return {
    dedicatedSavings:{label:"Dedicated goal savings",unit:"money",direction:"min",monthly:true},
    netWorth:{label:"Household net worth",unit:"money",direction:"min",monthly:true},
    portfolio:{label:"Total investment portfolio",unit:"money",direction:"min",monthly:true},
    bank:{label:"Combined bank / cash",unit:"money",direction:"min",monthly:true},
    tfsa:{label:"Combined TFSA",unit:"money",direction:"min",monthly:true},
    rrsp:{label:"Combined RRSP",unit:"money",direction:"min",monthly:true},
    cashA:{label:`${state.nameA} bank / cash`,unit:"money",direction:"min",monthly:true},
    cashB:{label:`${state.nameB} bank / cash`,unit:"money",direction:"min",monthly:true},
    tfsaA:{label:`${state.nameA} TFSA`,unit:"money",direction:"min",monthly:true},
    tfsaB:{label:`${state.nameB} TFSA`,unit:"money",direction:"min",monthly:true},
    rrspA:{label:`${state.nameA} RRSP`,unit:"money",direction:"min",monthly:true},
    rrspB:{label:`${state.nameB} RRSP`,unit:"money",direction:"min",monthly:true},
    investedPrincipal:{label:"Cumulative invested principal",unit:"money",direction:"min",monthly:true},
    cumulativeGrowthGenerated:{label:"Cumulative investment growth generated",unit:"money",direction:"min",monthly:true},

    annualInvestContrib:{label:"Annual investment contributions",unit:"money",direction:"min",monthly:false},
    annualTfsaContrib:{label:"Annual TFSA contributions",unit:"money",direction:"min",monthly:false},
    annualRrspContrib:{label:"Annual RRSP contributions",unit:"money",direction:"min",monthly:false},
    annualGrowth:{label:"Annual investment growth",unit:"money",direction:"min",monthly:false},
    annualIncome:{label:"Annual after-tax household income",unit:"money",direction:"min",monthly:false},
    annualExpenses:{label:"Annual expenses",unit:"money",direction:"max",monthly:false},
    annualNetCashFlow:{label:"Annual net cash flow",unit:"money",direction:"min",monthly:false},
    annualSavings:{label:"Annual savings retained",unit:"money",direction:"min",monthly:false},
    savingsRate:{label:"Annual savings rate",unit:"percent",direction:"min",monthly:false},
    emergencyMonths:{label:"Cash coverage — months of expenses",unit:"months",direction:"min",monthly:false},
    portfolioCoverageYears:{label:"Portfolio coverage — years of expenses",unit:"years",direction:"min",monthly:false},
    netWorthCoverageYears:{label:"Net-worth coverage — years of expenses",unit:"years",direction:"min",monthly:false},
    annualAutoWithdrawals:{label:"Annual portfolio withdrawals",unit:"money",direction:"max",monthly:false}
  };
}

function goalExistingBalanceCatalog(){
  const cat=goalMetricCatalog();
  const ids=["bank","cashA","cashB","tfsa","rrsp","tfsaA","tfsaB","rrspA","rrspB","portfolio","netWorth"];
  return Object.fromEntries(ids.map(id=>[id,cat[id]]));
}

function goalResolvedMetric(goal){
  const preset=goalCatalog()[goal?.goalKey] || goalCatalog().customNetWorth;
  if(goal?.achievementMode==="existing"){
    return goalExistingBalanceCatalog()[goal.existingMetric] ? goal.existingMetric : "bank";
  }
  if(goal?.achievementMode==="dedicated") return "dedicatedSavings";
  return preset.metric;
}

function goalAnnualProjectionSeries(){
  const monthly=api.computeMonthlySeries();
  const agg=api.computeAnnualAggregates();
  const aggByYear=Object.fromEntries(agg.map(a=>[String(a.year),a]));
  let investedPrincipal=(Number(state.startTFSAA)||0)+(Number(state.startTFSAB)||0)+(Number(state.startRRSPA)||0)+(Number(state.startRRSPB)||0);
  let cumulativeGrowthGenerated=0;

  return monthly.map(y=>{
    const e=y.months?.[11]||{};
    const a=aggByYear[String(y.year)]||{};
    const annualInvestContrib=(Number(a.tfsaContrib)||0)+(Number(a.rrspContrib)||0);
    investedPrincipal+=annualInvestContrib+(Number(y.openingPrincipalAdj)||0);
    cumulativeGrowthGenerated+=Number(a.growth)||0;
    const expenses=Math.max(0,Number(a.expense)||0);
    const bank=(Number(e.cashA)||0)+(Number(e.cashB)||0);
    const portfolio=(Number(e.tfsaBal)||0)+(Number(e.rrspBal)||0);
    const netWorth=Number(e.netWorth)||0;

    return {
      year:Number(y.year),netWorth,portfolio,bank,
      tfsa:Number(e.tfsaBal)||0,rrsp:Number(e.rrspBal)||0,
      cashA:Number(e.cashA)||0,cashB:Number(e.cashB)||0,
      tfsaA:Number(e.tfsaBalA)||0,tfsaB:Number(e.tfsaBalB)||0,
      rrspA:Number(e.rrspBalA)||0,rrspB:Number(e.rrspBalB)||0,
      investedPrincipal,cumulativeGrowthGenerated,
      annualInvestContrib,
      annualTfsaContrib:Number(a.tfsaContrib)||0,
      annualRrspContrib:Number(a.rrspContrib)||0,
      annualGrowth:Number(a.growth)||0,
      annualIncome:Number(a.earning)||0,
      annualExpenses:expenses,
      annualNetCashFlow:Number(a.netCashFlow)||0,
      annualSavings:(Number(a.netCashFlow)||0)+annualInvestContrib,
      savingsRate:Number(a.savingsRate)||0,
      emergencyMonths:expenses>0?Math.max(0,bank)/(expenses/12):0,
      portfolioCoverageYears:expenses>0?Math.max(0,portfolio)/expenses:0,
      netWorthCoverageYears:expenses>0?Math.max(0,netWorth)/expenses:0,
      annualAutoWithdrawals:Number(a.autoWithdrawalTotal)||0
    };
  });
}

function goalMonthlyProjectionSeries(){
  const series=api.computeMonthlySeries();
  let investedPrincipal=(Number(state.startTFSAA)||0)+(Number(state.startTFSAB)||0)+(Number(state.startRRSPA)||0)+(Number(state.startRRSPB)||0);
  let cumulativeGrowthGenerated=0;
  const rows=[];

  series.forEach(y=>{
    investedPrincipal+=Number(y.openingPrincipalAdj)||0;
    (y.months||[]).forEach((m,midx)=>{
      investedPrincipal+=(Number(m.tfsaContrib)||0)+(Number(m.rrspContrib)||0);
      cumulativeGrowthGenerated+=Number(m.investGrowthIncome)||0;
      rows.push({
        year:Number(y.year),midx,serial:monthSerial(Number(y.year),midx),
        netWorth:Number(m.netWorth)||0,
        portfolio:(Number(m.tfsaBal)||0)+(Number(m.rrspBal)||0),
        bank:(Number(m.cashA)||0)+(Number(m.cashB)||0),
        tfsa:Number(m.tfsaBal)||0,rrsp:Number(m.rrspBal)||0,
        cashA:Number(m.cashA)||0,cashB:Number(m.cashB)||0,
        tfsaA:Number(m.tfsaBalA)||0,tfsaB:Number(m.tfsaBalB)||0,
        rrspA:Number(m.rrspBalA)||0,rrspB:Number(m.rrspBalB)||0,
        investedPrincipal,cumulativeGrowthGenerated
      });
    });
  });
  return rows;
}

function goalBaselineDate(){
  const monthly=goalMonthlyProjectionSeries();
  if(!monthly.length) return {year:Number(state.baseYear)||2026,midx:0,serial:monthSerial(Number(state.baseYear)||2026,0)};
  const now=new Date();
  const desired=monthSerial(now.getFullYear(),now.getMonth());
  const first=monthly[0],last=monthly[monthly.length-1];
  const serial=Math.max(first.serial,Math.min(last.serial,desired));
  const row=monthly.find(r=>r.serial===serial)||first;
  return {year:row.year,midx:row.midx,serial:row.serial};
}

function goalDefaultFundingStart(){
  for(let yidx=0;yidx<(state.years||[]).length;yidx++){
    const y=state.years[yidx];
    for(let midx=0;midx<12;midx++){
      if(!y.months?.[midx]?.locked) return {year:Number(y.year),midx};
    }
  }
  return {year:Number(state.baseYear)||2026,midx:0};
}

function goalFundingIntervalMonths(plan){
  const map={monthly:1,every2months:2,quarterly:3,semiannual:6,annual:12};
  if(plan?.frequency!=="custom") return map[plan?.frequency]||1;
  const every=Math.max(1,Math.floor(Number(plan?.customEvery)||1));
  return plan?.customUnit==="years"?every*12:every;
}

function goalFundingFrequencyLabel(plan){
  const map={
    monthly:"Monthly",every2months:"Every 2 months",quarterly:"Quarterly",
    semiannual:"Semi-annual / biannual",annual:"Annual",yearend:"Every December"
  };
  if(plan?.frequency!=="custom") return map[plan?.frequency]||"Monthly";
  const n=Math.max(1,Math.floor(Number(plan?.customEvery)||1));
  const unit=plan?.customUnit==="years"?(n===1?"year":"years"):(n===1?"month":"months");
  return `Every ${n} ${unit}`;
}

function goalFundingCandidateMonths(goal,planOverride=null){
  const plan=planOverride||goal?.fundingPlan;
  if(goal?.achievementMode!=="dedicated" || !plan?.enabled) return [];
  const startYear=Number(plan.startYear),startMonth=Number(plan.startMonth);
  const endYear=Number(plan.endYear),endMonth=Number(plan.endMonth);
  if(!Number.isFinite(startYear)||!Number.isFinite(startMonth)||!Number.isFinite(endYear)||!Number.isFinite(endMonth)) return [];
  const startSerial=monthSerial(startYear,startMonth),endSerial=monthSerial(endYear,endMonth);
  if(endSerial<startSerial) return [];
  const out=[];

  if(plan.frequency==="yearend"){
    for(let year=startYear;year<=endYear;year++){
      const serial=monthSerial(year,11);
      if(serial<startSerial||serial>endSerial) continue;
      const yidx=findYearIndexByYear(year);
      if(yidx<0||state.years[yidx]?.months?.[11]?.locked) continue;
      out.push({year,midx:11,serial});
    }
    return out;
  }

  const step=Math.max(1,goalFundingIntervalMonths(plan));
  for(let serial=startSerial;serial<=endSerial;serial+=step){
    const ym=extraSerialToYearMonth(serial);
    if(!ym) continue;
    const yidx=findYearIndexByYear(ym.year);
    if(yidx<0||state.years[yidx]?.months?.[ym.midx]?.locked) continue;
    out.push({year:ym.year,midx:ym.midx,serial});
  }
  return out;
}

function goalFundingSchedule(goal,planOverride=null){
  const plan=planOverride||goal?.fundingPlan;
  if(goal?.achievementMode!=="dedicated" || !plan?.enabled){
    return {occurrences:[],amount:0,total:0,count:0,label:"No funding schedule",startingAmount:0};
  }
  const months=goalFundingCandidateMonths(goal,plan);
  const target=Number(goal.targetAmount)||0;
  const startingAmount=Math.max(0,Number(plan.startingAmount)||0);
  let amount=Math.max(0,Number(plan.amount)||0);
  if(plan.amountMode==="auto"){
    const gap=Math.max(0,target-startingAmount);
    amount=months.length?gap/months.length:0;
  }
  amount=Math.max(0,amount);
  const occurrences=months.map(m=>({...m,amount}));
  return {
    occurrences,amount,total:amount*occurrences.length,count:occurrences.length,
    label:goalFundingFrequencyLabel(plan),startingAmount
  };
}

function goalDedicatedSavingsAtSerial(goal,serial){
  const schedule=goalFundingSchedule(goal);
  return schedule.startingAmount + schedule.occurrences
    .filter(o=>Number(o.serial)<=Number(serial))
    .reduce((sum,o)=>sum+(Number(o.amount)||0),0);
}

function goalValueAt(goal,metric,year,midx,annualRows=null,monthlyRows=null){
  const meta=goalMetricCatalog()[metric]||{monthly:true};
  if(metric==="dedicatedSavings") return goalDedicatedSavingsAtSerial(goal,monthSerial(year,midx));
  if(meta.monthly){
    const rows=monthlyRows||goalMonthlyProjectionSeries();
    return Number(rows.find(r=>r.year===Number(year)&&r.midx===Number(midx))?.[metric])||0;
  }
  const rows=annualRows||goalAnnualProjectionSeries();
  return Number(rows.find(r=>r.year===Number(year))?.[metric])||0;
}

function computeGoalResults(){
  ensureGoalsState();
  const annualRows=goalAnnualProjectionSeries();
  const monthlyRows=goalMonthlyProjectionSeries();
  const baseline=goalBaselineDate();
  const metricCat=goalMetricCatalog();

  return (state.goals||[]).map(goal=>{
    const metric=goalResolvedMetric(goal);
    const meta=metricCat[metric]||{unit:"money",direction:"min",monthly:true};
    const target=Math.max(0,Number(goal.targetAmount)||0);
    const targetYear=Math.max(Number(state.baseYear)||2026,Math.min(PROJECTION_END_YEAR,Number(goal.targetYear)||baseline.year));
    const targetMonth=Math.max(0,Math.min(11,Number(goal.targetMonth)||0));
    const targetSerial=monthSerial(targetYear,targetMonth);

    const baselineValue=goalValueAt(goal,metric,baseline.year,baseline.midx,annualRows,monthlyRows);
    const projectedValue=goalValueAt(goal,metric,targetYear,targetMonth,annualRows,monthlyRows);
    const meets=v=>meta.direction==="max" ? Number(v)<=target : Number(v)>=target;

    let completionYear=null,completionMonth=null;
    if(target>0){
      if(meta.monthly || metric==="dedicatedSavings"){
        for(const row of monthlyRows){
          const v=goalValueAt(goal,metric,row.year,row.midx,annualRows,monthlyRows);
          if(meets(v)){completionYear=row.year;completionMonth=row.midx;break;}
        }
      }else{
        for(const row of annualRows){
          const v=Number(row?.[metric])||0;
          if(meets(v)){completionYear=row.year;completionMonth=11;break;}
        }
      }
    }

    const favorableGap=meta.direction==="max" ? target-projectedValue : projectedValue-target;
    const coverage=target>0
      ? (meta.direction==="max"
          ? (projectedValue<=target?100:(projectedValue>0?target/projectedValue*100:100))
          : projectedValue/target*100)
      : 0;

    let status="Needs setup",statusKey="setup";
    if(goal.active===false){status="Paused";statusKey="paused";}
    else if(target<=0){status="Needs setup";statusKey="setup";}
    else if(meets(baselineValue)){status="Achieved";statusKey="achieved";}
    else if(targetSerial<baseline.serial){status="Past due";statusKey="pastdue";}
    else if(meets(projectedValue)){
      const completionSerial=completionYear===null?null:monthSerial(completionYear,completionMonth??11);
      if(completionSerial!==null&&completionSerial<targetSerial){status="Ahead";statusKey="ahead";}
      else {status="On track";statusKey="ontrack";}
    }else{
      const completionSerial=completionYear===null?null:monthSerial(completionYear,completionMonth??11);
      if(completionSerial!==null&&completionSerial>targetSerial){status="Behind";statusKey="behind";}
      else {status="Not reached";statusKey="notreached";}
    }

    const funding=goalFundingSchedule(goal);
    return {
      goal,metric,target,targetYear,targetMonth,targetSerial,
      baselineYear:baseline.year,baselineMonth:baseline.midx,baselineValue,
      projectedValue,projectedGap:favorableGap,coverage,completionYear,completionMonth,
      status,statusKey,metricLabel:meta.label||metric,unit:meta.unit,direction:meta.direction,funding
    };
  });
}

function migrateLegacyGoalIdentity(goal){
  const oldType=goal.type;
  const map={
    dedicatedSavings:["saving","largePurchase"],
    emergencyFund:["saving","emergencyFund"],
    downPayment:["saving","homeDownPayment"],
    closingCosts:["saving","homeClosingCosts"],
    vehicle:["saving","vehiclePurchase"],
    travel:["saving","travelFund"],
    wedding:["saving","weddingEvent"],
    education:["saving","educationFund"],
    renovation:["saving","renovationFund"],
    parentalLeave:["saving","familyLeaveReserve"],
    medical:["saving","medicalReserve"],
    business:["saving","businessFund"],
    taxReserve:["saving","taxReserve"],
    annualExpense:["saving","annualExpenseReserve"],
    giving:["saving","givingFund"],
    netWorth:["wealth","netWorthMilestone"],
    portfolio:["wealth","portfolioMilestone"],
    retirementPortfolio:["retirement","retirementPortfolio"],
    cashReserve:["wealth","cashMilestone"],
    tfsa:["investing","combinedTfsa"],
    rrsp:["investing","combinedRrsp"],
    investedPrincipal:["wealth","investedPrincipalMilestone"],
    growthGenerated:["wealth","growthMilestone"],
    annualSavings:["performance","annualSavings"],
    savingsRate:["performance","savingsRate"],
    investContrib:["investing","annualInvestContrib"],
    tfsaContrib:["investing","annualTfsaContrib"],
    rrspContrib:["investing","annualRrspContrib"],
    income:["performance","afterTaxIncome"],
    spendingLimit:["performance","spendingCeiling"],
    netCashFlow:["performance","netCashFlow"],
    annualGrowth:["performance","annualGrowth"],
    emergencyMonths:["resilience","emergencyMonths"],
    portfolioCoverage:["resilience","portfolioCoverage"],
    netWorthCoverage:["resilience","netWorthCoverage"],
    drawLimit:["resilience","withdrawalCeiling"],
    custom:["other","customNetWorth"]
  };
  return map[oldType]||["other","customNetWorth"];
}

function ensureGoalsState(){
  if(!Array.isArray(state.goals)) state.goals=[];
  const categories=goalCategoryCatalog(),goals=goalCatalog();
  const minYear=Number(state.baseYear)||2026;
  state.goals.forEach(goal=>{
    if(!goal||typeof goal!=="object") return;
    if(!goal._dbId) goal._dbId=dbNextEntityId("g");
    if(goal.active===undefined) goal.active=true;

    if(!goal.goalType||!categories[goal.goalType]||!goal.goalKey||!goals[goal.goalKey]){
      const [legacyType,legacyKey]=migrateLegacyGoalIdentity(goal);
      goal.goalType=legacyType;
      goal.goalKey=legacyKey;
    }
    if(goals[goal.goalKey]?.category!==goal.goalType){
      goal.goalKey=firstGoalKeyForCategory(goal.goalType);
    }

    if(goal.description===undefined){
      const legacyParts=[];
      if(goal.name&&goal.name!=="New goal"&&goal.name!==goalLabel(goal.goalKey)) legacyParts.push(goal.name);
      if(goal.note) legacyParts.push(goal.note);
      goal.description=legacyParts.join(" — ");
    }

    if(goal.targetAmount===undefined||goal.targetAmount==="") goal.targetAmount=null;
    if(goal.targetAmount!==null) goal.targetAmount=Math.max(0,Number(goal.targetAmount)||0);
    if(!Number.isFinite(Number(goal.targetYear))) goal.targetYear=Math.min(PROJECTION_END_YEAR,minYear+5);
    goal.targetYear=Math.max(minYear,Math.min(PROJECTION_END_YEAR,Math.round(Number(goal.targetYear))));
    if(!Number.isFinite(Number(goal.targetMonth))) goal.targetMonth=11;
    goal.targetMonth=Math.max(0,Math.min(11,Math.round(Number(goal.targetMonth))));

    if(!["automatic","existing","dedicated"].includes(goal.achievementMode)){
      if(goal.fundingPlan?.enabled) goal.achievementMode="dedicated";
      else goal.achievementMode=goals[goal.goalKey]?.defaultMode||"automatic";
    }
    if(!goalExistingBalanceCatalog()[goal.existingMetric]) goal.existingMetric="bank";

    if(goal.achievementMode==="dedicated"){
      if(!goal.fundingPlan||typeof goal.fundingPlan!=="object") goal.fundingPlan={};
      const p=goal.fundingPlan;
      p.enabled=true;
      p.startingAmount=Math.max(0,Number(p.startingAmount)||0);
      p.amountMode=p.amountMode==="fixed"?"fixed":"auto";
      p.amount=Math.max(0,Number(p.amount)||0);
      p.frequency=["monthly","every2months","quarterly","semiannual","annual","yearend","custom"].includes(p.frequency)?p.frequency:"monthly";
      p.customEvery=Math.max(1,Math.floor(Number(p.customEvery)||1));
      p.customUnit=p.customUnit==="years"?"years":"months";
      p.owner=["A","B","household"].includes(p.owner)?p.owner:"household";
      const d=goalDefaultFundingStart();
      if(!Number.isFinite(Number(p.startYear))) p.startYear=d.year;
      if(!Number.isFinite(Number(p.startMonth))) p.startMonth=d.midx;
      if(!Number.isFinite(Number(p.endYear))) p.endYear=goal.targetYear;
      if(!Number.isFinite(Number(p.endMonth))) p.endMonth=goal.targetMonth;
    }
  });
}

function findYearIndexByYear(year){
  return state.years.findIndex(y=>Number(y.year)===Number(year));
}

function monthSerial(year,midx){ return Number(year)*12 + Number(midx); }

function extraSerialToYearMonth(serial){
  const s=Number(serial);
  if(!Number.isFinite(s)) return null;
  return {year:Math.floor(s/12),midx:((s%12)+12)%12};
}

function roundDollar(n){
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
}

function fmt(n){
  if(n===undefined||n===null||isNaN(n)) return "–";
  const rounded = Math.round(Number(n));
  const neg = rounded<0;
  const v = Math.abs(rounded).toLocaleString("en-CA",{maximumFractionDigits:0});
  return (neg?"−$":"$")+v;
}
Object.assign(api, {PROJECTION_END_YEAR, PENSION_ESTIMATE_BASE_YEAR, CPP_MAX_MONTHLY_2026, OAS_MAX_MONTHLY_65_74_2026, OAS_MAX_MONTHLY_75_PLUS_2026, OAS_2026_ANNUAL_65_74, OAS_2026_ANNUAL_75_PLUS, retirementStartYear, isRetirementYear, clampReturnPct, inflationFraction, isValidBaseYear, defaultBrackets, makeDefaultMonths, defaultBudgetItems, state, ensureYearsRange, dbNextEntityId, goalCategoryCatalog, goalCatalog, goalLabel, firstGoalKeyForCategory, goalMetricCatalog, goalExistingBalanceCatalog, goalResolvedMetric, goalAnnualProjectionSeries, goalMonthlyProjectionSeries, goalBaselineDate, goalDefaultFundingStart, goalFundingIntervalMonths, goalFundingFrequencyLabel, goalFundingCandidateMonths, goalFundingSchedule, goalDedicatedSavingsAtSerial, goalValueAt, computeGoalResults, migrateLegacyGoalIdentity, ensureGoalsState, findYearIndexByYear, monthSerial, extraSerialToYearMonth, roundDollar, fmt});
}

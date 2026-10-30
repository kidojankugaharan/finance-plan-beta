// Calculation logic ported from the reference; independent of browser APIs.
export function registerProjection(api) {
function computeAnnualAggregates(){
  const series = computeMonthlySeries();
  return series.map((y)=>{
    const t = y.months.reduce((acc,m)=>{
      // Closed months retain their cash flows in projections and full-year totals.
      acc.earning+=m.displayEarning; acc.expense+=m.displayExpense; acc.extraNet+=m.displayExtraNet;
      acc.netCashFlow+=m.displayNetCashFlow; acc.tfsaContrib+=m.tfsaContrib; acc.rrspContrib+=m.rrspContrib;
      acc.growth+=m.investGrowthIncome;
      acc.autoWithdrawalTotal+=Number(m.autoWithdrawalTotal)||0;
      acc.autoWithdrawalUncovered+=Number(m.autoWithdrawalUncovered)||0;
      return acc;
    }, {earning:0,expense:0,extraNet:0,netCashFlow:0,tfsaContrib:0,rrspContrib:0,growth:0,autoWithdrawalTotal:0,autoWithdrawalUncovered:0});
    const end = y.months[11];
    const totalSaved = t.netCashFlow + t.tfsaContrib + t.rrspContrib;
    const savingsRate = t.earning>0 ? (totalSaved/t.earning*100) : 0;
    return {
      year:y.year, earning:t.earning, expense:t.expense, extraNet:t.extraNet, netCashFlow:t.netCashFlow,
      tfsaContrib:t.tfsaContrib, rrspContrib:t.rrspContrib, growth:t.growth, autoWithdrawalTotal:t.autoWithdrawalTotal,
      autoWithdrawalUncovered:t.autoWithdrawalUncovered,
      openingPrincipalAdjTfsa:Number(y.openingPrincipalAdjTfsa)||0, openingPrincipalAdjRrsp:Number(y.openingPrincipalAdjRrsp)||0,
      netWorth:end.netWorth, cashA:end.cashA, cashB:end.cashB, tfsaBal:end.tfsaBal, rrspBal:end.rrspBal,
      savingsRate
    };
  });
}

function analysisRealDollars(){ return !!api.state.ui?.analysis?.realDollars; }

function analysisDeflator(year){
  const inflation = api.inflationFraction();
  return Math.pow(1+inflation, Math.max(0, Number(year) - (Number(api.state.baseYear)||Number(year))));
}

function deflateRecord(record, factor){
  const out = {...record};
  Object.keys(out).forEach(k=>{
    if(typeof out[k]!=="number" || k==="year" || k==="savingsRate" || /Return|Override/.test(k)) return;
    out[k] = out[k] / factor;
  });
  return out;
}

function analysisAggregates(){
  const agg = computeAnnualAggregates();
  return analysisRealDollars() ? agg.map(a=>deflateRecord(a, analysisDeflator(a.year))) : agg;
}

function analysisMonthlySeries(){
  const series = computeMonthlySeries();
  if(!analysisRealDollars()) return series;
  return series.map(y=>{ const f = analysisDeflator(y.year); return {...deflateRecord(y, f), months:y.months.map(m=>deflateRecord(m, f))}; });
}

function computeOwnerExpenseShare(year,monthIdx){
  return api.budgetOwnerAmountsForMonth(year,monthIdx);
}

function computeMonthlySeries(){
  return computeMonthlySeriesCore(api.resolveDrawdown().policies);
}

function computeMonthlySeriesCore(policies){
  const salaryChain = api.computeSalaryChain();
  const rrspRefundSchedule = computeRrspRefundSchedule();
  const rrspTaxMap = computeRrspTaxYearTotalsFromState();

  // Automatic monthly rates are derived from the shared Investment Plan
  // annual-return schedule, with optional Year-by-Year person overrides.
  // A month-level override can still replace the resulting rate for one month.
  const annualReturnChain = api.computeAnnualReturnPctChain();
  const effectiveMonthlyRate = (raw, fallback)=>{
    if(raw===undefined || raw===null || raw==="") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n/100 : fallback;
  };

  const single = !!api.state.singlePerson;   // single-person household: Person B is ignored (data is kept, not deleted)
  let cashA = (Number(api.state.startCashA)||0) + (single ? (Number(api.state.startCashB)||0) : 0);
  let cashB = single ? 0 : (Number(api.state.startCashB)||0);
  let tfsaBalA = Number(api.state.startTFSAA)||0, tfsaBalB = single ? 0 : (Number(api.state.startTFSAB)||0);
  let rrspBalA = Number(api.state.startRRSPA)||0, rrspBalB = single ? 0 : (Number(api.state.startRRSPB)||0);

  const years = [];
  api.state.years.forEach((y, yIdx)=>{
    const hasCombinedCashOverride = y.startCashCombinedOverride!==undefined &&
      y.startCashCombinedOverride!==null && y.startCashCombinedOverride!=="";

    if(hasCombinedCashOverride){
      const targetCombined = Number(y.startCashCombinedOverride)||0;
      const priorCombined = cashA + cashB;
      if(Math.abs(priorCombined) > 0.000001){
        const shareA = cashA / priorCombined;
        cashA = targetCombined * shareA;
        cashB = targetCombined - cashA;
      } else {
        cashA = targetCombined / 2;
        cashB = targetCombined - cashA;
      }
    } else {
      // Legacy fallback for older saved files.
      if(y.startCashAOverride!==undefined && y.startCashAOverride!==null && y.startCashAOverride!=="") cashA = Number(y.startCashAOverride);
      if(!single && y.startCashBOverride!==undefined && y.startCashBOverride!==null && y.startCashBOverride!=="") cashB = Number(y.startCashBOverride);
    }

    const preOverrideBalances = [tfsaBalA, tfsaBalB, rrspBalA, rrspBalB];
    if(y.startTFSAOverrideA!==undefined && y.startTFSAOverrideA!==null && y.startTFSAOverrideA!=="") tfsaBalA = Number(y.startTFSAOverrideA);
    if(!single && y.startTFSAOverrideB!==undefined && y.startTFSAOverrideB!==null && y.startTFSAOverrideB!=="") tfsaBalB = Number(y.startTFSAOverrideB);
    if(y.startRRSPOverrideA!==undefined && y.startRRSPOverrideA!==null && y.startRRSPOverrideA!=="") rrspBalA = Number(y.startRRSPOverrideA);
    if(!single && y.startRRSPOverrideB!==undefined && y.startRRSPOverrideB!==null && y.startRRSPOverrideB!=="") rrspBalB = Number(y.startRRSPOverrideB);

    // Compatibility with older versions that tracked registered-account cash
    // separately. In the simplified model that cash is swept into the account
    // balance and treated as invested; users can set a 0% monthly return override
    // for any month in which it was actually sitting in cash.
    if(y.startTFSACashOverrideA!==undefined && y.startTFSACashOverrideA!==null && y.startTFSACashOverrideA!=="") tfsaBalA += Number(y.startTFSACashOverrideA)||0;
    if(!single && y.startTFSACashOverrideB!==undefined && y.startTFSACashOverrideB!==null && y.startTFSACashOverrideB!=="") tfsaBalB += Number(y.startTFSACashOverrideB)||0;
    if(y.startRRSPCashOverrideA!==undefined && y.startRRSPCashOverrideA!==null && y.startRRSPCashOverrideA!=="") rrspBalA += Number(y.startRRSPCashOverrideA)||0;
    if(!single && y.startRRSPCashOverrideB!==undefined && y.startRRSPCashOverrideB!==null && y.startRRSPCashOverrideB!=="") rrspBalB += Number(y.startRRSPCashOverrideB)||0;

    // Money that enters a registered account through a year's opening balance
    // (e.g. the second person's starting amounts in a later year) is invested
    // principal, so "Total invested" must count it. Only increases count; a
    // lower override is a balance correction, not a withdrawal.
    const openingPrincipalAdjTfsa = Math.max(0, tfsaBalA - preOverrideBalances[0]) + Math.max(0, tfsaBalB - preOverrideBalances[1]);
    const openingPrincipalAdjRrsp = Math.max(0, rrspBalA - preOverrideBalances[2]) + Math.max(0, rrspBalB - preOverrideBalances[3]);

    const openingCashA = cashA, openingCashB = cashB;
    const openingTFSAA = tfsaBalA, openingTFSAB = tfsaBalB;
    const openingRRSPA = rrspBalA, openingRRSPB = rrspBalB;

    const annualEarnings = salaryChain[yIdx].totalAfterTax;
    const earnShareA = single ? 1 : (annualEarnings>0 ? salaryChain[yIdx].atA/annualEarnings : 0.5);
    const annualReturnA = api.effectiveAnnualReturnForPerson(yIdx,"A",annualReturnChain);
    const annualReturnB = api.effectiveAnnualReturnForPerson(yIdx,"B",annualReturnChain);
    const baseMonthlyReturnA = Math.pow(1+annualReturnA/100, 1/12)-1;
    const baseMonthlyReturnB = Math.pow(1+annualReturnB/100, 1/12)-1;
    const months = [];

    // Tax-aware drawdown setup for this year: the chosen plan, each person's
    // other taxable income (salary or pension), the RRSP already withdrawn so
    // far this year, and each month's combined net cash flow for lookahead.
    const drawPlan = (policies && policies[y.year]) || api.DEFAULT_DRAW_POLICY;
    const grossBaseA = Number(salaryChain[yIdx].grossA)||0;
    const grossBaseB = single ? 0 : (Number(salaryChain[yIdx].grossB)||0);
    let rrspGrossYtdA = 0, rrspGrossYtdB = 0;
    // From the year after a person turns 71 their RRSP is a RRIF, and at least
    // the prescribed minimum (on the January 1 balance) must come out.
    const rrifMinimumFor = (person, opening)=>{
      const ageAtStart = api.personAgeInYear(person, y.year-1);
      return ageAtStart!==null && ageAtStart >= api.RRSP_LAST_CONTRIBUTION_AGE ? Math.max(0, opening)*api.rrifMinimumFactor(ageAtStart) : 0;
    };
    const rrifMinA = rrifMinimumFor("A", openingRRSPA);
    const rrifMinB = single ? 0 : rrifMinimumFor("B", openingRRSPB);
    // No RRSP contributions after the year a person turns 71 (entries are kept but ignored).
    const rrspClosedA = api.rrspClosedFor("A", y.year), rrspClosedB = api.rrspClosedFor("B", y.year);
    // Withdrawals are taxed together with the year's deductions, so the refund
    // and the withdrawal tax add up to the tax on the combined income.
    const drawCtxA = withYearDeductions(salaryChain[yIdx].taxCtxA, y.year, "A", rrspTaxMap);
    const drawCtxB = single ? salaryChain[yIdx].taxCtxB : withYearDeductions(salaryChain[yIdx].taxCtxB, y.year, "B", rrspTaxMap);
    const monthNetTotals = y.months.map((mm,k)=>{
      const exp = (mm.expense!==null && mm.expense!=="" && mm.expense!==undefined) ? Number(mm.expense) : api.budgetTotalForMonth(y.year,k);
      const earn = (mm.earning!==null && mm.earning!=="" && mm.earning!==undefined) ? Number(mm.earning) : annualEarnings/12;
      let ex = 0;
      (mm.extraEntries||[]).forEach(e=>{ ex += (e.type==="income" ? 1 : -1) * (Number(e.amount)||0); });
      const pay = (k===3 && rrspRefundSchedule[y.year]) ? rrspRefundSchedule[y.year] : null;
      if(pay) ex += (Number(pay.A)||0) + (Number(pay.B)||0);
      const contrib = (Number(mm.tfsaA)||0) + (single ? 0 : (Number(mm.tfsaB)||0)) + (Number(mm.rrspA)||0) + (single ? 0 : (Number(mm.rrspB)||0));
      return earn + ex - exp - contrib;
    });

    y.months.forEach((m, mIdx)=>{
      const scheduledExpense = api.budgetTotalForMonth(y.year,mIdx);
      const expense = (m.expense!==null && m.expense!=="" && m.expense!==undefined) ? Number(m.expense) : scheduledExpense;
      const earning = (m.earning!==null && m.earning!=="" && m.earning!==undefined) ? Number(m.earning) : annualEarnings/12;

      const entries = m.extraEntries || [];
      let extraA=0, extraB=0;
      entries.forEach(e=>{
        const signed = (e.type==="income" ? 1 : -1) * (Number(e.amount)||0);
        if(e.person==="B" && !single) extraB += signed; else extraA += signed;
      });

      const payout = (mIdx===3 && rrspRefundSchedule[y.year]) ? rrspRefundSchedule[y.year] : null;
      const rrspRefundA = payout ? payout.A : 0;
      const rrspRefundB = payout ? payout.B : 0;
      extraA += rrspRefundA;
      extraB += rrspRefundB;
      const extraNetRaw = extraA+extraB;

      const tfsaA = Number(m.tfsaA)||0, tfsaB = single ? 0 : (Number(m.tfsaB)||0);
      const rrspA = rrspClosedA ? 0 : (Number(m.rrspA)||0), rrspB = (single || rrspClosedB) ? 0 : (Number(m.rrspB)||0);
      const tfsaContrib = tfsaA+tfsaB;
      const rrspContrib = rrspA+rrspB;

      const isCompleted = !!m.locked;
      const investmentOutflow = tfsaContrib + rrspContrib;
      const displayNetCashFlow = earning + extraNetRaw - expense - investmentOutflow;
      const netCashFlow = displayNetCashFlow;

      const earningA = earning*earnShareA, earningB = earning-earningA;
      const expenseShare = computeOwnerExpenseShare(y.year,mIdx);
      const expenseA = single ? expense : expense*expenseShare.A, expenseB = expense-expenseA;
      const contribA = tfsaA+rrspA;
      const contribB = tfsaB+rrspB;
      const netA = earningA+extraA-expenseA-contribA;
      const netB = earningB+extraB-expenseB-contribB;
      // Closing a month hides its card; its recorded activity still moves balances.
      cashA += netA; cashB += netB;

      // Contributions are assumed invested immediately for both registered accounts.
      tfsaBalA += tfsaA; tfsaBalB += tfsaB;
      rrspBalA += rrspA; rrspBalB += rrspB;

      // Automatic cash-deficit protection. If projected combined bank cash falls
      // below $0 in a month, withdraw only enough to bring
      // the combined bank balance back to $0. Withdrawal priority is:
      // 1) TFSAs, smallest current account first; 2) RRSPs, smallest current
      // account first. If the full portfolio cannot cover the deficit, the
      // uncovered amount is reported separately from bank assets below.
      const cashBeforeAutoWithdrawal = cashA + cashB;
      let bankDeficitBeforeWithdrawal = (cashBeforeAutoWithdrawal < -0.005)
        ? Math.abs(cashBeforeAutoWithdrawal) : 0;
      // Lump-sum plan: in the chosen month, cover the lowest bank balance
      // projected between now and December in a single withdrawal.
      let lumpSumDraw = false;
      if(drawPlan.mode==="lump" && mIdx===drawPlan.month){
        let run = cashBeforeAutoWithdrawal, minPath = run;
        for(let k=mIdx+1; k<12; k++){ run += monthNetTotals[k]; if(run < minPath) minPath = run; }
        const lumpNeed = Math.max(0, -minPath);
        if(lumpNeed > 0.005){ bankDeficitBeforeWithdrawal = Math.max(bankDeficitBeforeWithdrawal, lumpNeed); lumpSumDraw = true; }
      }
      // bankDeficitBeforeWithdrawal is the AFTER-TAX (usable) cash needed.
      // autoWithdrawalTotal is the GROSS amount removed from the portfolio.
      let autoWithdrawalNet = 0, autoWithdrawalTax = 0;
      let autoWithdrawalTotal = 0;
      let autoWithdrawalTfsaA = 0, autoWithdrawalTfsaB = 0;
      let autoWithdrawalRrspA = 0, autoWithdrawalRrspB = 0;
      let autoWithdrawalUncovered = 0;
      const autoWithdrawalAccounts = [];

      if(bankDeficitBeforeWithdrawal > 0){
        let remainingDeficit = bankDeficitBeforeWithdrawal;
        // capped=true limits RRSP draws to the room left under the plan's
        // taxable-income ceiling (other income + RRSP already drawn this year).
        const drawGroup = (accounts, capped)=>{
          accounts
            .map(a=>({...a, sortBalance:Math.max(0,Number(a.get())||0)}))
            .sort((a,b)=>a.sortBalance-b.sortBalance)
            .forEach(a=>{
              if(remainingDeficit <= 0.005) return;
              let available = Math.max(0,Number(a.get())||0);
              if(available <= 0) return;
              if(capped && a.type==="RRSP"){
                const baseP = a.person==="A" ? grossBaseA : grossBaseB;
                const ytdP = a.person==="A" ? rrspGrossYtdA : rrspGrossYtdB;
                const room = Math.max(0, (Number(drawPlan.ceiling)||0) - baseP - ytdP);
                if(room <= 0.005) return;
                available = Math.min(available, room);
              }

              // TFSA draws are tax-free. RRSP draws are grossed up so the
              // after-tax amount covers the shortfall.
              let draw, netReceived, taxOnDraw = 0;
              if(a.type==="RRSP"){
                const base = a.person==="A" ? drawCtxA : drawCtxB;
                const ytd = a.person==="A" ? rrspGrossYtdA : rrspGrossYtdB;
                const r = api.grossUpWithdrawal(remainingDeficit, base, ytd, available);
                draw = r.gross; netReceived = r.net; taxOnDraw = r.tax;
                if(a.person==="A") rrspGrossYtdA += draw; else rrspGrossYtdB += draw;
              } else {
                draw = Math.min(available, remainingDeficit);
                netReceived = draw;
              }
              if(draw <= 0) return;

              a.set(Math.max(0,Number(a.get())||0)-draw);
              if(a.person==="A") cashA += netReceived; else cashB += netReceived;
              autoWithdrawalTotal += draw;
              autoWithdrawalNet += netReceived;
              autoWithdrawalTax += taxOnDraw;
              remainingDeficit -= netReceived;
              autoWithdrawalAccounts.push({type:a.type, person:a.person, amount:draw, net:netReceived, tax:taxOnDraw});

              if(a.type==="TFSA" && a.person==="A") autoWithdrawalTfsaA += draw;
              if(a.type==="TFSA" && a.person==="B") autoWithdrawalTfsaB += draw;
              if(a.type==="RRSP" && a.person==="A") autoWithdrawalRrspA += draw;
              if(a.type==="RRSP" && a.person==="B") autoWithdrawalRrspB += draw;
            });
        };

        const tfsaAccts = [
          {type:"TFSA",person:"A",get:()=>tfsaBalA,set:v=>{tfsaBalA=v;}},
          {type:"TFSA",person:"B",get:()=>tfsaBalB,set:v=>{tfsaBalB=v;}}
        ];
        const rrspAccts = [
          {type:"RRSP",person:"A",get:()=>rrspBalA,set:v=>{rrspBalA=v;}},
          {type:"RRSP",person:"B",get:()=>rrspBalB,set:v=>{rrspBalB=v;}}
        ];
        // Draw order depends on the window's strategy:
        //  fixed   - TFSA, then RRSP (smallest balance first within each).
        //  ceiling - RRSP first, but only up to the plan's taxable-income
        //            ceiling for the year; then TFSA; then any remaining RRSP.
        //  manual  - the chosen share of each draw comes from RRSP, the rest
        //            from TFSA; if one account runs dry the other covers it.
        if(drawPlan.strategy==="ceiling"){
          drawGroup(rrspAccts, true);
        } else if(drawPlan.strategy==="manual"){
          const total = remainingDeficit;
          const rrspTarget = total * Math.min(100,Math.max(0,Number(drawPlan.rrspPct)||0)) / 100;
          remainingDeficit = rrspTarget;
          drawGroup(rrspAccts);
          remainingDeficit = total - (rrspTarget - remainingDeficit);
        }
        if(remainingDeficit > 0.005) drawGroup(tfsaAccts);
        if(remainingDeficit > 0.005) drawGroup(rrspAccts);
        autoWithdrawalUncovered = Math.max(0,remainingDeficit);
      }

      // RRIF minimum: whatever this year's shortfall draws didn't already take
      // is paid out in December, taxed, into the owner's bank cash.
      let rrifMinimumDraw = 0;
      if(mIdx===11){
        [["A", rrifMinA], ["B", rrifMinB]].forEach(([person, minimum])=>{
          const ytd = person==="A" ? rrspGrossYtdA : rrspGrossYtdB;
          const balance = Math.max(0, person==="A" ? rrspBalA : rrspBalB);
          const draw = Math.min(balance, Math.max(0, minimum - ytd));
          if(draw <= 0.5) return;
          const tax = api.withdrawalTaxIncrement(person==="A" ? drawCtxA : drawCtxB, ytd, draw);
          if(person==="A"){ rrspBalA -= draw; cashA += draw - tax; rrspGrossYtdA += draw; autoWithdrawalRrspA += draw; }
          else { rrspBalB -= draw; cashB += draw - tax; rrspGrossYtdB += draw; autoWithdrawalRrspB += draw; }
          autoWithdrawalTotal += draw;
          autoWithdrawalNet += draw - tax;
          autoWithdrawalTax += tax;
          rrifMinimumDraw += draw;
          autoWithdrawalAccounts.push({type:"RRIF minimum", person, amount:draw, net:draw - tax, tax, rrifMinimum:true});
        });
      }

      // Unfunded spending is a shortfall, not a negative bank asset or an
      // assumed loan. Record only this month's actual gap (not a lump-sum
      // lookahead gap), then let later months start with an empty bank.
      autoWithdrawalUncovered = Math.max(0, -(cashA + cashB));
      if(cashA + cashB < 0){ cashA = 0; cashB = 0; }

      const sharedReturnOverrideA = m.monthlyReturnOverrideA!==undefined ? m.monthlyReturnOverrideA : m.tfsaReturnOverrideA;
      const sharedReturnOverrideB = m.monthlyReturnOverrideB!==undefined ? m.monthlyReturnOverrideB : m.tfsaReturnOverrideB;
      const sharedReturnA = effectiveMonthlyRate(sharedReturnOverrideA, baseMonthlyReturnA);
      const sharedReturnB = effectiveMonthlyRate(sharedReturnOverrideB, baseMonthlyReturnB);
      const tfsaReturnA = sharedReturnA;
      const rrspReturnA = sharedReturnA;
      const tfsaReturnB = sharedReturnB;
      const rrspReturnB = sharedReturnB;

      const tfsaGrowthA = tfsaBalA * tfsaReturnA;
      const tfsaGrowthB = tfsaBalB * tfsaReturnB;
      const rrspGrowthA = rrspBalA * rrspReturnA;
      const rrspGrowthB = rrspBalB * rrspReturnB;

      tfsaBalA += tfsaGrowthA; tfsaBalB += tfsaGrowthB;
      rrspBalA += rrspGrowthA; rrspBalB += rrspGrowthB;

      const investGrowthIncomeA = tfsaGrowthA + rrspGrowthA;
      const investGrowthIncomeB = tfsaGrowthB + rrspGrowthB;
      const investGrowthIncome = investGrowthIncomeA + investGrowthIncomeB;

      const tfsaBal = tfsaBalA + tfsaBalB;
      const rrspBal = rrspBalA + rrspBalB;
      const netWorth = cashA + cashB + tfsaBal + rrspBal;

      months.push({
        expense, earning,
        extraA, extraB, extraNet:extraNetRaw,
        displayExpense:expense, displayEarning:earning,
        displayExtraA:extraA, displayExtraB:extraB, displayExtraNet:extraNetRaw, displayNetCashFlow,
        entries, netCashFlow, isCompleted, rrspRefundA, rrspRefundB,
        cashA, cashB, cash: cashA+cashB,
        cashBeforeAutoWithdrawal, bankDeficitBeforeWithdrawal, lumpSumDraw,
        autoWithdrawalNet, autoWithdrawalTax,
        autoWithdrawalTotal, autoWithdrawalTfsaA, autoWithdrawalTfsaB,
        autoWithdrawalRrspA, autoWithdrawalRrspB, autoWithdrawalUncovered,
        autoWithdrawalAccounts, rrifMinimumDraw,
        tfsaA, tfsaB, rrspA, rrspB, tfsaContrib, rrspContrib,
        tfsaReturnA, tfsaReturnB, rrspReturnA, rrspReturnB,
        monthlyReturnOverrideA:sharedReturnOverrideA, monthlyReturnOverrideB:sharedReturnOverrideB,
        tfsaReturnOverrideA:sharedReturnOverrideA, tfsaReturnOverrideB:sharedReturnOverrideB,
        rrspReturnOverrideA:sharedReturnOverrideA, rrspReturnOverrideB:sharedReturnOverrideB,
        // Compatibility aliases retained so older downstream code/data shapes do not break.
        tfsaInvestA:tfsaA, tfsaInvestB:tfsaB, rrspInvestA:rrspA, rrspInvestB:rrspB,
        tfsaInvestRequestedA:tfsaA, tfsaInvestRequestedB:tfsaB, rrspInvestRequestedA:rrspA, rrspInvestRequestedB:rrspB,
        tfsaCashA:0, tfsaCashB:0, rrspCashA:0, rrspCashB:0,
        tfsaInvestedBalA:tfsaBalA, tfsaInvestedBalB:tfsaBalB,
        rrspInvestedBalA:rrspBalA, rrspInvestedBalB:rrspBalB,
        tfsaGrowthA, tfsaGrowthB, rrspGrowthA, rrspGrowthB,
        investGrowthIncomeA, investGrowthIncomeB, investGrowthIncome,
        tfsaBalA, tfsaBalB, rrspBalA, rrspBalB, tfsaBal, rrspBal, netWorth,
        rrspElectPriorA:m.rrspElectPriorA, rrspElectPriorB:m.rrspElectPriorB
      });
    });

    years.push({
      year:y.year, salary:salaryChain[yIdx], months, openingCashA, openingCashB,
      openingCashCombined: openingCashA + openingCashB,
      openingTFSAA, openingTFSAB, openingRRSPA, openingRRSPB,
      openingPrincipalAdjTfsa, openingPrincipalAdjRrsp,
      openingPrincipalAdj: openingPrincipalAdjTfsa + openingPrincipalAdjRrsp,
      // Compatibility aliases for the simplified always-invested model.
      openingTFSAInvestedA:openingTFSAA, openingTFSAInvestedB:openingTFSAB,
      openingRRSPInvestedA:openingRRSPA, openingRRSPInvestedB:openingRRSPB,
      openingTFSACashA:0, openingTFSACashB:0, openingRRSPCashA:0, openingRRSPCashB:0
    });
  });

  return years;
}

function computeRrspTaxYearTotalsFromState(){
  const map = {};
  const add = (year, person, amount)=>{
    if(!amount) return;
    if(!map[year]) map[year] = {A:0,B:0};
    map[year][person] += amount;
  };
  api.state.years.forEach(y=>{
    y.months.forEach((m,mIdx)=>{
      const effYearA = (mIdx<=1 && m.rrspElectPriorA) ? y.year-1 : y.year;
      const effYearB = (mIdx<=1 && m.rrspElectPriorB) ? y.year-1 : y.year;
      add(effYearA, "A", api.rrspClosedFor("A", y.year) ? 0 : (Number(m.rrspA)||0));
      add(effYearB, "B", (api.state.singlePerson || api.rrspClosedFor("B", y.year)) ? 0 : (Number(m.rrspB)||0));
    });
  });
  return map;
}

function ensureTaxDeductionBucket(taxYear){
  if(!api.state.taxDeductions || typeof api.state.taxDeductions!=="object") api.state.taxDeductions = {};
  const key = String(Number(taxYear));
  if(!api.state.taxDeductions[key] || typeof api.state.taxDeductions[key]!=="object"){
    api.state.taxDeductions[key] = {A:[],B:[]};
  }
  if(!Array.isArray(api.state.taxDeductions[key].A)) api.state.taxDeductions[key].A = [];
  if(!Array.isArray(api.state.taxDeductions[key].B)) api.state.taxDeductions[key].B = [];
  return api.state.taxDeductions[key];
}

function yearDeductionTotal(taxYear, person, rrspMap){
  const rrsp = Math.max(0, Number(rrspMap?.[taxYear]?.[person])||0);
  const rows = api.state.taxDeductions?.[String(Number(taxYear))]?.[person];
  return rrsp + (Array.isArray(rows) ? rows.reduce((sum,row)=>sum + Math.max(0,Number(row.amount)||0),0) : 0);
}

function withYearDeductions(ctx, taxYear, person, rrspMap){
  const d = yearDeductionTotal(taxYear, person, rrspMap);
  return d>0 ? Object.assign({}, ctx, {deduction:(Number(ctx?.deduction)||0) + d}) : ctx;
}

function getAdditionalTaxDeductionTotal(taxYear, person){
  const bucket = ensureTaxDeductionBucket(taxYear);
  return (bucket[person]||[]).reduce((sum,row)=>sum + Math.max(0,Number(row.amount)||0),0);
}

function getRrspTaxSummary(year, rrspMap, salaryChain){
  const bucket = rrspMap[year] || {A:0,B:0};
  const idx = api.state.years.findIndex(y=>Number(y.year)===Number(year));
  const ctxA = idx>=0 ? salaryChain[idx].taxCtxA : {};
  const ctxB = idx>=0 ? salaryChain[idx].taxCtxB : {};
  const taxWith = (ctx, deduction)=>api.incomeTaxOn(Object.assign({}, ctx, {deduction:(Number(ctx.deduction)||0) + deduction}));

  const additionalDedA = getAdditionalTaxDeductionTotal(year,"A");
  const additionalDedB = getAdditionalTaxDeductionTotal(year,"B");
  const totalDeductionA = Math.max(0,Number(bucket.A)||0) + additionalDedA;
  const totalDeductionB = Math.max(0,Number(bucket.B)||0) + additionalDedB;

  const rrspA = Math.max(0,Number(bucket.A)||0), rrspB = Math.max(0,Number(bucket.B)||0);
  const rrspBenefitA = rrspA>0 ? taxWith(ctxA,0) - taxWith(ctxA,rrspA) : 0;
  const rrspBenefitB = rrspB>0 ? taxWith(ctxB,0) - taxWith(ctxB,rrspB) : 0;

  // Additional entries are taxable-income deductions, not refunds.
  // Calculate the incremental tax savings created by those deductions after
  // the RRSP contribution deduction has already reduced taxable income.
  const additionalRefundA = additionalDedA>0 ? taxWith(ctxA,rrspA) - taxWith(ctxA,rrspA+additionalDedA) : 0;
  const additionalRefundB = additionalDedB>0 ? taxWith(ctxB,rrspB) - taxWith(ctxB,rrspB+additionalDedB) : 0;

  const dedA = rrspBenefitA + additionalRefundA;
  const dedB = rrspBenefitB + additionalRefundB;

  return {
    year:Number(year),
    rrspA:bucket.A||0, rrspB:bucket.B||0,
    additionalDedA, additionalDedB,
    totalDeductionA, totalDeductionB,
    rrspBenefitA, rrspBenefitB,
    additionalRefundA, additionalRefundB,
    additionalBenefitA:additionalRefundA,
    additionalBenefitB:additionalRefundB,
    dedA, dedB, totalRefund:dedA+dedB
  };
}

function computeRrspRefundSchedule(){
  const rrspMap = computeRrspTaxYearTotalsFromState();
  const salaryChain = api.computeSalaryChain();
  const schedule = {};
  const taxYears = new Set([
    ...Object.keys(rrspMap||{}),
    ...Object.keys(api.state.taxDeductions||{})
  ]);

  taxYears.forEach(key=>{
    const taxYear = Number(key);
    if(!Number.isFinite(taxYear)) return;
    const summary = getRrspTaxSummary(taxYear, rrspMap, salaryChain);
    const payoutYear = taxYear + 1;
    if(!schedule[payoutYear]) schedule[payoutYear] = {A:0,B:0,total:0,sourceYears:[]};
    schedule[payoutYear].A += summary.dedA;
    schedule[payoutYear].B += summary.dedB;
    schedule[payoutYear].total += summary.totalRefund;
    schedule[payoutYear].sourceYears.push(taxYear);
  });
  return schedule;
}
Object.assign(api, {computeAnnualAggregates, analysisRealDollars, analysisDeflator, deflateRecord, analysisAggregates, analysisMonthlySeries, computeOwnerExpenseShare, computeMonthlySeries, computeMonthlySeriesCore, computeRrspTaxYearTotalsFromState, ensureTaxDeductionBucket, yearDeductionTotal, withYearDeductions, getAdditionalTaxDeductionTotal, getRrspTaxSummary, computeRrspRefundSchedule});
}

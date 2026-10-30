// Annual 2026 rates (not prorated second-half payroll rates). Reviewed 2026-10-29.
// Sources and scope: docs/CALCULATIONS.md.
const province=(name,bpa,rows)=>({name,bpa,brackets:rows.map(([threshold,rate])=>({threshold,rate:rate/100})).reverse()});
export const PROVINCES={
  ON:province('Ontario',12989,[[0,5.05],[53891,9.15],[107785,11.16],[150000,12.16],[220000,13.16]]),
  AB:province('Alberta',22769,[[0,8],[61200,10],[154259,12],[185111,13],[246813,14],[370220,15]]),
  BC:province('British Columbia',13216,[[0,5.6],[50363,7.7],[100728,10.5],[115648,12.29],[140430,14.7],[190405,16.8],[265545,20.5]]),
  MB:province('Manitoba',15780,[[0,10.8],[47564,12.75],[101200,17.4]]),
  NB:province('New Brunswick',13664,[[0,9.4],[52333,14],[104666,16],[193861,19.5]]),
  NL:province('Newfoundland and Labrador',11188,[[0,8.7],[44678,14.5],[89354,15.8],[159528,17.8],[223340,19.8],[285319,20.8],[570638,21.3],[1141275,21.8]]),
  NS:province('Nova Scotia',11932,[[0,8.79],[30995,14.95],[61991,16.67],[97417,17.5],[157124,21]]),
  NT:province('Northwest Territories',18198,[[0,5.9],[53003,8.6],[106009,12.2],[172346,14.05]]),
  NU:province('Nunavut',19659,[[0,4],[55801,7],[111602,9],[181439,11.5]]),
  PE:province('Prince Edward Island',15000,[[0,9.5],[33928,13.47],[65820,16.6],[106890,17.62],[142520,19],[200000,20]]),
  QC:province('Quebec',18952,[[0,14],[54345,19],[108680,24],[132245,25.75]]),
  SK:province('Saskatchewan',20381,[[0,10.5],[54532,12.5],[155805,14.5]]),
  YT:province('Yukon',16452,[[0,6.4],[58523,9],[117045,10.9],[181440,12.8],[500000,15]])
};

/** Provincial planning estimate. Ontario's fuller reference model lives in tax.js.
 * Other provinces include brackets, BPA, payroll credits, BC reduction, MB BPA
 * phaseout and Quebec worker deduction. Family/senior provincial credits excluded.
 */
export function provincialTax(code,ctx) {
  const p=PROVINCES[code];if(!p)throw new Error('Unsupported Canadian province.');
  const {netIncome,employment,cppBasePart,ei,qpip,factor,federalBpa,year,inflation}=ctx;
  const f=code==='PE'||code==='MB'?1:code==='BC'?Math.pow(1+inflation,Math.max(0,year-2030)):factor;
  let bpa=p.bpa*f;
  if(code==='MB')bpa=Math.max(0,bpa-0.08*Math.max(0,netIncome-200000));
  if(code==='YT')bpa=federalBpa;
  const taxable=code==='QC'?Math.max(0,netIncome-Math.min(employment*0.06,1450*f)):netIncome;
  let tax=0;
  for(let i=0;i<p.brackets.length;i++){
    const b=p.brackets[i],upper=i===0?Infinity:p.brackets[i-1].threshold*f;
    tax+=Math.max(0,Math.min(taxable,upper)-b.threshold*f)*b.rate;
  }
  // Quebec does not grant provincial credits for payroll contributions.
  const creditBase=bpa+(code==='QC'?0:cppBasePart+ei+qpip);
  tax=Math.max(0,tax-p.brackets.at(-1).rate*creditBase);
  if(code==='BC')tax=Math.max(0,tax-Math.max(0,690*f-0.0356*Math.max(0,netIncome-25570*f)));
  return tax;
}

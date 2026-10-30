import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

async function setupPlan(page,{second=false}={}) {
  await page.goto('./');
  await page.getByRole('button',{name:'Build my plan'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Taylor');
  await page.getByLabel('Your age in the starting year').fill('35');
  await page.getByLabel('Starting year',{exact:true}).fill('2026');
  if(second){await page.getByLabel('Second person’s name (optional)').fill('Morgan');await page.getByLabel('Second person’s age',{exact:true}).fill('33');}
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.locator('#setup-form .income-notice')).toContainText('Freelance and self-employment tax treatment is not modelled.');
  await page.getByLabel('Taylor · annual salary').fill('80000');
  if(second)await page.getByLabel('Morgan · annual salary').fill('60000');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Expense name',{exact:true}).fill('Housing');
  await page.getByLabel('Monthly amount',{exact:true}).fill('2000');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Taylor · Bank balance').fill('8000');
  await page.getByLabel('Taylor · TFSA',{exact:true}).fill('30000');
  await page.getByLabel('Taylor · RRSP',{exact:true}).fill('40000');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Choose an assumption',{exact:true}).selectOption('inflation');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Review',exact:true,level:1})).toBeVisible();
  await page.getByRole('button',{name:'Open my plan'}).click();
  await expect(page.getByRole('heading',{name:'Your year, in focus.'})).toBeVisible();
}
async function nav(page,tab) {
  if(['goals','analysis'].includes(tab)){
    await page.locator('[data-tab="more"]').click();
    await page.locator('#open-'+tab).click();
  }else await page.locator(`[data-tab="${tab}"]`).click();
}

test('More Explore buttons open goals and projection on phone',async({page})=>{
  await setupPlan(page);
  const navigation=page.getByRole('navigation',{name:'Main navigation'});
  for(const [tab,title] of [['goals','Goals'],['analysis','Projection & analysis']]){
    await navigation.getByRole('button',{name:'More',exact:true}).click();
    await expect(navigation.locator('[data-tab="'+tab+'"]')).toHaveCount(0);
    const link=page.getByRole('button',{name:title,exact:true});
    await expect(link).toBeVisible();
    const box=await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    await link.tap();
    await expect(page).toHaveURL(new RegExp('#'+tab+'$'));
    await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeFocused();
    await expect(page.getByRole('button',{name:tab==='goals'?'Add goal':'Export projection CSV',exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  }
});

test('fresh household completes setup, visits every tab, persists, and fits the viewport',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await setupPlan(page,{second:true});
  for(const [tab,title] of [['salary','Salary'],['budget','Budget'],['invest','Invest'],['goals','Goals'],['analysis','Projection & analysis'],['more','More'],['year','Your year, in focus.']]){
    await nav(page,tab);await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  }
  await page.reload();await expect(page.getByRole('heading',{name:'Your year, in focus.'})).toBeVisible();
  await expect(page.locator('main')).toContainText('Taylor & Morgan');
  await page.screenshot({path:info.outputPath('year.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('freelance income discloses employee approximation in setup, salary, editor and assumptions',async({page})=>{
  await setupPlan(page,{second:true});
  await nav(page,'more');
  await page.getByRole('button',{name:'Household & province',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Province or territory').selectOption('QC');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await nav(page,'salary');
  const notice=page.locator('main .income-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Employee payroll approximation.');
  await expect(notice).toContainText('Freelance and self-employment tax treatment is not modelled.');
  await expect(notice).toContainText('inaccurate take-home income and projections');
  const disclosure=await notice.textContent();
  await page.getByRole('button',{name:'Edit this year'}).click();
  await expect(dialog.locator('.income-notice')).toHaveText(disclosure);
  await dialog.getByLabel('Taylor · annual salary').fill('72000');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('main')).toContainText('Employee CPP/QPP · EI · QPIP (estimated)');
  await expect(page.locator('main > .metrics')).toContainText('Employee payroll / pension estimate');
  await page.reload();
  await nav(page,'salary');
  await expect(notice).toBeVisible();
  await nav(page,'more');
  await page.getByText('What the numbers assume',{exact:true}).click();
  await expect(page.locator('main .income-notice')).toBeVisible();
  await expect(page.locator('main .income-notice')).toHaveText(disclosure);
  await page.getByRole('button',{name:'Review setup',exact:true}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.review')).toContainText('$132,000');
  await expect(dialog.locator('.review')).toContainText('Quebec');
});

test('Review setup shows saved assumptions without changing a completed plan',async({page})=>{
  await setupPlan(page);
  const saved=await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'));
  const projection=await page.locator('main > .metrics').textContent();
  expect(JSON.parse(saved).state.setup.completed).toBe(true);
  await nav(page,'more');
  const dialog=page.getByRole('dialog');
  for(const close of ['Done','Cancel','Close dialog','Escape']){
    await page.getByRole('button',{name:'Review setup',exact:true}).click();
    await expect(dialog.getByRole('heading',{name:'Review setup',exact:true})).toBeVisible();
    await expect(dialog.locator('.review')).toContainText('Taylor');
    await expect(dialog.locator('.review')).toContainText('$80,000');
    await expect(dialog.locator('.review')).toContainText('$24,000 / year');
    for(const amount of ['$8,000','$30,000','$40,000'])await expect(dialog.locator('.review')).toContainText(amount);
    await expect(dialog.locator('input,select')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Save and finish later'})).toHaveCount(0);
    expect(await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'))).toBe(saved);
    if(close==='Escape')await page.keyboard.press('Escape');
    else await dialog.getByRole('button',{name:close,exact:true}).click();
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'))).toBe(saved);
  }
  await nav(page,'year');
  await expect(page.locator('main')).toContainText('Taylor');
  await expect(page.locator('#app > .draft-banner')).toHaveCount(0);
  await expect(page.locator('main > .metrics')).toHaveText(projection);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Your year, in focus.'})).toBeVisible();
  await expect(page.locator('#app > .draft-banner')).toHaveCount(0);
  await expect(page.locator('main > .metrics')).toHaveText(projection);
  expect(await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'))).toBe(saved);
});

test('debt payments disclose expense-only tracking before entry and after saving',async({page})=>{
  await setupPlan(page);
  await nav(page,'budget');
  const notice=page.locator('main .debt-notice');
  await expect(notice).toContainText('Debt payments are expenses only.');
  await expect(notice).toContainText('does not track debt balances, interest, principal repayments, or payoff dates');
  await expect(notice).toContainText('Debts are not subtracted from net worth');
  await page.getByRole('button',{name:'+ Debt',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.debt-notice')).toHaveText(await notice.textContent());
  await dialog.getByLabel('Expense name',{exact:true}).fill('Line of credit payment');
  await dialog.getByLabel('Amount per occurrence (CAD)').fill('250');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  const payment=page.locator('.item-list li').filter({hasText:'Line of credit payment'});
  await expect(payment).toContainText('$3,000 / year');
  await expect(page.locator('main > .metrics')).toContainText('$27,000');
  await page.reload();await nav(page,'budget');
  await expect(notice).toContainText('Update the payment amount or end month yourself');
  await payment.getByRole('button',{name:'Edit Line of credit payment',exact:true}).click();
  await expect(dialog.locator('.debt-notice')).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  // Generic entry also discloses the limit, including custom expense categories.
  await page.getByRole('button',{name:'Add expense',exact:true}).click();
  await expect(dialog.locator('.debt-notice')).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await nav(page,'year');
  await expect(page.locator('main > .metrics > .metric').nth(1)).toContainText('$27,000');
  await expect(page.locator('main > .metrics > .metric').nth(2)).toContainText('excludes debts');
});

test('setup drafts survive finish-later and reload; Back works before assumptions are chosen',async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Build my plan'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Draft name');
  await page.getByRole('button',{name:'Save and finish later'}).click();
  await page.reload();await nav(page,'more');
  await page.locator('main').getByRole('button',{name:'Resume setup',exact:true}).click();
  await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Draft name');
  await page.getByLabel('Your age in the starting year').fill('40');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Assumptions',level:1})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Starting balances',level:1})).toBeVisible();
});

for(const {choice,value,resume} of [
  {choice:'Same pay',value:'same',resume:false},
  {choice:'Not sure — use 0% provisionally',value:'unsure',resume:true}
])test(`assumption prompt labels a selectable control (${value}, resume=${resume})`,async({page})=>{
  await page.goto('./');
  await page.getByRole('button',{name:'Build my plan'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Taylor');
  await page.getByLabel('Your age in the starting year').fill('40');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
  if(resume){
    await page.getByRole('button',{name:'Save and finish later'}).click();
    await page.reload();
    await page.locator('#resume-banner').click();
  }
  await expect(page.getByRole('heading',{name:'Assumptions',level:1})).toBeVisible();
  const assumption=page.getByLabel('Choose an assumption',{exact:true});
  await expect(assumption).toHaveRole('combobox');
  await expect(assumption).toHaveAccessibleName('Choose an assumption');
  await expect(assumption).toHaveAccessibleDescription('How should your pay change?');
  await assumption.selectOption({label:choice});
  await expect(assumption).toHaveValue(value);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pensions',level:1})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(assumption).toHaveValue(value);
});

test('expense add/edit validates dates, Cancel leaves data alone, and Undo restores removed data',async({page})=>{
  await setupPlan(page);await nav(page,'budget');await page.getByRole('button',{name:'Add expense',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Expense name',{exact:true}).fill('Groceries');await dialog.getByLabel('Amount per occurrence (CAD)').fill('125.6');
  await dialog.getByLabel('Start month (optional)').fill('2026-09');await dialog.getByLabel('End month (optional)').fill('2026-08');
  await dialog.getByRole('button',{name:'Save changes'}).click();await expect(dialog.getByRole('alert')).toContainText('End month');
  await dialog.getByLabel('End month (optional)').fill('');await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.item-list')).toContainText('Groceries');await expect(page.locator('.item-list')).toContainText('$126');
  await page.getByRole('button',{name:'Edit Groceries',exact:true}).click();await dialog.getByLabel('Amount per occurrence (CAD)').fill('999');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.item-list')).not.toContainText('$999');
  await page.getByRole('button',{name:'Remove Groceries',exact:true}).click();await expect(page.locator('.item-list')).not.toContainText('Groceries');
  await page.getByRole('button',{name:'Undo last change'}).click();await expect(page.locator('.item-list')).toContainText('Groceries');
});

test('investments use room, goals display a funding plan, and monthly overrides persist',async({page})=>{
  await setupPlan(page);await nav(page,'invest');
  await page.getByLabel('Taylor · TFSA room').fill('7000');await page.getByLabel('Taylor · RRSP room').fill('14000');await page.getByRole('button',{name:'Save room',exact:true}).click();
  await page.getByLabel('When to invest',{exact:true}).selectOption('monthly');
  await page.getByRole('button',{name:'Save investment plan'}).click();await expect(page.getByLabel('Taylor · TFSA room')).toHaveValue('7000');
  await nav(page,'goals');await page.getByRole('button',{name:'Add goal'}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Goal name or description').fill('Travel fund');await dialog.getByLabel('What are you aiming for?').selectOption('travelFund');
  await dialog.getByLabel('Target amount (CAD, %, months, or years)').fill('12000');await dialog.getByLabel('How to measure progress').selectOption('dedicated');await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.goal-grid')).toContainText('Travel fund');await expect(page.locator('.goal-grid')).toContainText('payments');
  await nav(page,'year');await page.getByRole('button',{name:'Edit January',exact:true}).click();await dialog.getByLabel('Household expense override').fill('2750');await dialog.getByRole('button',{name:'Save changes'}).click();
  await page.reload();await expect(page.locator('.month-card').first()).toContainText('$2,750');
});

test('JSON export/import previews replacement and can be reverted',async({page},info)=>{
  await setupPlan(page);await nav(page,'more');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON backup'}).click();const download=await downloadPromise;
  const file=info.outputPath('backup.json');await download.saveAs(file);const backup=JSON.parse(await fs.readFile(file,'utf8'));expect(backup.format).toBe('finance-plan-beta');backup.state.nameA='Imported person';
  const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import JSON backup'}).click();const chooser=await chooserPromise;
  await chooser.setFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.getByRole('dialog')).toContainText('Imported person');await page.getByRole('button',{name:'Import this plan'}).click();
  await nav(page,'year');await expect(page.locator('main')).toContainText('Imported person');await page.getByRole('button',{name:'Undo last change'}).click();await expect(page.locator('main')).toContainText('Taylor');
  await nav(page,'more');const badChooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import JSON backup'}).click();await(await badChooser).setFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});
  await expect(page.locator('#notice')).toContainText('Import failed');await page.reload();await nav(page,'year');await expect(page.locator('main')).toContainText('Taylor');
});

test('backup chooser stays attached until selection or cancellation and can reopen',async({page},info)=>{
  await setupPlan(page);await nav(page,'more');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON backup'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^finance-plan-\d{4}-\d{2}-\d{2}\.json$/);
  const file=info.outputPath(download.suggestedFilename());await download.saveAs(file);
  const saved=await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'));
  const openChooser=async()=>{
    const event=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Import JSON backup',exact:true}).click();
    const chooser=await event;
    expect(await chooser.element().evaluate(input=>input.isConnected)).toBe(true);
    return chooser;
  };
  const cancelled=await openChooser();
  await cancelled.element().evaluate(input=>input.dispatchEvent(new Event('cancel')));
  expect(await cancelled.element().evaluate(input=>input.isConnected)).toBe(false);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // Selecting the same dated export again must still open a fresh preview.
  for(const confirm of [false,true]){
    const chooser=await openChooser();await chooser.setFiles(file);
    await expect(page.getByRole('dialog')).toContainText('Review backup import');
    await expect(page.getByRole('dialog')).toContainText('Taylor');
    expect(await chooser.element().evaluate(input=>input.isConnected)).toBe(false);
    expect(await page.evaluate(()=>localStorage.getItem('finance-plan-beta.v1'))).toBe(saved);
    await page.getByRole('button',{name:confirm?'Import this plan':'Cancel',exact:true}).click();
  }
  await expect(page.locator('#notice')).toContainText('Backup imported');
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('published subpath caches the complete app and reloads offline',async({page,context})=>{
  await setupPlan(page);await expect(page.locator('#offline-state')).toHaveText('Ready offline');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
  await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Your year, in focus.'})).toBeVisible();
  await nav(page,'budget');await expect(page.locator('.item-list')).toContainText('Housing');await nav(page,'analysis');await expect(page.locator('table tbody tr')).toHaveCount(61);
  await context.setOffline(false);
});

test('blocked storage shows an actionable error while export remains available',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
  await page.goto('./');await page.getByRole('button',{name:'Build my plan'}).click();await expect(page.locator('.save-error')).toContainText('Changes are not saved');
  await expect(page.locator('#emergency-export')).toBeVisible();
});

test('recurring extras and payday schedules change the intended unlocked months',async({page})=>{
  await setupPlan(page);await page.getByRole('button',{name:'Add extra income or expense'}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Start month',{exact:true}).fill('2026-01');await dialog.getByLabel('End month',{exact:true}).fill('2026-12');await dialog.getByLabel('Repeat',{exact:true}).selectOption('quarterly');
  await dialog.getByLabel('Type',{exact:true}).selectOption('loss');await dialog.getByLabel('Amount per occurrence (CAD)').fill('300');await dialog.getByLabel('Description',{exact:true}).fill('Quarterly bill');await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.extra')).toHaveCount(4);await page.getByRole('button',{name:'Edit extra entry 1-1',exact:true}).click();await dialog.getByLabel('Amount per occurrence (CAD)').fill('450');await dialog.getByRole('button',{name:'Save changes'}).click();await expect(page.locator('.extra').first()).toContainText('$450');
  await page.getByRole('button',{name:'Payday schedule',exact:true}).click();await dialog.getByLabel('Taylor · pay frequency').selectOption('biweekly');await dialog.getByLabel('Taylor · first payday').fill('2026-01-02');await dialog.getByRole('button',{name:'Apply to this year'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('finance-plan-beta.v1')).state);
  expect(saved.years[0].months[0].earning).toBeGreaterThan(saved.years[0].months[1].earning);
  await page.reload();await expect(page.locator('.extra')).toHaveCount(4);
});

test('closing an ended month saves a lesson, hides the month, and blocks current and future months',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-03-15T12:00:00'));
  await setupPlan(page);
  const annualTotals=page.locator('main > .metrics > .metric strong');
  const income=await annualTotals.nth(0).textContent(),expenses=await annualTotals.nth(1).textContent();
  const totalsBefore=await annualTotals.allTextContents();
  const februaryBefore=await page.locator('#month-1').textContent(),decemberBefore=await page.locator('#month-11').textContent();
  await expect(page.locator('#closeout-reminder')).toContainText('2 past months are still open');
  await expect(page.locator('#close-3')).toHaveAttribute('aria-disabled','true');
  await page.locator('#close-3').click({force:true});await expect(page.locator('#notice')).toContainText('You can close this month after it ends.');
  await page.locator('#close-2').click({force:true});await expect(page.locator('#notice')).toContainText('You can close this month after it ends.');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('#close-0').click();const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('any takeaways for future budgeting?');
  await expect(dialog).toContainText('still count in your projections and totals');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(page.locator('#month-0')).toBeVisible();
  await page.locator('#close-0').click();await dialog.getByLabel(/Notes \/ lessons learned/).fill('Groceries ran over; budget $50 more.');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#month-0')).toHaveCount(0);await expect(page.locator('#closed-note')).toContainText('1 closed month is hidden');
  await expect(annualTotals).toHaveText(totalsBefore);
  await expect(page.locator('#month-1')).toHaveText(februaryBefore);await expect(page.locator('#month-11')).toHaveText(decemberBefore);
  await expect(annualTotals.nth(0)).toHaveText(income);await expect(annualTotals.nth(1)).toHaveText(expenses);
  await expect(page.locator('#closed-note')).toContainText('Their data still counts in totals');
  await nav(page,'analysis');
  const projection=page.locator('table tbody tr').first();
  await expect(projection.locator('th')).toHaveText('2026');
  await expect(projection.locator('td').nth(0)).toHaveText(income);
  await expect(projection.locator('td').nth(1)).toHaveText(expenses);
  await nav(page,'year');
  await expect(page.locator('#closeout-reminder')).toContainText('1 past month is still open');
  await page.locator('#closeout-first').click();await dialog.getByRole('button',{name:'Skip'}).click();
  await expect(page.locator('#month-1')).toHaveCount(0);await expect(page.locator('#closeout-reminder')).toHaveCount(0);
  await expect(page.locator('#month-2')).toBeVisible();
  await page.reload();await expect(page.locator('#month-0')).toHaveCount(0);
  await expect(annualTotals).toHaveText(totalsBefore);await expect(page.locator('#month-11')).toHaveText(decemberBefore);
  await expect(annualTotals.nth(0)).toHaveText(income);await expect(annualTotals.nth(1)).toHaveText(expenses);
  await nav(page,'more');await page.getByRole('button',{name:'Lessons learned'}).click();
  await expect(page.getByRole('heading',{name:'Lessons learned',level:1})).toBeVisible();
  await expect(page.locator('.lessons li')).toHaveCount(1);await expect(page.locator('.lessons')).toContainText('January 2026');await expect(page.locator('.lessons')).toContainText('Groceries ran over');
  await page.getByRole('button',{name:'Edit note for January 2026'}).click();await dialog.getByLabel('Notes / lessons learned').fill('Plan $50 extra for groceries.');await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.lessons')).toContainText('Plan $50 extra');
  await page.getByRole('button',{name:'Delete note for January 2026'}).click();await dialog.getByRole('button',{name:'Delete note'}).click();
  await expect(page.locator('.lessons li')).toHaveCount(0);await expect(page.locator('main')).toContainText('No notes yet.');
});

test('lessons and closed months round-trip through JSON export and import',async({page},info)=>{
  await page.clock.setFixedTime(new Date('2026-03-15T12:00:00'));
  await setupPlan(page);await page.locator('#close-0').click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel(/Notes \/ lessons learned/).fill('Keep a buffer.');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await nav(page,'more');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON backup'}).click();const file=info.outputPath('closeout-backup.json');await(await downloadPromise).saveAs(file);
  const backup=JSON.parse(await fs.readFile(file,'utf8'));expect(backup.state.lessons).toHaveLength(1);expect(backup.state.years[0].months[0].locked).toBe(true);
  await nav(page,'year');await page.locator('#closeout-first').click();await dialog.getByRole('button',{name:'Skip'}).click();await expect(page.locator('#month-1')).toHaveCount(0);
  await nav(page,'more');const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Import JSON backup'}).click();
  await(await chooserPromise).setFiles({name:'closeout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('button',{name:'Import this plan'}).click();
  await nav(page,'year');await expect(page.locator('#month-0')).toHaveCount(0);await expect(page.locator('#month-1')).toBeVisible();
  await nav(page,'more');await page.getByRole('button',{name:'Lessons learned'}).click();await expect(page.locator('.lessons')).toContainText('Keep a buffer.');
});

test('sabbatical goal defaults to zero dedicated savings until contributions are entered',async({page})=>{
  await setupPlan(page);
  await nav(page,'goals');
  await page.getByRole('button',{name:'Add goal',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Goal name or description').fill('Sabbatical fund');
  await dialog.getByLabel('Target amount (CAD, %, months, or years)').fill('45000');
  await dialog.getByLabel('Target year',{exact:true}).selectOption('2030');
  await dialog.getByLabel('Target month',{exact:true}).selectOption('11');
  await expect(dialog.getByLabel('How to measure progress')).toHaveValue('dedicated');
  await expect(dialog.getByLabel('Contribution amount',{exact:true})).toHaveValue('fixed');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  const goal=page.locator('.goal-grid .card');
  await expect(goal).toContainText('Dedicated goal savings');
  await expect(goal).toContainText('Savings plan: Not reached');
  await expect(goal).toContainText('Planned savings at target date: $0');
  await expect(goal).not.toContainText('Household net worth');
  await page.reload();await nav(page,'goals');
  await expect(goal).toContainText('Planned savings at target date: $0');
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await dialog.getByLabel('Already saved').fill('5000');
  await dialog.getByLabel('Fixed amount per payment').fill('100');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(goal).toContainText('Planned savings at target date: $11,000');
  await expect(goal).toContainText('Savings plan: Not reached');
  // Calculating the contributions needed to meet the target remains an explicit option.
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await dialog.getByLabel('Contribution amount',{exact:true}).selectOption('auto');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(goal).toContainText('Planned savings at target date: $45,000');
  await page.reload();await nav(page,'goals');
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await expect(dialog.getByLabel('Contribution amount',{exact:true})).toHaveValue('auto');
});

test('home-improvement goals default to a savings plan and distinguish metric targets from funding',async({page})=>{
  await setupPlan(page);
  await nav(page,'goals');
  await page.getByRole('button',{name:'Add goal',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Goal name or description').fill('Accessible home improvements');
  await expect(dialog.getByLabel('What are you aiming for?')).toHaveValue('customSavings');
  await expect(dialog.getByLabel('How to measure progress')).toHaveValue('dedicated');
  await expect(dialog.getByLabel('Already saved')).toBeVisible();
  await dialog.getByLabel('Target amount (CAD, %, months, or years)').fill('18000');
  await dialog.getByLabel('Target year',{exact:true}).selectOption('2028');
  await dialog.getByLabel('Target month',{exact:true}).selectOption('11');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  const goal=page.locator('.goal-grid .card');
  await expect(goal).toContainText('Dedicated goal savings');
  await expect(goal).toContainText('Savings plan:');
  await expect(goal).toContainText('money is not moved or confirmed saved');
  await expect(goal).not.toContainText('Achieved');
  await expect(goal).not.toContainText('Household net worth');
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await dialog.getByLabel('What are you aiming for?').selectOption('netWorthMilestone');
  await expect(dialog.getByLabel('How to measure progress')).toHaveValue('automatic');
  await dialog.getByLabel('What are you aiming for?').selectOption('renovationFund');
  await expect(dialog.getByLabel('How to measure progress')).toHaveValue('dedicated');
  // A large household balance cannot fund a savings plan with no contributions.
  await dialog.getByLabel('Contribution amount',{exact:true}).selectOption('fixed');
  await dialog.getByLabel('Fixed amount per payment').fill('0');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(goal).toContainText('Savings plan: Not reached');
  await expect(goal).toContainText('Planned savings at target date: $0');
  // Explicit net-worth tracking remains available, with funding caveats on the card.
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await dialog.getByLabel('What are you aiming for?').selectOption('customNetWorth');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(goal).toContainText('Funding not assessed');
  await expect(goal.locator('progress')).toHaveCount(0);
  await expect(goal).toContainText('does not show money earmarked or available for this goal');
  await page.reload();await nav(page,'goals');
  await expect(goal).toContainText('Household net worth');
  await goal.getByRole('button',{name:'Edit goal',exact:true}).click();
  await expect(dialog.getByLabel('How to measure progress')).toHaveValue('automatic');
  // Existing net-worth goals can be reassessed using only their savings schedule.
  await dialog.getByLabel('How to measure progress').selectOption('dedicated');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(goal).toContainText('Dedicated goal savings');
  await expect(goal).toContainText('Savings plan: Not reached');
  await expect(goal).toContainText('Planned savings at target date: $0');
  await expect(goal).not.toContainText('Funding not assessed');
  await expect(goal.locator('progress')).toHaveAttribute('value','0');
  await page.reload();await nav(page,'goals');
  await expect(goal).toContainText('Planned savings at target date: $0');
});


test('imported mortgage exclusion warns until a separate payment covers spending',async({page})=>{
  await setupPlan(page);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('finance-plan-beta.v1')).state);
  state.budgetItems[0].expense='Household expenses (excluding mortgage)';
  state.budgetItems[0].cost=3500;
  await nav(page,'more');
  const chooserPromise=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Import JSON backup'}).click();
  await(await chooserPromise).setFiles({name:'synthetic-plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'finance-plan-beta',version:1,state}))});
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('.mortgage-warning')).toContainText('Mortgage payment may be missing');
  await dialog.getByRole('button',{name:'Import this plan'}).click();
  await nav(page,'year');
  await expect(page.locator('.plan-status')).toContainText('Review mortgage spending');
  await page.getByRole('button',{name:'Review Budget',exact:true}).click();
  await expect(page.locator('main .mortgage-warning')).toBeVisible();
  await expect(page.locator('main > .metrics')).toContainText('$42,000');
  await expect(page.locator('main > .metrics')).toContainText('$3,500');
  await page.getByRole('button',{name:'Add expense',exact:true}).click();
  await dialog.getByLabel('Expense name',{exact:true}).fill('Mortgage payment');
  await dialog.getByLabel('Category',{exact:true}).fill('Housing');
  await dialog.getByLabel('Amount per occurrence (CAD)').fill('1900');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await expect(page.locator('.mortgage-warning')).toHaveCount(0);
  await expect(page.locator('main > .metrics')).toContainText('$64,800');
  await expect(page.locator('main > .metrics')).toContainText('$5,400');
  await expect(page.locator('main .debt-notice')).toContainText('Debt payments are expenses only');
  await page.reload();
  await expect(page.locator('.mortgage-warning')).toHaveCount(0);
  await expect(page.locator('main > .metrics')).toContainText('$64,800');
  await nav(page,'year');
  await expect(page.locator('.plan-status')).not.toContainText('Review mortgage spending');
  await expect(page.locator('main > .metrics > .metric').nth(1)).toContainText('$64,800');
});

test('individual stop-work ages keep the younger partner earning in 2029',async({page})=>{
  await setupPlan(page,{second:true});
  await nav(page,'more');
  await page.getByRole('button',{name:'Household & province',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('#ageA').fill('62');
  await dialog.locator('#ageB').fill('59');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await page.getByRole('button',{name:'Inflation, growth & retirement',exact:true}).click();
  await dialog.getByLabel('Taylor: stop-work age',{exact:true}).fill('62');
  await dialog.getByLabel('Morgan: stop-work age',{exact:true}).fill('65');
  await dialog.getByRole('button',{name:'Save changes'}).click();
  await nav(page,'salary');
  await page.getByLabel('Year',{exact:true}).selectOption('2029');
  await expect(page.locator('.metrics')).toContainText('One retired');
  const pat=page.locator('.person-grid section').filter({has:page.getByRole('heading',{name:'Taylor',exact:true})});
  const lee=page.locator('.person-grid section').filter({has:page.getByRole('heading',{name:'Morgan',exact:true})});
  await expect(pat).toContainText('Retired');await expect(pat).toContainText('2026');
  await expect(lee).toContainText('Working');await expect(lee).toContainText('2032');
  await page.reload();
  await expect(page.locator('.metrics')).toContainText('One retired');
  await page.getByLabel('Year',{exact:true}).selectOption('2032');
  await expect(lee).toContainText('Retired');
});

test('wide screens retain a centered phone column and all navigation',async({page},info)=>{
  await page.setViewportSize({width:1440,height:844});
  await setupPlan(page);
  const app=await page.locator('#app').boundingBox();
  expect(app.width).toBeLessThanOrEqual(430);
  expect(app.x).toBeCloseTo((1440-app.width)/2,0);
  const navigation=page.getByRole('navigation',{name:'Main navigation'});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('button')).toHaveCount(5);
  const bar=await navigation.boundingBox();
  expect(bar.width).toBe(app.width);
  expect(bar.x).toBe(app.x);
  expect(bar.y+bar.height).toBeCloseTo(844,0);
  await page.screenshot({path:info.outputPath('wide-phone-layout.png'),fullPage:true});
  for(const [tab,title] of [['goals','Goals'],['analysis','Projection & analysis']]){
    await nav(page,tab);
    await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();
    await expect(navigation.getByRole('button',{name:'More',exact:true})).toHaveAttribute('aria-current','page');
  }
  await nav(page,'more');
  await page.getByRole('button',{name:'Household & province',exact:true}).click();
  expect((await page.getByRole('dialog').boundingBox()).width).toBeLessThanOrEqual(430);
});

test('every page, chart, table and editor fits a 360px phone',async({page},info)=>{
  await page.setViewportSize({width:360,height:800});
  await setupPlan(page,{second:true});
  const fits=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const tab of ['year','salary','budget','invest','goals','analysis','more','lessons']){
    if(tab==='lessons'){
      await nav(page,'more');
      await page.getByRole('button',{name:'Lessons learned',exact:true}).click();
    }else await nav(page,tab);
    await fits();
    if(tab==='analysis'){
      const table=page.locator('.table-scroll');
      expect(await table.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
      expect((await page.locator('.chart svg').boundingBox()).width).toBeLessThanOrEqual(328);
      await page.screenshot({path:info.outputPath('projection-360.png'),fullPage:true});
    }
  }
  for(const [tab,button] of [['year','Edit January'],['salary','Edit this year'],['budget','Add expense'],['goals','Add goal'],['more','Household & province']]){
    await nav(page,tab);
    await page.getByRole('button',{name:button,exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    const box=await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(360);
    await fits();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  }
});

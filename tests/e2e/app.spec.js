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
  await page.getByLabel('How should your pay change?').selectOption('inflation');
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

test('setup drafts survive finish-later and reload; Back works before assumptions are chosen',async({page})=>{
  await page.goto('./');await page.getByRole('button',{name:'Build my plan'}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Draft name');
  await page.getByRole('button',{name:'Save and finish later'}).click();
  await page.reload();await page.locator('#resume-banner').click();
  await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('Draft name');
  await page.getByLabel('Your age in the starting year').fill('40');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Assumptions',level:1})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Starting balances',level:1})).toBeVisible();
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
  await expect(page.locator('#closeout-reminder')).toContainText('2 past months are still open');
  await expect(page.locator('#close-3')).toHaveAttribute('aria-disabled','true');
  await page.locator('#close-3').click({force:true});await expect(page.locator('#notice')).toContainText('You can close this month after it ends.');
  await page.locator('#close-2').click({force:true});await expect(page.locator('#notice')).toContainText('You can close this month after it ends.');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('#close-0').click();const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('any takeaways for future budgeting?');
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await expect(page.locator('#month-0')).toBeVisible();
  await page.locator('#close-0').click();await dialog.getByLabel(/Notes \/ lessons learned/).fill('Groceries ran over; budget $50 more.');await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('#month-0')).toHaveCount(0);await expect(page.locator('#closed-note')).toContainText('1 closed month is hidden');
  await expect(page.locator('#closeout-reminder')).toContainText('1 past month is still open');
  await page.locator('#closeout-first').click();await dialog.getByRole('button',{name:'Skip'}).click();
  await expect(page.locator('#month-1')).toHaveCount(0);await expect(page.locator('#closeout-reminder')).toHaveCount(0);
  await expect(page.locator('#month-2')).toBeVisible();
  await page.reload();await expect(page.locator('#month-0')).toHaveCount(0);
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

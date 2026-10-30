import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startTester} from './tester-run.mjs';

const session = await startTester('on-student', {acceptance: true});
const {command: send, page, directory} = session;
const click = text => send({op: 'click', role: 'button', text});
const fill = (label, value) => send({op: 'fill', label, value});
const select = (label, value) => send({op: 'select', label, value});
const text = () => send({op: 'text'});
const shot = name => send({op: 'screenshot', name});
const nav = async tab => {
  if (['goals','analysis','lessons'].includes(tab)) {
    await send({op: 'click', selector: '[data-tab="more"]'});
    await send({op: 'click', selector: '#open-' + tab});
  } else await send({op: 'click', selector: `[data-tab="${tab}"]`});
};
try {
  assert.match(await text(), /Build my plan/, 'Acceptance run needs an unused student profile; use another normal session to inspect an existing plan.');
  await send({op: 'note', text: 'Fictional Alex, Ontario student age 21. CAD 18,000 part-time gross; expenses 1,450/month including 100 student-loan payment. Student debt principal 18,000. Baseline year 2026; no clock manipulation.'});
  await shot('welcome');
  await click('Build my plan');
  await fill('Your name', 'Alex'); await fill('Your age in the starting year', 21);
  await fill('Starting year', 2026); await select('Province or territory', 'ON');
  await click('Continue'); await fill('Alex · annual salary', 18000);
  await click('Continue'); await fill('Expense name', 'Housing'); await fill('Monthly amount', 950);
  await click('Continue');
  for (const [label, amount] of [['Bank balance',1500],['TFSA',500],['RRSP',0]]) await fill('Alex · ' + label, amount);
  await click('Continue'); await select('How should your pay change?', 'same');
  await fill('Annual price inflation (%)', 2); await fill('Annual investment return (%)', 4); await fill('Shared stop-work age', 65);
  await click('Continue');
  await fill('Alex · CPP/QPP start age', 65); await fill('Alex · OAS start age', 65);
  await click('Continue'); assert.match(await text(), /Ontario/); await shot('setup-review');
  await click('Open my plan'); assert.match(await text(), /Your year, in focus/); await shot('year');
  await nav('salary'); assert.match(await text(), /\$18,000/); await shot('salary');
  await nav('budget');
  for (const [expense, amount] of [['Groceries',300],['Transport',100],['Student loan payment',100]]) {
    await click('Add expense'); await fill('Expense name', expense); await fill('Amount per occurrence (CAD)', amount); await click('Save changes');
  }
  assert.match(await text(), /Student loan payment/); const budgetScreenshot = await shot('budget-debt');
  await nav('invest'); await fill('Alex · TFSA room', 5000); await fill('Alex · RRSP room', 1000); await click('Save room');
  await select('When to invest', 'monthly'); await click('Save investment plan'); await shot('invest');
  await send({op:'note',text:'Used fictional verified-room assumptions of TFSA 5,000 and RRSP 1,000; not inferred from age or current-year earnings. Fixed salary is an annual approximation for variable part-time hours.'});
  await nav('goals'); await click('Add goal'); await fill('Goal name or description', 'Emergency buffer');
  await select('What are you aiming for?', 'emergencyFund');
  await fill('Target amount (CAD, %, months, or years)', 3000); await select('Target year', '2027');
  await select('How to measure progress', 'dedicated'); await click('Save changes');
  assert.match(await text(), /Emergency buffer/); assert.match(await text(), /payments/); await shot('goals');
  await nav('analysis'); assert.match(await text(), /Projection & analysis/); await shot('projection');
  await nav('more'); await send({op:'click',text:'What the numbers assume'});
  assert.match(await text(), /self-employment payroll/); await shot('more');
  await nav('lessons'); assert.match(await text(), /No notes yet/); await shot('lessons-before');
  await nav('year'); assert.match(await text(), /\$17,400/); await shot('year-before-close');
  await send({op:'click',selector:'#close-0'});
  await fill('Notes / lessons learned — any takeaways for future budgeting?', 'Keep a buffer for exam weeks with fewer shifts.');
  await shot('closeout'); await click('Save');
  assert.equal(await page.locator('#month-0').count(), 0);
  await nav('lessons'); assert.match(await text(), /Keep a buffer/); await shot('lesson');
  await send({op:'goto'}); await nav('lessons'); assert.match(await text(), /Keep a buffer/);
  await nav('more'); const backupFile = await send({op:'export'});
  const backup = JSON.parse(await fs.readFile(path.join(directory,backupFile),'utf8'));
  assert.equal(backup.state.nameA, 'Alex');
  assert.equal(backup.state.budgetItems.reduce((sum,item)=>sum+item.cost,0), 1450);
  assert.equal(backup.state.years[0].months[0].locked, true);
  assert.equal(backup.state.lessons.length, 1); assert.equal(backup.state.goals[0].targetAmount, 3000);
  await send({op:'import',file:backupFile}); assert.match(await text(), /Alex/); await shot('import-preview');
  await click('Import this plan'); await send({op:'goto'});
  await nav('budget'); assert.match(await text(), /Student loan payment/);
  await nav('goals'); assert.match(await text(), /Emergency buffer/);
  await nav('lessons'); assert.match(await text(), /Keep a buffer/);
  await nav('year'); assert.equal(await page.locator('#month-0').count(),0); const finalScreenshot = await shot('final');
  const finalMetrics = await page.locator('.metrics').innerText();
  assert.deepEqual(await send({op:'errors'}), []);
  let issue = `# Issues\n\n## [idea] Track student debt principal alongside monthly payments\nDedupe-key: debt-principal-tracking\nSteps: 1. Set up Alex with cash 1,500, TFSA 500 and student debt 18,000. 2. Visit Budget and add Student loan payment at 100 per month. 3. Inspect starting balances, More and Projection for a debt principal input.\nExpected: As a student I want to record my outstanding loan and distinguish reducing the balance from paying interest.\nActual: I could add a payment expense but found no dedicated liability balance or payoff schedule in the visited screens. This is a feature request; no independently verified tax or arithmetic error is claimed.\nScreenshot: testers/on-student/${budgetScreenshot.replaceAll('\\','/')}\n`;
  if (finalMetrics.includes('$15,950')) {
    issue += `\n## [wrong-number] Closing a month removes its expenses from annual totals\nDedupe-key: closed-month-excluded-from-annual-totals\nSteps: 1. Use 2026 and monthly expenses Housing 950, Groceries 300, Transport 100 and Student loan payment 100. 2. Observe Year expenses of 17,400 before closing. 3. Close January with a lesson, then inspect Year totals. 4. Reload or export/import; the discrepancy persists.\nExpected: Annual expenses stay 1,450 x 12 = 17,400. The page explicitly says closed data still counts in totals.\nActual: Year expenses fall to 15,950 = 1,450 x 11, omitting January. Take-home also falls when the month closes. No edits to income or expenses were made during closeout.\nScreenshot: testers/on-student/${finalScreenshot.replaceAll('\\','/')}\n`;
  }
  await fs.writeFile(path.join(directory,'issues.md'),issue);
  await send({op:'note',text:`Journey completed: setup; all tabs including Lessons; expenses sum to CAD 1,450/month; emergency goal; close January; reload; export ${backupFile}; import preview/confirm; restored expense, goal, lesson and locked month; zero console/page errors. ${issue.includes('[wrong-number]') ? 'Finding: closing January reduced annual expenses from 17,400 to 15,950.' : 'No closed-month annual expense discrepancy observed.'} Debt principal idea recorded. No tax accuracy, offline or other persona run claimed.`});
  console.log('Student acceptance journey passed. Backup: ' + backupFile);
} catch (error) {
  await send({op:'note',text:'Acceptance journey failed: '+error.message});
  await shot('failure'); throw error;
} finally {await session.close();}

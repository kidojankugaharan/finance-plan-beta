import {test,expect} from '@playwright/test';
import {createEngine} from '../../src/engine/index.js';
import {STORAGE_KEY} from '../../src/state.js';

test('new residents can enter confirmed room for both people without using lifetime estimates (#90)',async ({page})=>{
  const state=createEngine({baseYear:2026,singlePerson:false,nameA:'Avery',nameB:'Drew',ageA:35,ageB:34}).state;
  state.setup={started:true,completed:true,seen:{},step:6};
  await page.goto('./');
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify({state,history:[]})),{key:STORAGE_KEY,state});
  await page.reload();
  await page.locator('[data-tab="more"]').click();
  await page.locator('[data-tab="invest"]').click();
  await expect(page.getByText('Residency history is not collected.',{exact:false})).toBeVisible();
  await expect(page.getByText('Use room at the start of the selected year',{exact:false})).toBeVisible();
  const values={rrspA:4200,tfsaA:15000,rrspB:0,tfsaB:18000};
  for(const [id,value] of Object.entries(values)){
    const label=`${id.endsWith('A')?'Avery':'Drew'} - ${id.slice(0,-1).toUpperCase()} room (CRA + records)`;
    const input=page.getByRole('spinbutton',{name:label,exact:true});
    await expect(input).toHaveValue('');
    await expect(page.locator(`#${id}-hint`)).toContainText('Not entered. Enter confirmed room');
    await input.fill(String(value));
  }
  await page.getByRole('button',{name:'Save contribution room',exact:true}).click();
  await page.reload();
  for(const [id,value] of Object.entries(values)){
    await expect(page.locator(`#${id}`)).toHaveValue(String(value));
    await expect(page.locator(`#${id}-hint`)).toContainText('Entered for this year');
  }
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).state,STORAGE_KEY);
  expect(saved.years[0].planRoomCaps).toEqual(values);
  expect(saved.years[0].planRoomManual).toEqual({rrspA:true,tfsaA:true,rrspB:true,tfsaB:true});
  // The limitation must be visible before accepting estimates, even with saved inputs.
  await page.getByRole('button',{name:'Use estimates',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('If you moved to Canada after age 18');
  await expect(page.getByRole('dialog')).toContainText('Estimates assume Canadian residency since age 18');
  await page.getByRole('button',{name:'Use these estimates',exact:true}).click();
  for(const [id,value] of Object.entries(values)) await expect(page.locator(`#${id}`)).toHaveValue(String(value));
  await page.locator('#invest-year').selectOption('2027');
  await expect(page.locator('#tfsaA-hint')).toContainText('Projected from a previous year');
});

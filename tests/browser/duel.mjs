import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.RAID_TEST_URL || 'http://127.0.0.1:5500';
await page.route('**/__duel_test__',r=>r.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"></head><body><main id="fixture"></main></body></html>'}));
await page.route('https://game.alcanthia.com/**',r=>r.abort());
async function mount(){
  await page.goto(base+'/__duel_test__');
  await page.evaluate(async()=>{
    const {api}=await import('/js/api.js');
    api.garden=async q=>({profile:{userId:q.nickname||q.userId,nickname:q.nickname||q.userId,
      spellLevels:{bond_rune:4,levitation:3},grid:[],
      gardenRaidDefenseParty:{adventurerIds:['sorin'],equipment:{sorin:{itemKey:'dia_scepter+9'}},potions:['frenzy_potion+4']},
      pvpDefenseParty:{adventurerIds:['lina'],equipment:{lina:{itemCode:'dia_scepter',enhancement:2}},potions:[]}}});
    const {raidSim}=await import('/js/raid.js');await raidSim(document.querySelector('#fixture'));
  });
}
async function load(){for(const side of ['attacker','defender']){await page.locator(`#raid-${side}-query`).fill(side);await page.locator(`#raid-${side}-form button`).click();await page.locator(`#raid-${side}-party .raid-edit-member`).waitFor();}}
try{
  await mount();await load();
  await page.locator('#raid-defender-party').getByRole('spinbutton',{name:'장비 강화도',exact:true}).fill('11');
  await page.locator('#raid-mode').selectOption('duel');
  await page.waitForFunction(()=>document.querySelector('#raid-run').textContent.includes('결투'));
  await load();
  assert.equal(await page.locator('.raid-opening-settings').isVisible(),false);
  assert.equal(await page.locator('#raid-defender-party').getByRole('spinbutton',{name:'장비 강화도',exact:true}).inputValue(),'2');
  await page.locator('#raid-run').click();
  await page.locator('.raid-final-rate').waitFor();
  assert.match(await page.locator('.raid-final-rate').innerText(),/결투 승률[\s\S]*무승부/);
  assert.equal(await page.locator('.err-box').count(),0);
  assert.doesNotMatch(await page.locator('#raid-attacker-party').innerText(), /최소 1개|공격 포션을 1개/);
  await page.locator('#raid-defender-party').getByRole('spinbutton',{name:'장비 강화도',exact:true}).fill('5');
  await page.locator('#raid-mode').selectOption('raid');
  await page.waitForFunction(()=>document.querySelector('#raid-defender-party input[aria-label="장비 강화도"]')?.value==='11');
  await page.locator('#raid-mode').selectOption('duel');
  await page.waitForFunction(()=>document.querySelector('#raid-defender-party input[aria-label="장비 강화도"]')?.value==='5');
  await mount();assert.equal(await page.locator('#raid-mode').inputValue(),'duel');
  await page.locator('#raid-run').click();await page.locator('.raid-final-rate').waitFor();
  await page.screenshot({path:'/tmp/oct8-duel-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'/tmp/oct8-duel-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Duel: per-mode profiles/equipment, no-potion fight, result, isolated drafts, reload and mobile passed.');
}finally{await browser.close();}

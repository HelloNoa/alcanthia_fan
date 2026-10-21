// Requires a running local server; also checks the live player-shop API.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const base = process.env.SHOPS_URL || 'http://localhost:8765/shops/';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);
await page.locator('.shop-card').first().waitFor({timeout:30000});
console.log('LIVE',await page.locator('.shops-status').innerText(), 'cards', await page.locator('.shop-card').count());
for(const width of [390,1280]){
 await page.setViewportSize({width,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`/tmp/shops-${width}.png`,fullPage:true});
}
if(!process.env.SHOPS_URL){
 let mode='normal';let requests=[];
 await page.route('**/player-shops?**',async route=>{
  const url=new URL(route.request().url());requests.push(url);
  if(mode==='error')return route.fulfill({status:502,json:{detail:'upstream'}});
  if(url.searchParams.get('q')==='slow')await new Promise(r=>setTimeout(r,500));
  const offset=Number(url.searchParams.get('offset'));
  return route.fulfill({json:{shops:mode==='empty'?[]:[{id:offset+1,title:url.searchParams.get('q')||'<img src=x onerror=alert(1)>',nickname:'판매자',offerCount:3,accepting:url.searchParams.get('openOnly')==='true'}],hasMore:offset===0,shopsTotal:21}});
 });
 await page.locator('#shops-refresh').click();
 await page.getByRole('heading',{name:'<img src=x onerror=alert(1)>'}).waitFor();
 assert.equal(await page.locator('.shop-card img').count(),0);
 await page.locator('#shops-next').click();
 await page.getByText('가판대 #21',{exact:true}).waitFor();
 assert.equal(await page.locator('#shops-next').isDisabled(),true);
 await page.locator('#shops-zone').selectOption('beginner_forest');
 await page.getByText('가판대 #1',{exact:true}).waitFor();
 assert.equal(requests.at(-1).searchParams.get('zone'),'beginner_forest');
 assert.equal(requests.at(-1).searchParams.get('offset'),'0');
 await page.locator('#shops-query').fill('  물감  ');await page.locator('.shops-search').press('Enter');
 await page.getByRole('heading',{name:'물감',exact:true}).waitFor();
 assert.equal(requests.at(-1).searchParams.get('offset'),'0');
 await page.locator('#shops-open').uncheck();await page.getByText('영업 종료',{exact:true}).waitFor();
 assert.equal(requests.at(-1).searchParams.get('openOnly'),'false');
 assert.equal(requests.at(-1).searchParams.get('zone'),'beginner_forest');
 mode='empty';await page.locator('#shops-refresh').click();await page.getByText(/조건에 맞는 가판대가 없습니다/).waitFor();
 mode='error';await page.locator('#shops-refresh').click();await page.locator('#shops-retry').waitFor();assert.equal(await page.locator('.shop-card').count(),0);
 mode='normal';await page.locator('#shops-retry').click();await page.locator('.shop-card').waitFor();
 await page.locator('#shops-query').fill('slow');await page.locator('.shops-search').press('Enter');
 await page.locator('#shops-query').fill('fast');await page.locator('.shops-search').press('Enter');
 await page.getByRole('heading',{name:'fast',exact:true}).waitFor();await page.waitForTimeout(700);
 assert.equal(await page.locator('.shop-card h3').innerText(),'fast');
 console.log('PASS pagination, search, filter, empty, error/retry, text safety, stale responses');
}
assert.deepEqual(errors,[]);console.log('PASS mobile/desktop overflow, no JS errors');
await browser.close();

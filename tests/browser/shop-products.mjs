// Requires a local server and the live shop-detail API.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import assert from 'node:assert/strict';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.SHOPS_URL || 'http://localhost:8765/shops/');
await page.locator('.shop-card').first().waitFor();
await page.locator('.shop-products summary').first().click();
await page.locator('.shop-product').first().waitFor();
console.log('LIVE',await page.locator('.shop-product').first().innerText());
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:'/tmp/shop-products-mobile.png'});
if(!process.env.SHOPS_URL){
 let mode='error', calls=0;
 await page.route('**/player-shops/*',async route=>{
  calls++;
  if(mode==='error')return route.fulfill({status:502,json:{detail:'error'}});
  const offer={published:true,title:'<script>alert(1)</script>',description:'상품 설명',type:'quote',quote:{payment:[{itemKey:'herb+2',count:3}],delivery:[{itemKey:'mana_potion+4',count:20}],paymentGold:1234,deliveryDays:2}};
  return route.fulfill({json:{shop:mode==='missing'?null:{description:'상점 설명',offers:mode==='empty'?[]:[offer,{...offer,title:'협의 상품',quote:null},{...offer,published:false,title:'비공개 상품'}]}}});
 });
 async function openFresh(){await page.locator('#shops-refresh').click();await page.locator('.shop-card').first().waitFor();await page.locator('.shop-products summary').first().click();}
 await openFresh();await page.getByRole('button',{name:'상품 다시 시도'}).waitFor();
 mode='good';await page.getByRole('button',{name:'상품 다시 시도'}).click();
 await page.getByRole('heading',{name:'<script>alert(1)</script>',exact:true}).waitFor();
 assert.equal(await page.locator('.shop-product script').count(),0);
 assert.equal(await page.getByRole('heading',{name:'비공개 상품',exact:true}).count(),0);
 assert.equal(await page.locator('.shop-product').count(),2);
 assert.match(await page.locator('.shop-product').first().innerText(),/1,234 골드/);
 assert.match(await page.locator('.shop-product').first().innerText(),/\+4 × 20/);
 assert.match(await page.locator('.shop-product').first().innerText(),/\+2 × 3/);
 assert.match(await page.locator('.shop-product').first().innerText(),/납기 · 2일/);
 await page.locator('.shop-products summary').first().click();await page.locator('.shop-products summary').first().click();assert.equal(calls,2);
 mode='empty';await openFresh();await page.getByText('공개된 등록 상품이 없습니다.',{exact:true}).waitFor();
 mode='missing';await openFresh();await page.getByText('가판대를 찾을 수 없습니다. 목록을 새로고침해 주세요.',{exact:true}).waitFor();
 console.log('PASS detail retry, item enhancements/counts, payments, quote, unpublished, empty, missing, XSS');
}
assert.deepEqual(errors,[]);console.log('PASS mobile, JS errors');await browser.close();

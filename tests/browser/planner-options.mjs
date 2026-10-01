import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const base = process.env.PLANNER_TEST_URL || "http://127.0.0.1:5500";
const errors = [];
const makePage = async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/__planner_test__*", route => route.fulfill({ contentType: "text/html", body: '<html><head><base href="/"><link rel="stylesheet" href="/css/style.css"></head><body><main id="fixture"></main></body></html>' }));
  await page.route("https://game.alcanthia.com/**", route => route.abort());
  return page;
};
const mount = async (page, search = "", seed = false) => {
  await page.goto(`${base}/__planner_test__${search}`);
  await page.evaluate(async seed => {
    if (seed) localStorage.setItem("alc_planner_v3", JSON.stringify([[{ p: "herb", e: 2 }]]));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.copiedPlan = text; } } });
    await (await import("/js/planner.js")).renderPlanner(document.querySelector("#fixture"));
  }, seed);
};
const snapshot = page => page.evaluate(async () => {
  const { PLANNER_OPTION_FIELDS } = await import("/js/planner_options.js");
  return Object.fromEntries(PLANNER_OPTION_FIELDS.map(([key, id, fallback]) => {
    const el = document.getElementById(id);
    return [key, typeof fallback === "boolean" ? el.checked : typeof fallback === "number" ? +el.value : el.value];
  }));
});
try {
  const page = await makePage();
  await mount(page, "", true);
  await page.evaluate(async () => {
    const { PLANNER_OPTION_FIELDS } = await import("/js/planner_options.js");
    for (const [key, id, fallback, , max] of PLANNER_OPTION_FIELDS) {
      const el = document.getElementById(id);
      if (typeof fallback === "boolean") { el.checked = true; el.dispatchEvent(new Event("change", { bubbles: true })); }
      else { el.value = key === "zone" ? "sunset_cliff" : key === "uptime" ? 75 : max; el.dispatchEvent(new Event(key === "zone" ? "change" : "input", { bubbles: true })); }
    }
  });
  const original = await snapshot(page);
  const production = await page.locator("#pl-summary").textContent();
  await page.locator("#pl-share-url").click();
  await page.waitForFunction(() => window.copiedPlan);
  const url = new URL(await page.evaluate(() => window.copiedPlan));
  const fresh = await makePage();
  await mount(fresh, url.search);
  assert.deepEqual(await snapshot(fresh), original);
  assert.equal(await fresh.locator("#pl-summary").textContent(), production);
  assert.equal(new URL(fresh.url()).search, "");
  await mount(fresh);
  assert.deepEqual(await snapshot(fresh), original);
  await fresh.locator("#pl-slotname").fill("조건 테스트");
  await fresh.locator("#pl-save-btn").click();
  await fresh.locator("#pl-harvest").uncheck();
  await fresh.locator("#pl-slots [data-load]").click();
  assert.deepEqual(await snapshot(fresh), original);
  // Old grid-only links still load and do not borrow the recipient's saved conditions.
  url.searchParams.delete("conditions");
  await mount(fresh, url.search);
  const legacy = await snapshot(fresh);
  assert.equal(legacy.harvest, false);
  assert.equal(legacy.timeM, 0);
  assert.equal(legacy.uptime, 100);
  assert.equal(legacy.zone, "");
  assert.deepEqual(errors, []);
  console.log("Planner conditions: all 21 fields, fresh shared link, production, reload, slots and legacy links passed.");
} finally { await browser.close(); }

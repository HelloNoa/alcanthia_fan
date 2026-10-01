// Run with a local server and Playwright: node tests/browser/raid-edit.mjs
// PLAYWRIGHT_MODULE may point to a bundled playwright module.
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const base = process.env.RAID_TEST_URL || "http://127.0.0.1:5500";
await page.route("**/__raid_test__", route => route.fulfill({ contentType: "text/html", body:
  '<html><head><link rel="stylesheet" href="/css/style.css"></head><body><main id="fixture"></main></body></html>' }));
await page.route("https://game.alcanthia.com/**", route => route.abort());
const mount = async () => {
  await page.goto(`${base}/__raid_test__`);
  await page.evaluate(async () => {
    const { api } = await import("/js/api.js");
    api.garden = async query => {
      const nickname = query.nickname || query.userId;
      return { profile: {
        userId: nickname, nickname, spellLevels: { bond_rune: 4, levitation: 3 },
        gardenRaidDefenseParty: { adventurerIds: ["sorin"], potions: ["frenzy_potion+4"] },
        adventurerEquipment: { sorin: { itemKey: "dia_scepter+9(refined_amber+7)" } },
        grid: [[{ ornament: { effectEnabled: true, items: [{ itemKey: "warding_stone+6" }] } }]],
        raidAvailability: { canRaid: true },
      }};
    };
    const { raidSim } = await import("/js/raid.js");
    await raidSim(document.querySelector("#fixture"));
  });
};
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("alc_raid_sim_v1")));
try {
  await mount();
  for (const side of ["attacker", "defender"]) {
    await page.locator(`#raid-${side}-query`).fill(side);
    await page.locator(`#raid-${side}-form button`).click();
    await page.locator(`#raid-${side}-party .raid-edit-member`).waitFor();
  }
  const defender = page.locator("#raid-defender-party");
  assert.equal(await page.locator("#raid-warding-enh").isVisible(), false);
  await defender.getByRole("button", { name: "+ 모험가", exact: true }).click();
  await defender.getByRole("button", { name: "+ 포션", exact: true }).click();
  assert.equal((await stored()).defenderParty.adventurers.length, 2);
  assert.equal((await stored()).defenderParty.potions.length, 2);
  await defender.getByRole("button", { name: "모험가 제외", exact: true }).last().click();
  await defender.getByRole("button", { name: "포션 제외", exact: true }).last().click();
  await defender.getByRole("spinbutton", { name: "장비 강화도", exact: true }).fill("18");
  await defender.getByRole("spinbutton", { name: "세공 강화도", exact: true }).fill("12");
  await defender.getByRole("spinbutton", { name: "포션 강화도", exact: true }).fill("8");
  await page.locator("#raid-warding-mode").selectOption("custom");
  await page.locator("#raid-warding-enh").fill("10");
  let draft = await stored();
  assert.equal(draft.defenderParty.adventurers[0].equipEnh, 18);
  assert.equal(draft.defenderParty.adventurers[0].engraved[0].enhancement, 12);
  assert.equal(draft.defenderParty.potions[0].enh, 8);
  assert.equal(draft.attackerParty.adventurers[0].equipEnh, 9);
  assert.equal(draft.wardingOverride, 10);
  // Reload restores each side independently, including the defense override.
  await mount();
  assert.equal(await defender.getByRole("spinbutton", { name: "장비 강화도", exact: true }).inputValue(), "18");
  assert.equal(await page.locator("#raid-warding-enh").inputValue(), "10");
  await page.locator("#raid-run").click();
  await page.locator(".raid-final-rate b").waitFor();
  const expected = await page.evaluate(async () => {
    const { raidWinRate } = await import("/js/battle.js");
    const { gamedata } = await import("/js/api.js");
    const saved = JSON.parse(localStorage.getItem("alc_raid_sim_v1"));
    return (100 * raidWinRate(saved.attackerParty, saved.defenderParty, await gamedata(), "enemy_first_interleaved", 1000, 20260723).rate).toFixed(1) + "%";
  });
  assert.equal(await page.locator(".raid-final-rate b").textContent(), expected);
  await page.locator("#raid-stealth").selectOption("9");
  assert.equal(await page.locator(".raid-final-rate").count(), 0);
  const expectedOpening = (100 * (1 - 0.9 ** 10) * 0.9 ** 11).toFixed(1);
  assert.ok((await page.locator("#raid-stealth-rate").textContent()).includes(`최종 ${expectedOpening}%`));
  await defender.getByRole("button", { name: "모험가 제외", exact: true }).click();
  await defender.getByRole("button", { name: "포션 제외", exact: true }).click();
  await page.locator("#raid-run").click();
  await page.locator(".raid-final-rate b").waitFor();
  assert.equal(await page.locator(".raid-final-rate b").textContent(), "100.0%");
  await defender.getByRole("button", { name: "불러온 편성으로 되돌리기" }).click();
  draft = await stored();
  assert.equal(draft.defenderParty.adventurers[0].equipEnh, 9);
  assert.equal(draft.wardingOverride, null);
  // Re-importing a different user must not carry over the previous user's draft.
  await defender.getByRole("spinbutton", { name: "장비 강화도", exact: true }).fill("19");
  await page.locator("#raid-defender-query").fill("new-defender");
  await page.locator("#raid-defender-form button").click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("alc_raid_sim_v1")).defenderUserId === "new-defender");
  assert.equal((await stored()).defenderParty.adventurers[0].equipEnh, 9);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (process.env.RAID_SCREENSHOT) await page.screenshot({ path: process.env.RAID_SCREENSHOT, fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Raid defense editing: import, edits, simulation inputs, opening chance, empty party, restore, reload, user switch and mobile passed.");
} finally {
  await browser.close();
}

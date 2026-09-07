import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEADERBOARD_CATEGORIES, formatLeylineRecovery, formatAdventureRecord,
  renderLeaderboardCategory,
} from "../js/leaderboard.js";
import { APP_ROUTE_DEFINITIONS } from "../scripts/app-pages.mjs";

const game = JSON.parse(readFileSync(new URL("../data/gamedata.json", import.meta.url)));
const category = (key) => LEADERBOARD_CATEGORIES.find((entry) => entry.key === key);

test("official ranking tabs start with leyline and exclude the legacy PvP response", () => {
  assert.deepEqual(LEADERBOARD_CATEGORIES.map(({ key }) => key), ["leyline", "level", "gold", "adventure"]);
  const meta = APP_ROUTE_DEFINITIONS.find(({ path }) => path === "rank");
  assert.match(meta.description, /지맥 회복/);
  assert.doesNotMatch(meta.description, /PvP/);
});

test("leyline PPM is cumulative share, not percent, rounded to two decimals", () => {
  assert.equal(formatLeylineRecovery(375392), "0.38");
  assert.equal(formatLeylineRecovery(1000000), "1.00");
  assert.equal(formatLeylineRecovery("1234567"), "1.23");
  assert.equal(formatLeylineRecovery(0), "0.00");
  for (const value of [undefined, null, "", "invalid", Infinity]) {
    assert.equal(formatLeylineRecovery(value), "—");
  }
  const html = renderLeaderboardCategory("leyline", { leyline: { top: [] } });
  assert.match(html, /월요일 09시/);
  assert.match(html, /누적/);
  assert.match(html, /아직 등록된 순위가 없습니다/);
});

test("gold uses the authoritative shop plus gross market sales total, including zero", () => {
  const gold = category("gold");
  assert.equal(gold.value({ total_gold_earned: 5961406483, market_gross_sales: 15310346055,
    leaderboard_gold_earned: 21271752538 }), "21,271,752,538");
  assert.equal(gold.value({ total_gold_earned: 999, leaderboard_gold_earned: 0 }), "0");
  assert.equal(gold.value({ total_gold_earned: 999 }), "—");
  assert.match(gold.description, /수수료 차감 전/);
  assert.match(gold.description, /우편·물물교환.*제외/);
});

test("adventure shows highest zone, nightmare difficulty and best turns", () => {
  const row = { max_zone_level: 16, best_zone_difficulty: 3, best_zone_min_turn: 1, adventures_completed: 234161 };
  assert.equal(formatAdventureRecord(row, game.zones), "추출의 심연 (악몽 Ⅲ) · 1턴");
  assert.equal(category("adventure").detail(row), "누적 완료 234,161회");
  assert.equal(formatAdventureRecord({ ...row, max_zone_level: 1, best_zone_difficulty: 0 }, game.zones), "속삭이는 숲 · 1턴");
  assert.equal(formatAdventureRecord({ ...row, max_zone_level: 99 }, game.zones), "지역 Lv.99 (악몽 Ⅲ) · 1턴");
  assert.equal(formatAdventureRecord({ max_zone_level: 0 }, game.zones), "완료 기록 없음");
  assert.match(category("adventure").description, /지역.*악몽.*턴/);
});

test("rank renderer preserves server order and escapes all public profile text", () => {
  const rows = [
    { user_id: 'first" onclick="bad', nickname: '<img src=x onerror=bad>', achievement_modifier: '<script>bad</script>', leaderboard_gold_earned: 1 },
    { user_id: "second", nickname: "두번째", leaderboard_gold_earned: 99 },
  ];
  const data = { gold: { top: rows, me: { userId: rows[0].user_id } }, pvp: { top: [{ rating: 999 }] } };
  const before = JSON.stringify(data);
  const html = renderLeaderboardCategory("gold", data);
  assert.match(html, /&lt;img src=x onerror=bad&gt;/);
  assert.match(html, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /data-uid="first&quot; onclick=&quot;bad"/);
  assert.doesNotMatch(html, /<img|<script|class="me"|PvP/);
  assert.ok(html.indexOf("&lt;img") < html.indexOf("두번째"));
  assert.match(html, /class="rank-user"/);
  assert.match(html, /class="rank-table-scroll"/);
  assert.equal(JSON.stringify(data), before);
});

test("missing, empty and malformed ranking sections have readable fallback messages", () => {
  assert.match(renderLeaderboardCategory("gold", {}), /랭킹 데이터를 제공하지 않습니다/);
  assert.match(renderLeaderboardCategory("gold", { gold: { top: {} } }), /랭킹 데이터를 제공하지 않습니다/);
  assert.match(renderLeaderboardCategory("level", { level: { top: [] } }), /아직 등록된 순위가 없습니다/);
  assert.match(renderLeaderboardCategory("level", { level: { top: [null, 1] } }), /아직 등록된 순위가 없습니다/);
});

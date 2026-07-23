import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readJson = (name) => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8"));
const gameData = readJson("gamedata.json");
const names = readJson("names.json");
const progression = readJson("progression.json");

const expectedItems = {
  guardian_censer: {
    name: "수호의 향로",
    perk: "사용 시 1시간 동안 지역 효과 +50%",
  },
  leyline_stitching_needle: {
    name: "지맥 봉합침",
    perk: "사용 시 습격으로 억제된 지역 효과 즉시 복구",
  },
  witch_paint_pot: {
    name: "오색 물감단지",
    perk: "사용 시 닉네임 색상 변경 · +0 15색, +1 30색, +2 이상 45색",
  },
  farmers_baton: {
    name: "새싹 지휘봉",
    perk: "텃밭에 설치 가능 · 주변 작물 상태 관측 및 관리 · +1부터 강화도+1 거리",
  },
};

for (const [code, expected] of Object.entries(expectedItems)) {
  assert.equal(gameData.items[code]?.name, expected.name);
  assert.equal(gameData.items[code]?.perk, expected.perk);
  assert.equal(names.items[code], expected.name);
  assert.equal(
    names.itemFolders[code],
    code === "farmers_baton" ? "items/ornament" : "items/tools",
  );
}

const recipes = [...(gameData.brew_recipes || []), ...(gameData.recipes_full || [])];
for (const code of ["guardian_censer", "leyline_stitching_needle", "witch_paint_pot"]) {
  assert.equal(recipes.some((recipe) => recipe.output === code), false, `${code} must not show a recipe`);
}

assert.deepEqual(gameData.dia_shop.witch_paint_pot, { dia: 400, requiredReputation: 20 });
assert.equal(Object.keys(gameData.dia_shop).length, 16);
assert.equal("dia_cauldron" in gameData.dia_shop, false);
for (const item of Object.values(gameData.dia_shop)) {
  assert.equal("lv" in item, false);
}

assert.equal(
  gameData.recipes_full.some((recipe) =>
    recipe.output === "farmers_baton"
    && recipe.requiredLevel === 0
    && recipe.inputs.join(",") === "warding_stone,cauldron_controller"),
  true,
);

assert.equal(gameData.sell_price.engraving_stone, 500);
assert.equal(gameData.sell_price.polishing_powder, 250);
assert.equal(gameData.sell_price.dia_box_30, 300000);
assert.equal(gameData.item_values.aquifer_potion, 510);
assert.equal(gameData.item_output_values.aquifer_potion, 750);
assert.equal(gameData.item_values.reversion_potion, 1500);
for (const code of ["vine_tendril", "aquifer_potion", "reversion_potion"]) {
  assert.equal(code in gameData.sell_price, false);
}

for (const id of ["reputation_good_neighbor", "reputation_troublemaker"]) {
  assert.equal(gameData.achievements.some((achievement) => achievement.id === id), true);
}
assert.equal(
  progression.tutorialGoals.some((goal) => goal.id === "collect_growth_potion_ingredients"),
  false,
);
for (const id of ["collect_growth_potion_herb", "collect_growth_potion_red_flower_leaf"]) {
  assert.equal(progression.tutorialGoals.some((goal) => goal.id === id), true);
}

console.log("latest game update data tests passed");

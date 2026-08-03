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
    folder: "items/tools",
  },
  leyline_stitching_needle: {
    name: "지맥 봉합침",
    perk: "사용 시 습격으로 억제된 지역 효과 즉시 복구",
    folder: "items/tools",
  },
  witch_paint_pot: {
    name: "오색 물감단지",
    perk: "사용 시 닉네임 색상 변경 · +0 15색, +1 30색, +2 이상 45색",
    folder: "items/tools",
  },
  farmers_baton: {
    name: "새싹 지휘봉",
    perk: "텃밭에 설치 가능 · 주변 작물 상태 관측 및 관리 · +1부터 강화도+1 거리",
    folder: "items/ornament",
  },
  campfire: {
    name: "모닥불",
    perk: "텃밭에 설치 가능 · 가마솥을 올려 마나 대신 연료로 연성 · 일반 연성은 장작, 묶음 연성은 잉걸 사용 · 장식물 강화도 이하 연료 사용 · 연성시간 ×0.9^연료 강화도",
    folder: "items/ornament",
  },
  levitation_chest: {
    name: "부유상자",
    perk: "텃밭에 설치 가능 · 가까운 가마솥의 재료 상자 · 보관 슬롯 6×(강화도+1)",
    folder: "items/ornament",
  },
  compost_bin: {
    name: "퇴비함",
    perk: "텃밭에 설치 가능 · 초당 아이템 1개를 소모해 인접 식물 강화도 +1 · 보관 슬롯 6×(강화도+1)",
    folder: "items/ornament",
  },
};

for (const [code, expected] of Object.entries(expectedItems)) {
  assert.equal(gameData.items[code]?.name, expected.name);
  assert.equal(gameData.items[code]?.perk, expected.perk);
  assert.equal(names.items[code], expected.name);
  assert.equal(names.itemFolders[code], expected.folder);
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
for (const [output, inputs, requiredLevel] of [
  ["levitation_chest", "storage_chest,levitation_core", 3],
  ["compost_bin", "storage_chest,mud", 7],
]) {
  assert.equal(
    gameData.recipes_full.some((recipe) =>
      recipe.output === output
      && recipe.requiredLevel === requiredLevel
      && recipe.inputs.join(",") === inputs),
    true,
  );
}

assert.equal(gameData.sell_price.engraving_stone, 500);
assert.equal(gameData.sell_price.polishing_powder, 250);
assert.equal(gameData.sell_price.dia_box_30, 300000);
assert.equal(gameData.item_values.aquifer_potion, 510);
assert.equal(gameData.item_output_values.aquifer_potion, 750);
assert.equal(gameData.item_values.reversion_potion, 1500);
assert.equal(gameData.item_output_values.mana_sprayer, 3730050);
assert.equal(gameData.item_output_values.cauldron_controller, 3936600);
for (const code of ["vine_tendril", "aquifer_potion", "reversion_potion"]) {
  assert.equal(code in gameData.sell_price, false);
}

for (const id of ["reputation_good_neighbor", "reputation_troublemaker"]) {
  assert.equal(gameData.achievements.some((achievement) => achievement.id === id), true);
}
for (const skinId of [
  "herb_pink_sunset",
  "fire_vine_pink_sunset",
  "crystal_succulent_pink_sunset",
]) {
  assert.equal(names.skins[skinId], skinId);
}
for (const [variantId, itemCode] of Object.entries({
  "witch_scarecrow:pink_lace_parasol": "witch_scarecrow",
  "pedestal:sunbed": "pedestal",
  "stone_floor:wooden_deck": "stone_floor",
  "flower_trellis_arch:iron": "flower_trellis_arch",
  "rustic_fence:iron": "rustic_fence",
  "root_barrier:swamp_thicket": "root_barrier",
  "storage_chest:picnic": "storage_chest",
})) {
  assert.equal(names.itemVariants[variantId]?.itemCode, itemCode);
  assert.equal(names.itemVariantSprites[variantId], names.itemVariants[variantId]?.sprite);
}
assert.equal(
  progression.tutorialGoals.some((goal) => goal.id === "collect_growth_potion_ingredients"),
  false,
);
for (const id of ["collect_growth_potion_herb", "collect_growth_potion_red_flower_leaf"]) {
  assert.equal(progression.tutorialGoals.some((goal) => goal.id === id), true);
}
assert.equal(
  progression.tutorialGoals.find((goal) => goal.id === "enhance_growth_potion")?.action,
  "cauldron",
);
const trustedHelper = progression.oneTimeQuests.find((quest) => quest.id === "hestia_trusted_helper");
assert.deepEqual(trustedHelper?.unlock, ["헤스티아 의뢰 누적 50회 완료"]);
assert.equal(trustedHelper?.requestItems.length, 6);
assert.deepEqual(trustedHelper?.rewards, [{
  itemCode: "oblivion_orb",
  enhancement: 0,
  count: 1,
  untradable: true,
}]);
assert.equal(gameData.test_items.includes("test_almanac"), true);
assert.equal("test_almanac" in names.items, false);

console.log("latest game update data tests passed");

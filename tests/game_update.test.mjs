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
  binding_token: { name: "결속의 증표", folder: "items/materials" },
  black_thorn_sapling: { name: "검은 가시 묘목", folder: "plants/seeds" },
  black_sap: { name: "검은 수액", folder: "plants/produce" },
  depletion_potion: { name: "고갈포션", folder: "potions" },
  backflow_potion: { name: "역류포션", folder: "potions" },
  veil_potion: { name: "장막포션", folder: "potions" },
  whispering_tea_table: {
    name: "속삭임 찻상",
    perk: "텃밭에 설치 가능 · 설치한 텃밭에서 채팅 가능",
    folder: "items/ornament",
  },
  starlight_garden_trophy: {
    name: "별빛 정원 트로피",
    perk: "텃밭에 설치 가능",
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
for (const [output, inputs, requiredLevel] of [
  ["gilded_copper_ingot", "binding_token,purification_potion", 2],
  ["whispering_tea_table", "working_shelf,binding_token", 5],
]) {
  assert.equal(
    gameData.recipes_full.some((recipe) =>
      recipe.output === output
      && recipe.requiredLevel === requiredLevel
      && recipe.inputs.join(",") === inputs),
    true,
  );
}
for (const [output, inputs] of [
  ["depletion_potion", "black_sap,blue_moss"],
  ["backflow_potion", "black_sap,nightshade_root"],
  ["veil_potion", "vine_tendril,black_sap"],
]) {
  assert.equal(
    gameData.brew_recipes.some((recipe) =>
      recipe.output === output && recipe.inputs.join(",") === inputs),
    true,
  );
}

assert.equal(gameData.sell_price.engraving_stone, 500);
assert.equal(gameData.sell_price.polishing_powder, 250);
assert.equal(gameData.sell_price.dia_box_30, 300000);
for (const [code, price] of Object.entries({
  moonlight_mushroom: 15,
  crystal_leaf: 75,
  nightshade_root: 500,
  hallucination_spore: 40,
  antidote_potion: 50,
  frenzy_potion: 40,
  stealth_potion: 40,
  corrosion_potion: 150,
  foresight_potion: 140,
  explosion_potion: 170,
  daydream_potion: 140,
  vitality_elixir: 30,
  freeze_potion: 190,
  insight_potion: 190,
  resonance_potion: 400,
  shatter_potion: 250,
  refraction_potion: 280,
  encroachment_potion: 800,
  nightmare_potion: 750,
  anti_magic_potion: 850,
  contagion_potion: 850,
  curse_potion: 800,
})) {
  assert.equal(gameData.sell_price[code], price, `${code} shop sell price`);
}
for (const code of [
  "poison_flower_seed",
  "moonlight_mushroom_seed",
  "star_flower_seed",
  "fire_vine_seed",
  "wind_blossom_seed",
  "sunlight_flower_seed",
  "illusion_fern_seed",
  "sunset_bush_seed",
  "crystal_succulent_seed",
  "nightshade_sprout_seed",
  "sprawling_vine_seed",
]) {
  assert.equal(code in gameData.sell_price, false, `${code} is no longer shop-sellable`);
}
assert.equal(gameData.item_values.aquifer_potion, 510);
assert.equal(gameData.item_output_values.aquifer_potion, 750);
assert.equal(gameData.item_values.reversion_potion, 1000);
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
for (const [skinId, skinName] of Object.entries({
  red_flower_pink_bouquet: "분홍꽃다발 붉은꽃",
  red_flower_pink_tulip: "분홍튤립 붉은꽃",
})) {
  assert.equal(names.skins[skinId], skinId);
  assert.equal(names.skinNames[skinId], skinName);
}
for (const [variantId, itemCode] of Object.entries({
  "witch_scarecrow:pink_lace_parasol": "witch_scarecrow",
  "pedestal:sunbed": "pedestal",
  "working_shelf:pink_vanity": "working_shelf",
  "telescope:pink_heart": "telescope",
  "stone_floor:wooden_deck": "stone_floor",
  "flower_trellis_arch:iron": "flower_trellis_arch",
  "flower_trellis_arch:stone": "flower_trellis_arch",
  "flower_trellis_arch:temple": "flower_trellis_arch",
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
const recordFragmentRewards = [
  ...(progression.tutorialGoals || []),
  ...(progression.oneTimeQuests || []),
  ...(gameData.quests || []),
].flatMap((quest) => (quest.rewards || [])
  .filter((reward) => reward.itemCode?.startsWith("record_fragment_"))
  .map((reward) => [reward.itemCode, quest.title]));
assert.deepEqual(recordFragmentRewards, [
  ["record_fragment_1", "메아리동굴 클리어"],
  ["record_fragment_2", "별빛 고원 클리어"],
  ["record_fragment_3", "어스름 계곡 클리어"],
  ["record_fragment_4", "석양 절벽 클리어"],
  ["record_fragment_5", "잊힌 성터 클리어"],
  ["record_fragment_6", "편집된 기록"],
  ["record_fragment_7", "마지막 기록"],
  ["record_fragment_8", "봉인 뒤의 기록"],
]);
assert.equal(gameData.special_source.record_fragment_6, "📜 필수 목표 (수정 갱도 클리어 후)");
assert.equal(gameData.special_source.record_fragment_7, "📜 필수 목표 (결사의 회랑 클리어 후)");
assert.equal(gameData.special_source.record_fragment_8, "📜 필수 목표 (마지막 기록 확인 후)");
assert.equal(gameData.unobtainable.includes("record_fragment_6"), false);
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

assert.deepEqual(gameData.plants.black_thorn, {
  name: "검은 가시",
  spriteKey: "black_thorn",
  growTime_ms: 75000,
  waterInterval_ms: null,
  maxHarvests: 16,
  oneShot: false,
  perk: null,
  produces: [{ itemCode: "black_sap", interval_ms: 1800000, max: 4, ripen: null }],
});
assert.equal(names.plants.black_thorn?.name, "검은 가시");
assert.equal(gameData.zones.guild_corridor?.name, "결사의 회랑");
assert.deepEqual(gameData.zones.guild_corridor?.monsters, [
  "guild_guard", "guild_shieldbearer", "guild_executioner", "corridor_guardian",
]);
assert.deepEqual(gameData.zone_cultivation.guild_corridor, {
  cultivationItemCode: null,
  cultivationItem_kr: null,
  effects: [],
});
for (const [id, name] of Object.entries({
  guild_guard: "결사 경비병",
  guild_shieldbearer: "결사 방패병",
  guild_executioner: "결사 집행관",
  corridor_guardian: "회랑의 수호자",
})) {
  assert.equal(gameData.monsters[id]?.name, name);
}
assert.equal(
  gameData.monsters.corridor_guardian.skills
    .find((skill) => skill.id === "corridor_guardian_defense_command")
    ?.effects.some((effect) => effect.status === "damage_reflect" && effect.flat === 150),
  true,
);
assert.ok(Math.abs(gameData.potion_combat.gale_potion.effects[0][0].chance - 0.2) < 1e-12);
assert.ok(Math.abs(gameData.potion_combat.gale_potion.effects[9][0].chance - (1 - 0.8 ** 10)) < 1e-12);
assert.equal(gameData.potion_combat.depletion_potion.effects[4][0].flat, -125);
assert.equal(gameData.potion_combat.backflow_potion.effects[2][0].percent, 150);
assert.equal(gameData.potion_combat.veil_potion.effects[3][0].flat, 4);
assert.equal(gameData.shop_items.includes("garden_contest_ticket"), true);
assert.equal(gameData.shop_buy_price.garden_contest_ticket, 1000);
assert.equal(gameData.test_items.includes("hungry_wedge"), true);
assert.equal(
  gameData.achievements.some((achievement) =>
    achievement.id === "starlight_gardener"
    && achievement.icon === "starlight_garden_trophy"
    && achievement.hidden === true),
  true,
);

console.log("latest game update data tests passed");

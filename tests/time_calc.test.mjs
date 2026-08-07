import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enhancementAttemptBaseMs, enhancementTimeCatalog } from "../js/time_calc.js";

const gameData = JSON.parse(readFileSync(new URL("../data/gamedata.json", import.meta.url), "utf8"));
const catalog = enhancementTimeCatalog(gameData);
const byCode = new Map(catalog.map((entry) => [entry.code, entry]));

assert.equal(byCode.get("mud")?.typeLabel, "소재·일반");
assert.equal(byCode.get("copper_charm")?.typeLabel, "장비");
assert.equal(byCode.get("copper_cauldron")?.typeLabel, "도구");
assert.equal(byCode.get("herb")?.typeLabel, "산물");
assert.equal(byCode.get("herbal_tonic")?.typeLabel, "포션");

assert.equal(byCode.has("aging_red_flower_seed"), false);
assert.equal(byCode.has("growth_elixir"), false);
assert.equal(byCode.has("earth_breath"), false);
assert.equal(byCode.has("record_fragment_1"), false);

assert.equal(enhancementAttemptBaseMs(gameData, "mud", 0), 30_000);
assert.equal(enhancementAttemptBaseMs(gameData, "mud", 3), 240_000);
assert.equal(enhancementAttemptBaseMs(gameData, "copper_charm", 2), 240_000);
assert.equal(enhancementAttemptBaseMs(gameData, "mud", -2), 30_000);
assert.equal(enhancementAttemptBaseMs(gameData, "record_fragment_1", 0), null);
assert.equal(enhancementAttemptBaseMs(gameData, "unknown_item", 0), null);

console.log("time_calc tests passed");

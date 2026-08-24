import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { adventureGemChoices } from "../js/adventure_gems.js";
import { winRate } from "../js/battle.js";

const gamedata = JSON.parse(fs.readFileSync(new URL("../data/gamedata.json", import.meta.url), "utf8"));

test("adventure gem picker includes every official gem and labels onyx as raid-only", () => {
  const choices = adventureGemChoices(gamedata);

  assert.deepEqual(
    new Set(choices.map(({ code }) => code)),
    new Set(Object.keys(gamedata.gem_effects)),
  );
  assert.match(choices.find(({ code }) => code === "refined_onyx").label, /습격 전용.*모험 효과 없음/);
});

test("win-rate turn distribution matches wins and average turns", () => {
  const adventurers = Object.keys(gamedata.adventurers).slice(0, 4).map((id) => ({ id }));
  const result = winRate({ adventurers, potions: [], skills: {} }, "beginner_forest", gamedata, 40);
  const entries = Object.entries(result.winTurnCounts);
  const distributedWins = entries.reduce((sum, [, count]) => sum + count, 0);
  const distributedTurns = entries.reduce((sum, [turn, count]) => sum + Number(turn) * count, 0);

  assert.equal(distributedWins, result.wins);
  assert.equal(distributedTurns / result.wins, result.avgTurnsOnWin);
});

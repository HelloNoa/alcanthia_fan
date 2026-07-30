import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { raidWinRate, simulateRaid } from "../js/battle.js";
import { parseItemKey } from "../js/item_key.js";
import {
  combineRaidRates,
  normalizeRaidProfile,
  raidAttackerOpeningChance,
  stealthOpeningChance,
  wardingStoneMultiplier,
} from "../js/raid_profile.js";

const gameData = JSON.parse(
  fs.readFileSync(new URL("../data/gamedata.json", import.meta.url), "utf8"),
);

test("item key parser preserves enhancement and every top-level engraving", () => {
  const parsed = parseItemKey(
    "dia_plate+7(refined_fluorite+7,refined_amber+5(refined_crystal+1),refined_crystal+9)~t",
  );

  assert.equal(parsed.code, "dia_plate");
  assert.equal(parsed.enhancement, 7);
  assert.deepEqual(parsed.engravings, [
    "refined_fluorite+7",
    "refined_amber+5(refined_crystal+1)",
    "refined_crystal+9",
  ]);
});

test("public raid profile normalizes equipment, multiple sockets, and potions", () => {
  const normalized = normalizeRaidProfile({
    profile: {
      userId: "user-1",
      nickname: "테스터",
      spellLevels: { bond_rune: 4, levitation: 3 },
      gardenRaidDefenseParty: {
        adventurerIds: ["sorin"],
        potions: ["frenzy_potion+4", "rejuvenation_potion+2"],
      },
      adventurerEquipment: {
        sorin: {
          itemKey: "dia_scepter+9(refined_amber+7,refined_amber+6,refined_crystal+5)",
        },
      },
      grid: [
        [{
          ornament: {
            effectEnabled: true,
            items: [{ itemKey: "warding_stone+6" }],
          },
        }],
        [{
          ornament: {
            effectEnabled: false,
            items: [{ itemKey: "warding_stone+9" }],
          },
        }],
      ],
      raidAvailability: { canRaid: true },
    },
  }, gameData);

  assert.equal(normalized.userId, "user-1");
  assert.equal(normalized.party.adventurers[0].equip, "dia_scepter");
  assert.equal(normalized.party.adventurers[0].equipEnh, 9);
  assert.deepEqual(normalized.party.adventurers[0].engraved, [
    { itemCode: "refined_amber", enhancement: 7 },
    { itemCode: "refined_amber", enhancement: 6 },
    { itemCode: "refined_crystal", enhancement: 5 },
  ]);
  assert.deepEqual(normalized.party.potions, [
    { code: "frenzy_potion", enh: 4 },
    { code: "rejuvenation_potion", enh: 2 },
  ]);
  assert.deepEqual(normalized.caps, { adventurers: 4, potions: 4 });
  assert.deepEqual(normalized.wardingStones, { known: true, enhancements: [6] });
  assert.deepEqual(normalized.errors, []);
});

test("profile normalization reports unknown combat data instead of dropping it", () => {
  const normalized = normalizeRaidProfile({
    profile: {
      gardenRaidDefenseParty: {
        adventurerIds: ["future_adventurer"],
        potions: ["future_potion+3"],
      },
      adventurerEquipment: {
        future_adventurer: { itemKey: "future_equipment+2(future_gem+1)" },
      },
    },
  }, gameData);

  assert.equal(normalized.party.adventurers[0].id, "future_adventurer");
  assert.equal(normalized.party.potions[0].code, "future_potion");
  assert.equal(normalized.errors.length, 4);
});

test("a hidden defense party is not mistaken for an empty defense party", () => {
  const normalized = normalizeRaidProfile({
    profile: {
      userId: "private-user",
      nickname: "비공개",
      profileDetailsVisible: false,
      currentZone: null,
    },
  }, gameData);

  assert.deepEqual(normalized.party, { adventurers: [], potions: [] });
  assert.ok(normalized.errors.some((error) => error.includes("비공개")));
  assert.deepEqual(normalized.raidAvailability, { canRaid: false, reason: "mist_town" });
});

test("raid rules alternate one unit at a time from the selected opening side", () => {
  const attacker = {
    adventurers: [{ id: "dion" }, { id: "aria" }],
    potions: [],
  };
  const defender = {
    adventurers: [{ id: "dion" }, { id: "aria" }],
    potions: [],
  };

  const defenderFirst = simulateRaid(
    attacker,
    defender,
    gameData,
    "enemy_first_interleaved",
    42,
  );
  const attackerFirst = simulateRaid(
    attacker,
    defender,
    gameData,
    "ally_first_interleaved",
    42,
  );
  const actors = (result) => result.events
    .filter((event) => event.turn === 1 && event.actorId)
    .slice(0, 4)
    .map((event) => event.actorId);

  assert.deepEqual(actors(defenderFirst), [
    "raid_defender_dion_0",
    "raid_attacker_dion_0",
    "raid_defender_aria_1",
    "raid_attacker_aria_1",
  ]);
  assert.deepEqual(actors(attackerFirst), [
    "raid_attacker_dion_0",
    "raid_defender_dion_0",
    "raid_attacker_aria_1",
    "raid_defender_aria_1",
  ]);
});

test("empty defense wins immediately and unresolved fights stop at 30 turns", () => {
  const attacker = { adventurers: [{ id: "dion" }], potions: [] };
  const automatic = simulateRaid(
    attacker,
    { adventurers: [], potions: [] },
    gameData,
    "enemy_first_interleaved",
    1,
  );
  assert.equal(automatic.victory, true);
  assert.equal(automatic.totalTurns, 0);

  const durable = {
    adventurers: [{ id: "dion", equip: "dia_plate", equipEnh: 99 }],
    potions: [],
  };
  const timeout = simulateRaid(
    durable,
    durable,
    gameData,
    "enemy_first_interleaved",
    1,
  );
  assert.equal(timeout.victory, false);
  assert.equal(timeout.totalTurns, 30);
});

test("raid ends before the defender acts when the opening attack wipes the party", () => {
  const result = simulateRaid(
    {
      adventurers: [{ id: "sorin", equip: "dia_scepter", equipEnh: 40 }],
      potions: [{ code: "explosion_potion", enh: 40 }],
    },
    { adventurers: [{ id: "rowan" }], potions: [] },
    gameData,
    "ally_first_interleaved",
    10000,
  );

  assert.equal(result.victory, true);
  assert.equal(result.totalTurns, 1);
  assert.equal(
    result.events.filter((event) => event.actorId?.startsWith("raid_defender_")).length,
    0,
  );
});

test("raid adapter applies potions, all sockets, and level-five crystal revival", () => {
  const attacker = {
    adventurers: [{
      id: "sorin",
      equip: "dia_scepter",
      equipEnh: 1,
      engraved: [
        { itemCode: "refined_amber", enhancement: 1 },
        { itemCode: "refined_amber", enhancement: 2 },
        { itemCode: "refined_crystal", enhancement: 3 },
      ],
    }],
    potions: [{ code: "explosion_potion", enh: 0 }],
  };
  const defender = {
    adventurers: [{ id: "dion", equip: "dia_plate", equipEnh: 10 }],
    potions: [],
  };
  const result = simulateRaid(
    attacker,
    defender,
    gameData,
    "ally_first_interleaved",
    1,
  );
  const start = result.events.find((event) => event.type === "battle_start");

  assert.equal(start.allies[0].engravedGems.length, 3);
  assert.ok(result.events.some((event) => event.type === "potion_use"));

  const revivalResult = simulateRaid(
    {
      adventurers: [{ id: "sorin" }],
      potions: [{ code: "explosion_potion", enh: 0 }],
    },
    defender,
    gameData,
    "ally_first_interleaved",
    1,
  );
  assert.ok(revivalResult.events.some((event) => event.type === "crystal_divination"));

  let revivals = 0;
  for (let index = 0; index < 400; index++) {
    const sample = simulateRaid(
      {
        adventurers: [{ id: "sorin", equip: "dia_scepter", equipEnh: 40 }],
        potions: [{ code: "explosion_potion", enh: 40 }],
      },
      { adventurers: [{ id: "rowan" }], potions: [] },
      gameData,
      "ally_first_interleaved",
      ((index * 2654435761 + 1) >>> 0) || 1,
    );
    if (sample.events.some((event) => event.type === "crystal_divination")) revivals += 1;
  }
  assert.ok(revivals >= 80 && revivals <= 120, `expected about 25% revivals, got ${revivals}/400`);
});

test("stealth opening applies only the highest active warding stone", () => {
  assert.equal(stealthOpeningChance(null), 0);
  assert.ok(Math.abs(stealthOpeningChance(0) - 0.1) < 1e-12);
  assert.ok(Math.abs(stealthOpeningChance(9) - (1 - 0.9 ** 10)) < 1e-12);
  assert.equal(wardingStoneMultiplier([]), 1);
  assert.ok(Math.abs(wardingStoneMultiplier([2]) - (0.9 ** 3)) < 1e-12);
  assert.ok(Math.abs(wardingStoneMultiplier([0, 2, 1, 2]) - (0.9 ** 3)) < 1e-12);
  assert.ok(Math.abs(
    raidAttackerOpeningChance(9, [2])
      - (1 - 0.9 ** 10) * (0.9 ** 3),
  ) < 1e-12);
  assert.ok(Math.abs(
    raidAttackerOpeningChance(9, [0, 2, 1])
      - (1 - 0.9 ** 10) * (0.9 ** 3),
  ) < 1e-12);
  assert.equal(raidAttackerOpeningChance(null, [0, 2]), 0);

  const defenderFirst = {
    trials: 1000,
    rate: 0.2,
    avgTurnsOnWin: 8,
    avgTurnsOnLoss: 12,
    winTurnCounts: { 8: 200 },
  };
  const attackerFirst = {
    trials: 1000,
    rate: 0.8,
    avgTurnsOnWin: 4,
    avgTurnsOnLoss: 10,
    winTurnCounts: { 4: 800 },
  };
  const opening = stealthOpeningChance(0);
  const combined = combineRaidRates(defenderFirst, attackerFirst, opening);

  assert.ok(Math.abs(combined.rate - 0.26) < 1e-12);
  const reversedAttackerRate = (
    combined.rate - (1 - opening) * defenderFirst.rate
  ) / opening;
  assert.ok(Math.abs(reversedAttackerRate - attackerFirst.rate) < 1e-12);
});

test("raid win-rate distribution sums to wins", () => {
  const attacker = {
    adventurers: [{ id: "sorin" }],
    potions: [{ code: "explosion_potion", enh: 0 }],
  };
  const defender = {
    adventurers: [{ id: "dion" }],
    potions: [],
  };
  const result = raidWinRate(
    attacker,
    defender,
    gameData,
    "enemy_first_interleaved",
    40,
    7,
  );
  const distributedWins = Object.values(result.winTurnCounts)
    .reduce((sum, count) => sum + count, 0);
  assert.equal(distributedWins, result.wins);
});

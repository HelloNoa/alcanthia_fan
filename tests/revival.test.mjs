import assert from "node:assert/strict";
import test from "node:test";
import { simulate, simulateRaid } from "../js/battle.js";

const unit = (name, hp, skills = []) => ({
  name, spriteKey: "", atk: 10, def: 0, hp, mp: 100, smart: true, skills,
});
const status = (type, flat) => ({
  op: "status", effectId: `test_${type}`, target: "enemy_all",
  status: type, flat, duration: 10,
});
const lethalHit = {
  id: "test_hit", name: "상태 부여 후 공격", type: "status", mpCost: 0, cooldown: 3,
  effects: [status("atk_buff", 10), status("poison", 1), { op: "hp", target: "enemy_all", flat: -100 }],
};

function runRevival(mode, method) {
  const revivalSkill = {
    id: method, name: "부활 스킬", type: method,
    coefficient: 1, mpCost: 20, cooldown: 3,
  };
  const data = {
    items: { rejuvenation_potion: { name: "회생포션" } },
    equipment_stats: {},
    potion_combat: { rejuvenation_potion: { effects: [[], [], []] } },
    adventurers: {
      victim: unit("victim", 100),
      helper: unit("helper", 1000, method.startsWith("resurrect") ? [revivalSkill] : []),
      enemy: unit("enemy", 10000, [lethalHit]),
    },
    monsters: { enemy: unit("enemy", 10000, [lethalHit]) },
    zones: { test: { monsters: ["enemy"], rule: "enemy_first" } },
  };
  const party = {
    adventurers: [{ id: "victim" }, { id: "helper" }],
    potions: method === "potion" ? [{ code: "rejuvenation_potion", enh: 2 }] : [],
    skills: { crystalDivination: method === "crystal" ? 5 : 0, extraLoot: 0, potionPreserve: 0 },
  };
  // Raid has level-five crystal divination. These fixed seeds respectively
  // trigger it or let the potion/skill path handle the first death instead.
  const seed = method === "crystal" ? 1 : 123456789;
  return mode === "adventure"
    ? simulate(party, "test", data, seed)
    : simulateRaid(party, { adventurers: [{ id: "enemy" }], potions: [] }, data, "enemy_first_interleaved", seed);
}

for (const mode of ["adventure", "raid"]) {
  for (const method of ["crystal", "potion", "resurrect_one", "resurrect_aoe"]) {
    test(`${mode}: ${method} revival clears buffs and debuffs without altering its recovery rules`, () => {
      const result = runRevival(mode, method);
      const prefix = mode === "adventure" ? "" : "raid_attacker_";
      const victimId = `${prefix}victim_0`;
      const helperId = `${prefix}helper_1`;
      const index = result.events.findIndex((event) => {
        const matches = method === "crystal" ? event.type === "crystal_divination"
          : method === "potion" ? event.itemCode === "rejuvenation_potion"
          : event.skillId === method;
        return matches && event.hpChanges?.some((change) => change.unitId === victimId && change.delta > 0);
      });
      assert.ok(index >= 0, "the requested revival must actually happen");
      const revival = result.events[index];
      const before = result.events.slice(0, index).findLast((event) =>
        event.snapshots?.some((snapshot) => snapshot.unitId === victimId && snapshot.hp === 0));
      assert.deepEqual(before.snapshots.find((snapshot) => snapshot.unitId === victimId)
        .statusEffects.map(({ type }) => type), ["atk_buff", "poison"]);

      // Crystal events currently carry HP changes only; inspect the next
      // actual engine snapshot, before the enemy applies any new effects.
      const after = result.events.slice(index).find((event) =>
        event.snapshots?.some((snapshot) => snapshot.unitId === victimId && snapshot.hp > 0));
      assert.ok(after, "a living post-revival snapshot must exist");
      const victim = after.snapshots.find((snapshot) => snapshot.unitId === victimId);
      const helper = after.snapshots.find((snapshot) => snapshot.unitId === helperId);
      assert.deepEqual(victim.statusEffects, []);
      assert.equal(victim.effectiveAtk, victim.baseAtk);
      assert.deepEqual(helper.statusEffects.map(({ type }) => type), ["atk_buff", "poison"],
        "reviving one unit must not clear surviving allies' effects");

      const restoredHp = revival.hpChanges.find((change) => change.unitId === victimId).newHp;
      assert.equal(victim.hp, restoredHp, "old poison must not damage the revived unit");
      assert.equal(restoredHp, method === "resurrect_one" ? 20 : method === "resurrect_aoe" ? 90 : 30);
      assert.equal(victim.mp, method === "resurrect_aoe" ? 0 : 100);
      if (method === "crystal") {
        assert.equal(result.events.filter((event) => event.type === "crystal_divination" && event.actorId === victimId).length, 1,
          "clearing statuses must not reset the once-per-unit crystal revival limit");
      }
      if (method === "resurrect_one") {
        assert.equal(helper.mp, 80);
        assert.equal(helper.cooldowns.resurrect_one, 3);
      }
    });
  }
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { MI, simulateRaid, simulateDuel, duelOutcome } from '../js/battle.js';
import { normalizeRaidProfile } from '../js/raid_profile.js';
const gd = JSON.parse(readFileSync(new URL('../data/gamedata.json', import.meta.url)));
const unit = (id, skills = [], smart = false) => ({ id, name:id, rawAtk:10, rawDef:0, baseAtk:10, baseDef:0, maxHp:10000, maxMp:100, skills, smart });
const side = (units, potions = []) => ({ units, potions, skills:{crystalDivination:0, extraLoot:0, potionPreserve:0} });
const hit = { id:'hit', name:'hit', type:'attack', coefficient:1, mpCost:0, cooldown:0 };
const potion = (itemCode, effects = gd.potion_combat[itemCode].effects[0]) => ({itemCode, enhancement:0, effects});
function run(ally, enemy, rule = 'ally_first_interleaved') {
  simulateRaid({adventurers:[]}, {adventurers:[]}, gd);
  return MI({seed:123, ally, enemy, rule});
}
test('production potion changes include diminishing pierce, enemy taunt, and forgetting', () => {
  assert.ok(Math.abs(gd.potion_combat.insight_potion.effects[9][0].flat - 100*(1-.9**10)) < 1e-10);
  assert.equal(gd.potion_combat.phantom_potion.effects[0][0].target, 'enemy_all');
  assert.deepEqual(gd.potion_combat.forgetting_potion.effects[0].map(e=>e.op), ['dispel_all','cooldown_reduce','hp','mp']);
  assert.match(gd.potion_use_effects.depletion_potion.base, /선택해서 제거/);
  assert.match(gd.transmute_effects.depletion_potion, /농축 플라스크/);
  assert.equal(gd.skills.dominion, undefined);
  assert.ok(gd.skills.soul_confrontation);
});
test('potion self buff lasts exactly four actions including the drinking action', () => {
  const result = run(side([unit('a',[hit],true)], [potion('courage_potion')]), side([unit('b')]));
  const attacks = result.events.filter(e=>e.skillId==='hit');
  assert.deepEqual(attacks.slice(0,5).map(e=>-e.hpChanges[0].delta), [30,30,30,30,10]);
});
test('ally potion buff starts on each recipients next action', () => {
  const result = run(side([unit('a',[hit],true),unit('c',[hit],true)], [potion('blessing_potion')]), side([unit('b')]));
  for (const id of ['a','c']) {
    assert.deepEqual(result.events.filter(e=>e.skillId==='hit' && e.actorId===id).slice(0,5).map(e=>-e.hpChanges[0].delta), [18,18,18,18,10]);
  }
});
test('AI chooses fixed damage over attack damage stopped by a damage cap', () => {
  const fixed = {id:'fixed',name:'fixed',type:'status',mpCost:0,cooldown:0,effects:[{op:'hp',target:'enemy_one',flat:-5}]};
  const result = run(side([unit('a',[hit,fixed],true)]), side([unit('b')],[potion('moss_jelly',[{op:'status',effectId:'cap',target:'self',status:'dmg_cap',flat:1,duration:30}])]), 'enemy_first_interleaved');
  assert.equal(result.events.find(e=>e.type==='skill').skillId,'fixed');
});
test('AI avoids MP attacks blocked by anti magic', () => {
  const heavy = {...hit,id:'heavy',mpCost:20,coefficient:20};
  const result = run(side([unit('a',[heavy,hit],true)]), side([unit('b')],[potion('anti_magic_potion')]), 'enemy_first_interleaved');
  assert.equal(result.events.find(e=>e.type==='skill').skillId,'hit');
});
test('duel result requires both rounds and treats timeouts as draws', () => {
  assert.equal(duelOutcome([{victory:true},{victory:true}]),'attack_win');
  assert.equal(duelOutcome([{victory:false},{victory:false}]),'defense_win');
  assert.equal(duelOutcome([{victory:true},{victory:false}]),'draw');
  assert.equal(duelOutcome([{victory:false,timedOut:true},{victory:false}]),'draw');
  const stuck = { adventurers:{a:{name:'a',atk:0,def:0,hp:100,mp:0,skills:[]}},items:{} };
  const result = simulateDuel({adventurers:[{id:'a'}]}, {adventurers:[{id:'a'}]}, stuck);
  assert.equal(result.outcome,'draw');
  assert.ok(result.rounds.every(r=>r.timedOut && r.totalTurns===30));
});
test('public equipment is separated by battle mode, including deliberately empty maps', () => {
  const profile = {adventurerEquipment:{sorin:{itemKey:'dia_scepter+9'}},
    gardenRaidDefenseParty:{adventurerIds:['sorin'],equipment:{},potions:[]},
    pvpDefenseParty:{adventurerIds:['sorin'],equipment:{sorin:{itemCode:'dia_scepter',enhancement:4,engraved:[{itemCode:'refined_onyx',enhancement:3}]}},potions:['forgetting_potion+0']}};
  assert.equal(normalizeRaidProfile(profile,gd).party.adventurers[0].equip,undefined);
  const duel = normalizeRaidProfile(profile,gd,'duel');
  assert.equal(duel.party.adventurers[0].equipEnh,4);
  assert.equal(duel.party.adventurers[0].engraved[0].enhancement,3);
  assert.equal(duel.party.potions[0].code,'forgetting_potion');
});
test('combat importer rejects executable expressions in downloaded data', () => {
  const code = `from combat_sync import sync_combat_data
source = 'x={herbal_tonic:{description:()=>"test",effects:t=>[{op:"hp",target:"self",flat:evil(t)}]}}'
try:
 sync_combat_data(source,{})
except ValueError as e:
 assert 'Unsupported combat helper' in str(e)
else:
 raise AssertionError('unsafe source accepted')
`;
  const result = spawnSync('python3',['-c',code],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

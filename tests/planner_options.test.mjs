import test from "node:test";
import assert from "node:assert/strict";
import { PLANNER_OPTION_FIELDS, normalizePlannerOptions, encodePlannerOptions, decodePlannerOptions } from "../js/planner_options.js";
const zones = { "": "", sunset_cliff: "석양 절벽" };
test("all planner conditions survive sharing, including disabled and zero values", () => {
  for (const enabled of [true, false]) {
    const raw = Object.fromEntries(PLANNER_OPTION_FIELDS.map(([key, , value, min, max]) => [key,
      typeof value === "boolean" ? enabled : key === "zone" ? "sunset_cliff" : enabled ? max : min]));
    assert.deepEqual(decodePlannerOptions(encodePlannerOptions(raw, zones), zones), raw);
  }
});
test("old links default independently of recipient settings; malformed settings are bounded", () => {
  const defaults = normalizePlannerOptions(null, zones);
  for (const code of [null, "", "9~1", "1~".repeat(1000)]) assert.deepEqual(decodePlannerOptions(code, zones), defaults);
  const normalized = normalizePlannerOptions({ timeM: 999, rootDom: -3, uptime: 63, zone: "unknown", gust: "false", harvest: "1", soilM: "NaN" }, zones);
  assert.equal(normalized.timeM, 10);
  assert.equal(normalized.rootDom, 0);
  assert.equal(normalized.uptime, 65);
  assert.equal(normalized.zone, "");
  assert.equal(normalized.gust, false);
  assert.equal(normalized.harvest, true);
  assert.equal(normalized.soilM, 0);
});

// Append new fields: the order is part of the version 1 shared conditions format.
export const PLANNER_OPTION_FIELDS = [
  ["harvest", "pl-harvest", false], ["resist", "pl-resist", 0, 0, 2],
  ["zone", "pl-zone", ""], ["familiar", "pl-familiar", 0, 0, 10],
  ["fog", "pl-fog", false], ["raid", "pl-raid", false],
  ["sunsetRipen", "pl-sunset-ripen", false], ["echoResonance", "pl-echo-resonance", false],
  ["rootDom", "pl-root", 0, 0, 2], ["vein", "pl-vein", false],
  ["mossJelly", "pl-moss-jelly", false], ["venom", "pl-venom", false],
  ["compost", "pl-compost", false], ["sturdy", "pl-sturdy", false],
  ["timeM", "pl-time", 0, 0, 10], ["soilM", "pl-soil", 0, 0, 10],
  ["plenty", "pl-plenty", 0, 0, 3], ["inheritance", "pl-inheritance", 0, 0, 5],
  ["revival", "pl-revival", 0, 0, 3], ["uptime", "pl-uptime", 100, 50, 100, 5],
  ["gust", "pl-gust", false],
];
export function normalizePlannerOptions(raw, zones) {
  return Object.fromEntries(PLANNER_OPTION_FIELDS.map(([key, , fallback, min, max, step = 1]) => {
    const value = raw?.[key];
    if (typeof fallback === "boolean") return [key, value === true || value === 1 || value === "1"];
    if (key === "zone") return [key, typeof value === "string" && Object.hasOwn(zones, value) ? value : ""];
    const number = value == null || value === "" ? NaN : Number(value);
    return [key, Number.isFinite(number)
      ? Math.max(min, Math.min(max, Math.round(number / step) * step)) : fallback];
  }));
}
export function encodePlannerOptions(options, zones) {
  const normalized = normalizePlannerOptions(options, zones);
  return [1, ...PLANNER_OPTION_FIELDS.map(([key]) => typeof normalized[key] === "boolean"
    ? Number(normalized[key]) : normalized[key])].join("~");
}
export function decodePlannerOptions(code, zones) {
  const parts = typeof code === "string" && code.length <= 1000 ? code.split("~") : [];
  if (parts.shift() !== "1" || parts.length > PLANNER_OPTION_FIELDS.length) return normalizePlannerOptions(null, zones);
  return normalizePlannerOptions(Object.fromEntries(PLANNER_OPTION_FIELDS.map(([key], index) => [key, parts[index]])), zones);
}

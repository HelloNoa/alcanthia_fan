export const ENHANCEMENT_EV_STORE = "alc_enhancement_ev_v1";

export function loadEnhancementEvState(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(ENHANCEMENT_EV_STORE) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function saveEnhancementEvItem(code, storage = globalThis.localStorage) {
  const next = { ...loadEnhancementEvState(storage), item: String(code || "") };
  try {
    storage?.setItem(ENHANCEMENT_EV_STORE, JSON.stringify(next));
  } catch {}
  return next;
}

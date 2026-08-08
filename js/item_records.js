export function normalizeHighestItemRecords(payload) {
  const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.records) ? payload.records : []);
  const records = new Map();
  for (const row of rows) {
    const itemCode = typeof row?.itemCode === "string" ? row.itemCode.trim() : "";
    const enhancement = Math.floor(Number(row?.enhancement));
    if (!itemCode || !Number.isFinite(enhancement) || enhancement < 0) continue;
    const current = records.get(itemCode);
    if (current && current.enhancement >= enhancement) continue;
    const nickname = typeof row.nickname === "string" && row.nickname.trim()
      ? row.nickname.trim()
      : null;
    records.set(itemCode, { itemCode, enhancement, nickname });
  }
  return records;
}

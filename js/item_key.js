function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      const part = value.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }

  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

export function parseItemKey(raw) {
  let key = String(raw || "").trim();
  if (key.endsWith("~t")) key = key.slice(0, -2);

  let base = key;
  let engravings = [];
  const opening = key.indexOf("(");
  const closing = key.lastIndexOf(")");
  if (opening >= 0 && closing > opening) {
    base = key.slice(0, opening);
    engravings = splitTopLevel(key.slice(opening + 1, closing));
  }

  const plus = base.lastIndexOf("+");
  const parsedEnhancement = plus >= 0
    ? Number.parseInt(base.slice(plus + 1), 10)
    : 0;
  const enhancement = Number.isFinite(parsedEnhancement) ? parsedEnhancement : 0;

  return {
    code: (plus >= 0 ? base.slice(0, plus) : base).trim(),
    enh: enhancement,
    enhancement,
    engravings,
  };
}

export function parseEngravings(rawKeys) {
  return (Array.isArray(rawKeys) ? rawKeys : [])
    .map(parseItemKey)
    .filter(({ code }) => code)
    .map(({ code, enhancement }) => ({ itemCode: code, enhancement }));
}

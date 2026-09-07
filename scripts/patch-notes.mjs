// Only parse the public patch-note literal. Never evaluate downloaded game code.
export const GAME_SITE = "https://game.alcanthia.com/";
export const DEPLOYED_NOTES = "https://hellonoa.github.io/alcanthia_fan/data/patch-notes.json";

export function validateSnapshot(snapshot) {
  if (snapshot?.schemaVersion !== 1 || snapshot.source?.site !== GAME_SITE
    || !validVersion(snapshot.source.version) || !validDate(snapshot.syncedAt)) {
    throw new Error("패치내역 메타데이터 형식이 올바르지 않습니다.");
  }
  assertBundleUrl(snapshot.source.bundle);
  validateNotes(snapshot.notes);
  return snapshot;
}

function validVersion(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(value);
}

function validDate(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function validateNotes(notes) {
  if (!Array.isArray(notes) || !notes.length || notes.length > 2000) throw new Error("패치내역 목록이 비어 있거나 너무 큽니다.");
  for (const note of notes) {
    if (!note || Object.keys(note).sort().join() !== "date,fixes,highlights" || !validDate(note.date)) {
      throw new Error(`패치내역 날짜 또는 필드가 올바르지 않습니다: ${note?.date} (${Object.keys(note || {}).join()})`);
    }
    for (const key of ["highlights", "fixes"]) {
      if (!Array.isArray(note[key]) || note[key].length > 500
        || note[key].some((line) => typeof line !== "string" || !line.trim() || line.length > 20000)) {
        throw new Error(`패치내역 ${key} 형식이 올바르지 않습니다.`);
      }
    }
    if (!note.highlights.length && !note.fixes.length) throw new Error("내용 없는 패치내역입니다.");
  }
}

export function extractPatchNotes(bundle) {
  const candidates = [...bundle.matchAll(/\[\s*\{\s*date\s*:\s*new\s+Date\s*\(/g)];
  if (candidates.length !== 1) throw new Error(`패치내역 배열을 하나로 식별하지 못했습니다 (${candidates.length}개).`);
  let offset = candidates[0].index;
  const skip = () => { while (/\s/.test(bundle[offset] || "") && offset < bundle.length) offset++; };
  const take = (token) => {
    skip();
    if (!bundle.startsWith(token, offset)) throw new Error(`지원하지 않는 패치내역 구문: 위치 ${offset}`);
    offset += token.length;
  };
  const peek = () => { skip(); return bundle[offset]; };
  const string = () => {
    skip();
    const quote = bundle[offset++];
    if (!['"', "'", "`"].includes(quote)) throw new Error("패치내역은 문자열이어야 합니다.");
    let result = "";
    while (offset < bundle.length && result.length <= 20000) {
      const ch = bundle[offset++];
      if (ch === quote) return result;
      if (quote === "`" && ch === "$" && bundle[offset] === "{") throw new Error("문자열 내 실행 구문은 허용하지 않습니다.");
      if (ch !== "\\") {
        if (quote !== "`" && /[\r\n]/.test(ch)) throw new Error("잘못된 문자열 개행입니다.");
        result += ch;
        continue;
      }
      const escaped = bundle[offset++];
      const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };
      if (escaped === "u" || escaped === "x") {
        const braced = escaped === "u" && bundle[offset] === "{";
        if (braced) offset++;
        const digits = braced ? /^[0-9a-fA-F]{1,6}(?=\})/.exec(bundle.slice(offset))?.[0]
          : bundle.slice(offset, offset + (escaped === "u" ? 4 : 2));
        if (!digits || !/^[0-9a-fA-F]+$/.test(digits)) throw new Error("잘못된 문자열 이스케이프입니다.");
        result += String.fromCodePoint(parseInt(digits, 16));
        offset += digits.length + (braced ? 1 : 0);
      } else if (escaped === "\n") { /* JS line continuation */
      } else if (escaped === "\r") { if (bundle[offset] === "\n") offset++;
      } else if (Object.hasOwn(escapes, escaped)) result += escapes[escaped];
      else if (['"', "'", "`", "\\", "$", "/"].includes(escaped)) result += escaped;
      else throw new Error("지원하지 않는 문자열 이스케이프입니다.");
    }
    throw new Error("패치내역 문자열이 끝나지 않거나 너무 큽니다.");
  };
  const strings = () => {
    take("[");
    const values = [];
    while (peek() !== "]") {
      if (values.length >= 500) throw new Error("패치 항목이 너무 많습니다.");
      values.push(string());
      if (peek() !== "]") take(",");
    }
    take("]");
    return values;
  };
  const notes = [];
  take("[");
  while (peek() !== "]") {
    if (notes.length >= 2000) throw new Error("패치내역이 너무 많습니다.");
    take("{");
    const note = {};
    while (peek() !== "}") {
      const key = /^[a-zA-Z]+/.exec(bundle.slice(offset))?.[0];
      if (!["date", "highlights", "fixes"].includes(key) || Object.hasOwn(note, key)) throw new Error("알 수 없거나 중복된 패치내역 필드입니다.");
      take(key);
      take(":");
      if (key === "date") {
        take("new"); take("Date"); take("(");
        note.date = string();
        take(")");
      } else note[key] = strings();
      if (peek() !== "}") take(",");
    }
    take("}");
    notes.push({ highlights: [], fixes: [], ...note });
    if (peek() !== "]") take(",");
  }
  take("]");
  validateNotes(notes);
  return notes.map(({ date, highlights, fixes }) => ({ date, highlights, fixes }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function assertBundleUrl(value) {
  const url = new URL(value);
  if (url.origin !== new URL(GAME_SITE).origin || !/^\/assets\/[\w.-]+\.js$/.test(url.pathname)
    || url.username || url.password || url.search || url.hash) throw new Error("허용되지 않은 게임 번들 주소입니다.");
  return url.href;
}

export function findBundleUrl(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => {
    const type = /\btype\s*=\s*["']module["']/i.test(tag);
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    return type && src ? assertBundleUrl(new URL(src, GAME_SITE).href) : null;
  }).filter(Boolean);
  if (scripts.length !== 1) throw new Error("공식 게임의 진입 번들을 식별하지 못했습니다.");
  return scripts[0];
}

export async function fetchText(url, { fetchImpl = fetch, limit = 12_000_000, allowMissing = false } = {}) {
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(30000), redirect: "error", cache: "no-cache",
    headers: { "User-Agent": "AlcanthiaFan-PatchNotes/1.0 (+https://github.com/HelloNoa/alcanthia_fan)" },
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`공식 자료 요청 실패: HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error("자료 응답이 허용 크기를 초과했습니다.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function syncPatchNotes({ previous, fetchImpl = fetch, now = () => new Date(), force = false } = {}) {
  if (previous) validateSnapshot(previous);
  const read = (url, limit) => fetchText(url, { fetchImpl, limit });
  const getVersion = async () => {
    const { version } = JSON.parse(await read(`${GAME_SITE}api/version`, 10000));
    if (!validVersion(version)) throw new Error("공식 게임 버전 형식이 올바르지 않습니다.");
    return version;
  };
  const version = await getVersion();
  if (!force && previous?.source.version === version) return previous;
  const bundleUrl = findBundleUrl(await read(GAME_SITE, 1_000_000));
  const notes = extractPatchNotes(await read(bundleUrl, 12_000_000));
  // A deployment during collection can mix two versions. Retry on the next run.
  if (await getVersion() !== version) throw new Error("수집 중 게임 버전이 변경되었습니다. 다음 실행에서 다시 확인합니다.");
  return validateSnapshot({
    schemaVersion: 1,
    source: { site: GAME_SITE, version, bundle: bundleUrl },
    syncedAt: now().toISOString(),
    notes,
  });
}

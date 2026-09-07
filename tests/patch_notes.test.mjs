import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { extractPatchNotes, findBundleUrl, GAME_SITE, syncPatchNotes, fetchText, validateSnapshot } from "../scripts/patch-notes.mjs";
import { updatePatchNotesFile } from "../scripts/sync-patch-notes.mjs";
import { renderPatchNotesContent } from "../scripts/patch-notes-page.mjs";
import { preparePages } from "../scripts/prepare-pages.mjs";

const literal = '[{date:new Date("2026-09-07T16:04:00+09:00"),highlights:[`첫 줄\n둘째 줄`],fixes:["오류 수정"]}]';
const bundleUrl = `${GAME_SITE}assets/index-test.js`;
const snapshot = () => ({ schemaVersion: 1, source: { site: GAME_SITE, version: "v1", bundle: bundleUrl }, syncedAt: "2026-09-08T00:00:00.000Z", notes: extractPatchNotes(literal) });
const response = (text, status = 200) => new Response(text, { status });

test("extracts only data from renamed bundles and preserves multiline Korean text", () => {
  const notes = extractPatchNotes(`arbitrary_code();const renamed=${literal};more_code()`);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].highlights[0], "첫 줄\n둘째 줄");
  assert.equal(notes[0].date, "2026-09-07T16:04:00+09:00");
  const escaped = literal.replace('"오류 수정"', String.raw`"\uC218\x20\u{1F331}\""`);
  assert.equal(extractPatchNotes(escaped)[0].fixes[0], '수 🌱"');
  assert.deepEqual(extractPatchNotes(literal.replace(',fixes:["오류 수정"]', ''))[0].fixes, []);
});

test("rejects executable expressions, ambiguous arrays, invalid fields and truncated data", () => {
  for (const source of [
    literal.replace('"오류 수정"', 'globalThis.intrusion = true'),
    literal.replace('"오류 수정"', '`실행 ${globalThis.intrusion = true}`'),
    literal.replace('fixes:', '__proto__:'),
    literal.replace('fixes:', 'highlights:'),
    literal.slice(0, -3), `${literal};const other=${literal}`, 'const unrelated=[];',
    literal.replace('2026-09-07T16:04:00+09:00', 'unknown'),
    literal.replace('fixes:["오류 수정"]', 'fixes:[123]'),
  ]) assert.throws(() => extractPatchNotes(source));
  assert.equal(globalThis.intrusion, undefined);
});

test("entry script is restricted to the official origin and assets", () => {
  assert.equal(findBundleUrl('<script crossorigin src="./assets/index-test.js" type="module"></script>'), bundleUrl);
  for (const src of ['https://evil.test/assets/index.js', '//evil.test/assets/index.js', '/api/admin.js', '/assets/test.js?x=1']) {
    assert.throws(() => findBundleUrl(`<script type="module" src="${src}"></script>`));
  }
  assert.throws(() => findBundleUrl('<script src="/assets/index.js"></script>'));
});

test("unchanged version does not fetch the HTML or 4 MB game bundle", async () => {
  const calls = [];
  const previous = snapshot();
  const actual = await syncPatchNotes({ previous, fetchImpl: async (url) => {
    calls.push(url); return response('{"version":"v1","serverNow":123}');
  } });
  assert.strictEqual(actual, previous);
  assert.deepEqual(calls, [`${GAME_SITE}api/version`]);
});

test("changed version fetches notes and verifies a consistent game deployment", async () => {
  const calls = [];
  const actual = await syncPatchNotes({ previous: snapshot(), now: () => new Date('2026-09-08T01:00:00Z'), fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-cache');
    if (url.endsWith('/api/version')) return response('{"version":"v2"}');
    if (url === GAME_SITE) return response('<script type="module" src="./assets/index-test.js"></script>');
    return response(`const renamed=${literal};`);
  } });
  assert.equal(actual.source.version, 'v2');
  assert.equal(actual.syncedAt, '2026-09-08T01:00:00.000Z');
  assert.equal(calls.length, 4);
  validateSnapshot(actual);
});

test("network, malformed data and mid-collection changes fail without mutating previous notes", async () => {
  const previous = snapshot();
  const before = JSON.stringify(previous);
  await assert.rejects(syncPatchNotes({ previous, fetchImpl: async () => response('unavailable', 503) }));
  await assert.rejects(syncPatchNotes({ previous, fetchImpl: async () => response('{"version":""}') }));
  let probes = 0;
  await assert.rejects(syncPatchNotes({ previous, fetchImpl: async (url) => {
    if (url.endsWith('/api/version')) return response(JSON.stringify({ version: `v${++probes + 1}` }));
    if (url === GAME_SITE) return response('<script type="module" src="./assets/index-test.js"></script>');
    return response(literal);
  } }), /수집 중 게임 버전/);
  assert.equal(JSON.stringify(previous), before);
});

test("fetch bounds response sizes and only allows explicit missing snapshots", async () => {
  await assert.rejects(fetchText(GAME_SITE, { limit: 2, fetchImpl: async () => response('large') }), /허용 크기/);
  assert.equal(await fetchText(GAME_SITE, { allowMissing: true, fetchImpl: async () => response('', 404) }), null);
  await assert.rejects(fetchText(GAME_SITE, { allowMissing: true, fetchImpl: async () => response('', 403) }));
});

test("saved snapshot is valid, latest-first, and contains production notes", () => {
  const saved = validateSnapshot(JSON.parse(readFileSync(new URL('../data/patch-notes.json', import.meta.url), 'utf8')));
  assert.ok(saved.notes.length > 0);
  for (let i = 1; i < saved.notes.length; i++) assert.ok(Date.parse(saved.notes[i-1].date) >= Date.parse(saved.notes[i].date));
});

test("static page preserves source, Korean dates, all notes and escapes upstream HTML", () => {
  const data = snapshot();
  data.notes[0].fixes = ['<img src=x onerror="alert(1)"> & 수정'];
  const html = renderPatchNotesContent(data);
  assert.match(html, /2026년 9월 7일 16:04/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; 수정/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /data-patch-note open/);
  assert.match(html, /테스트 서버 내역은 포함하지 않습니다/);
  assert.match(html, /href="https:\/\/game.alcanthia.com\/"/);
});

test("failed collection leaves the local file byte-for-byte unchanged", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'patch-failure-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'notes.json');
  const original = JSON.stringify(snapshot());
  await writeFile(target, original);
  await assert.rejects(updatePatchNotesFile({ target, fetchImpl: async () => response('failed', 503) }));
  assert.equal(await readFile(target, 'utf8'), original);
  assert.deepEqual(await readdir(temp), ['notes.json']);
});

test("deployment checkpoint skips unchanged notes and retries updates not yet deployed", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'patch-deploy-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'notes.json');
  const current = snapshot();
  await writeFile(target, JSON.stringify(current));
  let live = null;
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.endsWith('/api/version')) return response('{"version":"v1"}');
    return live ? response(JSON.stringify(live)) : response('', 404);
  };
  const first = await updatePatchNotesFile({ target, useDeployed: true, fetchImpl });
  assert.equal(first.changed, true, 'the initial publish is needed even when local version matches');
  assert.equal((await updatePatchNotesFile({ target, useDeployed: true, fetchImpl })).changed, true, 'failed deployment must retry');
  live = current;
  assert.equal((await updatePatchNotesFile({ target, useDeployed: true, fetchImpl })).changed, false);
  assert.equal(requests.some((url) => url.includes('/assets/')), false);
});

test("Pages artifact contains public routes and excludes private tools and repository metadata", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'patch-artifact-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const output = join(temp, 'site');
  await preparePages(output);
  const paths = await readdir(output, { recursive: true });
  for (const forbidden of ['raid-recommender', '.git', '.github', 'scripts', 'tests', 'README.md']) {
    assert.equal(paths.some((path) => path === forbidden || path.startsWith(`${forbidden}/`)), false);
  }
  for (const required of ['index.html', 'patch-notes/index.html', 'data/patch-notes.json', 'js/patch-notes.js', 'plants/index.html', 'calc/adv/index.html']) assert.ok(paths.includes(required));
  await assert.rejects(preparePages(output), { code: 'EEXIST' });
});

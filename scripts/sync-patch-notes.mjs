#!/usr/bin/env node
import { appendFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEPLOYED_NOTES, fetchText, syncPatchNotes, validateSnapshot } from "./patch-notes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function updatePatchNotesFile({ target = resolve(root, "data/patch-notes.json"), useDeployed = false, force = false, fetchImpl = fetch } = {}) {
  let local = null;
  try { local = validateSnapshot(JSON.parse(await readFile(target, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  // The last successful Pages deployment is our durable checkpoint: failed
  // deployments leave it untouched, so an unchanged version still retries.
  const deployedText = useDeployed
    ? await fetchText(DEPLOYED_NOTES, { fetchImpl, limit: 2_000_000, allowMissing: true }) : null;
  const deployed = deployedText === null ? null : validateSnapshot(JSON.parse(deployedText));
  const previous = deployed || local;
  const snapshot = await syncPatchNotes({ previous, force, fetchImpl });
  const changed = JSON.stringify(snapshot) !== JSON.stringify(useDeployed ? deployed : local);
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (content !== (local ? `${JSON.stringify(local, null, 2)}\n` : null)) {
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid}`;
    try { await writeFile(temporary, content); await rename(temporary, target); }
    catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }
  return { snapshot, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !["--deployed", "--force"].includes(arg))) throw new Error("사용법: node scripts/sync-patch-notes.mjs [--deployed] [--force]");
    const { snapshot, changed } = await updatePatchNotesFile({ useDeployed: args.includes("--deployed"), force: args.includes("--force") });
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
    console.log(`${changed ? "갱신" : "변경 없음"}: 본서버 패치내역 ${snapshot.notes.length}개, 버전 ${snapshot.source.version}`);
  } catch (error) {
    console.error(`패치내역 갱신 실패: ${error.message}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
import { cp, lstat, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_ROUTE_ENTRIES } from "../js/routes.js";
import { SEO_PAGE_DEFINITIONS } from "./seo-pages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Explicit public assets only. Never publish the repository root, private
// raid-recommender, source tooling, .git, or machine-specific files.
export const PUBLIC_PATHS = [
  "index.html", "favicon.png", "watch_moss_jelly.png", "sitemap.xml",
  "css", "js", "credit",
  "data/gamedata.json", "data/names.json", "data/progression.json", "data/patch-notes.json",
  ...SEO_PAGE_DEFINITIONS.map(({ slug }) => `${slug}/index.html`),
  ...APP_ROUTE_ENTRIES.map(({ path }) => `${path}/index.html`),
];

async function assertSafeSource(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error(`심볼릭 링크는 배포하지 않습니다: ${path}`);
  if (stat.isDirectory()) {
    for (const name of await readdir(path)) {
      if (name.startsWith(".")) throw new Error(`숨김 파일은 배포하지 않습니다: ${path}/${name}`);
      await assertSafeSource(resolve(path, name));
    }
  }
}

export async function preparePages(output) {
  // Require a new directory instead of overwriting an existing tree.
  await mkdir(output);
  for (const path of PUBLIC_PATHS) {
    const source = resolve(root, path);
    await assertSafeSource(source);
    await mkdir(dirname(resolve(output, path)), { recursive: true });
    await cp(source, resolve(output, path), { recursive: true, errorOnExist: true, force: false });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("사용법: node scripts/prepare-pages.mjs <새 출력 디렉터리>");
  await preparePages(resolve(process.argv[2]));
  console.log("공개 정적 파일만 Pages 배포 디렉터리에 준비했습니다.");
}

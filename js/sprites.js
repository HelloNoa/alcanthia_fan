// 공유 아이콘/스프라이트 헬퍼 (도감/계산기/스킬트리에서 사용)
import { CDN } from "./config.js";
import { names } from "./api.js";

export { CDN };

const ITEM_FOLDERS = [
  "items/ornament", "items/cauldrons", "items/materials", "items/tools",
  "items/equipment", "plants/seeds", "plants/produce", "potions", "",
];

// 여러 후보 URL 순차 시도, 다 실패하면 텍스트/숨김
export function loadImg(el, urls, fallback, className) {
  const img = document.createElement("img");
  img.loading = "lazy";
  if (className) img.className = className;
  let i = 0;
  const next = () => {
    if (i >= urls.length) { img.remove(); if (fallback) el.append(fallback); return; }
    img.src = urls[i++];
  };
  img.onerror = next;
  el.appendChild(img);
  next();
  return img;
}

export async function itemIconURLs(code) {
  const N = await names();
  const sk = (N.itemSprites && N.itemSprites[code]) || code;
  const folder = N.itemFolders && N.itemFolders[sk];
  if (folder) return [`${CDN}/${folder}/${sk}.png`, `${CDN}/${folder}/${sk}_anim.png`];
  return ITEM_FOLDERS.flatMap((f) => {
    const base = f ? `${CDN}/${f}/${sk}` : `${CDN}/${sk}`;
    return [`${base}.png`];
  });
}

// el 에 아이콘 붙이기 헬퍼들
export async function itemIcon(el, code, cls = "ic") {
  loadImg(el, await itemIconURLs(code), "", cls);
}
export function plantIcon(el, spriteKey, cls = "ic") {
  loadImg(el, [`${CDN}/plants/sprites/${spriteKey}.png`], "", cls);
}
export function skillIcon(el, id, cls = "ic") {
  loadImg(el, [`${CDN}/skills/${id}.png`], "", cls);
}
export function monsterIcon(el, spriteKey, cls = "ic") {
  loadImg(el, [`${CDN}/monsters/${spriteKey}.png`], "", cls);
}
export function adventurerIcon(el, spriteKey, cls = "ic") {
  loadImg(el, [`${CDN}/npc/${spriteKey}.png`], "", cls);
}
export function achievementIcon(el, iconKey, cls = "ic") {
  loadImg(el, [`${CDN}/ui/icons/${iconKey}.png`], "", cls);
}

// ms -> "1분 30초" 류
export function fmtDuration(ms) {
  if (ms == null) return "-";
  let s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return [h && `${h}시간`, m && `${m}분`, (s || (!h && !m)) && `${s}초`].filter(Boolean).join(" ");
}

import { gamedata } from "./api.js";
import { plantIcon, itemIcon, fmtDuration, loadImg, CDN } from "./sprites.js";

const CANVAS = 27;
const CENTER = (CANVAS - 1) / 2; // 13
const STORE = "alc_planner_v3";
const PEDESTAL = "pedestal";
const LEGACY_PEDESTAL = "equipment_pedestal";
// 조건 부여원 (작물 perk + 장식물)
const EMIT = {
  dew_root: "humid", sunlight_flower: "sunlit", poison_flower: "poisonous",
  crystal_fountain: "humid", fairy_lantern: "sunlit", witch_scarecrow: "anti_magic",
};
const COND_KR = { humid: "습기", fertile: "비옥", toxic: "독성 토양", poisonous: "유독(중독 부여)", sunlit: "햇살", anti_magic: "항마", arid: "사막화" };
const COND_COLOR = { humid: "#3b6ea5", fertile: "#47b96b", toxic: "#6a9f3a", poisonous: "#8f5ac8", sunlit: "#d9a92e", anti_magic: "#9b6cff", arid: "#c26b2c" };
const COND_ORDER = ["humid", "fertile", "toxic", "poisonous", "sunlit", "anti_magic", "arid"];  // 중첩 테두리 순서(고정)
const PLANT_COND_KR = { poisoned: "중독", poison_immune: "중독 면역", encroached: "잠식", frozen: "결빙", anti_magic: "항마" };
const PLANT_COND_COLOR = { poisoned: "#9b59b6", poison_immune: "#2ecc71", encroached: "#6c3483", frozen: "#85d8ff", anti_magic: "#c6b3ff" };
const PLANT_COND_ORDER = ["poisoned", "poison_immune", "encroached", "frozen", "anti_magic"];
const POTION_EFFECTS = [
  { id: "soil_humid", target: "soil", op: "toggle", cond: "humid", label: "습기", icon: "💧", note: "토양 효과" },
  { id: "soil_fertile", target: "soil", op: "toggle", cond: "fertile", label: "비옥", item: "lava_essence", note: "성장시간 50%" },
  { id: "soil_toxic", target: "soil", op: "toggle", cond: "toxic", label: "독성", item: "corrosion_potion", note: "독꽃 ×2" },
  { id: "soil_poisonous", target: "soil", op: "toggle", cond: "poisonous", label: "중독부여", icon: "☠", note: "유독 토양" },
  { id: "soil_arid", target: "soil", op: "toggle", cond: "arid", label: "사막화", item: "heatwave_potion", note: "물주기 불가·불씨 보호" },
  { id: "soil_sunlit", target: "soil", op: "toggle", cond: "sunlit", label: "햇살", icon: "☀", note: "생산 ×1.3" },
  { id: "soil_anti_magic", target: "soil", op: "toggle", cond: "anti_magic", label: "항마", icon: "✦", note: "자동수확 제외" },
  { id: "soil_clear_arid", target: "soil", op: "remove", cond: "arid", label: "증기", item: "steam_potion", note: "사막화 제거" },
  { id: "soil_purify", target: "soil", op: "removeMany", conds: ["toxic", "poisonous"], label: "정화", item: "purification_potion", note: "독성·유독 제거" },
  { id: "plant_poisoned", target: "plant", op: "toggle", cond: "poisoned", label: "중독", item: "poison_potion", note: "생산 중단" },
  { id: "plant_antidote", target: "plant", op: "remove", cond: "poisoned", label: "해독", item: "antidote_potion", note: "중독 제거" },
  { id: "plant_poison_immune", target: "plant", op: "toggle", cond: "poison_immune", label: "면역", item: "slime_potion", note: "중독 방지" },
  { id: "plant_encroached", target: "plant", op: "toggle", cond: "encroached", label: "잠식", item: "encroachment_potion", note: "생산 ×2" },
  { id: "plant_frozen", target: "plant", op: "toggle", cond: "frozen", label: "결빙", item: "freeze_potion", note: "생산 0" },
  { id: "plant_anti_magic", target: "plant", op: "toggle", cond: "anti_magic", label: "항마", item: "anti_magic_potion", note: "자동수확 제외" },
];
// 설치형 장식물
const ORN = {
  witch_scarecrow: "마녀 허수아비", crystal_fountain: "수정 분수", fairy_lantern: "요정 등불",
  mana_sprayer: "마력 분사기",
  flower_trellis_arch: "꽃 트렐리스", star_music_box: "별조각 오르골", telescope: "망원경", town_teleporter: "마을 텔레포터",
  campfire: "모닥불",
  rustic_fence: "낡은 울타리", root_barrier: "뿌리장벽", storage_chest: "차원상자", pedestal: "전시대",
};
// 장식물 부가설명 (기능형)
const ORN_NOTE = { root_barrier: "지표 효과 차단 (조건 전파 막음)", storage_chest: "아이템 보관", pedestal: "장비 전시", mana_sprayer: "인접 식물 포션 공급" };
// 바닥재 종류 (표면 배치, CSS 텍스처)
const FLOOR_NAMES = {
  stone_floor: "석판", cobblestone_floor: "조약돌", grass_floor: "잔디",
  grass_stone_floor: "잔디 석판", flower_meadow_floor: "꽃잔디", tilled_soil_floor: "갈아엎은 흙",
  water_channel: "물길", lava_channel: "용암길",
};
// 공유 인코딩 순서 (모듈 레벨 — decodeGrid가 load 초기에 호출되므로 TDZ 방지)
const FLOOR_ORDER = Object.keys(FLOOR_NAMES);   // 인덱스+1 = 바닥재 종류
const FENCE_ORDER = ["rustic_fence", "root_barrier"];
const SIDES = ["t", "r", "b", "l"];
const PRODUCTION_ZONES = {
  "": "지역 없음",
  misty_swamp: "안개 습지",
  poison_jungle: "독안개 정글",
  advanced_volcano: "용암 협곡",
  wind_corridor: "바람의 회랑",
  golden_fields: "금빛 들판",
  twilight_valley: "어스름 계곡",
  crystal_mine: "수정 갱도",
  dried_spring: "메마른 샘",
};
const PRODUCTION_ZONE_NOTES = {
  "": "텃밭 생산량에 영향을 주는 지역 효과를 적용하지 않습니다.",
  misty_swamp: "모든 칸을 습기 토양으로 계산합니다. 푸른이끼처럼 습기 조건을 보는 작물에 영향이 있습니다.",
  poison_jungle: "중독 식물도 생산하며, 중독 상태면 생산속도에 +10%×계수가 붙습니다.",
  advanced_volcano: "물에 약한 작물도 물 공급으로 죽지 않는 것으로 계산합니다.",
  wind_corridor: "바람꽃 수분 주기가 60초×(1 - 10%×계수)로 짧아집니다.",
  golden_fields: "최대 생산 횟수가 기본 수명×(1 + 50%×계수)로 늘어납니다.",
  twilight_valley: "이웃 종류 수만큼 생산 배율이 +5%×계수×종류 수 증가합니다.",
  crystal_mine: "같은 작물로 가로/세로 줄을 채우면 줄마다 +20%×계수. 이 칸은 일반 과밀 감소 대신 수정갱도 분기를 탑니다.",
  dried_spring: "풍요의 손길 추가 수확 확률 효과가 (1 + 계수)배 커집니다.",
};
const zoneCoeff = (opt) => opt.familiar * 0.1 + (opt.fog ? 1 : 0) + (opt.raid ? 0.5 : 0);
const plentyMultiplier = (opt) => 1 + 0.05 * opt.plenty * (opt.zone === "dried_spring" ? 1 + zoneCoeff(opt) : 1);
const zoneNoteHtml = (opt) => `<b>${PRODUCTION_ZONES[opt.zone] || PRODUCTION_ZONES[""]}</b>: ${PRODUCTION_ZONE_NOTES[opt.zone] || PRODUCTION_ZONE_NOTES[""]}<br><span>계수 = 낯익은 터×0.1 + 안개 해방 1 + 추가 버프 0.5 (습격 방어 성공·수호의 향로)</span>`;

function multiplier(pid, cond, plantCond, sameCount, diversity, opt, oneShot, crystalLineBonus) {
  let c = opt.harvest ? 1.5 : 1;
  const zc = zoneCoeff(opt);
  if (pid === "blue_moss" && cond.has("humid")) c *= 2;
  if (pid === "poison_flower" && cond.has("toxic")) c *= 2;
  if (pid === "illusion_fern") c *= Math.max(0, diversity);
  if (cond.has("sunlit")) c *= 1.3;
  if (plantCond.has("encroached")) c *= 2;
  if (opt.zone === "poison_jungle" && plantCond.has("poisoned")) c *= 1 + 0.1 * zc;
  if (opt.zone === "twilight_valley") c *= 1 + 0.05 * zc * diversity;
  if (pid === "crystal_succulent") c *= 0.5 + 0.5 * sameCount;
  else if (opt.zone === "crystal_mine" && crystalLineBonus > 0) c *= 1 + 0.2 * zc * crystalLineBonus;
  else if (!oneShot && sameCount > 0) c *= 1 - (1 - 0.5 ** sameCount) * Math.max(0, 1 - opt.resist * 0.25);
  return c;
}
const waterKills = (pid, plant) => plant?.waterKills === true || pid === "fire_vine";
const poisonResistant = (pid, plantCond) => pid === "poison_flower" || pid === "nightshade_sprout" || plantCond?.has("poison_immune");
const SPRITE_FX_ORDER = ["frozen", "encroached", "poisoned", "toxic", "poisonous", "arid", "humid", "sunlit", "fertile", "anti_magic", "poison_immune"];

const uniq = (arr) => [...new Set(arr.filter(Boolean))];
function spriteFxList(st) {
  const fx = [];
  for (const id of SPRITE_FX_ORDER) {
    if (st.plantCond?.has(id) || st.cond?.has(id)) fx.push(id);
  }
  return fx;
}
function plantSpriteKeys(pid, base, st) {
  const fx = spriteFxList(st)[0];
  return uniq([
    fx && `${base}_${fx}`,
    fx && `${pid}_${fx}`,
    base,
    pid,
  ]);
}
function plantIconFx(el, keys) {
  loadImg(el, keys.map((k) => `${CDN}/plants/sprites/${k}.png`), "", "ic");
}
function plantVisual(st) {
  const cond = st.cond || new Set();
  const pc = st.plantCond || new Set();
  const tone = [];
  const glow = [];
  let aura = "transparent";
  let auraOpacity = "0";
  if (st.waterKilled) {
    tone.push("grayscale(.75)", "sepia(.65)", "saturate(.55)", "brightness(.76)");
    glow.push("drop-shadow(0 0 4px #8a4b2a)");
    aura = "rgba(194, 107, 44, .45)";
    auraOpacity = ".35";
  } else if (pc.has("frozen")) {
    tone.push("saturate(.85)", "hue-rotate(165deg)", "brightness(1.22)");
    glow.push("drop-shadow(0 0 5px #85d8ff)");
    aura = "rgba(133, 216, 255, .45)";
    auraOpacity = ".32";
  } else if (pc.has("encroached")) {
    tone.push("hue-rotate(250deg)", "saturate(1.45)", "brightness(.82)");
    glow.push("drop-shadow(0 0 5px #9b59d0)");
    aura = "rgba(108, 52, 131, .45)";
    auraOpacity = ".34";
  } else if (pc.has("poisoned") || cond.has("poisonous")) {
    tone.push("hue-rotate(60deg)", "saturate(1.35)", "brightness(.88)");
    glow.push("drop-shadow(0 0 5px #c472ff)");
    aura = "rgba(143, 90, 200, .42)";
    auraOpacity = ".32";
  } else if (cond.has("toxic")) {
    tone.push("hue-rotate(35deg)", "saturate(1.35)", "brightness(.95)");
    glow.push("drop-shadow(0 0 5px #7fd45a)");
    aura = "rgba(106, 159, 58, .42)";
    auraOpacity = ".30";
  } else if (cond.has("arid")) {
    tone.push("sepia(.42)", "saturate(.8)", "brightness(1.03)");
    glow.push("drop-shadow(0 0 4px #d27a33)");
    aura = "rgba(194, 107, 44, .32)";
    auraOpacity = ".24";
  }
  if (cond.has("humid")) glow.push("drop-shadow(0 0 4px #5bb7ff)");
  if (cond.has("fertile")) glow.push("drop-shadow(0 0 4px #55d982)");
  if (cond.has("sunlit")) glow.push("drop-shadow(0 0 5px #ffd45a)");
  if (cond.has("anti_magic") || pc.has("anti_magic")) glow.push("drop-shadow(0 0 5px #bba0ff)");
  if (pc.has("poison_immune")) glow.push("drop-shadow(0 0 4px #6dff9a)");
  return {
    filter: [...tone, ...glow].join(" ") || "none",
    aura,
    auraOpacity,
  };
}

export async function renderPlanner(view) {
  const g = await gamedata();
  // 장비 전시대에 올릴 수 있는 아이템 (장비류)
  const DISPLAY_ITEMS = Object.keys(g.equipment_stats || {})
    .map((c) => [c, g.items?.[c]?.name || c]).sort((a, b) => a[1].localeCompare(b[1]));
  const plants = {};
  for (const [k, v] of Object.entries(g.plants || {})) {
    if (k.startsWith("aging") || (v.name || "").includes("시험용")) continue;
    plants[k] = v;
  }
  const palette = Object.keys(plants);

  // cell: null(미개간) | {p:null}(개간) | {p:id,e}(작물) | {orn:code}(장식물)
  let grid = load();
  let sel = palette[0];
  let mode = "plant";
  let enh = 0;
  const opt = { harvest: false, resist: 0, zone: "", familiar: 0, fog: false, raid: false, rootDom: 0, vein: false, sturdy: false, timeM: 0, soilM: 0, plenty: 0, uptime: 100, gust: false };
  let condMap = null;

  view.innerHTML = `<h2>🌿 텃밭 배치 테스트</h2>
    <p class="muted">개간으로 흙을 깔고 작물·장식물을 배치 · 인접효과/생산량 실시간 계산</p>
    <div class="pl-wrap">
      <div class="pl-left">
        <div class="pl-modes">
          <button data-m="plant" class="active">🌱 심기</button>
          <button data-m="till">🟫 개간/확장</button>
          <button data-m="effect">🧪 포션 효과</button>
          <button id="pl-iso" class="pl-iso-btn">📐 입체 보기</button>
          <span class="pl-zoom"><button id="pl-zoomout">➖</button><button id="pl-zoomin">➕</button></span>
          <span class="pl-hint" id="pl-hint"></span>
        </div>
        <div class="pl-palette" id="pl-pal"></div>
        <div class="pl-palette pl-orn" id="pl-pal-orn"></div>
        <div class="pl-palette pl-effects" id="pl-pal-eff"></div>
        <label class="lvlabel pl-enh">작물 강화 <input id="pl-enh" type="range" min="0" max="12" value="0"><b id="pl-enhv">0</b>강</label>
        <div class="pl-gridscroll"><div class="pl-grid" id="pl-grid" style="--n:${CANVAS};--cell:34px"></div></div>
        <div class="pl-legend">
          <span><i class="lg humid"></i>습기</span><span><i class="lg fertile"></i>비옥</span>
          <span><i class="lg toxic"></i>독성</span><span><i class="lg poisonous"></i>유독(중독)</span>
          <span><i class="lg sunlit"></i>햇살</span><span><i class="lg anti"></i>항마</span>
          <span><i class="lg arid"></i>사막화</span>
          <span><i class="lg soil"></i>흙</span><span><i class="lg poll"></i>수분 경로</span>
        </div>
      </div>
      <div class="pl-side">
        <div class="pl-opts">
          <label class="chk"><input type="checkbox" id="pl-harvest"> 촉진포션 (×1.5)</label>
          <label class="lvlabel">과밀 저항 <input id="pl-resist" type="range" min="0" max="2" value="0"><b id="pl-resistv">0</b></label>
          <div class="pl-sksec">지역 효과 <span class="muted">(생산량)</span></div>
          <label class="lvlabel">지역 <select id="pl-zone" class="num-in">
            ${Object.entries(PRODUCTION_ZONES).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}
          </select></label>
          <label class="lvlabel">낯익은 터 <input id="pl-familiar" type="range" min="0" max="10" value="0"><b id="pl-familiarv">0</b></label>
          <label class="chk"><input type="checkbox" id="pl-fog"> 안개 해방</label>
          <label class="chk" title="습격 방어 성공 또는 수호의 향로 사용"><input type="checkbox" id="pl-raid"> 지역효과 +50% 버프</label>
          <div class="muted">지역효과 계수 <b id="pl-zone-coeff">0.00</b></div>
          <div class="pl-zone-note" id="pl-zone-note">${zoneNoteHtml(opt)}</div>
          <label class="lvlabel">뿌리 지배 <input id="pl-root" type="range" min="0" max="2" value="0"><b id="pl-rootv">0</b></label>
          <label class="chk"><input type="checkbox" id="pl-vein"> 맥읽기 (강화만큼 범위↑)</label>
          <label class="chk"><input type="checkbox" id="pl-sturdy"> 단단한 줄기 (강화 작물 최대생산 ×(강화+1))</label>
          <div class="pl-sksec">생산 스킬 <span class="muted">(강화 작물에 곱연산)</span></div>
          <label class="lvlabel">시간 숙련 <input id="pl-time" type="range" min="0" max="10" value="0"><b id="pl-timev">0</b></label>
          <label class="lvlabel">토양 숙련 <input id="pl-soil" type="range" min="0" max="10" value="0"><b id="pl-soilv">0</b></label>
          <label class="lvlabel">풍요의 손길 <input id="pl-plenty" type="range" min="0" max="3" value="0"><b id="pl-plentyv">0</b></label>
          <label class="lvlabel">가동률 <input id="pl-uptime" type="range" min="50" max="100" step="5" value="100"><b id="pl-uptimev">100</b>%</label>
          <div class="pl-sksec">수분 포션 <span class="muted">(바람꽃)</span></div>
          <label class="chk"><input type="checkbox" id="pl-gust"> 질풍포션 (수분 2배속)</label>
          <label class="lvlabel">밭 프리셋 <select id="pl-preset" class="num-in"></select></label>
          <div class="pl-cost" id="pl-cost"></div>
          <div class="pl-btns"><button class="chip" id="pl-fill">전체 개간</button><button class="chip" id="pl-clear">전체 지우기</button></div>
        </div>
        <div class="calc-note">🌾 <b>약초 자동화</b>: 마녀 허수아비의 <b>항마</b>가 깔린 칸의 약초는 자동수확이 안 돼서 <b>번식 원천</b>으로 영구히 남습니다. <b>바람꽃</b>이 4방향 직선에서 만난 작물을 <b>그 너머 빈 칸에 복제(번식)</b>하고, <b>정령의 낫</b>이 다 자란 약초를 자동 수확해요 → 보호 약초 1개로 약초가 끝없이 번져 자동 생산. (약초·달빛버섯은 oneShot이라 <b>과밀 면제</b>)<br><span class="muted">※ 맥읽기는 바람꽃 <b>수분 범위가 아니라</b>, 번식되는 작물의 <b>최대 강화도</b>(원본·바람꽃 강화 중 작은 값)에 영향을 줍니다.<br>※ 약초·달빛버섯 생산량은 <b>성장주기 기준 이론 최대값</b>이에요. 실제 자동화는 바람꽃 수분 <b>60초 주기</b>에 묶여서 바람꽃 1개당 <b>최대 ~240/h</b>(4방향)가 상한입니다.</span></div>
        <div class="pl-detail" id="pl-detail"></div>
        <div class="pl-summary" id="pl-summary"></div>
        <div class="pl-summary pl-poll" id="pl-pollsum"></div>
        <div class="pl-summary pl-save">
          <h3>💾 저장 · 공유</h3>
          <div class="pl-save-row"><input id="pl-slotname" placeholder="배치 이름" maxlength="20"><button class="chip" id="pl-save-btn">저장</button></div>
          <div id="pl-slots" class="pl-slots"></div>
          <div class="pl-share-actions">
            <button class="chip pl-share-btn" id="pl-share-url">🔗 URL 복사</button>
            <button class="chip pl-share-btn" id="pl-share-discord">💬 Discord 복사</button>
          </div>
          <div id="pl-share-msg" class="muted pl-share-msg"></div>
        </div>
      </div>
    </div>`;

  const palBox = view.querySelector("#pl-pal");
  const ornBox = view.querySelector("#pl-pal-orn");
  const effBox = view.querySelector("#pl-pal-eff");
  const gridBox = view.querySelector("#pl-grid");
  const detail = view.querySelector("#pl-detail");
  const summary = view.querySelector("#pl-summary");
  const pollsum = view.querySelector("#pl-pollsum");
  const hint = view.querySelector("#pl-hint");

  const palItem = (key, label, kind) => {
    const b = document.createElement("button");
    b.className = "pl-pi" + (key === sel ? " active" : "");
    if (kind === "eraser") b.innerHTML = `<span class="pl-erase">🚫</span><span>지우개</span>`;
    else {
      const ic = document.createElement("span"); ic.className = "pl-pic";
      if (kind === "floor") { ic.className = "pl-pic pl-fpic"; itemIcon(ic, key); }  // 실제 스프라이트(다이아) → CSS로 정렬
      else if (kind === "orn") itemIcon(ic, key); else plantIcon(ic, plants[key].spriteKey || key);
      b.appendChild(ic);
      b.insertAdjacentHTML("beforeend", `<span>${label}</span>`);
    }
    b.dataset.kind = kind || "plant";
    b.onclick = () => {
      sel = key;
      view.querySelectorAll(".pl-pi").forEach((x) => x.classList.toggle("active", x === b));
    };
    return b;
  };
  palBox.appendChild(palItem("", "", "eraser"));
  palette.forEach((k) => palBox.appendChild(palItem(k, plants[k].name, "plant")));
  ornBox.insertAdjacentHTML("beforeend", `<span class="pl-orn-lbl">장식물</span>`);
  Object.entries(ORN).forEach(([k, l]) => ornBox.appendChild(palItem(k, l, "orn")));
  ornBox.insertAdjacentHTML("beforeend", `<span class="pl-orn-lbl">바닥재</span>`);
  Object.entries(FLOOR_NAMES).forEach(([k, l]) => ornBox.appendChild(palItem(k, l, "floor")));
  let effectSel = POTION_EFFECTS[0].id;
  const effItem = (fx) => {
    const b = document.createElement("button");
    b.className = "pl-fx" + (fx.id === effectSel ? " active" : "");
    b.title = fx.note ? `${fx.label} · ${fx.note}` : fx.label;
    if (fx.item) {
      const ic = document.createElement("span"); ic.className = "pl-pic";
      itemIcon(ic, fx.item);
      b.appendChild(ic);
    } else b.insertAdjacentHTML("beforeend", `<span class="pl-fx-emo">${fx.icon || "·"}</span>`);
    b.insertAdjacentHTML("beforeend", `<span>${fx.label}</span>`);
    b.onclick = () => {
      effectSel = fx.id;
      effBox.querySelectorAll(".pl-fx").forEach((x) => x.classList.toggle("active", x === b));
    };
    return b;
  };
  effBox.insertAdjacentHTML("beforeend", `<span class="pl-orn-lbl">토양 효과</span>`);
  POTION_EFFECTS.filter((x) => x.target === "soil").forEach((x) => effBox.appendChild(effItem(x)));
  effBox.insertAdjacentHTML("beforeend", `<span class="pl-orn-lbl">식물 상태</span>`);
  POTION_EFFECTS.filter((x) => x.target === "plant").forEach((x) => effBox.appendChild(effItem(x)));

  const selKind = () => view.querySelector(`.pl-pi.active`)?.dataset.kind || "plant";

  const hasField = () => grid.some((row) => row.some(Boolean));
  const adjField = (r, c) => [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dy, dx]) => {
    const y = r + dy, x = c + dx; return y >= 0 && y < CANVAS && x >= 0 && x < CANVAS && grid[y][x];
  });
  const FENCES = new Set(["rustic_fence", "root_barrier"]);      // 칸 경계(edge) 배치
  const keep = (cell) => ({
    floor: cell && cell.floor,
    fences: cell && cell.fences,
    cond: cell?.cond?.length ? [...cell.cond] : undefined,
  });
  const keepPlantCond = (cell, pid) => cell?.p === pid && cell.plantCond?.length ? { plantCond: [...cell.plantCond] } : {};
  const cleanCell = (cell) => {
    if (!cell) return cell;
    if (!cell.cond?.length) delete cell.cond;
    if (!cell.plantCond?.length) delete cell.plantCond;
    if (cell.cond) cell.cond = COND_ORDER.filter((x) => cell.cond.includes(x));
    if (cell.plantCond) cell.plantCond = PLANT_COND_ORDER.filter((x) => cell.plantCond.includes(x));
    return cell;
  };
  const setList = (cell, prop, vals) => {
    const order = prop === "cond" ? COND_ORDER : PLANT_COND_ORDER;
    const next = order.filter((x) => vals.includes(x));
    if (next.length) cell[prop] = next; else delete cell[prop];
  };
  const applyEffect = (r, c) => {
    const cell = grid[r][c];
    if (!cell) return;
    const fx = POTION_EFFECTS.find((x) => x.id === effectSel);
    if (!fx) return;
    if (fx.target === "plant" && !cell.p && !virtualPollMap.has(`${r}:${c}`)) return;
    const prop = fx.target === "soil" ? "cond" : "plantCond";
    const cur = new Set(cell[prop] || []);
    if (fx.op === "toggle") {
      cur.has(fx.cond) ? cur.delete(fx.cond) : cur.add(fx.cond);
      if (fx.cond === "poison_immune") cur.delete("poisoned");
    } else if (fx.op === "remove") cur.delete(fx.cond);
    else if (fx.op === "removeMany") (fx.conds || []).forEach((x) => cur.delete(x));
    setList(cell, prop, [...cur]);
    cleanCell(cell);
    recompute(); save();
  };
  // 클릭 위치로 가까운 변(상/하/좌/우) 판정 (자식은 pointer-events:none → offset이 셀 기준)
  const sideOf = (ev) => {
    const el = ev.currentTarget;
    const x = ev.offsetX / el.offsetWidth, y = ev.offsetY / el.offsetHeight;
    const d = { t: y, b: 1 - y, l: x, r: 1 - x };
    return ["t", "b", "l", "r"].reduce((a, k) => (d[k] < d[a] ? k : a), "t");
  };
  const apply = (r, c, ev) => {
    const cell = grid[r][c];
    if (mode === "effect") {
      applyEffect(r, c);
      return;
    }
    if (mode === "till") {
      if (cell && cell.p == null && cell.orn == null && !cell.floor && !cell.fences) grid[r][c] = null; // 빈 흙만 제거
      else if (cell) return;                                     // 작물·장식·바닥·울타리 있는 칸 보호
      else if (!hasField() || adjField(r, c)) grid[r][c] = { p: null }; // 인접한 경우만 확장
      else return;                                               // 비인접 → 확장 불가
    } else {
      if (!cell) return;                                         // 미개간 칸엔 심을 수 없음
      const kind = selKind();
      if (kind === "eraser") { grid[r][c] = { p: null, ...keep(cell) }; } // 작물·장식만 제거(바닥·울타리 유지)
      else if (FLOOR_NAMES[sel]) { cell.floor = cell.floor === sel ? undefined : sel; } // 표면 바닥재 (작물 유지·종류 변경)
      else if (FENCES.has(sel)) {                                // 경계 토글 (클릭한 변)
        const s = ev ? sideOf(ev) : "t";
        cell.fences = cell.fences || {};
        if (cell.fences[s] === sel) delete cell.fences[s]; else cell.fences[s] = sel;
        if (!Object.keys(cell.fences).length) delete cell.fences;
      }
      else if (kind === "orn") grid[r][c] = cell.orn === sel ? { p: null, ...keep(cell) } : { orn: sel, ...keep(cell) };
      else {
        const same = cell.p === sel && (cell.e || 0) === enh;
        grid[r][c] = same ? { p: null, ...keep(cell) } : { p: sel, e: enh, ...keep(cell), ...keepPlantCond(cell, sel) };
      }
    }
    cleanCell(grid[r][c]);
    recompute(); save();
  };

  // 동적 윈도우: 밭 bbox + 여백만 렌더 → 작은 밭일수록 셀이 커짐
  const cellMap = new Map();
  let virtualPollMap = new Map();
  let win = null;
  const computeWin = () => {
    let minR = CANVAS, maxR = -1, minC = CANVAS, maxC = -1;
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) if (grid[r][c]) {
      if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c;
    }
    for (const { tr, tc } of virtualPollMap.values()) {
      if (tr < minR) minR = tr; if (tr > maxR) maxR = tr; if (tc < minC) minC = tc; if (tc > maxC) maxC = tc;
    }
    if (maxR < 0) { minR = minC = CENTER - 2; maxR = maxC = CENTER + 2; }
    const M = 2;
    return { minR: Math.max(0, minR - M), maxR: Math.min(CANVAS - 1, maxR + M),
             minC: Math.max(0, minC - M), maxC: Math.min(CANVAS - 1, maxC + M) };
  };
  const buildWindow = (w) => {
    win = w; cellMap.clear(); gridBox.innerHTML = "";
    gridBox.style.setProperty("--n", w.maxC - w.minC + 1);
    for (let r = w.minR; r <= w.maxR; r++) for (let c = w.minC; c <= w.maxC; c++) {
      const el = document.createElement("div");
      el.className = "pl-cell";
      el.onclick = (ev) => apply(r, c, ev);        // 클릭만 (드래그 없음)
      el.onmouseenter = () => showDetail(r, c);    // hover 상세
      cellMap.set(r + ":" + c, el);
      gridBox.appendChild(el);
    }
  };

  const emitterOf = (cell) => {
    if (!cell) return null;
    const id = cell.p || cell.orn;
    return id && EMIT[id] ? { id, emit: EMIT[id], e: cell.e || 0 } : null;
  };
  const plantAt = (r, c) => { const z = grid[r][c]; return z && z.p ? z : null; };
  const effectivePlantAt = (r, c) => virtualPollMap.get(`${r}:${c}`)?.clone || plantAt(r, c);
  const ornAt = (r, c) => { const z = grid[r][c]; return z && z.orn ? z : null; };
  const crystalLineBonus = (r, c, z, lookup) => {
    const pid = z?.p;
    if (!pid) return 0;
    const cellRef = (y, x) => {
      const plant = lookup(y, x);
      if (plant) return plant;
      return grid[y]?.[x] ? {} : null;
    };
    const filled = (line) => {
      const first = line.findIndex((cell) => cell !== null);
      if (first < 0) return false;
      let last = line.length - 1;
      while (last >= first && line[last] === null) last--;
      const segment = line.slice(first, last + 1);
      return segment.length >= 2 && segment.every((cell) => cell?.p === pid);
    };
    const row = Array.from({ length: CANVAS }, (_, x) => cellRef(r, x));
    const col = Array.from({ length: CANVAS }, (_, y) => cellRef(y, c));
    return (filled(row) ? 1 : 0) + (filled(col) ? 1 : 0);
  };

  // 조건맵 (범위: 이슬뿌리+뿌리지배, 맥읽기=강화만큼)
  const buildConds = () => {
    condMap = Array.from({ length: CANVAS }, () => Array.from({ length: CANVAS }, () => new Set()));
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) {
      const em = emitterOf(grid[r][c]);
      if (!em) continue;
      let range = 1;
      if (em.id === "dew_root") range += opt.rootDom;
      if (opt.vein && em.e > 0) range += em.e;
      for (let dr = -range; dr <= range; dr++) for (let dc = -range; dc <= range; dc++) {
        if ((dr === 0 && dc === 0) || Math.abs(dr) + Math.abs(dc) > range) continue;
        const y = r + dr, x = c + dc;
        if (y < 0 || y >= CANVAS || x < 0 || x >= CANVAS) continue;
        condMap[y][x].add(em.emit);
      }
    }
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) {
      (grid[r][c]?.cond || []).forEach((x) => condMap[r][c].add(x));
      const floor = grid[r][c]?.floor;
      if (floor === "water_channel") condMap[r][c].add("humid");
      else if (floor === "lava_channel") {
        condMap[r][c].add("arid");
      }
      if (opt.zone === "misty_swamp") condMap[r][c].add("humid");
      if (condMap[r][c].has("arid")) condMap[r][c].delete("humid");
    }
  };

  const plantConds = (cell, cond) => {
    const pc = new Set(cell?.plantCond || []);
    if (cell?.p === "poison_flower") pc.add("poison_immune");
    if ((cond?.has("poisonous") || cond?.has("toxic")) && !pc.has("poison_immune")) pc.add("poisoned");
    if (pc.has("poison_immune") && cell?.p !== "nightshade_sprout") pc.delete("poisoned");
    return pc;
  };

  // 바람꽃 수분 경로 (4방향 직선) — 거리는 고정(수분레벨), 맥읽기는 범위 아닌 번식작물 강화도에 영향
  const POLL_REACH = 2; // 수분레벨1(이웃 탐색) + 1(복제 위치)
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const pollSet = () => {
    const s = new Set();
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) {
      const z = plantAt(r, c);
      if (!z || z.p !== "wind_blossom") continue;
      for (const [dr, dc] of DIRS)
        for (let k = 1; k <= POLL_REACH; k++) {
          const y = r + dr * k, x = c + dc * k;
          if (y < 0 || y >= CANVAS || x < 0 || x >= CANVAS) break;
          s.add(y * CANVAS + x);
        }
    }
    return s;
  };

  const nbrs = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < CANVAS && x >= 0 && x < CANVAS);
  const statFor = (r, c, z, lookup = plantAt) => {
    if (!z) return null;
    const P = plants[z.p];
    const cond = (condMap && condMap[r][c]) || new Set();
    const plantCond = plantConds(z, cond);
    const nb = nbrs(r, c).map(([y, x]) => lookup(y, x)).filter(Boolean);
    const same = nb.filter((x) => x.p === z.p).length;
    const diversity = new Set(nb.map((x) => x.p)).size;
    const zc = zoneCoeff(opt);
    const crystalBonus = opt.zone === "crystal_mine" ? crystalLineBonus(r, c, z, lookup) : 0;
    const m = multiplier(z.p, cond, plantCond, same, diversity, opt, P.oneShot, crystalBonus);
    const prod = (P.produces || [])[0];
    const poisonFed = plantCond.has("poisoned") || cond.has("toxic") || cond.has("poisonous");
    const gated = z.p === "nightshade_sprout" && !(cond.has("humid") && poisonFed);
    const waterKilled = opt.zone !== "advanced_volcano" && waterKills(z.p, P) && cond.has("humid");
    const aridBlocked = cond.has("arid") && z.p !== "fire_vine";
    const toxicBlocked = cond.has("toxic") && !poisonResistant(z.p, plantCond);
    const poisonPaused = plantCond.has("poisoned") && z.p !== "nightshade_sprout" && opt.zone !== "poison_jungle";
    const paused = waterKilled || aridBlocked || toxicBlocked || plantCond.has("frozen") || poisonPaused;
    // 통합 공식: 한 생애 maxHarvests개를 (성장시간 + maxHarvests×생산간격) 동안 생산 (재배 반복 가정)
    // → 간격 큰 작물(밤그늘뿌리=1시간)은 간격 제한, 간격 작은 작물(약초)은 성장시간 제한이 자동 적용
    // 스킬: 시간숙련(생산간격↓), 토양숙련(성장시간↓) — (1-rate×Lv)^(강화+1) 곱연산
    const e1 = (z.e || 0) + 1;
    const intervalEff = (prod?.interval_ms || 0) * Math.pow(Math.max(0, 1 - 0.01 * opt.timeM), e1);
    const growEff = P.growTime_ms * Math.pow(Math.max(0, 1 - 0.05 * opt.soilM), e1) * (cond.has("fertile") ? 0.5 : 1);
    const baseH = (P.maxHarvests == null || !isFinite(P.maxHarvests)) ? 1e9 : P.maxHarvests;
    // 단단한 줄기: 강화 작물(e>0)의 최대생산 ×(강화+1)
    const sturdyHarvests = (opt.sturdy && (z.e || 0) > 0 && isFinite(baseH)) ? baseH * ((z.e || 0) + 1) : baseH;
    const harvests = opt.zone === "golden_fields" && isFinite(sturdyHarvests)
      ? Math.floor(sturdyHarvests * (1 + 0.5 * zc))
      : sturdyHarvests;
    const cycle = growEff + harvests * intervalEff;
    const yieldMul = m * plentyMultiplier(opt) * (opt.uptime / 100); // 풍요의손길 · 가동률
    const perHour = prod && !gated && !paused && cycle > 0 ? (harvests / cycle) * 3600000 * yieldMul : 0;
    return {
      ...z, P, cond, plantCond, same, diversity, crystalBonus, m, prod, gated, paused,
      zoneCoeff: zc,
      dryBlocked: aridBlocked, aridBlocked, toxicBlocked,
      waterKilled, fireProtected: waterKills(z.p, P) && cond.has("arid"),
      perHour, harvests, growEff,
    };
  };
  const stat = (r, c) => statFor(r, c, effectivePlantAt(r, c), effectivePlantAt);
  const autoHarvestBlocked = (st) => st?.cond?.has("anti_magic") || st?.plantCond?.has("anti_magic");
  const propagatedEnh = (src, wind) => opt.vein ? Math.min(src.e || 0, wind.e || 0) : 0;
  const pollTargets = () => {
    const targets = new Map();
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) {
      const wind = plantAt(r, c);
      if (!wind || wind.p !== "wind_blossom") continue;
      for (const [dr, dc] of DIRS) {
        const sr = r + dr, sc = c + dc;
        if (sr < 0 || sr >= CANVAS || sc < 0 || sc >= CANVAS) continue;
        const src = plantAt(sr, sc);
        if (!src || src.p === "wind_blossom") continue;
        const tr = sr + dr, tc = sc + dc;
        if (tr < 0 || tr >= CANVAS || tc < 0 || tc >= CANVAS) continue;
        const tcell = grid[tr]?.[tc];
        if (!tcell || tcell.p || tcell.orn) continue;
        const key = `${tr}:${tc}`;
        if (targets.has(key)) continue;
        const plantCond = PLANT_COND_ORDER.filter((x) => (src.plantCond || []).includes(x) || (tcell.plantCond || []).includes(x));
        if (plantCond.includes("poison_immune")) {
          const ix = plantCond.indexOf("poisoned");
          if (ix >= 0) plantCond.splice(ix, 1);
        }
        targets.set(key, {
          tr, tc, sr, sc, wind, src,
          clone: { p: src.p, e: propagatedEnh(src, wind), ...(plantCond.length ? { plantCond } : {}) },
        });
      }
    }
    return targets;
  };

  const recompute = () => {
    buildConds();
    virtualPollMap = pollTargets();
    const want = computeWin();
    const changed = !win || win.minR !== want.minR || win.maxR !== want.maxR || win.minC !== want.minC || win.maxC !== want.maxC;
    if (changed) buildWindow(want);
    const poll = pollSet();
    const totals = {};
    let planted = 0, tilled = 0;
    let blockedProduction = 0;
    const showSlots = mode === "till" && hasField();
    for (let r = win.minR; r <= win.maxR; r++) for (let c = win.minC; c <= win.maxC; c++) {
      const el = cellMap.get(r + ":" + c); el.className = "pl-cell"; el.innerHTML = "";
      const z = grid[r][c];
      if (!z) { if (showSlots && adjField(r, c)) el.classList.add("expand-slot"); continue; }
      el.classList.add("tilled"); tilled++;
      // 표면 바닥재 (작물 아래) — CSS 석판 텍스처 (스프라이트는 iso라 평면뷰서 회전돼 보임)
      if (z.floor) { const fl = document.createElement("span"); fl.className = "pl-floor"; itemIcon(fl, z.floor); el.appendChild(fl); }
      // 경계 울타리/장벽
      if (z.fences) {
        const fc = document.createElement("span"); fc.className = "pl-fences";
        for (const [s, type] of Object.entries(z.fences)) fc.insertAdjacentHTML("beforeend", `<i class="pl-fc pl-fc-${s}${type === "root_barrier" ? " bar" : ""}"></i>`);
        el.appendChild(fc);
      }
      // 조건 테두리
      // 조건 효과: 여러 개면 색 테두리를 중첩(2/4/6/8px)으로 모두 표시 (바닥재 위)
      const cm = condMap[r][c];
      const conds = cm && cm.size ? COND_ORDER.filter((cc) => cm.has(cc)) : [];
      if (conds.length) {
        const cs = document.createElement("span"); cs.className = "pl-conds";
        cs.style.boxShadow = conds.map((cc, i) => `inset 0 0 0 ${2 * (i + 1)}px ${COND_COLOR[cc]}`).join(", ");
        el.appendChild(cs);
      }
      if (poll.has(r * CANVAS + c)) el.classList.add("poll");
      if (z.orn) {
        const ic = document.createElement("span"); ic.className = "pl-cic"; itemIcon(ic, z.orn); el.appendChild(ic);
        if (z.orn === PEDESTAL && z.display) {   // 전시대 위 아이템
          const di = document.createElement("span"); di.className = "pl-disp"; itemIcon(di, z.display); el.appendChild(di);
        }
        el.classList.add("isorn");
        continue;
      }
      const plant = z.p ? z : virtualPollMap.get(`${r}:${c}`)?.clone;
      if (!plant) continue;
      if (!z.p) el.classList.add("poll-clone");
      planted++;
      const st = statFor(r, c, plant, effectivePlantAt);
      const ic = document.createElement("span"); ic.className = "pl-cic";
      const visual = plantVisual(st);
      ic.style.setProperty("--pl-filter", visual.filter);
      ic.style.setProperty("--pl-aura", visual.aura);
      ic.style.setProperty("--pl-aura-opacity", visual.auraOpacity);
      plantIconFx(ic, plantSpriteKeys(plant.p, plants[plant.p].spriteKey || plant.p, st));
      el.appendChild(ic);
      if (st.gated) el.classList.add("gated");
      if (st.paused) el.classList.add("paused");
      for (const cc of conds) el.classList.add(`soil-${cc}`);
      const pc = PLANT_COND_ORDER.filter((x) => st.plantCond.has(x));
      for (const cc of pc) el.classList.add(`plant-${cc}`);
      if (pc.length) {
        const pe = document.createElement("span"); pe.className = "pl-peffs";
        pe.innerHTML = pc.map((x) => `<i title="${PLANT_COND_KR[x]}" style="background:${PLANT_COND_COLOR[x]}"></i>`).join("");
        el.appendChild(pe);
      }
      if (plant.e > 0) el.insertAdjacentHTML("beforeend", `<span class="pl-enhb">+${plant.e}</span>`);
      if (st.m !== 1 && st.prod) el.insertAdjacentHTML("beforeend",
        `<span class="pl-mult ${st.m > 1 ? "up" : "down"}">×${st.m.toFixed(st.m < 10 ? 1 : 0)}</span>`);
      if (st.perHour > 0 && (z.p || !st.P.oneShot)) {
        if (autoHarvestBlocked(st)) blockedProduction++;
        else totals[st.prod.itemCode] = (totals[st.prod.itemCode] || 0) + st.perHour;
      }
    }
    renderSummary(totals, planted, tilled, blockedProduction);
    renderPollSum();
  };

  const renderSummary = (totals, planted, tilled, blockedProduction = 0) => {
    const ent = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    let html = `<h3>생산 요약 <small>(개간 ${tilled} · 작물 ${planted} · 자동수확 기준 · 시간당)</small></h3>`;
    if (!ent.length) html += `<p class="muted">생산물 없음</p>`;
    else html += `<div class="pl-sum-list">${ent.map(([code, n]) =>
      `<div class="pl-sum"><span class="pl-sic" data-ic="${code}"></span>
        <span class="pl-sname">${g.items?.[code]?.name || code}</span><b>${n.toFixed(1)}/시간</b></div>`).join("")}</div>`;
    if (blockedProduction > 0) {
      html += `<p class="muted">항마가 깔린 작물 ${blockedProduction}칸은 자동수확 제외로 생산 요약에서 뺐습니다.</p>`;
    }
    summary.innerHTML = html;
    summary.querySelectorAll(".pl-sic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
  };

  // 바람꽃 수분 기반 약초·버섯 자동화 생산 (60초 주기, 항마 보호 원천 + 너머 빈칸 필요)
  const pollProduction = () => {
    const out = {};
    if (!grid.flat().some((z) => z && z.p === "wind_blossom")) return out;
    const windZoneMult = opt.zone === "wind_corridor" ? Math.max(0.01, 1 - 0.1 * zoneCoeff(opt)) : 1;
    const cyclesPerHour = 3600000 / (60000 * (opt.gust ? 0.5 : 1) * windZoneMult); // 질풍포션 → 2배속
    for (const { src, sr, sc, clone } of pollTargets().values()) {
      const sp = plants[src.p];
      if (!sp.oneShot || !sp.produces[0]) continue;          // 약초·버섯류만 (수분 자동화)
      const srcCond = condMap[sr][sc] || new Set();
      const srcPlantCond = plantConds(src, srcCond);
      if (!(srcCond.has("anti_magic") || srcPlantCond.has("anti_magic"))) continue; // 원천은 항마 보호 필요
      const code = sp.produces[0].itemCode;
      // 풍요의 손길(수확 2배 확률) · 가동률 적용
      const srcH = (sp.maxHarvests || 1) * (opt.sturdy && (clone.e || 0) > 0 ? (clone.e || 0) + 1 : 1);  // 단단한 줄기
      out[code] = (out[code] || 0) + srcH * cyclesPerHour * plentyMultiplier(opt) * (opt.uptime / 100);
    }
    return out;
  };
  const renderPollSum = () => {
    const autoOut = pollProduction();
    const autoEnt = Object.entries(autoOut).sort((a, b) => b[1] - a[1]);
    if (!autoEnt.length) { pollsum.innerHTML = ""; return; }
    pollsum.innerHTML = `<h3>🌾 약초/버섯 수분 자동화 <small>(60초 주기 · 시간당)</small></h3>` +
      `<div class="pl-sum-list">${autoEnt.map(([code, n]) =>
        `<div class="pl-sum"><span class="pl-sic" data-ic="${code}"></span>
          <span class="pl-sname">${g.items?.[code]?.name || code}</span><b>${n.toFixed(1)}/시간</b></div>`).join("")}</div>`;
    pollsum.querySelectorAll(".pl-sic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
  };

  const soilCondTxt = (cond) => [...(cond || [])].map((x) => COND_KR[x] || x).join(", ") || "없음";
  const plantCondTxt = (pc) => [...(pc || [])].map((x) => PLANT_COND_KR[x] || x).join(", ") || "없음";

  const showDetail = (r, c) => {
    const cell = grid[r][c];
    const orn = ornAt(r, c);
    if (orn) {
      const eff = EMIT[orn.orn] ? `<div class="d-row">효과 <b>${COND_KR[EMIT[orn.orn]]} 부여</b></div>`
        : ORN_NOTE[orn.orn] ? `<div class="d-row">${ORN_NOTE[orn.orn]}</div>`
        : `<div class="d-row muted">장식 (효과 없음)</div>`;
      let html = `<h3>${ORN[orn.orn]}</h3>${eff}<div class="d-row">토양 효과 <b>${soilCondTxt(condMap?.[r]?.[c] || new Set())}</b></div>`;
      if (orn.orn === PEDESTAL) {   // 전시대 위에 올릴 아이템 선택
        html += `<div class="d-row">전시 아이템 <select id="pl-disp-sel">
          <option value="">— 없음 —</option>
          ${DISPLAY_ITEMS.map(([code, name]) => `<option value="${code}"${orn.display === code ? " selected" : ""}>${name}</option>`).join("")}
        </select></div>`;
      }
      detail.innerHTML = html;
      const sel = detail.querySelector("#pl-disp-sel");
      if (sel) sel.onchange = (e) => { grid[r][c].display = e.target.value || undefined; recompute(); save(); };
      return;
    }
    const st = stat(r, c);
    if (!st) {
      const soil = cell ? `<div class="d-row">토양 효과 <b>${soilCondTxt(condMap?.[r]?.[c] || new Set())}</b></div>` : "";
      detail.innerHTML = `<h3>칸 정보</h3><p class="muted">${cell ? "개간된 빈 흙" : "미개간 칸"}</p>${soil}`;
      return;
    }
    let lines = `<div class="d-row">토양 효과 <b>${soilCondTxt(st.cond)}</b></div>
      <div class="d-row">식물 상태 <b>${plantCondTxt(st.plantCond)}</b></div>
      <div class="d-row">같은 이웃 <b>${st.same}</b> · 이웃 종류 <b>${st.diversity}</b>${st.P.oneShot ? ' <span class="muted">(과밀 면제)</span>' : st.crystalBonus > 0 ? ' <span class="muted">(수정갱도 한 줄 · 과밀 무시)</span>' : ""}</div>
      <div class="d-row">생산 배율 <b class="${st.m > 1 ? "up" : st.m < 1 ? "down" : ""}">×${st.m.toFixed(2)}</b></div>`;
    if (st.crystalBonus > 0) lines += `<div class="d-row up">수정갱도 배치 <b>+${Math.round(st.crystalBonus * 20 * st.zoneCoeff)}%</b> <span class="muted">(계수 ${st.zoneCoeff.toFixed(2)})</span></div>`;
    if (st.fireProtected) lines += `<div class="d-row up">사막화로 물 공급 차단 <span class="muted">(불씨덩굴 보호)</span></div>`;
    if (st.prod) {
      const blocked = autoHarvestBlocked(st);
      const inf = st.P.maxHarvests == null || !isFinite(st.P.maxHarvests);
      const boosted = opt.sturdy && (st.e || 0) > 0 && !inf;
      const life = inf ? "무한"
        : boosted ? `${st.P.maxHarvests}회 → <b class="up">${Math.round(st.harvests)}회</b> <span class="muted">(단단한 줄기 ×${(st.e || 0) + 1})</span>`
        : `${Math.round(st.harvests)}회`;
      lines += st.prod.interval_ms >= 1000
        ? `<div class="d-row">생산주기 <b>${fmtDuration(st.prod.interval_ms)}</b> · 수명 ${life}</div>`
        : `<div class="d-row">즉시생산 <span class="muted">(성장 ${fmtDuration(st.growEff)})</span> · 수명 ${life}</div>`;
      const pauseWhy = st.waterKilled
        ? "물 공급(불씨덩굴 물 취약)"
        : st.aridBlocked
        ? "사막화(불씨덩굴 외 생산 불가)"
        : st.toxicBlocked
        ? "독성 토양"
        : st.plantCond.has("frozen")
          ? "결빙"
          : st.plantCond.has("poisoned") && st.p !== "nightshade_sprout"
            ? "중독"
            : "";
      lines += st.gated ? `<div class="d-row down">⚠️ 습기+중독 필요 (미충족 → 생산 0)</div>`
        : st.paused
          ? `<div class="d-row down">⚠️ ${pauseWhy} → 생산 0</div>`
        : blocked
          ? `<div class="d-row">항마 보호 <b class="down">자동수확 제외 · 생산요약 미포함</b></div>
             <div class="d-row">수동 기준 이론값 <b>${st.perHour.toFixed(1)}개/시간</b></div>`
          : `<div class="d-row">시간당 생산 <b class="up">${st.perHour.toFixed(1)}개</b>${st.P.oneShot ? ' <span class="muted">(성장주기 기준 이론 최대 · 실제는 바람꽃 60초 수분에 제한, 바람꽃당 ~240/h)</span>' : ""}</div>`;
    } else lines += `<div class="d-row muted">생산물 없음 (지원 작물)</div>`;
    detail.innerHTML = `<h3>${st.P.name}${st.e > 0 ? ` <span class="pl-enhb-inl">+${st.e}</span>` : ""}</h3>${lines}`;
  };

  const setMode = (m) => {
    mode = m;
    view.querySelectorAll(".pl-modes button").forEach((b) => b.classList.toggle("active", b.dataset.m === m));
    palBox.style.display = ornBox.style.display = m === "plant" ? "" : "none";
    effBox.style.display = m === "effect" ? "" : "none";
    view.querySelector(".pl-enh").style.display = m === "plant" ? "" : "none";
    hint.textContent = m === "till"
      ? "밭에 인접한 칸만 확장 가능 (점선=확장 가능) · 클릭으로 제거"
      : m === "effect"
        ? "효과를 선택하고 개별 타일을 클릭해 토양·식물 상태 토글"
        : "흙 위에 작물·장식물 배치";
    recompute();
  };
  view.querySelectorAll(".pl-modes button[data-m]").forEach((b) => b.onclick = () => setMode(b.dataset.m));
  const isoBtn = view.querySelector("#pl-iso");
  isoBtn.onclick = () => {
    const on = gridBox.classList.toggle("iso");
    gridBox.parentElement.classList.toggle("iso-scroll", on);
    isoBtn.classList.toggle("active", on);
    isoBtn.textContent = on ? "🔲 평면 보기" : "📐 입체 보기";
  };
  // 확대/축소 (셀 크기)
  let zoom = 34;
  const setZoom = (z) => { zoom = Math.max(16, Math.min(64, z)); gridBox.style.setProperty("--cell", zoom + "px"); };
  view.querySelector("#pl-zoomin").onclick = () => setZoom(zoom + 6);
  view.querySelector("#pl-zoomout").onclick = () => setZoom(zoom - 6);
  view.querySelector("#pl-enh").oninput = (e) => { enh = +e.target.value; view.querySelector("#pl-enhv").textContent = enh; };
  view.querySelector("#pl-harvest").onchange = (e) => { opt.harvest = e.target.checked; recompute(); };
  view.querySelector("#pl-resist").oninput = (e) => { opt.resist = +e.target.value; view.querySelector("#pl-resistv").textContent = opt.resist; recompute(); };
  const updateZoneCoeff = () => {
    view.querySelector("#pl-zone-coeff").textContent = zoneCoeff(opt).toFixed(2);
    view.querySelector("#pl-zone-note").innerHTML = zoneNoteHtml(opt);
    recompute();
  };
  view.querySelector("#pl-zone").onchange = (e) => { opt.zone = e.target.value; updateZoneCoeff(); };
  view.querySelector("#pl-familiar").oninput = (e) => { opt.familiar = +e.target.value; view.querySelector("#pl-familiarv").textContent = opt.familiar; updateZoneCoeff(); };
  view.querySelector("#pl-fog").onchange = (e) => { opt.fog = e.target.checked; updateZoneCoeff(); };
  view.querySelector("#pl-raid").onchange = (e) => { opt.raid = e.target.checked; updateZoneCoeff(); };
  view.querySelector("#pl-root").oninput = (e) => { opt.rootDom = +e.target.value; view.querySelector("#pl-rootv").textContent = opt.rootDom; recompute(); };
  view.querySelector("#pl-vein").onchange = (e) => { opt.vein = e.target.checked; recompute(); };
  view.querySelector("#pl-sturdy").onchange = (e) => { opt.sturdy = e.target.checked; recompute(); };
  view.querySelector("#pl-gust").onchange = (e) => { opt.gust = e.target.checked; recompute(); };
  const skSlider = (id, key) => view.querySelector(id).oninput = (e) => {
    opt[key] = +e.target.value; view.querySelector(id + "v").textContent = e.target.value; recompute();
  };
  skSlider("#pl-time", "timeM"); skSlider("#pl-soil", "soilM"); skSlider("#pl-plenty", "plenty"); skSlider("#pl-uptime", "uptime");
  // 밭 프리셋: 초기 5×5(25칸) → 다이아몬드 확장. 추가칸 = 링 4r (r4:+16, r5:+20, r6:+24, r7:+28)
  // 누적: 25 → 41 → 61 → 85 → 113, 강화석 비용 = max(0, 중심거리-3)
  const CTR = CENTER;
  const inBase = (r, c) => Math.abs(r - CTR) <= 2 && Math.abs(c - CTR) <= 2;        // 초기 5×5
  const inStage = (r, c, R) => inBase(r, c) || (R > 0 && Math.abs(r - CTR) + Math.abs(c - CTR) <= R);
  const stageTiles = (R) => { let n = 0; for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) if (inStage(r, c, R)) n++; return n; };
  const costOf = (R) => { // 단계(링)별 각인석: r단계 = 각인석 (r-3)강 × 그 링의 추가 타일 수
    const t = {};
    for (let r = 4; r <= R; r++) {
      const prev = r === 4 ? stageTiles(0) : stageTiles(r - 1);
      const added = stageTiles(r) - prev;
      if (added > 0) t[r - 3] = added;
    }
    return t;
  };
  const STAGES = [[0, "기본 5×5"], [4, "1단계"], [5, "2단계"], [6, "3단계"], [7, "4단계"], [8, "5단계"], [9, "6단계"], [10, "7단계"], [11, "8단계"], [12, "9단계"], [13, "10단계"]];
  const presetSel = view.querySelector("#pl-preset");
  const costBox = view.querySelector("#pl-cost");
  presetSel.innerHTML = `<option value="">— 직접 배치 —</option>` +
    STAGES.map(([R, lbl]) => `<option value="${R}">${lbl} · ${stageTiles(R)}칸</option>`).join("");
  const applyPreset = (R) => {
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) {
      if (inStage(r, c, R)) { if (!grid[r][c]) grid[r][c] = { p: null }; }
      else grid[r][c] = null;
    }
    recompute(); save();
  };
  const showCost = (R, sel) => {
    if (!sel) { costBox.innerHTML = ""; return; }
    const ent = Object.entries(costOf(R)).sort((a, b) => a[0] - b[0]);
    const total = ent.reduce((s, [, n]) => s + n, 0);
    costBox.innerHTML = ent.length
      ? `<span class="cst-ic" data-ic="engraving_stone"></span> 각인석 ` + ent.map(([e, n]) => `<span class="cstg">${e}강<i>×${n}</i></span>`).join(" ") + ` <span class="muted">(총 ${total})</span>`
      : `<span class="muted">기본 밭 (각인석 0)</span>`;
    costBox.querySelectorAll(".cst-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
  };
  presetSel.onchange = () => { const v = presetSel.value; if (v === "") return showCost(0, false); applyPreset(+v); showCost(+v, true); };

  view.querySelector("#pl-clear").onclick = () => { grid = blank(); recompute(); save(); presetSel.value = ""; showCost(0, false); };
  view.querySelector("#pl-fill").onclick = () => {
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) if (!grid[r][c]) grid[r][c] = { p: null };
    recompute(); save();
  };

  setMode("plant");
  recompute();
  detail.innerHTML = `<h3>칸 정보</h3><p class="muted">칸에 마우스를 올리면 상세가 표시됩니다</p>`;
  // 공유 링크로 열었으면 내 플래너에 저장하고 URL 정리
  if (new URLSearchParams(location.search).get("plan")) {
    save();
    try { history.replaceState(null, "", location.pathname + location.hash); } catch {}
  }

  function blank() { return Array.from({ length: CANVAS }, () => Array(CANVAS).fill(null)); }
  function defaultGrid() {
    const gg = blank();
    for (let r = 11; r <= 15; r++) for (let c = 11; c <= 15; c++) gg[r][c] = { p: null }; // 초기 5×5 (중심 13,13)
    return gg;
  }
  function load() {
    const p = new URLSearchParams(location.search).get("plan");
    if (p) { const g0 = decodeGrid(p); if (g0) return normalizeGrid(g0); }     // 공유 링크
    try { const a = JSON.parse(localStorage.getItem(STORE)); if (Array.isArray(a) && a.length === CANVAS) return normalizeGrid(a); } catch {}
    return defaultGrid();
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(grid)); } catch {} }
  function normalizeGrid(g) {
    for (const row of g) for (const cell of row || []) {
      if (!cell) continue;
      if (cell.orn === LEGACY_PEDESTAL) cell.orn = PEDESTAL;
      cell.cond = COND_ORDER.filter((x) => Array.isArray(cell.cond) && cell.cond.includes(x));
      if (!cell.cond.length) delete cell.cond;
      cell.plantCond = PLANT_COND_ORDER.filter((x) => Array.isArray(cell.plantCond) && cell.plantCond.includes(x));
      if (!cell.plantCond.length) delete cell.plantCond;
    }
    return g;
  }

  // ── 배치 압축 인코딩 (바이너리 → url-safe base64). v2: 바닥재·울타리, v3: 전시대 전시 아이템, v4: 포션 효과 ──
  function encodeGrid() {
    let minR = CANVAS, maxR = -1, minC = CANVAS, maxC = -1;
    for (let r = 0; r < CANVAS; r++) for (let c = 0; c < CANVAS; c++) if (grid[r][c]) {
      if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c;
    }
    if (maxR < 0) return "";
    const h = maxR - minR + 1, w = maxC - minC + 1, pl = [], orn = [], disp = [], vals = [], floors = [], fences = [], dispVals = [], soilVals = [], plantVals = [];
    let hasFloor = false, hasFence = false, hasDisp = false, hasSoilFx = false, hasPlantFx = false;
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) {
      const z = grid[r][c];
      if (!z) vals.push(0);
      else if (z.orn) { let i = orn.indexOf(z.orn); if (i < 0) { i = orn.length; orn.push(z.orn); } vals.push(200 + i); }
      else if (z.p) { let i = pl.indexOf(z.p); if (i < 0) { i = pl.length; pl.push(z.p); } vals.push(2 + i * 13 + Math.min(12, z.e || 0)); }
      else vals.push(1);
      const fv = z && z.floor ? FLOOR_ORDER.indexOf(z.floor) + 1 : 0; floors.push(fv); if (fv) hasFloor = true;
      let fb = 0; if (z && z.fences) SIDES.forEach((s, k) => { if (z.fences[s]) fb |= (FENCE_ORDER.indexOf(z.fences[s]) + 1) << (k * 2); });
      fences.push(fb); if (fb) hasFence = true;
      let dv = 0; if (z && z.display) { let di = disp.indexOf(z.display); if (di < 0) { di = disp.length; disp.push(z.display); } dv = di + 1; hasDisp = true; }
      dispVals.push(dv);
      let sv = 0; if (z?.cond) COND_ORDER.forEach((cc, k) => { if (z.cond.includes(cc)) sv |= 1 << k; });
      soilVals.push(sv); if (sv) hasSoilFx = true;
      let pv = 0; if (z?.plantCond) PLANT_COND_ORDER.forEach((cc, k) => { if (z.plantCond.includes(cc)) pv |= 1 << k; });
      plantVals.push(pv); if (pv) hasPlantFx = true;
    }
    const flags = (hasFloor ? 1 : 0) | (hasFence ? 2 : 0) | (hasDisp ? 4 : 0) | (hasSoilFx ? 8 : 0) | (hasPlantFx ? 16 : 0);
    const ver = (hasSoilFx || hasPlantFx) ? 4 : hasDisp ? 3 : 2;
    const bytes = [ver, minR, minC, h, w, flags, pl.length];
    const wrStr = (id) => { bytes.push(id.length); for (const ch of id) bytes.push(ch.charCodeAt(0)); };
    for (const id of pl) wrStr(id);
    bytes.push(orn.length); for (const id of orn) wrStr(id);
    vals.forEach((v) => bytes.push(v));
    if (hasFloor) floors.forEach((v) => bytes.push(v));
    if (hasFence) fences.forEach((v) => bytes.push(v));
    if (hasDisp) { bytes.push(disp.length); for (const id of disp) wrStr(id); dispVals.forEach((v) => bytes.push(v)); }
    if (hasSoilFx) soilVals.forEach((v) => bytes.push(v));
    if (hasPlantFx) plantVals.forEach((v) => bytes.push(v));
    let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeGrid(str) {
    let bin;
    try { bin = atob(str.replace(/-/g, "+").replace(/_/g, "/")); } catch { return null; }
    const b = []; for (let k = 0; k < bin.length; k++) b.push(bin.charCodeAt(k));
    let i = 0;
    const ver = b[i++];
    if (ver < 1 || ver > 4) return null;
    const minR = b[i++], minC = b[i++], h = b[i++], w = b[i++];
    const flags = ver >= 2 ? b[i++] : 0;
    const pl = [], orn = [];
    const rd = (arr) => { const n = b[i++]; for (let k = 0; k < n; k++) { const len = b[i++]; let s = ""; for (let j = 0; j < len; j++) s += String.fromCharCode(b[i++]); arr.push(s); } };
    rd(pl); rd(orn);
    const g = blank(); const cells = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const v = b[i++], gr = minR + r, gc = minC + c;
      cells.push([gr, gc]);
      if (gr >= CANVAS || gc >= CANVAS || v == null || v === 0) continue;
      if (v === 1) g[gr][gc] = { p: null };
      else if (v >= 200) g[gr][gc] = { orn: orn[v - 200] };
      else g[gr][gc] = { p: pl[Math.floor((v - 2) / 13)], e: (v - 2) % 13 };
    }
    if (flags & 1) cells.forEach(([gr, gc]) => { const fv = b[i++]; if (fv && g[gr] && g[gr][gc]) g[gr][gc].floor = FLOOR_ORDER[fv - 1]; });
    if (flags & 2) cells.forEach(([gr, gc]) => {
      const fb = b[i++]; if (!fb || !(g[gr] && g[gr][gc])) return;
      const f = {}; SIDES.forEach((s, k) => { const sv = (fb >> (k * 2)) & 3; if (sv) f[s] = FENCE_ORDER[sv - 1]; });
      if (Object.keys(f).length) g[gr][gc].fences = f;
    });
    if (ver >= 3 && (flags & 4)) {   // 전시대 전시 아이템
      const disp = []; rd(disp);
      cells.forEach(([gr, gc]) => { const dv = b[i++]; if (dv && g[gr] && g[gr][gc]) g[gr][gc].display = disp[dv - 1]; });
    }
    if (ver >= 4 && (flags & 8)) cells.forEach(([gr, gc]) => {
      const sv = b[i++]; if (!sv || !(g[gr] && g[gr][gc])) return;
      g[gr][gc].cond = COND_ORDER.filter((cc, k) => sv & (1 << k));
    });
    if (ver >= 4 && (flags & 16)) cells.forEach(([gr, gc]) => {
      const pv = b[i++]; if (!pv || !(g[gr] && g[gr][gc])) return;
      g[gr][gc].plantCond = PLANT_COND_ORDER.filter((cc, k) => pv & (1 << k));
    });
    return g;
  }

  // ── 저장 슬롯 ──
  const SLOTS = "alc_planner_slots";
  const getSlots = () => { try { return JSON.parse(localStorage.getItem(SLOTS)) || {}; } catch { return {}; } };
  const setSlots = (s) => { try { localStorage.setItem(SLOTS, JSON.stringify(s)); } catch {} };
  const slotsBox = view.querySelector("#pl-slots");
  const renderSlots = () => {
    const s = getSlots(), names = Object.keys(s);
    slotsBox.innerHTML = names.length ? names.map((n) =>
      `<div class="pl-slot"><span class="pl-slot-n">${n}</span><button data-load="${encodeURIComponent(n)}">불러오기</button><button data-del="${encodeURIComponent(n)}" class="pl-slot-del">✕</button></div>`).join("")
      : `<p class="muted" style="padding:4px 0">저장된 배치 없음</p>`;
    slotsBox.querySelectorAll("[data-load]").forEach((b) => b.onclick = () => {
      const code = getSlots()[decodeURIComponent(b.dataset.load)];
      let g0; try { g0 = code[0] === "[" ? JSON.parse(code) : decodeGrid(code); } catch { g0 = decodeGrid(code); }
      if (g0) { grid = normalizeGrid(g0); recompute(); save(); }
    });
    slotsBox.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      const s2 = getSlots(); delete s2[decodeURIComponent(b.dataset.del)]; setSlots(s2); renderSlots();
    });
  };
  view.querySelector("#pl-save-btn").onclick = () => {
    const inp = view.querySelector("#pl-slotname");
    const name = (inp.value || "").trim() || "배치 " + (Object.keys(getSlots()).length + 1);
    const s = getSlots(); s[name] = JSON.stringify(grid); setSlots(s); inp.value = ""; renderSlots(); // JSON(바닥·울타리 보존)
  };
  const shareUrl = () => {
    const code = encodeGrid();
    return location.origin + location.pathname + "?plan=" + code + "#planner";
  };
  const escAttr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const copyShare = async (text, okText) => {
    const msg = view.querySelector("#pl-share-msg");
    try { await navigator.clipboard.writeText(text); msg.textContent = okText; }
    catch { msg.innerHTML = `복사 실패 — 아래 내용 복사:<br><input class="pl-share-in" value="${escAttr(text)}" readonly onclick="this.select()">`; }
    setTimeout(() => { if (msg.textContent.startsWith("✅")) msg.textContent = ""; }, 4000);
  };
  view.querySelector("#pl-share-url").onclick = () => copyShare(shareUrl(), "✅ URL 복사됨! (붙여넣기로 공유)");
  view.querySelector("#pl-share-discord").onclick = () => {
    const url = shareUrl();
    copyShare(`[알칸시아 배치 보기](${url})`, "✅ Discord용 링크 복사됨!");
  };
  renderSlots();
}

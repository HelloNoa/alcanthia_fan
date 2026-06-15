import { gamedata, names } from "./api.js";
import { itemIcon, plantIcon, fmtDuration } from "./sprites.js";
import { advSim } from "./adventure.js";

export async function renderCalc(view, sub) {
  view.innerHTML = `<h2>🧮 계산기</h2>
    <nav class="subtabs" id="calccats">
      <button data-k="brew" class="active">⚗️ 양조 조합표</button>
      <button data-k="time">⏱️ 시간 계산</button>
      <button data-k="level">🌱 레벨 계산</button>
      <button data-k="ev">🎲 강화 기댓값</button>
      <button data-k="adv">⚔️ 모험 시뮬</button>
    </nav>
    <div id="calcbody"></div>`;
  const body = view.querySelector("#calcbody");
  const VIEWS = { time: timeCalc, level: levelCalc, brew: brewMatrix, ev: evCalc, adv: advSim };
  const sel = (k) => {
    location.hash = "calc/" + k;   // 새로고침 시 서브탭 유지
    view.querySelectorAll("#calccats button").forEach((b) => b.classList.toggle("active", b.dataset.k === k));
    (VIEWS[k] || brewMatrix)(body);
  };
  view.querySelectorAll("#calccats button").forEach((b) => b.onclick = () => sel(b.dataset.k));
  sel(VIEWS[sub] ? sub : "brew");   // 해시의 서브탭 복원 (없으면 양조 조합표)
}

// ---------- 양조 조합표 (매트릭스) ----------
async function brewMatrix(body) {
  const g = await gamedata();
  const N = await names();
  const recipes = g.brew_recipes || [];
  // 재료 등장 순서 유지
  const ings = [];
  for (const r of recipes) for (const c of r.inputs) if (!ings.includes(c)) ings.push(c);
  const map = {};
  for (const r of recipes) map[[...r.inputs].sort().join("|")] = r.output;
  const out = (a, b) => map[[a, b].sort().join("|")];

  body.innerHTML = `<p class="muted">재료 두 개의 교차점 = 결과 포션 (셀에 마우스 올리면 이름)</p>
    <div class="matrix-scroll"><table class="matrix"><thead><tr><th class="corner"></th>${
      ings.map((c) => `<th><span class="mx-ic" data-ic="${c}" title="${N.items?.[c] || c}"></span></th>`).join("")
    }</tr></thead><tbody>${
      ings.map((rc) => `<tr><th class="rowh"><span class="mx-ic" data-ic="${rc}" title="${N.items?.[rc] || rc}"></span><span class="mx-name">${N.items?.[rc] || rc}</span></th>${
        ings.map((cc) => {
          const o = out(rc, cc);
          if (!o) return `<td class="mx-empty"></td>`;
          return `<td title="${N.items?.[o] || o}"><span class="mx-ic mx-out" data-ic="${o}"></span><span class="mx-cell-name">${N.items?.[o] || o}</span></td>`;
        }).join("")
      }</tr>`).join("")
    }</tbody></table></div>`;

  // 아이콘 주입
  body.querySelectorAll(".mx-ic[data-ic]").forEach((el) => itemIcon(el, el.dataset.ic, "mxi"));
}

// ---------- 시간 계산 ----------
async function timeCalc(body) {
  const g = await gamedata();
  const plants = g.plants || {};
  const potions = Object.entries(g.items || {}).filter(([, it]) => it.type === "potion");

  body.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h3>🌱 작물 성장 시간</h3>
        <div class="calc-row">
          <select id="crop">${Object.entries(plants)
            .filter(([id, p]) => !/^aging_/.test(id) && !(p.name || "").includes("시험용"))
            .map(([id, p]) => `<option value="${id}">${p.name}</option>`).join("")}</select>
        </div>
        <div class="calc-row">
          <label class="lvlabel">토양 숙련 <input id="soil" type="range" min="0" max="10" value="0"><b id="soilv">0</b></label>
          <label class="lvlabel">씨앗 강화 <input id="seedE" type="range" min="0" max="12" value="0"><b id="seedEv">0</b></label>
        </div>
        <div id="cropOut" class="calc-out"></div>
        <p class="muted">성장시간 × (1 − 0.05×Lv)^(씨앗강화+1)</p>
      </div>
      <div class="calc-card">
        <h3>⚗️ 포션 양조 시간</h3>
        <div class="calc-row">
          <select id="pot">${potions.map(([c, it]) => `<option value="${c}">${it.name}</option>`).join("")}</select>
        </div>
        <div class="calc-row">
          <label class="lvlabel">불꽃 숙련 <input id="flame" type="range" min="0" max="10" value="0"><b id="flamev">0</b></label>
          <label class="lvlabel">가마솥 강화 <input id="cauE" type="range" min="0" max="20" value="0"><b id="cauEv">0</b></label>
          <label class="lvlabel">만들 포션 <input id="matE" type="range" min="0" max="20" value="0"><b id="matEv">0</b>강</label>
        </div>
        <div class="calc-row">
          <label class="lvlabel">양조 존
            <select id="zone">
              <option value="">기타 (×1)</option>
              <option value="sunset_cliff">석양절벽 (×2)</option>
              <option value="advanced_volcano">용암협곡 (−6%×지역효과)</option>
              <option value="beginner_forest">속삭이는 숲 (−10%×지역효과, 동일재료)</option>
            </select>
          </label>
          <label class="lvlabel">낯익은 터 <input id="famG" type="range" min="0" max="10" value="0"><b id="famGv">0</b></label>
          <label class="chk"><input type="checkbox" id="fog"> 안개 해방</label>
        </div>
        <div class="calc-row">
          <label class="chk"><input type="checkbox" id="firePot"> 화염포션 적용</label>
          <label class="lvlabel">화염포션 강화 <input id="fireE" type="range" min="0" max="20" value="0"><b id="fireEv">0</b>강</label>
        </div>
        <div id="potOut" class="calc-out"></div>
        <div class="calc-note">💡 N강 포션은 <b>(N−1)강 포션 2개를 합성</b>해 만듭니다.
        예) 9강을 만들려면 8강 포션 2개가 필요하고, 시간은 8강 기준(2⁸)으로 계산돼요.</div>
        <p class="muted">시간 = 포션 기본시간 × 2^(N−1) × (1−0.01×불꽃)^(가마솥강화+1) × 존배수 × 화염포션(선택)</p>
      </div>
    </div>`;

  // 포션 → 레시피 재료
  const recipeOf = {};
  for (const r of g.brew_recipes || []) recipeOf[r.output] = r.inputs;

  // factor = (1 - rate×Lv)^(enh+1)  — 게임의 vo() 공식
  const factor = (rate, lv, enh) => Math.pow(Math.max(0, 1 - rate * lv), enh + 1);

  const cropOut = () => {
    const id = body.querySelector("#crop").value;
    const lv = +body.querySelector("#soil").value, enh = +body.querySelector("#seedE").value;
    body.querySelector("#soilv").textContent = lv;
    body.querySelector("#seedEv").textContent = enh;
    const base = plants[id]?.growTime_ms;
    const adj = base != null ? base * factor(0.05, lv, enh) : null;
    const el = body.querySelector("#cropOut"); el.innerHTML = "";
    const ic = document.createElement("span"); ic.className = "calc-ic"; plantIcon(ic, plants[id]?.spriteKey || id);
    el.appendChild(ic);
    el.insertAdjacentHTML("beforeend",
      `<span class="t-base">${fmtDuration(base)}</span><span class="t-arrow">→</span><span class="t-adj">${fmtDuration(adj)}</span>`);
  };
  const zoneMult = (zone, cult, sameIng) => {
    if (zone === "sunset_cliff") return 2;
    if (zone === "advanced_volcano") return Math.max(0.01, 1 - 0.06 * cult);
    if (zone === "beginner_forest" && sameIng) return Math.max(0.01, 1 - 0.1 * cult);
    return 1;
  };
  const potOut = () => {
    const c = body.querySelector("#pot").value;
    const fl = +body.querySelector("#flame").value, ce = +body.querySelector("#cauE").value;
    const me = +body.querySelector("#matE").value;
    const famG = +body.querySelector("#famG").value, fog = body.querySelector("#fog").checked;
    const zone = body.querySelector("#zone").value;
    const fireOn = body.querySelector("#firePot").checked, fireE = +body.querySelector("#fireE").value;
    body.querySelector("#flamev").textContent = fl;
    body.querySelector("#cauEv").textContent = ce;
    body.querySelector("#matEv").textContent = me;
    body.querySelector("#famGv").textContent = famG;
    body.querySelector("#fireEv").textContent = fireE;
    // 지역 효과 배율 t = 낯익은터×0.1 + 안개해방
    const t = famG * 0.1 + (fog ? 1 : 0);
    const ing = recipeOf[c] || [];
    const sameIng = ing.length === 2 && ing[0] === ing[1];
    const bd = (x) => g.items[x]?.brewDuration_ms || 0;
    // 0강: 재료(produce) 2개 양조 = max(재료 brewDur)
    // N강(≥1): (N-1)강 포션 2개 합성 = 포션 brewDur × 2^(N-1)
    const produceBase = ing.length === 2 ? Math.max(bd(ing[0]), bd(ing[1])) : bd(c);
    const base = me === 0 ? produceBase : bd(c) * Math.pow(2, me - 1);
    const zm = zoneMult(zone, t, sameIng);
    const fireMult = fireOn ? Math.pow(0.9, fireE + 1) : 1;
    const adj = base ? base * factor(0.01, fl, ce) * zm * fireMult : null;
    const el = body.querySelector("#potOut"); el.innerHTML = "";
    const ic = document.createElement("span"); ic.className = "calc-ic"; itemIcon(ic, c);
    el.appendChild(ic);
    el.insertAdjacentHTML("beforeend",
      `<span class="t-base">${fmtDuration(base)}</span><span class="t-arrow">→</span><span class="t-adj">${fmtDuration(adj)}</span>`);
    if (fireOn) el.insertAdjacentHTML("beforeend",
      `<span class="calc-note-inline">화염포션 ×${fireMult.toFixed(2)}</span>`);
  };
  body.querySelectorAll("#crop,#soil,#seedE").forEach((e) => e.oninput = cropOut);
  body.querySelectorAll("#pot,#flame,#cauE,#matE,#zone,#famG,#fog,#firePot,#fireE").forEach((e) => {
    e.oninput = potOut; e.onchange = potOut;
  });
  cropOut(); potOut();
}

// ---------- 레벨 계산 ----------
function levelCalc(body) {
  // 게임 공식: 레벨 L → L+1 에 2^floor(L/5) exp 필요
  const expToNext = (L) => 2 ** Math.floor(L / 5);
  const totalForLevel = (L) => { let s = 0; for (let i = 1; i < L; i++) s += expToNext(i); return s; };
  const fromExp = (exp) => {
    let i = 1, s = exp;
    while (s > 0) { const n = expToNext(i); if (s < n) break; s -= n; i++; }
    return { level: i, into: s, need: expToNext(i) };
  };
  const fmt = (n) => Number(Math.round(n)).toLocaleString();

  body.innerHTML = `
    <div class="calc-card">
      <h3>경험치 → 레벨</h3>
      <label class="lvlabel">경험치 <input id="lc-exp" type="number" min="0" value="0" class="num-in"></label>
      <div id="lc-out1" class="lc-out"></div>
    </div>
    <div class="calc-card">
      <h3>게임 표기값 → 총 경험치</h3>
      <div class="lc-row">
        <label class="lvlabel">현재 레벨 <input id="lc-lv" type="number" min="1" value="1" class="num-in"></label>
        <label class="lvlabel">레벨 내 경험치 <input id="lc-into" type="number" min="0" value="0" class="num-in"></label>
      </div>
      <div id="lc-out3" class="lc-out"></div>
    </div>
    <div class="calc-card">
      <h3>목표 레벨까지 남은 경험치</h3>
      <div class="lc-row">
        <label class="lvlabel">현재 경험치 <input id="lc-cur" type="number" min="0" value="0" class="num-in"></label>
        <label class="lvlabel">목표 레벨 <input id="lc-tgt" type="number" min="2" value="20" class="num-in"></label>
      </div>
      <div id="lc-out2" class="lc-out"></div>
    </div>
    <div class="calc-card">
      <h3>레벨별 경험치 표</h3>
      <label class="lvlabel">표 최대 레벨 <input id="lc-tblmax" type="number" min="2" value="30" class="num-in"></label>
      <div id="lc-out4" class="lc-out"></div>
    </div>
    <p class="muted">레벨 L → L+1 필요 경험치 = 2^⌊L/5⌋ (5레벨마다 2배) · 성장포션 N강 = 4^N 경험치. 게임 공식 그대로입니다.<br>인게임은 <b>구간 경험치</b>만 표시해요 — <b>누적 총 경험치</b>는 위 "게임 표기값 → 총 경험치" / "레벨별 표"에서 확인하세요.</p>`;

  const upd1 = () => {
    const exp = Math.max(0, +body.querySelector("#lc-exp").value || 0);
    const r = fromExp(exp);
    const pct = ((r.into / r.need) * 100).toFixed(1);
    body.querySelector("#lc-out1").innerHTML =
      `<div class="lc-big">Lv ${r.level}</div>
       <div class="lc-sub">현재 레벨 진행: ${fmt(r.into)} / ${fmt(r.need)} (${pct}%)<br>
       다음 레벨까지 <b class="t-adj">${fmt(r.need - r.into)}</b> exp</div>`;
  };
  const upd2 = () => {
    const cur = Math.max(0, +body.querySelector("#lc-cur").value || 0);
    const tgt = Math.max(2, +body.querySelector("#lc-tgt").value || 2);
    const total = totalForLevel(tgt);
    const remain = Math.max(0, total - cur);
    const curLv = fromExp(cur).level;
    // 성장포션 N강 = 4^N 경험치 (게임: YP(e)=4^e). 1개로 충분해질 때까지 표시
    let rows = "";
    for (let N = 0; N <= 30; N++) {
      const per = 4 ** N;
      const cnt = remain > 0 ? Math.ceil(remain / per) : 0;
      rows += `<tr><td><b>${N}강</b></td><td>${fmt(per)}</td><td class="lc-cnt">${fmt(cnt)}개</td></tr>`;
      if (cnt <= 1) break; // 더 높은 강화는 1개로 동일 → 생략
    }
    body.querySelector("#lc-out2").innerHTML =
      `Lv ${tgt} 도달 총 경험치: <b>${fmt(total)}</b> exp<br>
       현재 <b>Lv ${curLv}</b> 에서 남은 경험치: <b class="t-adj">${fmt(remain)}</b> exp
       <div class="lc-pot-h">필요한 성장포션 (강화별)</div>
       <table class="lc-pot"><thead><tr><th>성장포션</th><th>회당 exp</th><th>필요 개수</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  // 게임 표기값(현재 레벨 + 레벨 내 경험치) → 누적 총 경험치
  const upd3 = () => {
    const lv = Math.max(1, +body.querySelector("#lc-lv").value || 1);
    const into = Math.max(0, +body.querySelector("#lc-into").value || 0);
    const bracket = expToNext(lv), base = totalForLevel(lv), total = base + into;
    const over = into >= bracket
      ? `<br><span class="t-adj">⚠ 레벨 내 경험치가 구간(${fmt(bracket)})을 초과 — 입력 확인</span>` : "";
    body.querySelector("#lc-out3").innerHTML =
      `<div class="lc-big">${fmt(total)} exp</div>
       <div class="lc-sub">Lv ${lv} 도달 누적 ${fmt(base)} + 레벨 내 ${fmt(into)}<br>
       이 레벨 구간: ${fmt(bracket)} exp${over}</div>`;
  };
  // 레벨별 [구간 경험치 / 누적 총 경험치] 표
  const upd4 = () => {
    const max = Math.min(100, Math.max(2, +body.querySelector("#lc-tblmax").value || 30));
    let rows = "", cum = 0;
    for (let L = 1; L <= max; L++) {
      rows += `<tr><td><b>Lv ${L}</b></td><td>${fmt(expToNext(L))}</td><td>${fmt(cum)}</td></tr>`;
      cum += expToNext(L); // 다음 행의 누적 = totalForLevel(L+1)
    }
    body.querySelector("#lc-out4").innerHTML =
      `<div class="lc-table-wrap"><table class="lc-pot"><thead><tr><th>레벨</th><th>구간 exp</th><th>누적 총 exp</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  body.querySelector("#lc-exp").oninput = upd1;
  body.querySelectorAll("#lc-cur,#lc-tgt").forEach((e) => e.oninput = upd2);
  body.querySelectorAll("#lc-lv,#lc-into").forEach((e) => e.oninput = upd3);
  body.querySelector("#lc-tblmax").oninput = upd4;
  upd1(); upd2(); upd3(); upd4();
}

// ---------- 강화 기댓값 ----------
// 강화 = 같은 강화도 아이템 2개 합성 → max+1 (성공률 p). 실패 시 1개만 회수.
// 성공률 p = min(0.75, 0.5×(2−(1−0.005×심지)^(솥강화+1)))  [게임 xI/TL/vo 그대로, 같은레벨 기본 50%]
// 시작강화 S → 최종 T 1개에 필요한 시작 아이템 ≈ (1+1/p)^(T−S)  [실패 회수 반영]
async function evCalc(body) {
  const g = await gamedata();
  // 레시피 역인덱스 {inputs, req} (양조 req=0, 제작 req=requiredLevel) — 자기참조(순환) 제외
  const recipeOf = {};
  for (const r of g.brew_recipes || []) if (r.inputs?.length && !r.inputs.includes(r.output)) recipeOf[r.output] ??= { in: r.inputs, req: 0 };
  for (const r of g.recipes_full || []) if (r.inputs?.length && !r.inputs.includes(r.output)) recipeOf[r.output] ??= { in: r.inputs, req: r.requiredLevel || 0 };
  const isProduce = (c) => g.items?.[c]?.type === "produce";  // 수확물은 강화 불가
  // 포션 = 양조 산출물 (작물 양조로 강화도 계승 dz). brewOut[code] = 작물 입력(중복 포함)
  const brewOut = {};
  for (const r of g.brew_recipes || []) if (r.inputs?.length && !r.inputs.includes(r.output)) brewOut[r.output] ??= r.inputs;
  const isPotion = (c) => !!brewOut[c];
  // 채집/드롭/상점 아이템 = 원재료(종료점). 레시피가 있어도 더 전개 안 함
  const terminal = new Set();
  for (const z of Object.values(g.zones || {})) for (const c of Object.keys(z.drops || {})) terminal.add(c);
  for (const p of Object.values(g.plants || {})) for (const pr of (p.produces || [])) {
    if (pr.itemCode) terminal.add(pr.itemCode);
    if (pr.ripen?.itemCode) terminal.add(pr.ripen.itemCode);
  }
  for (const c of (g.shop_items || [])) terminal.add(c);
  for (const c of Object.keys(g.dia_shop || {})) terminal.add(c);
  const nameOf = (c) => g.items?.[c]?.name || c;
  // 강화 가능 아이템: 수확물(강화불가)·시험용 제외, 레시피/가치/판매가 있거나 장비(다이아 셉터 등)
  const craftable = Object.keys(g.items || {})
    .filter((c) => g.items[c] && g.items[c].type !== "produce"
      && !/^aging_/.test(c) && !(g.items[c].name || "").includes("시험용")
      && (recipeOf[c] || g.items[c].brewDuration_ms || g.item_values?.[c] != null || g.sell_price?.[c] != null || g.equipment_stats?.[c]))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  // 원재료 가격(골드) — 기본값은 게임 가치/판매가, 사용자가 덮어쓰면 priceState
  const priceState = {};
  const priceOf = (code) => priceState[code] ?? (g.item_values?.[code] ?? g.sell_price?.[code] ?? 0);

  body.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h3>🎲 강화 기댓값</h3>
        <div class="calc-row"><label>아이템 <span class="muted">(원재료 전개)</span></label>
          <select id="ev-item" class="num-in"><option value="">— 없음 (강화만) —</option>${
            craftable.map((c) => `<option value="${c}">${nameOf(c)}</option>`).join("")}</select></div>
        <div class="calc-row"><label>솥 강화도</label><input id="ev-cauldron" type="number" min="0" max="99" value="0" class="num-in"></div>
        <div class="calc-row"><label>심지 숙련 Lv</label><input id="ev-wick" type="number" min="0" max="10" value="0" class="num-in"></div>
        <div class="calc-row"><label>제작 성공률 버프 × <span class="muted">(금빛들판 ≤2.25)</span></label><input id="ev-cbuff" type="number" min="1" step="0.05" value="1" class="num-in"></div>
        <div class="calc-row"><label class="chk"><input type="checkbox" id="ev-self"> 🔁 도구 솥 자가강화 <span class="muted">(단계마다 도구 솥 강화도↑)</span></label></div>
        <div class="calc-row"><label class="chk"><input type="checkbox" id="ev-auto" checked> ⚙️ 입력 강화 자동 최소비용 <span class="muted">(끄면 수동 지정)</span></label></div>
        <div class="calc-row" id="ev-start-row"><label>시작 강화도</label><input id="ev-start" type="number" min="0" max="99" value="0" class="num-in"></div>
        <div class="calc-row" id="ev-brew-row" style="display:none"><label>양조 작물 강화도 <span class="muted">(0~2)</span></label><input id="ev-brew" type="number" min="0" max="2" value="2" class="num-in"></div>
        <div class="calc-row"><label>최종 강화도</label><input id="ev-target" type="number" min="0" max="99" value="5" class="num-in"></div>
        <div id="ev-out" class="calc-out"></div>
        <div id="ev-fields"></div>
        <div id="ev-prices"></div>
        <div id="ev-raw"></div>
        <div class="calc-note">💡 강화 = <b>같은 강화도 아이템 2개 합성 → +1</b> (성공률 p). <b>실패 시 1개만 회수</b>(1개 손실).<br>
          성공률 <code>p = min(75%, 50%×(2−(1−0.005×심지)^(솥강화+1)))</code> · 필요 ≈ <code>(1+1/p)^(최종−시작)</code><br>
          <b>2차 전개</b>: 제작은 항상 +0 산출, <b>입력 강화도 합 ≥ requiredLevel</b>이면 100% 성공(미만은 0.25^부족분). 아래에서 <b>각 제작 입력 강화도를 직접 지정</b>(기본=자동 최소비용). 수확물은 강화 불가.</div>
      </div>
    </div>`;
  const q = (id) => body.querySelector(id);
  const fmt = (n) => n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(1);
  const craftBuff = () => Math.max(0.01, +q("#ev-cbuff")?.value || 1);   // 금빛 들판 제작 성공률 배수 (기본 1)
  // reqLevel R을 강화가능 입력들에 분배 (비용 per^e×weight 최소화)
  const bestSplit = (R, w, em) => {
    if (w.length === 0) return [];
    if (w.length === 1) return [R];
    if (w.length === 2) {
      let best = [R, 0], bc = Infinity;
      for (let a = 0; a <= R; a++) {
        const c = em(a) * w[0] + em(R - a) * w[1];
        if (c < bc) { bc = c; best = [a, R - a]; }
      }
      return best;
    }
    return w.map((_, i) => Math.floor(R / w.length) + (i < R % w.length ? 1 : 0));
  };
  // 시작 강화도>0이면 대상 아이템(최상위)을 완제품 leaf로 취급 — +s 아이템을 직접 보유/구매한다고 보고 레시피 분해 안 함
  const leaf = (item, stack) => (stack.size === 0 && Math.floor(+q("#ev-start")?.value || 0) > 0) || !recipeOf[item] || (stack.size > 0 && terminal.has(item)) || stack.has(item);
  // 자동 최소비용 분배 → 기본 입력강화도(assign) 기록
  const autoAssign = (em) => {
    const memo = {}, assign = {};
    const f = (item, stack) => {
      if (memo[item]) return memo[item];
      if (leaf(item, stack)) return { dict: { [item]: 1 }, total: priceOf(item) };
      const ns = new Set(stack); ns.add(item);
      const rec = recipeOf[item];
      const parts = rec.in.map((c) => ({ code: c, b: f(c, ns), enh: !isProduce(c) }));
      // 부분 성공까지 비교: sum 0~req 중 (강화 raw × 재시도비용) 최소 분배 선택 (제작버프↑면 부분이 유리)
      const costs = parts.filter((p) => p.enh).map((p) => p.b.total);
      let split = bestSplit(rec.req, costs, em), bestC = Infinity;
      for (let sum = 0; sum <= rec.req; sum++) {
        const sp = bestSplit(sum, costs, em);
        let raw = 0, j = 0;
        for (const p of parts) raw += p.b.total * em(p.enh ? sp[j++] : 0);
        const qv = Math.min(1, Math.pow(0.25, Math.max(0, rec.req - sum)) * craftBuff());
        const cost = raw * (0.5 / qv + 0.5);
        if (cost < bestC) { bestC = cost; split = sp; }
      }
      const dict = {}; let total = 0, ai = 0;
      for (const p of parts) {
        const e = p.enh ? split[ai++] : 0;
        if (p.enh) assign[item + "|" + p.code] = e;
        const m = em(e);
        for (const [k, v] of Object.entries(p.b.dict)) dict[k] = (dict[k] || 0) + v * m;
        total += p.b.total * m;
      }
      if (!(stack.size > 0 && terminal.has(item))) memo[item] = { dict, total };
      return memo[item] || { dict, total };
    };
    return { f, assign };
  };
  // 수동 입력강화도(enhState)로 원재료 계산. 제작 성공률<100%면 재시도 비용 반영
  const manualRaw = (em, enhState, qmap) => {
    const memo = {};
    const f = (item, stack) => {
      if (memo[item]) return memo[item];
      if (leaf(item, stack)) return { dict: { [item]: 1 }, total: priceOf(item) };
      const ns = new Set(stack); ns.add(item);
      const rec = recipeOf[item];
      let sum = 0;
      const parts = rec.in.map((c) => {
        const prod = isProduce(c);
        const e = prod ? Math.min(2, enhState[item + "|" + c] ?? 0) : (enhState[item + "|" + c] ?? 0);   // 작물 최대 +2
        sum += e;
        return { b: f(c, ns), e, prod };
      });
      const qv = Math.min(1, Math.pow(0.25, Math.max(0, rec.req - sum)) * craftBuff());
      if (qmap) qmap[item] = qv;
      const retry = 0.5 / qv + 0.5;             // 제작 실패 재시도 (입력당)
      const dict = {}; let total = 0;
      for (const p of parts) {
        const m = (p.prod ? 1 : em(p.e)) * retry;   // 작물은 합성 불가 → 개수 1 (강화도는 reqLv 기여만)
        for (const [k, v] of Object.entries(p.b.dict)) dict[k] = (dict[k] || 0) + v * m;
        total += p.b.total * m;
      }
      if (!(stack.size > 0 && terminal.has(item))) memo[item] = { dict, total };
      return memo[item] || { dict, total };
    };
    return f;
  };
  // 트리 내 제작 단계 수집 (입력 강화 필드용)
  const collectCrafts = (item, stack, acc, seen) => {
    if (leaf(item, stack) || seen.has(item)) return;
    seen.add(item);
    const rec = recipeOf[item];
    acc.push({ item, req: rec.req, inputs: rec.in });
    const ns = new Set(stack); ns.add(item);
    for (const c of rec.in) collectCrafts(c, ns, acc, seen);
  };
  // 트리의 원재료(잎) 수집 (가격 입력용)
  const collectLeaves = (item, stack, set) => {
    if (leaf(item, stack)) { set.add(item); return; }
    const ns = new Set(stack); ns.add(item);
    for (const c of recipeOf[item].in) collectLeaves(c, ns, set);
  };
  const renderPrices = (item) => {
    const set = new Set(); collectLeaves(item, new Set(), set);
    const leaves = [...set].sort((a, b) => priceOf(b) - priceOf(a));
    // 강화 대상 자신(장비·도구 등)이면 시작 강화도 +s 시세를 입력 — 강화도별 가격 반영
    const sNow = Math.max(0, Math.floor(+q("#ev-start")?.value || 0));
    const plabel = (c) => (c === item && sNow > 0 ? `+${sNow} ` : "") + nameOf(c);
    q("#ev-prices").innerHTML = `<div class="ev-fields-h">💰 원재료 가격 <span class="muted">(골드/개 · 강화 대상은 +s 시세 입력)</span></div>` +
      `<div class="ev-prices-list">${leaves.map((c) =>
        `<label class="ev-price"><span class="ev-price-ic" data-ic="${c}"></span><span class="ev-price-n">${plabel(c)}</span><input type="number" min="0" value="${priceOf(c)}" data-pc="${c}" class="ev-price-in"></label>`).join("")}</div>`;
    q("#ev-prices").querySelectorAll(".ev-price-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
    q("#ev-prices").querySelectorAll(".ev-price-in").forEach((inp) =>
      inp.oninput = () => { priceState[inp.dataset.pc] = Math.max(0, +inp.value || 0); calc(); });
  };
  // 포션 양조 가격칸: 작물 입력을 +baseE 시세로 입력
  const renderBrewPrices = (item, baseE) => {
    const inputs = [...new Set(brewOut[item])];
    q("#ev-prices").innerHTML = `<div class="ev-fields-h">💰 원재료 가격 <span class="muted">(골드/개 · +${baseE} 작물 시세)</span></div>` +
      `<div class="ev-prices-list">${inputs.map((c) =>
        `<label class="ev-price"><span class="ev-price-ic" data-ic="${c}"></span><span class="ev-price-n">+${baseE} ${nameOf(c)}</span><input type="number" min="0" value="${priceOf(c)}" data-pc="${c}" class="ev-price-in"></label>`).join("")}</div>`;
    q("#ev-prices").querySelectorAll(".ev-price-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
    q("#ev-prices").querySelectorAll(".ev-price-in").forEach((inp) =>
      inp.oninput = () => { priceState[inp.dataset.pc] = Math.max(0, +inp.value || 0); calc(); });
  };
  let enhState = {}, lastItem = null, lastStart = -1, lastBrew = -1;
  const renderFields = (item, em) => {
    if (leaf(item, new Set())) { q("#ev-fields").innerHTML = ""; enhState = {}; return; }   // 완제품 leaf면 제작 입력 없음
    const aa = autoAssign(em); aa.f(item, new Set());
    enhState = { ...aa.assign };           // 기본값 = 자동 최소비용
    const crafts = []; collectCrafts(item, new Set(), crafts, new Set());
    q("#ev-fields").innerHTML = `<div class="ev-fields-h">🔧 제작 입력 강화도 <span class="muted">(직접 조정 · 합 ≥ reqLv면 100%)</span></div>` +
      crafts.map((cr) => `<div class="ev-craft"><div class="ev-craft-h"><b>${nameOf(cr.item)}</b> <span class="muted">reqLv ${cr.req}</span> <span class="ev-q" data-c="${cr.item}"></span></div>
        <div class="ev-craft-in">${cr.inputs.map((c) => {
          const mx = isProduce(c) ? 2 : 40;   // 작물(산물)은 최대 +2 (유전/석양 — 합성 불가)
          return `<label class="ev-finput">${nameOf(c)} +<input type="number" min="0" max="${mx}" value="${enhState[cr.item + "|" + c] ?? 0}" data-key="${cr.item + "|" + c}" class="ev-enh-in"></label>`;
        }).join("")}</div></div>`).join("");
    q("#ev-fields").querySelectorAll(".ev-enh-in").forEach((inp) =>
      inp.oninput = () => { enhState[inp.dataset.key] = Math.max(0, Math.floor(+inp.value || 0)); calc(); });
  };
  const calc = () => {
    const c = Math.max(0, Math.floor(+q("#ev-cauldron").value || 0));
    const w = Math.max(0, Math.min(10, Math.floor(+q("#ev-wick").value || 0)));
    const item = q("#ev-item").value;
    const self = q("#ev-self").checked;
    const potion = !!item && isPotion(item);
    q("#ev-brew-row").style.display = potion ? "" : "none";
    q("#ev-start-row").style.display = potion ? "none" : "";   // 포션은 양조 작물 강화도가 시작점 → 시작 강화도 숨김
    // 단계 k(→k+1) 성공률. 자가강화면 도구 솥 강화도 = max(솥강화도, k)
    const pAt = (k) => { const tool = self ? Math.max(c, k) : c; return Math.min(0.75, 0.5 * (2 - Math.pow(1 - 0.005 * w, tool + 1))); };
    // em(e) = +0→+e 강화 누적 비용 (단계별 (1+1/p) 곱)
    const emCache = [1];
    const em = (e) => { while (emCache.length <= e) emCache.push(emCache[emCache.length - 1] * (1 + 1 / pAt(emCache.length - 1))); return emCache[e]; };
    const rawEl = q("#ev-raw"), fEl = q("#ev-fields");
    if (potion) {   // 포션: 강화 작물 양조 계승(dz) — +baseE 작물 양조 → 목표까지 합성
      const t = Math.max(0, Math.floor(+q("#ev-target").value || 0));
      const k = Math.max(0, Math.min(2, Math.floor(+q("#ev-brew").value ?? 2)));
      const baseE = Math.min(t, k), brews = em(t) / em(baseE);
      if (item !== lastItem || baseE !== lastBrew) { renderBrewPrices(item, baseE); lastItem = item; lastBrew = baseE; }
      fEl.innerHTML = "";
      const dict = {};
      for (const ic of brewOut[item]) dict[ic] = (dict[ic] || 0) + brews;   // 양조 1번당 작물 1개씩 (중복 포함)
      q("#ev-out").innerHTML = `
        <div class="ev-res"><span>합성 성공률 (1회)</span><b>${(pAt(baseE) * 100).toFixed(1)}%</b></div>
        <div class="ev-res big"><span>${nameOf(item)} +${t} <span class="muted">· +${baseE} 작물 양조 후 합성</span></span><b>양조 ${fmt(brews)}번</b></div>`;
      let totalCost = 0;
      const rows = Object.entries(dict).sort((a, b) => b[1] - a[1]).map(([code, n]) => {
        const cnt = Math.ceil(n), cost = cnt * priceOf(code); totalCost += cost;
        return `<div class="ev-raw-i"><span class="ev-raw-ic" data-ic="${code}"></span><span class="ev-raw-n">+${baseE} ${nameOf(code)}</span><b>${cnt.toLocaleString()}개</b><span class="ev-raw-cost">${fmt(cost)} G</span></div>`;
      }).join("");
      rawEl.innerHTML = `<div class="ev-raw-h">📦 원재료 <span class="muted">(+${baseE} 작물 양조 → +${t} ${nameOf(item)} 1개)</span> · 총 비용 <b class="ev-cost">${fmt(totalCost)} G</b></div>
        <div class="ev-raw-list">${rows}</div>`;
      rawEl.querySelectorAll(".ev-raw-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
      return;
    }
    const s = Math.max(0, Math.floor(+q("#ev-start").value || 0));
    const t = Math.max(s, Math.floor(+q("#ev-target").value ?? s));
    const levels = t - s;
    const items = em(t) / em(s);
    const pS = pAt(s), pT1 = pAt(Math.max(s, t - 1));
    const rateTxt = self && levels > 1 ? `${(pS * 100).toFixed(1)}% → ${(pT1 * 100).toFixed(1)}%` : `${(pS * 100).toFixed(2)}%`;
    const label = item ? nameOf(item) : "아이템";
    q("#ev-out").innerHTML = `
      <div class="ev-res"><span>강화 성공률 (1회)</span><b>${rateTxt}</b></div>
      <div class="ev-res big"><span>필요한 +${s} ${label} (기댓값)</span><b>${fmt(items)}개</b></div>`;
    if (item) {  // 레시피 없는 원재료(각인석 등)도 자기 자신을 원재료로 전개
      const auto = q("#ev-auto").checked;
      if (item !== lastItem) { renderPrices(item); if (!auto) renderFields(item, em); lastItem = item; lastStart = s; }
      else if (s !== lastStart) { renderPrices(item); if (!auto) renderFields(item, em); lastStart = s; }   // 시작 강화도 바뀌면 +s 라벨·완제품 leaf 갱신
      if (auto) { const aa = autoAssign(em); aa.f(item, new Set()); enhState = aa.assign; fEl.innerHTML = ""; }  // 가격 기준 최소비용 자동
      const qmap = {};
      const base = manualRaw(em, enhState, qmap)(item, new Set());
      const mult = items;   // 시작 강화도 반영: +s 아이템 기준 개수 = em(t)/em(s) (s=0이면 em(t))
      // 제작 성공률 표시
      fEl.querySelectorAll(".ev-q[data-c]").forEach((el) => {
        const qv = qmap[el.dataset.c]; if (qv == null) return;
        el.textContent = `성공률 ${(qv * 100).toFixed(0)}%`;
        el.className = "ev-q" + (qv >= 1 ? " ok" : " warn");
      });
      const ent = Object.entries(base.dict).map(([k, v]) => [k, v * mult]).sort((a, b) => b[1] - a[1]);
      let totalCost = 0;
      const rows = ent.map(([code, n]) => {
        const cnt = Math.ceil(n), cost = cnt * priceOf(code); totalCost += cost;
        // 강화 대상 자신이 재료(장비·도구 등 leaf)면 시작 강화도 +s를 명시 — 필요 개수 줄과 일관
        const nm = code === item ? `+${s} ${nameOf(code)}` : nameOf(code);
        return `<div class="ev-raw-i"><span class="ev-raw-ic" data-ic="${code}"></span><span class="ev-raw-n">${nm}</span><b>${cnt.toLocaleString()}개</b><span class="ev-raw-cost">${fmt(cost)} G</span></div>`;
      }).join("");
      rawEl.innerHTML = `<div class="ev-raw-h">📦 원재료 <span class="muted">(+${s}→+${t} ${nameOf(item)} 1개)</span> · 총 비용 <b class="ev-cost">${fmt(totalCost)} G</b></div>
        <div class="ev-raw-list">${rows}</div>`;
      rawEl.querySelectorAll(".ev-raw-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
    } else { rawEl.innerHTML = ""; fEl.innerHTML = ""; q("#ev-prices").innerHTML = ""; lastItem = null; }
  };
  body.querySelectorAll("#ev-item, #ev-cauldron, #ev-wick, #ev-start, #ev-target, #ev-brew, #ev-cbuff").forEach((i) => i.oninput = calc);
  q("#ev-self").onchange = () => { lastItem = null; calc(); };  // 모델 바뀌면 기본값 재계산
  q("#ev-auto").onchange = () => { lastItem = null; calc(); };   // 자동/수동 전환
  calc();
}

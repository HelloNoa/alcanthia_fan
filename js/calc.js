import { gamedata, names } from "./api.js";
import { itemIcon, plantIcon, fmtDuration } from "./sprites.js";
import { advSim } from "./adventure.js";
import { defaultEnhancementMaterialPrice } from "./calc_prices.js";
import { enhancementMaterialFlow } from "./enhancement_ev.js";

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
  const cauldrons = Object.entries(g.items || {})
    .filter(([c, it]) => it.type === "tool" && it.brewDuration_ms
      && (c.includes("cauldron") || c === "cauldron_controller" || (it.name || "").includes("가마솥")))
    .sort((a, b) => a[1].brewDuration_ms - b[1].brewDuration_ms || a[1].name.localeCompare(b[1].name));

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
              <option value="sunset_cliff">석양절벽 (시간×2 · 결과+1)</option>
              <option value="advanced_volcano">용암협곡 (−6%×계수)</option>
              <option value="beginner_forest">속삭이는 숲 (−10%×계수, 동일재료)</option>
            </select>
          </label>
          <label class="lvlabel">낯익은 터 <input id="famG" type="range" min="0" max="10" value="0"><b id="famGv">0</b></label>
          <label class="chk"><input type="checkbox" id="fog"> 안개 해방</label>
          <label class="chk"><input type="checkbox" id="zoneBuff"> 지역효과 버프</label>
        </div>
        <div class="calc-row">
          <label class="chk"><input type="checkbox" id="firePot"> 화염포션 적용</label>
          <label class="lvlabel">화염포션 강화 <input id="fireE" type="range" min="0" max="20" value="0"><b id="fireEv">0</b>강</label>
        </div>
        <div id="potOut" class="calc-out"></div>
        <div class="calc-note">💡 N강 포션은 <b>(N−1)강 포션 2개를 합성</b>해 만듭니다.
        예) 9강을 만들려면 8강 포션 2개가 필요하고, 시간은 8강 기준(2⁸)으로 계산돼요.</div>
        <p class="muted">지역효과 계수 = 낯익은 터×0.1 + 안개 해방 + 지역효과 버프×0.5.<br>
        시간 = 포션 기본시간 × 2^(N−1) × (1−0.01×불꽃)^(가마솥강화+1) × 존배수 × 화염포션(선택)</p>
      </div>
      <div class="calc-card">
        <h3>🛠️ 가마솥 강화 시간</h3>
        <div class="calc-row">
          <select id="tcItem">${cauldrons.map(([c, it]) => `<option value="${c}">${it.name}</option>`).join("")}</select>
        </div>
        <div class="calc-row">
          <label class="lvlabel">불꽃 숙련 <input id="tcFlame" type="range" min="0" max="10" value="0"><b id="tcFlamev">0</b></label>
          <label class="lvlabel">사용 가마솥 강화 <input id="tcToolE" type="range" min="0" max="20" value="0"><b id="tcToolEv">0</b></label>
          <label class="lvlabel">대상 현재 강화 <input id="tcItemE" type="range" min="0" max="20" value="0"><b id="tcItemEv">0</b>강</label>
        </div>
        <div class="calc-row">
          <label class="lvlabel">강화 존
            <select id="tcZone">
              <option value="">기타 (×1)</option>
              <option value="sunset_cliff">석양절벽 (시간×2 · 결과+1)</option>
              <option value="advanced_volcano">용암협곡 (−6%×계수)</option>
            </select>
          </label>
          <label class="lvlabel">낯익은 터 <input id="tcFamG" type="range" min="0" max="10" value="0"><b id="tcFamGv">0</b></label>
          <label class="chk"><input type="checkbox" id="tcFog"> 안개 해방</label>
          <label class="chk"><input type="checkbox" id="tcZoneBuff"> 지역효과 버프</label>
        </div>
        <div class="calc-row">
          <label class="chk"><input type="checkbox" id="tcFirePot"> 화염포션 적용</label>
          <label class="lvlabel">화염포션 강화 <input id="tcFireE" type="range" min="0" max="20" value="0"><b id="tcFireEv">0</b>강</label>
        </div>
        <div id="tcOut" class="calc-out"></div>
        <p class="muted">시간 = 대상 기본시간 × 2^현재강화 × (1−0.01×불꽃)^(사용가마솥강화+1) × 존배수 × 화염포션(선택)</p>
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
  const pct = (v) => `${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%`;
  const potOut = () => {
    const c = body.querySelector("#pot").value;
    const fl = +body.querySelector("#flame").value, ce = +body.querySelector("#cauE").value;
    const me = +body.querySelector("#matE").value;
    const famG = +body.querySelector("#famG").value, fog = body.querySelector("#fog").checked;
    const zoneBuff = body.querySelector("#zoneBuff").checked;
    const zone = body.querySelector("#zone").value;
    const fireOn = body.querySelector("#firePot").checked, fireE = +body.querySelector("#fireE").value;
    body.querySelector("#flamev").textContent = fl;
    body.querySelector("#cauEv").textContent = ce;
    body.querySelector("#matEv").textContent = me;
    body.querySelector("#famGv").textContent = famG;
    body.querySelector("#fireEv").textContent = fireE;
    // 게임의 Xe 공식: 낯익은 터×0.1 + 안개 해방×1 + 지역효과 버프×0.5
    const t = famG * 0.1 + (fog ? 1 : 0) + (zoneBuff ? 0.5 : 0);
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
    if (zone === "sunset_cliff") {
      const plusRate = Math.min(1, 0.05 * t);
      el.insertAdjacentHTML("beforeend",
        `<span class="calc-note-inline">석양절벽: 연성 시간 ×2 고정 · 양조/강화/제작 결과 +1 ${pct(plusRate)}</span>`);
    } else if (zone === "advanced_volcano" || zone === "beginner_forest") {
      el.insertAdjacentHTML("beforeend",
        `<span class="calc-note-inline">지역효과 계수 ${t.toFixed(1)}</span>`);
    }
  };
  const tcOut = () => {
    const c = body.querySelector("#tcItem").value;
    const fl = +body.querySelector("#tcFlame").value, toolE = +body.querySelector("#tcToolE").value;
    const itemE = +body.querySelector("#tcItemE").value;
    const famG = +body.querySelector("#tcFamG").value, fog = body.querySelector("#tcFog").checked;
    const zoneBuff = body.querySelector("#tcZoneBuff").checked;
    const zone = body.querySelector("#tcZone").value;
    const fireOn = body.querySelector("#tcFirePot").checked, fireE = +body.querySelector("#tcFireE").value;
    body.querySelector("#tcFlamev").textContent = fl;
    body.querySelector("#tcToolEv").textContent = toolE;
    body.querySelector("#tcItemEv").textContent = itemE;
    body.querySelector("#tcFamGv").textContent = famG;
    body.querySelector("#tcFireEv").textContent = fireE;
    const t = famG * 0.1 + (fog ? 1 : 0) + (zoneBuff ? 0.5 : 0);
    const base = g.items[c]?.brewDuration_ms ? g.items[c].brewDuration_ms * Math.pow(2, itemE) : null;
    const zm = zoneMult(zone, t, false);
    const fireMult = fireOn ? Math.pow(0.9, fireE + 1) : 1;
    const adj = base ? Math.round(base * factor(0.01, fl, toolE) * zm * fireMult) : null;
    const el = body.querySelector("#tcOut"); el.innerHTML = "";
    const ic = document.createElement("span"); ic.className = "calc-ic"; itemIcon(ic, c);
    el.appendChild(ic);
    el.insertAdjacentHTML("beforeend",
      `<span class="t-base">${fmtDuration(base)}</span><span class="t-arrow">→</span><span class="t-adj">${fmtDuration(adj)}</span>
       <span class="calc-note-inline">${g.items[c]?.name || c} +${itemE} → +${itemE + 1} 1회</span>`);
    if (fireOn) el.insertAdjacentHTML("beforeend",
      `<span class="calc-note-inline">화염포션 ×${fireMult.toFixed(2)}</span>`);
    if (zone === "sunset_cliff") {
      const plusRate = Math.min(1, 0.05 * t);
      el.insertAdjacentHTML("beforeend",
        `<span class="calc-note-inline">석양절벽: 강화 시간 ×2 고정 · 강화 결과 +1 ${pct(plusRate)}</span>`);
    } else if (zone === "advanced_volcano") {
      el.insertAdjacentHTML("beforeend",
        `<span class="calc-note-inline">지역효과 계수 ${t.toFixed(1)}</span>`);
    }
  };
  body.querySelectorAll("#crop,#soil,#seedE").forEach((e) => e.oninput = cropOut);
  body.querySelectorAll("#pot,#flame,#cauE,#matE,#zone,#famG,#fog,#zoneBuff,#firePot,#fireE").forEach((e) => {
    e.oninput = potOut; e.onchange = potOut;
  });
  body.querySelectorAll("#tcItem,#tcFlame,#tcToolE,#tcItemE,#tcZone,#tcFamG,#tcFog,#tcZoneBuff,#tcFirePot,#tcFireE").forEach((e) => {
    e.oninput = tcOut; e.onchange = tcOut;
  });
  cropOut(); potOut(); tcOut();
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
  const potionExp = (enh) => 4 ** enh;
  const fmt = (n) => Number(Math.round(n)).toLocaleString();
  const fmtShort = (n) => {
    const v = Number(Math.round(n));
    if (v >= 1e12) return `${(v / 1e12).toLocaleString(undefined, { maximumFractionDigits: 1 })}조`;
    if (v >= 1e8) return `${(v / 1e8).toLocaleString(undefined, { maximumFractionDigits: 1 })}억`;
    if (v >= 1e4) return `${(v / 1e4).toLocaleString(undefined, { maximumFractionDigits: 1 })}만`;
    return fmt(v);
  };
  const expTxt = (n) => `<span title="${fmt(n)} exp">${fmtShort(n)}</span>`;
  const current = () => {
    const lv = Math.max(1, Math.floor(+body.querySelector("#lc-lv").value || 1));
    const into = Math.max(0, +body.querySelector("#lc-into").value || 0);
    const need = expToNext(lv);
    return { lv, into, need, total: totalForLevel(lv) + into };
  };

  body.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card lc-main">
        <h3>성장포션 사용 결과</h3>
        <div class="lc-row">
          <label class="lvlabel">현재 레벨 <input id="lc-lv" type="number" min="1" value="1" class="num-in"></label>
          <label class="lvlabel">레벨 내 경험치 <input id="lc-into" type="number" min="0" value="0" class="num-in"></label>
        </div>
        <div class="lc-row">
          <label class="lvlabel">성장포션 강화도 <input id="lc-pot-e" type="number" min="0" max="30" value="17" class="num-in"></label>
          <label class="lvlabel">마실 개수 <input id="lc-pot-count" type="number" min="1" value="1" class="num-in"></label>
        </div>
        <div id="lc-out-use" class="lc-out"></div>
      </div>
      <div class="calc-card">
        <h3>목표까지 필요한 성장포션</h3>
        <div class="lc-row">
          <label class="lvlabel">목표 레벨 <input id="lc-tgt" type="number" min="2" value="20" class="num-in"></label>
        </div>
        <div id="lc-out-target" class="lc-out"></div>
      </div>
      <div class="calc-card">
        <h3>총 경험치 직접 입력</h3>
        <label class="lvlabel">총 경험치 <input id="lc-exp" type="number" min="0" value="0" class="num-in"></label>
        <div id="lc-out-exp" class="lc-out"></div>
      </div>
      <div class="calc-card">
        <details class="lc-details">
          <summary>레벨별 경험치 표</summary>
          <label class="lvlabel">표 최대 레벨 <input id="lc-tblmax" type="number" min="2" value="30" class="num-in"></label>
          <div id="lc-out-table" class="lc-out"></div>
        </details>
      </div>
    </div>
    <p class="muted">레벨 L → L+1 필요 경험치 = 2^⌊L/5⌋ (5레벨마다 2배) · 성장포션 N강 = 4^N 경험치. 게임 공식 그대로입니다.<br>인게임은 <b>구간 경험치</b>만 표시하므로 현재 레벨과 레벨 내 경험치를 그대로 입력하면 됩니다.</p>`;

  const updUse = () => {
    const cur = current();
    const enh = Math.max(0, Math.min(30, Math.floor(+body.querySelector("#lc-pot-e").value || 0)));
    const count = Math.max(1, Math.floor(+body.querySelector("#lc-pot-count").value || 1));
    const gain = potionExp(enh) * count;
    const after = fromExp(cur.total + gain);
    const pct = Math.min(100, (after.into / after.need) * 100);
    const lvGain = after.level - cur.lv;
    const over = cur.into >= cur.need
      ? `<div class="lc-warn">레벨 내 경험치가 현재 구간(${fmt(cur.need)})을 넘어서 입력값 기준 실제 레벨로 계산했어요.</div>` : "";
    body.querySelector("#lc-out-use").innerHTML =
      `<div class="lc-big">Lv ${after.level}</div>
       <div class="lc-sub">+${enh} 성장포션 ${fmt(count)}개 = <b class="t-adj">${expTxt(gain)}</b> exp · ${lvGain > 0 ? `+${lvGain}레벨` : "레벨 유지"}<br>
       현재 총 경험치 ${expTxt(cur.total)} → ${expTxt(cur.total + gain)}<br>
       Lv ${after.level} 진행: ${expTxt(after.into)} / ${expTxt(after.need)}</div>
       <div class="lc-progress"><span style="width:${pct}%"></span></div>${over}`;
  };
  const updTarget = () => {
    const cur = current();
    const tgt = Math.max(2, Math.floor(+body.querySelector("#lc-tgt").value || 2));
    const selectedEnh = Math.max(0, Math.min(30, Math.floor(+body.querySelector("#lc-pot-e").value || 0)));
    const total = totalForLevel(tgt);
    const remain = Math.max(0, total - cur.total);
    const selectedPer = potionExp(selectedEnh);
    const selectedCnt = remain > 0 ? Math.ceil(remain / selectedPer) : 0;
    let oneEnh = 0;
    while (oneEnh < 30 && potionExp(oneEnh) < remain) oneEnh++;
    const rowSet = new Set([selectedEnh]);
    const addNear = (center, radius) => {
      for (let n = Math.max(0, center - radius); n <= Math.min(30, center + radius); n++) rowSet.add(n);
    };
    addNear(oneEnh, 3);
    addNear(selectedEnh, 1);
    if (remain < 100000) for (let n = 0; n <= 5; n++) rowSet.add(n);
    const rows = [...rowSet].sort((a, b) => a - b).map((n) => {
      const per = potionExp(n);
      const cnt = remain > 0 ? Math.ceil(remain / per) : 0;
      const klass = n === selectedEnh ? ` class="lc-pick"` : "";
      return `<tr${klass}><td><b>${n}강</b></td><td>${expTxt(per)}</td><td class="lc-cnt">${fmt(cnt)}개</td></tr>`;
    }).join("");
    body.querySelector("#lc-out-target").innerHTML = remain <= 0
      ? `<div class="lc-big">도달 완료</div><div class="lc-sub">현재 입력값이 이미 Lv ${tgt} 이상입니다.</div>`
      : `<div class="lc-big">${selectedEnh}강 ${fmt(selectedCnt)}개</div>
         <div class="lc-sub">Lv ${tgt}까지 남은 경험치: <b class="t-adj">${expTxt(remain)}</b><br>
         1개로 끝내려면 <b>${oneEnh}강 이상</b></div>
         <div class="lc-pot-h">가까운 성장포션 강화도</div>
         <table class="lc-pot"><thead><tr><th>성장포션</th><th>회당 exp</th><th>필요 개수</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
  const updExp = () => {
    const exp = Math.max(0, +body.querySelector("#lc-exp").value || 0);
    const r = fromExp(exp);
    const pct = ((r.into / r.need) * 100).toFixed(1);
    body.querySelector("#lc-out-exp").innerHTML =
      `<div class="lc-big">Lv ${r.level}</div>
       <div class="lc-sub">현재 레벨 진행: ${expTxt(r.into)} / ${expTxt(r.need)} (${pct}%)<br>
       다음 레벨까지 <b class="t-adj">${expTxt(r.need - r.into)}</b> exp</div>`;
  };
  // 레벨별 [구간 경험치 / 누적 총 경험치] 표
  const updTable = () => {
    const max = Math.min(100, Math.max(2, +body.querySelector("#lc-tblmax").value || 30));
    let rows = "", cum = 0;
    for (let L = 1; L <= max; L++) {
      rows += `<tr><td><b>Lv ${L}</b></td><td>${expTxt(expToNext(L))}</td><td>${expTxt(cum)}</td></tr>`;
      cum += expToNext(L); // 다음 행의 누적 = totalForLevel(L+1)
    }
    body.querySelector("#lc-out-table").innerHTML =
      `<div class="lc-table-wrap"><table class="lc-pot"><thead><tr><th>레벨</th><th>구간 exp</th><th>누적 총 exp</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  body.querySelectorAll("#lc-lv,#lc-into,#lc-pot-e,#lc-pot-count").forEach((e) => {
    e.oninput = () => { updUse(); updTarget(); };
  });
  body.querySelector("#lc-tgt").oninput = updTarget;
  body.querySelector("#lc-exp").oninput = updExp;
  body.querySelector("#lc-tblmax").oninput = updTable;
  updUse(); updTarget(); updExp(); updTable();
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
  const itemCodeByInput = new Map();
  for (const c of craftable) { itemCodeByInput.set(nameOf(c), c); itemCodeByInput.set(c, c); }
  const EV_STORE = "alc_enhancement_ev_v1";
  const savedEvState = (() => {
    try {
      const value = JSON.parse(localStorage.getItem(EV_STORE) || "null");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  })();
  // 원재료 가격(골드) — 일반 상점 품목은 구매가, 나머지는 게임 가치/판매가. 사용자가 덮어쓰면 priceState
  const priceState = {};
  for (const [code, value] of Object.entries(savedEvState.prices || {})) {
    if (g.items?.[code] && Number.isFinite(+value) && +value >= 0) priceState[code] = +value;
  }
  const priceOf = (code) => priceState[code] ?? defaultEnhancementMaterialPrice(g, code);

  body.innerHTML = `
    <div class="calc-grid">
      <div class="calc-card">
        <h3>🎲 강화 기댓값</h3>
        <div class="calc-row ev-item-row"><label for="ev-item">아이템 <span class="muted">(원재료 전개)</span></label>
          <div class="ev-item-picker">
            <span id="ev-item-selected-icon" class="ev-item-selected-icon" aria-hidden="true" hidden></span>
            <input id="ev-item" class="num-in ev-item-search" type="search"
              placeholder="이름 검색 · 비우면 강화만" autocomplete="off"
              role="combobox" aria-autocomplete="list" aria-controls="ev-item-options" aria-expanded="false">
            <div id="ev-item-options" class="ev-item-options" role="listbox" hidden></div>
          </div>
        </div>
        <div class="calc-row"><label>솥 강화도</label><input id="ev-cauldron" type="number" min="0" max="99" value="0" class="num-in"></div>
        <div class="calc-row"><label class="lvlabel">심지 숙련 Lv <input id="ev-wick" type="range" min="0" max="10" value="0"><b id="ev-wickv">0</b></label></div>
        <div class="calc-row">
          <label class="lvlabel">작업 지역
            <select id="ev-zone" class="num-in">
              <option value="">기타 (효과 없음)</option>
              <option value="golden_fields">금빛들판 (제작 성공률)</option>
              <option value="sunset_cliff">석양절벽 (성공 결과 +1)</option>
            </select>
          </label>
          <label class="lvlabel">낯익은 터 <input id="ev-famG" type="range" min="0" max="10" value="0"><b id="ev-famGv">0</b></label>
          <label class="chk"><input type="checkbox" id="ev-fog"> 안개 해방</label>
          <label class="chk"><input type="checkbox" id="ev-zoneBuff"> 지역효과 버프</label>
        </div>
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
          성공률 <code>p = min(75%, 50%×(2−(1−0.005×심지)^(솥강화+1)))</code> · 지역효과가 없으면 단계별 필요량은 <code>1+1/p</code>배.<br>
          <b>2차 전개</b>: 기본 제작 산출은 +0, <b>입력 강화도 합 ≥ requiredLevel</b>이면 100% 성공(미만은 0.25^부족분). 아래에서 <b>각 제작 입력 강화도를 직접 지정</b>(기본=자동 최소비용). 수확물은 강화 불가.<br>
          금빛들판은 제작 성공률 ×(1 + 50%×계수), 최대 ×2.25로 반영합니다. 석양절벽은 강화도별 기대 공급량을 따로 추적하며, <b>정확히 최종 강화도인 결과만 집계</b>하고 초과 결과는 제외합니다.</div>
      </div>
    </div>`;
  const q = (id) => body.querySelector(id);
  const restoreNumber = (id, key, min, max) => {
    const value = Number(savedEvState[key]);
    if (Number.isFinite(value)) q(id).value = Math.max(min, Math.min(max, Math.floor(value)));
  };
  if (craftable.includes(savedEvState.item)) q("#ev-item").value = nameOf(savedEvState.item);
  restoreNumber("#ev-cauldron", "cauldron", 0, 99);
  restoreNumber("#ev-wick", "wick", 0, 10);
  restoreNumber("#ev-famG", "familiarGround", 0, 10);
  restoreNumber("#ev-start", "start", 0, 99);
  restoreNumber("#ev-brew", "brew", 0, 2);
  restoreNumber("#ev-target", "target", 0, 99);
  if (["", "golden_fields", "sunset_cliff"].includes(savedEvState.zone)) q("#ev-zone").value = savedEvState.zone;
  if (typeof savedEvState.fog === "boolean") q("#ev-fog").checked = savedEvState.fog;
  if (typeof savedEvState.zoneBuff === "boolean") q("#ev-zoneBuff").checked = savedEvState.zoneBuff;
  if (typeof savedEvState.self === "boolean") q("#ev-self").checked = savedEvState.self;
  if (typeof savedEvState.auto === "boolean") q("#ev-auto").checked = savedEvState.auto;
  const fmt = (n) => !Number.isFinite(n) ? "도달 불가" : n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(1);
  const pct = (v) => `${(v * 100).toFixed(v * 100 % 1 ? 1 : 0)}%`;
  const zoneCoeff = () => Math.max(0, +q("#ev-famG")?.value || 0) * 0.1
    + (q("#ev-fog")?.checked ? 1 : 0)
    + (q("#ev-zoneBuff")?.checked ? 0.5 : 0);
  const craftBuff = () => q("#ev-zone")?.value === "golden_fields" ? Math.min(2.25, 1 + 0.5 * zoneCoeff()) : 1;
  const sunsetBonusRate = () => q("#ev-zone")?.value === "sunset_cliff" ? Math.min(1, 0.05 * zoneCoeff()) : 0;
  // reqLevel R을 강화가능 입력들에 분배 (입력별 강화비용 최소화)
  const bestSplit = (R, costFns) => {
    if (costFns.length === 0) return [];
    const dp = Array.from({ length: costFns.length + 1 }, () => Array(R + 1).fill(Infinity));
    const prev = Array.from({ length: costFns.length + 1 }, () => Array(R + 1).fill(0));
    dp[0][0] = 0;
    for (let i = 0; i < costFns.length; i++) {
      for (let sum = 0; sum <= R; sum++) {
        if (!Number.isFinite(dp[i][sum])) continue;
        for (let e = 0; e + sum <= R; e++) {
          const next = dp[i][sum] + costFns[i](e);
          if (next < dp[i + 1][sum + e]) { dp[i + 1][sum + e] = next; prev[i + 1][sum + e] = e; }
        }
      }
    }
    const split = Array(costFns.length).fill(0);
    for (let i = costFns.length, sum = R; i > 0; i--) {
      split[i - 1] = prev[i][sum];
      sum -= split[i - 1];
    }
    return split;
  };
  // 시작 강화도>0이면 대상 아이템(최상위)을 완제품 leaf로 취급 — +s 아이템을 직접 보유/구매한다고 보고 레시피 분해 안 함
  const leaf = (item, stack) => (stack.size === 0 && Math.floor(+q("#ev-start")?.value || 0) > 0) || !recipeOf[item] || (stack.size > 0 && terminal.has(item)) || stack.has(item);
  // 자동 최소비용 분배 → 기본 입력강화도(assign) 기록
  const autoAssign = (multFor) => {
    const memo = {}, assign = {};
    const f = (item, stack) => {
      if (memo[item]) return memo[item];
      if (leaf(item, stack)) return { dict: { [item]: 1 }, total: priceOf(item) };
      const ns = new Set(stack); ns.add(item);
      const rec = recipeOf[item];
      const parts = rec.in.map((c) => ({ code: c, b: f(c, ns), enh: !isProduce(c), mult: (e) => multFor(c, e, ns) }));
      // 부분 성공까지 비교: sum 0~req 중 (강화 raw × 재시도비용) 최소 분배 선택 (제작버프↑면 부분이 유리)
      const costs = parts.filter((p) => p.enh).map((p) => (e) => p.b.total * p.mult(e));
      let split = bestSplit(rec.req, costs), bestC = Infinity;
      for (let sum = 0; sum <= rec.req; sum++) {
        const sp = bestSplit(sum, costs);
        let raw = 0, j = 0;
        for (const p of parts) raw += p.b.total * (p.enh ? p.mult(sp[j++]) : 1);
        const qv = Math.min(1, Math.pow(0.25, Math.max(0, rec.req - sum)) * craftBuff());
        const cost = raw * (0.5 / qv + 0.5);
        if (cost < bestC) { bestC = cost; split = sp; }
      }
      const dict = {}; let total = 0, ai = 0;
      for (const p of parts) {
        const e = p.enh ? split[ai++] : 0;
        if (p.enh) assign[item + "|" + p.code] = e;
        const m = p.enh ? p.mult(e) : 1;
        for (const [k, v] of Object.entries(p.b.dict)) dict[k] = (dict[k] || 0) + v * m;
        total += p.b.total * m;
      }
      if (!(stack.size > 0 && terminal.has(item))) memo[item] = { dict, total };
      return memo[item] || { dict, total };
    };
    return { f, assign };
  };
  // 수동 입력강화도(enhState)로 원재료 계산. 제작 성공률<100%면 재시도 비용 반영
  const manualRaw = (multFor, enhState, qmap) => {
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
        return { code: c, b: f(c, ns), e, prod };
      });
      const qv = Math.min(1, Math.pow(0.25, Math.max(0, rec.req - sum)) * craftBuff());
      if (qmap) qmap[item] = qv;
      const retry = 0.5 / qv + 0.5;             // 제작 실패 재시도 (입력당)
      const dict = {}; let total = 0;
      for (const p of parts) {
        const m = (p.prod ? 1 : multFor(p.code, p.e, ns)) * retry;   // 작물은 합성 불가 → 개수 1 (강화도는 reqLv 기여만)
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
    q("#ev-prices").innerHTML = `<div class="ev-fields-h">💰 원재료 가격 <span class="muted">(골드/개 · 상점 재료는 구매가 · 강화 대상은 +s 시세 입력)</span></div>` +
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
  const restoredEnhState = {};
  for (const [key, value] of Object.entries(savedEvState.enhancements || {})) {
    if (key.includes("|") && Number.isFinite(+value)) restoredEnhState[key] = Math.max(0, Math.min(40, Math.floor(+value)));
  }
  let enhState = restoredEnhState, lastItem = null, lastStart = -1, lastBrew = -1;
  const saveState = () => {
    const numberOf = (id) => Math.max(0, Math.floor(+q(id).value || 0));
    try {
      localStorage.setItem(EV_STORE, JSON.stringify({
        item: itemCodeByInput.get(q("#ev-item").value.trim()) || "",
        cauldron: numberOf("#ev-cauldron"),
        wick: Math.min(10, numberOf("#ev-wick")),
        zone: q("#ev-zone").value,
        familiarGround: Math.min(10, numberOf("#ev-famG")),
        fog: q("#ev-fog").checked,
        zoneBuff: q("#ev-zoneBuff").checked,
        self: q("#ev-self").checked,
        auto: q("#ev-auto").checked,
        start: numberOf("#ev-start"),
        brew: Math.min(2, numberOf("#ev-brew")),
        target: numberOf("#ev-target"),
        prices: priceState,
        enhancements: enhState,
      }));
    } catch {}
  };
  const renderFields = (item, multFor) => {
    if (leaf(item, new Set())) { q("#ev-fields").innerHTML = ""; enhState = {}; return; }   // 완제품 leaf면 제작 입력 없음
    const aa = autoAssign(multFor); aa.f(item, new Set());
    enhState = { ...aa.assign, ...enhState };   // 자동 기본값 위에 저장된 수동값 복원
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
    q("#ev-wickv").textContent = w;
    const item = itemCodeByInput.get(q("#ev-item").value.trim()) || "";
    const self = q("#ev-self").checked;
    const potion = !!item && isPotion(item);
    const famG = Math.max(0, Math.floor(+q("#ev-famG").value || 0));
    q("#ev-famGv").textContent = famG;
    const craftRateBuff = craftBuff();
    const sunsetRate = sunsetBonusRate();
    q("#ev-brew-row").style.display = potion ? "" : "none";
    q("#ev-start-row").style.display = potion ? "none" : "";   // 포션은 양조 작물 강화도가 시작점 → 시작 강화도 숨김
    // 단계 k(→k+1) 성공률. 자가강화면 도구 솥 강화도 = max(솥강화도, k)
    const pAt = (k) => { const tool = self ? Math.max(c, k) : c; return Math.min(0.75, 0.5 * (2 - Math.pow(1 - 0.005 * w, tool + 1))); };
    const flowMemo = new Map();
    const materialFlow = (start, target, sourceBonusRate = 0, goal = "exact") => {
      start = Math.max(0, Math.floor(start || 0));
      target = Math.max(start, Math.floor(target || 0));
      const key = `${start}:${target}:${sourceBonusRate}:${goal}`;
      if (!flowMemo.has(key)) flowMemo.set(key, enhancementMaterialFlow({
        start,
        target,
        successRate: pAt,
        bonusRate: sunsetRate,
        sourceBonusRate,
        goal,
      }));
      return flowMemo.get(key);
    };
    const fmtFlow = (n) => {
      if (!Number.isFinite(n)) return "도달 불가";
      const digits = n < 0.1 ? 3 : n < 10 ? 2 : n < 1000 ? 1 : 0;
      return n.toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    };
    const renderFlowProgress = (flow, start, target, sourceBonusRate, source) => {
      if (target - start < 2 || !Number.isFinite(flow.expectedInputs)) return "";
      const scale = flow.expectedInputs;
      const withSunset = sunsetRate > 0;
      const sourceBase = scale * (1 - sourceBonusRate);
      const sourceBonus = scale * sourceBonusRate;
      const sourceTotal = `${source.label} ${fmtFlow(scale)}${source.suffix}`;
      const sourceFlow = source.generated
        ? `<b>${sourceTotal}</b><span>→</span><b>+${start} ${fmtFlow(sourceBase)}개</b>${sourceBonusRate > 0 ? `<span>+</span><b>+${start + 1} ${fmtFlow(sourceBonus)}개</b>` : ""}`
        : `<b>${sourceTotal}</b><span>에서 시작</span>`;
      const rows = flow.levels.map((step) => {
        const available = step.available * scale;
        const attempts = step.attempts * scale;
        const normal = step.normalOutput * scale;
        const bonus = step.bonusOutput * scale;
        const bonusTarget = step.level + 2;
        const excluded = bonusTarget > target ? bonus : 0;
        return `<tr>
          <th scope="row"><span>+${step.level}</span><small>${pct(step.successRate)}</small></th>
          <td><b>${fmtFlow(available)}개</b></td>
          <td>${fmtFlow(attempts)}회</td>
          <td><b>${fmtFlow(normal)}개</b><small>→ +${step.level + 1}</small></td>
          ${withSunset ? `<td class="${excluded > 0 ? "excluded" : ""}"><b>${fmtFlow(bonus)}개</b><small>→ +${bonusTarget}</small></td>
          <td class="ev-flow-discard">${excluded > 0 ? `<b>${fmtFlow(excluded)}개</b>` : "-"}</td>` : ""}
        </tr>`;
      });
      rows.push(`<tr class="final">
        <th scope="row"><span>+${target}</span><small>최종</small></th>
        <td><b>${fmtFlow(flow.targetYield * scale)}개</b></td><td>완료</td><td>-</td>
        ${withSunset ? "<td>-</td><td>-</td>" : ""}
      </tr>`);
      return `<div class="ev-flow">
        <div class="ev-flow-h"><b>강화 재고 흐름</b><span>최종 +${target} 1개 · 실패 회수와 재투입 반영</span></div>
        <div class="ev-flow-source">${sourceFlow}</div>
        <div class="ev-flow-scroll"><table class="${withSunset ? "sunset" : ""}">
          <thead><tr><th scope="col">단계</th><th scope="col">유입 재고</th><th scope="col">예상 시도</th><th scope="col">일반 +1 산출</th>
            ${withSunset ? "<th scope=\"col\">석양 +2 산출</th><th scope=\"col\">목표 초과 제외</th>" : ""}</tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table></div>
      </div>`;
    };
    const multFor = (code, e, stack) => {
      e = Math.max(0, Math.floor(e || 0));
      const sourceBonus = sunsetRate > 0 && !leaf(code, stack) ? sunsetRate : 0;
      return materialFlow(0, e, sourceBonus, "atLeast").expectedInputs;
    };
    const rawEl = q("#ev-raw"), fEl = q("#ev-fields");
    if (potion) {   // 포션: 강화 작물 양조 계승(dz) — +baseE 작물 양조 → 목표까지 합성
      const t = Math.max(0, Math.floor(+q("#ev-target").value || 0));
      const k = Math.max(0, Math.min(2, Math.floor(+q("#ev-brew").value || 0)));
      const baseE = Math.min(t, k);
      const brewFlow = materialFlow(baseE, t, sunsetRate, "exact");
      const brews = brewFlow.expectedInputs;
      if (item !== lastItem || baseE !== lastBrew) { renderBrewPrices(item, baseE); lastItem = item; lastBrew = baseE; }
      fEl.innerHTML = "";
      const dict = {};
      for (const ic of brewOut[item]) dict[ic] = (dict[ic] || 0) + brews;   // 양조 1번당 작물 1개씩 (중복 포함)
      const brewP = pAt(baseE);
      q("#ev-out").innerHTML = `
        ${t > baseE ? `<div class="ev-res"><span>합성 성공률 (시작 단계)</span><b>${(brewP * 100).toFixed(1)}%</b></div>` : ""}
        ${sunsetRate > 0 ? `<div class="ev-res"><span>석양 발동률 (성공 결과)</span><b>${pct(sunsetRate)}</b></div>
        <div class="ev-res"><span>양조 산출 +${baseE}</span><b>${pct(1 - sunsetRate)}</b></div>
        <div class="ev-res"><span>석양 양조 산출 +${baseE + 1}</span><b>${pct(sunsetRate)}</b></div>
        ${t > baseE ? `<div class="ev-res"><span>일반 합성 (+${baseE}→+${baseE + 1})</span><b>${pct(brewP * (1 - sunsetRate))}</b></div>
        <div class="ev-res"><span>석양 대성공 (+${baseE}→+${baseE + 2})</span><b>${pct(brewP * sunsetRate)}</b></div>` : ""}` : ""}
        ${renderFlowProgress(brewFlow, baseE, t, sunsetRate, { label: "양조", suffix: "회", generated: true })}
        <div class="ev-res big"><span>정확히 +${t} ${nameOf(item)} <span class="muted">· 장기 기댓값</span></span><b>양조 ${fmt(brews)}번</b></div>`;
      let totalCost = 0;
      const rows = Object.entries(dict).sort((a, b) => b[1] - a[1]).map(([code, n]) => {
        const cnt = Math.ceil(n), cost = cnt * priceOf(code); totalCost += cost;
        return `<div class="ev-raw-i"><span class="ev-raw-ic" data-ic="${code}"></span><span class="ev-raw-n">+${baseE} ${nameOf(code)}</span><b>${cnt.toLocaleString()}개</b><span class="ev-raw-cost">${fmt(cost)} G</span></div>`;
      }).join("");
      rawEl.innerHTML = `<div class="ev-raw-h">📦 원재료 <span class="muted">(+${baseE} 작물 양조 → +${t} ${nameOf(item)} 1개)</span> · 총 비용 <b class="ev-cost">${fmt(totalCost)} G</b></div>
        <div class="ev-raw-list">${rows}</div>`;
      rawEl.querySelectorAll(".ev-raw-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
      saveState();
      return;
    }
    const s = Math.max(0, Math.floor(+q("#ev-start").value || 0));
    const t = Math.max(s, Math.floor(+q("#ev-target").value ?? s));
    const levels = t - s;
    const hasCraft = !!item && !leaf(item, new Set());
    const sourceBonus = hasCraft && s === 0 ? sunsetRate : 0;
    const targetFlow = materialFlow(s, t, sourceBonus, "exact");
    const items = targetFlow.expectedInputs;
    const pS = pAt(s), pT1 = pAt(Math.max(s, t - 1));
    const rateTxt = self && levels > 1 ? `${(pS * 100).toFixed(1)}% → ${(pT1 * 100).toFixed(1)}%` : `${(pS * 100).toFixed(2)}%`;
    const label = item ? nameOf(item) : "아이템";
    const sourceNeedTxt = hasCraft && s === 0 ? `제작 결과 ${fmt(items)}개` : `+${s} 재료 ${fmt(items)}개`;
    q("#ev-out").innerHTML = `
      ${levels > 0 ? `<div class="ev-res"><span>강화 성공률 (1회)</span><b>${rateTxt}</b></div>` : ""}
      ${hasCraft && craftRateBuff > 1 ? `<div class="ev-res"><span>금빛들판 제작 성공률</span><b>×${craftRateBuff.toFixed(2)}</b></div>` : ""}
      ${sunsetRate > 0 ? `<div class="ev-res"><span>석양 발동률 (성공 결과)</span><b>${pct(sunsetRate)}</b></div>
      ${hasCraft && s === 0 ? `<div class="ev-res"><span>제작 산출 +0 / +1</span><b>${pct(1 - sunsetRate)} / ${pct(sunsetRate)}</b></div>` : ""}
      ${levels > 0 ? `<div class="ev-res"><span>시작 단계 실패 (+${s} 회수)</span><b>${pct(1 - pS)}</b></div>
      <div class="ev-res"><span>일반 성공 (+${s}→+${s + 1})</span><b>${pct(pS * (1 - sunsetRate))}</b></div>
      <div class="ev-res"><span>석양 대성공 (+${s}→+${s + 2})</span><b>${pct(pS * sunsetRate)}</b></div>` : ""}` : ""}
      ${renderFlowProgress(targetFlow, s, t, sourceBonus, hasCraft && s === 0
        ? { label: "제작 결과", suffix: "개", generated: true }
        : { label: `+${s} 재료`, suffix: "개", generated: false })}
      <div class="ev-res big"><span>정확히 +${t} ${label} 1개 <span class="muted">· 장기 기댓값</span></span><b>${sourceNeedTxt}</b></div>`;
    if (item) {  // 레시피 없는 원재료(각인석 등)도 자기 자신을 원재료로 전개
      const auto = q("#ev-auto").checked;
      if (item !== lastItem) { renderPrices(item); if (!auto) renderFields(item, multFor); lastItem = item; lastStart = s; }
      else if (s !== lastStart) { renderPrices(item); if (!auto) renderFields(item, multFor); lastStart = s; }   // 시작 강화도 바뀌면 +s 라벨·완제품 leaf 갱신
      if (auto) { const aa = autoAssign(multFor); aa.f(item, new Set()); enhState = aa.assign; fEl.innerHTML = ""; }  // 가격 기준 최소비용 자동
      const qmap = {};
      const base = manualRaw(multFor, enhState, qmap)(item, new Set());
      const mult = items;   // 정확한 목표 강화도 1개에 필요한 성공 제작물 수
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
      const targetPath = hasCraft && s === 0 ? `제작→정확히 +${t}` : `+${s}→정확히 +${t}`;
      rawEl.innerHTML = `<div class="ev-raw-h">📦 원재료 <span class="muted">(${targetPath} ${nameOf(item)} 1개)</span> · 총 비용 <b class="ev-cost">${fmt(totalCost)} G</b></div>
        <div class="ev-raw-list">${rows}</div>`;
      rawEl.querySelectorAll(".ev-raw-ic[data-ic]").forEach((e) => itemIcon(e, e.dataset.ic));
    } else { rawEl.innerHTML = ""; fEl.innerHTML = ""; q("#ev-prices").innerHTML = ""; lastItem = null; }
    saveState();
  };
  body.querySelectorAll("#ev-cauldron, #ev-wick, #ev-start, #ev-target, #ev-brew, #ev-zone, #ev-famG, #ev-fog, #ev-zoneBuff").forEach((i) => {
    i.oninput = calc; i.onchange = calc;
  });
  const itemInput = q("#ev-item");
  const itemPicker = itemInput.closest(".ev-item-picker");
  const selectedItemIcon = q("#ev-item-selected-icon");
  const itemOptions = q("#ev-item-options");
  let visibleItemCodes = [];
  let activeItemIndex = -1;
  let selectedIconCode = "";
  const updateSelectedItemIcon = () => {
    const code = itemCodeByInput.get(itemInput.value.trim()) || "";
    if (code === selectedIconCode) return;
    selectedIconCode = code;
    selectedItemIcon.replaceChildren();
    selectedItemIcon.hidden = !code;
    selectedItemIcon.title = code ? nameOf(code) : "";
    itemPicker.classList.toggle("has-selected-item", Boolean(code));
    if (!code) return;
    const holder = document.createElement("span");
    itemIcon(holder, code, "ev-item-selected-img").then(() => {
      if (selectedIconCode === code) selectedItemIcon.replaceChildren(...holder.children);
    });
  };
  const matchingItems = () => {
    const term = itemInput.value.trim().toLocaleLowerCase("ko");
    if (!term) return craftable;
    return craftable.filter((c) => nameOf(c).toLocaleLowerCase("ko").includes(term) || c.toLowerCase().includes(term));
  };
  const closeItemOptions = () => {
    itemOptions.hidden = true;
    itemInput.setAttribute("aria-expanded", "false");
    itemInput.removeAttribute("aria-activedescendant");
    activeItemIndex = -1;
  };
  const setActiveItem = (index) => {
    const options = [...itemOptions.querySelectorAll(".ev-item-option")];
    if (!options.length) return;
    activeItemIndex = (index + options.length) % options.length;
    options.forEach((option, i) => {
      const active = i === activeItemIndex;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });
    const active = options[activeItemIndex];
    itemInput.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  };
  const selectItem = (code) => {
    itemInput.value = nameOf(code);
    updateSelectedItemIcon();
    closeItemOptions();
    lastItem = null;
    calc();
  };
  const openItemOptions = () => {
    visibleItemCodes = matchingItems().slice(0, 60);
    activeItemIndex = -1;
    itemOptions.replaceChildren();
    if (!visibleItemCodes.length) {
      const empty = document.createElement("div");
      empty.className = "ev-item-empty";
      empty.textContent = "검색 결과가 없습니다.";
      itemOptions.appendChild(empty);
    } else {
      visibleItemCodes.forEach((code, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `ev-item-option-${index}`;
        option.className = "ev-item-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        const icon = document.createElement("span");
        icon.className = "ev-item-option-icon";
        const label = document.createElement("span");
        label.className = "ev-item-option-name";
        label.textContent = nameOf(code);
        const itemCode = document.createElement("span");
        itemCode.className = "ev-item-option-code";
        itemCode.textContent = code;
        option.append(icon, label, itemCode);
        option.onmousedown = (e) => e.preventDefault();
        option.onclick = () => selectItem(code);
        itemOptions.appendChild(option);
        itemIcon(icon, code);
      });
    }
    itemOptions.hidden = false;
    itemInput.setAttribute("aria-expanded", "true");
  };
  itemInput.onfocus = openItemOptions;
  itemInput.onclick = openItemOptions;
  itemInput.oninput = () => { updateSelectedItemIcon(); calc(); openItemOptions(); };
  itemInput.onsearch = () => { updateSelectedItemIcon(); calc(); openItemOptions(); };
  itemInput.onkeydown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (itemOptions.hidden) openItemOptions();
      setActiveItem(activeItemIndex + (e.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (e.key === "Escape") { closeItemOptions(); return; }
    if (e.key !== "Enter") return;
    if (activeItemIndex >= 0 && visibleItemCodes[activeItemIndex]) {
      e.preventDefault();
      selectItem(visibleItemCodes[activeItemIndex]);
      return;
    }
    const matches = matchingItems();
    if (!itemCodeByInput.has(itemInput.value.trim()) && matches.length === 1) {
      e.preventDefault();
      selectItem(matches[0]);
    } else {
      closeItemOptions();
    }
  };
  itemPicker.onfocusout = () => setTimeout(() => {
    if (!itemPicker.contains(document.activeElement)) closeItemOptions();
  }, 0);
  q("#ev-self").onchange = () => { lastItem = null; calc(); };  // 모델 바뀌면 기본값 재계산
  q("#ev-auto").onchange = () => { lastItem = null; calc(); };   // 자동/수동 전환
  updateSelectedItemIcon();
  calc();
}

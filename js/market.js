import { api, names } from "./api.js";

function fmt(n) { return n == null ? "-" : Number(n).toLocaleString(); }
function normKey(k) { k = k.trim().replace(/\s/g, "+"); return k.includes("+") ? k : k + "+0"; }

export async function renderMarket(container, rawKey) {
  const N = await names();
  const itemKey = normKey(rawKey);
  const code = itemKey.split("+")[0];
  const itemName = N.items?.[code] || code;

  container.innerHTML = `
    <div class="market-head"><h2>💹 ${itemName} <small>(${itemKey})</small></h2>
      <div id="m-price" class="big-price">…</div></div>
    <div class="market-grid">
      <div class="panel"><h3>📈 시세 (캔들)</h3><canvas id="m-candle" width="520" height="220"></canvas></div>
      <div class="panel"><h3>📊 호가창</h3><div id="m-orderbook">…</div></div>
    </div>`;

  // 시세
  api.price(itemKey).then((d) => {
    document.getElementById("m-price").textContent =
      d.price != null ? `${fmt(d.price)} G` : "매물 없음";
  }).catch((e) => document.getElementById("m-price").textContent = "시세 오류: " + e.message);

  // 호가창
  api.orderbook(itemKey).then((rows) => renderOrderbook(rows)).catch((e) =>
    document.getElementById("m-orderbook").innerHTML = `<p class="err">${e.message}</p>`);

  // 캔들
  api.candles(itemKey, "1d", 30).then((rows) => drawCandles(rows)).catch((e) =>
    document.getElementById("m-candle").replaceWith(Object.assign(document.createElement("p"),
      { className: "err", textContent: "캔들 오류: " + e.message })));
}

function renderOrderbook(rows) {
  const el = document.getElementById("m-orderbook");
  if (!rows || !rows.length) { el.innerHTML = "<p class='muted'>주문 없음</p>"; return; }
  const norm = (s) => (typeof s === "string" ? s.toLowerCase() : s);
  const buys = rows.filter((r) => ["buy", "bid", 0, "b"].includes(norm(r.side)))
    .sort((a, b) => b.price - a.price);
  const sells = rows.filter((r) => ["sell", "ask", 1, "s"].includes(norm(r.side)))
    .sort((a, b) => a.price - b.price);
  const maxQ = Math.max(1, ...rows.map((r) => Number(r.total_quantity) || 0));
  const row = (r, cls) => `
    <div class="ob-row ${cls}">
      <div class="bar" style="width:${(Number(r.total_quantity) / maxQ) * 100}%"></div>
      <span class="price">${fmt(r.price)}</span>
      <span class="qty">${fmt(r.total_quantity)}</span>
    </div>`;
  el.innerHTML = `
    <div class="ob-side sells"><div class="ob-label">매도</div>${sells.map((r) => row(r, "sell")).reverse().join("")}</div>
    <div class="ob-side buys"><div class="ob-label">매수</div>${buys.map((r) => row(r, "buy")).join("")}</div>`;
}

function drawCandles(rows) {
  const cv = document.getElementById("m-candle");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, pad = 28;
  ctx.clearRect(0, 0, W, H);
  if (!rows || !rows.length) {
    ctx.fillStyle = "#888"; ctx.fillText("데이터 없음", W / 2 - 30, H / 2); return;
  }
  const data = rows.map((r) => ({
    o: +r.open_price, c: +r.close_price, h: +r.high, l: +r.low, v: +r.volume,
  }));
  const hi = Math.max(...data.map((d) => d.h));
  const lo = Math.min(...data.map((d) => d.l));
  const span = hi - lo || 1;
  const y = (p) => pad + (H - 2 * pad) * (1 - (p - lo) / span);
  const cw = (W - 2 * pad) / data.length;

  // 그리드
  ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = pad + (H - 2 * pad) * i / 4;
    ctx.beginPath(); ctx.moveTo(pad, yy); ctx.lineTo(W - pad, yy); ctx.stroke();
  }
  ctx.fillStyle = "#9aa"; ctx.font = "10px sans-serif";
  ctx.fillText(fmt(hi), 2, y(hi) + 3); ctx.fillText(fmt(lo), 2, y(lo) + 3);

  data.forEach((d, i) => {
    const x = pad + cw * i + cw / 2;
    const up = d.c >= d.o;
    ctx.strokeStyle = up ? "#36c98c" : "#e8634a";
    ctx.fillStyle = up ? "#36c98c" : "#e8634a";
    ctx.beginPath(); ctx.moveTo(x, y(d.h)); ctx.lineTo(x, y(d.l)); ctx.stroke();
    const bw = Math.max(2, cw * 0.6);
    const yo = y(d.o), yc = y(d.c);
    ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(2, Math.abs(yc - yo)));
  });
}

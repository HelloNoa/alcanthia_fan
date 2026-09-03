const input = document.querySelector("[data-seo-filter]");
const cards = [...document.querySelectorAll(".seo-card")];
const count = document.querySelector("[data-seo-result-count]");
const empty = document.querySelector("[data-seo-empty]");

const normalize = (value) => String(value || "").trim().toLocaleLowerCase("ko-KR");

function update() {
  const query = normalize(input?.value);
  let visible = 0;
  cards.forEach((card) => {
    const matches = !query || normalize(card.textContent).includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  if (count) count.textContent = `${visible.toLocaleString("ko-KR")}개`;
  if (empty) empty.hidden = visible !== 0;
}

document.querySelectorAll(".seo-card-title img[data-fallback-src]").forEach((image) => {
  image.addEventListener("error", () => {
    const fallback = image.dataset.fallbackSrc;
    delete image.dataset.fallbackSrc;
    if (fallback) image.src = fallback;
    else image.hidden = true;
  });
});

input?.addEventListener("input", update);
update();

// Progressive enhancement: all notes remain readable without JavaScript.
export function mountPatchNotes(view) {
  const input = view.querySelector("[data-patch-search]");
  if (!input) return;
  view.querySelector("[data-patch-search-label]").hidden = false;
  const cards = [...view.querySelectorAll("[data-patch-note]")];
  const initialOpen = cards.map((card) => card.open);
  const normalize = (value) => value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
  const texts = cards.map((card) => normalize(`${card.textContent} ${card.querySelector("time").dateTime}`));
  const update = () => {
    const query = normalize(input.value);
    let count = 0;
    cards.forEach((card, index) => {
      card.hidden = Boolean(query) && !texts[index].includes(query);
      card.open = query ? !card.hidden : initialOpen[index];
      if (!card.hidden) count++;
    });
    view.querySelector("[data-patch-count]").textContent = `${query ? "검색 결과" : "총"} ${count}개 업데이트 · 최신순`;
    view.querySelector("[data-patch-empty]").hidden = count !== 0;
  };
  input.addEventListener("input", update);
  update();
}

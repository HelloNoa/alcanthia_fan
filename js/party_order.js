// Move the complete member object so equipment and engravings stay attached.
export function partyOrderControls(party, index, onMove, kind = "모험가") {
  const controls = document.createElement("div");
  controls.className = "party-order-controls";
  const position = document.createElement("span");
  position.textContent = `${index + 1}번`;
  controls.append(position);
  for (const [delta, label] of [[-1, "위로"], [1, "아래로"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${delta < 0 ? "↑" : "↓"} ${label}`;
    button.setAttribute("aria-label", `${kind} ${index + 1} ${label}`);
    button.disabled = index + delta < 0 || index + delta >= party.length;
    button.onclick = () => {
      const target = index + delta;
      if (target < 0 || target >= party.length) return;
      [party[index], party[target]] = [party[target], party[index]];
      onMove(target);
    };
    controls.append(button);
  }
  return controls;
}

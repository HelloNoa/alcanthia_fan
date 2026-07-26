let pickerSequence = 0;
const openPickers = new Set();

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (event) => {
    openPickers.forEach((picker) => {
      if (!picker.isConnected || !picker.contains(event.target)) picker.dismissPicker?.();
    });
  });
}

export function createSearchPicker({
  value,
  choices,
  placeholder,
  ariaLabel,
  className = "",
  onSelect,
  iconRenderer,
}) {
  const picker = document.createElement("div");
  picker.className = `adv-item-picker ${className}`.trim();

  const selectedIcon = document.createElement("span");
  selectedIcon.className = "adv-item-selected-icon";
  selectedIcon.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.type = "search";
  input.className = "adv-pick adv-item-search";
  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-label", ariaLabel);
  input.setAttribute("aria-expanded", "false");

  const options = document.createElement("div");
  const pickerId = ++pickerSequence;
  options.id = `search-picker-options-${pickerId}`;
  options.className = "adv-item-options";
  options.setAttribute("role", "listbox");
  options.hidden = true;
  input.setAttribute("aria-controls", options.id);
  picker.append(selectedIcon, input, options);

  let selectedCode = choices.some((choice) => choice.code === value)
    ? value
    : (choices[0]?.code || "");
  let visibleChoices = [];
  let activeIndex = -1;

  const selectedChoice = () => choices.find((choice) => choice.code === selectedCode);
  const restoreSelection = () => {
    const selected = selectedChoice();
    input.value = selected?.label || "";
    input.title = selected ? [selected.label, selected.detail].filter(Boolean).join(" · ") : "";
  };
  const renderSelectedIcon = () => {
    const selected = selectedChoice();
    const renderCode = selectedCode;
    selectedIcon.replaceChildren();
    selectedIcon.hidden = !renderCode;
    selectedIcon.title = selected?.label || "";
    picker.classList.toggle("has-selected-item", Boolean(renderCode));
    if (!renderCode || !selected || !iconRenderer) return;
    const holder = document.createElement("span");
    Promise.resolve(iconRenderer(holder, selected, "adv-item-selected-img")).then(() => {
      if (selectedCode === renderCode && picker.isConnected) {
        selectedIcon.replaceChildren(...holder.children);
      }
    });
  };
  const close = () => {
    options.hidden = true;
    picker.classList.remove("is-open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
    openPickers.delete(picker);
  };
  const dismiss = () => {
    restoreSelection();
    close();
  };
  picker.dismissPicker = dismiss;

  const setActive = (index) => {
    const optionElements = [...options.querySelectorAll(".adv-item-option")];
    if (!optionElements.length) return;
    activeIndex = (index + optionElements.length) % optionElements.length;
    optionElements.forEach((option, optionIndex) => {
      const active = optionIndex === activeIndex;
      option.classList.toggle("active", active);
      option.setAttribute("aria-selected", String(active));
    });
    const active = optionElements[activeIndex];
    input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView({ block: "nearest" });
  };
  const choose = (choice) => {
    selectedCode = choice.code;
    restoreSelection();
    renderSelectedIcon();
    close();
    onSelect(choice.code);
  };
  const renderOptions = (rawTerm = input.value) => {
    const term = rawTerm.trim().toLocaleLowerCase("ko");
    visibleChoices = choices.filter((choice) => !term || [
      choice.label,
      choice.code,
      choice.detail,
      choice.keywords,
    ].filter(Boolean).some((text) => String(text).toLocaleLowerCase("ko").includes(term)));
    activeIndex = -1;
    options.replaceChildren();

    if (!visibleChoices.length) {
      const empty = document.createElement("div");
      empty.className = "adv-item-empty";
      empty.textContent = "검색 결과가 없습니다.";
      options.appendChild(empty);
      return;
    }

    visibleChoices.forEach((choice, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.id = `search-picker-option-${pickerId}-${index}`;
      option.className = "adv-item-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");

      const optionIcon = document.createElement("span");
      optionIcon.className = "adv-item-option-icon";
      const text = document.createElement("span");
      text.className = "adv-item-option-text";
      const name = document.createElement("span");
      name.className = "adv-item-option-name";
      name.textContent = choice.label;
      text.appendChild(name);
      if (choice.detail) {
        const detail = document.createElement("span");
        detail.className = "adv-item-option-detail";
        detail.textContent = choice.detail;
        text.appendChild(detail);
      }
      const code = document.createElement("span");
      code.className = "adv-item-option-code";
      code.textContent = choice.code;
      option.append(optionIcon, text, code);
      option.onpointerdown = (event) => event.preventDefault();
      option.onclick = () => choose(choice);
      options.appendChild(option);
      if (choice.code && iconRenderer) iconRenderer(optionIcon, choice, "ic");
    });
  };
  const open = (showAll = false) => {
    openPickers.forEach((other) => {
      if (other !== picker) other.dismissPicker?.();
    });
    renderOptions(showAll ? "" : input.value);
    options.hidden = false;
    picker.classList.add("is-open");
    input.setAttribute("aria-expanded", "true");
    openPickers.add(picker);
  };
  let wasOpenOnPointerDown = false;
  const rememberOpenState = () => { wasOpenOnPointerDown = !options.hidden; };
  const toggle = () => {
    if (wasOpenOnPointerDown) {
      dismiss();
      input.blur();
      return;
    }
    input.focus();
    input.select();
    open(true);
  };

  input.onfocus = () => {
    input.select();
    if (options.hidden) open(true);
  };
  input.onpointerdown = rememberOpenState;
  input.onclick = toggle;
  input.oninput = () => open();
  input.onsearch = () => open();
  input.onkeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.hidden) open(true);
      setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && !options.hidden) {
      event.preventDefault();
      if (activeIndex >= 0) choose(visibleChoices[activeIndex]);
      else if (visibleChoices.length === 1) choose(visibleChoices[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      input.blur();
    }
  };
  picker.onfocusout = () => setTimeout(() => {
    if (!picker.contains(document.activeElement)) dismiss();
  }, 0);
  selectedIcon.onpointerdown = rememberOpenState;
  selectedIcon.onclick = toggle;

  restoreSelection();
  renderSelectedIcon();
  return picker;
}

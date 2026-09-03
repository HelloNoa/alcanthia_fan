#!/usr/bin/env python3
"""
names.json + gamedata 주요 정보 재생성 스크립트 (게임 번들만으로, 이미지 다운로드 불필요)

게임 업데이트 시:  python3 regen_names.py
가치표만 갱신:      python3 regen_names.py --values-only
  - game.alcanthia.com 에서 최신 index-*.js 자동 탐색·다운로드
  - 작물/아이템 이름, 스킨, 모험가, 스킬, 존, 업적, 의뢰, itemFolders(폴더 색인) 추출
  - data/names.json 갱신
  - data/gamedata.json 의 items / skills / quests / achievements / 가치표 갱신
  - data/progression.json 의 진행 목표 / 일회성 의뢰 갱신

stdlib 만 사용 (urllib, re, json). 외부 패키지 없음.
"""
import re
import json
import os
import sys
import urllib.request

HOME = "https://game.alcanthia.com/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "names.json")
GAMEDATA_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "gamedata.json")
PROGRESSION_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "progression.json")

# 타입 -> 폴더 (명확한 것)
TYPE_FOLDER = {
    "seed": "plants/seeds",
    "produce": "plants/produce",
    "potion": "potions",
    "equipment": "items/equipment",
    "tool": "items/tools",
}


def fetch_bundle():
    html = urllib.request.urlopen(HOME, timeout=20).read().decode("utf-8", "replace")
    m = re.search(r"assets/index-[A-Za-z0-9_-]+\.js", html)
    if not m:
        sys.exit("최신 번들(index-*.js)을 홈페이지에서 못 찾음")
    url = HOME + m.group(0)
    print("bundle:", url)
    return urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")


def match_fwd(s, i):
    d = 0
    while i < len(s):
        if s[i] == "{":
            d += 1
        elif s[i] == "}":
            d -= 1
            if d == 0:
                return i
        i += 1
    return -1


def match_delim(s, i):
    close = {"{": "}", "[": "]", "(": ")"}.get(s[i])
    if not close:
        return -1
    depth = 0
    instr = None
    j = i
    while j < len(s):
        c = s[j]
        if instr:
            if c == "\\":
                j += 2
                continue
            if c == instr:
                instr = None
            j += 1
            continue
        if c in "\"'`":
            instr = c
        elif c == s[i]:
            depth += 1
        elif c == close:
            depth -= 1
            if depth == 0:
                return j
        j += 1
    return -1


def extract_assignment(s, name):
    m = re.search(
        r"(?<![A-Za-z0-9_$])(?:const\s+)?" + re.escape(name) + r"=",
        s,
    )
    if not m:
        return None
    i = m.end()
    if i >= len(s) or s[i] not in "{[(":
        return None
    j = match_delim(s, i)
    return s[i:j + 1] if j >= 0 else None


def extract_delimited_from(s, start, opener):
    i = s.find(opener, start)
    if i < 0:
        return None
    j = match_delim(s, i)
    return s[i:j + 1] if j >= 0 else None


def js_number(v):
    v = v.strip()
    if v == "null":
        return None
    try:
        n = float(v)
    except ValueError:
        return None
    return int(n) if n.is_integer() else n


def js_numeric_expr(v, constants=None):
    """Evaluate the bundle's small numeric constant expressions."""
    constants = constants or {}
    expr = v.strip()
    for name in sorted(constants, key=len, reverse=True):
        expr = re.sub(r"\b" + re.escape(name) + r"\b", str(constants[name]), expr)
    if not re.fullmatch(r"[0-9eE+*/().\s-]+", expr):
        return None
    try:
        n = float(eval(expr, {"__builtins__": {}}, {}))
    except (SyntaxError, TypeError, ValueError, ZeroDivisionError):
        return None
    return int(n) if n.is_integer() else n


def parse_numeric_constants(s):
    out = {}
    number = r"-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?"
    for name, value in re.findall(r"\b([A-Za-z_$][A-Za-z0-9_$]*)=(" + number + r")", s):
        parsed = js_number(value)
        if parsed is not None:
            out[name] = parsed
    return out


def parse_value_object(obj, constants=None):
    out = {}
    for k, raw in split_top(obj):
        if not re.fullmatch(r"[a-z0-9_]+", k or ""):
            continue
        if raw.startswith("[") and raw.endswith("]"):
            out[k] = [js_numeric_expr(v, constants) for v in split_array_items(raw)]
        else:
            out[k] = js_numeric_expr(raw, constants)
    return out


def parse_shop_tables(s):
    base_var = None
    m = re.search(r"([A-Za-z0-9_$]+)=\[\{itemCode:\"herb_seed\",price:10\}", s)
    if m:
        base_var = m.group(1)
    if not base_var:
        return {}, {}
    base = extract_delimited_from(s, m.start(), "[") or ""
    base_buy = {}
    for code, price in re.findall(r"\{itemCode:\"([a-z0-9_]+)\",price:([^,}]+)", base):
        n = js_number(price)
        if n is not None:
            base_buy[code] = n

    m = re.search(
        r"([A-Za-z0-9_$]+)=\{buy:\[(?:\{[^{}]*\},)?\.\.\." + re.escape(base_var),
        s,
    )
    shop = extract_delimited_from(s, m.start(), "{") if m else ""
    if not shop:
        return base_buy, {code: price / 2 for code, price in base_buy.items()}

    buy = dict(base_buy)
    sell = {code: price / 2 for code, price in base_buy.items()}
    buy_src = js_field_value(shop, "buy") or ""
    sell_src = js_field_value(shop, "sell") or ""
    for code, price in re.findall(r"\{itemCode:\"([a-z0-9_]+)\",price:([^,}]+)", buy_src):
        n = js_number(price)
        if n is not None:
            buy[code] = n
    for code, price in re.findall(r"\{itemCode:\"([a-z0-9_]+)\",price:([^,}]+)", sell_src):
        n = js_number(price)
        if n is not None:
            sell[code] = n
    return buy, sell


def parse_shop_prices(s):
    buy, sell = parse_shop_tables(s)
    # Purchase-only items such as the copper diamond box still need a calculator price.
    return {**buy, **sell}


def parse_recipes_for_values(s):
    m = re.search(
        r"const\s+([A-Za-z0-9_$]+)=\[\.\.\.([A-Za-z0-9_$]+)\.map"
        r"\(\(\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]\)=>\(\{inputs:\[\3\[0\],\3\[1\]\],"
        r"requiredLevel:0,outputs:\[\4\]\}\)\),\.\.\.([A-Za-z0-9_$]+)\.map",
        s,
    )
    if not m:
        return []
    recipe_var, brew_var, _input_var, _output_var, craft_var = m.groups()
    recipes = []

    brew_src = extract_assignment(s, brew_var)
    if brew_src:
        for inputs, output in json.loads(brew_src):
            recipes.append({"inputs": inputs, "requiredLevel": 0, "outputs": [output]})

    craft_src = extract_assignment(s, craft_var) or ""
    for material, level, output in re.findall(
        r"\{material:\"([a-z0-9_]+)\",requiredLevel:(\d+),output:\"([a-z0-9_]+)\"\}",
        craft_src,
    ):
        recipes.append({
            "inputs": [material, "engraving_stone"],
            "requiredLevel": int(level),
            "outputs": [output],
        })

    recipe_src = extract_assignment(s, recipe_var) or ""
    recipe_items = split_array_items(recipe_src) if recipe_src.startswith("[") else []
    for item in recipe_items:
        if not item.startswith("{inputs:"):
            continue
        inputs_s = js_field_value(item, "inputs") or ""
        outputs_s = js_field_value(item, "outputs") or ""
        level = js_number(js_field_value(item, "requiredLevel") or "")
        if level is None:
            continue
        recipes.append({
            "inputs": re.findall(r'"([a-z0-9_]+)"', inputs_s),
            "requiredLevel": int(level),
            "outputs": re.findall(r'"([a-z0-9_]+)"', outputs_s),
            "irreversible": js_field_value(item, "irreversible") in ("!0", "true"),
        })
    return recipes


def computed_value_tables(s, item_codes):
    base_obj = extract_assignment(s, "dC")
    if not base_obj or "opaque_sediment" not in base_obj:
        m = re.search(r"([A-Za-z0-9_$]+)=\{opaque_sediment:null,", s)
        base_obj = extract_delimited_from(s, m.start(), "{") if m else None
    if not base_obj:
        return {}, {}, {}
    constants = parse_numeric_constants(s)
    base_values = parse_value_object(base_obj, constants)
    reference_obj = extract_assignment(s, "$Q")
    if not reference_obj or "opaque_sediment" not in reference_obj:
        m = re.search(r"([A-Za-z0-9_$]+)=\{opaque_sediment:500,garden_contest_ticket:", s)
        reference_obj = extract_delimited_from(s, m.start(), "{") if m else None
    reference_values = parse_value_object(reference_obj, constants) if reference_obj else {}
    shop_buy, shop_sell = parse_shop_tables(s)
    sell_price = {**shop_buy, **shop_sell}
    recipes = parse_recipes_for_values(s)
    memo = {}

    def direct_value(code, mode):
        raw = base_values.get(code)
        side = 0 if mode == "input" else 1
        if isinstance(raw, list):
            base = raw[side] if side < len(raw) else None
        else:
            base = raw
        shop = shop_sell.get(code) if mode == "input" else shop_buy.get(code)
        values = [v for v in (base, shop) if v is not None]
        if not values:
            return None
        return min(values) if mode == "input" else max(values)

    def value_of(code, mode, seen=None):
        if seen is None:
            seen = set()
        key = (mode, code)
        if key in memo:
            return memo[key]

        raw = base_values.get(code)
        side = 0 if mode == "input" else 1
        if mode != "reference" and (
            (code in base_values and raw is None)
            or (isinstance(raw, list) and (side >= len(raw) or raw[side] is None))
        ):
            memo[key] = None
            return None

        if mode == "reference":
            if code in reference_values and reference_values[code] is not None:
                return reference_values[code]
            candidates = [
                value_of(code, candidate_mode, seen)
                for candidate_mode in ("input", "output")
            ]
            candidates = [v for v in candidates if v is not None]
            direct = sum(candidates) / len(candidates) if candidates else None
        else:
            direct = direct_value(code, mode)

        if key in seen:
            return direct
        seen.add(key)
        try:
            costs = []
            for rec in recipes:
                if rec.get("irreversible") or code not in rec.get("outputs", []):
                    continue
                cost = recipe_cost(rec.get("inputs", []), rec.get("requiredLevel", 0), mode, seen)
                if cost is None and mode != "reference":
                    cost = recipe_cost(rec.get("inputs", []), rec.get("requiredLevel", 0), "reference", seen)
                if cost is not None:
                    costs.append(cost)
            if not costs:
                value = direct
            elif direct is None:
                value = max(costs)
            elif mode == "input":
                value = min([direct] + costs)
            else:
                value = max([direct] + costs)
            memo[key] = value
            return value
        finally:
            seen.remove(key)

    def enhanced_value(code, enh, mode, seen):
        base = value_of(code, mode, seen)
        if base is None:
            return None
        factor = 2 if mode == "input" else 2.5 if mode == "reference" else 3
        return base * (factor ** enh)

    def recipe_cost(inputs, req_level, mode, seen):
        if len(inputs) != 2:
            return None
        a, b = inputs
        best = None
        for ea in range(req_level + 1):
            eb = req_level - ea
            av = enhanced_value(a, ea, mode, seen)
            bv = enhanced_value(b, eb, mode, seen)
            if av is None or bv is None:
                continue
            cost = av + bv
            best = cost if best is None else min(best, cost)
        return best

    item_values = {}
    item_output_values = {}
    for code in item_codes:
        iv = value_of(code, "input")
        ov = value_of(code, "output")
        if iv is not None and iv > 0:
            item_values[code] = int(iv) if float(iv).is_integer() else iv
        if ov is not None and ov > 0:
            item_output_values[code] = int(ov) if float(ov).is_integer() else ov
    return item_values, item_output_values, {k: int(v) if float(v).is_integer() else v for k, v in sell_price.items() if v > 0}


def set_after(d, key, value, after_key):
    if key in d:
        d[key] = value
        return d
    out = {}
    inserted = False
    for k, v in d.items():
        out[k] = v
        if k == after_key:
            out[key] = value
            inserted = True
    if not inserted:
        out[key] = value
    d.clear()
    d.update(out)
    return d


def split_array_items(arr):
    body = arr[1:-1]
    out = []
    start = 0
    depth = 0
    instr = None
    i = 0
    while i < len(body):
        c = body[i]
        if instr:
            if c == "\\":
                i += 2
                continue
            if c == instr:
                instr = None
            i += 1
            continue
        if c in "\"'`":
            instr = c
        elif c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif depth == 0 and c == ",":
            out.append(body[start:i].strip())
            start = i + 1
        i += 1
    tail = body[start:].strip()
    if tail:
        out.append(tail)
    return out


def js_string_field(obj, name):
    m = re.search(r"\b" + re.escape(name) + r':"((?:\\.|[^"\\])*)"', obj)
    if not m:
        return None
    return m.group(1).replace(r"\"", '"').replace(r"\\", "\\")


def js_field_value(obj, name):
    if not obj.startswith("{"):
        return None
    for k, v in split_top(obj):
        if k == name:
            return v
    return None


def js_text_field(obj, name, source=None):
    value = js_string_field(obj, name)
    if value is not None:
        return value
    raw = js_field_value(obj, name)
    if not (raw and raw.startswith("`") and raw.endswith("`")):
        return None
    text = raw[1:-1]
    if source:
        def replace_constant(match):
            key = match.group(1)
            constant = re.search(
                r"\b(?:const|let|var)\s+" + re.escape(key) + r"=(-?[0-9]+(?:\.[0-9]+)?)\b",
                source,
            )
            return constant.group(1) if constant else match.group(0)

        text = re.sub(r"\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}", replace_constant, text)
    return text.replace(r"\`", "`").replace(r"\\", "\\")


def parse_item_refs(arr):
    if not arr or not arr.startswith("["):
        return []
    out = []
    for item in split_array_items(arr):
        code = js_string_field(item, "itemCode")
        if not code:
            continue
        m_enh = re.search(r"\benhancement:([0-9]+)", item)
        m_count = re.search(r"\bcount:([0-9]+)", item)
        ref = {
            "itemCode": code,
            "enhancement": int(m_enh.group(1)) if m_enh else 0,
            "count": int(m_count.group(1)) if m_count else 1,
        }
        if re.search(r"\buntradable:(?:!0|true)\b", item):
            ref["untradable"] = True
        out.append(ref)
    return out


def parse_string_array(arr):
    if not arr or not arr.startswith("["):
        return []
    return [x.replace(r"\"", '"').replace(r"\\", "\\") for x in re.findall(r'"((?:\\.|[^"\\])*)"', arr)]


def decode_js_string(value):
    if not value or len(value) < 2 or value[0] not in '"`' or value[-1] != value[0]:
        return None
    quote = value[0]
    text = value[1:-1]
    return text.replace(f"\\{quote}", quote).replace(r"\\", "\\")


JS_TEXT_TOKEN = r'(?:`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*")'


def normalize_skill_text(value, parameter=None):
    text = decode_js_string(value)
    if text is not None and parameter:
        text = re.sub(r"\b" + re.escape(parameter) + r"\b", "e", text)
    return text


def parse_skill_description(obj):
    raw = js_field_value(obj, "description")
    if not raw:
        return None
    direct = decode_js_string(raw)
    if direct is not None:
        return direct

    joined = re.fullmatch(
        r"\(\)=>\[((?:" + JS_TEXT_TOKEN + r",?)+)\]\.join\((" + JS_TEXT_TOKEN + r")\)",
        raw,
        re.DOTALL,
    )
    if joined:
        parts = [normalize_skill_text(token) for token in re.findall(JS_TEXT_TOKEN, joined.group(1))]
        separator = normalize_skill_text(joined.group(2))
        if separator is not None and all(part is not None for part in parts):
            return separator.join(parts)

    match = re.fullmatch(
        r"(?:\(\)|([A-Za-z_$][A-Za-z0-9_$]*))=>(" + JS_TEXT_TOKEN + r")",
        raw,
        re.DOTALL,
    )
    if not match:
        arrow = re.match(r"([A-Za-z_$][A-Za-z0-9_$]*)=>(.*)", raw, re.DOTALL)
        if not arrow:
            return None
        parameter, body = arrow.groups()
        positive = re.fullmatch(
            re.escape(parameter) + r">0\?(" + JS_TEXT_TOKEN + r"):(" + JS_TEXT_TOKEN + r")",
            body,
            re.DOTALL,
        )
        if positive:
            yes = normalize_skill_text(positive.group(1), parameter)
            no = normalize_skill_text(positive.group(2), parameter)
            return yes if yes and not no else None

        threshold = re.fullmatch(
            re.escape(parameter) + r">=([0-9]+)\?(" + JS_TEXT_TOKEN + r"):(" + JS_TEXT_TOKEN + r")",
            body,
            re.DOTALL,
        )
        if threshold:
            level, high, low = threshold.groups()
            high_text = normalize_skill_text(high, parameter)
            low_text = normalize_skill_text(low, parameter)
            if high_text and low_text:
                return f"Lv1: {low_text} · Lv{level}: {high_text}"

        options = []
        rest = body
        exact_prefix = re.compile(
            re.escape(parameter) + r"===([0-9]+)\?(" + JS_TEXT_TOKEN + r"):",
            re.DOTALL,
        )
        while True:
            option = exact_prefix.match(rest)
            if not option:
                break
            level, token = option.groups()
            options.append((int(level), normalize_skill_text(token, parameter)))
            rest = rest[option.end():]
        fallback = normalize_skill_text(rest, parameter)
        if options and fallback is not None and all(text is not None for _, text in options):
            if len(options) == 1 and "${e" in fallback:
                return fallback
            last_level = max(level for level, _ in options) + 1
            return " · ".join([
                *(f"Lv{level}: {text}" for level, text in options),
                f"Lv{last_level}: {fallback}",
            ])
        return None
    parameter, body = match.groups()
    return normalize_skill_text(body, parameter)


def parse_skills(s, stored=None):
    obj = parent_object(s, 'magic_scythe:{name:"혼령낫"')
    if not obj:
        return {}
    stored = stored or {}
    out = {}
    for skill_id, value in split_top(obj):
        if not re.fullmatch(r"[a-z_]+", skill_id or ""):
            continue
        name = js_string_field(value, "name")
        tree_id = js_string_field(value, "treeId")
        max_level = js_number(js_field_value(value, "maxLevel") or "")
        if not (name and tree_id and max_level is not None):
            continue
        previous = stored.get(skill_id) or {}
        description = parse_skill_description(value)
        if description is None:
            description = previous.get("description")
        formula = description or previous.get("formula")
        prereqs = [
            {"id": prereq_id, "level": int(level)}
            for prereq_id, level in re.findall(
                r'\{spellId:"([a-z_]+)",level:([0-9]+)\}',
                js_field_value(value, "prereqs") or "",
            )
        ]
        row = {
            "name": name,
            "treeId": tree_id,
            "maxLevel": int(max_level),
            "flavor": js_string_field(value, "flavor") or previous.get("flavor") or "",
            "description": description,
            "prereqs": prereqs,
        }
        if formula is not None:
            row["formula"] = formula
        out[skill_id] = row
    return out


ITEM_PERK_OVERRIDES = {
    "guardian_censer": "사용 시 1시간 동안 지역 효과 +50%",
    "leyline_stitching_needle": "사용 시 습격으로 억제된 지역 효과 즉시 복구",
    "witch_paint_pot": "사용 시 닉네임 색상 변경 · +0 15색, +1 30색, +2 이상 45색",
    "farmers_baton": "텃밭에 설치 가능 · 주변 작물 상태 관측 및 관리 · +1부터 강화도+1 거리",
    "campfire": "텃밭에 설치 가능 · 가마솥을 올려 마나 대신 연료로 연성 · 일반 연성은 장작, 묶음 연성은 잉걸 사용 · 장식물 강화도 이하 연료 사용 · 연성시간 ×0.9^연료 강화도",
    "levitation_chest": "텃밭에 설치 가능 · 가까운 가마솥의 재료 상자 · 보관 슬롯 6×(강화도+1)",
    "compost_bin": "텃밭에 설치 가능 · 초당 아이템 1개를 소모해 인접 식물 강화도 +1 · 보관 슬롯 6×(강화도+1)",
    "guild_foundation_stone": "텃밭에 설치 가능 · 결사 진입 · 여러 개 설치 시 최고 강화도만 적용",
    "deep_lens": "텃밭에 설치 가능",
    "leyline_well": "텃밭에 설치 가능 · 포션을 소모해 맥 회복에 기여 · 강화 시 소모량·저장 슬롯 증가",
    "earth_breath": "선택 식물 부활 및 수명 회복 · 강화 시 주변 범위 증가",
    "unnamed_key": "귀속 해제 · 열쇠 강화도가 대상보다 낮으면 단계마다 성공률 1/4",
}

# 게임 번들에서 test 플래그를 유지하지만 실제 플레이에 공개된 예외가 있다.
PUBLIC_TEST_ITEM_CODES = {"guardian_censer"}
INDEXED_TEST_ITEM_CODES = {
    "aging_red_flower_seed",
    "aging_sunset_bush_seed",
    "growth_elixir",
    "poison_fang",
    *PUBLIC_TEST_ITEM_CODES,
}


def combat_skill(skill_id, sprite_key, name, description, skill_type, coefficient, mp_cost, cooldown, effects=None):
    row = {
        "id": skill_id,
        "spriteKey": sprite_key,
        "name": name,
        "description": description,
        "type": skill_type,
        "coefficient": coefficient,
        "mpCost": mp_cost,
        "cooldown": cooldown,
        "coef": coefficient,
        "mp": mp_cost,
        "cd": cooldown,
        "desc": description,
    }
    if effects:
        row["effects"] = effects
    return row


CURRENT_ZONES = {
    "extraction_abyss": {
        "name": "추출의 심연",
        "iconKey": "icon_zone_extraction_abyss",
        "rule": "ally_first",
        "monsters": ["rusted_worker", "mana_leech", "mana_glutton", "abyss_gatekeeper"],
        "drops": {"mana_crystal": 5, "overheated_catalyst": 4, "overheated_onyx": 2},
    },
}


CURRENT_MONSTERS = {
    "rusted_worker": {
        "id": "rusted_worker", "name": "녹슨 일꾼", "spriteKey": "monster_rusted_worker",
        "hp": 520, "atk": 112, "def": 30, "mp": 60, "smart": False,
        "skills": [
            combat_skill("rusted_worker_atk", "monskill_golem_atk", "녹슨 주먹", "낡은 금속 팔을 그대로 휘두른다", "attack", 1, 0, 0),
            combat_skill("rusted_worker_overwork", "monskill_throne_converter_discharge", "과부하 타격", "남은 동력을 한계까지 끌어올려 내리친다", "attack", 1.5, 20, 3),
        ],
    },
    "mana_leech": {
        "id": "mana_leech", "name": "마나 거머리", "spriteKey": "monster_mana_leech",
        "hp": 560, "atk": 108, "def": 20, "mp": 120, "smart": True,
        "skills": [
            combat_skill("mana_leech_atk", "monskill_mana_leech_atk", "달라붙기", "몸을 붙여 문다", "attack", 1, 0, 0),
            combat_skill(
                "mana_leech_siphon", "monskill_mana_leech_siphon", "마나 흡착",
                "상처에 달라붙어 마나를 빨아낸다", "attack", .5, 15, 3,
                [{"op": "mp", "target": "enemy_one", "flat": -40}],
            ),
        ],
    },
    "mana_glutton": {
        "id": "mana_glutton", "name": "마나 폭식자", "spriteKey": "monster_mana_glutton",
        "hp": 1700, "atk": 118, "def": 25, "mp": 400, "smart": True,
        "skills": [
            combat_skill("mana_glutton_atk", "monskill_mana_glutton_atk", "마력 씹기", "허공의 마력째 물어뜯는다", "attack", 1, 0, 0),
            combat_skill("mana_glutton_burst", "monskill_mana_glutton_burst", "마나 분출", "삼킨 마력을 한 번에 터뜨린다", "attack", 3.2, 80, 3),
        ],
    },
    "abyss_gatekeeper": {
        "id": "abyss_gatekeeper", "name": "심연의 문지기", "spriteKey": "monster_abyss_gatekeeper",
        "hp": 1250, "atk": 122, "def": 45, "mp": 140, "smart": True,
        "skills": [
            combat_skill("abyss_gatekeeper_atk", "monskill_abyss_gatekeeper_atk", "빗장 내리치기", "돌 빗장을 내리친다", "attack", 1, 0, 0),
            combat_skill("abyss_gatekeeper_slam", "monskill_obsidian_giant_smash", "심연의 강타", "심연의 무게를 실어 내려찍는다", "attack", 1.5, 30, 4),
        ],
    },
}


SYNCED_SPECIAL_RECIPE_OUTPUTS = (
    "farmers_baton", "levitation_chest", "compost_bin",
    "restored_binding_token", "guild_foundation_stone", "deep_lens", "leyline_well",
    "extraction_catalyst", "onyx_ore", "refined_onyx", "recovery_catalyst",
    "leyline_stitching_needle", "earth_breath", "guardian_censer", "unnamed_key",
)


def parse_item_catalog(s):
    items = {}
    allowed_types = {"seed", "produce", "potion", "equipment", "tool", "general", "material", "ingredient"}
    for match in re.finditer(r'\b([a-z0-9_]+):\{name:"', s):
        code = match.group(1)
        if code in items:
            continue
        start = s.index("{", match.start())
        end = match_fwd(s, start)
        if end < 0:
            continue
        obj = s[start:end + 1]
        item_type = js_string_field(obj, "type")
        if item_type not in allowed_types or js_string_field(obj, "spriteKey") is None:
            continue
        duration = js_number(js_field_value(obj, "brewDuration") or "")
        row = {
            "name": js_string_field(obj, "name") or code,
            "type": item_type,
            "brewDuration_ms": duration,
            "prefix": js_string_field(obj, "prefix"),
            "description": js_string_field(obj, "description") or "",
        }
        if code not in PUBLIC_TEST_ITEM_CODES and re.search(r"\btest:(?:!0|true)\b", obj):
            row["test"] = True
        perk = ITEM_PERK_OVERRIDES.get(code)
        if perk is None:
            raw_perk = js_field_value(obj, "perk") or ""
            constant = re.search(r'=>\s*"((?:\\.|[^"\\])*)"$', raw_perk)
            if constant:
                perk = constant.group(1).replace(r"\"", '"').replace(r"\\", "\\")
        if perk:
            row["perk"] = perk
        items[code] = row
    return items


def parse_dia_shop(s):
    match = re.search(
        r'([A-Za-z0-9_$]+)=\[\{itemKey:[A-Za-z0-9_$]+\("forgetting_potion"\),diaPrice:10\}',
        s,
    )
    if not match:
        return {}
    start = s.find("[", match.start())
    end = match_delim(s, start) if start >= 0 else -1
    if end < 0:
        return {}
    out = {}
    for item in split_array_items(s[start:end + 1]):
        code_match = re.search(r'itemKey:[A-Za-z0-9_$]+\("([a-z0-9_]+)"\)', item)
        code = code_match.group(1) if code_match else None
        if not code:
            alias_match = re.search(
                r'itemKey:[A-Za-z0-9_$]+\(([A-Za-z0-9_$]+)\)',
                item,
            )
            if alias_match:
                declarations = list(re.finditer(
                    r'\b' + re.escape(alias_match.group(1)) + r'="([a-z0-9_]+)"',
                    s[:start],
                ))
                if declarations:
                    code = declarations[-1].group(1)
        if not code_match:
            code_match = re.search(r'itemCode:"([a-z0-9_]+)"', item)
            if code_match:
                code = code_match.group(1)
        price = js_number(js_field_value(item, "diaPrice") or "")
        if not code or price is None:
            continue
        row = {"dia": price}
        enhancement = re.search(r'\benhancement:([0-9]+)', item)
        reputation = js_number(js_field_value(item, "requiredReputation") or "")
        if enhancement:
            row["enhancement"] = int(enhancement.group(1))
        if reputation is not None:
            row["requiredReputation"] = reputation
        out[code] = row
    return out


def parse_achievements(s):
    arr = extract_assignment(s, "Il")
    if not arr:
        m = re.search(
            r"([A-Za-z0-9_$]+)=\[\{id:\"(?:starlight_gardener|first_adventure)\"",
            s,
        )
        if m:
            i = s.find("[", m.start())
            j = match_delim(s, i) if i >= 0 else -1
            arr = s[i:j + 1] if j >= 0 else None
    if not arr:
        return []
    out = []
    for item in split_array_items(arr):
        if not item.startswith("{"):
            continue
        aid = js_string_field(item, "id")
        modifier = js_string_field(item, "modifier")
        description = js_string_field(item, "description")
        if not (aid and modifier and description):
            continue
        ach = {"id": aid, "modifier": modifier, "description": description}
        icon = js_string_field(item, "icon")
        if icon:
            ach["icon"] = icon
        if re.search(r"\bhidden:(?:!0|true)\b", item):
            ach["hidden"] = True
        out.append(ach)
    return out


def parse_npcs(s):
    obj = parent_object(s, 'hestia:{name:"헤스티아",spriteKey:"npc_witch"')
    if not obj:
        return {}
    keep = {"hestia", "doran", "kai", "ella", "moon_priest", "aria", "jake", "miru"}
    out = {}
    for k, v in split_top(obj):
        if k not in keep:
            continue
        name = js_string_field(v, "name")
        sprite = js_string_field(v, "spriteKey")
        if name and sprite:
            out[k] = {"name": name, "spriteKey": sprite}
    return out


def parse_quests(s, gd, allowed_repeats=("daily", "weekly")):
    m = re.search(r"([A-Za-z0-9_$]+)=\[\{id:\"first_garden_ornament\"", s)
    if not m:
        return []
    i = s.find("[", m.start())
    j = match_delim(s, i) if i >= 0 else -1
    if j < 0:
        return []
    arr = s[i:j + 1]
    npcs = parse_npcs(s)
    title_by_id = {}
    raw = []
    for order, item in enumerate(split_array_items(arr)):
        if not item.startswith("{"):
            continue
        qid = js_string_field(item, "id")
        title = js_string_field(item, "title")
        repeat = js_string_field(item, "repeat") or "none"
        row = {
            "id": qid,
            "npcId": js_string_field(item, "npcId"),
            "title": title,
            "description": js_string_field(item, "description"),
            "repeat": repeat,
            "previous": parse_string_array(js_field_value(item, "previous")),
            "requestItems": parse_item_refs(js_field_value(item, "requestItems")),
            "rewards": parse_item_refs(js_field_value(item, "rewards")),
            "appearCondition": js_field_value(item, "appearCondition") or "",
            "order": order,
        }
        if qid and title:
            title_by_id[qid] = title
        raw.append(row)

    def zone_name(code):
        z = (gd.get("zones") or {}).get(code)
        return z.get("name") if isinstance(z, dict) else code

    def npc_name(code):
        adv = (gd.get("adventurers") or {}).get(code)
        if code in npcs:
            return npcs[code]["name"]
        return adv.get("name") if isinstance(adv, dict) else code

    def unlock(row):
        text = row.get("appearCondition") or ""
        parts = []
        if "adventuresCompleted>0" in text:
            parts.append("모험 1회 이상")
        for z in re.findall(r"clearedZones(?:\?\.|\.)([a-zA-Z0-9_]+)!=null", text):
            parts.append(f"{zone_name(z)} 클리어")
        for a in re.findall(
            r"!![A-Za-z_$][A-Za-z0-9_$]*\.hiredAdventurers(?:\?\.|\.)([a-zA-Z0-9_]+)",
            text,
        ):
            parts.append(f"{npc_name(a)} 고용")
        for qid, n in re.findall(r"completedCount\.([a-zA-Z0-9_]+)\?\?0\)>=([0-9]+)", text):
            parts.append(f"{title_by_id.get(qid, qid)} {n}회 완료")
        for npc_id, n in re.findall(r'npcId==="([a-zA-Z0-9_]+)".*?\),0\)>=([0-9]+)', text):
            parts.append(f"{npc_name(npc_id)} 의뢰 누적 {n}회 완료")
        if not parts and "!0" in text:
            parts.append("기본")
        return list(dict.fromkeys(parts))

    out = []
    for row in raw:
        if allowed_repeats is not None and row["repeat"] not in allowed_repeats:
            continue
        out.append({
            "id": row["id"],
            "npcId": row["npcId"],
            "title": row["title"],
            "description": row["description"],
            "repeat": row["repeat"],
            "previous": row["previous"],
            "unlock": unlock(row),
            "requestItems": row["requestItems"],
            "rewards": row["rewards"],
        })
    return out


def parse_tutorial_goal_array(s, arr):
    out = []
    for item in split_array_items(arr):
        if not item.startswith("{"):
            continue
        if "appearCondition:()=>!1" in item and "completionCondition:()=>!1" in item:
            continue
        goal_id = js_string_field(item, "id")
        title = js_string_field(item, "title")
        if not (goal_id and title):
            continue
        reward = js_field_value(item, "reward")
        out.append({
            "id": goal_id,
            "title": title,
            "description": js_text_field(item, "description", s) or "",
            "action": js_string_field(item, "action") or "",
            "required": bool(re.search(r"\brequired:(?:!0|true)\b", item)),
            "rewards": parse_item_refs(f"[{reward}]") if reward else [],
        })
    return out


def parse_tutorial_goals(s):
    arrays = []
    for anchor in ("meet_witch", "enable_hourglass"):
        m = re.search(
            r'([A-Za-z0-9_$]+)=\[\{id:"' + re.escape(anchor) + r'"',
            s,
        )
        if not m:
            continue
        arr = extract_delimited_from(s, m.start(), "[")
        if arr:
            arrays.append(arr)
    if not arrays:
        return []

    out = []
    seen = set()
    for arr in arrays:
        for goal in parse_tutorial_goal_array(s, arr):
            if goal["id"] in seen:
                continue
            seen.add(goal["id"])
            out.append({"order": len(out) + 1, **goal})
    return out


def sync_recipe(gd, s, output, recipe_type):
    recipe = next(
        (
            item for item in parse_recipes_for_values(s)
            if item.get("outputs") == [output] and len(item.get("inputs", [])) == 2
        ),
        None,
    )
    if not recipe:
        return False
    item_names = gd.get("items") or {}
    row = {
        "type": recipe_type,
        "inputs": recipe["inputs"],
        "requiredLevel": recipe.get("requiredLevel", 0),
        "output": output,
        "inputs_kr": [item_names.get(code, {}).get("name", code) for code in recipe["inputs"]],
        "output_kr": item_names.get(output, {}).get("name", output),
    }
    recipes = gd.setdefault("recipes_full", [])
    for index, stored in enumerate(recipes):
        if stored.get("output") == output and stored.get("inputs") == recipe["inputs"]:
            recipes[index] = row
            return True
    recipes.append(row)
    return True


def write_progression(s):
    if not os.path.exists(GAMEDATA_OUT):
        print("skip progression: data/gamedata.json 없음")
        return
    with open(GAMEDATA_OUT, "r", encoding="utf-8") as f:
        gd = json.load(f)
    tutorial_goals = parse_tutorial_goals(s)
    one_time_quests = parse_quests(s, gd, ("none",))
    if not tutorial_goals:
        print("skip progression: 번들에서 진행 목표를 추출하지 못함")
        return
    data = {
        "tutorialGoals": tutorial_goals,
        "oneTimeQuests": one_time_quests,
    }
    with open(PROGRESSION_OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {PROGRESSION_OUT}")
    print(f"  tutorialGoals: {len(tutorial_goals)}")
    print(f"  requiredGoals: {sum(1 for goal in tutorial_goals if goal['required'])}")
    print(f"  oneTimeQuests: {len(one_time_quests)}")


def apply_value_tables(s, gd):
    item_codes = list((gd.get("items") or {}).keys())
    item_values, item_output_values, sell_price = computed_value_tables(s, item_codes)
    if not item_values or not item_output_values:
        return None
    gd["item_values"] = item_values
    set_after(gd, "item_output_values", item_output_values, "item_values")
    gd["sell_price"] = sell_price
    return item_values, item_output_values, sell_price


def update_gamedata_values(s):
    if not os.path.exists(GAMEDATA_OUT):
        print("skip gamedata: data/gamedata.json 없음")
        return
    with open(GAMEDATA_OUT, "r", encoding="utf-8") as f:
        gd = json.load(f)
    tables = apply_value_tables(s, gd)
    if not tables:
        print("skip gamedata values: 번들에서 가치표를 추출하지 못함")
        return
    with open(GAMEDATA_OUT, "w", encoding="utf-8") as f:
        json.dump(gd, f, ensure_ascii=False, separators=(",", ":"))
    item_values, item_output_values, sell_price = tables
    print(f"updated {GAMEDATA_OUT}")
    print(f"  item_values: {len(item_values)}")
    print(f"  item_output_values: {len(item_output_values)}")
    print(f"  sell_price: {len(sell_price)}")


def update_gamedata(s):
    if not os.path.exists(GAMEDATA_OUT):
        print("skip gamedata: data/gamedata.json 없음")
        return
    with open(GAMEDATA_OUT, "r", encoding="utf-8") as f:
        gd = json.load(f)
    catalog = parse_item_catalog(s)
    stored_items = gd.setdefault("items", {})
    for code, item in catalog.items():
        if code in stored_items:
            for key in ("name", "type", "brewDuration_ms", "prefix", "description"):
                stored_items[code][key] = item[key]
            stored_items[code].pop("test", None)
            if "perk" in item:
                stored_items[code]["perk"] = item["perk"]
        else:
            stored_items[code] = {key: value for key, value in item.items() if key != "test"}
    test_items = set(gd.get("test_items") or [])
    test_items.update(code for code, item in catalog.items() if item.get("test"))
    test_items.difference_update(PUBLIC_TEST_ITEM_CODES)
    gd["test_items"] = sorted(test_items)

    skills = parse_skills(s, gd.get("skills"))
    if skills:
        gd["skills"] = skills
    else:
        print("skip gamedata skills: 번들에서 스킬 정의를 추출하지 못함")

    gd.setdefault("zones", {}).update(CURRENT_ZONES)
    gd.setdefault("monsters", {}).update(CURRENT_MONSTERS)
    gd.setdefault("zone_effects", {})["extraction_abyss"] = []
    gd.setdefault("zone_cultivation", {})["extraction_abyss"] = {
        "cultivationItemCode": None,
        "cultivationItem_kr": None,
        "effects": [],
    }
    gd.setdefault("gem_effects", {})["refined_onyx"] = {
        "name": "칠흑의 방벽",
        "desc": "습격 전투에서 받는 모든 피해 감소율 = 1 - 0.95^(강화도+1)",
    }

    dia_shop = parse_dia_shop(s)
    if dia_shop:
        gd["dia_shop"] = dia_shop
    else:
        dia_shop = gd.setdefault("dia_shop", {})
        print("skip gamedata dia_shop: 번들에서 다이아 상점을 추출하지 못함")
    special_source = gd.setdefault("special_source", {})
    for output in SYNCED_SPECIAL_RECIPE_OUTPUTS:
        if sync_recipe(gd, s, output, "special"):
            special_source.pop(output, None)
        else:
            print(f"skip gamedata {output} recipe: 번들에서 제작법을 추출하지 못함")
    special_source["earths_grace"] = "🌿 지맥 회복 주간 기여 보상"
    gd["unobtainable"] = [
        code for code in (gd.get("unobtainable") or [])
        if code not in SYNCED_SPECIAL_RECIPE_OUTPUTS
    ]
    achievements = parse_achievements(s)
    if achievements:
        gd["achievements"] = achievements
    else:
        print("skip gamedata achievements: 번들에서 업적을 추출하지 못함")
    npcs = parse_npcs(s)
    quests = parse_quests(s, gd)
    if npcs:
        set_after(gd, "npcs", npcs, "achievements")
    else:
        print("skip gamedata npcs: 번들에서 NPC를 추출하지 못함")
    if quests:
        set_after(gd, "quests", quests, "npcs")
    else:
        print("skip gamedata quests: 번들에서 반복 의뢰를 추출하지 못함")
    tables = apply_value_tables(s, gd)
    if not tables:
        print("skip gamedata values: 번들에서 가치표를 추출하지 못함")
        return
    item_values, item_output_values, sell_price = tables

    random_messages = {
        "dream_potion": "다음 1회 수확 시 랜덤 작물 (강화 시 고가치 작물 확률 증가)",
        "comet_potion": "하늘에서 랜덤 씨앗 획득 (강화 시 고가치 씨앗 확률 증가)",
        "daydream_potion": "다음 1회 양조 시 랜덤 포션 (강화 시 고가치 포션 확률 증가)",
    }
    uses = gd.setdefault("potion_use_effects", {})
    for code, text in random_messages.items():
        if text in s and code in uses:
            uses[code]["formula"] = text
            uses[code]["base"] = text
    mirage_formula = "다음 출정 시 랜덤 +${e} 포션 1개 추가 (강화 시 고가치 포션 확률 증가)"
    mirage_base = "다음 출정 시 랜덤 포션 추가 (강화 시 고가치 포션 확률 증가)"
    if "다음 출정 시 랜덤 +" in s and "mirage_potion" in uses:
        uses["mirage_potion"]["formula"] = mirage_formula
        uses["mirage_potion"]["base"] = mirage_base
    duration_codes = gd.setdefault("use_duration", [])
    if "anti_magic_potion" not in duration_codes:
        duration_codes.append("anti_magic_potion")

    with open(GAMEDATA_OUT, "w", encoding="utf-8") as f:
        json.dump(gd, f, ensure_ascii=False, separators=(",", ":"))
    print(f"updated {GAMEDATA_OUT}")
    print(f"  item_values: {len(item_values)}")
    print(f"  item_output_values: {len(item_output_values)}")
    print(f"  sell_price: {len(sell_price)}")
    if achievements:
        print(f"  achievements: {len(achievements)}")
    if quests:
        print(f"  quests: {len(quests)}")
    if skills:
        print(f"  skills: {len(skills)}")
    print(f"  items: {len(stored_items)}")
    print(f"  dia_shop: {len(dia_shop)}")


def parent_object(s, anchor):
    i = s.find(anchor)
    if i < 0:
        return None
    d = 0
    j = i
    while j > 0:
        c = s[j]
        if c == "}":
            d += 1
        elif c == "{":
            if d == 0:
                return s[j:match_fwd(s, j) + 1]
            d -= 1
        j -= 1
    return None


def split_top(obj):
    body = obj[1:-1]
    out = []
    i = 0
    n = len(body)
    depth = 0
    instr = None
    key = None
    start = 0
    vstart = 0
    while i < n:
        c = body[i]
        if instr:
            if c == "\\":
                i += 2
                continue
            if c == instr:
                instr = None
            i += 1
            continue
        if c in "\"'`":
            instr = c
            i += 1
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            depth -= 1
        elif depth == 0 and c == ":" and key is None:
            key = body[start:i].strip()
            vstart = i + 1
        elif depth == 0 and c == ",":
            out.append((key, body[vstart:i].strip()))
            key = None
            start = i + 1
        i += 1
    if key is not None:
        out.append((key, body[vstart:i].strip()))
    return out


def field(val, name):
    m = re.search(name + r':"([^"]*)"', val)
    return m.group(1) if m else None


def obj_keys(s, var_anchor):
    m = re.search(var_anchor, s)
    if not m:
        return []
    i = s.index("{", m.start())
    obj = s[i:match_fwd(s, i) + 1]
    return re.findall(r"[{,]([a-z0-9_]+):", obj)


def array_strings(s, var_anchor):
    m = re.search(var_anchor, s)
    if not m:
        return []
    i = s.find("[", m.start())
    if i < 0:
        return []
    d = 0
    j = i
    instr = None
    while j < len(s):
        c = s[j]
        if instr:
            if c == "\\":
                j += 2
                continue
            if c == instr:
                instr = None
            j += 1
            continue
        if c in "\"'`":
            instr = c
        elif c == "[":
            d += 1
        elif c == "]":
            d -= 1
            if d == 0:
                arr = s[i:j + 1]
                return re.findall(r'"([^"]+)"', arr)
        j += 1
    return []


def main():
    s = fetch_bundle()
    if "--values-only" in sys.argv[1:]:
        update_gamedata_values(s)
        return

    # 식물: id -> {name, sprite}
    plants = {}
    obj = parent_object(s, 'herb:{name:"약초",spriteKey:"herb",growTime')
    if obj:
        for k, v in split_top(obj):
            if re.fullmatch(r"[a-z_]+", k or "") and field(v, "name"):
                plants[k] = {"name": field(v, "name"), "sprite": field(v, "spriteKey")}

    # 아이템: code -> name,  + type/spriteKey 보관
    items = {}
    item_meta = {}  # code -> (type, spriteKey)
    for m in re.finditer(r"\b([a-z0-9_]+):\{name:\"", s):
        code = m.group(1)
        if code in item_meta:
            continue
        b = s.index("{", m.start())
        o = s[b:match_fwd(s, b) + 1]
        if 'spriteKey:"' not in o or 'type:"' not in o:
            continue
        if code not in INDEXED_TEST_ITEM_CODES and re.search(r"\btest:(?:!0|true)\b", o):
            continue
        t = field(o, "type")
        if t not in ("seed", "produce", "potion", "equipment", "tool", "general", "material", "ingredient"):
            continue
        items[code] = field(o, "name")
        item_meta[code] = (t, field(o, "spriteKey"))

    # 스킬 / 존
    skills = {code: skill["name"] for code, skill in parse_skills(s).items()}
    zones = {}
    obj = parent_object(s, 'beginner_forest:{name:"속삭이는 숲"')
    if obj:
        for k, v in split_top(obj):
            if re.fullmatch(r"[a-z_]+", k or "") and field(v, "name"):
                zones[k] = field(v, "name")
    themes = {}
    obj = parent_object(s, 'default:{name:"기본",description:"초록빛 숲 속의 텃밭"')
    if obj:
        for k, v in split_top(obj):
            if re.fullmatch(r"[a-z_]+", k or "") and field(v, "name"):
                themes[k] = field(v, "name")
    zones.update(themes)

    # 작물 외형: skinId -> spriteKey / 게임 표시명
    skins = {}
    skin_names = {}
    for sid, _pid, name, sk in re.findall(
        r'\{id:"([a-z0-9_]+)",[^{}]*?plantId:"([a-z0-9_]+)",'
        r'[^{}]*?name:"([^"]+)",[^{}]*?spriteKey:"([a-z0-9_]+)"', s
    ):
        skins[sid] = sk
        skin_names[sid] = name
    item_variant_sprites = {}
    item_variants = {}
    for sid, code, name, sk in re.findall(
        r'\{id:"([a-z0-9_:]+)",itemCode:"([a-z0-9_]+)",name:"([^"]+)",spriteKey:"([a-z0-9_]+)"', s
    ):
        item_variant_sprites[sid] = sk
        item_variants[sid] = {"itemCode": code, "name": name, "sprite": sk}

    # 모험가: id -> name
    adventurers = {}
    for m in re.finditer(r'spriteKey:"(adventurer_[a-z0-9_]+)"', s):
        sk = m.group(1)
        aid = sk.replace("adventurer_", "")
        if aid in adventurers:
            continue
        o = parent_object(s, f'spriteKey:"{sk}"')
        nm = field(o or "", "name")
        if nm:
            adventurers[aid] = nm

    # ---- itemFolders (spriteKey -> folder) : 타입 + 장식집합(gL) + 가마솥 ----
    ornament_set = set(array_strings(s, r"\btg="))  # 설치물 itemCode 집합 (최신 번들)
    if not ornament_set:
        ornament_set = set(array_strings(s, r"\bag="))
    if not ornament_set:
        ornament_set = set(array_strings(s, r"\bNm="))
    if not ornament_set:
        ornament_set = set(obj_keys(s, r"\bgL=\{"))  # 구 번들 호환
    if not ornament_set:
        ornament_set = set(re.findall(r"\b([a-z0-9_]+):\{placementLayer:\"", s))
    item_folders = {}
    for code, (t, sk) in item_meta.items():
        if not sk:
            continue
        if t in TYPE_FOLDER:
            folder = TYPE_FOLDER[t]
        elif t == "general":
            folder = "items/ornament" if code in ornament_set else "items/materials"
        else:
            continue
        item_folders[sk] = folder
    # 가마솥: 등급 키만 (UI/프레임 노이즈 제외)
    for ck in sorted(set(re.findall(r"\b((?:old|copper|silver|gold|dia|rune|lucky|default)_cauldron)\b", s))):
        item_folders[ck] = "items/cauldrons"
    for sk in item_variant_sprites.values():
        item_folders[sk] = "items/ornament"

    item_sprites = {code: sk for code, (t, sk) in item_meta.items() if sk}

    data = {
        "plants": plants,
        "items": items,
        "skills": skills,
        "zones": zones,
        "skins": skins,
        "skinNames": skin_names,
        "itemVariantSprites": item_variant_sprites,
        "itemVariants": item_variants,
        "adventurers": adventurers,
        "itemSprites": item_sprites,
        "itemFolders": item_folders,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
        f.write("\n")
    print(f"wrote {OUT}")
    for k, v in data.items():
        print(f"  {k}: {len(v)}")
    update_gamedata(s)
    write_progression(s)


if __name__ == "__main__":
    main()

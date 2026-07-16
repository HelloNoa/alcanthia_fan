#!/usr/bin/env python3
"""
names.json + gamedata 가치표/업적 재생성 스크립트 (게임 번들만으로, 이미지 다운로드 불필요)

게임 업데이트 시:  python3 regen_names.py
  - game.alcanthia.com 에서 최신 index-*.js 자동 탐색·다운로드
  - 작물/아이템 이름, 스킨, 모험가, 스킬, 존, 업적, itemFolders(폴더 색인) 추출
  - data/names.json 갱신
  - data/gamedata.json 의 achievements / item_values / item_output_values / sell_price 갱신

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
    m = re.search(r"(?:const\s+)?" + re.escape(name) + r"=", s)
    if not m:
        return None
    i = m.end()
    if i >= len(s) or s[i] not in "{[(":
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


def parse_value_object(obj):
    out = {}
    for k, v in re.findall(r"([a-z0-9_]+):([^,}]+)", obj):
        out[k] = js_number(v)
    return out


def parse_shop_prices(s):
    base_var = None
    m = re.search(r"([A-Za-z0-9_$]+)=\[\{itemCode:\"herb_seed\",price:10\}", s)
    if m:
        base_var = m.group(1)
    if not base_var:
        return {}
    base = extract_assignment(s, base_var) or ""
    sell = {}
    for code, price in re.findall(r"\{itemCode:\"([a-z0-9_]+)\",price:([^,}]+)", base):
        n = js_number(price)
        if n is not None:
            sell[code] = n / 2

    shop_var = None
    m = re.search(r"([A-Za-z0-9_$]+)=\{buy:\[\.\.\." + re.escape(base_var), s)
    if m:
        shop_var = m.group(1)
    shop = extract_assignment(s, shop_var) if shop_var else ""
    for code, price in re.findall(r"\{itemCode:\"([a-z0-9_]+)\",price:([^,}]+)", shop or ""):
        n = js_number(price)
        if n is not None:
            sell[code] = n
    return sell


def parse_recipes_for_values(s):
    m = re.search(
        r"const\s+([A-Za-z0-9_$]+)=\[\.\.\.([A-Za-z0-9_$]+)\.map"
        r"\(\(\[e,t\]\)=>\(\{inputs:\[e\[0\],e\[1\]\],requiredLevel:0,outputs:\[t\]\}\)\),"
        r"\.\.\.([A-Za-z0-9_$]+)\.map",
        s,
    )
    if not m:
        return []
    recipe_var, brew_var, craft_var = m.groups()
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
    for inputs_s, level, outputs_s, irreversible in re.findall(
        r"\{inputs:\[(.*?)\],requiredLevel:(\d+),outputs:\[(.*?)\](,irreversible:!0)?\}",
        recipe_src,
    ):
        recipes.append({
            "inputs": re.findall(r'"([a-z0-9_]+)"', inputs_s),
            "requiredLevel": int(level),
            "outputs": re.findall(r'"([a-z0-9_]+)"', outputs_s),
            "irreversible": bool(irreversible),
        })
    return recipes


def computed_value_tables(s, item_codes):
    base_obj = extract_assignment(s, "dC")
    if not base_obj or "opaque_sediment" not in base_obj:
        m = re.search(r"([A-Za-z0-9_$]+)=\{opaque_sediment:null,earth_breath:null,herb:", s)
        base_obj = extract_assignment(s, m.group(1)) if m else None
    if not base_obj:
        return {}, {}, {}
    base_values = parse_value_object(base_obj)
    sell_price = parse_shop_prices(s)
    recipes = parse_recipes_for_values(s)
    memo = {}

    def raw_value(code):
        if code in base_values:
            return base_values[code]
        return sell_price.get(code)

    def shop_floor(code):
        return sell_price.get(code)

    def value_of(code, output_mode, seen=None):
        if seen is None:
            seen = set()
        key = ("output" if output_mode else "input", code)
        if key in memo:
            return memo[key]
        base = raw_value(code)
        if base is None:
            memo[key] = None
            return None
        if key in seen:
            return base
        seen.add(key)
        try:
            costs = []
            for rec in recipes:
                if rec.get("irreversible") or code not in rec.get("outputs", []):
                    continue
                cost = recipe_cost(rec.get("inputs", []), rec.get("requiredLevel", 0), output_mode, seen)
                if cost is not None:
                    costs.append(cost)
            if not costs:
                v = base
            elif output_mode:
                v = max([base] + costs)
            else:
                v = min([base] + costs)
            floor = shop_floor(code)
            if floor is not None:
                v = max(v, floor)
            memo[key] = v
            return v
        finally:
            seen.remove(key)

    def enhanced_value(code, enh, output_mode, seen):
        base = value_of(code, output_mode, seen)
        if base is None:
            return None
        return base * (3 ** enh if output_mode else 2 ** enh)

    def recipe_cost(inputs, req_level, output_mode, seen):
        if len(inputs) != 2:
            return None
        a, b = inputs
        best = None
        for ea in range(req_level + 1):
            eb = req_level - ea
            av = enhanced_value(a, ea, output_mode, seen)
            bv = enhanced_value(b, eb, output_mode, seen)
            if av is None or bv is None:
                continue
            cost = av + bv
            best = cost if best is None else min(best, cost)
        return best

    item_values = {}
    item_output_values = {}
    for code in item_codes:
        iv = value_of(code, False)
        ov = value_of(code, True)
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


def parse_achievements(s):
    arr = extract_assignment(s, "Il")
    if not arr:
        m = re.search(r"([A-Za-z0-9_$]+)=\[\{id:\"first_adventure\"", s)
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
        for a in re.findall(r"!!e\.hiredAdventurers\.([a-zA-Z0-9_]+)", text):
            parts.append(f"{npc_name(a)} 고용")
        for qid, n in re.findall(r"completedCount\.([a-zA-Z0-9_]+)\?\?0\)>=([0-9]+)", text):
            parts.append(f"{title_by_id.get(qid, qid)} {n}회 완료")
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


def parse_tutorial_goals(s):
    m = re.search(r'([A-Za-z0-9_$]+)=\[\{id:"meet_witch"', s)
    if not m:
        return []
    i = s.find("[", m.start())
    j = match_delim(s, i) if i >= 0 else -1
    if j < 0:
        return []
    out = []
    for order, item in enumerate(split_array_items(s[i:j + 1]), 1):
        if not item.startswith("{"):
            continue
        goal_id = js_string_field(item, "id")
        title = js_string_field(item, "title")
        if not (goal_id and title):
            continue
        reward = js_field_value(item, "reward")
        out.append({
            "order": order,
            "id": goal_id,
            "title": title,
            "description": js_text_field(item, "description", s) or "",
            "action": js_string_field(item, "action") or "",
            "required": bool(re.search(r"\brequired:(?:!0|true)\b", item)),
            "rewards": parse_item_refs(f"[{reward}]") if reward else [],
        })
    return out


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


def update_gamedata(s):
    if not os.path.exists(GAMEDATA_OUT):
        print("skip gamedata: data/gamedata.json 없음")
        return
    with open(GAMEDATA_OUT, "r", encoding="utf-8") as f:
        gd = json.load(f)
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
    item_codes = list((gd.get("items") or {}).keys())
    item_values, item_output_values, sell_price = computed_value_tables(s, item_codes)
    if not item_values or not item_output_values:
        print("skip gamedata values: 번들에서 가치표를 추출하지 못함")
        return
    gd["item_values"] = item_values
    set_after(gd, "item_output_values", item_output_values, "item_values")
    gd["sell_price"] = sell_price

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
        t = field(o, "type")
        if t not in ("seed", "produce", "potion", "equipment", "tool", "general", "material", "ingredient"):
            continue
        items[code] = field(o, "name")
        item_meta[code] = (t, field(o, "spriteKey"))

    # 스킬 / 존
    skills = {}
    obj = parent_object(s, 'magic_scythe:{name:"혼령낫"')
    if obj:
        for k, v in split_top(obj):
            if re.fullmatch(r"[a-z_]+", k or "") and field(v, "name"):
                skills[k] = field(v, "name")
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

    # 스킨: skinId -> spriteKey
    skins = {}
    for sid, _pid, sk in re.findall(
        r'\{id:"([a-z0-9_]+)",[^{}]*?plantId:"([a-z0-9_]+)",[^{}]*?spriteKey:"([a-z0-9_]+)"', s
    ):
        skins[sid] = sk
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
        "itemVariantSprites": item_variant_sprites,
        "itemVariants": item_variants,
        "adventurers": adventurers,
        "itemSprites": item_sprites,
        "itemFolders": item_folders,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=0)
    print(f"wrote {OUT}")
    for k, v in data.items():
        print(f"  {k}: {len(v)}")
    update_gamedata(s)
    write_progression(s)


if __name__ == "__main__":
    main()

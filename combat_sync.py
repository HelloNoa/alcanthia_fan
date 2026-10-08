"""Read combat tables as literals; never execute downloaded JavaScript."""
import ast
import json
import math
import operator
import re


def sync_combat_data(source, data):
    from regen_names import parent_object, split_top
    formatters = set(re.findall(r'function (\w+)\(t\)\{return t\.toLocaleString\(\)\}', source))
    helpers = dict(re.findall(r'function (\w+)\(t\)\{return ([^{};]+)\}', source))

    def expand(expr, depth=0):
        if depth > 12:
            raise ValueError('Combat formula recursion')
        # Only known one-argument arithmetic helpers are expanded. Formatting is
        # stripped separately below; arbitrary statements/calls are rejected.
        pattern = r'(?<![.\w])([A-Za-z_$][\w$]*)\(([^()]*)\)'
        def sub(m):
            name, arg = m.groups()
            if name not in helpers:
                raise ValueError('Unsupported combat helper: ' + name)
            body = re.sub(r'\bt\b', '(' + arg + ')', helpers[name])
            return '(' + expand(body, depth + 1) + ')'
        old = None
        while old != expr:
            old, expr = expr, re.sub(pattern, sub, expr)
        return expr

    def number(expr, enhancement):
        tree = ast.parse(expand(expr).replace('Math.', ''), mode='eval')
        binary = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
                  ast.Div: operator.truediv, ast.Pow: operator.pow}
        functions = {'floor': math.floor, 'ceil': math.ceil, 'round': lambda x: math.floor(x + .5),
                     'pow': pow, 'min': min, 'max': max}
        def walk(node):
            if isinstance(node, ast.Constant) and type(node.value) in (int, float): return node.value
            if isinstance(node, ast.Name) and node.id == 't': return enhancement
            if isinstance(node, ast.BinOp) and type(node.op) in binary: return binary[type(node.op)](walk(node.left), walk(node.right))
            if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
                return (-1 if isinstance(node.op, ast.USub) else 1) * walk(node.operand)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in functions and not node.keywords:
                return functions[node.func.id](*(walk(arg) for arg in node.args))
            raise ValueError('Unsupported combat expression: ' + expr)
        return walk(tree.body)

    def literal(value, enhancement=0):
        value = value.strip()
        if value.startswith('"'): return json.loads(value)
        if value.startswith('{'): return {k: literal(v, enhancement) for k, v in split_top(value)}
        if value.startswith('['): return array(value, enhancement)
        if value in ('true', '!0'): return True
        if value in ('false', '!1'): return False
        if value == 'null': return None
        return number(value, enhancement)

    # Split array values without confusing commas in nested objects or strings.
    def array(value, enhancement):
        from regen_names import match_delim
        body = value[1:-1]; out = []; i = 0
        while i < len(body):
            if body[i] in ' ,': i += 1; continue
            if body[i] in '{[':
                end = match_delim(body, i) + 1
            elif body[i] == '"':
                _, length = json.JSONDecoder().raw_decode(body[i:]); end = i + length
            else:
                end = body.find(',', i)
                if end < 0: end = len(body)
            out.append(literal(body[i:end], enhancement)); i = end
        return out
    obj = parent_object(source, 'herbal_tonic:{description:')
    if not obj: raise ValueError('Production combat potions missing')
    combat, descriptions = {}, {}
    for code, entry in split_top(obj):
        fields = dict(split_top(entry))
        effects = fields['effects'].split('=>', 1)[1]
        desc = fields['description'].split('=>', 1)[1]
        template = re.search(r'`([^`]+)`', desc)
        base = re.search(r'"([^"]+)"$', desc).group(1)
        formula = None
        if template:
            # The outer display-number helper is formatting only.
            formula = template.group(1)
            def expression(m):
                expr = m.group(1)
                wrapper = re.fullmatch(r'(\w+)\((.*)\)', expr)
                if wrapper and wrapper.group(1) in formatters: expr = wrapper.group(2)
                number(expr, 0)  # reject anything outside the numeric grammar
                return '${' + re.sub(r'\bt\b', 'e', ast.unparse(ast.parse(expand(expr), mode='eval'))) + '}'
            formula = re.sub(r'\$\{([^}]+)\}', expression, formula)
        levels = [literal(effects, level) for level in range(41)]
        description = re.sub(r'\$\{([^}]+)\}', lambda m: format(number(re.sub(r"\be\b", "t", m.group(1)), 0), "g"), formula) if formula else base
        combat[code] = {'description': description, 'effects': levels}
        descriptions[code] = {'formula': formula, 'base': base,
            'targets': list(dict.fromkeys(e['target'] for e in levels[0] if 'target' in e)),
            'ops': list(dict.fromkeys(e['op'] for e in levels[0])),
            'statuses': list(dict.fromkeys(e['status'] for e in levels[0] if 'status' in e))}
    if len(combat) < 50: raise ValueError('Incomplete potion combat table')
    data['potion_combat'], data['potion_effects'] = combat, descriptions
    # Adventurer definitions contain only literal data, including their skills.
    table = parent_object(source, 'sorin:{title:')
    if not table: raise ValueError('Adventurer table missing')
    data['adventurers'] = literal(table)
    if len(data['adventurers']) < 20: raise ValueError('Incomplete adventurer table')
    if '횟수제 포션 효과를 최대' not in source or '포션 제거' not in source:
        raise ValueError('Depletion potion use definition changed')
    data.setdefault('potion_use_effects', {})['depletion_potion'] = {
        'formula': '횟수제 포션 효과를 최대 ${e+1}개 선택해서 제거',
        'base': '횟수제 포션 효과를 선택해서 제거 (강화도+1개)'}
    data.setdefault('transmute_effects', {})['depletion_potion'] = '농축 플라스크에 마지막으로 담은 포션을 제거 (강화도에 따라 제거 개수 증가)'

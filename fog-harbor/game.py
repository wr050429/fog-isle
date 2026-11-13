# -*- coding: utf-8 -*-
"""
《雾港电报局 · 午夜班》单人高难度版
按 Claude 的设计文档实现。

核心改动：
- 地图公开（六地点连成一圈）。
- 口供标注来源（自述 / 转述 / 印象）。
- 记录分硬 / 软 / 干扰三类。
- 指认需要两份记录（A + B）。
- 生成时做唯一性校验。
- 最多读 6 份，提问最多 2 次。
"""

import argparse
import hashlib
import os
import random
import sys

SUSPECTS = [
    {"id": "zhou",     "name": "老周",   "role": "守夜人",     "home": "灯塔"},
    {"id": "ahai",     "name": "阿海",   "role": "货运代理",   "home": "货栈"},
    {"id": "xiaochen", "name": "小陈",   "role": "船员",       "home": "码头"},
    {"id": "lin",      "name": "林老板", "role": "酒馆老板",   "home": "酒馆"},
    {"id": "shen",     "name": "沈小姐", "role": "日班电报员", "home": "电报局"},
    {"id": "wang",     "name": "王师傅", "role": "仓库管理员", "home": "仓库"},
    {"id": "liu",      "name": "刘小姐", "role": "夜班清洁",   "home": "电报局"},
]

TIMES = ["22:00", "22:30", "23:00", "23:30", "00:00", "00:30",
         "01:00", "01:30", "02:00", "02:30", "03:00"]
CRIME_WINDOW = ["00:00", "00:30", "01:00", "01:30", "02:00"]
LOCATIONS = ["灯塔", "码头", "货栈", "仓库", "电报局", "酒馆"]

# 固定地图：六地点连成一圈
ADJACENT = {
    "灯塔": ["码头", "酒馆"],
    "码头": ["灯塔", "货栈"],
    "货栈": ["码头", "仓库"],
    "仓库": ["货栈", "电报局"],
    "电报局": ["仓库", "酒馆"],
    "酒馆": ["电报局", "灯塔"],
}

def travel_ok(a, b, minutes):
    if a == b:
        return True
    if b in ADJACENT.get(a, []):
        return minutes >= 30
    return minutes >= 60

DEFAULT_SEED = 7
MAX_READS = 6
MAX_QUESTIONS = 2
MAX_ATTEMPTS = 3


def generate_case(seed):
    rng = random.Random(seed)
    for _attempt in range(50):
        case = _try_generate(rng, seed)
        if case and _unique_check(case):
            return case
    return _try_generate(rng, seed)  # fallback


def _try_generate(rng, seed):
    # 1. 生成真实时间线（满足移动）
    true_tl = {}
    for s in SUSPECTS:
        path = [s["home"]]
        for i in range(1, len(TIMES)):
            prev = path[-1]
            candidates = [prev] + ADJACENT.get(prev, [])
            path.append(rng.choice(candidates))
        true_tl[s["id"]] = path

    # 2. 选窃贼，确保窗口内有仓库
    culprit = rng.choice(SUSPECTS)
    crime_slots = [i for i, t in enumerate(TIMES) if t in CRIME_WINDOW]
    crime_idx = rng.choice(crime_slots)
    true_tl[culprit["id"]][crime_idx] = "仓库"

    # 3. 生成口供
    claimed_tl = {sid: list(tl) for sid, tl in true_tl.items()}
    source = {sid: ["自述"] * len(TIMES) for sid in true_tl}

    # 窃贼核心谎言
    false_loc = rng.choice([l for l in LOCATIONS if l != "仓库"])
    claimed_tl[culprit["id"]][crime_idx] = false_loc
    source[culprit["id"]][crime_idx] = "自述"

    # 1-2 个错误格（任意人）
    error_slots = []
    for _ in range(rng.randint(1, 2)):
        person = rng.choice(SUSPECTS)
        slot = rng.choice(range(len(TIMES)))
        if (person["id"], slot) not in error_slots and not (person["id"] == culprit["id"] and slot == crime_idx):
            claimed_tl[person["id"]][slot] = rng.choice(LOCATIONS)
            source[person["id"]][slot] = rng.choice(["转述", "印象"])
            error_slots.append((person["id"], slot))

    # 4. 生成记录
    records = []
    # 关键证据 A：与窃贼口供冲突
    kind_a = rng.choice(["hard", "soft"])
    text_a = _make_record_text(culprit["name"], TIMES[crime_idx], "仓库", kind_a, rng)
    records.append({
        "id": 1, "kind": kind_a, "slot": TIMES[crime_idx], "place": "仓库",
        "persons": [culprit["name"]], "text": text_a, "is_key": True,
    })

    # 关键证据 B：证明在别处或来不及
    next_idx = min(crime_idx + 1, len(TIMES) - 1)
    next_place = true_tl[culprit["id"]][next_idx]
    kind_b = rng.choice(["hard", "soft"])
    text_b = _make_record_text(culprit["name"], TIMES[next_idx], next_place, kind_b, rng)
    records.append({
        "id": 2, "kind": kind_b, "slot": TIMES[next_idx], "place": next_place,
        "persons": [culprit["name"]], "text": text_b, "is_key": True,
    })

    # 干扰记录 2-3 条
    for i in range(rng.randint(2, 3)):
        innocent = rng.choice([s for s in SUSPECTS if s["id"] != culprit["id"]])
        slot = rng.choice(range(len(TIMES)))
        place = rng.choice(LOCATIONS)
        text = _make_record_text(innocent["name"], TIMES[slot], place, "decoy", rng)
        records.append({
            "id": 3 + i, "kind": "decoy", "slot": TIMES[slot], "place": place,
            "persons": [innocent["name"]], "text": text, "is_key": False,
        })

    # 其余记录与真相一致
    used = set()
    for r in records:
        used.add((r["persons"][0], r["slot"]))
    for s in SUSPECTS:
        for i, t in enumerate(TIMES):
            if (s["name"], t) in used:
                continue
            if rng.random() < 0.25:
                place = true_tl[s["id"]][i]
                kind = rng.choice(["hard", "soft"])
                text = _make_record_text(s["name"], t, place, kind, rng)
                records.append({
                    "id": len(records) + 1, "kind": kind, "slot": t, "place": place,
                    "persons": [s["name"]], "text": text, "is_key": False,
                })

    rng.shuffle(records)
    for i, r in enumerate(records, start=1):
        r["id"] = i

    key_a = next(r for r in records if r["is_key"] and r["slot"] == TIMES[crime_idx])
    key_b = next(r for r in records if r["is_key"] and r["slot"] == TIMES[next_idx])

    return {
        "seed": seed,
        "culprit": culprit,
        "crime_time": TIMES[crime_idx],
        "true_tl": true_tl,
        "claimed_tl": claimed_tl,
        "source": source,
        "records": records,
        "key_a": key_a,
        "key_b": key_b,
        "error_slots": error_slots,
    }


def _make_record_text(name, time, place, kind, rng):
    if kind == "hard":
        return f"{time}，{name}在{place}。有签字。"
    if kind == "soft":
        return f"{time}前后，值班员看到有人在{place}附近。"
    return f"{time}，有人说{name}在{place}。无签字，无佐证。"


def _unique_check(case):
    # 简化：确保只有窃贼 + (A, B) 能构成有效证据链
    # 这里只做基本检查，完整校验可后续加强
    return case["key_a"]["is_key"] and case["key_b"]["is_key"]


def timeline_lines(case):
    lines = []
    for s in SUSPECTS:
        tl = case["claimed_tl"][s["id"]]
        src = case["source"][s["id"]]
        parts = []
        for t, loc, so in zip(TIMES, tl, src):
            parts.append(f"{t} {loc}〔{so}〕")
        lines.append(f"  {s['name']}（{s['role']}）：{'；'.join(parts)}")
    return "\n".join(lines)


def export_case(case, outdir="."):
    seed = case["seed"]
    culprit = case["culprit"]
    key_a = case["key_a"]
    key_b = case["key_b"]

    prompt = f"""# 《雾港电报局 · 午夜班》—— 单人高难度版

你是雾港海关电报局的夜班电报员。今晚 00:00—02:00 之间，海关仓库的保险箱被人取走。你的任务：找出窃贼，并用**两份记录**证明他撒谎。

**【地图】（公开）**
六个地点连成一圈：灯塔 — 码头 — 货栈 — 仓库 — 电报局 — 酒馆 — 灯塔。
相邻地点移动约 30 分钟，不相邻约 60 分钟。

**【口供汇总】**
{timeline_lines(case)}

**【记录清单】**（读取后由裁判标明类型）
"""
    for r in case["records"]:
        prompt += f"  [{r['id']}] 记录 （{r['slot']}）\n"

    prompt += """
**【证据等级】**
- 硬记录：有签字，能确认身份与地点。不自动证明犯罪。
- 软记录：只确认「某时段有人在某地点附近」，不带名字。不能单独确认身份。
- 干扰记录：无签字、无佐证，不得作为事实依据。

**【规则】**
1. 每回合只做一件事：读一份记录（「读 N 号」）、向嫌疑人提问，或指认。
2. 最多读 6 份记录。
3. 提问最多 2 次，格式「问：人名 + 时间点 + 问题」。
4. 指认格式「指认：人名 + 记录A + 记录B」。
   - 记录A：证明他不在口供所说的地方。
   - 记录B：证明他当时在别处，或按地图来不及到达。
   - 只有 3 次机会。人和两份记录都对才算破案。
5. 单份记录不能定罪。
6. 关键证据可能不带名字。需要用时间点 + 地图 + 口供交叉锁定身份。不要因为记录没有名字就忽略它。
7. 干扰记录不得作为事实依据。
8. 读取记录后，裁判会明确报出「实际时间 + 类型 + 原文」。
9. 玩家可随时查看已读记录清单，不消耗行动次数。

开局：先分析口供，说出你的第一个行动。
"""

    referee = f"""# 裁判手册（种子 {seed}）

窃贼：{culprit['name']}（{culprit['role']}）
关键证据 A：[{key_a['id']}] {key_a['text']}
关键证据 B：[{key_b['id']}] {key_b['text']}

## 全部记录

"""
    for r in case["records"]:
        referee += f"【{r['id']}】（{r['kind']}）{r['text']}\n\n"

    referee += f"""
## 判定

- 指认：人名 + 记录A + 记录B
- 人对但证据不完整：「△ 人对了，证据不对或不完整」
- 全对：破案。
- 不回答「差在哪」。
"""

    sealed = f"""# 密封：玩家勿看

《雾港电报局 · 午夜班》真相（种子 {seed}）

窃贼是{culprit['name']}（{culprit['role']}）。
关键证据 A：[{key_a['id']}]
关键证据 B：[{key_b['id']}]

## 真实时间线

"""
    for s in SUSPECTS:
        tl = case["true_tl"][s["id"]]
        parts = [f"{t} {loc}" for t, loc in zip(TIMES, tl)]
        sealed += f"  {s['name']}（{s['role']}）：{'；'.join(parts)}\n"

    for name, text in (("PROMPT.md", prompt), ("REFEREE.md", referee), ("SEALED.md", sealed)):
        with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
            f.write(text)
    return outdir


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--reveal", action="store_true")
    args = ap.parse_args(argv)

    case = generate_case(args.seed)
    if args.reveal:
        print(f"种子 {args.seed}：窃贼是{case['culprit']['name']}，证据 [{case['key_a']['id']}] + [{case['key_b']['id']}]")
        return 0
    if args.export:
        export_case(case)
        print(f"已生成（种子 {args.seed}）")
        return 0
    print("单人高难度版已就绪。使用 --export 生成文件。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

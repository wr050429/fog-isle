# -*- coding: utf-8 -*-
"""
《雾港电报局 · 午夜班》v2
推理 / 解谜小游戏，给 AI 玩。

v2 的改动（针对“v1 对 AI 太简单”）：
  以前：只找一处矛盾（谁 + 哪份记录），AI 逐份比对就能破案。
  现在：要答三道题 —— 谁（窃贼）、怎么进的（手法）、为什么（动机），
  三道题各有独立证据链，缺一不可。而且多了一份伪造记录：
  窃贼栽赃给一个无辜者，伪造了一份“他在仓库”的记录。
  玩家必须用另一份不在场证明识破伪造，否则会指认错人。

玩法：
  雾港海关的保险箱在夜里被人从仓库取走了。五个嫌疑人各有一份口供，
  另有一批记录。记录里有一份是伪造的。
  找出窃贼、手法、动机，三道题全对才算破案。

两种玩法：
  A. 命令行（能跑代码的 AI）：python3 game.py [--seed N]
  B. 网页 AI（DeepSeek / ChatGPT，只能对话框聊天）：
     由人类或另一个 AI 当裁判，裁判把 PROMPT.md 贴给玩家 AI，
     玩家要看哪份记录，裁判就把 REFEREE.md 里对应的记录贴过去。
     答案在 SEALED.md（玩家勿看），裁判用它核对。
     用 `python3 game.py --seed 7 --export` 可生成新一局的三份文件。

答案校验用 SHA-256，程序里不存明文答案；种子不同，整局不同。
纯 Python 3 标准库，无依赖。
"""

import argparse
import hashlib
import os
import random
import sys

# ---------------------------------------------------------------- 数据

SUSPECTS = [
    {"id": "zhou",     "name": "老周",   "role": "守夜人",     "home": "灯塔"},
    {"id": "ahai",     "name": "阿海",   "role": "货运代理",   "home": "货栈"},
    {"id": "xiaochen", "name": "小陈",   "role": "船员",       "home": "码头"},
    {"id": "lin",      "name": "林老板", "role": "酒馆老板",   "home": "酒馆"},
    {"id": "shen",     "name": "沈小姐", "role": "日班电报员", "home": "电报局"},
]

TIMES = ["22:00", "23:00", "00:00", "01:00", "02:00", "03:00"]
CRIME_WINDOW = ["00:00", "01:00", "02:00"]
LOCATIONS = ["酒馆", "码头", "电报局", "仓库", "灯塔", "货栈"]

# 手法：入口 -> （工具，现场描述）
METHODS = {
    "后门": ("配的钥匙",
             "现场勘查：仓库后门的锁完好无损，没有被撬过的痕迹。"
             "有人用钥匙开的门。配钥匙的师傅说，前阵子有人配过一把仓库后门的钥匙。"),
    "窗户": ("撬棍",
             "现场勘查：仓库的窗户玻璃碎了一块，窗框上有撬过的痕迹。"
             "有人是从窗户翻进去的。"),
    "正门": ("收买的守卫",
             "现场勘查：正门的守卫支支吾吾，说昨晚有人给了他一笔钱，"
             "让他“去别处转转”。正门的锁没有被动过。"),
}

# 动机：名字 -> （证据标题，证据正文模板）
MOTIVES = {
    "赌债": ("一张欠条", "{p}欠了一笔赌债，数额不小，月底要还。债主催过两次。"),
    "治病": ("一张药铺的账单", "{p}在药铺抓了很贵的药，家里有人病了，等钱救命。"),
    "要挟": ("一张字条", "有人给{p}留了字条：“钱的事，别再拖了，不然我就把那件事说出去。”"),
}

DOC_TEMPLATES = {
    "酒馆":   ("酒馆账单",   "{t}，{p}在酒馆点了{detail}，独自坐到打烊。老板记得他。"),
    "码头":   ("码头日志",   "{t}，{p}经过码头，{detail}。值班员在日志上记了一笔。"),
    "电报局": ("电报收发记录", "{t}，{p}在电报局{detail}。发报员签了字。"),
    "仓库":   ("仓库出入记录", "{t}，仓库门被打开。{p}进入仓库，{detail}。值班员签字：____。"),
    "灯塔":   ("灯塔日志",   "{t}，灯塔值班员在灯塔上看到{p}{detail}。"),
    "货栈":   ("货栈清单",   "{t}，{p}在货栈{detail}。清单上有他的签字。"),
}

DETAILS = {
    "酒馆":   ["一壶热酒", "一杯麦茶", "半壶烧酒", "一碟花生"],
    "码头":   ["往东堤方向去", "往西堤方向去", "在栈桥上站了一会儿", "帮人搬了一只箱子"],
    "电报局": ["发了一封往省城的电报", "收了一封家里的电报", "来问有没有他的电报", "替船上捎了一封电报"],
    "仓库":   ["停留约一刻钟后离开", "搬走了一只小木箱", "在货架前站了很久", "出来时手里多了一只布包"],
    "灯塔":   ["在塔下抽烟", "往码头方向走", "在雾里站了一会儿"],
    "货栈":   ["清点了一批麻袋", "核对了一张货单", "把一捆绳子搬到门口"],
}

DEFAULT_SEED = 7
MAX_ATTEMPTS = 3


# ---------------------------------------------------------------- 生成

def _random_walk(rng, start, n):
    path = [start]
    for _ in range(n - 1):
        if rng.random() < 0.5:
            path.append(path[-1])
        else:
            path.append(rng.choice(LOCATIONS))
    return path


def generate_case(seed):
    rng = random.Random(seed)
    culprit = rng.choice(SUSPECTS)
    crime_time = rng.choice(CRIME_WINDOW)
    method = rng.choice(list(METHODS.keys()))
    motive = rng.choice(list(MOTIVES.keys()))

    # 真实时间线：每人一条随机游走；窃贼在作案时刻必在仓库。
    true_tl = {}
    for s in SUSPECTS:
        start = s["home"] if rng.random() < 0.6 else rng.choice(LOCATIONS)
        true_tl[s["id"]] = _random_walk(rng, start, len(TIMES))
    ci = TIMES.index(crime_time)
    true_tl[culprit["id"]][ci] = "仓库"

    # 口供：除窃贼外与真实一致；窃贼在作案时刻编一个假去向。
    claimed_tl = {sid: list(tl) for sid, tl in true_tl.items()}
    false_loc = rng.choice([loc for loc in LOCATIONS if loc != "仓库"])
    claimed_tl[culprit["id"]][ci] = false_loc

    # 被栽赃的无辜者：不是窃贼。伪造记录声称他在作案时刻在仓库，
    # 但他有一份 solid 的不在场证明（另一份记录写明他当时在别处）。
    framed = rng.choice([s for s in SUSPECTS if s["id"] != culprit["id"]])
    forged_time = rng.choice(CRIME_WINDOW)
    fi = TIMES.index(forged_time)
    framed_loc = claimed_tl[framed["id"]][fi]
    # 确保被栽赃者的不在场证明地点不是仓库（否则伪造就和真的一样了）。
    if framed_loc == "仓库":
        framed_loc = rng.choice([loc for loc in LOCATIONS if loc != "仓库"])
        claimed_tl[framed["id"]][fi] = framed_loc
        true_tl[framed["id"]][fi] = framed_loc

    # 证据：每条是一条 (person, time, location) 的断言。
    attestations = []

    def attest(person_id, time, location, key=False, forged=False):
        attestations.append({
            "person": person_id, "time": time, "location": location,
            "key": key, "forged": forged,
        })

    # 关键证据：窃贼在作案时刻真的在仓库。
    attest(culprit["id"], crime_time, "仓库", key=True)
    # 伪造记录：声称被栽赃者在作案时刻在仓库（假的）。
    attest(framed["id"], forged_time, "仓库", forged=True)
    # 被栽赃者的不在场证明：他在伪造时刻真的在别处（与口供一致）。
    attest(framed["id"], forged_time, framed_loc)
    # 其他嫌疑人在作案窗口的记录（与口供一致）。
    for s in SUSPECTS:
        if s["id"] in (culprit["id"], framed["id"]):
            continue
        t = rng.choice(CRIME_WINDOW)
        attest(s["id"], t, claimed_tl[s["id"]][TIMES.index(t)])
    # 窃贼在作案窗口之外也留两条与口供一致的记录。
    outside = [t for t in TIMES if t not in CRIME_WINDOW]
    for t in rng.sample(outside, 2):
        attest(culprit["id"], t, claimed_tl[culprit["id"]][TIMES.index(t)])
    for s in rng.sample([x for x in SUSPECTS if x["id"] != culprit["id"]], 2):
        t = rng.choice(outside)
        attest(s["id"], t, claimed_tl[s["id"]][TIMES.index(t)])

    rng.shuffle(attestations)

    # 渲染成记录文档。
    docs = []
    for i, a in enumerate(attestations, start=1):
        title, tmpl = DOC_TEMPLATES[a["location"]]
        person = next(s["name"] for s in SUSPECTS if s["id"] == a["person"])
        detail = rng.choice(DETAILS[a["location"]])
        text = tmpl.format(t=a["time"], p=person, detail=detail)
        docs.append({
            "id": i, "title": title, "time": a["time"], "person": person,
            "location": a["location"], "text": text,
            "key": a["key"], "forged": a["forged"],
        })
    key_doc = next(d for d in docs if d["key"])
    forged_doc = next(d for d in docs if d["forged"])
    # 被栽赃者的不在场证明文档（与伪造记录同一人、同一时刻、不同地点）。
    alibi_doc = next(d for d in docs
                     if d["person"] == framed["name"]
                     and d["time"] == forged_time
                     and d["location"] == framed_loc
                     and not d["forged"])

    # 手法证据：现场勘查（单独一份，不含时间地点断言）。
    tool, scene_text = METHODS[method]
    docs.append({
        "id": len(docs) + 1, "title": "现场勘查", "time": None,
        "person": None, "location": None, "text": scene_text,
        "key": False, "forged": False,
    })
    method_doc = docs[-1]

    # 动机证据：窃贼名下的一份文书。
    motive_title, motive_tmpl = MOTIVES[motive]
    docs.append({
        "id": len(docs) + 1, "title": motive_title, "time": None,
        "person": culprit["name"], "location": None,
        "text": motive_tmpl.format(p=culprit["name"]),
        "key": False, "forged": False,
    })
    motive_doc = docs[-1]

    answer_hash = hashlib.sha256(
        "{}|{}|{}|{}".format(seed, culprit["id"], method, motive).encode("utf-8")
    ).hexdigest()

    return {
        "seed": seed,
        "culprit": culprit,
        "crime_time": crime_time,
        "false_loc": false_loc,
        "method": method,
        "method_tool": tool,
        "motive": motive,
        "framed": framed,
        "forged_time": forged_time,
        "true_tl": true_tl,
        "claimed_tl": claimed_tl,
        "docs": docs,
        "key_doc": key_doc,
        "forged_doc": forged_doc,
        "alibi_doc": alibi_doc,
        "method_doc": method_doc,
        "motive_doc": motive_doc,
        "answer_hash": answer_hash,
    }


def check_answer(case, culprit_name, method, motive):
    """返回 (是否全对, 人对不对, 手法对不对, 动机对不对)。"""
    suspect = next((s for s in SUSPECTS if s["name"] == culprit_name), None)
    person_ok = bool(suspect) and suspect["id"] == case["culprit"]["id"]
    method_ok = method == case["method"]
    motive_ok = motive == case["motive"]
    h = hashlib.sha256(
        "{}|{}|{}|{}".format(
            case["seed"],
            suspect["id"] if suspect else "?",
            method, motive,
        ).encode("utf-8")
    ).hexdigest()
    return h == case["answer_hash"], person_ok, method_ok, motive_ok


def suspect_by_name(name):
    return next((s for s in SUSPECTS if s["name"] == name), None)


def timeline_lines(case):
    lines = []
    for s in SUSPECTS:
        tl = case["claimed_tl"][s["id"]]
        parts = ["{} {}".format(t, loc) for t, loc in zip(TIMES, tl)]
        lines.append("  {}（{}）：{}".format(s["name"], s["role"], "；".join(parts)))
    return "\n".join(lines)


# ---------------------------------------------------------------- 命令行

def play_cli(case):
    print("=" * 52)
    print("《雾港电报局 · 午夜班》")
    print("=" * 52)
    print("雾港，海关仓库。清晨六点，值班员发现保险箱空了。")
    print("保险箱是在昨晚 00:00—02:00 之间被人从仓库取走的。")
    print("你是夜班电报员，手头有五个人的口供和一批记录。")
    print("要答三道题：谁偷的、怎么进的、为什么。")
    print("注意：记录里有一份是伪造的，是窃贼栽赃给别人的。")
    print("别被它带偏 —— 先想想，哪份记录是假的。")
    print()
    print("【口供汇总】（每个人声称自己整晚在何处）")
    print(timeline_lines(case))
    print()
    print("命令：list（记录清单）/ read <编号> / timelines（再看口供）")
    print("      submit <人名> <入口> <动机>（指认三道题）")
    print("      入口：后门 / 窗户 / 正门；动机：赌债 / 治病 / 要挟")
    print("      比如：submit 小陈 后门 赌债")
    print("      hint（提示一次）/ help / quit")
    print("指认机会共 {} 次。".format(MAX_ATTEMPTS))
    print()

    attempts = 0
    read_count = 0
    hint_used = False
    while True:
        try:
            raw = input("电报局 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n你放下了笔。夜还长，随时可以回来。")
            return
        if not raw:
            continue
        parts = raw.split()
        cmd = parts[0].lower()

        if cmd in ("quit", "exit", "q"):
            print("你合上记录本。雾港的夜还很长。")
            return
        if cmd == "help":
            print("list：列出所有记录；read <编号>：读一份记录；")
            print("timelines：再看口供汇总；")
            print("submit <人名> <入口> <动机>：指认三道题；")
            print("hint：要一次提示；quit：离开。")
            continue
        if cmd == "list":
            for d in case["docs"]:
                tag = "（{}）".format(d["time"]) if d["time"] else ""
                print("  [{}] {} {}".format(d["id"], d["title"], tag))
            continue
        if cmd == "timelines":
            print(timeline_lines(case))
            continue
        if cmd == "hint":
            if hint_used:
                print("提示已经用过了。剩下的，靠你自己。")
            else:
                hint_used = True
                print("提示：先找出哪份记录是伪造的 —— 看看哪两个人、同一时刻、"
                      "出现在了两个地方。")
            continue
        if cmd == "read":
            if len(parts) < 2 or not parts[1].isdigit():
                print("用法：read <记录编号>，比如 read 3。")
                continue
            doc = next((d for d in case["docs"] if d["id"] == int(parts[1])), None)
            if doc is None:
                print("没有这份记录。")
                continue
            read_count += 1
            print("—— [{}] {} ——".format(doc["id"], doc["title"]))
            print(doc["text"])
            continue
        if cmd == "submit":
            if len(parts) < 4:
                print("用法：submit <人名> <入口> <动机>，比如 submit 小陈 后门 赌债。")
                print("入口：后门 / 窗户 / 正门；动机：赌债 / 治病 / 要挟。")
                continue
            if not suspect_by_name(parts[1]):
                print("没有这个人。嫌疑人：{}。".format(
                    "、".join(s["name"] for s in SUSPECTS)))
                continue
            if parts[2] not in METHODS:
                print("入口不对。入口是：后门 / 窗户 / 正门。")
                continue
            if parts[3] not in MOTIVES:
                print("动机不对。动机是：赌债 / 治病 / 要挟。")
                continue
            attempts += 1
            ok, person_ok, method_ok, motive_ok = check_answer(
                case, parts[1], parts[2], parts[3])
            if ok:
                print()
                print("✓ 三道题全对，破案。")
                print("窃贼是{}。{}他声称自己在{}，但记录 [{}] 写明他当时在仓库。".format(
                    case["culprit"]["name"], case["crime_time"],
                    case["false_loc"], case["key_doc"]["id"]))
                print("手法：从{}进去，用的是{}。".format(
                    case["method"], case["method_tool"]))
                print("动机：{}。记录 [{}]（{}）就是证据。".format(
                    case["motive"], case["motive_doc"]["id"],
                    case["motive_doc"]["title"]))
                print("伪造的那份是记录 [{}]，栽赃给了{}；记录 [{}] 是他的不在场证明。".format(
                    case["forged_doc"]["id"], case["framed"]["name"],
                    case["alibi_doc"]["id"]))
                print("你读了 {} 份记录，用了 {} 次指认。雾散了，天亮了。".format(
                    read_count, attempts))
                return
            left = MAX_ATTEMPTS - attempts
            if left <= 0:
                print("× 不对。指认机会用完了。")
                print("真相在 SEALED.md 里（玩家勿看），或换个种子再来一局：")
                print("  python3 game.py --seed {}".format(case["seed"] + 1))
                return
            wrong = []
            if not person_ok:
                wrong.append("人")
            if not method_ok:
                wrong.append("手法")
            if not motive_ok:
                wrong.append("动机")
            print("× {}不对。还剩 {} 次机会。".format("、".join(wrong), left))
            continue
        print("不认识的命令。输入 help 看看能做什么。")


# ---------------------------------------------------------------- 导出（网页 AI / 裁判模式）

def _doc_block(d):
    tag = "（{}）".format(d["time"]) if d["time"] else ""
    return "【{}】{}{}\n{}".format(d["id"], d["title"], tag, d["text"])


def export_case(case, outdir):
    seed = case["seed"]
    culprit = case["culprit"]
    key = case["key_doc"]
    os.makedirs(outdir, exist_ok=True)

    doc_list = "\n".join(
        "  [{}] {}{}".format(d["id"], d["title"],
                             "（{}）".format(d["time"]) if d["time"] else "")
        for d in case["docs"]
    )

    prompt = """# 《雾港电报局 · 午夜班》—— 给玩家的开局

（裁判把这一整段直接粘贴给玩家 AI，即可开局。）

你是雾港海关电报局的夜班电报员。今晚 00:00—02:00 之间，
海关仓库的保险箱被人取走了。清晨六点，值班员发现保险箱空了。

你的任务：从口供和记录里找出三件事 —— 谁偷的、怎么进的、为什么。

【口供汇总】（每个人声称自己整晚在何处）

""" + timeline_lines(case) + """

【记录清单】（想看哪一份，就对裁判说“读 N 号”）

""" + doc_list + """

【规则】
- 每回合你只能做一件事：读一份记录，或者指认。
- 读记录：说“读 N 号”，裁判会把那份记录的全文贴给你。
- 指认：说“指认：人名 + 入口 + 动机”，比如“指认：老周 后门 赌债”。
  入口只能是：后门 / 窗户 / 正门。动机只能是：赌债 / 治病 / 要挟。
  你只有 3 次指认机会。三道题全对才算破案。
- 注意：记录里有一份是伪造的，是窃贼栽赃给别人的。
  别被它带偏 —— 先想想，哪份记录是假的。
  提示：看看哪两个人、同一时刻、出现在了两个地方。
- 不要猜裁判手里的答案，也不要让裁判直接告诉你答案。

开局：先看一遍口供，告诉裁判你第一份想读的记录是几号。
"""

    referee = """# 《雾港电报局 · 午夜班》—— 裁判手册（种子 {}）

（裁判专用。玩家只能看到 PROMPT.md 和裁判每回合贴过去的记录，
不要把这份手册、不要把 SEALED.md 贴给玩家。）

## 案情

保险箱在 {}—02:00 之间从仓库被取走。
窃贼：{}（{}）。
他声称 {} 自己在{}，但记录 [{}] 写明他当时在仓库。
手法：从{}进去，用的是{}。
动机：{}。证据是记录 [{}]（{}）。
伪造的记录是 [{}]，栽赃给了{}；
记录 [{}] 是他的不在场证明（同一时刻，他在{}）。

## 全部记录（玩家说“读 N 号”时，把对应的一份全文贴过去）

""".format(seed, case["crime_time"], culprit["name"], culprit["role"],
           case["crime_time"], case["false_loc"], key["id"],
           case["method"], case["method_tool"], case["motive"],
           case["motive_doc"]["id"], case["motive_doc"]["title"],
           case["forged_doc"]["id"], case["framed"]["name"],
           case["alibi_doc"]["id"], case["alibi_doc"]["location"])

    referee += "\n\n".join(_doc_block(d) for d in case["docs"])

    referee += """

## 口供汇总（玩家开局就已经看到；裁判备查）

""" + timeline_lines(case) + """

## 裁判流程

1. 把 PROMPT.md 全文贴给玩家 AI，开局。
2. 玩家每回合说“读 N 号”：把上面对应编号的记录全文贴过去，
   一次只贴一份，不要多贴。
3. 玩家说“指认：人名 + 入口 + 动机”：核对下面这条——
   人是{}、入口是{}、动机是{}，三道题全对才算破案。
   告诉他哪几道题对了、哪几道题错了，不说答案。
   3 次指认机会用完仍未破案，本局结束。
4. 玩家问“提示”：只给一次 —— “先找出哪份记录是伪造的，
   看看哪两个人、同一时刻、出现在了两个地方。”
5. 破案后可以把 SEALED.md 的“真相”部分贴给他，作为结尾。

## 核对口令

- 破案条件：人 = {}，入口 = {}，动机 = {}。
""".format(culprit["name"], case["method"], case["motive"],
           culprit["name"], case["method"], case["motive"])

    sealed = """# 密封：玩家勿看

《雾港电报局 · 午夜班》真相（种子 {}）

## 真相

窃贼是{}（{}）。
保险箱是在 {}—02:00 之间被取走的。
{}他声称自己在{}，但仓库出入记录 [{}] 写明他当时在仓库，
停留约一刻钟后离开。
手法：从{}进去，用的是{}。
动机：{}。证据是记录 [{}]（{}）。

## 伪造的记录

记录 [{}] 是伪造的，栽赃给了{}。
它声称 {} {} 在仓库，但记录 [{}] 写明他当时在{}——
同一时刻、同一人、两个地方，所以伪造的那份是假的。

## 为什么只有这两处“矛盾”

除窃贼外，所有人的口供与真实行踪一致；
窃贼在作案窗口之外的行踪也与口供一致。
伪造记录是唯一的“假矛盾”，关键证据是唯一的“真矛盾”。

## 完整真实时间线（裁判备查）

""".format(seed, culprit["name"], culprit["role"], case["crime_time"],
           case["crime_time"], case["false_loc"], key["id"],
           case["method"], case["method_tool"], case["motive"],
           case["motive_doc"]["id"], case["motive_doc"]["title"],
           case["forged_doc"]["id"], case["framed"]["name"],
           case["framed"]["name"], case["forged_time"],
           case["alibi_doc"]["id"], case["alibi_doc"]["location"])

    for s in SUSPECTS:
        tl = case["true_tl"][s["id"]]
        parts = ["{} {}".format(t, loc) for t, loc in zip(TIMES, tl)]
        sealed += "  {}（{}）：{}\n".format(s["name"], s["role"], "；".join(parts))
    sealed += "\n（玩家读完本局后可看。下一局换种子，真相全变。）\n"

    for name, text in (("PROMPT.md", prompt), ("REFEREE.md", referee),
                       ("SEALED.md", sealed)):
        with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
            f.write(text)
    return outdir


# ---------------------------------------------------------------- 入口

def main(argv=None):
    ap = argparse.ArgumentParser(description="《雾港电报局 · 午夜班》")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED,
                    help="种子（默认 {}，换种子就是新一局）".format(DEFAULT_SEED))
    ap.add_argument("--export", action="store_true",
                    help="生成 PROMPT.md / REFEREE.md / SEALED.md 到当前目录")
    ap.add_argument("--reveal", action="store_true",
                    help="直接打印本局真相（裁判用，玩家勿用）")
    args = ap.parse_args(argv)

    case = generate_case(args.seed)
    if args.reveal:
        print("种子 {}：窃贼是{}，手法{}（{}），动机{}；"
              "伪造记录 [{}] 栽赃{}。".format(
                  args.seed, case["culprit"]["name"], case["method"],
                  case["method_tool"], case["motive"],
                  case["forged_doc"]["id"], case["framed"]["name"]))
        return 0
    if args.export:
        outdir = export_case(case, ".")
        print("已生成 PROMPT.md / REFEREE.md / SEALED.md（种子 {}）".format(args.seed))
        print("裁判：把 PROMPT.md 贴给玩家 AI 即可开局。")
        return 0
    play_cli(case)
    return 0


if __name__ == "__main__":
    sys.exit(main())

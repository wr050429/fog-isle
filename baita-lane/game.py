# -*- coding: utf-8 -*-
"""
《白塔巷 17 号》v2
叙事分支 / 探索小游戏，给 AI 玩。

你刚搬进白塔巷 17 号 302 室 —— 上一位住客陈聿的房间。
这栋楼三天后要拆了。你有三个晚上，弄清楚陈聿留下了什么、
以及他为什么半夜总往屋顶和地下室跑。

v2 的改动：真相由种子定。三个变体 ——
  A 收件员：陈聿是收件处的夜班值班员，笔记本是值班日志；
  B 藏人：陈聿在 301 里藏了一个人，笔记本是送饭和放哨的时间表；
  C 走私：陈聿是个中间人，地下室走的是半夜靠岸的货，笔记本是账本。
种子抽一个变体。信、笔记本、王阿姨、老李、信号灯、结局都跟着变。
换种子，就是一个新的谜。

玩法：输入数字选行动。走动不花行动点，看东西、问人、拿东西、
开箱子各花 1 个行动点。每晚 4 个行动点，三晚共 12 个。
东西很多，时间不够 —— 你得选。

结局由你找到的线索和最后的决定共同决定。
真相在 SEALED.md（玩家勿看）。

python3 game.py [--seed N]（默认 7）
另有 --export（生成 SEALED.md）、--reveal（直接看真相，裁判用）。
纯 Python 3 标准库，无依赖。
"""

import argparse
import random
import sys

EVENINGS = 3
AP_PER_EVENING = 4

# ---------------------------------------------------------------- 三个真相变体

VARIANTS = {
    "A": {
        "name": "收件员",
        "letter": ("信只写了一半，字很潦草：\n"
                   "“……收件处的新地址，我还没想好。白塔巷 17 号要拆了，"
                   "302 的灯再亮三个晚上，就要灭了。\n"
                   "如果你读到这封信，说明你住进了我的房间。别害怕，"
                   "信不是写给你的，是写给下一个守夜人的。\n"
                   "东西在楼下，钥匙在抽屉里。屋顶的灯，别让它灭了。”"),
        "notebook": ("笔记本里记的不是日记，是一份份“收件记录”：缺页的信、"
                     "贴错的标签、互相打架的记录……每一件都写着“暂缓结案”。"
                     "最后一页写着：“收件处不是收东西的，是收‘还没人认领的真相’的。"
                     "白塔巷要拆了，收件处得换个地方。下一个守夜人，屋顶的灯交给你了。”"),
        "auntie": ("王阿姨给你倒了杯茶：“小陈是个安静的孩子，半夜总有人给他送信，"
                   "有时候是信，有时候是小包裹。他收了信也不拆，就锁进地下室的箱子里。"
                   "他晚上常去屋顶，说是看星星——我看哪，他是在给什么人打信号。”"),
        "laoli": ("老李压低声音：“夜里两三点，地下室总有动静，是搬箱子的声音。"
                  "我看见过小陈半夜抱着箱子往地下室去，一去就是半个钟头。"
                  "他出来的时候，手里是空的。”"),
        "signal": ("信号灯还能用，旁边有一张小纸条，画着一套灯语："
                   "三长两短，是“收到了”；两短一长，是“换地方”。"
                   "望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。"),
        "truth_name": "收件处的真相",
        "truth_text": "收件处收的是“还没人认领的真相”。",
        "listen": "你贴在门上，只听见自己的心跳。门后很安静，安静得不像一间空屋子。",
        "ending_a": ("你按笔记本最后一页的办法，给雾港的灯塔打了信号："
                     "三长两短，“收到了”。\n"
                     "塔顶的灯闪了一下，像是回答。\n"
                     "从今晚起，白塔巷 17 号的灯灭了，但收件处的灯，"
                     "换了一个地方继续亮着。而你，就是下一个守夜人。"),
        "ending_b": ("你把笔记本交给了房东。房东翻了两页，皱了皱眉，"
                     "把它锁进了抽屉。\n"
                     "“这种东西，还是别留着了。”他说。\n"
                     "三天后楼拆了。收件处的事，再也没人提起。"),
        "ending_e": ("你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、"
                     "笔记本、屋顶的信号。\n"
                     "陈聿不是搬走了。他是雾汀市立文书收件处的夜班值班员，"
                     "白塔巷 17 号 302 室是他临时的收件点。楼要拆了，"
                     "他得把收件处搬走 —— 而他把钥匙和笔记本留给了下一个人。\n"
                     "那个人，就是住进 302 的你。"),
        "sealed_truth": ("陈聿是雾汀市立文书收件处（夜间收件处）的夜班值班员。\n"
                         "白塔巷 17 号 302 室是他临时的收件点：他半夜收到的信和包裹，"
                         "都锁进地下室那只刻着他名字的木箱里。\n"
                         "楼要拆了，他得把收件处搬走。他把钥匙和笔记本留给了下一个住进 302 的人。\n"
                         "屋顶的信号灯是他和雾港灯塔之间的联络：三长两短是“收到了”，"
                         "两短一长是“换地方”。"),
    },
    "B": {
        "name": "藏人",
        "letter": ("信只写了一半，字很潦草：\n"
                   "“……她还在 301 里。白塔巷要拆了，我得在三天内把她送走。\n"
                   "如果你读到这封信，说明你住进了我的房间。别去敲 301 的门，"
                   "别问她是谁。\n"
                   "东西在楼下，钥匙在抽屉里。屋顶的灯，是给她看的——"
                   "灯亮着，就是安全；灯灭了，就别出来。”"),
        "notebook": ("笔记本里记的不是日记，是一份名单和时间表：几点送饭、"
                     "几点换水、哪天有人来查。最后一页写着："
                     "“她不是犯人，她只是没有地方去。楼要拆了，"
                     "我得把她送到雾岛去。那边有灯塔，灯塔下面有间小屋，"
                     "收件处的人会接她。”"),
        "auntie": ("王阿姨给你倒了杯茶：“小陈是个心软的孩子。半夜总有人从后门进来，"
                   "我看见过，是个女的，裹着头巾。小陈往楼上端饭，一端就是两份。"
                   "他晚上常去屋顶，说是看星星——我看哪，他是在给楼上那位放哨。”"),
        "laoli": ("老李压低声音：“夜里两三点，301 总有动静，是有人走动的声音，"
                  "很轻。我看见过小陈半夜端着饭往 301 去，一去就是半个钟头。"
                  "他出来的时候，手里是空碗。”"),
        "signal": ("信号灯还能用，旁边有一张小纸条，画着一套灯语："
                   "灯亮着，是“安全”；灯灭了，是“别出来”。"
                   "望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。"),
        "truth_name": "藏人的真相",
        "truth_text": "301 里藏着一个人，陈聿在保护她。",
        "listen": "你贴在门上，听见门后有一声很轻的呼吸，像是有人在里面，一直没睡。",
        "ending_a": ("你按笔记本上的办法，给 301 的门缝里塞了张字条，"
                     "又去屋顶把信号灯点亮了。灯亮着，就是安全。\n"
                     "第三天早上，楼拆之前，你看见一个裹着头巾的身影从后门离开，"
                     "往雾岛的方向去了。陈聿的托付，你接下了。"),
        "ending_b": ("你把笔记本交给了房东。房东翻了两页，脸色变了，"
                     "立刻叫人去敲 301 的门。\n"
                     "门开了，里面是空的——她已经走了。\n"
                     "房东看着你，一句话也没说。三天后楼拆了。"),
        "ending_e": ("你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、"
                     "笔记本、屋顶的信号。\n"
                     "陈聿不是搬走了。他在 301 里藏了一个人——一个没有地方去的人。"
                     "他半夜送饭、放哨、打信号，都是为了她。楼要拆了，"
                     "他得把她送到雾岛去。而他把钥匙和笔记本留给了下一个人。\n"
                     "那个人，就是住进 302 的你。"),
        "sealed_truth": ("陈聿在 301 里藏了一个人——一个没有地方去的人。\n"
                         "他半夜从后门接她进来，往 301 端饭，在屋顶放哨、打信号。\n"
                         "笔记本里是送饭和放哨的时间表，最后一页写着要把她送到雾岛去，"
                         "灯塔下面有间小屋，收件处的人会接她。\n"
                         "301 的门是锁着的，钥匙不在陈聿手里。别去敲门，别问她是谁。"),
    },
    "C": {
        "name": "走私",
        "letter": ("信只写了一半，字很潦草：\n"
                   "“……这批货不能留在楼里。白塔巷要拆了，货得在三天内运走。\n"
                   "如果你读到这封信，说明你住进了我的房间。别碰地下室的箱子，"
                   "除非你知道该把它交给谁。\n"
                   "东西在楼下，钥匙在抽屉里。屋顶的灯，是给船看的——"
                   "灯亮着，就能靠岸；灯灭了，就别来。”"),
        "notebook": ("笔记本里记的不是日记，是一本账：日期、货名、接货人、价钱。"
                     "最后一页写着：“货不是我的，我只是个中间人。"
                     "雾港的船半夜靠岸，货从地下室走，第二天一早就没了。"
                     "楼要拆了，这条线得断了——或者，换个人接手。”"),
        "auntie": ("王阿姨给你倒了杯茶：“小陈是个神神秘秘的孩子。半夜总有人送小箱子来，"
                   "他给人钱，箱子就进了地下室。他晚上常去屋顶，说是看星星——"
                   "我看哪，他是在给海上的船打信号。”"),
        "laoli": ("老李压低声音：“夜里两三点，地下室总有动静，是搬箱子的声音，"
                  "还有船靠岸的声音。我看见过小陈半夜抱着箱子往地下室去，"
                  "一去就是半个钟头。他出来的时候，手里是空的，口袋里是鼓的。”"),
        "signal": ("信号灯还能用，旁边有一张小纸条，画着一套灯语："
                   "灯亮着，是“可以靠岸”；灯灭了，是“别来”。"
                   "望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。"),
        "truth_name": "走私的真相",
        "truth_text": "陈聿是个中间人，地下室走的是半夜靠岸的货。",
        "listen": "你贴在门上，只听见自己的心跳。门后很安静，安静得不像一间空屋子。",
        "ending_a": ("你按笔记本上的办法，去屋顶把信号灯点亮了。半夜，"
                     "一艘小船靠了岸，你把地下室那只箱子交给了接货的人。\n"
                     "他点点头，递给你一个信封。你没有打开。\n"
                     "你知道，从今晚起，这条线归你了——或者，你也可以选择把它断掉。"),
        "ending_b": ("你把笔记本交给了房东。房东翻了两页，脸色变了，"
                     "立刻叫人去查地下室的箱子。\n"
                     "箱子是空的——货已经运走了。\n"
                     "房东看着你，一句话也没说。三天后楼拆了。"),
        "ending_e": ("你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、"
                     "笔记本、屋顶的信号。\n"
                     "陈聿不是搬走了。他是个中间人，雾港的船半夜靠岸，"
                     "货从地下室走，第二天一早就没了。楼要拆了，"
                     "这条线得断了——或者，换个人接手。\n"
                     "而他把钥匙和账本留给了下一个人。那个人，就是住进 302 的你。"),
        "sealed_truth": ("陈聿是个中间人。雾港的船半夜靠岸，货从地下室走，"
                         "第二天一早就没了。\n"
                         "笔记本是一本账：日期、货名、接货人、价钱。\n"
                         "地下室那只刻着他名字的木箱，装的是还没运走的货。\n"
                         "屋顶的信号灯是给船看的：灯亮着是“可以靠岸”，灯灭了是“别来”。"),
    },
}

ROOMS = {
    "302": {
        "name": "302 室（你的房间）",
        "desc": "陈聿的旧房间。房东说他“搬走了”，走得很急，东西都没收完。"
                "桌上有一封没写完的信，抽屉半开着，窗外是白塔巷的夜。",
        "exits": ["201", "202", "301", "basement", "roof", "yard"],
    },
    "201": {
        "name": "201 室（王阿姨家）",
        "desc": "王阿姨是退休教师，住了一辈子。屋里有股旧书和茶的味道，"
                "墙上挂着一张老照片。",
        "exits": ["302", "202", "301", "basement", "roof", "yard"],
    },
    "202": {
        "name": "202 室（老李家）",
        "desc": "老李是守夜人，白天睡觉，晚上上班。屋里很暗，只有一盏小灯，"
                "桌上放着一副旧耳机。",
        "exits": ["302", "201", "301", "basement", "roof", "yard"],
    },
    "301": {
        "name": "301 室（锁着的房间）",
        "desc": "301 的门锁着。门上贴着一张褪色的封条，落款是三年前。"
                "门缝里透不出一丝光。",
        "exits": ["302", "201", "202", "basement", "roof", "yard"],
    },
    "basement": {
        "name": "地下室",
        "desc": "地下室很潮，灯泡一闪一闪。角落里堆着几只木箱，"
                "其中一只上了锁，箱身上刻着“陈聿”两个字。",
        "exits": ["302", "201", "202", "301", "roof", "yard"],
    },
    "roof": {
        "name": "屋顶",
        "desc": "屋顶的风很大。角落里有一架旧望远镜，和一盏信号灯。"
                "从这里能看见整条白塔巷，和雾港的灯塔。",
        "exits": ["302", "201", "202", "301", "basement", "yard"],
    },
    "yard": {
        "name": "院子",
        "desc": "院子里有一棵石榴树，树下有一口旧井，井边放着一只铁桶。"
                "门卫老张坐在门口打盹。",
        "exits": ["302", "201", "202", "301", "basement", "roof"],
    },
}


def build_actions(variant):
    """按变体生成互动列表。"""
    v = VARIANTS[variant]
    return [
        {"id": "letter", "room": "302", "text": "读桌上那封没写完的信",
         "say": v["letter"], "gives": "陈聿的信"},
        {"id": "key", "room": "302", "text": "翻抽屉",
         "say": "抽屉里有一把黄铜钥匙，钥匙牌上写着“地下室”。"
                "钥匙下面压着一张字条：“别去 301，那间屋子不属于我。”",
         "gives": "地下室钥匙", "once": True},
        {"id": "window", "room": "302", "text": "看窗外",
         "say": "窗外是白塔巷。雾很薄，路灯一盏一盏亮着。"
                "你看见屋顶上有什么东西反了一下光。",
         "gives": None},
        {"id": "auntie", "room": "201", "text": "问王阿姨：陈聿是个什么样的人？",
         "say": v["auntie"], "gives": "王阿姨的话"},
        {"id": "photo", "room": "201", "text": "看墙上的老照片",
         "say": "照片上是年轻时的陈聿，站在屋顶上，手里拿着一盏信号灯。"
                "照片背面写着：“雾港的灯，要有人守。”",
         "gives": None},
        {"id": "laoli", "room": "202", "text": "问老李：夜里听见过什么动静？",
         "say": v["laoli"], "gives": "老李的话"},
        {"id": "knock", "room": "301", "text": "敲 301 的门",
         "say": "你敲了三下。门里没有一点声音，连回音都没有。",
         "gives": None},
        {"id": "trykey", "room": "301", "text": "试试抽屉里的钥匙开不开 301",
         "say": "钥匙插不进去。锁孔的形状不对。这把钥匙不是开 301 的。"
                "你想起字条上的话：“别去 301，那间屋子不属于我。”",
         "gives": None, "requires": "地下室钥匙"},
        {"id": "listen", "room": "301", "text": "贴在门上听听里面的动静",
         "say": v["listen"], "gives": None},
        {"id": "box", "room": "basement", "text": "用钥匙打开那只刻着“陈聿”的木箱",
         "say": "箱子打开了。里面是一本笔记本，包着油布，保存得很好。"
                "笔记本的第一页写着：“雾汀市立文书收件处 · 夜间收件处 —— 值班日志。”"
                if variant == "A" else
                "箱子打开了。里面是一本笔记本，包着油布，保存得很好。",
         "gives": "陈聿的笔记本", "requires": "地下室钥匙", "once": True},
        {"id": "readbook", "room": "basement", "text": "读陈聿的笔记本",
         "say": v["notebook"], "gives": v["truth_name"],
         "requires": "陈聿的笔记本"},
        {"id": "signal", "room": "roof", "text": "看那盏信号灯和望远镜",
         "say": v["signal"], "gives": "屋顶的信号"},
        {"id": "well", "room": "yard", "text": "看那口旧井",
         "say": "井很深，井水黑黑的。你往里看了一眼，什么也没看见，"
                "只听见自己的呼吸声。",
         "gives": None},
        {"id": "zhang", "room": "yard", "text": "问门卫老张：这楼真要拆了？",
         "say": "老张摆摆手：“拆是肯定要拆的，三天后动工。302 那小伙子走之前，"
                "跟我说了一句话：‘楼拆了，灯别灭。’我没听懂。”",
         "gives": None},
    ]


class Game:
    def __init__(self, seed):
        self.seed = seed
        self.rng = random.Random(seed)
        self.variant = self.rng.choice(["A", "B", "C"])
        self.v = VARIANTS[self.variant]
        self.actions = build_actions(self.variant)
        self.room = "302"
        self.evening = 1
        self.ap = AP_PER_EVENING
        self.clues = []
        self.done = set()
        self.ended = None

    def major_clues(self):
        names = ["陈聿的信", "王阿姨的话", "老李的话",
                 "陈聿的笔记本", self.v["truth_name"], "屋顶的信号"]
        return [c for c in self.clues if c in names]

    def major_count(self):
        return len(self.major_clues())

    def available_actions(self):
        out = []
        for a in self.actions:
            if a["room"] != self.room:
                continue
            if a.get("once") and a["id"] in self.done:
                continue
            if a.get("requires") and a["requires"] not in self.clues:
                continue
            out.append(a)
        return out

    def do_action(self, action):
        self.ap -= 1
        self.done.add(action["id"])
        if action.get("gives") and action["gives"] not in self.clues:
            self.clues.append(action["gives"])
        return action["say"]

    def ending(self, choice):
        has_book = "陈聿的笔记本" in self.clues
        has_signal = "屋顶的信号" in self.clues
        full = self.major_count() >= 6
        if choice == "接手":
            if has_book and has_signal:
                return ("A", "接手", self.v["ending_a"])
            return ("A?", "接手（未完成）",
                    "你想接手，但手里缺了点东西 —— 没有笔记本，或者没看懂屋顶的信号。\n"
                    "楼还是拆了。你站在废墟边，觉得自己错过了一封写给你的信。")
        if choice == "上交":
            if has_book:
                return ("B", "上交", self.v["ending_b"])
            return ("B?", "上交（未完成）",
                    "你想上交点什么，但手里没有笔记本。\n"
                    "你空着手站在房东门口，又退了回来。")
        if choice == "离开":
            return ("C", "离开",
                    "你收拾了行李，在第三天早上离开了白塔巷 17 号。\n"
                    "302 的灯灭了。屋顶的信号灯，再也没亮过。\n"
                    "有些信，永远没人认领了。")
        return ("C", "离开",
                "你收拾了行李，在第三天早上离开了白塔巷 17 号。\n"
                "302 的灯灭了。有些信，永远没人认领了。")


# ---------------------------------------------------------------- CLI

def play_cli(game):
    print("=" * 52)
    print("《白塔巷 17 号》")
    print("=" * 52)
    print("你刚搬进白塔巷 17 号 302 室 —— 上一位住客陈聿的房间。")
    print("这栋楼三天后要拆了。你有三个晚上，弄清楚陈聿留下了什么。")
    print("每晚 4 个行动点。走动不花点，看东西、问人、拿东西、开箱子花 1 点。")
    print("输入数字选行动；输入“去 201”这样的地点可以走动；")
    print("输入“决定”可以提前做最后的决定；输入“线索”看已找到的线索；")
    print("输入 quit 离开。")
    print()

    def ask(prompt):
        try:
            return input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            return None

    while game.evening <= EVENINGS:
        room = ROOMS[game.room]
        print("-" * 52)
        print("第 {} 晚 · {} · 行动点 {}".format(
            game.evening, room["name"], game.ap))
        print(room["desc"])
        actions = game.available_actions()
        print()
        for i, a in enumerate(actions, start=1):
            print("  {}. {}".format(i, a["text"]))
        print("  0. 换个地方（去 201 / 202 / 301 / 地下室 / 屋顶 / 院子 / 302）")
        print()
        raw = ask("白塔巷 > ")
        if raw is None:
            print("\n你合上门。白塔巷的夜还很长。")
            return
        if not raw:
            continue
        if raw in ("quit", "exit", "q"):
            print("你合上门。白塔巷的夜还很长。")
            return
        if raw == "线索":
            print("已找到的线索：{}".format(
                "、".join(game.clues) if game.clues else "（还没有）"))
            print("主要线索 {}/6。".format(game.major_count()))
            continue
        if raw == "决定":
            break
        if raw.startswith("去"):
            dest = raw[1:].strip()
            mapping = {"201": "201", "202": "202", "301": "301",
                       "地下室": "basement", "屋顶": "roof",
                       "院子": "yard", "302": "302"}
            if dest in mapping:
                game.room = mapping[dest]
                continue
            print("去哪？可以去：201、202、301、地下室、屋顶、院子、302。")
            continue
        if raw.isdigit():
            idx = int(raw)
            if idx == 0:
                print("输入“去 201”这样的地点来走动。")
                continue
            if 1 <= idx <= len(actions):
                print()
                print(game.do_action(actions[idx - 1]))
                print()
            else:
                print("没有这个编号。")
        else:
            print("输入数字选行动，或输入“去 201”走动，或输入“决定”。")
        if game.ap <= 0:
            if game.evening >= EVENINGS:
                break
            game.evening += 1
            game.ap = AP_PER_EVENING
            print()
            print("天亮了。你睡了一觉，又是一个晚上。")
            print()

    # 结尾：最后的决定
    print()
    print("=" * 52)
    print("第三天早上，拆迁队来了。")
    print("你站在 302 室门口，手里拿着这三晚找到的东西。")
    print("已找到的线索：{}".format(
        "、".join(game.clues) if game.clues else "（没有）"))
    print()
    if game.major_count() >= 6:
        print("你把六条线索拼在了一起，真相已经很清楚了。")
        print("现在，你要决定：")
    else:
        print("时间到了。你要决定：")
    print("  1. 接手 —— 继续陈聿留下的事")
    print("  2. 上交 —— 把笔记本交给房东")
    print("  3. 离开 —— 什么都不做，走人")
    choice = ask("你的决定（1/2/3）> ")
    if choice is None:
        choice = "离开"
    mapping = {"1": "接手", "2": "上交", "3": "离开",
               "接手": "接手", "上交": "上交", "离开": "离开"}
    code, title, text = game.ending(mapping.get(choice, "离开"))
    print()
    print("【结局 {} · {}】".format(code, title))
    print(text)
    print()
    print("主要线索 {}/6。{}".format(
        game.major_count(),
        "（你集齐了全部六条主要线索。）" if game.major_count() >= 6 else ""))
    return code


# ---------------------------------------------------------------- 导出 / 入口

def export_sealed(game, outdir="."):
    import os
    v = game.v
    lines = ["# 密封：玩家勿看", "",
             "《白塔巷 17 号》真相（种子 {}，变体 {}：{}）".format(
                 game.seed, game.variant, v["name"]), "",
             "## 真相", ""]
    lines.extend(v["sealed_truth"].split("\n"))
    lines.append("")
    lines.append("## 六条主要线索")
    lines.append("  1. 陈聿的信（302 桌上）")
    lines.append("  2. 王阿姨的话（201）")
    lines.append("  3. 老李的话（202）")
    lines.append("  4. 陈聿的笔记本（地下室木箱，需钥匙）")
    lines.append("  5. {}（读笔记本）".format(v["truth_name"]))
    lines.append("  6. 屋顶的信号（屋顶）")
    lines.append("")
    lines.append("## 结局")
    lines.append("  A 接手：有笔记本 + 屋顶的信号。")
    lines.append("  B 上交：有笔记本。把笔记本交给房东。")
    lines.append("  C 离开：没有笔记本，或选择离开。")
    lines.append("  E 真相：集齐全部六条主要线索后，拼出完整真相，再做决定。")
    lines.append("")
    lines.append("## 三个变体（种子抽一个）")
    lines.append("  A 收件员：陈聿是收件处的夜班值班员，笔记本是值班日志。")
    lines.append("  B 藏人：陈聿在 301 里藏了一个人，笔记本是送饭和放哨的时间表。")
    lines.append("  C 走私：陈聿是个中间人，笔记本是账本，地下室走的是半夜靠岸的货。")
    lines.append("")
    lines.append("（玩家打完本局后可看。下一局换种子，变体和细节会变。）")
    with open(os.path.join(outdir, "SEALED.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return "SEALED.md"


def main(argv=None):
    ap = argparse.ArgumentParser(description="《白塔巷 17 号》")
    ap.add_argument("--seed", type=int, default=7, help="种子（默认 7）")
    ap.add_argument("--export", action="store_true", help="生成 SEALED.md")
    ap.add_argument("--reveal", action="store_true", help="直接看真相（裁判用）")
    args = ap.parse_args(argv)
    game = Game(args.seed)
    if args.reveal:
        print("种子 {}：变体 {}（{}）。真相在 SEALED.md。".format(
            args.seed, game.variant, game.v["name"]))
        return 0
    if args.export:
        export_sealed(game)
        print("已生成 SEALED.md（种子 {}，变体 {}）".format(args.seed, game.variant))
        return 0
    play_cli(game)
    return 0


if __name__ == "__main__":
    sys.exit(main())

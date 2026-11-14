# -*- coding: utf-8 -*-
"""
《雾岛灯塔 · 守塔人》
资源经营带风险小游戏，给 AI 玩。

你是雾岛灯塔的守塔人，要守满 30 夜。手里有燃油、雾币、粮食、
灯塔状况和声望五种资源。每天：先看发生什么事，再做两件事，
入夜决定点不点灯、点多亮。灯亮着要烧油，不亮船就看不见。

不确定性：
  * 每天的事件、哪晚有船经过、每天的油价，都是种子定的，玩家事先不知道；
  * 有人半夜偷油。油少了你才会发现，巡视能找到线索，集齐 3 条
    线索才能认出窃贼、对质止损；
  * 神秘访客卖的“便宜油”是掺了水的，烧得飞快 —— 他不会告诉你。
  * 船期背后可能藏着规律。留心观察船来的日子 —— 规律是种子定的，
    每局不一样。发现规律的人，能把油花在刀刃上。

胜负：
  * 守满 30 夜且声望 >= 50：留任，赢。
  * 声望 <= 0、灯塔状况 <= 0、或连续 3 夜熄灯：被撤职，输。
  * 守满 30 夜但声望 < 50：不续约，输（差一点）。

玩法：python3 game.py [--seed N]
  另有 --export（生成 SEALED.md）、--reveal（直接看真相，裁判用）、
  --self-play --days N（自动打 N 天，用来验平衡）。
纯 Python 3 标准库，无依赖。
"""

import argparse
import random
import sys

DAYS = 30
WIN_REP = 50
START = {"fuel": 15, "money": 50, "food": 10, "condition": 100, "rep": 50}

THIEVES = [
    ("商人老陈", "一枚铜纽扣，是商人外套上的那种。"),
    ("渔民阿水", "一片鱼鳞，粘在油库门边的木板上。"),
    ("流浪汉老七", "一块破布，角上绣着个歪歪扭扭的“七”。"),
]

EVENTS = ["storm", "distress", "merchant", "fog", "visitor", "calm",
          "malfunction", "fishermen"]
EVENT_WEIGHTS = [12, 10, 10, 10, 8, 22, 8, 10]
EVENT_NAMES = {
    "storm": "暴风雨", "distress": "船只遇险", "merchant": "商船到访",
    "fog": "浓雾", "visitor": "神秘访客", "calm": "平静的一天",
    "malfunction": "灯塔故障", "fishermen": "渔民送鱼",
}


class Game:
    def __init__(self, seed):
        self.seed = seed
        self.rng = random.Random(seed)
        self.day = 1
        self.fuel = START["fuel"]
        self.money = START["money"]
        self.food = START["food"]
        self.condition = START["condition"]
        self.rep = START["rep"]
        self.lit_nights = 0
        self.unlit_streak = 0
        self.clues = 0
        self.thief_stopped = False
        self.diluted = 0          # 掺水油剩余夜数（烧油翻倍）
        self.malfunction = False  # 今晚不能全亮
        self.fog_tonight = False  # 今晚有雾
        self.theft_seen = 0       # 已发生的偷油次数
        self.thief, self.thief_clue = self.rng.choice(THIEVES)
        # ---- 隐藏规则：船期规律（不在 README 里写明，玩家要靠观察发现）----
        # 船不是纯随机来的。它跟着一个种子定的周期走：
        #   周期 P（2 / 3 / 4 夜）+ 相位 O。
        # “周期夜”（(夜 - O) % P == 0）有船的概率 90%，
        # “非周期夜”有船的概率 10%。总体船期率约 43%，和以前差不多，
        # 但发现规律的人能只在周期夜全亮、非周期夜省油。
        self.ship_period = self.rng.choice([2, 3, 4])
        self.ship_phase = self.rng.randint(0, self.ship_period - 1)
        self.ship_pass = []
        for i in range(DAYS):
            is_cycle = (i - self.ship_phase) % self.ship_period == 0
            p = 0.90 if is_cycle else 0.10
            self.ship_pass.append(self.rng.random() < p)
        self.ship_history = []  # 每晚的船期记录（True=有船），供玩家观察规律
        self.fuel_price = [6 + self.rng.randint(-1, 3) for _ in range(DAYS)]
        self.theft_days = sorted(self.rng.sample(range(5, DAYS), 4))
        self.events = [self.rng.choices(EVENTS, EVENT_WEIGHTS)[0]
                       for _ in range(DAYS)]
        self.log = []

    # ------------------------------------------------------------ 工具
    def status_line(self):
        return ("第 {} 天 | 燃油 {} | 雾币 {} | 粮食 {} | 灯塔状况 {} | 声望 {} "
                "| 已点灯 {} 夜 | 线索 {}/3").format(
            self.day, self.fuel, self.money, self.food,
            self.condition, self.rep, self.lit_nights, self.clues)

    def ship_log_line(self):
        """船期记录：●=有船，○=无船。玩家靠它观察船期规律。"""
        if not self.ship_history:
            return "船期记录：还没有船经过的记录。"
        marks = "".join("●" if s else "○" for s in self.ship_history)
        return "船期记录：{}（●=有船，○=无船）".format(marks)

    def fuel_cost(self, mode):
        base = {"full": 3, "half": 1, "off": 0}[mode]
        if self.diluted > 0 and base > 0:
            base *= 2
        return base

    def over(self):
        if self.rep <= 0:
            return "lose", "声望归零，港务局撤了你的职。"
        if self.condition <= 0:
            return "lose", "灯塔状况归零，塔身出了大问题，你被调走了。"
        if self.unlit_streak >= 3:
            return "lose", "连续 3 夜熄灯，有船在雾里触了礁，港务局撤了你的职。"
        if self.day > DAYS:
            if self.rep >= WIN_REP:
                return "win", "30 夜守满了，声望 {}，港务局和你续约。灯塔还亮着。".format(self.rep)
            return "lose", "30 夜守满了，但声望只有 {}，不到 {}，港务局没有续约。".format(
                self.rep, WIN_REP)
        return None, ""

    # ------------------------------------------------------------ 事件
    def run_event(self, ask, say):
        ev = self.events[self.day - 1]
        self.malfunction = False
        self.fog_tonight = False
        if ev == "calm":
            self.log.append("平静的一天。雾很薄，海很静。")
            return
        if ev == "storm":
            self.condition = max(0, self.condition - 15)
            self.log.append("暴风雨：风把塔身吹得直响，灯塔状况 -15。")
            return
        if ev == "merchant":
            self.fuel_price[self.day - 1] = max(1, self.fuel_price[self.day - 1] - 2)
            self.log.append("商船到访：今天油价便宜 2 雾币（{} 雾币 / 5 单位），适合补油。".format(
                self.fuel_price[self.day - 1]))
            return
        if ev == "fog":
            self.fog_tonight = True
            self.log.append("浓雾：今晚雾很重。灯亮着格外重要，熄灯格外危险。")
            return
        if ev == "fishermen":
            self.food += 2
            self.rep = min(100, self.rep + 3)
            self.log.append("渔民送鱼：渔民送来一筐鱼，粮食 +2，声望 +3。")
            return
        if ev == "malfunction":
            self.condition = max(0, self.condition - 10)
            self.malfunction = True
            self.log.append("灯塔故障：透镜卡住了，灯塔状况 -10。今晚不能全亮，"
                            "修缮可以修好它。")
            return
        if ev == "distress":
            say("船只遇险：雾里有一艘船在发求救信号。")
            ans = ask("  出海救援吗？（要 2 燃油 + 1 粮食；救了声望 +12、雾币 +15，"
                      "不救声望 -10）[救/不救] ")
            if ans in ("救", "y", "yes", "救援"):
                if self.fuel < 2 or self.food < 1:
                    self.rep = max(0, self.rep - 10)
                    self.log.append("  你想救，但油 / 粮不够，只能眼睁睁看着。声望 -10。")
                else:
                    self.fuel -= 2
                    self.food -= 1
                    self.rep = min(100, self.rep + 12)
                    self.money += 15
                    self.log.append("  你救下了那艘船。声望 +12，雾币 +15。")
            else:
                self.rep = max(0, self.rep - 10)
                self.log.append("  你没有出海。雾里那盏求救灯灭了。声望 -10。")
            return
        if ev == "visitor":
            say("神秘访客：一个裹着斗篷的人敲门，说有一批“便宜油”，"
                "5 单位只要 {} 雾币（今天正常价 {} 雾币）。"
                "他不肯说油从哪来。".format(
                    max(1, self.fuel_price[self.day - 1] // 2),
                    self.fuel_price[self.day - 1]))
            ans = ask("  买吗？[买/不买] ")
            if ans in ("买", "y", "yes"):
                price = max(1, self.fuel_price[self.day - 1] // 2)
                if self.money < price:
                    self.log.append("  你想买，但钱不够。他耸耸肩，走了。")
                else:
                    self.money -= price
                    self.fuel += 5
                    self.diluted = 3
                    self.log.append("  你买了 5 单位便宜油。油壶很沉，气味有点怪。"
                                    "（你暂时还不知道，这油烧得比正常油快一倍。）")
            else:
                self.log.append("  你没买。他看了你一眼，转身走进雾里。")
            return

    # ------------------------------------------------------------ 白天行动
    ACTIONS = ["买油", "买粮", "修缮", "巡视", "捕鱼", "休息", "对质"]

    def do_action(self, name):
        if name == "买油":
            price = self.fuel_price[self.day - 1]
            if self.money < price:
                return "钱不够（要 {} 雾币）。".format(price)
            self.money -= price
            self.fuel += 5
            return "买了 5 单位燃油（{} 雾币）。".format(price)
        if name == "买粮":
            if self.money < 10:
                return "钱不够（要 10 雾币）。"
            self.money -= 10
            self.food += 5
            return "买了 5 单位粮食（10 雾币）。"
        if name == "修缮":
            if self.money < 10:
                return "钱不够（要 10 雾币）。"
            self.money -= 10
            self.condition = min(100, self.condition + 15)
            self.malfunction = False
            return "修缮了灯塔，状况 +15。透镜转顺了。"
        if name == "巡视":
            if self.clues < self.theft_seen and self.clues < 3:
                self.clues += 1
                if self.clues == 1:
                    return "巡视：油库门边有一串脚印，通向村子的方向。（线索 1/3）"
                if self.clues == 2:
                    return "巡视：{}（线索 2/3）".format(self.thief_clue)
                return ("巡视：顺着脚印找到村边一间小棚屋，里面堆着几桶燃油，"
                        "桶身上有灯塔的标记。（线索 3/3）窃贼是{}！你可以“对质”了。".format(
                            self.thief))
            return "巡视了一圈，没发现新东西。"
        if name == "捕鱼":
            self.food += 3
            return "去礁石边捕鱼，粮食 +3。"
        if name == "休息":
            self.condition = min(100, self.condition + 5)
            return "睡了个好觉，灯塔状况 +5。"
        if name == "对质":
            if self.clues < 3:
                return "你还没有足够的线索（{}/3），不知道该找谁对质。".format(self.clues)
            if self.thief_stopped:
                return "窃贼已经被你揭穿了，油不会再少了。"
            self.thief_stopped = True
            self.rep = min(100, self.rep + 5)
            return "你当面揭穿了{}，他认了，答应不再偷油。声望 +5。".format(self.thief)
        return "没有这个行动。"

    # ------------------------------------------------------------ 夜晚
    def night(self, mode):
        cost = self.fuel_cost(mode)
        if self.fuel < cost:
            return "燃油不够（要 {} 单位，只有 {} 单位）。".format(cost, self.fuel)
        self.fuel -= cost
        ship = self.ship_pass[self.day - 1]
        self.ship_history.append(ship)
        if mode == "full":
            self.lit_nights += 1
            self.unlit_streak = 0
            if ship:
                gain = 4 + (3 if self.fog_tonight else 0)
                self.rep = min(100, self.rep + gain)
                self.money += 6
                return "灯全亮着。有船经过，看见了光，声望 +{}，雾币 +6。".format(gain)
            return "灯全亮着。没有船经过，只烧了油。"
        if mode == "half":
            self.lit_nights += 1
            self.unlit_streak = 0
            if ship:
                self.rep = min(100, self.rep + 1)
                return "灯半亮着。有船经过，勉强看见了光，声望 +1。"
            return "灯半亮着。没有船经过。"
        self.unlit_streak += 1
        if ship:
            loss = 18 if self.fog_tonight else 12
            self.rep = max(0, self.rep - loss)
            return "灯熄着。有船经过，在雾里差点触礁，声望 -{}。".format(loss)
        return "灯熄着。没有船经过。"

    # ------------------------------------------------------------ 一天
    def end_of_day(self):
        # 港务局每天考核：声望自然 -2。
        self.rep = max(0, self.rep - 2)
        # 吃饭
        if self.food > 0:
            self.food -= 1
        else:
            self.condition = max(0, self.condition - 10)
            self.rep = max(0, self.rep - 5)
            self.log.append("没有粮食了，你饿着肚子守夜，灯塔状况 -10，声望 -5。")
        # 偷油（今晚）
        if self.day in self.theft_days and not self.thief_stopped:
            self.fuel = max(0, self.fuel - 3)
            self.theft_seen += 1
            self.log.append("夜里，油库的锁被人动过。第二天早上，燃油少了 3 单位，"
                            "不知去向。（偷油第 {} 次）".format(self.theft_seen))
        if self.diluted > 0:
            self.diluted -= 1
        self.day += 1


# ---------------------------------------------------------------- CLI

def play_cli(game):
    print("=" * 52)
    print("《雾岛灯塔 · 守塔人》")
    print("=" * 52)
    print("你是雾岛灯塔的守塔人，要守满 30 夜。")
    print("每天：先看发生什么事，再做两件事，入夜决定点灯。")
    print("守满 30 夜且声望 >= 50：留任。声望归零、灯塔垮了、")
    print("或连续 3 夜熄灯：撤职。油价每天会变，有人半夜偷油。")
    print("港务局每天考核，声望每天 -2；灯要亮，船才看得见你。")
    print("命令：status / ships（船期记录）/ 买油 / 买粮 / 修缮 / 巡视 / 捕鱼 / 休息 / 对质")
    print("      全亮 / 半亮 / 熄灯（夜里点灯）/ help / quit")
    print("船期背后可能有规律。输入 ships 看船来的日子，自己找规律。")
    print()

    def ask(prompt):
        try:
            return input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            return ""

    while True:
        over, msg = game.over()
        if over:
            print()
            print(msg)
            print("最终：燃油 {}，雾币 {}，粮食 {}，状况 {}，声望 {}，点灯 {} 夜。".format(
                game.fuel, game.money, game.food, game.condition,
                game.rep, game.lit_nights))
            return over
        print("-" * 52)
        print(game.status_line())
        print(game.ship_log_line())
        print("今天油价：{} 雾币 / 5 单位燃油。".format(game.fuel_price[game.day - 1]))
        game.log = []
        game.run_event(ask, print)
        for line in game.log:
            print(line)
        over, msg = game.over()
        if over:
            print(msg)
            return over

        # 白天：2 个行动点
        ap = 2
        while ap > 0:
            print("行动点剩 {}。做什么？（买油/买粮/修缮/巡视/捕鱼/休息/对质）".format(ap))
            ans = ask("白天 > ").strip()
            if ans in ("quit", "exit", "q"):
                print("你放下灯塔日志。雾还在，塔还在。")
                return "quit"
            if ans == "help":
                print("买油：5 燃油，按今天油价。买粮：5 粮食，10 雾币。")
                print("修缮：状况 +15，10 雾币（也能修好故障）。巡视：找偷油的线索。")
                print("捕鱼：粮食 +3。休息：状况 +5。对质：集齐 3 线索后揭穿窃贼。")
                print("status：看一眼状态。ships：看船期记录 —— 船来的日子可能有规律，")
                print("  留心观察，找找周期。")
                continue
            if ans == "status":
                print(game.status_line())
                print(game.ship_log_line())
                continue
            if ans == "ships":
                print(game.ship_log_line())
                continue
            if ans in Game.ACTIONS:
                print(game.do_action(ans))
                ap -= 1
                over, msg = game.over()
                if over:
                    print(msg)
                    return over
            else:
                print("没有这个行动。输入 help 看看。")

        # 夜里：点灯
        while True:
            print("入夜了。点灯吗？（全亮 3 油 / 半亮 1 油 / 熄灯 0 油）"
                  + ("（掺水油：烧油翻倍）" if game.diluted > 0 else "")
                  + ("（故障：今晚不能全亮）" if game.malfunction else ""))
            ans = ask("夜里 > ").strip()
            if ans in ("quit", "exit", "q"):
                print("你放下灯塔日志。雾还在，塔还在。")
                return "quit"
            mode = {"全亮": "full", "半亮": "half", "熄灯": "off"}.get(ans)
            if mode is None:
                print("请选 全亮 / 半亮 / 熄灯。")
                continue
            if mode == "full" and game.malfunction:
                print("透镜还卡着，今晚全亮不了。先修缮，或者选半亮/熄灯。")
                continue
            print(game.night(mode))
            break
        game.end_of_day()


# ---------------------------------------------------------------- 自我对弈（验平衡）

def self_play(seed, days=DAYS):
    game = Game(seed)

    def ask(prompt):
        # 自动玩家：遇险就救（如果够资源），便宜油不买。
        if "出海救援" in prompt:
            return "救" if game.fuel >= 4 and game.food >= 2 else "不救"
        return "不买"

    while game.day <= days:
        over, _ = game.over()
        if over:
            return over, game
        game.log = []
        game.run_event(ask, lambda *a, **k: None)
        over, _ = game.over()
        if over:
            return over, game
        ap = 2
        while ap > 0:
            if game.fuel < 10 and game.money >= game.fuel_price[game.day - 1]:
                game.do_action("买油")
            elif game.food < 5 and game.money >= 10:
                game.do_action("买粮")
            elif game.condition < 60 and game.money >= 10:
                game.do_action("修缮")
            elif game.clues < game.theft_seen and game.clues < 3:
                game.do_action("巡视")
            elif game.clues >= 3 and not game.thief_stopped:
                game.do_action("对质")
            elif game.food < 8:
                game.do_action("捕鱼")
            else:
                game.do_action("休息")
            ap -= 1
        mode = "full" if game.fuel >= 6 else ("half" if game.fuel >= 2 else "off")
        if mode == "full" and game.malfunction:
            mode = "half"
        game.night(mode)
        game.end_of_day()
    over, _ = game.over()
    return over, game


# ---------------------------------------------------------------- 导出 / 入口

def export_sealed(game, outdir="."):
    import os
    lines = ["# 密封：玩家勿看", "", "《雾岛灯塔 · 守塔人》真相（种子 {}）".format(game.seed), ""]
    lines.append("## 船期规律（隐藏规则）")
    lines.append("船跟着一个周期走：周期 {} 夜，相位 {}。".format(
        game.ship_period, game.ship_phase))
    lines.append("“周期夜”（(夜 - {}) % {} == 0）有船的概率 90%，".format(
        game.ship_phase, game.ship_period))
    lines.append("“非周期夜”有船的概率 10%。")
    lines.append("玩家靠观察船期记录（ships）可以发现规律，")
    lines.append("然后只在周期夜全亮、非周期夜省油。")
    lines.append("")
    lines.append("## 窃贼")
    lines.append("偷油的是{}。线索 1 是脚印，线索 2 是{}线索 3 是村边棚屋里的油桶。".format(
        game.thief, game.thief_clue))
    lines.append("集齐 3 条线索后“对质”可以止损。神秘访客卖的是掺水油，"
                 "买了之后 3 夜烧油翻倍 —— 他是窃贼的同伙。")
    lines.append("")
    lines.append("## 每天的安排（事件 / 有船 / 油价）")
    for i in range(DAYS):
        lines.append("  第 {:2d} 天：{} / {} / 油价 {}".format(
            i + 1, EVENT_NAMES[game.events[i]],
            "有船" if game.ship_pass[i] else "无船",
            game.fuel_price[i]))
    lines.append("")
    lines.append("## 偷油的夜晚")
    lines.append("  第 {} 天的夜里（共 {} 次）。".format(
        "、".join(str(d) for d in game.theft_days), len(game.theft_days)))
    lines.append("")
    lines.append("（玩家打完本局后可看。下一局换种子，全变。）")
    with open(os.path.join(outdir, "SEALED.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return "SEALED.md"


def main(argv=None):
    ap = argparse.ArgumentParser(description="《雾岛灯塔 · 守塔人》")
    ap.add_argument("--seed", type=int, default=7, help="种子（默认 7）")
    ap.add_argument("--export", action="store_true", help="生成 SEALED.md")
    ap.add_argument("--reveal", action="store_true", help="直接看真相（裁判用）")
    ap.add_argument("--self-play", action="store_true", help="自动打一局（验平衡）")
    ap.add_argument("--days", type=int, default=DAYS)
    args = ap.parse_args(argv)

    game = Game(args.seed)
    if args.reveal:
        print("种子 {}：窃贼是{}；偷油夜：第 {} 天；船期周期 {} 夜、相位 {}。".format(
            args.seed, game.thief, "、".join(str(d) for d in game.theft_days),
            game.ship_period, game.ship_phase))
        return 0
    if args.export:
        export_sealed(game)
        print("已生成 SEALED.md（种子 {}）".format(args.seed))
        return 0
    if args.self_play:
        result, g = self_play(args.seed, args.days)
        print("种子 {}：{}（声望 {}，燃油 {}，雾币 {}，点灯 {} 夜，线索 {}/3）".format(
            args.seed, result, g.rep, g.fuel, g.money, g.lit_nights, g.clues))
        return 0
    return 0 if play_cli(game) in ("win", "quit") else 0


if __name__ == "__main__":
    sys.exit(main())

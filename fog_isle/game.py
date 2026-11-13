"""游戏主体：状态、回合、命令解析、存档、胜利判定。

双人合作制：A 和 B 各管一个育种所，共享图鉴、市场和传说目标。
每天每人 2 个行动点；A 行动完换 B，B 结束则进入夜晚结算。
"""

import json
import random

from .codex import Codex
from .creatures import Creature, breed, initial_creatures, random_creature, species_name
from .events import draw_event
from .genetics import SeasonGenetics
from .market import Market, TradeOffer

MAX_DAYS = 30
ACTIONS_PER_DAY = 2
START_COINS = 50
EGG_PRICE = 20


def _rng_to_json(state):
    version, internal, gauss = state
    return [version, list(internal), gauss]


def _rng_from_json(data):
    version, internal, gauss = data
    return (version, tuple(internal), gauss)


class Game:
    def __init__(self, seed=None):
        self.seed = seed if seed is not None else random.randint(0, 10 ** 9)
        self.rng = random.Random(self.seed)
        self.season = SeasonGenetics(self.seed)
        self.codex = Codex(self.season)
        self.day = 1
        self.max_days = MAX_DAYS
        self.current = "A"
        self.names = {"A": "A", "B": "B"}
        self.players = {
            p: {"creatures": [], "coins": START_COINS, "ap": ACTIONS_PER_DAY}
            for p in ("A", "B")
        }
        self._next_creature_id = 1
        self._next_offer_id = 1
        self._next_borrow_id = 1
        self.market = Market(self.rng, self.season, self.next_id)
        self.trade_offers = []
        self.borrow_requests = []
        self.loans = []
        self.flags = {"fog": False, "bountiful": False, "egg_available": False}
        self.won = False
        self.winner = None
        self.over = False
        self.log = []
        for p in ("A", "B"):
            creatures = initial_creatures(self.rng, self.season, self.next_id,
                                          owner=p)
            self.players[p]["creatures"].extend(creatures)
            for c in creatures:
                self.codex.observe(c)

    def next_id(self):
        cid = self._next_creature_id
        self._next_creature_id += 1
        return cid

    def display_name(self, player):
        return self.names.get(player, player)

    def find_creature(self, player, cid):
        for c in self.players[player]["creatures"]:
            if c.id == cid:
                return c
        return None

    def find_any_creature(self, cid):
        for p in ("A", "B"):
            c = self.find_creature(p, cid)
            if c:
                return p, c
        return None, None

    def _display_creature(self, creature):
        """外观描述；雾夜时隐藏最后一个可见性状。"""
        if self.flags.get("fog"):
            traits = creature.visible_traits(self.season)
            if len(traits) > 1:
                traits = traits[:-1]
            desc = species_name(creature.species)
            if traits:
                desc += "（" + "、".join(traits) + "）"
            if creature.name:
                desc = "%s·%s" % (creature.name, desc)
            if creature.sick:
                desc += "【生病】"
            return desc
        return creature.appearance(self.season)

    def _use_ap(self, player, cost=1):
        if self.players[player]["ap"] < cost:
            return False
        self.players[player]["ap"] -= cost
        return True

    def _add_creature(self, player, creature):
        creature.owner = player
        self.players[player]["creatures"].append(creature)
        self.codex.observe(creature)
        self._check_legendary(player, creature)

    def _check_legendary(self, player, creature):
        if self.won:
            return
        traits = set(creature.visible_traits(self.season))
        if set(self.season.legendary).issubset(traits):
            self.won = True
            self.over = True
            self.winner = (player, creature.id)
            self.log.append("传说诞生：%s 培育出雾岛之主！" % self.display_name(player))

    def end_turn(self, player):
        if player != self.current:
            return "现在不是 %s 的回合。" % self.display_name(player)
        if self.current == "A":
            self.current = "B"
            self.players["B"]["ap"] = ACTIONS_PER_DAY
            return "轮到 %s 行动。" % self.display_name("B")
        return self._night_phase()

    def _night_phase(self):
        lines = ["—— 夜晚结算 ——"]
        for p in ("A", "B"):
            for c in self.players[p]["creatures"]:
                c.sick = False
        self.loans = []
        self.flags = {"fog": False, "bountiful": False, "egg_available": False}
        lines.append(draw_event(self, self.rng))
        self.market.refresh(self.rng, self.season, self.next_id, n=1)
        self.market.refresh_commissions(self.rng, self.season)
        self.day += 1
        if self.day > self.max_days:
            self.over = True
            lines.append("第 %d 天结束，本季结束。" % self.max_days)
            lines.append(self.season_summary())
        else:
            self.current = "A"
            for p in ("A", "B"):
                self.players[p]["ap"] = ACTIONS_PER_DAY
            lines.append("第 %d 天开始，轮到 %s 行动。" % (self.day, self.display_name("A")))
        return "\n".join(lines)

    def season_summary(self):
        found, total = self.codex.progress()
        total_creatures = sum(len(self.players[p]["creatures"]) for p in ("A", "B"))
        total_coins = sum(self.players[p]["coins"] for p in ("A", "B"))
        score = found * 10 + total_creatures * 2 + total_coins
        lines = ["【季末结算】"]
        if self.won:
            player, cid = self.winner
            lines.append("胜利！%s 培育出了传说「雾岛之主」（雾兽 #%d）。"
                         % (self.display_name(player), cid))
        else:
            lines.append("本季没有培育出雾岛之主。传说条件是：%s。"
                         % "、".join(self.season.legendary))
        lines.append("图鉴：%d / %d；雾兽总数：%d；雾币总数：%d；得分：%d"
                     % (found, total, total_creatures, total_coins, score))
        lines.append("输入 new [种子] 开始新一季（新种子 = 新的基因系统）。")
        return "\n".join(lines)

    def dispatch(self, player, line):
        """解析并执行一条命令，返回中文回复。player 为 "A" 或 "B"。"""
        if self.over and not line.strip().startswith(("new", "load", "save", "help")):
            return "本季已结束。输入 new [种子] 开始新一季，或 load 读档。"
        if player != self.current:
            return "现在不是 %s 的回合（当前：%s）。" % (
                self.display_name(player), self.display_name(self.current))
        parts = line.strip().split()
        if not parts:
            return ""
        cmd = parts[0]
        args = parts[1:]
        handler = getattr(self, "_cmd_" + cmd.replace("-", "_"), None)
        if handler is None:
            return "未知命令：%s。输入 help 查看命令。" % cmd
        try:
            return handler(player, args)
        except (ValueError, IndexError, KeyError) as exc:
            return "命令格式不对：%s。输入 help 查看用法。" % exc

    def _cmd_help(self, player, args):
        return (
            "【命令】\n"
            "status —— 查看自己的育种所\n"
            "state —— 查看完整状态（适合粘贴到聊天）\n"
            "codex —— 查看图鉴（已发现 + ???）\n"
            "market —— 查看市场\n"
            "commission —— 查看委托\n"
            "offers —— 查看待处理交易和借配请求\n"
            "breed <id1> <id2> —— 繁殖两只雾兽（1 行动点）\n"
            "borrow <A|B> <id> —— 向对方借一只雾兽配种（1 行动点）\n"
            "borrow-accept <请求id> / borrow-decline <请求id> —— 回应借配\n"
            "buy <市场id> —— 买市场雾兽（1 行动点）\n"
            "sell <id> —— 卖雾兽给市场（1 行动点）\n"
            "trade offer <我的id> for <对方id> [雾币] —— 发起交易（1 行动点）\n"
            "trade accept <交易id> / trade decline <交易id> —— 回应交易\n"
            "explore —— 探索岛屿（1 行动点）\n"
            "claim <委托id> —— 完成委托（1 行动点）\n"
            "egg —— 买神秘蛋（20 雾币，1 行动点，仅当有蛋时）\n"
            "name <id> <名字> —— 给雾兽命名\n"
            "end —— 结束回合\n"
            "save <文件> / load <文件> —— 存档 / 读档\n"
            "new [种子] —— 新一季\n"
            "quit —— 退出\n"
            "每天每人 2 个行动点；一季 30 天。传说目标见 codex。"
        )

    def _cmd_status(self, player, args):
        p = self.players[player]
        lines = ["【%s 的育种所】第 %d 天 / %d 天 · 雾币 %d · 行动点 %d"
                 % (self.display_name(player), self.day, self.max_days,
                    p["coins"], p["ap"])]
        if not p["creatures"]:
            lines.append("（所里没有雾兽）")
        for c in p["creatures"]:
            lines.append("  #%d %s（第 %d 代）" % (
                c.id, self._display_creature(c), c.generation))
        lines.append("图鉴进度：%d / %d；传说：%s"
                     % (self.codex.progress()[0], self.codex.progress()[1],
                        "、".join(self.codex.legendary_revealed())))
        return "\n".join(lines)

    def _cmd_state(self, player, args):
        parts = [self._cmd_status(player, args), "",
                 self.codex.render(), "",
                 self.market.render_stock(self.season), "",
                 self.market.render_commissions(), "",
                 self._cmd_offers(player, args)]
        return "\n".join(parts)

    def _cmd_codex(self, player, args):
        return self.codex.render()

    def _cmd_market(self, player, args):
        return self.market.render_stock(self.season)

    def _cmd_commission(self, player, args):
        return self.market.render_commissions()

    def _cmd_offers(self, player, args):
        lines = ["【待处理】"]
        any_pending = False
        for offer in self.trade_offers:
            if offer.to_player == player or offer.from_player == player:
                any_pending = True
                lines.append("  交易 #%d：%s 用 #%d 换 %s 的 #%d（+%d 雾币）"
                             % (offer.id, self.display_name(offer.from_player),
                                offer.offered_id,
                                self.display_name(offer.to_player),
                                offer.wanted_id, offer.coins))
        for req in self.borrow_requests:
            if req["status"] == "pending" and (
                    req["to"] == player or req["from"] == player):
                any_pending = True
                lines.append("  借配 #%d：%s 向 %s 借 #%d"
                             % (req["id"], self.display_name(req["from"]),
                                self.display_name(req["to"]),
                                req["creature_id"]))
        if not any_pending:
            lines.append("（无）")
        return "\n".join(lines)

    def _cmd_breed(self, player, args):
        if len(args) < 2:
            return "用法：breed <id1> <id2>"
        id1, id2 = int(args[0]), int(args[1])
        owner1, c1 = self.find_any_creature(id1)
        owner2, c2 = self.find_any_creature(id2)
        if not c1 or not c2:
            return "找不到这只雾兽（id 不对）。"
        if c1 is c2:
            return "不能和自己繁殖。"
        loaned = {loan["creature_id"] for loan in self.loans
                  if loan["borrower"] == player}
        if owner1 != player and id1 not in loaned:
            return "#%d 不是你的，也没有借给你。" % id1
        if owner2 != player and id2 not in loaned:
            return "#%d 不是你的，也没有借给你。" % id2
        if c1.sick or c2.sick:
            return "有雾兽生病了，今天不能繁殖。"
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        n_extra = 1 if self.flags.get("bountiful") else 0
        self.flags["bountiful"] = False
        children = breed(c1, c2, self.rng, self.season, self.next_id, player)
        if n_extra:
            extra = breed(c1, c2, self.rng, self.season, self.next_id, player)
            children.extend(extra[:1])
        lines = []
        for child in children:
            self._add_creature(player, child)
            lines.append("  诞生 #%d %s" % (child.id, self._display_creature(child)))
            if self.won:
                lines.append(self.season_summary())
                return "\n".join(lines)
        return "繁殖成功，得到 %d 只后代：\n%s" % (len(children), "\n".join(lines))

    def _cmd_borrow(self, player, args):
        if len(args) < 2:
            return "用法：borrow <A|B> <id>"
        target = args[0].upper()
        cid = int(args[1])
        if target not in ("A", "B") or target == player:
            return "借配对象不对（要借对方的雾兽）。"
        if not self.find_creature(target, cid):
            return "对方没有 #%d 这只雾兽。" % cid
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        req = {"id": self._next_borrow_id, "from": player, "to": target,
               "creature_id": cid, "status": "pending"}
        self._next_borrow_id += 1
        self.borrow_requests.append(req)
        return ("已向 %s 发出借配请求（#%d，借 #%d），等对方回应。"
                % (self.display_name(target), req["id"], cid))

    def _cmd_borrow_accept(self, player, args):
        if not args:
            return "用法：borrow-accept <请求id>"
        rid = int(args[0])
        for req in self.borrow_requests:
            if req["id"] == rid and req["to"] == player and req["status"] == "pending":
                req["status"] = "accepted"
                self.loans.append({"borrower": req["from"], "owner": player,
                                   "creature_id": req["creature_id"]})
                return ("已接受借配：%s 今天可以用你的 #%d 繁殖。"
                        % (self.display_name(req["from"]), req["creature_id"]))
        return "没有这个待处理的借配请求。"

    def _cmd_borrow_decline(self, player, args):
        if not args:
            return "用法：borrow-decline <请求id>"
        rid = int(args[0])
        for req in self.borrow_requests:
            if req["id"] == rid and req["to"] == player and req["status"] == "pending":
                req["status"] = "declined"
                return "已拒绝借配请求 #%d。" % rid
        return "没有这个待处理的借配请求。"

    def _cmd_buy(self, player, args):
        if not args:
            return "用法：buy <市场id>"
        mid = int(args[0])
        item = self.market.find_item(mid)
        if not item:
            return "市场没有这个编号。"
        if self.players[player]["coins"] < item["price"]:
            return "雾币不足（需要 %d，你有 %d）。" % (
                item["price"], self.players[player]["coins"])
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        self.players[player]["coins"] -= item["price"]
        self.market.remove_item(mid)
        creature = item["creature"]
        self._add_creature(player, creature)
        msg = "买下 #%d %s，花费 %d 雾币。" % (
            creature.id, self._display_creature(creature), item["price"])
        if self.won:
            msg += "\n" + self.season_summary()
        return msg

    def _cmd_sell(self, player, args):
        if not args:
            return "用法：sell <id>"
        cid = int(args[0])
        creature = self.find_creature(player, cid)
        if not creature:
            return "你没有 #%d 这只雾兽。" % cid
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        traits = creature.visible_traits(self.season)
        price = 10 + 5 * len(traits)
        rare = [t for t in traits if t in self.season.legendary]
        if rare:
            price += 10
        self.players[player]["creatures"].remove(creature)
        self.players[player]["coins"] += price
        return "卖出 #%d，得到 %d 雾币。" % (cid, price)

    def _cmd_trade(self, player, args):
        if not args:
            return "用法：trade offer <我的id> for <对方id> [雾币]；trade accept/decline <交易id>"
        sub = args[0]
        if sub == "offer":
            if len(args) < 4 or args[2] != "for":
                return "用法：trade offer <我的id> for <对方id> [雾币]"
            my_id = int(args[1])
            their_id = int(args[3])
            coins = int(args[4]) if len(args) > 4 else 0
            if not self.find_creature(player, my_id):
                return "你没有 #%d 这只雾兽。" % my_id
            other = "B" if player == "A" else "A"
            if not self.find_creature(other, their_id):
                return "对方没有 #%d 这只雾兽。" % their_id
            if coins < 0 or coins > self.players[player]["coins"]:
                return "雾币数量不对（你有 %d）。" % self.players[player]["coins"]
            if not self._use_ap(player):
                return "行动点不足（每天 2 点），先 end 结束回合。"
            offer = TradeOffer(self._next_offer_id, player, other, my_id,
                               their_id, coins)
            self._next_offer_id += 1
            self.trade_offers.append(offer)
            return ("已向 %s 发出交易（#%d）：你的 #%d 换对方的 #%d，另加 %d 雾币。"
                    % (self.display_name(other), offer.id, my_id, their_id, coins))
        if sub == "accept":
            if len(args) < 2:
                return "用法：trade accept <交易id>"
            oid = int(args[1])
            for offer in self.trade_offers:
                if offer.id == oid and offer.to_player == player:
                    my_creature = self.find_creature(player, offer.wanted_id)
                    their_creature = self.find_creature(offer.from_player,
                                                        offer.offered_id)
                    if not my_creature or not their_creature:
                        self.trade_offers.remove(offer)
                        return "交易失效：有雾兽已经不在了。"
                    if self.players[offer.from_player]["coins"] < offer.coins:
                        return "对方雾币不足，交易无法完成。"
                    self.players[player]["creatures"].remove(my_creature)
                    self.players[offer.from_player]["creatures"].remove(their_creature)
                    my_creature.owner = offer.from_player
                    their_creature.owner = player
                    self.players[offer.from_player]["creatures"].append(my_creature)
                    self.players[player]["creatures"].append(their_creature)
                    if offer.coins:
                        self.players[offer.from_player]["coins"] -= offer.coins
                        self.players[player]["coins"] += offer.coins
                    self.codex.observe(my_creature)
                    self.codex.observe(their_creature)
                    self.trade_offers.remove(offer)
                    self._check_legendary(player, their_creature)
                    msg = ("交易完成：你用 #%d 换到了 #%d %s。"
                           % (offer.wanted_id, their_creature.id,
                              self._display_creature(their_creature)))
                    if self.won:
                        msg += "\n" + self.season_summary()
                    return msg
            return "没有这个待处理的交易。"
        if sub == "decline":
            if len(args) < 2:
                return "用法：trade decline <交易id>"
            oid = int(args[1])
            for offer in self.trade_offers:
                if offer.id == oid and offer.to_player == player:
                    self.trade_offers.remove(offer)
                    return "已拒绝交易 #%d。" % oid
            return "没有这个待处理的交易。"
        return "用法：trade offer/accept/decline。"

    def _cmd_explore(self, player, args):
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        roll = self.rng.random()
        if roll < 0.30:
            creature = random_creature(self.rng, self.season, self.next_id,
                                       allow_rare=False)
            self._add_creature(player, creature)
            msg = "探索：雾里钻出一只野雾兽，捕捉成功：#%d %s。" % (
                creature.id, self._display_creature(creature))
        elif roll < 0.55:
            self.flags["egg_available"] = True
            msg = ("探索：雾里滚来一枚温热的神秘蛋，20 雾币可买下（用 egg 命令），"
                   "孵出来的雾兽稀有性状概率更高。今晚之前有效。")
        elif roll < 0.75:
            self.players[player]["coins"] += 10
            msg = "探索：雾里捡到 10 雾币。"
        else:
            msg = "探索：雾茫茫一片，什么也没找到。"
        if self.won:
            msg += "\n" + self.season_summary()
        return msg

    def _cmd_egg(self, player, args):
        if not self.flags.get("egg_available"):
            return "现在没有神秘蛋（探索或事件有时会带来）。"
        if self.players[player]["coins"] < EGG_PRICE:
            return "雾币不足（需要 %d，你有 %d）。" % (
                EGG_PRICE, self.players[player]["coins"])
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        self.players[player]["coins"] -= EGG_PRICE
        self.flags["egg_available"] = False
        creature = random_creature(self.rng, self.season, self.next_id,
                                   allow_rare=True)
        self._add_creature(player, creature)
        msg = "神秘蛋孵化了：#%d %s。" % (creature.id, self._display_creature(creature))
        if self.won:
            msg += "\n" + self.season_summary()
        return msg

    def _cmd_claim(self, player, args):
        if not args:
            return "用法：claim <委托id>"
        cid = int(args[0])
        commission = None
        for c in self.market.commissions:
            if c.id == cid:
                commission = c
                break
        if not commission:
            return "没有这个委托。"
        match = None
        for creature in self.players[player]["creatures"]:
            if commission.matches(creature, self.season):
                match = creature
                break
        if not match:
            return "你还没有符合「%s」的雾兽。" % commission.description
        if not self._use_ap(player):
            return "行动点不足（每天 2 点），先 end 结束回合。"
        self.players[player]["coins"] += commission.reward
        self.market.remove_commission(cid)
        self.market.add_commission(self.rng, self.season)
        return ("完成委托「%s」（用 #%d），得到 %d 雾币。"
                % (commission.description, match.id, commission.reward))

    def _cmd_name(self, player, args):
        if len(args) < 2:
            return "用法：name <id> <名字>"
        cid = int(args[0])
        creature = self.find_creature(player, cid)
        if not creature:
            return "你没有 #%d 这只雾兽。" % cid
        creature.name = args[1]
        return "已把 #%d 命名为「%s」。" % (cid, args[1])

    def _cmd_end(self, player, args):
        return self.end_turn(player)

    def _cmd_new(self, player, args):
        seed = int(args[0]) if args else None
        fresh = Game(seed=seed)
        fresh.names = dict(self.names)
        self.__dict__.update(fresh.__dict__)
        return ("新一季开始（种子 %d）。基因系统已重新随机，"
                "上一季的规律不再适用。\n%s"
                % (self.seed, self._cmd_status("A", [])))

    def to_dict(self):
        return {
            "seed": self.seed,
            "rng_state": _rng_to_json(self.rng.getstate()),
            "day": self.day,
            "max_days": self.max_days,
            "current": self.current,
            "names": self.names,
            "players": {
                p: {"creatures": [c.to_dict() for c in data["creatures"]],
                    "coins": data["coins"], "ap": data["ap"]}
                for p, data in self.players.items()
            },
            "next_creature_id": self._next_creature_id,
            "next_offer_id": self._next_offer_id,
            "next_borrow_id": self._next_borrow_id,
            "market": self.market.to_dict(),
            "trade_offers": [o.to_dict() for o in self.trade_offers],
            "borrow_requests": self.borrow_requests,
            "loans": self.loans,
            "flags": self.flags,
            "won": self.won,
            "winner": self.winner,
            "over": self.over,
            "season": self.season.to_dict(),
            "codex": self.codex.to_dict(),
        }

    @classmethod
    def from_dict(cls, data):
        obj = cls.__new__(cls)
        obj.seed = data["seed"]
        obj.rng = random.Random()
        obj.rng.setstate(_rng_from_json(data["rng_state"]))
        obj.season = SeasonGenetics.from_dict(data["season"])
        obj.codex = Codex.from_dict(data["codex"], obj.season)
        obj.day = data["day"]
        obj.max_days = data["max_days"]
        obj.current = data["current"]
        obj.names = data["names"]
        obj.players = {
            p: {"creatures": [Creature.from_dict(c) for c in d["creatures"]],
                "coins": d["coins"], "ap": d["ap"]}
            for p, d in data["players"].items()
        }
        obj._next_creature_id = data["next_creature_id"]
        obj._next_offer_id = data["next_offer_id"]
        obj._next_borrow_id = data["next_borrow_id"]
        obj.market = Market.from_dict(data["market"])
        obj.trade_offers = [TradeOffer.from_dict(o) for o in data["trade_offers"]]
        obj.borrow_requests = data["borrow_requests"]
        obj.loans = data["loans"]
        obj.flags = data["flags"]
        obj.won = data["won"]
        obj.winner = tuple(data["winner"]) if data["winner"] else None
        obj.over = data["over"]
        obj.log = []
        return obj

    def _cmd_save(self, player, args):
        if not args:
            return "用法：save <文件>"
        path = args[0]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)
        return "已存档到 %s（第 %d 天）。" % (path, self.day)

    def _cmd_load(self, player, args):
        if not args:
            return "用法：load <文件>"
        path = args[0]
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        loaded = Game.from_dict(data)
        self.__dict__.update(loaded.__dict__)
        return "已读档（第 %d 天，种子 %d）。" % (self.day, self.seed)

"""市场、委托、交易。

市场：轮换的待售雾兽，只显示外观，不显示基因型——买是赌。
委托：要求某个（些）性状的培育任务，完成后得雾币。
交易：玩家之间换雾兽（可附加雾币），是发现对方品系的途径。
"""

import random

from .creatures import random_creature
from .genetics import all_present_traits


class Commission:
    def __init__(self, cid, description, required_traits, required_species,
                 reward):
        self.id = cid
        self.description = description
        self.required_traits = list(required_traits)
        self.required_species = required_species  # 物种名或 None
        self.reward = reward

    def matches(self, creature, season):
        traits = set(creature.visible_traits(season))
        if not set(self.required_traits).issubset(traits):
            return False
        if self.required_species:
            from .creatures import species_name
            if species_name(creature.species) != self.required_species:
                return False
        return True

    def to_dict(self):
        return {"id": self.id, "description": self.description,
                "required_traits": self.required_traits,
                "required_species": self.required_species,
                "reward": self.reward}

    @classmethod
    def from_dict(cls, data):
        return cls(data["id"], data["description"], data["required_traits"],
                   data["required_species"], data["reward"])


class TradeOffer:
    def __init__(self, oid, from_player, to_player, offered_id, wanted_id,
                 coins=0):
        self.id = oid
        self.from_player = from_player
        self.to_player = to_player
        self.offered_id = offered_id
        self.wanted_id = wanted_id
        self.coins = coins

    def to_dict(self):
        return {"id": self.id, "from_player": self.from_player,
                "to_player": self.to_player, "offered_id": self.offered_id,
                "wanted_id": self.wanted_id, "coins": self.coins}

    @classmethod
    def from_dict(cls, data):
        return cls(data["id"], data["from_player"], data["to_player"],
                   data["offered_id"], data["wanted_id"], data["coins"])


class Market:
    def __init__(self, rng, season, next_id):
        self.stock = []  # [{"id": market_id, "creature": Creature, "price": int}]
        self.special = []  # 商人特售（同上结构）
        self.commissions = []
        self._next_market_id = 1
        self._next_commission_id = 1
        for _ in range(3):
            self._add_stock(rng, season, next_id)
        for _ in range(3):
            self.add_commission(rng, season)

    def _add_stock(self, rng, season, next_id):
        creature = random_creature(rng, season, next_id, allow_rare=False)
        # 偶尔混一只带稀有基因的（外观上可能看出来，也可能藏着）。
        if rng.random() < 0.25:
            creature = random_creature(rng, season, next_id, allow_rare=True)
        price = 15 + 5 * len(creature.visible_traits(season))
        if rng.random() < 0.15:
            price += 15
        item = {"id": self._next_market_id, "creature": creature,
                "price": price}
        self._next_market_id += 1
        self.stock.append(item)
        return item

    def add_special(self, creature, price):
        item = {"id": self._next_market_id, "creature": creature,
                "price": price}
        self._next_market_id += 1
        self.special.append(item)
        return item

    def refresh(self, rng, season, next_id, n=1):
        for _ in range(n):
            if self.stock:
                self.stock.pop(0)
            self._add_stock(rng, season, next_id)

    def refresh_all(self, rng, season, next_id):
        self.stock = []
        for _ in range(3):
            self._add_stock(rng, season, next_id)

    def find_item(self, market_id):
        for item in self.stock + self.special:
            if item["id"] == market_id:
                return item
        return None

    def remove_item(self, market_id):
        for lst in (self.stock, self.special):
            for item in lst:
                if item["id"] == market_id:
                    lst.remove(item)
                    return item
        return None

    def add_commission(self, rng, season, double=False):
        traits = all_present_traits()
        required = [rng.choice(traits)]
        species = None
        if rng.random() < 0.35:
            from .creatures import BASE_ORDER, species_name
            species = species_name(frozenset([rng.choice(BASE_ORDER)]))
        reward = rng.choice([20, 30, 40, 50, 60])
        if double:
            reward *= 2
        if species:
            desc = "培育一只%s的%s" % ("、".join(required), species)
        else:
            desc = "培育一只拥有「%s」的雾兽" % "、".join(required)
        commission = Commission(self._next_commission_id, desc, required,
                                species, reward)
        self._next_commission_id += 1
        self.commissions.append(commission)
        return commission

    def refresh_commissions(self, rng, season):
        while len(self.commissions) < 3:
            self.add_commission(rng, season)

    def remove_commission(self, cid):
        for c in self.commissions:
            if c.id == cid:
                self.commissions.remove(c)
                return c
        return None

    def render_stock(self, season):
        lines = ["【市场】"]
        if not self.stock and not self.special:
            lines.append("（空）")
        for item in self.stock:
            c = item["creature"]
            lines.append("  [%d] %s —— %d 雾币"
                         % (item["id"], c.appearance(season), item["price"]))
        for item in self.special:
            c = item["creature"]
            lines.append("  [%d] %s —— %d 雾币（特售）"
                         % (item["id"], c.appearance(season), item["price"]))
        return "\n".join(lines)

    def render_commissions(self):
        lines = ["【委托】"]
        if not self.commissions:
            lines.append("（暂无）")
        for c in self.commissions:
            lines.append("  [%d] %s —— 报酬 %d 雾币"
                         % (c.id, c.description, c.reward))
        return "\n".join(lines)

    def to_dict(self):
        return {
            "stock": [{"id": i["id"], "creature": i["creature"].to_dict(),
                       "price": i["price"]} for i in self.stock],
            "special": [{"id": i["id"], "creature": i["creature"].to_dict(),
                         "price": i["price"]} for i in self.special],
            "commissions": [c.to_dict() for c in self.commissions],
            "next_market_id": self._next_market_id,
            "next_commission_id": self._next_commission_id,
        }

    @classmethod
    def from_dict(cls, data):
        from .creatures import Creature
        obj = cls.__new__(cls)
        obj.stock = [{"id": i["id"],
                      "creature": Creature.from_dict(i["creature"]),
                      "price": i["price"]} for i in data["stock"]]
        obj.special = [{"id": i["id"],
                        "creature": Creature.from_dict(i["creature"]),
                        "price": i["price"]} for i in data["special"]]
        obj.commissions = [Commission.from_dict(c) for c in data["commissions"]]
        obj._next_market_id = data["next_market_id"]
        obj._next_commission_id = data["next_commission_id"]
        return obj

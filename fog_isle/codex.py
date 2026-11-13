"""图鉴：看得见的未知边界。

条目分两类：性状、物种。未发现显示「???」。
性状条目被发现后，还会揭示该性状所在位点的隐藏规则
（显性/隐性/不完全显性/上位），这就是「发现规律」的快感。
传说目标的 3 个条件藏在图鉴末尾，随相关性状被发现而逐步揭示。
"""

from .creatures import BASE_ORDER, species_name
from .genetics import BLEND_TRAITS, LOCI, present_traits


class Codex:
    def __init__(self, season):
        self.season = season
        # 性状条目：性状名 -> {"discovered": bool, "locus": 位点}
        self.traits = {}
        for locus in LOCI:
            for name in present_traits(locus):
                self.traits[name] = {"discovered": False, "locus": locus}
            blend = BLEND_TRAITS[locus]
            if blend not in self.traits:
                self.traits[blend] = {"discovered": False, "locus": locus}
        # 物种条目：基础物种先列出，杂交物种发现时动态加入。
        self.species = {}
        for base in BASE_ORDER:
            self.species[species_name(frozenset([base]))] = False
        self.legendary = list(season.legendary)

    def observe(self, creature):
        """观察一只雾兽：把它的可见性状和物种记入图鉴。"""
        for trait in creature.visible_traits(self.season):
            if trait in self.traits:
                self.traits[trait]["discovered"] = True
        name = species_name(creature.species)
        self.species[name] = True

    def discover_trait(self, trait):
        if trait in self.traits:
            self.traits[trait]["discovered"] = True

    def discover_species(self, name):
        self.species[name] = True

    def progress(self):
        total = len(self.traits) + len(self.species)
        found = (sum(1 for v in self.traits.values() if v["discovered"])
                 + sum(1 for v in self.species.values() if v))
        return found, total

    def legendary_revealed(self):
        """已揭示的传说条件（性状已被发现的才显示名字，否则 ???）。"""
        out = []
        for trait in self.legendary:
            if self.traits.get(trait, {}).get("discovered"):
                out.append(trait)
            else:
                out.append("???")
        return out

    def render(self):
        lines = ["【图鉴】"]
        found, total = self.progress()
        lines.append("发现进度：%d / %d" % (found, total))
        lines.append("")
        lines.append("—— 性状 ——")
        for locus in LOCI:
            names = list(present_traits(locus))
            blend = BLEND_TRAITS[locus]
            if blend not in names:
                names = names + [blend]
            rendered = []
            for name in names:
                entry = self.traits[name]
                if entry["discovered"]:
                    rendered.append("%s（%s）" % (name, _rule_short(self.season, locus)))
                else:
                    rendered.append("???")
            lines.append("%s：%s" % (LOCI[locus]["name"], " / ".join(rendered)))
        lines.append("")
        lines.append("—— 物种 ——")
        species_rendered = []
        for name, found_flag in self.species.items():
            species_rendered.append(name if found_flag else "???")
        lines.append(" / ".join(species_rendered))
        lines.append("")
        lines.append("—— 传说「雾岛之主」——")
        lines.append("培育出一只同时拥有以下 3 个性状的雾兽：")
        for item in self.legendary_revealed():
            lines.append("  · %s" % item)
        return "\n".join(lines)

    def to_dict(self):
        return {
            "traits": {k: v["discovered"] for k, v in self.traits.items()},
            "species": dict(self.species),
        }

    @classmethod
    def from_dict(cls, data, season):
        obj = cls.__new__(cls)
        obj.season = season
        obj.traits = {}
        for locus in LOCI:
            for name in present_traits(locus):
                obj.traits[name] = {"discovered": False, "locus": locus}
            blend = BLEND_TRAITS[locus]
            if blend not in obj.traits:
                obj.traits[blend] = {"discovered": False, "locus": locus}
        for name, discovered in data["traits"].items():
            if name in obj.traits:
                obj.traits[name]["discovered"] = discovered
        obj.species = dict(data["species"])
        obj.legendary = list(season.legendary)
        return obj


def _rule_short(season, locus):
    info = season.locus_rules[locus]
    rule = info["rule"]
    if rule == "dominant":
        return "显性"
    if rule == "recessive":
        return "隐性"
    if rule == "incomplete":
        return "不完全显性"
    return "上位"

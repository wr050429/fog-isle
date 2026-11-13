"""基因系统：每季由种子重新随机，是「持续未知」的核心。

每个雾兽的基因型 = 6 个位点 x 2 个等位基因。
每个位点每季随机一个表达规则（显性/隐性/不完全显性/上位），
玩家只能看到表现型，看不到基因型和规则。
"""

import random

# 位点定义：name 为中文名；alleles 为常见等位基因（id -> 性状名）；
# rare 为稀有等位基因，只能通过突变、市场或探索获得，不会出现在初始雾兽身上。
LOCI = {
    "SIZE": {
        "name": "体型",
        "alleles": {"small": "娇小", "medium": "匀称", "large": "壮硕"},
        "rare": {"giant": "巨型"},
    },
    "COAT": {
        "name": "毛色",
        "alleles": {"white": "白毛", "grey": "灰毛", "gold": "金色毛", "blue": "蓝毛"},
        "rare": {"purple": "紫毛", "iridescent": "虹彩毛"},
    },
    "HORN": {
        "name": "角",
        "alleles": {"none": "无角", "single": "独角", "double": "双角"},
        "rare": {"spiral": "螺旋角"},
    },
    "WING": {
        "name": "翼",
        "alleles": {"none": "无翼", "membrane": "膜翼", "feather": "羽翼"},
        "rare": {"light": "光翼"},
    },
    "TAIL": {
        "name": "尾",
        "alleles": {"short": "短尾", "long": "长尾", "mist": "雾尾"},
        "rare": {"forked": "分叉尾"},
    },
    "GLOW": {
        "name": "光",
        "alleles": {"none": "无光", "faint": "微光", "bright": "荧光"},
        "rare": {"rainbow": "虹光"},
    },
}

# 不完全显性时，杂合子表达的中间性状。
BLEND_TRAITS = {
    "SIZE": "中型",
    "COAT": "渐变毛",
    "HORN": "小角",
    "WING": "薄翼",
    "TAIL": "中尾",
    "GLOW": "淡光",
}

# 以「无」开头的性状表示「没有这个特征」，在外观描述里不列出。
ABSENT_PREFIX = "无"

RULES = ("dominant", "recessive", "incomplete", "epistatic")
RULE_NAMES = {
    "dominant": "显性",
    "recessive": "隐性",
    "incomplete": "不完全显性",
    "epistatic": "上位",
}

MUTATION_RATE = 0.04  # 每个位点每后代的突变概率


def trait_name(locus, allele):
    """等位基因对应的性状名。"""
    data = LOCI[locus]
    if allele in data["alleles"]:
        return data["alleles"][allele]
    return data["rare"][allele]


def all_alleles(locus):
    """该位点的全部等位基因 id（常见 + 稀有）。"""
    data = LOCI[locus]
    return list(data["alleles"]) + list(data["rare"])


def present_traits(locus):
    """该位点「有特征」的性状名（排除无角/无翼/无光这类缺失）。"""
    names = []
    for allele in all_alleles(locus):
        name = trait_name(locus, allele)
        if not name.startswith(ABSENT_PREFIX):
            names.append(name)
    return names


def all_present_traits():
    """全部位点的「有特征」性状名（含稀有、含中间性状）。"""
    names = []
    for locus in LOCI:
        names.extend(present_traits(locus))
        blend = BLEND_TRAITS[locus]
        if blend not in names:
            names.append(blend)
    return names


class SeasonGenetics:
    """一季的基因系统：由种子决定，上一季的规律下一季失效。"""

    def __init__(self, seed):
        self.seed = seed
        rng = random.Random(seed)
        self.locus_rules = {}
        for locus, data in LOCI.items():
            rule = rng.choice(RULES)
            key = rng.choice(list(data["alleles"]))
            gate = None
            if rule == "epistatic":
                other = rng.choice([l for l in LOCI if l != locus])
                gate_allele = rng.choice(list(LOCI[other]["alleles"]))
                gate = (other, gate_allele)
            self.locus_rules[locus] = {
                "rule": rule,
                "key": key,
                "blend": BLEND_TRAITS[locus],
                "gate": gate,
            }
        # 传说目标：3 个稀有性状（每季随机）。
        rare = []
        for locus, data in LOCI.items():
            for allele in data["rare"]:
                name = trait_name(locus, allele)
                if not name.startswith(ABSENT_PREFIX):
                    rare.append(name)
        self.legendary = rng.sample(rare, 3)

    # -- 表达 ---------------------------------------------------------
    def express(self, locus, pair, genotype):
        """计算一个位点的表达性状；返回性状名或 None（不表达）。"""
        info = self.locus_rules[locus]
        rule = info["rule"]
        key = info["key"]
        a1, a2 = pair
        if rule == "epistatic":
            gate_locus, gate_allele = info["gate"]
            if gate_allele not in genotype[gate_locus]:
                return None
            # 门打开后按显性表达。
            if key in (a1, a2):
                return trait_name(locus, key)
            return trait_name(locus, a1)
        if rule == "dominant":
            if key in (a1, a2):
                return trait_name(locus, key)
            return trait_name(locus, a1)
        if rule == "recessive":
            if a1 == key and a2 == key:
                return trait_name(locus, key)
            return trait_name(locus, a2 if a1 == key else a1)
        # incomplete
        if a1 == a2:
            return trait_name(locus, a1)
        if key in (a1, a2):
            return info["blend"]
        return trait_name(locus, a1)

    def phenotype(self, genotype):
        """基因型 -> {位点: 表达性状名或 None}。"""
        return {
            locus: self.express(locus, genotype[locus], genotype)
            for locus in LOCI
        }

    def visible_traits(self, genotype):
        """看得见的性状（排除不表达和「无」类缺失）。"""
        traits = []
        for locus, name in self.phenotype(genotype).items():
            if name and not name.startswith(ABSENT_PREFIX):
                traits.append(name)
        return traits

    def rule_description(self, locus):
        """该位点的规则描述（图鉴发现后揭示）。"""
        info = self.locus_rules[locus]
        rule = info["rule"]
        key_name = trait_name(locus, info["key"])
        if rule == "dominant":
            return "显性：%s 出现即显现" % key_name
        if rule == "recessive":
            return "隐性：%s 纯合才显现" % key_name
        if rule == "incomplete":
            return "不完全显性：杂合显现「%s」" % info["blend"]
        gate_locus, gate_allele = info["gate"]
        gate_name = trait_name(gate_locus, gate_allele)
        return "上位：需「%s」在场才显现，显现时为「%s」" % (gate_name, key_name)

    # -- 遗传 ---------------------------------------------------------
    def random_genotype(self, rng, allow_rare=False):
        """随机基因型。初始雾兽只用常见等位基因；allow_rare 时可带稀有。"""
        genotype = {}
        for locus, data in LOCI.items():
            pool = list(data["alleles"])
            if allow_rare:
                pool = pool + list(data["rare"])
            genotype[locus] = (rng.choice(pool), rng.choice(pool))
        return genotype

    def inherit(self, parent1, parent2, rng):
        """孟德尔分离 + 突变，产生后代基因型。"""
        child = {}
        for locus in LOCI:
            a = rng.choice(parent1[locus])
            b = rng.choice(parent2[locus])
            pair = [a, b]
            # 每条染色体各自有概率突变。
            for i in range(2):
                if rng.random() < MUTATION_RATE:
                    pair[i] = rng.choice(all_alleles(locus))
            child[locus] = (pair[0], pair[1])
        return child

    def to_dict(self):
        return {"seed": self.seed, "legendary": self.legendary,
                "locus_rules": {k: {"rule": v["rule"], "key": v["key"],
                                     "blend": v["blend"], "gate": v["gate"]}
                                for k, v in self.locus_rules.items()}}

    @classmethod
    def from_dict(cls, data):
        obj = cls.__new__(cls)
        obj.seed = data["seed"]
        obj.legendary = list(data["legendary"])
        obj.locus_rules = {}
        for locus, v in data["locus_rules"].items():
            gate = v["gate"]
            if gate is not None:
                gate = (gate[0], gate[1])
            obj.locus_rules[locus] = {"rule": v["rule"], "key": v["key"],
                                      "blend": v["blend"], "gate": gate}
        return obj

"""雾兽：个体、繁殖、突变、物种。

物种用一组基础物种字符表示（兔/狐/鹿/鸟），杂交时取并集，
名字按固定顺序拼成，如 {兔, 狐} -> 「雾兔狐」。同一对亲本物种
组合永远得到同一个杂交物种名。
"""

import random

from .genetics import LOCI

BASE_ORDER = ["兔", "狐", "鹿", "鸟"]
BASE_SPECIES = {c: frozenset([c]) for c in BASE_ORDER}


def species_name(species):
    """物种集合 -> 中文名，如 frozenset({'兔','狐'}) -> '雾兔狐'。"""
    chars = "".join(c for c in BASE_ORDER if c in species)
    return "雾" + chars


class Creature:
    def __init__(self, cid, species, genotype, parents=(), generation=1,
                 owner=None, name=None, sick=False):
        self.id = cid
        self.species = frozenset(species)
        self.genotype = {locus: tuple(pair) for locus, pair in genotype.items()}
        self.parents = tuple(parents)
        self.generation = generation
        self.owner = owner
        self.name = name
        self.sick = sick

    def visible_traits(self, season):
        """只显示表现型，基因型不暴露。"""
        return season.visible_traits(self.genotype)

    def appearance(self, season):
        traits = self.visible_traits(season)
        desc = species_name(self.species)
        if traits:
            desc += "（" + "、".join(traits) + "）"
        if self.name:
            desc = "%s·%s" % (self.name, desc)
        if self.sick:
            desc += "【生病】"
        return desc

    def to_dict(self):
        return {
            "id": self.id,
            "species": sorted(self.species),
            "genotype": {locus: list(pair) for locus, pair in self.genotype.items()},
            "parents": list(self.parents),
            "generation": self.generation,
            "owner": self.owner,
            "name": self.name,
            "sick": self.sick,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            cid=data["id"],
            species=frozenset(data["species"]),
            genotype={locus: tuple(pair) for locus, pair in data["genotype"].items()},
            parents=tuple(data["parents"]),
            generation=data["generation"],
            owner=data["owner"],
            name=data["name"],
            sick=data.get("sick", False),
        )


def breed(parent1, parent2, rng, season, next_id, owner):
    """繁殖一次，产生 1-3 只后代。"""
    n = rng.randint(1, 3)
    children = []
    for _ in range(n):
        genotype = season.inherit(parent1.genotype, parent2.genotype, rng)
        species = parent1.species | parent2.species
        generation = max(parent1.generation, parent2.generation) + 1
        child = Creature(
            cid=next_id(),
            species=species,
            genotype=genotype,
            parents=(parent1.id, parent2.id),
            generation=generation,
            owner=owner,
        )
        children.append(child)
    return children


def random_creature(rng, season, next_id, owner=None, allow_rare=False):
    """程序生成一只雾兽（市场、探索、神秘蛋用）。"""
    species = frozenset([rng.choice(BASE_ORDER)])
    genotype = season.random_genotype(rng, allow_rare=allow_rare)
    return Creature(cid=next_id(), species=species, genotype=genotype,
                    owner=owner)


def initial_creatures(rng, season, next_id, owner):
    """开局：每人 2 只，分属不同基础物种，常见基因型。"""
    chosen = rng.sample(BASE_ORDER, 2)
    creatures = []
    for base in chosen:
        genotype = season.random_genotype(rng, allow_rare=False)
        creatures.append(Creature(cid=next_id(), species=frozenset([base]),
                                  genotype=genotype, owner=owner))
    return creatures

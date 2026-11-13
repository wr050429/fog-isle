"""《雾岛育种所》单元测试。"""

import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fog_isle.creatures import Creature, breed, initial_creatures, species_name
from fog_isle.game import Game
from fog_isle.genetics import LOCI, SeasonGenetics, trait_name


def _season_with_rule(locus, rule, key, gate=None):
    season = SeasonGenetics(1)
    season.locus_rules[locus] = {"rule": rule, "key": key,
                                 "blend": "渐变毛" if locus == "COAT" else "中型",
                                 "gate": gate}
    return season


def test_dominant_rule():
    season = _season_with_rule("COAT", "dominant", "gold")
    # 有 key 等位基因即显现。
    assert season.express("COAT", ("gold", "white"), {}) == "金色毛"
    assert season.express("COAT", ("white", "gold"), {}) == "金色毛"
    # 没有 key，显现第一个等位基因的性状。
    assert season.express("COAT", ("white", "grey"), {}) == "白毛"


def test_recessive_rule():
    season = _season_with_rule("COAT", "recessive", "gold")
    # 纯合才显现。
    assert season.express("COAT", ("gold", "gold"), {}) == "金色毛"
    # 杂合显现另一条的性状。
    assert season.express("COAT", ("gold", "white"), {}) == "白毛"
    assert season.express("COAT", ("white", "gold"), {}) == "白毛"
    assert season.express("COAT", ("white", "grey"), {}) == "白毛"


def test_incomplete_rule():
    season = _season_with_rule("COAT", "incomplete", "gold")
    assert season.express("COAT", ("gold", "gold"), {}) == "金色毛"
    assert season.express("COAT", ("white", "white"), {}) == "白毛"
    # 杂合且含 key，显现中间性状。
    assert season.express("COAT", ("gold", "white"), {}) == "渐变毛"
    # 杂合不含 key，显现第一个。
    assert season.express("COAT", ("white", "grey"), {}) == "白毛"


def test_epistatic_rule():
    # COAT 为上位，门是 HORN 带 single（独角）。
    season = _season_with_rule("COAT", "epistatic", "gold",
                               gate=("HORN", "single"))
    genotype = {"COAT": ("gold", "white"), "HORN": ("single", "none")}
    assert season.express("COAT", ("gold", "white"), genotype) == "金色毛"
    genotype_closed = {"COAT": ("gold", "white"), "HORN": ("none", "none")}
    assert season.express("COAT", ("gold", "white"), genotype_closed) is None


def test_breed_mendelian_and_species():
    rng = random.Random(7)
    season = SeasonGenetics(7)
    p1 = Creature(1, frozenset(["兔"]),
                  {locus: ("white", "white") if locus == "COAT"
                   else ("small", "small") for locus in LOCI})
    p2 = Creature(2, frozenset(["狐"]),
                  {locus: ("gold", "gold") if locus == "COAT"
                   else ("large", "large") for locus in LOCI})
    children = breed(p1, p2, rng, season, _id_gen(), owner="A")
    assert 1 <= len(children) <= 3
    for child in children:
        assert child.generation == 2
        assert child.owner == "A"
        # 杂交物种是并集。
        assert child.species == frozenset(["兔", "狐"])
        assert species_name(child.species) == "雾兔狐"
        # 每个位点的等位基因来自父母（或突变，突变率低，此处用固定种子断言）。
        for locus in LOCI:
            for allele in child.genotype[locus]:
                allowed = set(p1.genotype[locus]) | set(p2.genotype[locus])
                assert allele in allowed or allele in _all_alleles(locus)


def _all_alleles(locus):
    data = LOCI[locus]
    return list(data["alleles"]) + list(data["rare"])


def _id_gen():
    counter = {"n": 100}

    def nxt():
        counter["n"] += 1
        return counter["n"]
    return nxt


def test_mutation_happens():
    rng = random.Random(99)
    season = SeasonGenetics(99)
    p1 = Creature(1, frozenset(["兔"]),
                  {locus: ("white", "white") for locus in LOCI})
    p2 = Creature(2, frozenset(["兔"]),
                  {locus: ("white", "white") for locus in LOCI})
    mutated = False
    for _ in range(60):
        for child in breed(p1, p2, rng, season, _id_gen(), owner="A"):
            for locus in LOCI:
                if any(a != "white" for a in child.genotype[locus]):
                    mutated = True
    assert mutated, "60 次繁殖应至少出现一次突变"


def test_codex_observes():
    game = Game(seed=3)
    found, total = game.codex.progress()
    assert found > 0  # 开局雾兽已被观察
    assert total > found
    # 图鉴里有传说条件（3 个，开始多为 ???）。
    assert len(game.codex.legendary) == 3
    revealed = game.codex.legendary_revealed()
    assert len(revealed) == 3


def _legendary_genotype(season):
    """构造一个表达全部 3 个传说性状的基因型；若因上位门冲突失败返回 None。"""
    # 先找每个传说性状所在的位点和等位基因。
    target = {}
    for locus, data in LOCI.items():
        for allele in list(data["alleles"]) + list(data["rare"]):
            name = trait_name(locus, allele)
            if name in season.legendary:
                target[locus] = allele
    genotype = {}
    for locus in LOCI:
        genotype[locus] = ("white", "white") if locus == "COAT" else ("small", "small")
    # 传说位点纯合稀有。
    for locus, allele in target.items():
        genotype[locus] = (allele, allele)
    # 上位门：让所有上位位点的门都打开。
    for locus, info in season.locus_rules.items():
        if info["rule"] == "epistatic" and info["gate"]:
            gate_locus, gate_allele = info["gate"]
            if gate_locus in target:
                # 该位点已是传说纯合，改成（稀有，门）杂合。
                genotype[gate_locus] = (target[gate_locus], gate_allele)
            else:
                genotype[gate_locus] = (gate_allele, gate_allele)
    # 再给所有位点一个合法默认值（上面 white/small 可能不是该位点等位基因）。
    for locus in LOCI:
        alleles = _all_alleles(locus)
        genotype[locus] = tuple(a if a in alleles else alleles[0]
                                for a in genotype[locus])
    return genotype


def test_legendary_reachable():
    # 多试几个种子，构造法在绝大多数种子下成立。
    worked = False
    for seed in range(50):
        game = Game(seed=seed)
        genotype = _legendary_genotype(game.season)
        creature = Creature(999, frozenset(["兔"]), genotype, owner="A")
        traits = set(creature.visible_traits(game.season))
        if set(game.season.legendary).issubset(traits):
            game._add_creature("A", creature)
            assert game.won, "培育出传说应判胜利（种子 %d）" % seed
            worked = True
            break
    assert worked, "50 个种子里应至少有一个能构造出传说"


def test_turn_and_ap():
    game = Game(seed=5)
    assert game.current == "A"
    assert game.players["A"]["ap"] == 2
    # 繁殖消耗 1 点。
    creatures = game.players["A"]["creatures"]
    out = game.dispatch("A", "breed %d %d" % (creatures[0].id, creatures[1].id))
    assert "繁殖成功" in out
    assert game.players["A"]["ap"] == 1
    # B 不能在 A 的回合行动。
    out = game.dispatch("B", "status")
    assert "不是" in out
    # A 结束，换 B。
    game.dispatch("A", "end")
    assert game.current == "B"
    assert game.players["B"]["ap"] == 2
    # B 结束，进入夜晚，第 2 天。
    game.dispatch("B", "end")
    assert game.day == 2
    assert game.current == "A"


def test_save_load_roundtrip():
    game = Game(seed=11)
    creatures = game.players["A"]["creatures"]
    game.dispatch("A", "breed %d %d" % (creatures[0].id, creatures[1].id))
    game.dispatch("A", "end")
    game.dispatch("B", "end")
    path = "/tmp/fog_isle_test_save.json"
    game.dispatch("A", "save %s" % path)
    loaded = Game.from_dict(__import__("json").load(open(path, encoding="utf-8")))
    assert loaded.day == game.day
    assert loaded.seed == game.seed
    assert loaded.players["A"]["coins"] == game.players["A"]["coins"]
    assert [c.id for c in loaded.players["A"]["creatures"]] == [
        c.id for c in game.players["A"]["creatures"]]
    assert loaded.players["A"]["creatures"][0].genotype == \
        game.players["A"]["creatures"][0].genotype
    assert loaded.codex.progress() == game.codex.progress()
    # 读档后续玩不崩。
    loaded.dispatch("A", "explore")


def test_trade_and_borrow_flow():
    game = Game(seed=13)
    a_creatures = game.players["A"]["creatures"]
    b_creatures = game.players["B"]["creatures"]
    a_id, b_id = a_creatures[0].id, b_creatures[0].id
    out = game.dispatch("A", "trade offer %d for %d" % (a_id, b_id))
    assert "已向" in out
    game.dispatch("A", "end")
    out = game.dispatch("B", "trade accept 1")
    assert "交易完成" in out
    assert game.find_creature("B", a_id) is not None
    assert game.find_creature("A", b_id) is not None
    # 借配流程。交易后 B 拥有的是 a_id（原来 A 的雾兽），借它。
    game.dispatch("B", "end")
    out = game.dispatch("A", "borrow B %d" % a_id)
    assert "借配请求" in out
    game.dispatch("A", "end")
    out = game.dispatch("B", "borrow-accept 1")
    assert "已接受借配" in out


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items())
             if k.startswith("test_") and callable(v)]
    failed = 0
    for test in tests:
        try:
            test()
            print("PASS %s" % test.__name__)
        except Exception as exc:
            failed += 1
            print("FAIL %s: %s" % (test.__name__, exc))
    print("%d passed, %d failed" % (len(tests) - failed, failed))
    raise SystemExit(1 if failed else 0)

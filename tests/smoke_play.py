"""冒烟测试：随机策略自动玩满一季，不断言胜利，但断言不崩溃、状态一致、存档/读档一致。"""

import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fog_isle.cli import run_self_play
from fog_isle.game import Game


def main():
    seeds = [1, 2, 3, 42, 123, 2026]
    for seed in seeds:
        game = Game(seed=seed)
        won, day = run_self_play(game, days=30, seed=seed)
        # 状态一致性。
        total_creatures = sum(len(game.players[p]["creatures"])
                              for p in ("A", "B"))
        assert total_creatures >= 4, "雾兽不应少于开局的 4 只（种子 %d）" % seed
        for p in ("A", "B"):
            assert game.players[p]["coins"] >= 0, "雾币不应为负（种子 %d）" % seed
            ids = [c.id for c in game.players[p]["creatures"]]
            assert len(ids) == len(set(ids)), "雾兽 id 不应重复（种子 %d）" % seed
        found, total = game.codex.progress()
        assert 0 < found <= total
        # 存档/读档一致。
        path = "/tmp/fog_isle_smoke_%d.json" % seed
        game2 = Game(seed=seed)
        run_self_play(game2, days=30, seed=seed)
        game2.dispatch(game2.current, "save %s" % path)
        loaded = Game.from_dict(json.load(open(path, encoding="utf-8")))
        assert loaded.day == game2.day
        assert loaded.codex.progress() == game2.codex.progress()
        assert [c.id for c in loaded.players["A"]["creatures"]] == [
            c.id for c in game2.players["A"]["creatures"]]
        print("种子 %d：胜利=%s，天数=%d，图鉴 %d/%d，雾兽 %d 只，雾币 %d"
              % (seed, won, day, found, total, total_creatures,
                 sum(game.players[p]["coins"] for p in ("A", "B"))))
    print("冒烟测试通过：%d 个种子全部跑满一季无崩溃。" % len(seeds))


if __name__ == "__main__":
    main()

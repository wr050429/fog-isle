"""命令行界面：交互式游玩；--self-play 用于自动玩演示/冒烟测试。"""

import random
import sys

from .game import Game


def print_intro(game):
    print("=== 雾岛育种所 ===")
    print("两人合作育种游戏：一季 30 天，每天每人 2 个行动点。")
    print("传说目标：培育出一只同时拥有以下 3 个性状的雾兽（图鉴里会逐步揭示）：")
    print("  " + "、".join(game.codex.legendary_revealed()))
    print("输入 help 查看命令；输入 quit 退出。")
    print("")


def run_interactive(game):
    print_intro(game)
    print(game.dispatch("A", "status"))
    while True:
        if game.over:
            print("")
            print(game.season_summary())
            line = input("本季结束。输入 new [种子] 开始新一季，或 quit 退出：").strip()
            if line in ("quit", "exit", "q"):
                break
            if line.startswith("new") or line.startswith("load"):
                player = game.current
                print(game.dispatch(player, line))
                if line.startswith("new"):
                    print_intro(game)
                continue
            print("输入 new [种子] 开始新一季，或 quit 退出。")
            continue
        prompt = "[第%d天 %s 行动点%d] > " % (
            game.day, game.display_name(game.current),
            game.players[game.current]["ap"])
        try:
            line = input(prompt).strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见。")
            break
        if not line:
            continue
        if line in ("quit", "exit", "q"):
            print("再见。下次用 load <文件> 继续（记得先 save）。")
            break
        player = game.current
        print(game.dispatch(player, line))


def run_self_play(game, days=30, seed=None, verbose=False):
    """随机策略自动玩，用于演示和冒烟测试。返回 (won, days_played)。"""
    rng = random.Random(seed if seed is not None else 12345)
    actions = ["breed", "buy", "sell", "explore", "claim", "egg", "trade"]
    played = 0
    while not game.over and game.day <= days:
        player = game.current
        state = game.players[player]
        # 每回合做 2 个随机行动，再 end。
        for _ in range(2):
            if game.over:
                break
            action = rng.choice(actions)
            line = _random_action(game, player, rng, action)
            if line:
                out = game.dispatch(player, line)
                if verbose:
                    print("[%s] %s -> %s" % (player, line, out.split("\n")[0]))
        if not game.over:
            game.dispatch(player, "end")
        played += 1
        # 安全网：每回合 = 2 个玩家回合，留足余量。
        if played > days * 2 + 10:
            break
    return game.won, game.day


def _random_action(game, player, rng, action):
    state = game.players[player]
    creatures = state["creatures"]
    if action == "breed" and len(creatures) >= 2:
        a, b = rng.sample(creatures, 2)
        return "breed %d %d" % (a.id, b.id)
    if action == "buy" and game.market.stock and state["coins"] >= 15:
        item = rng.choice(game.market.stock)
        return "buy %d" % item["id"]
    if action == "sell" and creatures:
        return "sell %d" % rng.choice(creatures).id
    if action == "explore":
        return "explore"
    if action == "claim" and game.market.commissions:
        return "claim %d" % rng.choice(game.market.commissions).id
    if action == "egg" and game.flags.get("egg_available"):
        return "egg"
    if action == "trade":
        other = "B" if player == "A" else "A"
        if creatures and game.players[other]["creatures"]:
            return "trade offer %d for %d" % (
                rng.choice(creatures).id,
                rng.choice(game.players[other]["creatures"]).id)
    return None


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    seed = None
    self_play = False
    days = 30
    i = 0
    while i < len(argv):
        if argv[i] == "--seed" and i + 1 < len(argv):
            seed = int(argv[i + 1])
            i += 2
        elif argv[i] == "--self-play":
            self_play = True
            i += 1
        elif argv[i] == "--days" and i + 1 < len(argv):
            days = int(argv[i + 1])
            i += 2
        else:
            i += 1
    game = Game(seed=seed)
    if self_play:
        won, day = run_self_play(game, days=days, verbose=True)
        found, total = game.codex.progress()
        print("自动玩结束：胜利=%s，天数=%d，图鉴 %d/%d，雾兽 %d 只。"
              % (won, day, found, total,
                 sum(len(game.players[p]["creatures"]) for p in ("A", "B"))))
        return 0
    run_interactive(game)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

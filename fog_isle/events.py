"""随机事件：夜晚结算时触发，持续注入新的未知或变数。"""

import random

from .creatures import random_creature


def _event_fog_night(game, rng):
    game.flags["fog"] = True
    return ("雾夜：浓雾漫过育种所，今晚所有雾兽的外观都看不真切"
            "（下一回合外观描述会隐藏一个性状）。")


def _event_merchant(game, rng):
    creature = random_creature(rng, game.season, game.next_id, allow_rare=True)
    price = 70
    game.market.add_special(creature, price)
    return ("神秘商人：一位斗篷商人带来一只外观奇特的雾兽，标价 %d 雾币"
            "（市场特售，基因未知）。" % price)


def _event_wanderer(game, rng):
    creature = random_creature(rng, game.season, game.next_id, allow_rare=False)
    player = rng.choice(["A", "B"])
    creature.owner = player
    game.players[player]["creatures"].append(creature)
    game.codex.observe(creature)
    return ("流浪雾兽：一只野雾兽溜进 %s 的育种所，留了下来：%s。"
            % (player, creature.appearance(game.season)))


def _event_bountiful(game, rng):
    game.flags["bountiful"] = True
    return "丰收：岛上的雾气格外滋养，下一次繁殖产仔 +1 只。"


def _event_blight(game, rng):
    all_creatures = (game.players["A"]["creatures"]
                     + game.players["B"]["creatures"])
    if not all_creatures:
        return "雾疫：雾气里飘过一阵病气，但所里没有雾兽，无事发生。"
    creature = rng.choice(all_creatures)
    creature.sick = True
    return ("雾疫：%s 生病了，明天不能繁殖，休息一天就会好。"
            % creature.appearance(game.season))


def _event_egg(game, rng):
    game.flags["egg_available"] = True
    return ("神秘蛋：雾里滚来一枚温热的蛋，20 雾币可买下（用 egg 命令），"
            "孵出来的雾兽基因未知，稀有性状概率更高。今晚之前有效。")


def _event_windfall(game, rng):
    player = rng.choice(["A", "B"])
    game.players[player]["coins"] += 20
    return "横财：%s 在雾里捡到一个旧钱袋，+20 雾币。" % player


def _event_visitor(game, rng):
    commission = game.market.add_commission(rng, game.season, double=True)
    return ("访客：一位收藏家路过，追加一条高价委托：%s，报酬 %d 雾币。"
            % (commission.description, commission.reward))


def _event_mist_tide(game, rng):
    game.market.refresh_all(rng, game.season, game.next_id)
    return "雾潮：雾气漫过市场，摊位上的雾兽全部换了一批。"


def _event_quiet(game, rng):
    return "静夜：雾很安，什么也没发生。"


# (事件名, 权重, 处理函数)
EVENTS = [
    ("雾夜", 3, _event_fog_night),
    ("神秘商人", 2, _event_merchant),
    ("流浪雾兽", 3, _event_wanderer),
    ("丰收", 2, _event_bountiful),
    ("雾疫", 2, _event_blight),
    ("神秘蛋", 2, _event_egg),
    ("横财", 2, _event_windfall),
    ("访客", 1, _event_visitor),
    ("雾潮", 1, _event_mist_tide),
    ("静夜", 2, _event_quiet),
]


def draw_event(game, rng):
    """抽一个事件并执行，返回事件文本。"""
    names = [e[0] for e in EVENTS]
    weights = [e[1] for e in EVENTS]
    chosen = rng.choices(names, weights=weights, k=1)[0]
    for name, _w, func in EVENTS:
        if name == chosen:
            return "【事件·%s】%s" % (name, func(game, rng))
    return "静夜：雾很安，什么也没发生。"

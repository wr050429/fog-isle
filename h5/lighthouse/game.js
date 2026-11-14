/* 《雾岛灯塔 · 守塔人》H5 移植 · v2
   逻辑与 game.py v2 一致：30 夜；燃油/雾币/粮食/状况/声望；
   每天：事件 → 2 行动点 → 夜里点灯；声望每天 -2；
   偷油（4 夜，巡视找线索 3 条后可对质）；神秘访客的便宜油是掺水油（3 夜烧油翻倍）；
   隐藏规则：船期跟着种子定的周期走（周期 2/3/4 夜 + 相位），
   周期夜有船 90%、非周期夜 10%（README 只提示“船期背后可能有规律”）。
   求援提示词只含玩家已见信息（当前状态 + 船期记录 + 已见事件/线索），
   绝不含船期周期、窃贼身份（未集齐线索前）、未来事件与油价。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 数据（与 Python v2 相同） ---------------- */
  const DAYS = 30, WIN_REP = 50;
  const START = { fuel: 15, money: 50, food: 10, condition: 100, rep: 50 };
  const THIEVES = [
    { name: "商人老陈", clue: "一枚铜纽扣，是商人外套上的那种。" },
    { name: "渔民阿水", clue: "一片鱼鳞，粘在油库门边的木板上。" },
    { name: "流浪汉老七", clue: "一块破布，角上绣着个歪歪扭扭的“七”。" }
  ];
  const EVENTS = ["storm", "distress", "merchant", "fog", "visitor", "calm", "malfunction", "fishermen"];
  const EVENT_WEIGHTS = [12, 10, 10, 10, 8, 22, 8, 10];
  const EVENT_NAMES = { storm: "暴风雨", distress: "船只遇险", merchant: "商船到访", fog: "浓雾", visitor: "神秘访客", calm: "平静的一天", malfunction: "灯塔故障", fishermen: "渔民送鱼" };
  const ACTIONS = ["买油", "买粮", "修缮", "巡视", "捕鱼", "休息", "对质"];

  /* ---------------- 生成一局 ---------------- */
  function createGame(seed, rng) {
    const thief = rng.choice(THIEVES);
    const shipPeriod = rng.choice([2, 3, 4]);
    const shipPhase = rng.randint(0, shipPeriod - 1);
    const shipPass = [];
    for (let i = 0; i < DAYS; i++) {
      const isCycle = (i - shipPhase) % shipPeriod === 0;
      const p = isCycle ? 0.90 : 0.10;
      shipPass.push(rng.random() < p);
    }
    const fuelPrice = [];
    for (let i = 0; i < DAYS; i++) fuelPrice.push(6 + rng.randint(-1, 3));
    const theftDays = rng.sample(Array.from({ length: DAYS - 5 }, function (_, i) { return i + 5; }), 4).sort(function (a, b) { return a - b; });
    const events = [];
    for (let i = 0; i < DAYS; i++) events.push(rng.choices(EVENTS, EVENT_WEIGHTS));
    return {
      seed: seed, day: 1,
      fuel: START.fuel, money: START.money, food: START.food, condition: START.condition, rep: START.rep,
      litNights: 0, unlitStreak: 0, clues: 0, thiefStopped: false,
      diluted: 0, malfunction: false, fogTonight: false, theftSeen: 0,
      thief: thief, shipPeriod: shipPeriod, shipPhase: shipPhase,
      shipPass: shipPass, shipHistory: [], fuelPrice: fuelPrice,
      theftDays: theftDays, events: events,
      log: [], seen: [], phase: "event", ap: 2, ended: null,
      eventText: "", eventChoice: null
    };
  }
  function statusLine(g) {
    return "第 " + g.day + " 天 | 燃油 " + g.fuel + " | 雾币 " + g.money + " | 粮食 " + g.food + " | 灯塔状况 " + g.condition + " | 声望 " + g.rep + " | 已点灯 " + g.litNights + " 夜 | 线索 " + g.clues + "/3";
  }
  function shipLogLine(g) {
    if (!g.shipHistory.length) return "船期记录：还没有船经过的记录。";
    const marks = g.shipHistory.map(function (s) { return s ? "●" : "○"; }).join("");
    return "船期记录：" + marks + "（●=有船，○=无船）";
  }
  function fuelCost(g, mode) {
    const base = { full: 3, half: 1, off: 0 }[mode];
    if (g.diluted > 0 && base > 0) return base * 2;
    return base;
  }
  function over(g) {
    if (g.rep <= 0) return { result: "lose", msg: "声望归零，港务局撤了你的职。" };
    if (g.condition <= 0) return { result: "lose", msg: "灯塔状况归零，塔身出了大问题，你被调走了。" };
    if (g.unlitStreak >= 3) return { result: "lose", msg: "连续 3 夜熄灯，有船在雾里触了礁，港务局撤了你的职。" };
    if (g.day > DAYS) {
      if (g.rep >= WIN_REP) return { result: "win", msg: "30 夜守满了，声望 " + g.rep + "，港务局和你续约。灯塔还亮着。" };
      return { result: "lose", msg: "30 夜守满了，但声望只有 " + g.rep + "，不到 " + WIN_REP + "，港务局没有续约。" };
    }
    return null;
  }

  /* ---------------- 事件 ---------------- */
  function applyEvent(g) {
    const ev = g.events[g.day - 1];
    g.malfunction = false;
    g.fogTonight = false;
    g.log = [];
    g.eventChoice = null;
    if (ev === "calm") {
      g.eventText = "平静的一天。雾很薄，海很静。";
      g.seen.push("第 " + g.day + " 天：平静的一天。");
      return;
    }
    if (ev === "storm") {
      g.condition = Math.max(0, g.condition - 15);
      g.eventText = "暴风雨：风把塔身吹得直响，灯塔状况 -15。";
      g.seen.push("第 " + g.day + " 天：暴风雨，灯塔状况 -15。");
      return;
    }
    if (ev === "merchant") {
      g.fuelPrice[g.day - 1] = Math.max(1, g.fuelPrice[g.day - 1] - 2);
      g.eventText = "商船到访：今天油价便宜 2 雾币（" + g.fuelPrice[g.day - 1] + " 雾币 / 5 单位），适合补油。";
      g.seen.push("第 " + g.day + " 天：商船到访，今天油价 " + g.fuelPrice[g.day - 1] + " 雾币。");
      return;
    }
    if (ev === "fog") {
      g.fogTonight = true;
      g.eventText = "浓雾：今晚雾很重。灯亮着格外重要，熄灯格外危险。";
      g.seen.push("第 " + g.day + " 天：浓雾，今晚雾很重。");
      return;
    }
    if (ev === "fishermen") {
      g.food += 2;
      g.rep = Math.min(100, g.rep + 3);
      g.eventText = "渔民送鱼：渔民送来一筐鱼，粮食 +2，声望 +3。";
      g.seen.push("第 " + g.day + " 天：渔民送鱼，粮食 +2，声望 +3。");
      return;
    }
    if (ev === "malfunction") {
      g.condition = Math.max(0, g.condition - 10);
      g.malfunction = true;
      g.eventText = "灯塔故障：透镜卡住了，灯塔状况 -10。今晚不能全亮，修缮可以修好它。";
      g.seen.push("第 " + g.day + " 天：灯塔故障，状况 -10，今晚不能全亮。");
      return;
    }
    if (ev === "distress") {
      g.eventText = "船只遇险：雾里有一艘船在发求救信号。";
      g.eventChoice = {
        type: "distress",
        question: "出海救援吗？（要 2 燃油 + 1 粮食；救了声望 +12、雾币 +15，不救声望 -10）",
        options: [{ label: "救", value: "救" }, { label: "不救", value: "不救" }]
      };
      g.seen.push("第 " + g.day + " 天：船只遇险，雾里有船在发求救信号。");
      return;
    }
    if (ev === "visitor") {
      const price = Math.max(1, Math.floor(g.fuelPrice[g.day - 1] / 2));
      g.eventText = "神秘访客：一个裹着斗篷的人敲门，说有一批“便宜油”，5 单位只要 " + price + " 雾币（今天正常价 " + g.fuelPrice[g.day - 1] + " 雾币）。他不肯说油从哪来。";
      g.eventChoice = {
        type: "visitor",
        question: "买吗？",
        options: [{ label: "买", value: "买" }, { label: "不买", value: "不买" }]
      };
      g.seen.push("第 " + g.day + " 天：神秘访客卖便宜油，5 单位 " + price + " 雾币（今天正常价 " + g.fuelPrice[g.day - 1] + " 雾币）。");
      return;
    }
  }
  function resolveEventChoice(g, value) {
    const ev = g.events[g.day - 1];
    g.eventChoice = null;
    if (ev === "distress") {
      if (value === "救") {
        if (g.fuel < 2 || g.food < 1) {
          g.rep = Math.max(0, g.rep - 10);
          g.log.push("你想救，但油 / 粮不够，只能眼睁睁看着。声望 -10。");
          g.seen.push("第 " + g.day + " 天：想救但油/粮不够，声望 -10。");
        } else {
          g.fuel -= 2; g.food -= 1;
          g.rep = Math.min(100, g.rep + 12);
          g.money += 15;
          g.log.push("你救下了那艘船。声望 +12，雾币 +15。");
          g.seen.push("第 " + g.day + " 天：出海救了船，声望 +12，雾币 +15。");
        }
      } else {
        g.rep = Math.max(0, g.rep - 10);
        g.log.push("你没有出海。雾里那盏求救灯灭了。声望 -10。");
        g.seen.push("第 " + g.day + " 天：没有出海救援，声望 -10。");
      }
      return;
    }
    if (ev === "visitor") {
      const price = Math.max(1, Math.floor(g.fuelPrice[g.day - 1] / 2));
      if (value === "买") {
        if (g.money < price) {
          g.log.push("你想买，但钱不够。他耸耸肩，走了。");
          g.seen.push("第 " + g.day + " 天：想买便宜油但钱不够。");
        } else {
          g.money -= price;
          g.fuel += 5;
          g.diluted = 3;
          g.log.push("你买了 5 单位便宜油。油壶很沉，气味有点怪。（你暂时还不知道，这油烧得比正常油快一倍。）");
          g.seen.push("第 " + g.day + " 天：买了 5 单位便宜油，油壶很沉，气味有点怪。");
        }
      } else {
        g.log.push("你没买。他看了你一眼，转身走进雾里。");
        g.seen.push("第 " + g.day + " 天：没买神秘访客的便宜油。");
      }
      return;
    }
  }

  /* ---------------- 白天行动 ----------------
     第 4 项修法：返回 { ok, msg }。失败（钱不够、线索不够、已揭穿过）不扣行动点，
     UI 只有在 ok 时才减 1 点；原先失败也照扣 2→1。 */
  function doAction(g, name) {
    if (name === "买油") {
      const price = g.fuelPrice[g.day - 1];
      if (g.money < price) return { ok: false, msg: "钱不够（要 " + price + " 雾币）。" };
      g.money -= price; g.fuel += 5;
      return { ok: true, msg: "买了 5 单位燃油（" + price + " 雾币）。" };
    }
    if (name === "买粮") {
      if (g.money < 10) return { ok: false, msg: "钱不够（要 10 雾币）。" };
      g.money -= 10; g.food += 5;
      return { ok: true, msg: "买了 5 单位粮食（10 雾币）。" };
    }
    if (name === "修缮") {
      if (g.money < 10) return { ok: false, msg: "钱不够（要 10 雾币）。" };
      g.money -= 10;
      g.condition = Math.min(100, g.condition + 15);
      g.malfunction = false;
      return { ok: true, msg: "修缮了灯塔，状况 +15。透镜转顺了。" };
    }
    if (name === "巡视") {
      if (g.clues < g.theftSeen && g.clues < 3) {
        g.clues += 1;
        if (g.clues === 1) { g.seen.push("巡视线索 1/3：油库门边有一串脚印，通向村子的方向。"); return { ok: true, msg: "巡视：油库门边有一串脚印，通向村子的方向。（线索 1/3）" }; }
        if (g.clues === 2) { g.seen.push("巡视线索 2/3：" + g.thief.clue); return { ok: true, msg: "巡视：" + g.thief.clue + "（线索 2/3）" }; }
        g.seen.push("巡视线索 3/3：顺着脚印找到村边一间小棚屋，里面堆着几桶燃油，桶身上有灯塔的标记。窃贼是" + g.thief.name + "！可以“对质”了。");
        return { ok: true, msg: "巡视：顺着脚印找到村边一间小棚屋，里面堆着几桶燃油，桶身上有灯塔的标记。（线索 3/3）窃贼是" + g.thief.name + "！你可以“对质”了。" };
      }
      return { ok: true, msg: "巡视了一圈，没发现新东西。" };
    }
    if (name === "捕鱼") { g.food += 3; return { ok: true, msg: "去礁石边捕鱼，粮食 +3。" }; }
    if (name === "休息") { g.condition = Math.min(100, g.condition + 5); return { ok: true, msg: "睡了个好觉，灯塔状况 +5。" }; }
    if (name === "对质") {
      if (g.clues < 3) return { ok: false, msg: "你还没有足够的线索（" + g.clues + "/3），不知道该找谁对质。" };
      if (g.thiefStopped) return { ok: false, msg: "窃贼已经被你揭穿了，油不会再少了。" };
      g.thiefStopped = true;
      g.rep = Math.min(100, g.rep + 5);
      g.seen.push("揭穿了" + g.thief.name + "，他认了，答应不再偷油。声望 +5。");
      return { ok: true, msg: "你当面揭穿了" + g.thief.name + "，他认了，答应不再偷油。声望 +5。" };
    }
    return { ok: false, msg: "没有这个行动。" };
  }

  /* ---------------- 夜晚 ---------------- */
  function night(g, mode) {
    const cost = fuelCost(g, mode);
    if (g.fuel < cost) return "燃油不够（要 " + cost + " 单位，只有 " + g.fuel + " 单位）。";
    g.fuel -= cost;
    const ship = g.shipPass[g.day - 1];
    g.shipHistory.push(ship);
    if (mode === "full") {
      g.litNights += 1; g.unlitStreak = 0;
      if (ship) {
        const gain = 4 + (g.fogTonight ? 3 : 0);
        g.rep = Math.min(100, g.rep + gain);
        g.money += 6;
        return "灯全亮着。有船经过，看见了光，声望 +" + gain + "，雾币 +6。";
      }
      return "灯全亮着。没有船经过，只烧了油。";
    }
    if (mode === "half") {
      g.litNights += 1; g.unlitStreak = 0;
      if (ship) {
        g.rep = Math.min(100, g.rep + 1);
        return "灯半亮着。有船经过，勉强看见了光，声望 +1。";
      }
      return "灯半亮着。没有船经过。";
    }
    g.unlitStreak += 1;
    if (ship) {
      const loss = g.fogTonight ? 18 : 12;
      g.rep = Math.max(0, g.rep - loss);
      return "灯熄着。有船经过，在雾里差点触礁，声望 -" + loss + "。";
    }
    return "灯熄着。没有船经过。";
  }

  /* ---------------- 一天结束 ---------------- */
  function endOfDay(g) {
    g.rep = Math.max(0, g.rep - 2);
    if (g.food > 0) { g.food -= 1; }
    else {
      g.condition = Math.max(0, g.condition - 10);
      g.rep = Math.max(0, g.rep - 5);
      g.log.push("没有粮食了，你饿着肚子守夜，灯塔状况 -10，声望 -5。");
    }
    if (g.theftDays.indexOf(g.day) !== -1 && !g.thiefStopped) {
      g.fuel = Math.max(0, g.fuel - 3);
      g.theftSeen += 1;
      g.log.push("夜里，油库的锁被人动过。第二天早上，燃油少了 3 单位，不知去向。（偷油第 " + g.theftSeen + " 次）");
      g.seen.push("第 " + g.day + " 天夜里：油库的锁被人动过，燃油少了 3 单位。（偷油第 " + g.theftSeen + " 次）");
    }
    if (g.diluted > 0) g.diluted -= 1;
    g.day += 1;
  }

  /* ---------------- 求援提示词：只用已见信息 ---------------- */
  function helpPrompt(g) {
    const lines = [];
    lines.push("我在玩一个文字经营小游戏《雾岛灯塔 · 守塔人》。请你帮我推理和规划，但不要直接替我做决定，也不要猜我没见过的东西。");
    lines.push("");
    lines.push("【规则】");
    lines.push("我是雾岛灯塔的守塔人，要守满 30 夜。每天：先看发生什么事，再做两件事，入夜决定点灯。守满 30 夜且声望 >= 50：留任，赢。声望归零、灯塔状况归零、或连续 3 夜熄灯：撤职，输。");
    lines.push("资源：燃油、雾币、粮食、灯塔状况、声望。港务局每天考核，声望每天 -2；每天要吃 1 粮食。点灯：全亮 3 油（有船经过声望 +4、雾币 +6，雾夜 +3）、半亮 1 油（有船经过声望 +1）、熄灯 0 油（有船经过声望 -12，雾夜 -18）。船哪晚来，我事先不知道。");
    lines.push("行动：买油（5 燃油，按今天油价）、买粮（5 粮食，10 雾币）、修缮（状况 +15，10 雾币，也能修好故障）、巡视（找偷油的线索）、捕鱼（粮食 +3）、休息（状况 +5）、对质（集齐 3 线索后揭穿窃贼）。有人半夜偷油，油少了才会发现。");
    lines.push("船期背后可能有规律。留心观察船来的日子。");
    lines.push("");
    lines.push("【当前状态】");
    lines.push(statusLine(g));
    lines.push("今天油价：" + g.fuelPrice[g.day - 1] + " 雾币 / 5 单位燃油。");
    if (g.diluted > 0) lines.push("（掺水油：烧油翻倍，剩余 " + g.diluted + " 夜）");
    if (g.malfunction) lines.push("（灯塔故障：今晚不能全亮）");
    if (g.fogTonight) lines.push("（今晚有雾）");
    lines.push(shipLogLine(g));
    lines.push("");
    if (g.seen.length) {
      lines.push("【我已经看到的（按顺序）】");
      lines.push(g.seen.join("\n"));
      lines.push("");
    }
    lines.push("【请帮我】");
    lines.push("根据上面我已经看到的信息，帮我分析：接下来几天该怎么分配行动点、买油还是省油、今晚该点多亮？只用我已经看到的信息推理，不要编造我没见过的内容。");
    return lines.join("\n");
  }

  /* ---------------- 暴露给测试（Node） ---------------- */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DAYS: DAYS, WIN_REP: WIN_REP, START: START, THIEVES: THIEVES, EVENTS: EVENTS, EVENT_WEIGHTS: EVENT_WEIGHTS, EVENT_NAMES: EVENT_NAMES, ACTIONS: ACTIONS, createGame: createGame, statusLine: statusLine, shipLogLine: shipLogLine, fuelCost: fuelCost, over: over, applyEvent: applyEvent, resolveEventChoice: resolveEventChoice, doAction: doAction, night: night, endOfDay: endOfDay, helpPrompt: helpPrompt };
  }
  if (typeof window !== "undefined") {
    window.Lighthouse = { DAYS: DAYS, WIN_REP: WIN_REP, START: START, THIEVES: THIEVES, EVENTS: EVENTS, EVENT_WEIGHTS: EVENT_WEIGHTS, EVENT_NAMES: EVENT_NAMES, ACTIONS: ACTIONS, createGame: createGame, statusLine: statusLine, shipLogLine: shipLogLine, fuelCost: fuelCost, over: over, applyEvent: applyEvent, resolveEventChoice: resolveEventChoice, doAction: doAction, night: night, endOfDay: endOfDay, helpPrompt: helpPrompt };
  }

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const KEY = "fog-h5-lighthouse";
  let seed = C.seedFromURL();
  let rng = C.RNG(seed);
  let saved = C.loadState(KEY);
  let g = null;
  /* 第 10 项：断点续玩提示。有中途存档且不在结局里，页面顶部显示
     「这一局你玩到第 X 天，继续／从头」；同一会话点过“继续”就不再弹。 */
  let resumePending = false;
  /* 第 5 项修法：原先 !saved.ended 会把已结束的局丢掉重开，结局页一刷新就丢。
     现在 ended 的局也恢复，render() 会直接停在结局页。 */
  if (saved && saved.seed === seed && saved.shipPass) {
    g = saved;
    if (!g.ended && !C.resumeDismissed(KEY) && (g.day > 1 || g.shipHistory.length > 0 || g.phase !== "event")) {
      resumePending = true;
    }
  } else {
    g = createGame(seed, rng);
    applyEvent(g);
    C.saveState(KEY, g);
  }
  if (!g.seen) g.seen = [];
  if (!g.log) g.log = [];

  function save() { C.saveState(KEY, g); }
  function checkOver() {
    const o = over(g);
    if (o) { g.ended = o; g.phase = "end"; save(); return true; }
    return false;
  }
  function render() {
    const root = document.getElementById("game");
    if (g.ended || g.phase === "end") { renderEnding(root); return; }
    const html = [];
    // 第 10 项：断点续玩提示
    if (resumePending) {
      html.push('<div class="card"><h3>这一局，你玩到第 ' + g.day + ' 天</h3>');
      html.push('<p>这一局你已经玩到第 ' + g.day + ' 天了。继续接着打，还是从头开始？</p>');
      html.push('<div class="btn-row"><button class="btn" id="btn-resume-continue">继续</button><button class="btn secondary" id="btn-resume-restart">从头开始</button></div></div>');
    }
    // 状态
    html.push('<div class="card"><div class="status-grid">');
    const cells = [["燃油", g.fuel], ["雾币", g.money], ["粮食", g.food], ["状况", g.condition], ["声望", g.rep]];
    cells.forEach(function (c) {
      html.push('<div class="status-cell"><div class="v">' + c[1] + '</div><div class="k">' + c[0] + '</div></div>');
    });
    html.push('</div>');
    html.push('<p class="meta">第 ' + g.day + ' 天 · 已点灯 ' + g.litNights + ' 夜 · 线索 ' + g.clues + '/3 · 今天油价 ' + g.fuelPrice[g.day - 1] + ' 雾币 / 5 单位</p>');
    html.push('<p class="ship-log">' + esc(shipLogLine(g)) + '</p>');
    if (g.diluted > 0) html.push('<p class="meta">（掺水油：烧油翻倍，剩余 ' + g.diluted + ' 夜）</p>');
    if (g.malfunction) html.push('<p class="meta">（灯塔故障：今晚不能全亮）</p>');
    html.push('</div>');
    // 事件
    html.push('<div class="card"><h3>' + esc(EVENT_NAMES[g.events[g.day - 1]]) + '</h3>');
    html.push('<p>' + esc(g.eventText) + '</p>');
    if (g.eventChoice) {
      html.push('<p>' + esc(g.eventChoice.question) + '</p>');
      g.eventChoice.options.forEach(function (o) {
        html.push('<button class="btn" data-evchoice="' + esc(o.value) + '">' + esc(o.label) + '</button>');
      });
    } else if (g.phase === "event") {
      html.push('<button class="btn" id="btn-to-day">开始今天的行动 →</button>');
    }
    html.push('</div>');
    // 日志
    if (g.log.length) {
      html.push('<div class="card"><ul class="log">');
      g.log.forEach(function (l) { html.push('<li>' + esc(l) + '</li>'); });
      html.push('</ul></div>');
    }
    // 白天行动
    if (g.phase === "day") {
      html.push('<div class="card"><h3>白天 · 行动点剩 ' + g.ap + '</h3>');
      ACTIONS.forEach(function (a) {
        html.push('<button class="btn" data-act="' + esc(a) + '">' + esc(a) + actionHint(a) + '</button>');
      });
      html.push('</div>');
    }
    // 夜里点灯
    if (g.phase === "night") {
      html.push('<div class="card"><h3>入夜了。点灯吗？</h3>');
      const modes = [
        { k: "full", label: "全亮", cost: fuelCost(g, "full"), dis: g.malfunction, note: g.malfunction ? "（故障：今晚不能全亮）" : "" },
        { k: "half", label: "半亮", cost: fuelCost(g, "half"), dis: false, note: "" },
        { k: "off", label: "熄灯", cost: 0, dis: false, note: "" }
      ];
      modes.forEach(function (m) {
        const cant = m.dis || g.fuel < m.cost;
        html.push('<button class="btn" data-lamp="' + m.k + '"' + (cant ? ' disabled' : '') + '>' + m.label + ' · ' + m.cost + ' 油' + (m.note ? '<span class="hint">' + esc(m.note) + '</span>' : '') + (g.fuel < m.cost && !m.dis ? '<span class="hint">燃油不够</span>' : '') + '</button>');
      });
      html.push('</div>');
    }
    root.innerHTML = html.join("");
    // 第 10 项：断点续玩提示的两个按钮
    const rc = document.getElementById("btn-resume-continue");
    if (rc) rc.addEventListener("click", function () {
      resumePending = false;
      C.markResumed(KEY);
      render();
    });
    const rr = document.getElementById("btn-resume-restart");
    if (rr) rr.addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(seed);
    });
    // 绑定
    root.querySelectorAll("[data-evchoice]").forEach(function (b) {
      b.addEventListener("click", function () {
        resolveEventChoice(g, b.getAttribute("data-evchoice"));
        g.phase = "day"; g.ap = 2;
        save(); render();
      });
    });
    const toDay = document.getElementById("btn-to-day");
    if (toDay) toDay.addEventListener("click", function () {
      g.phase = "day"; g.ap = 2;
      save(); render();
    });
    root.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        const name = b.getAttribute("data-act");
        const res = doAction(g, name);
        g.log.push(res.msg);
        if (res.ok) {
          g.ap -= 1;
          if (g.ap <= 0) { g.phase = "night"; }
        }
        if (checkOver()) { render(); return; }
        save(); render();
      });
    });
    root.querySelectorAll("[data-lamp]").forEach(function (b) {
      b.addEventListener("click", function () {
        const msg = night(g, b.getAttribute("data-lamp"));
        g.log = [msg];
        endOfDay(g);
        if (checkOver()) { render(); return; }
        g.phase = "event";
        applyEvent(g);
        if (checkOver()) { render(); return; }
        save(); render();
      });
    });
  }
  function actionHint(a) {
    const hints = {
      "买油": "5 燃油，按今天油价", "买粮": "5 粮食，10 雾币",
      "修缮": "状况 +15，10 雾币（修好故障）", "巡视": "找偷油的线索",
      "捕鱼": "粮食 +3", "休息": "状况 +5", "对质": "集齐 3 线索后揭穿窃贼"
    };
    return '<span class="hint">' + (hints[a] || "") + '</span>';
  }
  function renderEnding(root) {
    const e = g.ended;
    const html = [];
    html.push('<div class="card"><p class="meta">雾岛灯塔 · 守塔人</p>');
    html.push('<h2 class="ending-title">' + (e.result === "win" ? "留任" : "撤职") + '</h2>');
    html.push('<p>' + esc(e.msg) + '</p>');
    html.push('<p class="meta">最终：燃油 ' + g.fuel + '，雾币 ' + g.money + '，粮食 ' + g.food + '，状况 ' + g.condition + '，声望 ' + g.rep + '，点灯 ' + g.litNights + ' 夜。</p>');
    html.push('<span class="stamp pop">' + (e.result === "win" ? "已归档" : "暂缓结案") + '</span></div>');
    html.push('<div class="card"><details class="reveal"><summary>揭晓本局真相（密封：打完再看）</summary><div class="reveal-body">');
    html.push('<p>船期规律：周期 ' + g.shipPeriod + ' 夜，相位 ' + g.shipPhase + '。“周期夜”（(夜 - ' + g.shipPhase + ') % ' + g.shipPeriod + ' == 0）有船的概率 90%，“非周期夜”有船的概率 10%。靠观察船期记录可以发现规律，然后只在周期夜全亮、非周期夜省油。</p>');
    /* 第 12 项修法：原先第二条和第三条线索之间少了标点（“线索 2 是……线索 3 是……”两句粘在一起）。
       改成编号 + 分号分隔，线索 2 的原文去掉末尾句号再接分号。 */
    var clue2 = g.thief.clue.replace(/。$/, "");
    html.push('<p>偷油的是' + esc(g.thief.name) + '。三条线索：①油库门边的脚印，通向村子的方向；②' + esc(clue2) + '；③村边棚屋里的油桶，桶身上有灯塔的标记。集齐 3 条线索后“对质”可以止损。神秘访客卖的是掺水油，买了之后 3 夜烧油翻倍。</p>');
    html.push('<p class="meta">偷油的夜晚：第 ' + g.theftDays.join("、") + ' 天的夜里（共 ' + g.theftDays.length + ' 次）。换种子，全变。</p>');
    html.push('</div></details></div>');
    html.push('<div class="btn-row"><button class="btn" id="btn-again">换一局</button><button class="btn secondary" id="btn-replay">同一局重玩</button></div>');
    html.push('<button class="btn ghost" id="btn-back">回雾汀地图</button>');
    root.innerHTML = html.join("");
    document.getElementById("btn-again").addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(C.randomSeed());
    });
    document.getElementById("btn-replay").addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(seed);
    });
    document.getElementById("btn-back").addEventListener("click", function () { location.href = "../index.html"; });
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("seed-tag").textContent = "种子 #" + seed;
    document.getElementById("btn-new").addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(C.randomSeed());
    });
    document.getElementById("btn-restart").addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(seed);
    });
    document.getElementById("btn-help").addEventListener("click", function () {
      C.copyText(helpPrompt(g), "求援提示词已复制，去问你的 AI 吧。");
    });
    render();
  });
})();

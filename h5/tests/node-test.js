// 雾系列 H5 · 合并 Node 逻辑测试（第一期 + 第二期 + 两张修复单 + 视觉大改）
// 路径都按 __dirname 相对取，放到哪都能跑。跑：node tests/node-test.js（从 fog-h5 目录）
global.window = {};
require(__dirname + "/../assets/common.js");
const C = global.window.FogCommon;
const baita = require(__dirname + "/../baita-lane/game.js");
const harbor = require(__dirname + "/../fog-harbor/game.js");
const light = require(__dirname + "/../lighthouse/game.js");
const isle = require(__dirname + "/../fog-isle/game.js");
require(__dirname + "/../assets/rpg.js");
const rpg = global.window.FogRPG;
const company = require(__dirname + "/../fog-company/game.js");
const bd = require(__dirname + "/../assets/backdrops.js");
const cr = require(__dirname + "/../assets/creature.js");
const fs = require("fs");
const ROOT = __dirname + "/../";
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL " + label); }
}
function section(name) { console.log("== " + name + " =="); }

/* ---------- 白塔巷 ---------- */
section("白塔巷（第一期）");
{
  const variants = {};
  for (let s = 1; s <= 30; s++) {
    const g = baita.createGame(s, C.RNG(s));
    variants[g.variant] = true;
    const g2 = baita.createGame(s, C.RNG(s));
    ok(g.variant === g2.variant, "种子 " + s + " 两次生成同一变体");
  }
  ok(Object.keys(variants).length === 3, "30 种子覆盖全部 3 个变体");
  // 10 种子全通关（集齐 6 线索）：每晚跨房间扫描，优先做“给新线索”的行动
  let wins = 0;
  const ROOMS = ["302", "201", "202", "301", "basement", "roof", "yard"];
  for (let s = 1; s <= 10; s++) {
    const g = baita.createGame(s, C.RNG(s));
    for (let ev = 1; ev <= 3; ev++) {
      g.evening = ev; g.ap = 4;
      let guard = 0;
      while (g.ap > 0 && guard++ < 20) {
        let best = null, fallback = null;
        for (const room of ROOMS) {
          g.room = room;
          for (const a of baita.availableActions(g)) {
            if (a.gives && g.clues.indexOf(a.gives) === -1) { best = a; break; }
            if (!fallback) fallback = a;
          }
          if (best) break;
        }
        const a = best || fallback;
        if (!a) break;
        g.room = a.room;
        baita.doAction(g, a);
      }
    }
    if (baita.majorCount(g) >= 6) wins++;
  }
  ok(wins >= 8, "10 种子多数能集齐 6 线索（" + wins + "/10，贪心玩家）");
  // 求援提示词不含变体名与真相
  const g = baita.createGame(7, C.RNG(7));
  const hp = baita.helpPrompt(g);
  ok(hp.indexOf("变体") === -1 && hp.indexOf("收件员") === -1 && hp.indexOf("藏人") === -1 && hp.indexOf("走私") === -1,
    "白塔巷求援提示词不含变体名");
  // seen 按晚过滤（第一张修复单第 7 项）
  const g2 = baita.createGame(7, C.RNG(7));
  const acts = baita.availableActions(g2);
  baita.doAction(g2, acts[0]);
  ok(baita.seenEvening(g2.seen[0]) === 1, "seen 记下当晚是第几晚");
}

/* ---------- 电报局 ---------- */
section("电报局（第一期 + 修复）");
{
  for (let s = 1; s <= 10; s++) {
    const c = harbor.generateCase(s, C.RNG(s));
    // 不变量：恰好 1 关键记录 + 1 伪造记录 + 不在场证明；同一人同一时刻两个地方
    const key = c.docs.filter(d => d.key);
    const forged = c.docs.filter(d => d.forged);
    ok(key.length === 1 && forged.length === 1, "种子 " + s + "：1 关键记录 + 1 伪造记录");
    const alibi = c.docs.find(d => d.id === c.alibiDocId);
    ok(!!c.alibiDocId && !!alibi, "种子 " + s + "：有不在场证明");
    // 正确答案全对
    const r = harbor.checkAnswer(c, c.culprit.name, c.method, c.motive);
    ok(r.ok && r.personOk && r.methodOk && r.motiveOk, "种子 " + s + "：正确答案全对");
    // 指认错人 → 人不对
    const wrong = harbor.SUSPECTS.find(x => x.id !== c.culprit.id);
    const r2 = harbor.checkAnswer(c, wrong.name, c.method, c.motive);
    ok(!r2.ok && !r2.personOk, "种子 " + s + "：指认错人 → 人不对");
  }
  // 口供时间线一行一个时间点（第一张修复单第 13 项）
  const c = harbor.generateCase(7, C.RNG(7));
  const tl = harbor.timelineLines(c);
  ok(tl.split("\n").length === 35, "口供时间线 35 行（5 人 × 每人 1 标题 + 6 时间点）");
  ok(tl.split("\n").filter(l => /^\s+\d{2}:\d{2}\s/.test(l)).length === 30, "每条口供一行一个时间点（30 条）");
  // 求援提示词：含已读、不含未读、不含答案
  const g = { case: c, read: {}, attempts: 0, attemptsLog: {} };
  g.read[c.docs[0].id] = true;
  const hp = harbor.helpPrompt(g);
  ok(hp.includes(c.docs[0].text.slice(0, 20)), "求援提示词含已读记录");
  const unread = c.docs.find(d => !g.read[d.id]);
  ok(unread && !hp.includes(unread.text.slice(0, 20)), "求援提示词不含未读记录");
  ok(!hp.includes(c.culprit.name) || hp.includes("栽赃"), "求援提示词不直接写答案");
}

/* ---------- 灯塔 ---------- */
section("灯塔（第一期 + 修复）");
{
  for (let s = 1; s <= 20; s++) {
    const g = light.createGame(s, C.RNG(s));
    ok([2, 3, 4].includes(g.shipPeriod), "种子 " + s + "：船期周期 2/3/4");
    ok(g.theftDays.length === 4, "种子 " + s + "：偷油 4 夜");
  }
  // 失败不扣行动点（第一张修复单第 4 项）
  const g = light.createGame(7, C.RNG(7));
  const ap0 = g.ap;
  const r = light.doAction(g, "对质");
  ok(r.ok === false && g.ap === ap0, "线索不够点「对质」不扣行动点");
  const r2 = light.doAction(g, "买油");
  if (g.money < g.fuelPrice[0]) ok(r2.ok === false && g.ap === ap0, "钱不够买油不扣行动点");
  // 平衡：50 种子，随机 / 不知道规律 / 知道规律（按 UI 的真实流程：事件 → 选择 → 白天行动 → 夜里点灯 → over()）
  function autoPlay(seed, strategy) {
    const gg = light.createGame(seed, C.RNG(seed));
    for (let d = 1; d <= light.DAYS; d++) {
      light.applyEvent(gg);
      if (gg.eventChoice) {
        if (gg.eventChoice.type === "distress") light.resolveEventChoice(gg, (gg.fuel >= 2 && gg.food >= 1) ? "救" : "不救");
        else light.resolveEventChoice(gg, "不买"); // 神秘访客的便宜油是掺水的，不买
      }
      gg.ap = 2;
      // 白天（每天 2 点，doAction 不扣点，测试里自己扣）：故障必修缮，
      // 其余优先买油（钱留给油），粮食靠捕鱼（免费）、状况靠休息（免费）。
      function act(name) {
        if (gg.ap <= 0) return;
        const r = light.doAction(gg, name);
        if (r.ok) gg.ap -= 1;
      }
      if (gg.malfunction) act("修缮");
      if (gg.clues >= 3 && !gg.thiefStopped) act("对质");
      if (gg.fuel < 12) act("买油");
      if (gg.food < 6) act("捕鱼");
      if (gg.clues < gg.theftSeen && gg.clues < 3) act("巡视");
      if (gg.condition < 60) act("休息");
      if (gg.fuel < 9) act("买油");
      if (gg.food < 3) act("捕鱼");
      // 夜里点灯
      const isCycle = ((d - 1 - gg.shipPhase) % gg.shipPeriod) === 0;
      let mode = "full";
      if (strategy === "random") mode = ["full", "half", "off"][C.RNG(seed * 1000 + d).randint(0, 2)];
      else if (strategy === "naive") mode = "full";
      else if (strategy === "smart") mode = isCycle ? "full" : "half";
      if (mode === "full" && gg.malfunction) mode = "half"; // 故障时不能全亮
      light.night(gg, mode);
      light.endOfDay(gg);
      const o = light.over(gg);
      if (o) return o.result === "win";
    }
    const o = light.over(gg);
    return o ? o.result === "win" : false;
  }
  let rw = 0, nw = 0, sw = 0;
  for (let s = 1; s <= 50; s++) {
    if (autoPlay(s, "random")) rw++;
    if (autoPlay(s, "naive")) nw++;
    if (autoPlay(s, "smart")) sw++;
  }
  ok(rw <= 10, "随机玩胜率低（" + rw + "/50）");
  ok(nw >= 40, "不知道规律（总全亮）多数能赢（" + nw + "/50）");
  ok(sw >= 48, "知道规律几乎全赢（" + sw + "/50）");
}

/* ---------- 育种所 ---------- */
section("育种所（第二期 + 修复 + 标本册）");
{
  // 30 种子各跑满一季（A/B 各 2 点，随机行动），不崩
  function newIsle(seed) {
    const rng = C.RNG(seed);
    const g = isle.createGame(seed, rng);
    g._rng = rng; // UI 里 createGame 后也是这么补的
    return g;
  }
  let done = 0;
  for (let s = 1; s <= 30; s++) {
    const g = newIsle(s);
    const rng = C.RNG(s * 7 + 1);
    for (let day = 1; day <= 30; day++) {
      for (const p of ["A", "B"]) {
        g.current = p;
        g.players[p].ap = 2;
        // 随机行动：繁殖 / 探索 / 买 / 结束
        const acts = ["breed", "explore", "end"];
        const choice = acts[rng.randint(0, 2)];
        if (choice === "breed" && g.players[p].creatures.length >= 2) {
          isle.cmdBreed(g, p, g.players[p].creatures[0].id, g.players[p].creatures[1].id);
        } else if (choice === "explore") {
          isle.cmdExplore(g, p);
        }
        isle.endTurn(g, p);
      }
      isle.nightPhase(g);
      if (g.over) break;
    }
    if (g.over || g.day >= 30) done++;
  }
  ok(done === 30, "30 种子各跑满一季不崩（" + done + "/30）");
  // 遗传规则：4 种规则都出现过（30 种子）
  const rules = {};
  for (let s = 1; s <= 30; s++) {
    const g = newIsle(s);
    for (const l in g.season.locusRules) rules[g.season.locusRules[l].rule] = true;
  }
  ok(Object.keys(rules).length === 4, "4 种表达规则都出现过（" + Object.keys(rules).join("、") + "）");
  // 图鉴无规则标签（第二张修复单第 1 项）
  const g = newIsle(7);
  const codexText = isle.codexRender(g.codex, g.season, g.players.A.creatures.concat(g.players.B.creatures));
  ok(codexText.indexOf("（显性）") === -1 && codexText.indexOf("（隐性）") === -1 &&
    codexText.indexOf("（不完全显性）") === -1 && codexText.indexOf("（上位）") === -1,
    "图鉴不标表达规则（无显性/隐性/不完全显性/上位标签）");
  ok(codexText.indexOf("（#") !== -1, "图鉴记性状出现在哪些个体上（#编号）");
  // 标本记录：首次见到的物种有标本（编号、天数、父母、性状）；每物种是数组（每种性状组合一格）
  const spec = g.codex.specimens;
  ok(spec && Object.keys(spec).length >= 2, "标本册记下首次见到的物种（" + (spec ? Object.keys(spec).length : 0) + " 种）");
  const firstEntries = spec[Object.keys(spec)[0]];
  ok(Array.isArray(firstEntries) && firstEntries.length >= 1, "每物种的标本是数组（按性状组合列）");
  const firstSpec = firstEntries[0];
  ok(firstSpec && typeof firstSpec.id === "number" && typeof firstSpec.day === "number" &&
    Array.isArray(firstSpec.parents) && Array.isArray(firstSpec.traits),
    "标本记录有编号、天数、父母、性状");
  ok(firstSpec.day === 1, "初始雾兽的标本首次孵出是第 1 天");
  // 父母标签修复：开局野生写「野生」，有父母显示真实编号
  ok(isle.specimenParentsLabel(firstSpec) === "野生", "开局野生个体的标本写「野生」");
  ok(isle.specimenParentsLabel({ parents: [3, 5], wild: false }) === "#3 × #5", "有父母的标本显示真实编号");
  ok(isle.specimenParentsLabel({ parents: [], wild: false }) === "野雾兽", "非开局的无父母个体写「野雾兽」");
  // 旧存档兼容：单个对象格式的标本读到时包成数组
  const oldSpec = { traits: {}, species: {}, legendary: [], specimens: { "雾兔": { id: 1, day: 1, parents: [], traits: ["匀称"] } } };
  const migrated = isle.specimensOf(oldSpec, "雾兔");
  ok(Array.isArray(migrated) && migrated.length === 1 && migrated[0].id === 1, "旧存档单个标本对象包成数组");
  // 繁殖后新物种进标本册；繁殖出的个体标本有真实父母（不是「野雾兽」）
  const g2 = newIsle(7);
  const before = Object.keys(g2.codex.specimens).length;
  const p1 = g2.players.A.creatures[0].id, p2 = g2.players.A.creatures[1].id;
  isle.cmdBreed(g2, "A", p1, p2);
  ok(Object.keys(g2.codex.specimens).length >= before, "繁殖后标本册不丢记录");
  let bredEntry = null;
  for (const sn in g2.codex.specimens) {
    for (const e of g2.codex.specimens[sn]) {
      if (e.parents && e.parents.length === 2 && e.parents[0] === p1 && e.parents[1] === p2) bredEntry = e;
    }
  }
  ok(bredEntry, "繁殖出的个体进了标本册且记了真实父母");
  ok(bredEntry && isle.specimenParentsLabel(bredEntry) === "#" + p1 + " × #" + p2, "繁殖个体的父母标签是真实编号");
  // 杂交种有自己的物种页
  const hybridName = isle.speciesName(g2.players.A.creatures[g2.players.A.creatures.length - 1].species);
  if (isle.basesOfName(hybridName).length > 1) {
    ok(Array.isArray(g2.codex.specimens[hybridName]) && g2.codex.specimens[hybridName].length >= 1, "杂交种 " + hybridName + " 有自己的标本页");
  }
  ok(g2.lastBorn && g2.lastBorn.length >= 1, "最新诞生记下后代编号");
  // 季末结算不剧透传说条件名（第二张修复单第 2 项）
  const g3 = newIsle(7);
  const sum = isle.seasonSummary(g3);
  const leaked = g3.season.legendary.filter(t => sum.indexOf(t) !== -1);
  ok(leaked.length === 0, "季末结算不写传说条件名（输掉时）");
  ok(sum.indexOf("传说达成") !== -1, "季末结算只写传说达成 X/3");
  // 求援提示词不含规则标签与规则描述（第二张修复单收紧后）
  const hp = isle.helpPrompt(g, "A");
  ok(hp.indexOf("（显性）") === -1 && hp.indexOf("（隐性）") === -1 && hp.indexOf("（不完全显性）") === -1 && hp.indexOf("（上位）") === -1,
    "求援提示词不含规则简称");
  ok(hp.indexOf("出现即显现") === -1 && hp.indexOf("纯合才显现") === -1 && hp.indexOf("杂合显现") === -1 && hp.indexOf("在场才显现") === -1,
    "求援提示词不含规则描述");
  ok(hp.indexOf("你是饲养员 A") !== -1, "求援提示词写明“你是饲养员 A”");
  ok((hp.match(/【图鉴】/g) || []).length === 1, "求援提示词里【图鉴】标题只出现一次（收尾第 5 项）");
  // 交易与命名（第二张修复单第 3 项）
  const g4 = newIsle(7);
  const mine = g4.players.A.creatures[0], theirs = g4.players.B.creatures[0];
  const ap0 = g4.players.A.ap;
  const tr = isle.cmdTradeOffer(g4, "A", mine.id, theirs.id, 0);
  ok(typeof tr === "string" && g4.players.A.ap === ap0 - 1, "交易发起花 1 行动点");
  ok(g4.tradeOffers.length >= 1, "交易进了待处理");
  const nm = isle.cmdName(g4, "A", mine.id, "小雾");
  ok(mine.name === "小雾", "命名成功");
  ok(g4.players.A.ap === ap0 - 1, "命名不花行动点");
  // 存档往返：标本记录与出生天数不丢
  const g5 = newIsle(7);
  isle.cmdBreed(g5, "A", g5.players.A.creatures[0].id, g5.players.A.creatures[1].id);
  const json = isle.gameToJSON(g5);
  const g6 = isle.gameFromJSON(JSON.parse(JSON.stringify(json)), C.RNG(7));
  ok(Object.keys(g6.codex.specimens).length === Object.keys(g5.codex.specimens).length, "存档往返标本记录不丢");
  ok(g6.players.A.creatures[0].bornDay === 1, "存档往返出生天数不丢");
  ok(g6.lastBorn.length === g5.lastBorn.length, "存档往返最新诞生不丢");
  // 旧存档兼容：没有 specimens/lastBorn 也能读
  const old = JSON.parse(JSON.stringify(json));
  delete old.codex.specimens; delete old.lastBorn;
  const g7 = isle.gameFromJSON(old, C.RNG(7));
  ok(g7.codex.specimens && typeof g7.codex.specimens === "object", "旧存档缺 specimens 也能读（默认空对象）");
  ok(Array.isArray(g7.lastBorn), "旧存档缺 lastBorn 也能读（默认空数组）");
}

/* ---------- 跑团（d100 + 交班表） ---------- */
section("跑团（第二期）");
{
  // d100 五档判定（rollD100(skill, difficulty, rng)，定值 RNG 控制掷骰）
  function fakeRng(v) { return { random: function () { return v; } }; }
  ok(rpg.rollD100(50, "normal", fakeRng(0.09)).roll === 10 && rpg.rollD100(50, "normal", fakeRng(0.09)).outcome === "extreme", "d100 50 技能掷 10 = 极难成功（≤技能/5=10）");
  ok(rpg.rollD100(50, "normal", fakeRng(0.14)).roll === 15 && rpg.rollD100(50, "normal", fakeRng(0.14)).outcome === "hard", "d100 50 技能掷 15 = 困难成功（≤技能/2=25）");
  ok(rpg.rollD100(50, "normal", fakeRng(0.04)).outcome === "extreme", "d100 掷 5（≤技能/5）= 极难成功");
  ok(rpg.rollD100(50, "normal", fakeRng(0.19)).outcome === "hard", "d100 掷 20（≤技能/2）= 困难成功");
  ok(rpg.rollD100(50, "normal", fakeRng(0.49)).outcome === "success", "d100 掷 50（≤技能）= 成功");
  ok(rpg.rollD100(50, "normal", fakeRng(0.59)).outcome === "fail", "d100 掷 60（>技能）= 失败");
  ok(rpg.rollD100(50, "normal", fakeRng(0.97)).outcome === "fumble", "d100 掷 98 = 大失败");
  ok(rpg.rollD100(50, "hard", fakeRng(0.09)).outcome === "hard", "困难检定：有效技能 = 技能/2=25，掷 10 ≤ 25/2=12 → 困难成功");
  ok(rpg.rollD100(50, "hard", fakeRng(0.19)).outcome === "success", "困难检定：掷 20 ≤ 25 → 成功");
  ok(rpg.rollD100(50, "easy", fakeRng(0.69)).outcome === "success", "简单检定：有效技能 = 技能+20（掷 70 ≤ 70）");
  // 交班表导出/导入往返（fog-company 的 exportHandover/importHandover）
  const rows = [["09:00", "大厅", "陈默来过", "登记", ""]];
  const text = company.exportHandover(rows, "林晚", "2026-11-14");
  ok(text.indexOf("09:00") !== -1 && text.indexOf("陈默来过") !== -1, "交班表导出含行内容");
  const back = company.importHandover(text);
  ok(back && back.rows && back.rows.length === 1 && back.rows[0][2] === "陈默来过", "交班表导入能还原行内容");
  // GM 提示词含剧本与真相（但页面不显示）
  const gm = rpg.buildGMPrompt({ title: "灯塔熄灭之夜", scenario: "剧本", truth: "真相", rules: "规则", charactersText: "角色", handoutsText: "手稿" });
  ok(gm.length > 20 && gm.indexOf("真相") !== -1, "GM 提示词含剧本与真相");
}

/* ---------- 底图 ---------- */
section("底图（视觉大改）");
{
  const scenes = bd.scenes;
  ok(scenes.length === 8, "8 幅底图（entry + entryMobile + 6 页场景）");
  for (const id of scenes) {
    const svg = bd.svg(id);
    ok(svg.length > 500 && svg.indexOf("<svg") === 0, "底图 " + id + " 是有效 SVG（" + svg.length + " 字）");
    ok(svg.indexOf("bd-fog") !== -1 || svg.indexOf("url(#bd-fog)") !== -1, "底图 " + id + " 有雾的晕染");
    ok(svg.indexOf("#e0a64a") !== -1, "底图 " + id + " 有琥珀灯光");
  }
  // 入口地图：6 个灯点，各有 data-href
  const map = bd.svg("entry");
  const points = (map.match(/class="lamp-point"/g) || []).length;
  ok(points === 6, "入口地图 6 个灯点（" + points + " 个）");
  for (const href of ["baita-lane/index.html", "fog-harbor/index.html", "lighthouse/index.html", "fog-isle/index.html", "fog-rpg/index.html", "fog-company/index.html"]) {
    ok(map.indexOf('data-href="' + href + '"') !== -1, "入口地图灯点 → " + href);
  }
  // 手机竖版地图 entryMobile（收尾第 3 项）：竖构图，六个灯点都在手机可见带内
  const mob = bd.svg("entryMobile");
  ok(mob.indexOf('viewBox="0 0 800 1200"') !== -1, "手机地图是竖版 viewBox 800×1200");
  ok((mob.match(/class="lamp-point"/g) || []).length === 6, "手机地图 6 个灯点");
  for (const href of ["baita-lane/index.html", "fog-harbor/index.html", "lighthouse/index.html", "fog-isle/index.html", "fog-rpg/index.html", "fog-company/index.html"]) {
    ok(mob.indexOf('data-href="' + href + '"') !== -1, "手机地图灯点 → " + href);
  }
  const mobX = [...mob.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="34"/g)].map(m => +m[1]);
  ok(mobX.length === 6 && mobX.every(x => x >= 122 && x <= 677), "手机地图灯点 x 都在 390px 可见带（122–677）内");
  // 桌面地图岛名上移（收尾第 8 项）：不再贴在底部被抽屉盖住
  ok(map.indexOf('>雾岛</text>') !== -1 && map.indexOf('x="980" y="390"') !== -1, "桌面地图「雾岛」注记移到岛上方（y=390）");
  ok(map.indexOf('y="780"') === -1, "桌面地图底部不再有注记");
  // 首屏主视觉（收尾第 6 项）：场景主体落在 hero 可见带（桌面 y 187–406、手机 y 0–350）里
  ok(bd.svg("lighthouse").indexOf('y="255" width="100"') !== -1, "灯塔灯室在 hero 带内（y=255）");
  ok(bd.svg("lighthouse").indexOf("transform-origin: 625px 280px") !== -1, "灯塔光柱原点跟着灯室上移");
  ok(bd.svg("rpg").indexOf('cx="360" cy="270"') !== -1, "熄灭灯塔的残光在 hero 带内（y=270）");
  ok(bd.svg("company").indexOf('cx="690" cy="315" r="40"') !== -1, "公司挂钟在右墙（690,315），桌面不再被顶边切掉");
  ok(bd.svg("baita").indexOf('y="190" width="120" height="180"') !== -1, "白塔巷窗格在 hero 带内（y=190）");
  ok(bd.svg("harbor").indexOf('cx="345" cy="300"') !== -1, "电报局挂钟右移，手机上完整可见");
  // 灯塔光柱会慢转
  ok(bd.svg("lighthouse").indexOf("bd-beam") !== -1, "灯塔底图有可转的光柱");
  // 熄灭的灯塔没有大光柱（渐变 id 叫 bd-beam，但没有 class="bd-beam" 的光柱元素）
  ok(bd.svg("rpg").indexOf('class="bd-beam"') === -1, "熄灭的灯塔没有光柱（只有一点残光）");
  ok(bd.svg("lighthouse").indexOf('class="bd-beam"') !== -1, "灯塔底图有光柱元素");
}

/* ---------- 传说秘卷（新方案 2026-11-14） ----------
   普通雾兽全部回到文字（手写登记卡），代码画的雾兽与缩略图全部撤掉；
   只有传说雾兽有亲手画的插画（grimoire-*.webp），放在独立的秘卷页。 */
section("传说秘卷（新方案）");
{
  // creature.js 只剩角色剪影 figure()，没有画雾兽的函数
  ok(typeof cr.figure === "function", "creature.js 保留 figure()");
  for (const fn of ["draw", "portrait", "silhouette", "classify", "formFor", "poseFromSeed", "basesOf", "baseOf"]) {
    ok(typeof cr[fn] === "undefined", "creature.js 不再导出 " + fn + "（代码画雾兽已撤）");
  }
  for (const role of ["cap", "sailor", "headset", "notepad", "hood", "bun", "bowtie"]) {
    const f = cr.figure(role);
    ok(f.indexOf("<svg") === 0, "人像剪影 " + role + " 能画");
  }
  // 育种所源码里没有任何代码画雾兽 / 小像的痕迹
  const isleSrc = fs.readFileSync(ROOT + "fog-isle/game.js", "utf-8");
  for (const bad of ["creature-thumb", "specimen-art", "FC.draw", "FC.portrait", "FC.silhouette", "markSpecimenSeen", "FogCreature"]) {
    ok(isleSrc.indexOf(bad) === -1, "育种所源码无 " + bad);
  }
  ok(fs.readFileSync(ROOT + "fog-isle/index.html", "utf-8").indexOf("creature.js") === -1, "育种所页不再加载 creature.js");
  // 传说页：未解锁是封蜡、不提示条件；已解锁是秘卷链接
  const legFn = isleSrc.slice(isleSrc.indexOf("function renderLegendaryPage"), isleSrc.indexOf("function render()"));
  ok(legFn.indexOf("WAX_SEAL") !== -1, "传说页未解锁是封蜡");
  ok(legFn.indexOf("条件") === -1, "传说页不提示条件");
  ok(legFn.indexOf("grimoire.html") !== -1, "传说页已解锁可打开秘卷");
  // legendaryShown 随存档走（首次获胜才转场秘卷，回来不再重复转）
  const g0 = newIsle(7);
  ok(g0.legendaryShown === false, "新开局 legendaryShown 为 false");
  const g0j = isle.gameToJSON(g0);
  ok(g0j.legendaryShown === false, "存档里有 legendaryShown");
  const g0b = isle.gameFromJSON(g0j, C.RNG(7));
  ok(g0b.legendaryShown === false, "读档恢复 legendaryShown");
  // 秘卷页：存在，引用三张插画，有手稿文字与返回链接
  const gr = fs.readFileSync(ROOT + "fog-isle/grimoire.html", "utf-8");
  ok(gr.indexOf("grimoire-main.webp") !== -1, "秘卷页有竖幅大图");
  ok(gr.indexOf("grimoire-eye.webp") !== -1 && gr.indexOf("grimoire-horn.webp") !== -1, "秘卷页有两张局部草图");
  ok(gr.indexOf("雾岛之主") !== -1 && gr.indexOf("守夜人手记") !== -1, "秘卷页有手稿体文字");
  ok(gr.indexOf('href="index.html"') !== -1, "秘卷页能返回育种所");
  ok(gr.indexOf("ink-veil") !== -1, "秘卷页进场有墨散开效果");
  // 门禁（收尾第 1 项）：静态 HTML 里没有 img 标签，插画与手稿文字只在解锁后由 JS 注入
  ok(gr.indexOf("<img") === -1, "秘卷页静态 HTML 里没有 img 标签（图只在解锁后注入）");
  ok(gr.indexOf("fog-h5-fog-isle") !== -1 && gr.indexOf("saved.won") !== -1, "秘卷页门禁读存档的 won");
  ok(gr.indexOf("还没有人见过它") !== -1, "秘卷页未解锁显示封蜡页「还没有人见过它」");
  ok(gr.indexOf("wax-seal") !== -1, "秘卷页封蜡在静态 HTML 里");
  // 墨迹转场（收尾第 2 项）：render() 插墨幕时加 .spread，动画真正播出
  ok(isleSrc.indexOf('classList.add("spread")') !== -1, "首次获胜插墨幕时加 .spread");
  // 三张插画是真 WebP，竖幅大图是竖的
  for (const f of ["grimoire-main.webp", "grimoire-eye.webp", "grimoire-horn.webp"]) {
    const b = fs.readFileSync(ROOT + "assets/" + f);
    ok(b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP", f + " 是真 WebP（" + Math.round(b.length / 1024) + " KB）");
  }
  const main = fs.readFileSync(ROOT + "assets/grimoire-main.webp");
  ok(main.length > 100 * 1024, "竖幅大图不是占位小图");
}

/* ---------- 静态检查（修复单回归） ---------- */
section("静态检查");
{
  const css = fs.readFileSync(ROOT + "assets/style.css", "utf-8");
  ok(css.indexOf("--muted:") !== -1, ":root 定义了 --muted（第二张修复单第 6 项）");
  ok(css.indexOf(".paper-table") !== -1 && css.indexOf("data-label") !== -1, "交班表窄屏变小卡片（data-label）");
  ok(css.indexOf(".backdrop") !== -1 && css.indexOf(".bd-shade") !== -1, "底图压暗 + 暗角样式");
  ok(css.indexOf(".specimen") !== -1 && css.indexOf(".specimen-grid") !== -1, "标本册样式");
  ok(css.indexOf("@keyframes develop") === -1, "显影动画已删（图鉴无画）");
  ok(css.indexOf(".ink-veil") !== -1 && css.indexOf("inkspread") !== -1 && css.indexOf("inkrecede") !== -1, "墨迹转场样式");
  ok(css.indexOf(".wax-seal") !== -1, "封蜡样式");
  ok(css.indexOf(".grimoire-main") !== -1 && css.indexOf(".grimoire-details") !== -1, "秘卷页样式");
  ok(css.indexOf("@keyframes beamsweep") !== -1, "光柱慢转动画");
  // favicon.ico 是真 ICO
  const ico = fs.readFileSync(ROOT + "favicon.ico");
  ok(ico[0] === 0 && ico[1] === 0 && ico[2] === 1 && ico[3] === 0 && ico.length > 1000, "favicon.ico 是真 ICO（" + ico.length + " 字节）");
  // 每页都接了底图
  for (const d of ["baita-lane", "fog-harbor", "lighthouse", "fog-isle", "fog-rpg", "fog-company"]) {
    const html = fs.readFileSync(ROOT + d + "/index.html", "utf-8");
    ok(html.indexOf('id="backdrop"') !== -1 && html.indexOf("backdrops.js") !== -1, d + " 接了底图");
  }
  ok(fs.readFileSync(ROOT + "fog-harbor/index.html", "utf-8").indexOf("creature.js") !== -1, "电报局页仍用 creature.js（嫌疑人剪影）");
  ok(fs.readFileSync(ROOT + "index.html", "utf-8").indexOf('id="map-holder"') !== -1, "入口页有整幅地图容器");
  // 390px：无内联固定宽度超 390
  const { execSync } = require("child_process");
  let bad = 0;
  for (const f of ["index.html", "baita-lane/index.html", "fog-harbor/index.html", "lighthouse/index.html", "fog-isle/index.html", "fog-isle/grimoire.html", "fog-rpg/index.html", "fog-company/index.html"]) {
    const h = fs.readFileSync(ROOT + f, "utf-8");
    const m = h.match(/style="[^"]*width:\s*(\d+)px/g) || [];
    for (const x of m) if (parseInt(x.match(/(\d+)px/)[1], 10) > 390) bad++;
  }
  ok(bad === 0, "无内联固定宽度超 390px");
}

console.log("\n通过 " + pass + " / 失败 " + fail);
process.exit(fail ? 1 : 0);

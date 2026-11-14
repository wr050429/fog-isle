/* 《白塔巷 17 号》H5 移植 · v2（三变体）
   逻辑与 game.py v2 一致：3 晚 × 4 行动点；走动免费；
   互动花 1 点；真相由种子定（A 收件员 / B 藏人 / C 走私）；
   结局由线索 + 最后决定共同决定。
   求援提示词只含玩家已见信息（seen[]），绝不含变体与真相。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 数据（与 Python v2 相同） ---------------- */
  const EVENINGS = 3, AP_PER_EVENING = 4;

  const VARIANTS = {
    A: {
      name: "收件员",
      letter: "信只写了一半，字很潦草：\n“……收件处的新地址，我还没想好。白塔巷 17 号要拆了，302 的灯再亮三个晚上，就要灭了。\n如果你读到这封信，说明你住进了我的房间。别害怕，信不是写给你的，是写给下一个守夜人的。\n东西在楼下，钥匙在抽屉里。屋顶的灯，别让它灭了。”",
      notebook: "笔记本里记的不是日记，是一份份“收件记录”：缺页的信、贴错的标签、互相打架的记录……每一件都写着“暂缓结案”。最后一页写着：“收件处不是收东西的，是收‘还没人认领的真相’的。白塔巷要拆了，收件处得换个地方。下一个守夜人，屋顶的灯交给你了。”",
      auntie: "王阿姨给你倒了杯茶：“小陈是个安静的孩子，半夜总有人给他送信，有时候是信，有时候是小包裹。他收了信也不拆，就锁进地下室的箱子里。他晚上常去屋顶，说是看星星——我看哪，他是在给什么人打信号。”",
      laoli: "老李压低声音：“夜里两三点，地下室总有动静，是搬箱子的声音。我看见过小陈半夜抱着箱子往地下室去，一去就是半个钟头。他出来的时候，手里是空的。”",
      signal: "信号灯还能用，旁边有一张小纸条，画着一套灯语：三长两短，是“收到了”；两短一长，是“换地方”。望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。",
      truth_name: "收件处的真相",
      truth_text: "收件处收的是“还没人认领的真相”。",
      listen: "你贴在门上，只听见自己的心跳。门后很安静，安静得不像一间空屋子。",
      ending_a: "你按笔记本最后一页的办法，给雾港的灯塔打了信号：三长两短，“收到了”。\n塔顶的灯闪了一下，像是回答。\n从今晚起，白塔巷 17 号的灯灭了，但收件处的灯，换了一个地方继续亮着。而你，就是下一个守夜人。",
      ending_b: "你把笔记本交给了房东。房东翻了两页，皱了皱眉，把它锁进了抽屉。\n“这种东西，还是别留着了。”他说。\n三天后楼拆了。收件处的事，再也没人提起。",
      ending_e: "你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、笔记本、屋顶的信号。\n陈聿不是搬走了。他是雾汀市立文书收件处的夜班值班员，白塔巷 17 号 302 室是他临时的收件点。楼要拆了，他得把收件处搬走 —— 而他把钥匙和笔记本留给了下一个人。\n那个人，就是住进 302 的你。",
      sealed_truth: "陈聿是雾汀市立文书收件处（夜间收件处）的夜班值班员。\n白塔巷 17 号 302 室是他临时的收件点：他半夜收到的信和包裹，都锁进地下室那只刻着他名字的木箱里。\n楼要拆了，他得把收件处搬走。他把钥匙和笔记本留给了下一个住进 302 的人。\n屋顶的信号灯是他和雾港灯塔之间的联络：三长两短是“收到了”，两短一长是“换地方”。"
    },
    B: {
      name: "藏人",
      letter: "信只写了一半，字很潦草：\n“……她还在 301 里。白塔巷要拆了，我得在三天内把她送走。\n如果你读到这封信，说明你住进了我的房间。别去敲 301 的门，别问她是谁。\n东西在楼下，钥匙在抽屉里。屋顶的灯，是给她看的——灯亮着，就是安全；灯灭了，就别出来。”",
      notebook: "笔记本里记的不是日记，是一份名单和时间表：几点送饭、几点换水、哪天有人来查。最后一页写着：“她不是犯人，她只是没有地方去。楼要拆了，我得把她送到雾岛去。那边有灯塔，灯塔下面有间小屋，收件处的人会接她。”",
      auntie: "王阿姨给你倒了杯茶：“小陈是个心软的孩子。半夜总有人从后门进来，我看见过，是个女的，裹着头巾。小陈往楼上端饭，一端就是两份。他晚上常去屋顶，说是看星星——我看哪，他是在给楼上那位放哨。”",
      laoli: "老李压低声音：“夜里两三点，301 总有动静，是有人走动的声音，很轻。我看见过小陈半夜端着饭往 301 去，一去就是半个钟头。他出来的时候，手里是空碗。”",
      signal: "信号灯还能用，旁边有一张小纸条，画着一套灯语：灯亮着，是“安全”；灯灭了，是“别出来”。望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。",
      truth_name: "藏人的真相",
      truth_text: "301 里藏着一个人，陈聿在保护她。",
      listen: "你贴在门上，听见门后有一声很轻的呼吸，像是有人在里面，一直没睡。",
      ending_a: "你按笔记本上的办法，给 301 的门缝里塞了张字条，又去屋顶把信号灯点亮了。灯亮着，就是安全。\n第三天早上，楼拆之前，你看见一个裹着头巾的身影从后门离开，往雾岛的方向去了。陈聿的托付，你接下了。",
      ending_b: "你把笔记本交给了房东。房东翻了两页，脸色变了，立刻叫人去敲 301 的门。\n门开了，里面是空的——她已经走了。\n房东看着你，一句话也没说。三天后楼拆了。",
      ending_e: "你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、笔记本、屋顶的信号。\n陈聿不是搬走了。他在 301 里藏了一个人——一个没有地方去的人。他半夜送饭、放哨、打信号，都是为了她。楼要拆了，他得把她送到雾岛去。而他把钥匙和笔记本留给了下一个人。\n那个人，就是住进 302 的你。",
      sealed_truth: "陈聿在 301 里藏了一个人——一个没有地方去的人。\n他半夜从后门接她进来，往 301 端饭，在屋顶放哨、打信号。\n笔记本里是送饭和放哨的时间表，最后一页写着要把她送到雾岛去，灯塔下面有间小屋，收件处的人会接她。\n301 的门是锁着的，钥匙不在陈聿手里。别去敲门，别问她是谁。"
    },
    C: {
      name: "走私",
      letter: "信只写了一半，字很潦草：\n“……这批货不能留在楼里。白塔巷要拆了，货得在三天内运走。\n如果你读到这封信，说明你住进了我的房间。别碰地下室的箱子，除非你知道该把它交给谁。\n东西在楼下，钥匙在抽屉里。屋顶的灯，是给船看的——灯亮着，就能靠岸；灯灭了，就别来。”",
      notebook: "笔记本里记的不是日记，是一本账：日期、货名、接货人、价钱。最后一页写着：“货不是我的，我只是个中间人。雾港的船半夜靠岸，货从地下室走，第二天一早就没了。楼要拆了，这条线得断了——或者，换个人接手。”",
      auntie: "王阿姨给你倒了杯茶：“小陈是个神神秘秘的孩子。半夜总有人送小箱子来，他给人钱，箱子就进了地下室。他晚上常去屋顶，说是看星星——我看哪，他是在给海上的船打信号。”",
      laoli: "老李压低声音：“夜里两三点，地下室总有动静，是搬箱子的声音，还有船靠岸的声音。我看见过小陈半夜抱着箱子往地下室去，一去就是半个钟头。他出来的时候，手里是空的，口袋里是鼓的。”",
      signal: "信号灯还能用，旁边有一张小纸条，画着一套灯语：灯亮着，是“可以靠岸”；灯灭了，是“别来”。望远镜对着雾港的灯塔 —— 塔顶的灯，今晚也亮着。",
      truth_name: "走私的真相",
      truth_text: "陈聿是个中间人，地下室走的是半夜靠岸的货。",
      listen: "你贴在门上，只听见自己的心跳。门后很安静，安静得不像一间空屋子。",
      ending_a: "你按笔记本上的办法，去屋顶把信号灯点亮了。半夜，一艘小船靠了岸，你把地下室那只箱子交给了接货的人。\n他点点头，递给你一个信封。你没有打开。\n你知道，从今晚起，这条线归你了——或者，你也可以选择把它断掉。",
      ending_b: "你把笔记本交给了房东。房东翻了两页，脸色变了，立刻叫人去查地下室的箱子。\n箱子是空的——货已经运走了。\n房东看着你，一句话也没说。三天后楼拆了。",
      ending_e: "你把六条线索拼在了一起：信、钥匙、王阿姨的话、老李的话、笔记本、屋顶的信号。\n陈聿不是搬走了。他是个中间人，雾港的船半夜靠岸，货从地下室走，第二天一早就没了。楼要拆了，这条线得断了——或者，换个人接手。\n而他把钥匙和账本留给了下一个人。那个人，就是住进 302 的你。",
      sealed_truth: "陈聿是个中间人。雾港的船半夜靠岸，货从地下室走，第二天一早就没了。\n笔记本是一本账：日期、货名、接货人、价钱。\n地下室那只刻着他名字的木箱，装的是还没运走的货。\n屋顶的信号灯是给船看的：灯亮着是“可以靠岸”，灯灭了是“别来”。"
    }
  };

  const ROOMS = {
    "302": { name: "302 室（你的房间）", desc: "陈聿的旧房间。房东说他“搬走了”，走得很急，东西都没收完。桌上有一封没写完的信，抽屉半开着，窗外是白塔巷的夜。", exits: ["201", "202", "301", "basement", "roof", "yard"] },
    "201": { name: "201 室（王阿姨家）", desc: "王阿姨是退休教师，住了一辈子。屋里有股旧书和茶的味道，墙上挂着一张老照片。", exits: ["302", "202", "301", "basement", "roof", "yard"] },
    "202": { name: "202 室（老李家）", desc: "老李是守夜人，白天睡觉，晚上上班。屋里很暗，只有一盏小灯，桌上放着一副旧耳机。", exits: ["302", "201", "301", "basement", "roof", "yard"] },
    "301": { name: "301 室（锁着的房间）", desc: "301 的门锁着。门上贴着一张褪色的封条，落款是三年前。门缝里透不出一丝光。", exits: ["302", "201", "202", "basement", "roof", "yard"] },
    "basement": { name: "地下室", desc: "地下室很潮，灯泡一闪一闪。角落里堆着几只木箱，其中一只上了锁，箱身上刻着“陈聿”两个字。", exits: ["302", "201", "202", "301", "roof", "yard"] },
    "roof": { name: "屋顶", desc: "屋顶的风很大。角落里有一架旧望远镜，和一盏信号灯。从这里能看见整条白塔巷，和雾港的灯塔。", exits: ["302", "201", "202", "301", "basement", "yard"] },
    "yard": { name: "院子", desc: "院子里有一棵石榴树，树下有一口旧井，井边放着一只铁桶。门卫老张坐在门口打盹。", exits: ["302", "201", "202", "301", "basement", "roof"] }
  };
  const ROOM_LABELS = { "302": "302", "201": "201", "202": "202", "301": "301", "basement": "地下室", "roof": "屋顶", "yard": "院子" };

  function buildActions(variant) {
    const v = VARIANTS[variant];
    return [
      { id: "letter", room: "302", text: "读桌上那封没写完的信", say: v.letter, gives: "陈聿的信" },
      { id: "key", room: "302", text: "翻抽屉", say: "抽屉里有一把黄铜钥匙，钥匙牌上写着“地下室”。钥匙下面压着一张字条：“别去 301，那间屋子不属于我。”", gives: "地下室钥匙", once: true },
      { id: "window", room: "302", text: "看窗外", say: "窗外是白塔巷。雾很薄，路灯一盏一盏亮着。你看见屋顶上有什么东西反了一下光。", gives: null },
      { id: "auntie", room: "201", text: "问王阿姨：陈聿是个什么样的人？", say: v.auntie, gives: "王阿姨的话" },
      { id: "photo", room: "201", text: "看墙上的老照片", say: "照片上是年轻时的陈聿，站在屋顶上，手里拿着一盏信号灯。照片背面写着：“雾港的灯，要有人守。”", gives: null },
      { id: "laoli", room: "202", text: "问老李：夜里听见过什么动静？", say: v.laoli, gives: "老李的话" },
      { id: "knock", room: "301", text: "敲 301 的门", say: "你敲了三下。门里没有一点声音，连回音都没有。", gives: null },
      { id: "trykey", room: "301", text: "试试抽屉里的钥匙开不开 301", say: "钥匙插不进去。锁孔的形状不对。这把钥匙不是开 301 的。你想起字条上的话：“别去 301，那间屋子不属于我。”", gives: null, requires: "地下室钥匙" },
      { id: "listen", room: "301", text: "贴在门上听听里面的动静", say: v.listen, gives: null },
      { id: "box", room: "basement", text: "用钥匙打开那只刻着“陈聿”的木箱", say: variant === "A"
          ? "箱子打开了。里面是一本笔记本，包着油布，保存得很好。笔记本的第一页写着：“雾汀市立文书收件处 · 夜间收件处 —— 值班日志。”"
          : "箱子打开了。里面是一本笔记本，包着油布，保存得很好。", gives: "陈聿的笔记本", requires: "地下室钥匙", once: true },
      { id: "readbook", room: "basement", text: "读陈聿的笔记本", say: v.notebook, gives: v.truth_name, requires: "陈聿的笔记本" },
      { id: "signal", room: "roof", text: "看那盏信号灯和望远镜", say: v.signal, gives: "屋顶的信号" },
      { id: "well", room: "yard", text: "看那口旧井", say: "井很深，井水黑黑的。你往里看了一眼，什么也没看见，只听见自己的呼吸声。", gives: null },
      { id: "zhang", room: "yard", text: "问门卫老张：这楼真要拆了？", say: "老张摆摆手：“拆是肯定要拆的，三天后动工。302 那小伙子走之前，跟我说了一句话：‘楼拆了，灯别灭。’我没听懂。”", gives: null }
    ];
  }

  /* ---------------- 游戏状态 ---------------- */
  function createGame(seed, rng) {
    const variant = rng.choice(["A", "B", "C"]);
    return {
      seed: seed, variant: variant,
      room: "302", evening: 1, ap: AP_PER_EVENING,
      clues: [], done: {}, seen: [], ended: null,
      decisions: null
    };
  }
  function majorClues(g) {
    const v = VARIANTS[g.variant];
    const names = ["陈聿的信", "王阿姨的话", "老李的话", "陈聿的笔记本", v.truth_name, "屋顶的信号"];
    return g.clues.filter(function (c) { return names.indexOf(c) !== -1; });
  }
  function majorCount(g) { return majorClues(g).length; }
  function availableActions(g) {
    const acts = buildActions(g.variant);
    return acts.filter(function (a) {
      if (a.room !== g.room) return false;
      if (a.once && g.done[a.id]) return false;
      if (a.requires && g.clues.indexOf(a.requires) === -1) return false;
      return true;
    });
  }
  function doAction(g, action) {
    g.ap -= 1;
    g.done[action.id] = true;
    if (action.gives && g.clues.indexOf(action.gives) === -1) g.clues.push(action.gives);
    /* 第 7 项修法：seen 记下当晚是第几晚（{e, t}），“今晚看到的”按当晚过滤，
       原先只取 seen 最后 4 条，会跨晚。旧存档里 seen 是字符串，兼容读取。 */
    g.seen.push({ e: g.evening, t: "【" + ROOMS[g.room].name + " · " + action.text + "】\n" + action.say });
    return action.say;
  }
  /* seen 条目兼容读：新版是 {e, t}，旧存档是字符串。 */
  function seenText(s) { return (s && typeof s === "object") ? s.t : String(s); }
  function seenEvening(s) { return (s && typeof s === "object") ? s.e : null; }
  function ending(g, choice) {
    const hasBook = g.clues.indexOf("陈聿的笔记本") !== -1;
    const hasSignal = g.clues.indexOf("屋顶的信号") !== -1;
    const full = majorCount(g) >= 6;
    const v = VARIANTS[g.variant];
    if (choice === "接手") {
      if (hasBook && hasSignal) return { code: "A", title: "接手", text: v.ending_a, full: full };
      return { code: "A?", title: "接手（未完成）", text: "你想接手，但手里缺了点东西 —— 没有笔记本，或者没看懂屋顶的信号。\n楼还是拆了。你站在废墟边，觉得自己错过了一封写给你的信。", full: full };
    }
    if (choice === "上交") {
      if (hasBook) return { code: "B", title: "上交", text: v.ending_b, full: full };
      return { code: "B?", title: "上交（未完成）", text: "你想上交点什么，但手里没有笔记本。\n你空着手站在房东门口，又退了回来。", full: full };
    }
    return { code: "C", title: "离开", text: "你收拾了行李，在第三天早上离开了白塔巷 17 号。\n302 的灯灭了。屋顶的信号灯，再也没亮过。\n有些信，永远没人认领了。", full: full };
  }
  /* 集齐六条主要线索后，结局 E 的完整真相文本（仅在结局页、且玩家集齐后才显示） */
  function endingEText(g) { return VARIANTS[g.variant].ending_e; }

  /* ---------------- 求援提示词：只用 seen[] 与当前状态 ---------------- */
  function helpPrompt(g) {
    const lines = [];
    lines.push("我在玩一个文字推理小游戏《白塔巷 17 号》。请你帮我推理，但不要直接替我做决定，也不要猜我没见过的东西。");
    lines.push("");
    lines.push("【规则】");
    lines.push("我刚搬进白塔巷 17 号 302 室，上一位住客陈聿的房间。楼三天后要拆，我有三个晚上，每晚 4 个行动点。走动不花行动点；看东西、问人、拿东西、开箱子各花 1 点。东西很多，时间不够。");
    lines.push("最后我要做决定：接手（继续陈聿留下的事，需要笔记本 + 屋顶的信号）、上交（把笔记本交给房东，需要笔记本）、离开（什么都不做）。");
    lines.push("");
    lines.push("【当前状态】");
    lines.push("第 " + g.evening + " 晚，行动点 " + g.ap + "，我在" + ROOMS[g.room].name + "。");
    lines.push("已找到的线索：" + (g.clues.length ? g.clues.join("、") : "（还没有）") + "。主要线索 " + majorCount(g) + "/6。");
    lines.push("");
    if (g.seen.length) {
      lines.push("【我已经看到的（按顺序）】");
      lines.push(g.seen.map(seenText).join("\n\n"));
      lines.push("");
    }
    lines.push("【请帮我】");
    lines.push("根据上面我已经看到的信息，帮我分析：陈聿可能留下了什么？我下一步最值得去哪、做什么？只用我已经看到的信息推理，不要编造我没见过的内容。");
    return lines.join("\n");
  }

  /* ---------------- 暴露给测试（Node） ---------------- */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { VARIANTS: VARIANTS, ROOMS: ROOMS, buildActions: buildActions, createGame: createGame, majorClues: majorClues, majorCount: majorCount, availableActions: availableActions, doAction: doAction, ending: ending, endingEText: endingEText, helpPrompt: helpPrompt, seenText: seenText, seenEvening: seenEvening };
  }
  if (typeof window !== "undefined") {
    window.BaitaLane = { VARIANTS: VARIANTS, ROOMS: ROOMS, ROOM_LABELS: ROOM_LABELS, buildActions: buildActions, createGame: createGame, majorClues: majorClues, majorCount: majorCount, availableActions: availableActions, doAction: doAction, ending: ending, endingEText: endingEText, helpPrompt: helpPrompt, seenText: seenText, seenEvening: seenEvening };
  }

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const KEY = "fog-h5-baita-lane";
  let seed = C.seedFromURL();
  let rng = C.RNG(seed);
  let g = null;
  let saved = C.loadState(KEY);
  /* 第 10 项：断点续玩提示。有中途存档且不在结局里，页面顶部显示
     「这一局你玩到第 X 晚，继续／从头」；同一会话点过“继续”就不再弹。 */
  let resumePending = false;
  /* 第 5 项修法：原先 !saved.ended 会把已结束的局丢掉重开，结局页一刷新就丢。
     现在 ended 的局也恢复，render() 会直接停在结局页。 */
  if (saved && saved.seed === seed) {
    g = saved; // 恢复进度
    if (!g.ended && !C.resumeDismissed(KEY) && (g.evening > 1 || g.seen.length > 0 || g.ap < AP_PER_EVENING)) {
      resumePending = true;
    }
  } else {
    g = createGame(seed, rng);
    C.saveState(KEY, g);
  }
  // 恢复后 RNG 不再需要（变体已定），但要保证 seen 是数组
  if (!g.seen) g.seen = [];
  if (!g.done) g.done = {};

  function save() { C.saveState(KEY, g); }
  function render() {
    const root = document.getElementById("game");
    if (g.ended) { renderEnding(root); return; }
    const room = ROOMS[g.room];
    const acts = availableActions(g);
    const html = [];
    // 第 10 项：断点续玩提示
    if (resumePending) {
      html.push('<div class="card"><h3>这一局，你玩到第 ' + g.evening + ' 晚</h3>');
      html.push('<p>这一局你已经玩到第 ' + g.evening + ' 晚了。继续接着打，还是从头开始？</p>');
      html.push('<div class="btn-row"><button class="btn" id="btn-resume-continue">继续</button><button class="btn secondary" id="btn-resume-restart">从头开始</button></div></div>');
    }
    html.push('<div class="card"><p class="meta">第 ' + g.evening + ' 晚 · ' + esc(room.name) + ' · 行动点 ' + g.ap + '</p>');
    html.push('<p>' + esc(room.desc) + '</p></div>');
    // 可做之事
    if (acts.length) {
      html.push('<div class="card"><h3>可以做的事</h3>');
      acts.forEach(function (a) {
        html.push('<button class="btn" data-act="' + a.id + '">' + esc(a.text) + '</button>');
      });
      html.push('</div>');
    }
    // 走动
    html.push('<div class="card"><h3>换个地方（不花行动点）</h3><div class="btn-row" style="flex-wrap:wrap;">');
    room.exits.forEach(function (r) {
      html.push('<button class="btn secondary" data-go="' + r + '" style="flex:1 1 28%;">' + esc(ROOM_LABELS[r]) + '</button>');
    });
    html.push('</div></div>');
    // 线索
    html.push('<div class="card"><h3>已找到的线索</h3>');
    html.push('<p>' + (g.clues.length ? esc(g.clues.join("、")) : '（还没有）') + '</p>');
    html.push('<p class="meta">主要线索 ' + majorCount(g) + '/6</p></div>');
    // 已见记录（日志）——第 7 项：只显示当晚看到的，按晚过滤，不跨晚。
    const tonight = g.seen.filter(function (s) {
      const e = seenEvening(s);
      return e === null || e === g.evening;
    });
    if (tonight.length) {
      html.push('<div class="card"><h3>今晚看到的</h3>');
      tonight.forEach(function (s) {
        html.push('<div class="record">' + esc(seenText(s)) + '</div>');
      });
      html.push('</div>');
    }
    // 决定
    html.push('<button class="btn ghost" id="btn-decide">提前做最后的决定 →</button>');
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
    root.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        const a = availableActions(g).find(function (x) { return x.id === b.getAttribute("data-act"); });
        if (!a || g.ap <= 0) return;
        doAction(g, a);
        save();
        if (g.ap <= 0) {
          if (g.evening >= EVENINGS) { showDecide(); return; }
          g.evening += 1; g.ap = AP_PER_EVENING; save();
          C.toast("天亮了。你睡了一觉，又是一个晚上。");
        }
        render();
      });
    });
    root.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.room = b.getAttribute("data-go");
        save(); render();
      });
    });
    const dec = document.getElementById("btn-decide");
    if (dec) dec.addEventListener("click", showDecide);
  }
  function showDecide() {
    const root = document.getElementById("game");
    const full = majorCount(g) >= 6;
    const html = [];
    html.push('<div class="card"><h2>第三天早上，拆迁队来了。</h2>');
    html.push('<p>你站在 302 室门口，手里拿着这三晚找到的东西。</p>');
    html.push('<p>已找到的线索：' + esc(g.clues.join("、") || "（没有）") + '</p>');
    if (full) html.push('<p>你把六条线索拼在了一起，真相已经很清楚了。</p>');
    html.push('<p>现在，你要决定：</p></div>');
    html.push('<button class="btn" data-choice="接手">接手 —— 继续陈聿留下的事<span class="hint">需要笔记本 + 屋顶的信号</span></button>');
    html.push('<button class="btn" data-choice="上交">上交 —— 把笔记本交给房东<span class="hint">需要笔记本</span></button>');
    html.push('<button class="btn" data-choice="离开">离开 —— 什么都不做，走人</button>');
    root.innerHTML = html.join("");
    root.querySelectorAll("[data-choice]").forEach(function (b) {
      b.addEventListener("click", function () {
        const res = ending(g, b.getAttribute("data-choice"));
        g.ended = { code: res.code, title: res.title, text: res.text, full: res.full };
        save(); render();
      });
    });
  }
  function renderEnding(root) {
    const e = g.ended;
    const html = [];
    html.push('<div class="card"><p class="meta">白塔巷 17 号 · 结局</p>');
    html.push('<h2 class="ending-title">【结局 ' + esc(e.code) + ' · ' + esc(e.title) + '】</h2>');
    html.push('<p>' + esc(e.text).replace(/\n/g, "<br>") + '</p>');
    html.push('<p class="meta">主要线索 ' + majorCount(g) + '/6' + (e.full ? '（你集齐了全部六条主要线索。）' : '') + '</p>');
    html.push('<span class="stamp pop">暂缓结案</span></div>');
    // 揭晓真相（玩家主动点才显示）。第 8 项修法：原先集齐六线索后「拼出来的真相」
    // 是常开卡片，和折叠的「揭晓本局真相」打架；现在一起收进折叠里。
    html.push('<div class="card"><details class="reveal"><summary>揭晓本局真相（密封：打完再看）</summary><div class="reveal-body">');
    if (e.full) {
      html.push('<h3>拼出来的真相</h3><p>' + esc(endingEText(g)).replace(/\n/g, "<br>") + '</p>');
    }
    html.push('<p>' + esc(VARIANTS[g.variant].sealed_truth).replace(/\n/g, "<br>") + '</p><p class="meta">本局变体：' + esc(VARIANTS[g.variant].name) + '。换种子，变体和细节会变。</p></div></details></div>');
    html.push('<div class="btn-row"><button class="btn" id="btn-again">换一局</button><button class="btn secondary" id="btn-replay">同一局重玩</button></div>');
    html.push('<button class="btn ghost" id="btn-back">回雾汀地图</button>');
    root.innerHTML = html.join("");
    document.getElementById("btn-again").addEventListener("click", function () {
      C.clearState(KEY);
      const ns = C.randomSeed();
      location.href = C.seedURL(ns);
    });
    document.getElementById("btn-replay").addEventListener("click", function () {
      C.clearState(KEY);
      location.href = C.seedURL(seed);
    });
    document.getElementById("btn-back").addEventListener("click", function () { location.href = "../index.html"; });
  }
  // 顶栏按钮
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

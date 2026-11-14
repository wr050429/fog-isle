/* 《雾港电报局 · 午夜班》H5 移植 · v2
   逻辑与 game.py v2 一致：三道题（谁、怎么进的、为什么），
   各有独立证据链；一份伪造记录栽赃无辜者，须用另一份不在场证明识破；
   每局恰好两处“矛盾”（一真一伪）；3 次指认机会。
   求援提示词只含玩家已见信息（口供 + 已读记录 + 指认反馈），绝不含答案与未读记录。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 数据（与 Python v2 相同） ---------------- */
  const SUSPECTS = [
    { id: "zhou", name: "老周", role: "守夜人", home: "灯塔" },
    { id: "ahai", name: "阿海", role: "货运代理", home: "货栈" },
    { id: "xiaochen", name: "小陈", role: "船员", home: "码头" },
    { id: "lin", name: "林老板", role: "酒馆老板", home: "酒馆" },
    { id: "shen", name: "沈小姐", role: "日班电报员", home: "电报局" }
  ];
  const TIMES = ["22:00", "23:00", "00:00", "01:00", "02:00", "03:00"];
  const CRIME_WINDOW = ["00:00", "01:00", "02:00"];
  const LOCATIONS = ["酒馆", "码头", "电报局", "仓库", "灯塔", "货栈"];
  const METHODS = {
    "后门": { tool: "配的钥匙", scene: "现场勘查：仓库后门的锁完好无损，没有被撬过的痕迹。有人用钥匙开的门。配钥匙的师傅说，前阵子有人配过一把仓库后门的钥匙。" },
    "窗户": { tool: "撬棍", scene: "现场勘查：仓库的窗户玻璃碎了一块，窗框上有撬过的痕迹。有人是从窗户翻进去的。" },
    "正门": { tool: "收买的守卫", scene: "现场勘查：正门的守卫支支吾吾，说昨晚有人给了他一笔钱，让他“去别处转转”。正门的锁没有被动过。" }
  };
  const MOTIVES = {
    "赌债": { title: "一张欠条", tmpl: "{p}欠了一笔赌债，数额不小，月底要还。债主催过两次。" },
    "治病": { title: "一张药铺的账单", tmpl: "{p}在药铺抓了很贵的药，家里有人病了，等钱救命。" },
    "要挟": { title: "一张字条", tmpl: "有人给{p}留了字条：“钱的事，别再拖了，不然我就把那件事说出去。”" }
  };
  const DOC_TEMPLATES = {
    "酒馆": ["酒馆账单", "{t}，{p}在酒馆点了{detail}，独自坐到打烊。老板记得他。"],
    "码头": ["码头日志", "{t}，{p}经过码头，{detail}。值班员在日志上记了一笔。"],
    "电报局": ["电报收发记录", "{t}，{p}在电报局{detail}。发报员签了字。"],
    "仓库": ["仓库出入记录", "{t}，仓库门被打开。{p}进入仓库，{detail}。值班员签字：____。"],
    "灯塔": ["灯塔日志", "{t}，灯塔值班员在灯塔上看到{p}{detail}。"],
    "货栈": ["货栈清单", "{t}，{p}在货栈{detail}。清单上有他的签字。"]
  };
  const DETAILS = {
    "酒馆": ["一壶热酒", "一杯麦茶", "半壶烧酒", "一碟花生"],
    "码头": ["往东堤方向去", "往西堤方向去", "在栈桥上站了一会儿", "帮人搬了一只箱子"],
    "电报局": ["发了一封往省城的电报", "收了一封家里的电报", "来问有没有他的电报", "替船上捎了一封电报"],
    "仓库": ["停留约一刻钟后离开", "搬走了一只小木箱", "在货架前站了很久", "出来时手里多了一只布包"],
    "灯塔": ["在塔下抽烟", "往码头方向走", "在雾里站了一会儿"],
    "货栈": ["清点了一批麻袋", "核对了一张货单", "把一捆绳子搬到门口"]
  };
  const MAX_ATTEMPTS = 3;

  /* ---------------- 生成一局 ---------------- */
  function randomWalk(rng, start, n) {
    const path = [start];
    for (let i = 0; i < n - 1; i++) {
      if (rng.random() < 0.5) path.push(path[path.length - 1]);
      else path.push(rng.choice(LOCATIONS));
    }
    return path;
  }
  function generateCase(seed, rng) {
    const culprit = rng.choice(SUSPECTS);
    const crimeTime = rng.choice(CRIME_WINDOW);
    const method = rng.choice(Object.keys(METHODS));
    const motive = rng.choice(Object.keys(MOTIVES));
    const trueTl = {};
    for (const s of SUSPECTS) {
      const start = rng.random() < 0.6 ? s.home : rng.choice(LOCATIONS);
      trueTl[s.id] = randomWalk(rng, start, TIMES.length);
    }
    const ci = TIMES.indexOf(crimeTime);
    trueTl[culprit.id][ci] = "仓库";
    const claimedTl = {};
    for (const k in trueTl) claimedTl[k] = trueTl[k].slice();
    const falseLoc = rng.choice(LOCATIONS.filter(function (l) { return l !== "仓库"; }));
    claimedTl[culprit.id][ci] = falseLoc;
    const framed = rng.choice(SUSPECTS.filter(function (s) { return s.id !== culprit.id; }));
    const forgedTime = rng.choice(CRIME_WINDOW);
    const fi = TIMES.indexOf(forgedTime);
    let framedLoc = claimedTl[framed.id][fi];
    if (framedLoc === "仓库") {
      framedLoc = rng.choice(LOCATIONS.filter(function (l) { return l !== "仓库"; }));
      claimedTl[framed.id][fi] = framedLoc;
      trueTl[framed.id][fi] = framedLoc;
    }
    const attestations = [];
    function attest(personId, time, location, key, forged) {
      attestations.push({ person: personId, time: time, location: location, key: !!key, forged: !!forged });
    }
    attest(culprit.id, crimeTime, "仓库", true, false);
    attest(framed.id, forgedTime, "仓库", false, true);
    attest(framed.id, forgedTime, framedLoc, false, false);
    for (const s of SUSPECTS) {
      if (s.id === culprit.id || s.id === framed.id) continue;
      const t = rng.choice(CRIME_WINDOW);
      attest(s.id, t, claimedTl[s.id][TIMES.indexOf(t)]);
    }
    const outside = TIMES.filter(function (t) { return CRIME_WINDOW.indexOf(t) === -1; });
    for (const t of rng.sample(outside, 2)) {
      attest(culprit.id, t, claimedTl[culprit.id][TIMES.indexOf(t)]);
    }
    const others = rng.sample(SUSPECTS.filter(function (x) { return x.id !== culprit.id; }), 2);
    for (const s of others) {
      const t = rng.choice(outside);
      attest(s.id, t, claimedTl[s.id][TIMES.indexOf(t)]);
    }
    const shuffled = rng.shuffle(attestations);
    const docs = [];
    shuffled.forEach(function (a, i) {
      const title = DOC_TEMPLATES[a.location][0];
      const tmpl = DOC_TEMPLATES[a.location][1];
      const person = SUSPECTS.find(function (s) { return s.id === a.person; }).name;
      const detail = rng.choice(DETAILS[a.location]);
      const text = tmpl.replace("{t}", a.time).replace("{p}", person).replace("{detail}", detail);
      docs.push({ id: i + 1, title: title, time: a.time, person: person, location: a.location, text: text, key: a.key, forged: a.forged });
    });
    const keyDoc = docs.find(function (d) { return d.key; });
    const forgedDoc = docs.find(function (d) { return d.forged; });
    const alibiDoc = docs.find(function (d) {
      return d.person === framed.name && d.time === forgedTime && d.location === framedLoc && !d.forged;
    });
    const sceneText = METHODS[method].scene;
    docs.push({ id: docs.length + 1, title: "现场勘查", time: null, person: null, location: null, text: sceneText, key: false, forged: false });
    const methodDoc = docs[docs.length - 1];
    const motiveTitle = MOTIVES[motive].title;
    const motiveText = MOTIVES[motive].tmpl.replace("{p}", culprit.name);
    docs.push({ id: docs.length + 1, title: motiveTitle, time: null, person: culprit.name, location: null, text: motiveText, key: false, forged: false });
    const motiveDoc = docs[docs.length - 1];
    return {
      seed: seed,
      culprit: culprit, crimeTime: crimeTime, falseLoc: falseLoc,
      method: method, methodTool: METHODS[method].tool, motive: motive,
      framed: framed, forgedTime: forgedTime,
      trueTl: trueTl, claimedTl: claimedTl,
      docs: docs,
      keyDocId: keyDoc.id, forgedDocId: forgedDoc.id, alibiDocId: alibiDoc.id,
      methodDocId: methodDoc.id, motiveDocId: motiveDoc.id
    };
  }
  function checkAnswer(c, culpritName, method, motive) {
    const suspect = SUSPECTS.find(function (s) { return s.name === culpritName; });
    const personOk = !!suspect && suspect.id === c.culprit.id;
    const methodOk = method === c.method;
    const motiveOk = motive === c.motive;
    return { ok: personOk && methodOk && motiveOk, personOk: personOk, methodOk: methodOk, motiveOk: motiveOk };
  }
  /* 第 13 项修法：原先每人一行写满六个时间点，390px 宽下折得很碎。
     现在每条口供一行一个时间点（每人一个小标题 + 六行），手机上每行都短、不断句。 */
  function timelineLines(c) {
    return SUSPECTS.map(function (s) {
      const tl = c.claimedTl[s.id];
      const lines = TIMES.map(function (t, i) { return "    " + t + "  " + tl[i]; });
      return "  " + s.name + "（" + s.role + "）：" + "\n" + lines.join("\n");
    }).join("\n");
  }
  function docBlock(d) {
    const tag = d.time ? "（" + d.time + "）" : "";
    return "【" + d.id + "】" + d.title + tag + "\n" + d.text;
  }

  /* ---------------- 求援提示词：只用口供 + 已读记录 + 指认反馈 ---------------- */
  function helpPrompt(g) {
    const c = g.case;
    const lines = [];
    lines.push("我在玩一个文字推理小游戏《雾港电报局 · 午夜班》。请你帮我推理，但不要直接替我做决定，也不要猜我没见过的东西。");
    lines.push("");
    lines.push("【案情】");
    lines.push("雾港海关仓库的保险箱，在昨晚 00:00—02:00 之间被人从仓库取走了。我是夜班电报员，要答三道题：谁偷的、怎么进的（后门 / 窗户 / 正门）、为什么（赌债 / 治病 / 要挟）。三道题全对才算破案，我只有 3 次指认机会。");
    lines.push("注意：记录里有一份是伪造的，是窃贼栽赃给别人的。别被它带偏 —— 先想想，哪份记录是假的。提示：看看哪两个人、同一时刻、出现在了两个地方。");
    lines.push("");
    lines.push("【口供汇总】（每个人声称自己整晚在何处）");
    lines.push(timelineLines(c));
    lines.push("");
    const readDocs = c.docs.filter(function (d) { return g.read[d.id]; });
    if (readDocs.length) {
      lines.push("【我已经读过的记录】");
      lines.push(readDocs.map(docBlock).join("\n\n"));
      lines.push("");
    } else {
      lines.push("【我已经读过的记录】（还没有读过任何记录）");
      lines.push("");
    }
    if (g.attemptsLog.length) {
      lines.push("【我的指认尝试】");
      g.attemptsLog.forEach(function (a) {
        lines.push("第 " + a.n + " 次：指认 " + a.person + " / " + a.method + " / " + a.motive + " —— " + a.feedback);
      });
      lines.push("");
    }
    lines.push("【当前】还剩 " + (MAX_ATTEMPTS - g.attempts) + " 次指认机会。");
    lines.push("");
    lines.push("【请帮我】");
    lines.push("根据上面我已经看到的口供和记录，帮我分析：哪份记录可能是伪造的？窃贼最可能是谁、从哪进的、为什么？只用我已经看到的信息推理，不要编造我没见过的内容。");
    return lines.join("\n");
  }

  /* ---------------- 暴露给测试（Node） ---------------- */
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { SUSPECTS: SUSPECTS, TIMES: TIMES, CRIME_WINDOW: CRIME_WINDOW, LOCATIONS: LOCATIONS, METHODS: METHODS, MOTIVES: MOTIVES, DOC_TEMPLATES: DOC_TEMPLATES, DETAILS: DETAILS, MAX_ATTEMPTS: MAX_ATTEMPTS, generateCase: generateCase, checkAnswer: checkAnswer, timelineLines: timelineLines, docBlock: docBlock, helpPrompt: helpPrompt };
  }
  if (typeof window !== "undefined") {
    window.FogHarbor = { SUSPECTS: SUSPECTS, TIMES: TIMES, CRIME_WINDOW: CRIME_WINDOW, LOCATIONS: LOCATIONS, METHODS: METHODS, MOTIVES: MOTIVES, DOC_TEMPLATES: DOC_TEMPLATES, DETAILS: DETAILS, MAX_ATTEMPTS: MAX_ATTEMPTS, generateCase: generateCase, checkAnswer: checkAnswer, timelineLines: timelineLines, docBlock: docBlock, helpPrompt: helpPrompt };
  }

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const KEY = "fog-h5-fog-harbor";
  let seed = C.seedFromURL();
  let rng = C.RNG(seed);
  let saved = C.loadState(KEY);
  let g = null;
  /* 第 10 项：断点续玩提示。有中途存档且不在结局里，页面顶部显示
     「这一局你已读 X 份记录，继续／从头」；同一会话点过“继续”就不再弹。 */
  let resumePending = false;
  /* 第 5 项修法：原先 !saved.ended 会把已结束的局丢掉重开，结局页一刷新就丢。
     现在 ended 的局也恢复，render() 会直接停在结局页。 */
  if (saved && saved.seed === seed && saved.case) {
    g = saved;
    if (!g.ended && !C.resumeDismissed(KEY) && (Object.keys(g.read || {}).length > 0 || g.attempts > 0)) {
      resumePending = true;
    }
  } else {
    g = { seed: seed, case: generateCase(seed, rng), read: {}, attempts: 0, attemptsLog: [], hintUsed: false, ended: null, currentDoc: null };
    C.saveState(KEY, g);
  }
  if (!g.read) g.read = {};
  if (!g.attemptsLog) g.attemptsLog = {};

  function save() { C.saveState(KEY, g); }
  /* 视觉大改：嫌疑人小剪影（头肩剪影 + 一件身份配饰，克制、不喧宾夺主） */
  const FC = (typeof window !== "undefined" && window.FogCreature) || null;
  function figureFor(role) {
    if (!FC) return "";
    const map = { "守夜人": "hood", "货运代理": "cap", "船员": "sailor", "酒馆老板": "bowtie", "日班电报员": "bun" };
    return '<span class="figure-mini">' + FC.figure(map[role] || "cap") + '</span>';
  }
  function render() {
    const root = document.getElementById("game");
    if (g.ended) { renderEnding(root); return; }
    const c = g.case;
    const html = [];
    // 第 10 项：断点续玩提示
    if (resumePending) {
      const readN = Object.keys(g.read || {}).length;
      html.push('<div class="card"><h3>这一局，你已读了 ' + readN + ' 份记录</h3>');
      html.push('<p>这一局你已经读了 ' + readN + ' 份记录' + (g.attempts > 0 ? '、指认了 ' + g.attempts + ' 次' : '') + '。继续接着打，还是从头开始？</p>');
      html.push('<div class="btn-row"><button class="btn" id="btn-resume-continue">继续</button><button class="btn secondary" id="btn-resume-restart">从头开始</button></div></div>');
    }
    // 口供
    html.push('<div class="card"><h3>口供汇总</h3><p class="meta">每个人声称自己整晚在何处</p>');
    html.push('<div class="record">' + esc(timelineLines(c)) + '</div></div>');
    // 记录清单
    html.push('<div class="card"><h3>记录清单</h3><p class="meta">点一份，读它的全文。记录里有一份是伪造的。</p>');
    c.docs.forEach(function (d) {
      const tag = d.time ? "（" + d.time + "）" : "";
      const mark = g.read[d.id] ? " ✓已读" : "";
      html.push('<button class="btn secondary" data-read="' + d.id + '">[' + d.id + '] ' + esc(d.title) + ' ' + esc(tag) + mark + '</button>');
    });
    html.push('</div>');
    // 当前读的记录
    if (g.currentDoc) {
      const d = c.docs.find(function (x) { return x.id === g.currentDoc; });
      if (d) {
        html.push('<div class="card"><h3>记录 [' + d.id + '] ' + esc(d.title) + '</h3><div class="record">' + esc(d.text) + '</div></div>');
      }
    }
    // 指认
    html.push('<div class="card"><h3>指认三道题</h3><p class="meta">还剩 ' + (MAX_ATTEMPTS - g.attempts) + ' 次机会。三道题全对才算破案。</p>');
    html.push('<div class="pick-group"><p class="pick-label">谁偷的？</p><div class="pick-options" id="pick-person">');
    SUSPECTS.forEach(function (s) {
      html.push('<button class="pick" data-pick="person" data-v="' + esc(s.name) + '">' + figureFor(s.role) + esc(s.name) + '</button>');
    });
    html.push('</div></div>');
    html.push('<div class="pick-group"><p class="pick-label">怎么进的？</p><div class="pick-options" id="pick-method">');
    Object.keys(METHODS).forEach(function (m) {
      html.push('<button class="pick" data-pick="method" data-v="' + esc(m) + '">' + esc(m) + '</button>');
    });
    html.push('</div></div>');
    html.push('<div class="pick-group"><p class="pick-label">为什么？</p><div class="pick-options" id="pick-motive">');
    Object.keys(MOTIVES).forEach(function (m) {
      html.push('<button class="pick" data-pick="motive" data-v="' + esc(m) + '">' + esc(m) + '</button>');
    });
    html.push('</div></div>');
    html.push('<button class="btn" id="btn-submit">指认</button>');
    if (!g.hintUsed) html.push('<button class="btn ghost" id="btn-hint">要一次提示</button>');
    html.push('</div>');
    // 指认反馈
    if (g.attemptsLog.length) {
      html.push('<div class="card"><h3>指认记录</h3><ul class="log">');
      g.attemptsLog.forEach(function (a) {
        html.push('<li>第 ' + a.n + ' 次：' + esc(a.person) + ' / ' + esc(a.method) + ' / ' + esc(a.motive) + ' —— ' + esc(a.feedback) + '</li>');
      });
      html.push('</ul></div>');
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
    // 读记录
    root.querySelectorAll("[data-read]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.currentDoc = parseInt(b.getAttribute("data-read"), 10);
        g.read[g.currentDoc] = true;
        save(); render();
        const el = document.querySelector("[data-read='" + g.currentDoc + "']");
        if (el) el.scrollIntoView({ block: "nearest" });
      });
    });
    // 三组选择
    const picks = { person: null, method: null, motive: null };
    root.querySelectorAll("[data-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        const k = b.getAttribute("data-pick");
        picks[k] = b.getAttribute("data-v");
        root.querySelectorAll("[data-pick='" + k + "']").forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
      });
    });
    const hintBtn = document.getElementById("btn-hint");
    if (hintBtn) hintBtn.addEventListener("click", function () {
      g.hintUsed = true; save();
      C.toast("提示：先找出哪份记录是伪造的 —— 看看哪两个人、同一时刻、出现在了两个地方。");
      render();
    });
    document.getElementById("btn-submit").addEventListener("click", function () {
      if (!picks.person || !picks.method || !picks.motive) {
        C.toast("三道题都要选：人、入口、动机。");
        return;
      }
      g.attempts += 1;
      const res = checkAnswer(c, picks.person, picks.method, picks.motive);
      if (res.ok) {
        g.ended = { win: true, person: picks.person, method: picks.method, motive: picks.motive };
        save(); render(); return;
      }
      const wrong = [];
      if (!res.personOk) wrong.push("人");
      if (!res.methodOk) wrong.push("手法");
      if (!res.motiveOk) wrong.push("动机");
      const left = MAX_ATTEMPTS - g.attempts;
      const fb = wrong.join("、") + "不对" + (left > 0 ? "，还剩 " + left + " 次机会。" : "。");
      g.attemptsLog.push({ n: g.attempts, person: picks.person, method: picks.method, motive: picks.motive, feedback: fb });
      if (left <= 0) {
        g.ended = { win: false };
        save(); render(); return;
      }
      save(); render();
      C.toast("× " + fb);
    });
  }
  function renderEnding(root) {
    /* 第 9 项修法：进结局时先清掉残留的轻提示（指认错的 toast 别带进胜局页）。 */
    C.hideToast();
    const c = g.case;
    const html = [];
    if (g.ended.win) {
      /* 第 9 项修法：原先胜局卡片在折叠外面就把答案（人、手法、动机、伪造记录）写全了；
         现在折叠外面只留一句“破案了”，答案全收进下面的揭晓里。 */
      html.push('<div class="card"><p class="meta">雾港电报局 · 午夜班</p>');
      html.push('<h2 class="ending-title">✓ 三道题全对，破案。</h2>');
      html.push('<p>你读了 ' + Object.keys(g.read).length + ' 份记录，用了 ' + g.attempts + ' 次指认。雾散了，天亮了。</p>');
      html.push('<span class="stamp pop">已归档</span></div>');
    } else {
      html.push('<div class="card"><p class="meta">雾港电报局 · 午夜班</p>');
      html.push('<h2 class="ending-title">× 不对。指认机会用完了。</h2>');
      html.push('<p>天亮了，雾还没散。保险箱的事，暂时没有答案。</p>');
      html.push('<span class="stamp pop">暂缓结案</span></div>');
    }
    html.push('<div class="card"><details class="reveal"><summary>揭晓本局真相（密封：打完再看）</summary><div class="reveal-body">');
    html.push('<p>窃贼是' + esc(c.culprit.name) + '（' + esc(c.culprit.role) + '）。保险箱是在 ' + esc(c.crimeTime) + '—02:00 之间被取走的。' + esc(c.crimeTime) + '他声称自己在' + esc(c.falseLoc) + '，但记录 [' + c.keyDocId + '] 写明他当时在仓库。</p>');
    html.push('<p>手法：从' + esc(c.method) + '进去，用的是' + esc(c.methodTool) + '。动机：' + esc(c.motive) + '。证据是记录 [' + c.motiveDocId + ']（' + esc(MOTIVES[c.motive].title) + '）。</p>');
    html.push('<p>记录 [' + c.forgedDocId + '] 是伪造的，栽赃给了' + esc(c.framed.name) + '。它声称 ' + esc(c.framed.name) + ' ' + esc(c.forgedTime) + ' 在仓库，但记录 [' + c.alibiDocId + '] 写明他当时在别处——同一时刻、同一人、两个地方，所以伪造的那份是假的。</p>');
    html.push('<p class="meta">换种子，真相全变。</p></div></details></div>');
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

/* 雾系列跑团本 · 共享底座
   d100 检定（五档判定）、调查笔记本（localStorage）、
   AI 主持人提示词拼装、求援提示词拼装。
   剧本与真相只活在 JS 数据里，页面上绝不主动显示；
   主持人提示词在内存里拼好、直接复制，不经过页面。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;

  /* ---------- d100 检定 ---------- */
  // 难度：普通（技能不变）、困难（技能减半）、简单（技能 +20，上限 95）。
  // 判定（按规则书，大成功 = 技能/5；这里按用户要求给出五档）：
  //   96–100 大失败；<= 技能/5 极难成功（规则书的大成功）；
  //   <= 技能/2 困难成功；<= 技能 成功；其余失败。
  function rollD100(skill, difficulty, rng) {
    skill = Math.max(1, Math.min(99, skill | 0));
    let eff = skill;
    if (difficulty === "hard") eff = Math.max(1, Math.floor(skill / 2));
    if (difficulty === "easy") eff = Math.min(95, skill + 20);
    const roll = 1 + Math.floor((rng ? rng.random() : Math.random()) * 100);
    let outcome, label;
    if (roll >= 96) { outcome = "fumble"; label = "大失败"; }
    else if (roll <= Math.floor(eff / 5)) { outcome = "extreme"; label = "极难成功（大成功）"; }
    else if (roll <= Math.floor(eff / 2)) { outcome = "hard"; label = "困难成功"; }
    else if (roll <= eff) { outcome = "success"; label = "成功"; }
    else { outcome = "fail"; label = "失败"; }
    return { roll: roll, skill: skill, difficulty: difficulty || "normal", effectiveSkill: eff, outcome: outcome, label: label };
  }
  function rollText(r) {
    const diff = r.difficulty === "hard" ? "（困难检定）" : r.difficulty === "easy" ? "（简单检定）" : "";
    return "你掷了 " + r.roll + "，技能 " + r.skill + diff + "，有效技能 " + r.effectiveSkill + " —— " + r.label + "。";
  }

  /* ---------- 调查笔记本（localStorage） ---------- */
  function loadNotes(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveNotes(key, notes) {
    try { localStorage.setItem(key, JSON.stringify(notes)); } catch (e) { /* 忽略 */ }
  }

  /* ---------- AI 主持人提示词 ----------
     把主持人剧本 + 真相 + 规则 + 角色卡 + 手稿整理成一段完整提示词，
     玩家贴给自己的 AI，让 AI 当主持人带团。只在内存里拼，页面上不显示。 */
  function buildGMPrompt(data) {
    const L = [];
    L.push("你来当《" + data.title + "》的主持人（GM），带我跑这个雾系列跑团本。");
    L.push("");
    L.push("【你的身份】");
    L.push("你是主持人，不是玩家。你负责：描述场景、扮演所有 NPC、掷骰子并公开结果、按剧本进度发手稿、按三线索原则给线索。不要替玩家做决定，只把选择摆出来。");
    L.push("");
    L.push("【规则（轻量 d100）】");
    L.push(data.rules);
    L.push("");
    L.push("【玩家角色】");
    L.push(data.charactersText);
    L.push("");
    L.push("【开局手稿（开局时发给玩家）】");
    L.push(data.openingHandouts);
    L.push("");
    L.push("【剧本（主持人专用，玩家勿看）】");
    L.push(data.scenario);
    L.push("");
    L.push("【真相速查（主持人专用）】");
    L.push(data.sealed);
    L.push("");
    L.push("【主持人备忘】");
    L.push(data.notes || "检定失败不要卡死，给线索但加代价。理智检定别滥用，只在剧本写明的地方做。不要在本剧本里写死陈聿去了哪里、信里写了什么——信是钩子，不是答案，留给以后的剧本。");
    L.push("");
    L.push("【开局】");
    L.push("先把开局手稿贴给我，再让我选一张角色卡（或告诉我你已经选了哪张），然后按剧本开场。每次掷骰子都要公开说出结果（比如“你掷了 42，侦查 60，成功”），别暗掷。");
    return L.join("\n");
  }

  /* ---------- 本回合求援提示词 ----------
     只含玩家自己的笔记和已拿到的手稿，用来问另一个 AI 帮忙推理。 */
  function buildHelpPrompt(data, notes, handoutsReceived) {
    const L = [];
    L.push("我在跑一个文字跑团本《" + data.title + "》。请你帮我推理，但不要直接替我做决定，也不要猜我没见过的东西。");
    L.push("");
    L.push("【我已经拿到的手稿】");
    if (handoutsReceived && handoutsReceived.length) L.push(handoutsReceived.join("\n\n"));
    else L.push("（开局电报/公司地图，见下）");
    L.push("");
    L.push("【我的调查笔记本】");
    if (notes && notes.length) L.push(notes.map(function (n, i) { return (i + 1) + ". " + n; }).join("\n"));
    else L.push("（还没有记笔记）");
    L.push("");
    L.push("【请帮我】");
    L.push("根据上面我已经看到的手稿和我自己的笔记，帮我分析：接下来最值得去哪、问谁、查什么？只用我已经看到的信息推理，不要编造我没见过的内容，也不要直接告诉我真相。");
    return L.join("\n");
  }

  window.FogRPG = {
    rollD100: rollD100, rollText: rollText,
    loadNotes: loadNotes, saveNotes: saveNotes,
    buildGMPrompt: buildGMPrompt, buildHelpPrompt: buildHelpPrompt
  };
})();

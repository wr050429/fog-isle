/* 《雾岛育种所》H5 移植
   逻辑与 fog_isle/ Python 版一致：6 个位点 × 2 等位基因；
   每季种子重随机表达规则（显性/隐性/不完全显性/上位）；
   基因型隐藏，只显示表现型；图鉴满是 ???；
   随机事件 + 神秘蛋 + 市场/委托/交易/借配；
   传说目标：同时拥有 3 个随机稀有性状的雾兽。
   双人合作（A、B），网页版一个人管两边，也可以让 AI 当 B
   （求援提示词里写明“你是 B”）。
   求援提示词只含玩家已见信息（已孵个体与外显性状、繁殖记录、
   图鉴进度），绝不写入隐藏的基因型、遗传规律的真相。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 遗传（与 genetics.py 相同） ---------------- */
  const LOCI = {
    SIZE:  { name: "体型", alleles: { small: "娇小", medium: "匀称", large: "壮硕" }, rare: { giant: "巨型" } },
    COAT:  { name: "毛色", alleles: { white: "白毛", grey: "灰毛", gold: "金色毛", blue: "蓝毛" }, rare: { purple: "紫毛", iridescent: "虹彩毛" } },
    HORN:  { name: "角",   alleles: { none: "无角", single: "独角", double: "双角" }, rare: { spiral: "螺旋角" } },
    WING:  { name: "翼",   alleles: { none: "无翼", membrane: "膜翼", feather: "羽翼" }, rare: { light: "光翼" } },
    TAIL:  { name: "尾",   alleles: { short: "短尾", long: "长尾", mist: "雾尾" }, rare: { forked: "分叉尾" } },
    GLOW:  { name: "光",   alleles: { none: "无光", faint: "微光", bright: "荧光" }, rare: { rainbow: "虹光" } }
  };
  const BLEND_TRAITS = { SIZE: "中型", COAT: "渐变毛", HORN: "小角", WING: "薄翼", TAIL: "中尾", GLOW: "淡光" };
  const ABSENT_PREFIX = "无";
  const RULES = ["dominant", "recessive", "incomplete", "epistatic"];
  const RULE_NAMES = { dominant: "显性", recessive: "隐性", incomplete: "不完全显性", epistatic: "上位" };
  const MUTATION_RATE = 0.04;

  function traitName(locus, allele) {
    const data = LOCI[locus];
    if (allele in data.alleles) return data.alleles[allele];
    return data.rare[allele];
  }
  function allAlleles(locus) {
    const data = LOCI[locus];
    return Object.keys(data.alleles).concat(Object.keys(data.rare));
  }
  function presentTraits(locus) {
    const names = [];
    for (const allele of allAlleles(locus)) {
      const name = traitName(locus, allele);
      if (name.indexOf(ABSENT_PREFIX) !== 0) names.push(name);
    }
    return names;
  }
  function allPresentTraits() {
    const names = [];
    for (const locus in LOCI) {
      names.push.apply(names, presentTraits(locus));
      const blend = BLEND_TRAITS[locus];
      if (names.indexOf(blend) === -1) names.push(blend);
    }
    return names;
  }

  function SeasonGenetics(seed, rng) {
    // 注意：Python 版用 random.Random(seed) 单独为基因系统开一个 RNG；
    // 这里同样用种子单独开一个 RNG（与游戏主 RNG 互不干扰）。
    this.seed = seed;
    this.locusRules = {};
    for (const locus in LOCI) {
      const data = LOCI[locus];
      const rule = rng.choice(RULES);
      const key = rng.choice(Object.keys(data.alleles));
      let gate = null;
      if (rule === "epistatic") {
        const other = rng.choice(Object.keys(LOCI).filter(function (l) { return l !== locus; }));
        const gateAllele = rng.choice(Object.keys(LOCI[other].alleles));
        gate = [other, gateAllele];
      }
      this.locusRules[locus] = { rule: rule, key: key, blend: BLEND_TRAITS[locus], gate: gate };
    }
    const rare = [];
    for (const locus in LOCI) {
      const data = LOCI[locus];
      for (const allele in data.rare) {
        const name = traitName(locus, allele);
        if (name.indexOf(ABSENT_PREFIX) !== 0) rare.push(name);
      }
    }
    this.legendary = rng.sample(rare, 3);
  }
  SeasonGenetics.prototype.express = function (locus, pair, genotype) {
    const info = this.locusRules[locus];
    const rule = info.rule, key = info.key;
    const a1 = pair[0], a2 = pair[1];
    if (rule === "epistatic") {
      const gateLocus = info.gate[0], gateAllele = info.gate[1];
      if (genotype[gateLocus].indexOf(gateAllele) === -1) return null;
      if (key === a1 || key === a2) return traitName(locus, key);
      return traitName(locus, a1);
    }
    if (rule === "dominant") {
      if (key === a1 || key === a2) return traitName(locus, key);
      return traitName(locus, a1);
    }
    if (rule === "recessive") {
      if (a1 === key && a2 === key) return traitName(locus, key);
      return traitName(locus, a2 === key ? a2 : a1);
    }
    // incomplete
    if (a1 === a2) return traitName(locus, a1);
    if (key === a1 || key === a2) return info.blend;
    return traitName(locus, a1);
  };
  SeasonGenetics.prototype.phenotype = function (genotype) {
    const out = {};
    for (const locus in LOCI) out[locus] = this.express(locus, genotype[locus], genotype);
    return out;
  };
  SeasonGenetics.prototype.visibleTraits = function (genotype) {
    const traits = [];
    const ph = this.phenotype(genotype);
    for (const locus in ph) {
      const name = ph[locus];
      if (name && name.indexOf(ABSENT_PREFIX) !== 0) traits.push(name);
    }
    return traits;
  };
  SeasonGenetics.prototype.ruleDescription = function (locus) {
    const info = this.locusRules[locus];
    const rule = info.rule;
    const keyName = traitName(locus, info.key);
    if (rule === "dominant") return "显性：" + keyName + " 出现即显现";
    if (rule === "recessive") return "隐性：" + keyName + " 纯合才显现";
    if (rule === "incomplete") return "不完全显性：杂合显现「" + info.blend + "」";
    const gateName = traitName(info.gate[0], info.gate[1]);
    return "上位：需「" + gateName + "」在场才显现，显现时为「" + keyName + "」";
  };
  SeasonGenetics.prototype.randomGenotype = function (rng, allowRare) {
    const genotype = {};
    for (const locus in LOCI) {
      const data = LOCI[locus];
      let pool = Object.keys(data.alleles);
      if (allowRare) pool = pool.concat(Object.keys(data.rare));
      genotype[locus] = [rng.choice(pool), rng.choice(pool)];
    }
    return genotype;
  };
  SeasonGenetics.prototype.inherit = function (parent1, parent2, rng) {
    const child = {};
    for (const locus in LOCI) {
      const a = rng.choice(parent1[locus]);
      const b = rng.choice(parent2[locus]);
      const pair = [a, b];
      for (let i = 0; i < 2; i++) {
        if (rng.random() < MUTATION_RATE) pair[i] = rng.choice(allAlleles(locus));
      }
      child[locus] = [pair[0], pair[1]];
    }
    return child;
  };
  SeasonGenetics.prototype.toJSON = function () {
    return { seed: this.seed, legendary: this.legendary.slice(), locusRules: JSON.parse(JSON.stringify(this.locusRules)) };
  };
  SeasonGenetics.fromJSON = function (data) {
    const obj = Object.create(SeasonGenetics.prototype);
    obj.seed = data.seed;
    obj.legendary = data.legendary.slice();
    obj.locusRules = JSON.parse(JSON.stringify(data.locusRules));
    return obj;
  };

  /* ---------------- 雾兽（与 creatures.py 相同） ---------------- */
  const BASE_ORDER = ["兔", "狐", "鹿", "鸟"];
  function speciesName(species) {
    let chars = "";
    for (const c of BASE_ORDER) if (species.indexOf(c) !== -1) chars += c;
    return "雾" + chars;
  }
  /* 物种名（如“雾兔狐”）→ 基底数组（逻辑层本地一份，Node 测试也能用） */
  function basesOfName(name) {
    const out = [];
    for (const b of BASE_ORDER) if (String(name).indexOf(b) !== -1) out.push(b);
    return out.length ? out : ["兔"];
  }
  function makeCreature(id, species, genotype, parents, generation, owner) {
    return { id: id, species: species.slice(), genotype: genotype, parents: parents || [], generation: generation || 1, owner: owner || null, name: null, sick: false, wild: false };
  }
  function visibleTraitsOf(creature, season) { return season.visibleTraits(creature.genotype); }
  function appearanceOf(creature, season) {
    const traits = visibleTraitsOf(creature, season);
    let desc = speciesName(creature.species);
    if (traits.length) desc += "（" + traits.join("、") + "）";
    if (creature.name) desc = creature.name + "·" + desc;
    if (creature.sick) desc += "【生病】";
    return desc;
  }
  function breed(parent1, parent2, rng, season, nextId, owner) {
    const n = rng.randint(1, 3);
    const children = [];
    for (let i = 0; i < n; i++) {
      const genotype = season.inherit(parent1.genotype, parent2.genotype, rng);
      const species = parent1.species.concat(parent2.species.filter(function (s) { return parent1.species.indexOf(s) === -1; }));
      const generation = Math.max(parent1.generation, parent2.generation) + 1;
      children.push(makeCreature(nextId(), species, genotype, [parent1.id, parent2.id], generation, owner));
    }
    return children;
  }
  function randomCreature(rng, season, nextId, owner, allowRare) {
    const species = [rng.choice(BASE_ORDER)];
    const genotype = season.randomGenotype(rng, allowRare);
    return makeCreature(nextId(), species, genotype, [], 1, owner);
  }
  function initialCreatures(rng, season, nextId, owner) {
    const chosen = rng.sample(BASE_ORDER, 2);
    return chosen.map(function (base) {
      const genotype = season.randomGenotype(rng, false);
      const c = makeCreature(nextId(), [base], genotype, [], 1, owner);
      c.wild = true; // 开局的野生个体（图鉴里只有它们写「野生」）
      return c;
    });
  }

  /* ---------------- 市场 / 委托 / 交易（与 market.py 相同） ---------------- */
  function makeCommission(id, description, requiredTraits, requiredSpecies, reward) {
    return { id: id, description: description, requiredTraits: requiredTraits.slice(), requiredSpecies: requiredSpecies || null, reward: reward };
  }
  function commissionMatches(commission, creature, season) {
    const traits = visibleTraitsOf(creature, season);
    for (const t of commission.requiredTraits) if (traits.indexOf(t) === -1) return false;
    if (commission.requiredSpecies && speciesName(creature.species) !== commission.requiredSpecies) return false;
    return true;
  }
  function makeMarket(rng, season, nextId) {
    const m = { stock: [], special: [], commissions: [], _nextMarketId: 1, _nextCommissionId: 1 };
    for (let i = 0; i < 3; i++) addStock(m, rng, season, nextId);
    for (let i = 0; i < 3; i++) addCommission(m, rng, season, false);
    return m;
  }
  function addStock(m, rng, season, nextId) {
    let creature = randomCreature(rng, season, nextId, null, false);
    if (rng.random() < 0.25) creature = randomCreature(rng, season, nextId, null, true);
    let price = 15 + 5 * visibleTraitsOf(creature, season).length;
    if (rng.random() < 0.15) price += 15;
    const item = { id: m._nextMarketId, creature: creature, price: price };
    m._nextMarketId += 1;
    m.stock.push(item);
    return item;
  }
  function addSpecial(m, creature, price) {
    const item = { id: m._nextMarketId, creature: creature, price: price };
    m._nextMarketId += 1;
    m.special.push(item);
    return item;
  }
  function refreshMarket(m, rng, season, nextId, n) {
    for (let i = 0; i < (n || 1); i++) {
      if (m.stock.length) m.stock.shift();
      addStock(m, rng, season, nextId);
    }
  }
  function refreshAllMarket(m, rng, season, nextId) {
    m.stock = [];
    for (let i = 0; i < 3; i++) addStock(m, rng, season, nextId);
  }
  function findMarketItem(m, marketId) {
    const all = m.stock.concat(m.special);
    for (const item of all) if (item.id === marketId) return item;
    return null;
  }
  function removeMarketItem(m, marketId) {
    for (const lst of [m.stock, m.special]) {
      for (let i = 0; i < lst.length; i++) {
        if (lst[i].id === marketId) return lst.splice(i, 1)[0];
      }
    }
    return null;
  }
  function addCommission(m, rng, season, double) {
    const traits = allPresentTraits();
    const required = [rng.choice(traits)];
    let species = null;
    if (rng.random() < 0.35) species = speciesName([rng.choice(BASE_ORDER)]);
    let reward = rng.choice([20, 30, 40, 50, 60]);
    if (double) reward *= 2;
    const desc = species ? "培育一只" + required.join("、") + "的" + species : "培育一只拥有「" + required.join("、") + "」的雾兽";
    const commission = makeCommission(m._nextCommissionId, desc, required, species, reward);
    m._nextCommissionId += 1;
    m.commissions.push(commission);
    return commission;
  }
  function refreshCommissions(m, rng, season) {
    while (m.commissions.length < 3) addCommission(m, rng, season, false);
  }
  function removeCommission(m, cid) {
    for (let i = 0; i < m.commissions.length; i++) {
      if (m.commissions[i].id === cid) return m.commissions.splice(i, 1)[0];
    }
    return null;
  }

  /* ---------------- 随机事件（与 events.py 相同） ---------------- */
  const EVENT_DEFS = [
    { name: "雾夜", weight: 3 }, { name: "神秘商人", weight: 2 }, { name: "流浪雾兽", weight: 3 },
    { name: "丰收", weight: 2 }, { name: "雾疫", weight: 2 }, { name: "神秘蛋", weight: 2 },
    { name: "横财", weight: 2 }, { name: "访客", weight: 1 }, { name: "雾潮", weight: 1 }, { name: "静夜", weight: 2 }
  ];
  function drawEvent(g, rng) {
    const names = EVENT_DEFS.map(function (e) { return e.name; });
    const weights = EVENT_DEFS.map(function (e) { return e.weight; });
    const chosen = rng.choices(names, weights);
    let text = "";
    if (chosen === "雾夜") {
      g.flags.fog = true;
      text = "雾夜：浓雾漫过育种所，今晚所有雾兽的外观都看不真切（下一回合外观描述会隐藏一个性状）。";
    } else if (chosen === "神秘商人") {
      const creature = randomCreature(rng, g.season, function () { return g.nextId(); }, null, true);
      addSpecial(g.market, creature, 70);
      text = "神秘商人：一位斗篷商人带来一只外观奇特的雾兽，标价 70 雾币（市场特售，基因未知）。";
    } else if (chosen === "流浪雾兽") {
      const creature = randomCreature(rng, g.season, function () { return g.nextId(); }, null, false);
      const player = rng.choice(["A", "B"]);
      creature.owner = player;
      creature.bornDay = g.day;
      g.players[player].creatures.push(creature);
      codexObserve(g.codex, creature, g.season);
      text = "流浪雾兽：一只野雾兽溜进 " + player + " 的育种所，留了下来：" + appearanceOf(creature, g.season) + "。";
    } else if (chosen === "丰收") {
      g.flags.bountiful = true;
      text = "丰收：岛上的雾气格外滋养，下一次繁殖产仔 +1 只。";
    } else if (chosen === "雾疫") {
      const all = g.players.A.creatures.concat(g.players.B.creatures);
      if (!all.length) text = "雾疫：雾气里飘过一阵病气，但所里没有雾兽，无事发生。";
      else {
        const creature = rng.choice(all);
        creature.sick = true;
        text = "雾疫：" + appearanceOf(creature, g.season) + " 生病了，明天不能繁殖，休息一天就会好。";
      }
    } else if (chosen === "神秘蛋") {
      g.flags.eggAvailable = true;
      text = "神秘蛋：雾里滚来一枚温热的蛋，20 雾币可买下（用买蛋），孵出来的雾兽基因未知，稀有性状概率更高。今晚之前有效。";
    } else if (chosen === "横财") {
      const player = rng.choice(["A", "B"]);
      g.players[player].coins += 20;
      text = "横财：" + player + " 在雾里捡到一个旧钱袋，+20 雾币。";
    } else if (chosen === "访客") {
      const commission = addCommission(g.market, rng, g.season, true);
      text = "访客：一位收藏家路过，追加一条高价委托：" + commission.description + "，报酬 " + commission.reward + " 雾币。";
    } else if (chosen === "雾潮") {
      refreshAllMarket(g.market, rng, g.season, function () { return g.nextId(); });
      text = "雾潮：雾气漫过市场，摊位上的雾兽全部换了一批。";
    } else {
      text = "静夜：雾很安，什么也没发生。";
    }
    return "【事件·" + chosen + "】" + text;
  }

  /* ---------------- 图鉴（与 codex.py 相同） ---------------- */
  function makeCodex(season) {
    const traits = {};
    for (const locus in LOCI) {
      for (const name of presentTraits(locus)) traits[name] = { discovered: false, locus: locus };
      const blend = BLEND_TRAITS[locus];
      if (!(blend in traits)) traits[blend] = { discovered: false, locus: locus };
    }
    const species = {};
    for (const base of BASE_ORDER) species[speciesName([base])] = false;
    /* 标本册：按「物种」分页，每个物种下面再按见过的外显性状组合列标本。
       specimens[物种名] = [ {id, day, parents, wild, traits} ... ]（每种性状组合一格）。
       只记外显性状，不写基因型与表达规则。 */
    return { traits: traits, species: species, legendary: season.legendary.slice(), specimens: {} };
  }
  /* 标本册的取法：同一物种、同一组外显性状，只记首次见到的一只。
     旧存档的 specimens[物种] 是单个对象，读到时包成一格的数组。 */
  function specimensOf(codex, sname) {
    if (!codex.specimens) codex.specimens = {};
    const v = codex.specimens[sname];
    if (!v) { codex.specimens[sname] = []; return codex.specimens[sname]; }
    if (Array.isArray(v)) return v;
    codex.specimens[sname] = [v];
    return codex.specimens[sname];
  }
  function codexObserve(codex, creature, season) {
    for (const trait of visibleTraitsOf(creature, season)) {
      if (trait in codex.traits) codex.traits[trait].discovered = true;
    }
    const sname = speciesName(creature.species);
    codex.species[sname] = true;
    const traits = visibleTraitsOf(creature, season).slice();
    const key = traits.join("/");
    const entries = specimensOf(codex, sname);
    for (const e of entries) if (e.traits.join("/") === key) return; // 同一组合已经记过
    entries.push({
      id: creature.id,
      day: creature.bornDay || 1,
      parents: (creature.parents || []).slice(),
      wild: !!creature.wild,
      generation: creature.generation || 1,
      traits: traits
    });
  }
  /* 父母标签：有父母显示真实编号；只有开局的野生个体写「野生」；
     其他无父母的（市场/蛋/流浪/探索来的野雾兽）写「野雾兽」。 */
  function specimenParentsLabel(spec) {
    if (spec.parents && spec.parents.length) return "#" + spec.parents.join(" × #");
    if (spec.wild) return "野生";
    return "野雾兽";
  }
  function codexProgress(codex) {
    const total = Object.keys(codex.traits).length + Object.keys(codex.species).length;
    let found = 0;
    for (const k in codex.traits) if (codex.traits[k].discovered) found++;
    for (const k in codex.species) if (codex.species[k]) found++;
    return [found, total];
  }
  function codexLegendaryRevealed(codex) {
    return codex.legendary.map(function (trait) {
      return (codex.traits[trait] && codex.traits[trait].discovered) ? trait : "???";
    });
  }
  /* 第 1 项修法（第二张修复单）：图鉴不再标表达规则。原先已发现的性状会带
     「显性/隐性/不完全显性/上位」简称，求援提示词原样复制图鉴，等于把玩家要
     推理的规则直接给了出去。现在图鉴只记「见过哪些性状、出现在哪些个体上」
     （性状名 + 有该性状的雾兽编号），表达规则留到季末点「揭晓」才显示
     （renderEnding 里用 ruleDescription）。 */
  function codexRender(codex, season, creatures) {
    const lines = ["【图鉴】"];
    const p = codexProgress(codex);
    lines.push("发现进度：" + p[0] + " / " + p[1]);
    lines.push("");
    lines.push("—— 性状 ——");
    // 每个性状出现在哪些个体上（只算当前在所里的雾兽）
    const seenOn = {};
    if (creatures) {
      for (const c of creatures) {
        for (const t of visibleTraitsOf(c, season)) {
          if (!seenOn[t]) seenOn[t] = [];
          seenOn[t].push("#" + c.id);
        }
      }
    }
    for (const locus in LOCI) {
      let names = presentTraits(locus).slice();
      const blend = BLEND_TRAITS[locus];
      if (names.indexOf(blend) === -1) names.push(blend);
      const rendered = names.map(function (name) {
        const entry = codex.traits[name];
        if (!entry.discovered) return "???";
        const ids = seenOn[name] || [];
        return ids.length ? name + "（" + ids.join("、") + "）" : name;
      });
      lines.push(LOCI[locus].name + "：" + rendered.join(" / "));
    }
    lines.push("");
    lines.push("—— 物种 ——");
    const speciesRendered = [];
    for (const name in codex.species) speciesRendered.push(codex.species[name] ? name : "???");
    lines.push(speciesRendered.join(" / "));
    lines.push("");
    lines.push("—— 传说「雾岛之主」——");
    lines.push("培育出一只同时拥有以下 3 个性状的雾兽：");
    for (const item of codexLegendaryRevealed(codex)) lines.push("  · " + item);
    return lines.join("\n");
  }

  /* ---------------- 游戏主体（与 game.py 相同） ---------------- */
  const MAX_DAYS = 30, ACTIONS_PER_DAY = 2, START_COINS = 50, EGG_PRICE = 20;

  function createGame(seed, rng) {
    // 基因系统用种子单独开 RNG（与 Python 版一致：SeasonGenetics 用 random.Random(seed)）
    const seasonRng = C ? C.RNG(seed) : null;
    const season = new SeasonGenetics(seed, seasonRng);
    const g = {
      seed: seed, season: season, codex: makeCodex(season),
      day: 1, maxDays: MAX_DAYS, current: "A", names: { A: "A", B: "B" },
      players: { A: { creatures: [], coins: START_COINS, ap: ACTIONS_PER_DAY }, B: { creatures: [], coins: START_COINS, ap: ACTIONS_PER_DAY } },
      _nextCreatureId: 1, _nextOfferId: 1, _nextBorrowId: 1,
      market: null, tradeOffers: [], borrowRequests: [], loans: [],
      flags: { fog: false, bountiful: false, eggAvailable: false },
      won: false, winner: null, over: false, legendaryShown: false, log: [], breedLog: [], lastBorn: []
    };
    g.nextId = function () { const id = g._nextCreatureId; g._nextCreatureId += 1; return id; };
    g.market = makeMarket(rng, season, function () { return g.nextId(); });
    for (const p of ["A", "B"]) {
      const creatures = initialCreatures(rng, season, function () { return g.nextId(); }, p);
      g.players[p].creatures.push.apply(g.players[p].creatures, creatures);
      for (const c of creatures) { c.bornDay = 1; codexObserve(g.codex, c, season); }
    }
    return g;
  }
  function displayCreature(g, creature) {
    if (g.flags.fog) {
      let traits = visibleTraitsOf(creature, g.season);
      if (traits.length > 1) traits = traits.slice(0, -1);
      let desc = speciesName(creature.species);
      if (traits.length) desc += "（" + traits.join("、") + "）";
      if (creature.name) desc = creature.name + "·" + desc;
      if (creature.sick) desc += "【生病】";
      return desc;
    }
    return appearanceOf(creature, g.season);
  }
  function findCreature(g, player, cid) {
    for (const c of g.players[player].creatures) if (c.id === cid) return c;
    return null;
  }
  function findAnyCreature(g, cid) {
    for (const p of ["A", "B"]) {
      const c = findCreature(g, p, cid);
      if (c) return [p, c];
    }
    return [null, null];
  }
  function useAp(g, player, cost) {
    cost = cost || 1;
    if (g.players[player].ap < cost) return false;
    g.players[player].ap -= cost;
    return true;
  }
  function addCreature(g, player, creature) {
    creature.owner = player;
    if (!creature.bornDay) creature.bornDay = g.day;
    g.players[player].creatures.push(creature);
    codexObserve(g.codex, creature, g.season);
    checkLegendary(g, player, creature);
  }
  function checkLegendary(g, player, creature) {
    if (g.won) return;
    const traits = visibleTraitsOf(creature, g.season);
    let hasAll = true;
    for (const t of g.season.legendary) if (traits.indexOf(t) === -1) { hasAll = false; break; }
    if (hasAll) {
      g.won = true; g.over = true; g.winner = [player, creature.id];
      g.log.push("传说诞生：" + player + " 培育出雾岛之主！");
    }
  }
  function endTurn(g, player) {
    if (player !== g.current) return "现在不是 " + player + " 的回合。";
    if (g.current === "A") {
      g.current = "B";
      g.players.B.ap = ACTIONS_PER_DAY;
      return "轮到 B 行动。";
    }
    return nightPhase(g);
  }
  function nightPhase(g) {
    const lines = ["—— 夜晚结算 ——"];
    for (const p of ["A", "B"]) for (const c of g.players[p].creatures) c.sick = false;
    g.loans = [];
    g.flags = { fog: false, bountiful: false, eggAvailable: false };
    lines.push(drawEvent(g, g._rng));
    refreshMarket(g.market, g._rng, g.season, function () { return g.nextId(); }, 1);
    refreshCommissions(g.market, g._rng, g.season);
    g.day += 1;
    if (g.day > g.maxDays) {
      g.over = true;
      lines.push("第 " + g.maxDays + " 天结束，本季结束。");
      lines.push(seasonSummary(g));
    } else {
      g.current = "A";
      for (const p of ["A", "B"]) g.players[p].ap = ACTIONS_PER_DAY;
      lines.push("第 " + g.day + " 天开始，轮到 A 行动。");
    }
    return lines.join("\n");
  }
  function seasonSummary(g) {
    const p = codexProgress(g.codex);
    const totalCreatures = g.players.A.creatures.length + g.players.B.creatures.length;
    const totalCoins = g.players.A.coins + g.players.B.coins;
    const score = p[0] * 10 + totalCreatures * 2 + totalCoins;
    const lines = ["【季末结算】"];
    /* 第 2 项修法（第二张修复单）：原先输掉那一季，结算卡会写出三个传说条件名，
       揭晓还折着就已经剧透了。现在结算卡只写“传说达成 X/3”（单只雾兽身上
       最多的传说性状数，不写是哪几个）；条件名只在下面的「揭晓本季真相」里。 */
    let best = 0;
    const all = g.players.A.creatures.concat(g.players.B.creatures);
    for (const c of all) {
      const n = visibleTraitsOf(c, g.season).filter(function (t) { return g.season.legendary.indexOf(t) !== -1; }).length;
      if (n > best) best = n;
    }
    if (g.won) {
      lines.push("胜利！" + g.winner[0] + " 培育出了传说「雾岛之主」（雾兽 #" + g.winner[1] + "）。");
    } else {
      lines.push("本季没有培育出雾岛之主。传说达成 " + best + "/3。");
    }
    lines.push("图鉴：" + p[0] + " / " + p[1] + "；雾兽总数：" + totalCreatures + "；雾币总数：" + totalCoins + "；得分：" + score);
    return lines.join("\n");
  }

  /* ---- 命令（返回中文回复；与 game.py 的 dispatch 相同） ---- */
  function cmdStatus(g, player) {
    const p = g.players[player];
    const lines = ["【" + player + " 的育种所】第 " + g.day + " 天 / " + g.maxDays + " 天 · 雾币 " + p.coins + " · 行动点 " + p.ap];
    if (!p.creatures.length) lines.push("（所里没有雾兽）");
    for (const c of p.creatures) lines.push("  #" + c.id + " " + displayCreature(g, c) + "（第 " + c.generation + " 代）");
    const prog = codexProgress(g.codex);
    lines.push("图鉴进度：" + prog[0] + " / " + prog[1] + "；传说：" + codexLegendaryRevealed(g.codex).join("、"));
    return lines.join("\n");
  }
  function cmdBreed(g, player, id1, id2) {
    const f1 = findAnyCreature(g, id1), f2 = findAnyCreature(g, id2);
    const owner1 = f1[0], c1 = f1[1], owner2 = f2[0], c2 = f2[1];
    if (!c1 || !c2) return "找不到这只雾兽（id 不对）。";
    if (c1 === c2) return "不能和自己繁殖。";
    const loaned = {};
    for (const loan of g.loans) if (loan.borrower === player) loaned[loan.creature_id] = true;
    if (owner1 !== player && !loaned[id1]) return "#" + id1 + " 不是你的，也没有借给你。";
    if (owner2 !== player && !loaned[id2]) return "#" + id2 + " 不是你的，也没有借给你。";
    if (c1.sick || c2.sick) return "有雾兽生病了，今天不能繁殖。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    const nExtra = g.flags.bountiful ? 1 : 0;
    g.flags.bountiful = false;
    let children = breed(c1, c2, g._rng, g.season, function () { return g.nextId(); }, player);
    if (nExtra) {
      const extra = breed(c1, c2, g._rng, g.season, function () { return g.nextId(); }, player);
      children = children.concat(extra.slice(0, 1));
    }
    const lines = [];
    for (const child of children) {
      addCreature(g, player, child);
      lines.push("  诞生 #" + child.id + " " + displayCreature(g, child));
      if (g.won) { lines.push(seasonSummary(g)); return lines.join("\n"); }
    }
    /* 视觉大改：记下最新诞生的后代编号，UI 里用同一套小像展示繁殖结果。 */
    g.lastBorn = children.map(function (ch) { return ch.id; });
    g.breedLog.push("第 " + g.day + " 天：" + player + " 用 #" + id1 + " × #" + id2 + " → " +
      children.map(function (ch) { return "#" + ch.id + " " + appearanceOf(ch, g.season); }).join("、"));
    return "繁殖成功，得到 " + children.length + " 只后代：\n" + lines.join("\n");
  }
  function cmdBorrow(g, player, target, cid) {
    target = (target || "").toUpperCase();
    if (target !== "A" && target !== "B" || target === player) return "借配对象不对（要借对方的雾兽）。";
    if (!findCreature(g, target, cid)) return "对方没有 #" + cid + " 这只雾兽。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    const req = { id: g._nextBorrowId, from: player, to: target, creature_id: cid, status: "pending" };
    g._nextBorrowId += 1;
    g.borrowRequests.push(req);
    return "已向 " + target + " 发出借配请求（#" + req.id + "，借 #" + cid + "），等对方回应。";
  }
  function cmdBorrowAccept(g, player, rid) {
    for (const req of g.borrowRequests) {
      if (req.id === rid && req.to === player && req.status === "pending") {
        req.status = "accepted";
        g.loans.push({ borrower: req.from, owner: player, creature_id: req.creature_id });
        return "已接受借配：" + req.from + " 今天可以用你的 #" + req.creature_id + " 繁殖。";
      }
    }
    return "没有这个待处理的借配请求。";
  }
  function cmdBorrowDecline(g, player, rid) {
    for (const req of g.borrowRequests) {
      if (req.id === rid && req.to === player && req.status === "pending") {
        req.status = "declined";
        return "已拒绝借配请求 #" + rid + "。";
      }
    }
    return "没有这个待处理的借配请求。";
  }
  function cmdBuy(g, player, mid) {
    const item = findMarketItem(g.market, mid);
    if (!item) return "市场没有这个编号。";
    if (g.players[player].coins < item.price) return "雾币不足（需要 " + item.price + "，你有 " + g.players[player].coins + "）。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    g.players[player].coins -= item.price;
    removeMarketItem(g.market, mid);
    const creature = item.creature;
    addCreature(g, player, creature);
    let msg = "买下 #" + creature.id + " " + displayCreature(g, creature) + "，花费 " + item.price + " 雾币。";
    if (g.won) msg += "\n" + seasonSummary(g);
    return msg;
  }
  function cmdSell(g, player, cid) {
    const creature = findCreature(g, player, cid);
    if (!creature) return "你没有 #" + cid + " 这只雾兽。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    const traits = visibleTraitsOf(creature, g.season);
    let price = 10 + 5 * traits.length;
    const rare = traits.filter(function (t) { return g.season.legendary.indexOf(t) !== -1; });
    if (rare.length) price += 10;
    const idx = g.players[player].creatures.indexOf(creature);
    g.players[player].creatures.splice(idx, 1);
    g.players[player].coins += price;
    return "卖出 #" + cid + "，得到 " + price + " 雾币。";
  }
  function cmdTradeOffer(g, player, myId, theirId, coins) {
    if (!findCreature(g, player, myId)) return "你没有 #" + myId + " 这只雾兽。";
    const other = player === "A" ? "B" : "A";
    if (!findCreature(g, other, theirId)) return "对方没有 #" + theirId + " 这只雾兽。";
    if (coins < 0 || coins > g.players[player].coins) return "雾币数量不对（你有 " + g.players[player].coins + "）。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    const offer = { id: g._nextOfferId, from_player: player, to_player: other, offered_id: myId, wanted_id: theirId, coins: coins };
    g._nextOfferId += 1;
    g.tradeOffers.push(offer);
    return "已向 " + other + " 发出交易（#" + offer.id + "）：你的 #" + myId + " 换对方的 #" + theirId + "，另加 " + coins + " 雾币。";
  }
  function cmdTradeAccept(g, player, oid) {
    for (let i = 0; i < g.tradeOffers.length; i++) {
      const offer = g.tradeOffers[i];
      if (offer.id === oid && offer.to_player === player) {
        const myCreature = findCreature(g, player, offer.wanted_id);
        const theirCreature = findCreature(g, offer.from_player, offer.offered_id);
        if (!myCreature || !theirCreature) {
          g.tradeOffers.splice(i, 1);
          return "交易失效：有雾兽已经不在了。";
        }
        if (g.players[offer.from_player].coins < offer.coins) return "对方雾币不足，交易无法完成。";
        g.players[player].creatures.splice(g.players[player].creatures.indexOf(myCreature), 1);
        g.players[offer.from_player].creatures.splice(g.players[offer.from_player].creatures.indexOf(theirCreature), 1);
        myCreature.owner = offer.from_player;
        theirCreature.owner = player;
        g.players[offer.from_player].creatures.push(myCreature);
        g.players[player].creatures.push(theirCreature);
        if (offer.coins) {
          g.players[offer.from_player].coins -= offer.coins;
          g.players[player].coins += offer.coins;
        }
        codexObserve(g.codex, myCreature, g.season);
        codexObserve(g.codex, theirCreature, g.season);
        g.tradeOffers.splice(i, 1);
        checkLegendary(g, player, theirCreature);
        let msg = "交易完成：你用 #" + offer.wanted_id + " 换到了 #" + theirCreature.id + " " + displayCreature(g, theirCreature) + "。";
        if (g.won) msg += "\n" + seasonSummary(g);
        return msg;
      }
    }
    return "没有这个待处理的交易。";
  }
  function cmdTradeDecline(g, player, oid) {
    for (let i = 0; i < g.tradeOffers.length; i++) {
      if (g.tradeOffers[i].id === oid && g.tradeOffers[i].to_player === player) {
        g.tradeOffers.splice(i, 1);
        return "已拒绝交易 #" + oid + "。";
      }
    }
    return "没有这个待处理的交易。";
  }
  function cmdExplore(g, player) {
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    const roll = g._rng.random();
    let msg;
    if (roll < 0.30) {
      const creature = randomCreature(g._rng, g.season, function () { return g.nextId(); }, null, false);
      addCreature(g, player, creature);
      msg = "探索：雾里钻出一只野雾兽，捕捉成功：#" + creature.id + " " + displayCreature(g, creature) + "。";
    } else if (roll < 0.55) {
      g.flags.eggAvailable = true;
      msg = "探索：雾里滚来一枚温热的神秘蛋，20 雾币可买下（用买蛋），孵出来的雾兽稀有性状概率更高。今晚之前有效。";
    } else if (roll < 0.75) {
      g.players[player].coins += 10;
      msg = "探索：雾里捡到 10 雾币。";
    } else {
      msg = "探索：雾茫茫一片，什么也没找到。";
    }
    if (g.won) msg += "\n" + seasonSummary(g);
    return msg;
  }
  function cmdEgg(g, player) {
    if (!g.flags.eggAvailable) return "现在没有神秘蛋（探索或事件有时会带来）。";
    if (g.players[player].coins < EGG_PRICE) return "雾币不足（需要 " + EGG_PRICE + "，你有 " + g.players[player].coins + "）。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    g.players[player].coins -= EGG_PRICE;
    g.flags.eggAvailable = false;
    const creature = randomCreature(g._rng, g.season, function () { return g.nextId(); }, null, true);
    addCreature(g, player, creature);
    let msg = "神秘蛋孵化了：#" + creature.id + " " + displayCreature(g, creature) + "。";
    if (g.won) msg += "\n" + seasonSummary(g);
    return msg;
  }
  function cmdClaim(g, player, cid) {
    let commission = null;
    for (const c of g.market.commissions) if (c.id === cid) { commission = c; break; }
    if (!commission) return "没有这个委托。";
    let match = null;
    for (const creature of g.players[player].creatures) {
      if (commissionMatches(commission, creature, g.season)) { match = creature; break; }
    }
    if (!match) return "你还没有符合「" + commission.description + "」的雾兽。";
    if (!useAp(g, player)) return "行动点不足（每天 2 点），先结束回合。";
    g.players[player].coins += commission.reward;
    removeCommission(g.market, cid);
    addCommission(g.market, g._rng, g.season, false);
    return "完成委托「" + commission.description + "」（用 #" + match.id + "），得到 " + commission.reward + " 雾币。";
  }
  function cmdName(g, player, cid, name) {
    const creature = findCreature(g, player, cid);
    if (!creature) return "你没有 #" + cid + " 这只雾兽。";
    creature.name = name;
    return "已把 #" + cid + " 命名为「" + name + "」。";
  }

  /* ---------------- 存档（JSON，与 Python 的 to_dict/from_dict 对应） ---------------- */
  function gameToJSON(g) {
    return {
      seed: g.seed, rngState: g._rng.getState(),
      day: g.day, maxDays: g.maxDays, current: g.current, names: g.names,
      players: {
        A: { creatures: g.players.A.creatures, coins: g.players.A.coins, ap: g.players.A.ap },
        B: { creatures: g.players.B.creatures, coins: g.players.B.coins, ap: g.players.B.ap }
      },
      nextCreatureId: g._nextCreatureId, nextOfferId: g._nextOfferId, nextBorrowId: g._nextBorrowId,
      market: g.market, tradeOffers: g.tradeOffers, borrowRequests: g.borrowRequests, loans: g.loans,
      flags: g.flags, won: g.won, winner: g.winner, over: g.over, legendaryShown: !!g.legendaryShown,
      season: g.season.toJSON(), codex: { traits: codexTraitsJSON(g.codex), species: g.codex.species, specimens: g.codex.specimens || {} },
      breedLog: g.breedLog, log: g.log.slice(-20), lastBorn: g.lastBorn || []
    };
  }
  function codexTraitsJSON(codex) {
    const out = {};
    for (const k in codex.traits) out[k] = codex.traits[k].discovered;
    return out;
  }
  function gameFromJSON(data, rng) {
    const season = SeasonGenetics.fromJSON(data.season);
    const g = {
      seed: data.seed, season: season,
      codex: { traits: {}, species: data.codex.species, legendary: season.legendary.slice(), specimens: (data.codex && data.codex.specimens) || {} },
      day: data.day, maxDays: data.maxDays, current: data.current, names: data.names,
      players: {
        A: { creatures: data.players.A.creatures, coins: data.players.A.coins, ap: data.players.A.ap },
        B: { creatures: data.players.B.creatures, coins: data.players.B.coins, ap: data.players.B.ap }
      },
      _nextCreatureId: data.nextCreatureId, _nextOfferId: data.nextOfferId, _nextBorrowId: data.nextBorrowId,
      market: data.market, tradeOffers: data.tradeOffers, borrowRequests: data.borrowRequests, loans: data.loans,
      flags: data.flags, won: data.won, winner: data.winner, over: data.over, legendaryShown: !!data.legendaryShown,
      log: data.log || [], breedLog: data.breedLog || [], lastBorn: data.lastBorn || []
    };
    g.nextId = function () { const id = g._nextCreatureId; g._nextCreatureId += 1; return id; };
    g._rng = rng;
    rng.setState(data.rngState);
    for (const locus in LOCI) {
      for (const name of presentTraits(locus)) g.codex.traits[name] = { discovered: !!(data.codex.traits && data.codex.traits[name]), locus: locus };
      const blend = BLEND_TRAITS[locus];
      if (!(blend in g.codex.traits)) g.codex.traits[blend] = { discovered: !!(data.codex.traits && data.codex.traits[blend]), locus: locus };
    }
    return g;
  }

  /* ---------------- 求援提示词：只用已见信息 ----------------
     含：规则、当前天数与回合、两边饲养员的雾兽（只写外显性状）、
     市场（外观+价格）、委托、图鉴进度（??? 保持 ???）、繁殖记录。
     绝不含：基因型、位点规则、传说目标的未揭示性状、未来的事件与市场。
     开头写明“你是饲养员 X”，所以 AI 可以替 X 玩。 */
  function helpPrompt(g, player) {
    player = player || g.current;
    const other = player === "A" ? "B" : "A";
    const lines = [];
    lines.push("我在玩一个文字育种小游戏《雾岛育种所》。你是饲养员 " + player + "，请你帮我玩 " + player + " 的回合，帮我推理和规划，但不要直接替我做决定，也不要猜我没见过的东西。");
    lines.push("");
    lines.push("【规则】");
    lines.push("两人合作育种：一季 30 天，每天每人 2 个行动点。A 行动完换 B，B 结束进入夜晚结算（随机事件、市场轮换）。传说目标：培育出一只同时拥有 3 个稀有性状的雾兽（图鉴里会逐步揭示，已揭示的才看得见）。");
    lines.push("每只雾兽只能看到外显性状，看不到基因型；基因的表达规律每季都不同，要靠繁殖实验自己摸索。繁殖一次产生 1–3 只后代（丰收时 +1）。");
    lines.push("行动：繁殖（1 点，选两只雾兽）、探索（1 点，30% 捉到野雾兽 / 25% 神秘蛋 / 20% 捡 10 雾币 / 其余什么都没有）、买市场雾兽（1 点）、卖雾兽（1 点，价钱看性状数）、完成委托（1 点）、买神秘蛋（20 雾币，1 点，仅当有蛋时）、向对方借雾兽配种（1 点，对方要接受才行）、和对方交易（1 点）、命名（不花点）、结束回合。");
    lines.push("注意：生病的雾兽当天不能繁殖；雾夜时外观会隐藏一个性状；市场只显示外观不显示基因型，买是赌。");
    lines.push("");
    lines.push("【当前状态】");
    lines.push("第 " + g.day + " 天 / 30 天，轮到饲养员 " + g.current + "，行动点 " + g.players[g.current].ap + "。");
    lines.push("A 的雾币 " + g.players.A.coins + "，B 的雾币 " + g.players.B.coins + "。");
    const prog = codexProgress(g.codex);
    lines.push("图鉴进度：" + prog[0] + " / " + prog[1] + "；传说（已揭示的）：" + codexLegendaryRevealed(g.codex).join("、") + "。");
    if (g.flags.eggAvailable) lines.push("现在有神秘蛋可以买（20 雾币）。");
    if (g.flags.fog) lines.push("昨晚是雾夜，今晚外观会隐藏一个性状。");
    lines.push("");
    lines.push("【" + player + " 的雾兽】");
    if (!g.players[player].creatures.length) lines.push("（所里没有雾兽）");
    for (const c of g.players[player].creatures) {
      lines.push("  #" + c.id + " " + displayCreature(g, c) + "（第 " + c.generation + " 代）" + (c.sick ? "【生病】" : ""));
    }
    lines.push("");
    lines.push("【" + other + " 的雾兽（合作方，可见）】");
    if (!g.players[other].creatures.length) lines.push("（所里没有雾兽）");
    for (const c of g.players[other].creatures) {
      lines.push("  #" + c.id + " " + displayCreature(g, c) + "（第 " + c.generation + " 代）" + (c.sick ? "【生病】" : ""));
    }
    lines.push("");
    lines.push("【市场】");
    for (const item of g.market.stock) lines.push("  [" + item.id + "] " + appearanceOf(item.creature, g.season) + " —— " + item.price + " 雾币");
    for (const item of g.market.special) lines.push("  [" + item.id + "] " + appearanceOf(item.creature, g.season) + " —— " + item.price + " 雾币（特售）");
    lines.push("");
    lines.push("【委托】");
    for (const c of g.market.commissions) lines.push("  [" + c.id + "] " + c.description + " —— 报酬 " + c.reward + " 雾币");
    lines.push("");
    lines.push(codexRender(g.codex, g.season, g.players.A.creatures.concat(g.players.B.creatures)));
    if (g.breedLog.length) {
      lines.push("");
      lines.push("【繁殖记录】");
      lines.push(g.breedLog.slice(-12).join("\n"));
    }
    lines.push("");
    lines.push("【请帮我】");
    lines.push("根据上面我已经看到的信息，帮我分析：这回合 " + player + " 最值得做什么（繁殖哪两只、买哪只、做哪个委托）？只用我已经看到的信息推理，不要编造基因型和我没见过的内容。");
    return lines.join("\n");
  }

  /* ---------------- 暴露给测试（Node） ---------------- */
  const API = {
    LOCI: LOCI, BLEND_TRAITS: BLEND_TRAITS, RULES: RULES, MUTATION_RATE: MUTATION_RATE,
    SeasonGenetics: SeasonGenetics, traitName: traitName, allAlleles: allAlleles,
    presentTraits: presentTraits, allPresentTraits: allPresentTraits,
    speciesName: speciesName, makeCreature: makeCreature, visibleTraitsOf: visibleTraitsOf,
    appearanceOf: appearanceOf, breed: breed, randomCreature: randomCreature,
    initialCreatures: initialCreatures,
    makeMarket: makeMarket, addStock: addStock, addSpecial: addSpecial,
    refreshMarket: refreshMarket, refreshAllMarket: refreshAllMarket,
    findMarketItem: findMarketItem, removeMarketItem: removeMarketItem,
    addCommission: addCommission, refreshCommissions: refreshCommissions,
    removeCommission: removeCommission, commissionMatches: commissionMatches,
    EVENT_DEFS: EVENT_DEFS, drawEvent: drawEvent,
    makeCodex: makeCodex, codexObserve: codexObserve, codexProgress: codexProgress,
    specimensOf: specimensOf, specimenParentsLabel: specimenParentsLabel, basesOfName: basesOfName,
    codexLegendaryRevealed: codexLegendaryRevealed, codexRender: codexRender,
    MAX_DAYS: MAX_DAYS, ACTIONS_PER_DAY: ACTIONS_PER_DAY, START_COINS: START_COINS, EGG_PRICE: EGG_PRICE,
    createGame: createGame, displayCreature: displayCreature, findCreature: findCreature,
    findAnyCreature: findAnyCreature, useAp: useAp, addCreature: addCreature,
    checkLegendary: checkLegendary, endTurn: endTurn, nightPhase: nightPhase,
    seasonSummary: seasonSummary,
    cmdStatus: cmdStatus, cmdBreed: cmdBreed, cmdBorrow: cmdBorrow,
    cmdBorrowAccept: cmdBorrowAccept, cmdBorrowDecline: cmdBorrowDecline,
    cmdBuy: cmdBuy, cmdSell: cmdSell, cmdTradeOffer: cmdTradeOffer,
    cmdTradeAccept: cmdTradeAccept, cmdTradeDecline: cmdTradeDecline,
    cmdExplore: cmdExplore, cmdEgg: cmdEgg, cmdClaim: cmdClaim, cmdName: cmdName,
    gameToJSON: gameToJSON, gameFromJSON: gameFromJSON, helpPrompt: helpPrompt
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.FogIsle = API;

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const KEY = "fog-h5-fog-isle";
  let seed = C.seedFromURL();
  let rng = C.RNG(seed);
  let g = null;
  let saved = C.loadState(KEY);
  /* 第 10 项：断点续玩提示。有中途存档且不在结局里，页面顶部显示
     「这一季你玩到第 X 天，继续／从头」；同一会话点过“继续”就不再弹。 */
  let resumePending = false;
  /* 第 5 项修法：原先 !saved.over 会把已结束的局丢掉重开，结局页一刷新就丢。
     现在 over 的局也恢复，render() 会直接停在结局页。 */
  if (saved && saved.seed === seed && saved.season) {
    try { g = gameFromJSON(saved, rng); } catch (e) { g = null; }
    if (g && !g.over && !C.resumeDismissed(KEY) && (g.day > 1 || g.breedLog.length > 0 || (g.log && g.log.length > 0))) {
      resumePending = true;
    }
  }
  if (!g) {
    g = createGame(seed, rng);
    g._rng = rng;
  } else {
    g._rng = rng;
  }
  if (!g.log) g.log = [];
  if (!g.breedLog) g.breedLog = [];
  let selBreed = [];   // 选中的两只繁殖亲本 id
  let selSell = null;  // 选中的出售 id
  let selBorrow = null; // 选中的借配 id（对方的雾兽）
  let selTradeMine = null, selTradeTheirs = null;

  function save() { C.saveState(KEY, gameToJSON(g)); }
  /* 新方案（2026-11-14）：普通雾兽全部回到文字，不画形象。
     图鉴与个体列表只用名字、编号、性状文字，排成标本册的手写登记卡；
     代码画的雾兽与缩略图全部撤掉，只有传说雾兽有亲手画的插画（见 grimoire.html）。 */
  /* 标本册：按「物种」分页，每个物种下面再按见过的外显性状组合列标本。
     顶部是一排物种页签（四个基础物种 + 见过的杂交种 + 传说页）；
     没见过的物种是「？」页签。点页签换页，当前页存在本页变量里。 */
  let specimenTab = null; // 当前物种页（null = 默认第一页）
  function specimenTabs(g) {
    const tabs = [];
    for (const base of BASE_ORDER) {
      const sname = speciesName([base]);
      tabs.push({ name: sname, discovered: !!g.codex.species[sname], count: specimensOf(g.codex, sname).length });
    }
    /* 杂交种：见过才出现（按 BASE_ORDER 排） */
    const seenHybrids = Object.keys(g.codex.species || {}).filter(function (n) {
      return g.codex.species[n] && basesOfName(n).length > 1;
    }).sort();
    for (const n of seenHybrids) tabs.push({ name: n, discovered: true, count: specimensOf(g.codex, n).length });
    return tabs;
  }
  function renderSpecimenBook(g) {
    const html = [];
    const prog = codexProgress(g.codex);
    html.push('<div class="card"><h3>图鉴 · 标本册</h3>');
    html.push('<p class="meta">按物种分页，每种雾兽一页；每页按见过的外显性状组合列手写登记卡——只有名字、编号、性状，没有画像。图鉴 ' + prog[0] + '/' + prog[1] + '。</p>');
    /* 页签 */
    const tabs = specimenTabs(g);
    const firstOpen = tabs.find(function (t) { return t.discovered; });
    if (!specimenTab || (specimenTab !== "legendary" && !tabs.some(function (t) { return t.name === specimenTab && t.discovered; }))) {
      specimenTab = firstOpen ? firstOpen.name : "legendary";
    }
    html.push('<div class="specimen-tabs" role="tablist">');
    for (const t of tabs) {
      const active = specimenTab === t.name;
      html.push('<button class="specimen-tab' + (active ? ' active' : '') + '"' + (t.discovered ? ' data-specimen-tab="' + esc(t.name) + '"' : ' disabled') + '>' +
        (t.discovered ? esc(t.name) + (t.count > 1 ? ' ×' + t.count : '') : '？') + '</button>');
    }
    html.push('<button class="specimen-tab legendary-tab' + (specimenTab === "legendary" ? ' active' : '') + '" data-specimen-tab="legendary">传说</button>');
    html.push('</div>');
    /* 当前页 */
    if (specimenTab === "legendary") {
      html.push(renderLegendaryPage(g));
    } else {
      const sname = specimenTab;
      const entries = specimensOf(g.codex, sname);
      html.push('<div class="specimen-grid">');
      if (!entries.length) {
        /* 已见过物种但标本记录缺失（旧存档）：用现在所里该物种的第一只顶上。 */
        const all = g.players.A.creatures.concat(g.players.B.creatures);
        const first = all.find(function (c) { return speciesName(c.species) === sname; });
        if (first) entries.push({ id: first.id, day: first.bornDay || "—", parents: first.parents || [], wild: !!first.wild, generation: first.generation || 1, traits: visibleTraitsOf(first, g.season) });
      }
      for (const spec of entries) {
        html.push('<div class="specimen"><div class="specimen-label"><div class="hand">');
        html.push('<span class="k">' + esc(sname) + '</span><br>');
        html.push('<span class="k">编号</span> #' + spec.id + '<br>');
        html.push('<span class="k">首次孵出</span> 第 ' + spec.day + ' 天<br>');
        html.push('<span class="k">父母</span> ' + esc(specimenParentsLabel(spec)) + '<br>');
        html.push('<span class="k">外显性状</span> ' + esc((spec.traits || []).join('、') || '—'));
        html.push('</div></div></div>');
      }
      if (!entries.length) {
        html.push('<div class="specimen locked"><div class="specimen-label"><div class="hand"><span class="k">' + esc(sname) + '</span><br>还没见过这种雾兽</div></div></div>');
      }
      html.push('</div>');
    }
    /* 性状记录（文字版）收进折叠，图鉴本体是标本册。 */
    html.push('<details class="reveal" style="margin-top:12px;"><summary>性状记录（文字）</summary><div class="reveal-body"><div class="record">' + esc(codexRender(g.codex, g.season, g.players.A.creatures.concat(g.players.B.creatures))) + '</div></div></details>');
    html.push('</div>');
    return html.join("");
  }
  /* 传说单独一页：未解锁时只是一枚封蜡与一团墨，不提示条件；
     已经培育出来后，这一格变成打开秘卷的入口（插画与手稿都在秘卷页里）。 */
  var WAX_SEAL = '<svg class="wax-seal" viewBox="0 0 100 100" role="img" aria-label="一枚封蜡">' +
    '<path d="M50 10 C68 10 86 24 88 44 C90 56 84 62 88 72 C92 86 78 94 62 92 C50 96 32 94 22 84 C10 74 14 60 10 48 C8 32 22 18 36 14 C42 10 44 10 50 10 Z" fill="#a8382f" stroke="#7d2a20" stroke-width="2"/>' +
    '<path d="M50 30 C58 38 58 52 50 62 C42 52 42 38 50 30 Z" fill="#e8dfc8" opacity="0.85"/>' +
    '<path d="M38 66 C46 70 54 70 62 66" fill="none" stroke="#e8dfc8" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>';
  function renderLegendaryPage(g) {
    const html = [];
    html.push('<div class="specimen legendary"><div class="specimen-label"><div class="hand">');
    html.push('<span class="k">传说</span> 雾岛之主<br>');
    if (g.won && g.winner) {
      html.push('已经培育出来了。雾兽 #' + g.winner[1] + '。<br>');
      html.push('<a class="btn" href="grimoire.html" style="margin-top:10px;">打开秘卷 →</a>');
    } else {
      html.push('<div style="text-align:center; padding:8px 0 2px;">' + WAX_SEAL + '</div>');
      html.push('还没有人见过它。');
    }
    html.push('</div></div></div>');
    return html.join("");
  }
  function render() {
    const root = document.getElementById("game");
    /* 首次培育出传说：墨迹从边缘洇开，转场到独立的秘卷页（不是只弹 toast）。
       记下 legendaryShown 再跳，回来后直接显示结局页，不再重复转场。 */
    if (g.over && g.won && !g.legendaryShown) {
      g.legendaryShown = true;
      save();
      const veil = document.createElement("div");
      veil.className = "ink-veil";
      document.body.appendChild(veil);
      void veil.offsetWidth; // 强制重排，让 .spread 的动画从头播出来
      veil.classList.add("spread");
      setTimeout(function () { location.href = "grimoire.html"; }, 1000);
      /* 万一跳转失败，3 秒后撤掉墨幕、显示结局页，不把玩家晾在黑屏上。 */
      setTimeout(function () {
        const v = document.querySelector(".ink-veil");
        if (v) v.remove();
        renderEnding(document.getElementById("game"));
      }, 3000);
      return;
    }
    if (g.over) { renderEnding(root); return; }
    const p = g.current;
    const me = g.players[p];
    const other = p === "A" ? "B" : "A";
    const html = [];
    // 第 10 项：断点续玩提示
    if (resumePending) {
      html.push('<div class="card"><h3>这一季，你玩到第 ' + g.day + ' 天</h3>');
      html.push('<p>这一季你已经玩到第 ' + g.day + ' 天了。继续接着打，还是从头开始？</p>');
      html.push('<div class="btn-row"><button class="btn" id="btn-resume-continue">继续</button><button class="btn secondary" id="btn-resume-restart">从头开始</button></div></div>');
    }
    // 状态
    html.push('<div class="card"><p class="meta">第 ' + g.day + ' 天 / 30 天 · 轮到饲养员 ' + p + ' · 行动点 ' + me.ap + ' · 雾币 ' + me.coins + '</p>');
    const prog = codexProgress(g.codex);
    html.push('<p class="meta">图鉴 ' + prog[0] + '/' + prog[1] + ' · 传说：' + (g.won ? '已现身' : '未现身') + '</p>');
    if (g.flags.eggAvailable) html.push('<p>🥚 现在有神秘蛋可以买（20 雾币）。</p>');
    if (g.flags.fog) html.push('<p class="meta">昨晚是雾夜，今晚外观会隐藏一个性状。</p>');
    html.push('</div>');
    // 我的雾兽
    html.push('<div class="card"><h3>' + p + ' 的育种所</h3>');
    if (!me.creatures.length) html.push('<p>（所里没有雾兽）</p>');
    me.creatures.forEach(function (c) {
      const sel = selBreed.indexOf(c.id) !== -1 ? " selected" : "";
      html.push('<button class="pick creature-row" data-pick-creature="' + c.id + '"' + (sel ? ' style="border-color:var(--amber-deep);background:#f3e2b8;"' : '') + '><span class="pick-text">#' + c.id + ' ' + esc(displayCreature(g, c)) + '（第 ' + c.generation + ' 代）</span></button> ');
    });
    html.push('<p class="meta">点两只雾兽，再点下面的「繁殖」。点一只，再点「卖出」就是卖它。</p></div>');
    // 对方的雾兽
    html.push('<div class="card"><h3>' + other + ' 的育种所（合作方）</h3>');
    g.players[other].creatures.forEach(function (c) {
      html.push('<span class="pick creature-row" data-pick-borrow="' + c.id + '"><span class="pick-text">#' + c.id + ' ' + esc(displayCreature(g, c)) + '（第 ' + c.generation + ' 代）</span></span> ');
    });
    html.push('<p class="meta">点一只对方的雾兽，再点「借配」就是向对方借它（对方回合要接受才行）。</p></div>');
    // 行动
    html.push('<div class="card"><h3>行动（每回合 2 点）</h3>');
    html.push('<button class="btn" id="act-breed">繁殖选中的两只<span class="hint">1 点 · 产生 1–3 只后代</span></button>');
    html.push('<button class="btn" id="act-explore">探索岛屿<span class="hint">1 点 · 可能捉到野雾兽 / 神秘蛋 / 捡到雾币</span></button>');
    html.push('<button class="btn" id="act-egg"' + (g.flags.eggAvailable ? '' : ' disabled') + '>买神秘蛋<span class="hint">20 雾币 · 1 点 · 仅当有蛋时</span></button>');
    html.push('<button class="btn" id="act-sell">卖出选中的一只<span class="hint">1 点 · 价钱看性状数</span></button>');
    html.push('<button class="btn" id="act-borrow">向对方借选中的雾兽<span class="hint">1 点 · 对方回合要接受</span></button>');
    /* 第 3 项（第二张修复单）：原先逻辑里有「交易」「命名」，界面没有按钮，
       README 却写着已完整移植。现在补上：交易先点自己的一只（出）和对方的一只（要），
       再填另加雾币数；命名先点自己的一只，再写名字（不花行动点）。 */
    html.push('<input class="mini-input" id="trade-coins" type="number" min="0" value="0" placeholder="交易另加雾币（可为 0）">');
    html.push('<button class="btn" id="act-trade">发起交易<span class="hint">1 点 · 先点自己的一只雾兽（出）和对方的一只（要），对方回合接受才成交</span></button>');
    html.push('<input class="mini-input" id="name-input" type="text" maxlength="12" placeholder="给选中的雾兽起个名字">');
    html.push('<button class="btn" id="act-name">命名<span class="hint">不花行动点 · 先点一只自己的雾兽</span></button>');
    html.push('<button class="btn" id="act-end">结束回合 →</button>');
    html.push('</div>');
    // 市场
    html.push('<div class="card"><h3>市场</h3>');
    g.market.stock.forEach(function (item) {
      html.push('<button class="btn secondary" data-buy="' + item.id + '">[' + item.id + '] ' + esc(appearanceOf(item.creature, g.season)) + ' —— ' + item.price + ' 雾币</button>');
    });
    g.market.special.forEach(function (item) {
      html.push('<button class="btn secondary" data-buy="' + item.id + '">[' + item.id + '] ' + esc(appearanceOf(item.creature, g.season)) + ' —— ' + item.price + ' 雾币（特售）</button>');
    });
    html.push('</div>');
    // 委托
    html.push('<div class="card"><h3>委托</h3>');
    g.market.commissions.forEach(function (c) {
      html.push('<button class="btn secondary" data-claim="' + c.id + '">[' + c.id + '] ' + esc(c.description) + ' —— 报酬 ' + c.reward + ' 雾币</button>');
    });
    html.push('</div>');
    // 待处理（借配 / 交易）
    const pending = [];
    for (const req of g.borrowRequests) {
      if (req.status === "pending" && (req.to === p || req.from === p)) {
        pending.push('<p>借配 #' + req.id + '：' + req.from + ' 向 ' + req.to + ' 借 #' + req.creature_id +
          (req.to === p ? ' <button class="pick" data-borrow-accept="' + req.id + '">接受</button> <button class="pick" data-borrow-decline="' + req.id + '">拒绝</button>' : '（等对方回应）') + '</p>');
      }
    }
    for (const offer of g.tradeOffers) {
      if (offer.to_player === p || offer.from_player === p) {
        pending.push('<p>交易 #' + offer.id + '：' + offer.from_player + ' 用 #' + offer.offered_id + ' 换 ' + offer.to_player + ' 的 #' + offer.wanted_id + '（+' + offer.coins + ' 雾币）' +
          (offer.to_player === p ? ' <button class="pick" data-trade-accept="' + offer.id + '">接受</button> <button class="pick" data-trade-decline="' + offer.id + '">拒绝</button>' : '（等对方回应）') + '</p>');
      }
    }
    if (pending.length) html.push('<div class="card"><h3>待处理</h3>' + pending.join("") + '</div>');
    // 图鉴 · 标本册（视觉大改）：每种雾兽一格，像旧博物志的标本插图；
    // 没见过的格子是一片雾里的模糊剪影加「？」；孵出后雾散开、画显出来。
    html.push(renderSpecimenBook(g));
    // 最新诞生：文字登记（名字、编号、代数）
    if (g.lastBorn && g.lastBorn.length) {
      const newborns = [];
      for (const id of g.lastBorn) {
        const found = findAnyCreature(g, id);
        if (found[1]) newborns.push(found[1]);
      }
      if (newborns.length) {
        html.push('<div class="card"><h3>最新诞生</h3><div class="newborn-row">');
        newborns.forEach(function (c) {
          html.push('<div class="newborn"><div class="meta">#' + c.id + ' ' + esc(displayCreature(g, c)) + ' · 第 ' + c.generation + ' 代</div></div>');
        });
        html.push('</div></div>');
      }
    }
    // 日志
    if (g.log.length) {
      html.push('<div class="card"><h3>岛上的事</h3><ul class="log">');
      g.log.slice(-6).forEach(function (l) { html.push('<li>' + esc(l) + '</li>'); });
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
    // 绑定：标本册页签
    root.querySelectorAll("[data-specimen-tab]").forEach(function (b) {
      b.addEventListener("click", function () { specimenTab = b.getAttribute("data-specimen-tab"); render(); });
    });
    // 绑定
    root.querySelectorAll("[data-pick-creature]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = parseInt(b.getAttribute("data-pick-creature"), 10);
        const i = selBreed.indexOf(id);
        if (i !== -1) selBreed.splice(i, 1);
        else { selBreed.push(id); if (selBreed.length > 2) selBreed.shift(); }
        selSell = id;
        render();
      });
    });
    root.querySelectorAll("[data-pick-borrow]").forEach(function (b) {
      b.addEventListener("click", function () {
        selBorrow = parseInt(b.getAttribute("data-pick-borrow"), 10);
        C.toast("已选中对方的 #" + selBorrow + "，点「借配」发出请求。");
      });
    });
    document.getElementById("act-breed").addEventListener("click", function () {
      if (selBreed.length !== 2) { C.toast("先点两只雾兽，再繁殖。"); return; }
      const msg = cmdBreed(g, p, selBreed[0], selBreed[1]);
      g.log.push(msg);
      selBreed = [];
      save(); render();
    });
    document.getElementById("act-explore").addEventListener("click", function () {
      g.log.push(cmdExplore(g, p));
      save(); render();
    });
    const eggBtn = document.getElementById("act-egg");
    if (eggBtn) eggBtn.addEventListener("click", function () {
      g.log.push(cmdEgg(g, p));
      save(); render();
    });
    document.getElementById("act-sell").addEventListener("click", function () {
      if (!selSell) { C.toast("先点一只自己的雾兽，再卖出。"); return; }
      g.log.push(cmdSell(g, p, selSell));
      selSell = null;
      save(); render();
    });
    document.getElementById("act-borrow").addEventListener("click", function () {
      if (!selBorrow) { C.toast("先点一只对方的雾兽，再借配。"); return; }
      g.log.push(cmdBorrow(g, p, other, selBorrow));
      selBorrow = null;
      save(); render();
    });
    // 第 3 项（第二张修复单）：交易与命名按钮的绑定
    document.getElementById("act-trade").addEventListener("click", function () {
      if (!selSell) { C.toast("先点一只自己的雾兽（出的那只），再发起交易。"); return; }
      if (!selBorrow) { C.toast("再点一只对方的雾兽（要的那只），再发起交易。"); return; }
      const coinsEl = document.getElementById("trade-coins");
      const coins = Math.max(0, parseInt((coinsEl && coinsEl.value) || "0", 10) || 0);
      g.log.push(cmdTradeOffer(g, p, selSell, selBorrow, coins));
      selBorrow = null;
      save(); render();
    });
    document.getElementById("act-name").addEventListener("click", function () {
      if (!selSell) { C.toast("先点一只自己的雾兽，再命名。"); return; }
      const nameEl = document.getElementById("name-input");
      const name = ((nameEl && nameEl.value) || "").trim();
      if (!name) { C.toast("先给它写个名字。"); return; }
      g.log.push(cmdName(g, p, selSell, name));
      save(); render();
    });
    document.getElementById("act-end").addEventListener("click", function () {
      const msg = endTurn(g, p);
      g.log.push(msg);
      save(); render();
    });
    root.querySelectorAll("[data-buy]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdBuy(g, p, parseInt(b.getAttribute("data-buy"), 10)));
        save(); render();
      });
    });
    root.querySelectorAll("[data-claim]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdClaim(g, p, parseInt(b.getAttribute("data-claim"), 10)));
        save(); render();
      });
    });
    root.querySelectorAll("[data-borrow-accept]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdBorrowAccept(g, p, parseInt(b.getAttribute("data-borrow-accept"), 10)));
        save(); render();
      });
    });
    root.querySelectorAll("[data-borrow-decline]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdBorrowDecline(g, p, parseInt(b.getAttribute("data-borrow-decline"), 10)));
        save(); render();
      });
    });
    root.querySelectorAll("[data-trade-accept]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdTradeAccept(g, p, parseInt(b.getAttribute("data-trade-accept"), 10)));
        save(); render();
      });
    });
    root.querySelectorAll("[data-trade-decline]").forEach(function (b) {
      b.addEventListener("click", function () {
        g.log.push(cmdTradeDecline(g, p, parseInt(b.getAttribute("data-trade-decline"), 10)));
        save(); render();
      });
    });
  }
  function renderEnding(root) {
    const html = [];
    html.push('<div class="card"><p class="meta">雾岛育种所 · 季末</p>');
    html.push('<h2 class="ending-title">' + (g.won ? "传说诞生" : "本季结束") + '</h2>');
    html.push('<p>' + esc(seasonSummary(g)).replace(/\n/g, "<br>") + '</p>');
    html.push('<span class="stamp pop">' + (g.won ? "已归档" : "暂缓结案") + '</span></div>');
    html.push('<div class="card"><details class="reveal"><summary>揭晓本季真相（密封：打完再看）</summary><div class="reveal-body">');
    html.push('<p>本季的传说条件是：' + esc(g.season.legendary.join("、")) + '。</p>');
    html.push('<p>各性状的表达规则：</p>');
    for (const locus in LOCI) {
      html.push('<p>' + esc(LOCI[locus].name) + '：' + esc(g.season.ruleDescription(locus)) + '</p>');
    }
    html.push('<p class="meta">换种子，基因系统全变，上一季的规律不再适用。</p>');
    html.push('</div></details></div>');
    if (g.won) html.push('<div class="btn-row"><a class="btn" href="grimoire.html">打开秘卷 →</a></div>');
    html.push('<div class="btn-row"><button class="btn" id="btn-again">换一季</button><button class="btn secondary" id="btn-replay">同一季重玩</button></div>');
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
      C.copyText(helpPrompt(g, g.current), "求援提示词已复制，去问你的 AI 吧。");
    });
    /* 第 7 项（第二张修复单）：开局即存档。原先第一次行动之前不存档，
       开局刷新等于重开同一局。现在一进页面就存一次。 */
    save();
    render();
  });
})();

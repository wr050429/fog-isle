/* 《雾汀生物 · 白班与夜班》玩家页
   玩家页只显示：开局手稿（公司地图）、四张角色卡、规则速查、
   d100 骰子、调查笔记本、交班表（可填/导出/导入）、保安登记。
   剧本与真相只活在下面的数据里（供“AI 主持人提示词”拼装），
   页面上绝不主动显示。主持人提示词在内存里拼好、直接复制，不经过页面。
   两种玩法：① 两个人、两台设备——白班把交班表导出成一段文字发给夜班，
   夜班导入；② 一个人玩其中一班，另一班交给 AI 主持人扮演
   （主持人提示词里写清楚）。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const R = (typeof window !== "undefined" && window.FogRPG) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 角色卡（与 CHARACTERS.md 相同） ---------------- */
  const CHARACTERS = [
    { id: "linwan", name: "林晚", role: "白班值班员",
      desc: "雾汀生物的白班值班员，负责白天的日常运转：接待来访、管理饲养室、写交班表。她在公司干了三年，知道很多事，但有些事她不敢写在交班表上。",
      attrs: { 体魄: 45, 敏捷: 50, 观察: 70, 推理: 60, 意志: 55 },
      skills: { 侦查: 70, 聆听: 70, 图书馆: 60, 说服: 65, 潜行: 50, 急救: 45, 机械: 55, 会计: 60 },
      specialty: "交班表：写交班表时，她知道怎么写才能“既交代了、又没把话说死”。主持人可以让她在写交班表时过一次推理，成功可以在表里藏一句只有夜班能看懂的暗示。",
      background: "林晚知道陈默失踪前在查什么——她在陈默的桌上看见过一张字条，上面写着“油不对”。她没敢告诉任何人，也没写在交班表上。她怕写了会被辞退，怕不写会出事。",
      task: "白班玩家的任务：白天处理日常、应付来访（记者、警察、公司主任），晚上写交班表。你写什么，夜班就信什么。你漏了、撒谎了，夜班可能会出事。" },
    { id: "zhouye", name: "周野", role: "夜班值班员",
      desc: "雾汀生物的夜班值班员，负责夜里的安全和饲养室。他只在夜里来，白天发生的事他全不知道，只能靠交班表和保安登记推断。",
      attrs: { 体魄: 65, 敏捷: 60, 观察: 65, 推理: 65, 意志: 60 },
      skills: { 侦查: 70, 聆听: 65, 图书馆: 55, 说服: 55, 潜行: 60, 急救: 60, 机械: 65, 会计: 40 },
      specialty: "夜里：夜里行动时（巡视、处理异常、进饲养室），检定 +10。夜里是他的主场。",
      background: "周野在公司干了五年夜班。他知道雾岛之主夜里会躁动，知道哪扇门会自己开，知道雾会从通风口渗进来。他还知道，白班的交班表有时候不全是真的——但他从来没说破过，因为他也怕。",
      task: "夜班玩家的任务：晚上读交班表 + 保安登记，推断白天发生了什么，处理夜里的异常。你只能靠两份记录和现场，拼出真相。" },
    { id: "bai", name: "白露", role: "记者",
      desc: "雾汀市《雾汀晚报》的记者（和《灯塔熄灭之夜》是同一个人）。她接到陈默家属的电话，说陈默失踪了，公司不肯说实话。她来查。",
      attrs: { 体魄: 40, 敏捷: 55, 观察: 65, 推理: 70, 意志: 50 },
      skills: { 侦查: 65, 聆听: 70, 图书馆: 75, 说服: 70, 潜行: 60, 急救: 35, 机械: 35, 会计: 60 },
      specialty: "挖料：套话、翻旧报纸、找“谁还知道这件事”时，检定 +20。",
      background: "白露一直在查“收件处”的事。她听说雾汀生物和收件处有关系——有几封“无人认领”的信就是从这栋楼寄出去的。她觉得陈默失踪和收件处有关。",
      task: "记者玩家的任务：从外面查。采访员工、要文件、蹲点、跟人。攒够证据，发表文章，揭开秘密。公司会给你假文件、编好的说法，你要分辨哪句是真话。" },
    { id: "gu", name: "顾衡", role: "警察",
      desc: "雾港海关的稽查员（和《灯塔熄灭之夜》是同一个人），这次以警察身份查陈默失踪案。陈默家属报了警，警察局让他来公司问问。",
      attrs: { 体魄: 65, 敏捷: 50, 观察: 60, 推理: 60, 意志: 65 },
      skills: { 侦查: 65, 聆听: 60, 图书馆: 60, 说服: 70, 潜行: 45, 急救: 50, 机械: 40, 会计: 65 },
      specialty: "查账：看账本、货单、收据时，检定 +20。一眼能看出哪笔账对不上。",
      background: "顾衡查过商人老陈三年，一直觉得他的油有问题。他听说老陈最近常来雾汀生物，觉得这次失踪案和老陈有关。他来公司是查案，但他真正想查的是老陈。",
      task: "警察玩家的任务：查陈默失踪案。你有权要求看保安登记、问员工问题、进公司检查。公司必须配合你——表面上。你要从他们的配合里，找出不配合的地方。" }
  ];

  /* ---------------- 手稿（与 HANDOUTS.md 相同） ---------------- */
  const HANDOUTS = [
    { id: "map", title: "公司地图", opening: true,
      text: "雾汀生物 · 公司地图\n\n三楼：饲养室（雾岛之主）· 研究员办公室 · 主任办公室\n二楼：化验室 · 药房 · 会议室\n一楼：大门（保安登记处）· 接待处 · 仓库\n地下室：储藏间 · 锅炉房" },
    { id: "memo", title: "主任的备忘录", opening: false,
      text: "备忘录\n\n陈默请假三天，有事找我。\n\n主任\n\n字迹很新，像是刚写的。日期是今天。" },
    { id: "lab", title: "化验单", opening: false,
      text: "雾汀生物 · 化验单\n\n药品：雾岛之主专用药\n化验结果：有效成分 12%（标准应为 85%）\n\n备注：数字有改过的痕迹。" },
    { id: "note", title: "陈默的字条", opening: false,
      text: "油不对。\n\n只有三个字。字很潦草，像是匆匆写下的。" }
  ];
  /* 保安登记：客观记录，主持人给夜班。页面上直接显示（它是手稿，不是真相）。 */
  const SECURITY_LOG = [
    ["08:00", "林晚进（白班值班员）"],
    ["08:15", "主任进"],
    ["09:00", "老陈进，带一只箱子"],
    ["09:30", "记者白露进（来访，11:00 出）"],
    ["10:00", "警察顾衡进（来访，11:30 出）"],
    ["12:00", "老陈出"],
    ["17:00", "林晚出（白班下班）"],
    ["23:00", "陈默出，带一只箱子"],
    ["23:05", "保安（老陈的人）出，带一只箱子"],
    ["02:00", "有人进 3 号饲养室"]
  ];
  /* 第 4 项（第二张修复单）：交班表列名，窄屏下每格用 data-label 显示列名。 */
  const HANDOVER_COLS = ["时间", "地点", "事件", "处理", "备注"];

  const RULES_SHORT = [
    "检定：掷 1d100，结果 <= 技能值 = 成功；> 技能值 = 失败。",
    "极难成功（大成功）：结果 <= 技能值 / 5。困难成功：结果 <= 技能值 / 2。大失败：结果 96–100。",
    "难度：普通直接掷；困难技能值减半；简单技能值 +20（上限 95）。",
    "幸运：开局 10 点。花 1 点重掷一次自己的检定，或花 2 点把一次失败改成成功（不能改大失败）。整本剧本不补充。",
    "理智：开局 60。遇到“不对劲”的东西做意志检定：成功理智 -1，失败 -1d6，大失败 -1d10。理智到 0 会崩溃，本幕由主持人接管，跑完本幕后恢复到 10。",
    "交班表是白班与夜班之间的唯一通道。白班写什么、漏什么、撒什么谎，夜班全靠交班表 + 保安登记找矛盾。夜班想从交班表里看出破绽，掷推理：成功主持人指出一处矛盾，失败主持人只说“表上看着没什么问题”。",
    "保安登记是客观的，不会撒谎，但它只记“谁、几点、进出、带了什么”，不记“为什么”。夜班可以随时要求看保安登记，不需要检定。",
    "白班玩家在夜里不在场，夜班玩家在白天不在场。两个人只能通过交班表交流，不能直接对话（除非打电话，打电话要过说服，而且电话里说不清）。",
    "三线索原则：每个关键结论至少有三条线索。卡住了，主持人会给新线索。检定失败 = 拿到线索但付出代价，不是“什么都没找到”。"
  ].join("\n");

  const RULES_FULL = "轻量 d100 检定规则，和《灯塔熄灭之夜》同一套底子，多了交班表、保安登记、昼夜循环。\n"
    + "属性：体魄、敏捷、观察、推理、意志（30–80）。技能 = 属性 + 加成，角色卡上已经算好了。常用技能：侦查（观察）、聆听（观察）、图书馆（推理）、说服（意志）、潜行（敏捷）、急救（推理）、机械（推理）、会计（推理，查账）、交涉（意志，谈判）。\n"
    + "检定：掷 1d100，结果 <= 技能值 = 成功；> 技能值 = 失败。大成功：结果 <= 技能值 / 5。困难成功：结果 <= 技能值 / 2。大失败：结果 96–100。对抗：双方各掷一次，比成功程度。难度：普通直接掷；困难技能值减半；简单技能值 +20（上限 95）。\n"
    + "幸运：开局 10 点。花 1 点重掷一次自己的检定，或花 2 点把一次失败改成成功（不能改大失败）。整本剧本不补充。\n"
    + "理智：开局 60。遇到“不对劲”的东西做意志检定：成功理智 -1，失败 -1d6，大失败 -1d10。理智到 0 会崩溃，本幕由主持人接管，跑完本幕后恢复到 10。\n"
    + "交班表（核心规则）：白班在白天结束时写交班表（模板见手稿），栏目：时间、地点、事件、处理、备注。白班可以如实写、漏写、撒谎、写含糊话。主持人要提醒白班：你写的东西，夜班会照着做；你漏了、撒谎了，夜班可能会出事，也可能反过来发现你在撒谎。夜班读交班表，也读保安登记（客观记录，主持人给），对照两份记录找矛盾。夜班想从交班表里看出破绽，掷推理：成功主持人指出一处矛盾，失败主持人只说“表上看着没什么问题”，玩家要自己再想办法。\n"
    + "保安登记：客观的，不会撒谎，但只记“谁、几点、进出、带了什么”，不记“为什么”。夜班可以随时要求看保安登记，不需要检定，直接给。但保安登记只覆盖大门和饲养室门口，别的地方没有登记。\n"
    + "昼夜循环：一局分三幕，每幕分白天和夜里。白天白班玩家行动（处理日常、应付来访、写交班表），记者、警察玩家也在白天行动（从外面调查）。夜里夜班玩家行动（读交班表、查异常、处理饲养室），记者、警察玩家可以在夜里蹲点、跟踪。主持人按“白天 → 夜里 → 白天 → 夜里”的顺序推进。白班在夜里不在场，夜班在白天不在场，两个人只能通过交班表交流——主持人把白班写好的交班表贴给夜班，夜班再行动。两个人不能直接对话（除非打电话，打电话要过说服，而且电话里说不清）。\n"
    + "异常：夜里会发生异常（主持人按剧本安排，或掷骰子决定）：饲养室警报响了、雾岛之主躁动撞笼子、一扇本该锁着的门开了、监控里出现一个不该出现的人影、雾从饲养室的通风口渗进来。夜班要处理异常，处理不好会升级。\n"
    + "三线索原则：每个关键结论至少有三条线索。玩家卡住了，主持人可以：让玩家做一次推理检定（成功给新线索）、让 NPC 主动开口、把已拿到的线索重新讲一遍。检定失败 = 拿到线索但付出代价，不是“什么都没找到”。\n"
    + "战斗：几乎没有战斗。如果玩家非要动手：攻击方掷体魄或敏捷，防守方掷敏捷对抗，胜者造成 1d6 伤害，体魄到 0 倒下，需要急救。主持人有权说“打起来了，但这不是办法”。\n"
    + "两种玩法：① 两个人、两台设备——白班把交班表导出成一段文字发给夜班，夜班导入后读；② 一个人玩其中一班，另一班由主持人（你）扮演：你替另一班写交班表 / 读交班表，并把另一班的行动结果告诉玩家。玩家在开局时会告诉你他是哪种玩法、扮演哪一班。";

  const CHARACTERS_TEXT = CHARACTERS.map(function (ch) {
    const attrs = Object.keys(ch.attrs).map(function (k) { return k + " " + ch.attrs[k]; }).join("、");
    const skills = Object.keys(ch.skills).map(function (k) { return k + " " + ch.skills[k]; }).join("、");
    return "【" + ch.name + " · " + ch.role + "】\n" + ch.desc + "\n属性：" + attrs + "\n技能：" + skills
      + "\n特长：" + ch.specialty + "\n背景：" + ch.background + "\n" + ch.task + "\n幸运 10，理智 60。";
  }).join("\n\n");

  const SCENARIO = "开局：雾汀生物，雾汀市郊的一栋三层楼。白天正常运转，夜里只有夜班值班员。楼里收容着从雾岛育种所孵出来的雾兽，最高机密是雾岛之主，养在三楼的饲养室。昨晚，饲养室的警报响了。今早，研究员陈默失踪了。白班来上班，发现陈默的桌子乱了，饲养室的门开着，雾岛之主躁动不安。主持人按三幕开局。第一幕是白天，第二幕是夜里，第三幕是收网。\n\n"
    + "真相速记：陈默发现雾岛之主快死了。公司一直在给它打一种药，药是从商人老陈那里买的，药是掺了水的，根本不管用。雾岛之主的身体在衰败，陈默发现了，想把证据带出去。陈默昨晚 23:00 带着一只箱子（里面是药瓶、化验单、笔记本）离开公司，想去找记者。他在门口被保安拦下了。保安是老陈的人，把陈默带回了公司，锁在地下室的储藏间。老陈是公司的“供应商”，卖药给公司，药是掺水的。他还用公司的车运东西——油桶里藏着信，寄往收件处，写给陈聿的信。（和《灯塔熄灭之夜》是同一条线。）公司主任知道药是假的，但他不敢说——老陈背后有人，主任怕丢工作，也怕出事。雾岛之主躁动，是因为陈默不见了。它认得陈默的气味，陈默每天都去看它。陈默不在，它就不吃东西、不睡觉。\n\n"
    + "三条主线线索（每条至少三个证据）：1. 药是假的：药瓶标签不对 / 化验单上的数字被改过 / 老陈的账本上有两套账。2. 陈默被关在公司：保安登记说他 23:00 才走、带了一只箱子 / 地下室储藏间的门从外面锁着 / 陈默的箱子在地下室门口。3. 老陈是内鬼：老陈的车夜里来过公司 / 老陈的伙计小五说漏嘴 / 主任的备忘录里写着“老陈的事，别问”。\n\n"
    + "第一幕·白天（白班 + 外来线）：白班玩家你在公司。主任叫你去办公室，说：“陈默今天没来，你替他顶一天。记者和警察可能会来问，你就说‘陈默请假了’，别的多别说。”场景 1 主任办公室：主任给你一张备忘录（主持人发手稿里的备忘录），上面写着“陈默请假三天，有事找我”。检定：侦查（备忘录）成功，发现备忘录上的日期是今天，但字迹很新，像是刚写的；说服（主任）成功，主任说漏嘴，“陈默的事，你别管，管了对你没好处。”场景 2 陈默的桌子：陈默的桌子乱了，抽屉开着，里面有一张字条，上面写着“油不对”（和《灯塔熄灭之夜》里老周的电报是同一句话）。检定：侦查（桌子）成功，在抽屉底下找到一张化验单，上面的数字被改过，改过的痕迹很明显；图书馆（化验单）成功，化验单上的药根本不管用，雾岛之主的身体在衰败。场景 3 记者来了（白露玩家）：记者白露来公司，说陈默家属报了警，她来采访。她问白班玩家：“陈默去哪了？公司为什么不说实话？”白班玩家要决定：说什么？说实话（主任会生气）、撒谎（记者会怀疑）、含糊其辞（记者会继续追问）。检定：说服（记者）——白班玩家想糊弄过去，成功记者暂时走了，但她记下了白班玩家的样子；失败记者看出白班玩家在撒谎，她决定晚上来蹲点。场景 4 警察来了（顾衡玩家）：警察顾衡来公司，说陈默家属报了警，他来问问。他要求看保安登记。白班玩家要决定：给不给看？保安登记是客观的，给了就露馅（登记上写着陈默 23:00 才走，带了一只箱子）。不给看，警察会怀疑。检定：说服（警察）成功，警察暂时走了，但他记下了“这家公司有问题”；失败警察要求立刻看登记，白班玩家不得不给，他看到了陈默 23:00 才走的记录。场景 5 老陈来了：商人老陈下午来公司，送了一批药。他和主任在办公室里谈了很久，出来的时候脸色不好看。检定：聆听（办公室门口）成功，听见老陈说，“陈默的事，你处理好，别让我再来一趟。”侦查（老陈的车）成功，车上有一只油桶，桶底有个夹层。第一幕结束：白班写交班表（主持人给模板）。他写什么，夜班就信什么。主持人提醒白班：你写的东西，夜班玩家会照着做。你漏了、撒谎了，夜班可能会出事，也可能反过来发现你在撒谎。主持人把白班写好的交班表贴给夜班玩家，进入第二幕。\n\n"
    + "第二幕·夜里（夜班 + 外来线）：夜班玩家你来上班。桌上放着白班的交班表和保安登记。你读完，发现不对劲的地方。场景 6 读交班表：夜班玩家读交班表，对照保安登记找矛盾。检定：推理（交班表）成功，主持人指出一处矛盾（比如交班表说“陈默 17:00 下班走了”，保安登记说“陈默 23:00 才走，还带了一只箱子”）；失败主持人只说“表上看着没什么问题”，玩家要自己再想办法。场景 7 饲养室：雾岛之主躁动，撞笼子，不吃东西。饲养室的门开着，地上有一串脚印，通向地下室。检定：侦查（饲养室）成功，发现雾岛之主的食盆里有药渣，药渣的气味不对；急救（雾岛之主）成功，雾岛之主安静下来了，它认得你的气味。理智检定：雾岛之主抬起头看着你，它的眼睛里映着你的影子，但影子比你慢半拍。意志检定，失败理智 -1d6。场景 8 地下室：地下室储藏间的门从外面锁着。门缝里透出一点光，里面有人在敲门，很轻。检定：聆听（储藏间）成功，听见里面有人在说话，声音很虚弱：“是我，陈默……放我出去……”机械（开锁）成功，把门打开，陈默在里面，三天没吃东西，很虚弱，但还活着。陈默说：“药是假的，老陈卖的药是掺水的，雾岛之主快死了。我想把证据带出去，在门口被保安拦下了。箱子……箱子在门口，被他们拿走了。你们要小心，老陈今晚还要来一趟。”场景 9 记者 / 警察夜里蹲点（外来线）：记者白露夜里在公司外面蹲点，看见老陈的车半夜来了，伙计小五搬了几只油桶上车。警察顾衡夜里跟着老陈的车，看见车开向雾港，停在收件处后面的小码头，把油桶交给了收件处的一个夜班值班员。检定：潜行（蹲点）成功，没被发现，拍到了照片；失败被保安发现了，保安把他们赶走了。第二幕结束：夜班玩家救出陈默，或者没救出。主持人记下玩家知道了什么，进入第三幕。\n\n"
    + "第三幕·收网：开场玩家知道了真相，现在他们要决定怎么做，主持人不要替他们决定，只把选择摆出来。选择 A 报警抓老陈：警察顾衡报警，警察来抓老陈。老陈被抓了，药是假的事曝光了，公司主任也被带走了。雾岛之主被送到雾岛育种所，由专业人员照料。结局 A（最好）：老陈被抓，陈默得救，雾岛之主活下来了，公司被整顿。记者白露发表了文章，标题是《雾汀生物的药是假的》。港务局给调查员发了感谢信。选择 B 放走老陈，跟着他：玩家放走老陈，跟着他的车，看他把油桶送到哪里去。老陈的车开向雾汀市，停在收件处后面的小码头。他把油桶交给了收件处的一个夜班值班员——那个人不是陈聿，但他说：“陈聿让我收的。”然后他就走了。结局 B（暗线）：玩家发现收件处还在运转，只是换了地方、换了人。陈聿的去向依然是个谜。主持人可以说“这本剧本结束了，但雾汀的故事还没完。”选择 C 玩家自己处理，不报警：玩家决定不报警，自己和老陈谈判：让老陈交出真药、放了陈默、停止走私，条件是不报警。检定：说服（老陈）成功，老陈答应了，但他说“我只是个中间人，真正的主使还没露面”；失败老陈不认，说玩家没有证据，转身走了。结局 C：老陈走了，药换了，陈默得救了，但走私线还在，主使还没露面。选择 D 玩家什么都不做：玩家决定不插手，让公司自己处理。结局 D：陈默被公司辞退了，理由是“旷工三天”。雾岛之主死了，公司对外说“自然死亡”。记者白露的文章没发出来，被主编压下了。\n\n"
    + "主持人备忘：节奏每幕约 60–90 分钟，玩家卡住了就给线索。白班和夜班两个人不能直接对话，只能通过交班表交流。主持人要控制好信息流：白班写完交班表，主持人贴给夜班，夜班再行动。白班在夜里不在场，夜班在白天不在场。NPC：主任圆滑、怕事；老陈镇定、不到最后不认；小五胆小、一吓就招；陈默虚弱、但说得很清楚；保安沉默、只听老陈的话。骰子：检定失败不要卡死，给线索但加代价。理智只在“雾岛之主的眼睛”和“发现油桶里藏着信”这两个地方做，别滥用。陈聿不要在本剧本里写死。";

  const SEALED = "陈默去哪了：陈默发现药是假的，想把证据（药瓶、化验单、笔记本）带出去，昨晚 23:00 带着一只箱子离开公司，在门口被保安拦下了。保安是老陈的人，把陈默带回公司，锁在地下室的储藏间。陈默还活着，三天没吃东西，很虚弱。\n"
    + "药是怎么回事：老陈卖给公司的药是掺水的，有效成分只有 12%，标准是 85%。雾岛之主的身体在衰败。公司主任知道药是假的，但他不敢说——老陈背后有人，主任怕丢工作，也怕出事。\n"
    + "老陈在干什么：老陈用公司的车运东西。油桶底的夹层里塞着信，寄往收件处，写给陈聿的信。他每个月往雾岛运一趟，桶里都有信。他偷油、卖假药，都是为了掩盖走私——油桶进出频繁，没人会注意多几只桶。\n"
    + "雾岛之主怎么了：雾岛之主躁动，是因为陈默不见了。它认得陈默的气味，陈默每天都去看它。陈默不在，它就不吃东西、不睡觉。它没有攻击性，它只是想念陈默。\n"
    + "信里写了什么：不要在本剧本里揭开。信是写给陈聿的，落款各不相同，内容只有一句话：“灯灭了，别来。”陈聿去了哪里、是谁在给他写信，留给以后的剧本。这是系列的暗线，不要写死。\n"
    + "结局：A（最好）报警抓老陈，陈默得救，雾岛之主活下来了，公司被整顿。B（暗线）放走老陈、跟着他，发现收件处还在运转，只是换了地方、换了人。C 自己和老陈谈判，药换了，陈默得救了，但走私线还在，主使还没露面。D 什么都不做，陈默被辞退，雾岛之主死了，文章没发出来。";

  const GM_DATA = {
    title: "雾汀生物 · 白班与夜班",
    rules: RULES_FULL,
    charactersText: CHARACTERS_TEXT,
    openingHandouts: HANDOUTS.filter(function (h) { return h.opening; }).map(function (h) { return "【" + h.title + "】\n" + h.text; }).join("\n\n")
      + "\n\n【保安登记（夜班读，主持人发）】\n" + SECURITY_LOG.map(function (r) { return r[0] + " " + r[1]; }).join("\n"),
    scenario: SCENARIO,
    sealed: SEALED,
    notes: "节奏每幕约 60–90 分钟，玩家卡住了就给线索。白班和夜班两个人不能直接对话，只能通过交班表交流，主持人要控制好信息流。NPC：主任圆滑、怕事；老陈镇定、不到最后不认；小五胆小、一吓就招；陈默虚弱、但说得很清楚；保安沉默、只听老陈的话。检定失败不要卡死，给线索但加代价。理智只在“雾岛之主的眼睛”和“发现油桶里藏着信”这两个地方做，别滥用。陈聿不要在本剧本里写死。和《灯塔熄灭之夜》的联动：如果玩家跑过灯塔那本，他们会认出“油不对”这句话、老陈、油桶夹层，主持人可以提一句“这句话你好像在哪听过”，但别多说。"
  };

  /* ---------------- 交班表：导出 / 导入 ----------------
     导出格式：【交班表开始】…【交班表结束】，中间每行 “时间 | 地点 | 事件 | 处理 | 备注”。
     夜班把白班发来的文字贴进来，点“导入”，表格就还原出来。 */
  function exportHandover(rows, name, date) {
    const L = [];
    L.push("【交班表开始】");
    L.push("雾汀生物 · 交班表");
    L.push("白班值班员：" + (name || "________"));
    L.push("日期：" + (date || "________"));
    L.push("时间 | 地点 | 事件 | 处理 | 备注");
    for (const r of rows) {
      if (!r[0] && !r[1] && !r[2] && !r[3] && !r[4]) continue;
      L.push([r[0] || "", r[1] || "", r[2] || "", r[3] || "", r[4] || ""].join(" | "));
    }
    L.push("交班人签字：" + (name || "________"));
    L.push("【交班表结束】");
    return L.join("\n");
  }
  function importHandover(text) {
    const start = text.indexOf("【交班表开始】");
    const end = text.indexOf("【交班表结束】");
    const body = (start !== -1 && end !== -1 && end > start) ? text.slice(start, end) : text;
    const rows = [];
    let name = "", date = "";
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      if (t.indexOf("白班值班员：") === 0) { name = t.slice("白班值班员：".length).trim(); continue; }
      if (t.indexOf("日期：") === 0) { date = t.slice("日期：".length).trim(); continue; }
      if (t.indexOf("时间 | 地点") === 0 || t.indexOf("【交班表") === 0 || t.indexOf("雾汀生物") === 0 || t.indexOf("交班人签字") === 0) continue;
      if (t.indexOf("|") !== -1) {
        const parts = t.split("|").map(function (s) { return s.trim(); });
        while (parts.length < 5) parts.push("");
        rows.push(parts.slice(0, 5));
      }
    }
    return { rows: rows, name: name, date: date };
  }

  /* ---------------- 暴露给测试（Node） ---------------- */
  const API = {
    CHARACTERS: CHARACTERS, HANDOUTS: HANDOUTS, SECURITY_LOG: SECURITY_LOG,
    RULES_SHORT: RULES_SHORT, GM_DATA: GM_DATA,
    exportHandover: exportHandover, importHandover: importHandover
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.FogCompanyGame = API;

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const NOTES_KEY = "fog-h5-fog-company-notes";
  const CHAR_KEY = "fog-h5-fog-company-char";
  const HAND_KEY = "fog-h5-fog-company-handouts";
  const MODE_KEY = "fog-h5-fog-company-mode";
  const TABLE_KEY = "fog-h5-fog-company-table";
  const IMPORT_KEY = "fog-h5-fog-company-import";
  let notes = R.loadNotes(NOTES_KEY);
  let myChar = null;
  try { myChar = JSON.parse(localStorage.getItem(CHAR_KEY) || "null"); } catch (e) { myChar = null; }
  let received = {};
  try { received = JSON.parse(localStorage.getItem(HAND_KEY) || "{}"); } catch (e) { received = {}; }
  let mode = "duo";
  try { mode = localStorage.getItem(MODE_KEY) || "duo"; } catch (e) { mode = "duo"; }
  let tableRows = [];
  try { tableRows = JSON.parse(localStorage.getItem(TABLE_KEY) || "[]"); } catch (e) { tableRows = []; }
  if (!tableRows.length) tableRows = [["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]];
  let imported = null;
  try { imported = JSON.parse(localStorage.getItem(IMPORT_KEY) || "null"); } catch (e) { imported = null; }
  let diceLog = [];

  function saveAll() {
    R.saveNotes(NOTES_KEY, notes);
    try {
      localStorage.setItem(CHAR_KEY, JSON.stringify(myChar));
      localStorage.setItem(HAND_KEY, JSON.stringify(received));
      localStorage.setItem(MODE_KEY, mode);
      localStorage.setItem(TABLE_KEY, JSON.stringify(tableRows));
      localStorage.setItem(IMPORT_KEY, JSON.stringify(imported));
    } catch (e) {}
  }
  function receivedHandoutTexts() {
    return HANDOUTS.filter(function (h) { return h.opening || received[h.id]; })
      .map(function (h) { return "【" + h.title + "】\n" + h.text; });
  }
  /* 视觉大改：角色卡小剪影（头肩剪影 + 一件身份配饰，克制、不喧宾夺主） */
  const FC = (typeof window !== "undefined" && window.FogCreature) || null;
  function figureFor(role) {
    if (!FC) return "";
    const map = { "白班值班员": "bun", "夜班值班员": "hood", "记者": "notepad", "警察": "cap" };
    return '<span class="figure-mini">' + FC.figure(map[role] || "cap") + '</span>';
  }
  function render() {
    const root = document.getElementById("game");
    const html = [];
    // 玩法
    html.push('<div class="card"><h3>怎么玩</h3>');
    html.push('<div class="pick-group"><p class="pick-label">玩法</p><div class="pick-options">');
    html.push('<button class="pick' + (mode === "duo" ? ' selected' : '') + '" data-mode="duo">两个人 · 两台设备</button>');
    html.push('<button class="pick' + (mode === "solo" ? ' selected' : '') + '" data-mode="solo">一个人 · 另一班交给 AI 主持人</button>');
    html.push('</div></div>');
    if (mode === "duo") {
      html.push('<p>白班在下面写交班表，点「导出交班表」复制成一段文字，发给夜班；夜班把收到的文字贴进「导入交班表」，表格就还原出来。两个人只能通过交班表交流，不能直接对话。</p>');
    } else {
      html.push('<p>你只扮演其中一班，另一班由 AI 主持人扮演。主持人提示词里已经写清楚了：你替另一班写交班表 / 读交班表，并把另一班的行动结果告诉玩家。点「一键复制 AI 主持人提示词」时，记得先告诉你的 AI 你扮演哪一班。</p>');
    }
    html.push('</div>');
    // 角色卡
    html.push('<div class="card"><h3>选一张角色卡</h3>');
    CHARACTERS.forEach(function (ch) {
      const sel = myChar && myChar.id === ch.id;
      html.push('<button class="btn' + (sel ? '' : ' secondary') + '" data-char="' + ch.id + '">' + figureFor(ch.role) + esc(ch.name) + ' · ' + esc(ch.role) + (sel ? ' ✓ 已选' : '') + '<span class="hint">' + esc(ch.desc) + '</span></button>');
    });
    if (myChar) {
      const ch = CHARACTERS.find(function (x) { return x.id === myChar.id; });
      html.push('<div class="record">' + esc("【" + ch.name + " · " + ch.role + "】\n属性：" +
        Object.keys(ch.attrs).map(function (k) { return k + " " + ch.attrs[k]; }).join("、") +
        "\n技能：" + Object.keys(ch.skills).map(function (k) { return k + " " + ch.skills[k]; }).join("、") +
        "\n特长：" + ch.specialty + "\n背景：" + ch.background + "\n" + ch.task + "\n幸运 10，理智 60。") + '</div>');
    }
    html.push('</div>');
    // 手稿
    html.push('<div class="card"><h3>手稿</h3><p class="meta">开局的公司地图主持人已经发了。其余的等主持人在剧本里发给你之后，再勾选“已拿到”。</p>');
    HANDOUTS.forEach(function (h) {
      if (h.opening) {
        html.push('<div class="record"><span class="r-title">【' + esc(h.title) + '】</span>\n' + esc(h.text) + '</div>');
      } else {
        const got = !!received[h.id];
        html.push('<button class="btn secondary" data-handout="' + h.id + '">[' + esc(h.title) + ']' + (got ? ' ✓ 已拿到' : '（主持人发给你之后点一下）') + '</button>');
      }
    });
    html.push('</div>');
    // 保安登记
    html.push('<div class="card"><h3>保安登记（大门）</h3><p class="meta">客观记录，不会撒谎。但它只记“谁、几点、进出、带了什么”，不记“为什么”。夜班可以随时要求看，不需要检定。</p>');
    html.push('<div class="table-scroll"><table class="typewriter"><thead><tr><th>时间</th><th>进出</th></tr></thead><tbody>');
    SECURITY_LOG.forEach(function (r) {
      html.push('<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>');
    });
    html.push('</tbody></table></div></div>');
    // 交班表
    html.push('<div class="card"><h3>交班表</h3><p class="meta">白班在白天结束时写。写什么、漏什么、撒什么谎，由白班自己决定。写完交给主持人，主持人贴给夜班。</p>');
    if (imported && imported.rows && imported.rows.length) {
      /* 第 5 项（第二张修复单）：导入后，导入的内容直接显示成主表（只读），
         上面的空表隐藏，不再出现“空表 + 下面另一块已导入的表”让人以为没导进去。
         夜班对照保安登记看这张表；想改回空白表点「清除导入」。 */
      html.push('<p class="meta">已导入的交班表' + (imported.name ? '（白班值班员：' + esc(imported.name) + '）' : '') + ' —— 只读，对照保安登记看看吧：</p>');
      html.push('<div class="table-scroll"><table class="paper-table"><thead><tr><th>时间</th><th>地点</th><th>事件</th><th>处理</th><th>备注</th></tr></thead><tbody>');
      imported.rows.forEach(function (row) {
        html.push('<tr>' + row.map(function (c, j) { return '<td data-label="' + HANDOVER_COLS[j] + '">' + esc(c) + '</td>'; }).join("") + '</tr>');
      });
      html.push('</tbody></table></div>');
      html.push('<div class="btn-row"><button class="btn" id="btn-export-imported">导出这份交班表（复制成文字）</button><button class="btn secondary" id="btn-import-clear">清除导入，回到空白表</button></div>');
    } else {
      html.push('<div class="table-scroll"><table class="paper-table"><thead><tr><th>时间</th><th>地点</th><th>事件</th><th>处理</th><th>备注</th></tr></thead><tbody id="handover-body">');
      tableRows.forEach(function (row, i) {
        html.push('<tr>');
        row.forEach(function (cell, j) {
          html.push('<td data-label="' + HANDOVER_COLS[j] + '"><input type="text" data-row="' + i + '" data-col="' + j + '" value="' + esc(cell) + '" placeholder="—"></td>');
        });
        html.push('</tr>');
      });
      html.push('</tbody></table></div>');
      html.push('<div class="btn-row"><button class="btn secondary" id="btn-row-add">加一行</button><button class="btn" id="btn-export">导出交班表（复制成文字）</button></div>');
    }
    html.push('<p class="meta">夜班：把白班发来的文字贴进下面，点「导入」，表格就还原出来。</p>');
    html.push('<textarea id="import-box" rows="4" placeholder="把白班发来的交班表文字贴在这里…"></textarea>');
    html.push('<button class="btn secondary" id="btn-import">导入交班表</button>');
    html.push('</div>');
    // 规则速查
    html.push('<div class="card"><h3>规则速查</h3><div class="record">' + esc(RULES_SHORT) + '</div></div>');
    // d100 骰子
    html.push('<div class="card"><h3>d100 骰子</h3>');
    html.push('<div class="pick-group"><p class="pick-label">检定哪个技能？</p><div class="pick-options" id="dice-skills">');
    const skills = myChar ? CHARACTERS.find(function (x) { return x.id === myChar.id; }).skills : { 侦查: 60, 聆听: 60, 图书馆: 60, 说服: 60, 潜行: 50, 急救: 50, 机械: 50, 会计: 50 };
    Object.keys(skills).forEach(function (s) {
      html.push('<button class="pick" data-skill="' + esc(s) + '" data-val="' + skills[s] + '">' + esc(s) + ' ' + skills[s] + '</button>');
    });
    html.push('</div></div>');
    html.push('<div class="pick-group"><p class="pick-label">难度</p><div class="pick-options" id="dice-diff">');
    html.push('<button class="pick selected" data-diff="normal">普通</button>');
    html.push('<button class="pick" data-diff="hard">困难（技能减半）</button>');
    html.push('<button class="pick" data-diff="easy">简单（技能 +20）</button>');
    html.push('</div></div>');
    html.push('<button class="btn" id="btn-roll">掷骰子</button>');
    if (diceLog.length) {
      html.push('<ul class="log">');
      diceLog.slice(-5).forEach(function (l) { html.push('<li>' + esc(l) + '</li>'); });
      html.push('</ul>');
    }
    html.push('</div>');
    // 调查笔记本
    html.push('<div class="card"><h3>调查笔记本</h3><p class="meta">自己记线索，存在本机浏览器里。求援提示词只会带上这里的内容和已拿到的手稿。</p>');
    html.push('<div style="display:flex;gap:8px;"><input id="note-input" type="text" placeholder="记一条线索…" style="flex:1;min-height:48px;font-size:15px;padding:10px 12px;border:1.5px solid var(--line);border-radius:8px;background:#f6efdd;color:var(--ink);"><button class="btn" id="btn-note-add" style="width:auto;min-width:76px;margin:0;">记下</button></div>');
    if (notes.length) {
      html.push('<ul class="log">');
      notes.forEach(function (n, i) {
        html.push('<li>' + esc(n) + ' <button class="link-btn" data-note-del="' + i + '" style="color:var(--seal);">删</button></li>');
      });
      html.push('</ul>');
    }
    html.push('</div>');
    // 主持人提示词
    html.push('<div class="card"><h3>AI 主持人</h3>');
    html.push('<p>让你的 AI 当主持人带团。点下面的按钮，把完整的剧本 + 真相 + 规则整理成一段提示词，贴给你的 AI。</p>');
    html.push('<p class="meta" style="color:var(--seal);">⚠ 提示词里有剧本和真相，复制后直接粘贴，别细看。</p>');
    html.push('<button class="btn" id="btn-gm">一键复制 AI 主持人提示词</button>');
    html.push('<button class="btn secondary" id="btn-help">复制本回合求援提示词<span class="hint">只含你的笔记和已拿到的手稿，用来问另一个 AI 帮忙推理</span></button>');
    html.push('</div>');
    root.innerHTML = html.join("");
    // 绑定
    root.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-mode");
        saveAll(); render();
      });
    });
    root.querySelectorAll("[data-char]").forEach(function (b) {
      b.addEventListener("click", function () {
        myChar = { id: b.getAttribute("data-char") };
        saveAll(); render();
      });
    });
    root.querySelectorAll("[data-handout]").forEach(function (b) {
      b.addEventListener("click", function () {
        const id = b.getAttribute("data-handout");
        received[id] = !received[id];
        saveAll(); render();
      });
    });
    // 交班表输入（失焦时保存，不重渲染，避免打字被打断）
    root.querySelectorAll("[data-row]").forEach(function (input) {
      input.addEventListener("change", function () {
        const i = parseInt(input.getAttribute("data-row"), 10);
        const j = parseInt(input.getAttribute("data-col"), 10);
        tableRows[i][j] = input.value;
        saveAll();
      });
    });
    const rowAddBtn = document.getElementById("btn-row-add");
    if (rowAddBtn) rowAddBtn.addEventListener("click", function () {
      tableRows.push(["", "", "", "", ""]);
      saveAll(); render();
    });
    const exportBtn = document.getElementById("btn-export");
    if (exportBtn) exportBtn.addEventListener("click", function () {
      const name = myChar ? CHARACTERS.find(function (x) { return x.id === myChar.id; }).name : "";
      C.copyText(exportHandover(tableRows, name, ""), "交班表已复制，发给夜班吧。");
    });
    /* 第 5 项（第二张修复单）：已导入时主表是只读的导入内容，导出它；清除导入回到空白表。 */
    const exportImpBtn = document.getElementById("btn-export-imported");
    if (exportImpBtn) exportImpBtn.addEventListener("click", function () {
      C.copyText(exportHandover(imported.rows, imported.name || "", ""), "交班表已复制，发给下一班吧。");
    });
    const importClearBtn = document.getElementById("btn-import-clear");
    if (importClearBtn) importClearBtn.addEventListener("click", function () {
      imported = null;
      saveAll(); render();
      C.toast("已清除导入，回到空白表。");
    });
    document.getElementById("btn-import").addEventListener("click", function () {
      const box = document.getElementById("import-box");
      const text = (box.value || "").trim();
      if (!text) { C.toast("先把白班发来的交班表文字贴进来。"); return; }
      imported = importHandover(text);
      if (!imported.rows.length) { C.toast("没认出交班表，检查一下贴进来的文字。"); return; }
      saveAll(); render();
      C.toast("交班表已导入，对照保安登记看看吧。");
    });
    let selSkill = null, selDiff = "normal";
    root.querySelectorAll("[data-skill]").forEach(function (b) {
      b.addEventListener("click", function () {
        selSkill = { name: b.getAttribute("data-skill"), val: parseInt(b.getAttribute("data-val"), 10) };
        root.querySelectorAll("[data-skill]").forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
      });
    });
    root.querySelectorAll("[data-diff]").forEach(function (b) {
      b.addEventListener("click", function () {
        selDiff = b.getAttribute("data-diff");
        root.querySelectorAll("[data-diff]").forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
      });
    });
    document.getElementById("btn-roll").addEventListener("click", function () {
      if (!selSkill) { C.toast("先选一个技能。"); return; }
      const r = R.rollD100(selSkill.val, selDiff);
      const line = selSkill.name + "：" + R.rollText(r);
      diceLog.push(line);
      render();
      C.toast(R.rollText(r));
    });
    document.getElementById("btn-note-add").addEventListener("click", function () {
      const input = document.getElementById("note-input");
      const v = (input.value || "").trim();
      if (!v) return;
      notes.push(v);
      saveAll(); render();
    });
    root.querySelectorAll("[data-note-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        notes.splice(parseInt(b.getAttribute("data-note-del"), 10), 1);
        saveAll(); render();
      });
    });
    document.getElementById("btn-gm").addEventListener("click", function () {
      C.copyText(R.buildGMPrompt(GM_DATA), "主持人提示词已复制，直接粘贴给你的 AI，别细看。");
    });
    document.getElementById("btn-help").addEventListener("click", function () {
      const data = { title: "雾汀生物 · 白班与夜班" };
      const handouts = receivedHandoutTexts();
      if (imported && imported.rows && imported.rows.length) {
        handouts.push("【已导入的交班表】\n" + imported.rows.map(function (r) { return r.join(" | "); }).join("\n"));
      }
      handouts.push("【保安登记（大门）】\n" + SECURITY_LOG.map(function (r) { return r[0] + " " + r[1]; }).join("\n"));
      C.copyText(R.buildHelpPrompt(data, notes, handouts), "求援提示词已复制，去问你的 AI 吧。");
    });
  }
  document.addEventListener("DOMContentLoaded", render);
})();

/* 《雾汀跑团 · 灯塔熄灭之夜》玩家页
   玩家页只显示：开局手稿、四张角色卡、规则速查、d100 骰子、调查笔记本。
   剧本与真相只活在下面的数据里（供“AI 主持人提示词”拼装），
   页面上绝不主动显示。主持人提示词在内存里拼好、直接复制，不经过页面。 */
(function () {
  "use strict";
  const C = (typeof window !== "undefined" && window.FogCommon) || null;
  const R = (typeof window !== "undefined" && window.FogRPG) || null;
  const esc = C ? C.esc : function (s) { return String(s); };

  /* ---------------- 角色卡（与 CHARACTERS.md 相同） ---------------- */
  const CHARACTERS = [
    { id: "shen", name: "沈知行", role: "电报员",
      desc: "前雾汀市电报局夜班电报员，因为一封发不出去的电报辞了职，现在靠给人修收音机为生。认识沈小姐（电报局日班），认得雾港所有电报的来路。",
      attrs: { 体魄: 40, 敏捷: 50, 观察: 70, 推理: 65, 意志: 55 },
      skills: { 侦查: 70, 聆听: 75, 图书馆: 65, 说服: 55, 潜行: 50, 急救: 40, 航海: 30, 机械: 60 },
      specialty: "电报：读电报、发报、认发报手法时，检定 +20。能认出“这是谁的手法发的报”。",
      background: "三年前，沈知行值夜班时收到过一封没有落款的电报，只有一句话：“灯灭了，别来。”他到现在也没查出是谁发的。他怀疑和这次灯塔熄灭有关。" },
    { id: "gu", name: "顾衡", role: "海关稽查",
      desc: "雾港海关的稽查员，查走私查了十年。认得码头每一个人、每一批货的来路。商人老陈见了他要绕道走。",
      attrs: { 体魄: 65, 敏捷: 50, 观察: 60, 推理: 60, 意志: 60 },
      skills: { 侦查: 65, 聆听: 60, 图书馆: 60, 说服: 70, 潜行: 45, 急救: 50, 航海: 55, 机械: 40 },
      specialty: "查账：看账本、货单、收据时，检定 +20。一眼能看出哪笔账对不上。",
      background: "顾衡查过商人老陈三年，一直觉得他的油有问题，但每次查都查不出证据。油桶的数对得上，油的质量却总不对。这次灯塔熄了，他觉得机会来了。" },
    { id: "bai", name: "白露", role: "记者",
      desc: "雾汀市《雾汀晚报》的记者，专门写“没人想让你知道的事”。认识林老板（酒馆是她的消息站），也认识收件处的夜班值班员。",
      attrs: { 体魄: 40, 敏捷: 55, 观察: 65, 推理: 70, 意志: 50 },
      skills: { 侦查: 65, 聆听: 70, 图书馆: 75, 说服: 65, 潜行: 60, 急救: 35, 航海: 30, 机械: 35 },
      specialty: "挖料：套话、翻旧报纸、找“谁还知道这件事”时，检定 +20。她总能找到第二个知道内情的人。",
      background: "白露一直在查“收件处”的事——为什么总有人往收件处寄没有收件人的信。她听说这次灯塔熄灭和收件处有关，就自己跑来了。" },
    { id: "ahai", name: "阿海", role: "船员",
      desc: "雾港的船员，在“雾港号”上干了八年。认得雾岛周围每一处暗礁、每一条水路。会开船，会看天气，雾再大也能把船开到雾岛。",
      attrs: { 体魄: 70, 敏捷: 65, 观察: 55, 推理: 45, 意志: 55 },
      skills: { 侦查: 55, 聆听: 60, 图书馆: 40, 说服: 50, 潜行: 55, 急救: 55, 航海: 80, 机械: 55 },
      specialty: "水路：开船、认水路、判断天气和潮汐时，检定 +20。去雾岛的船，只有他敢在雾天开。",
      background: "阿海的船三天前夜里经过雾岛，看见灯塔是黑的。他还看见一艘没有挂灯的小船从灯塔方向划回雾港，船上堆着几只油桶。他没看清划船的人是谁。" }
  ];

  /* ---------------- 手稿（与 HANDOUTS.md 相同） ----------------
     opening 的两份开局就发（页面上显示全文）；
     其余四份主持人按剧本进度发——页面上只显示标题，
     玩家在主持人发给自己之后勾选“已拿到”，求援提示词里才会带上全文。 */
  const HANDOUTS = [
    { id: "telegram", title: "开局电报", opening: true,
      text: "雾汀市立文书收件处转调查员：\n\n雾岛灯塔已熄三夜。守塔人老周三日未复电报。\n港务局请派员赴雾港调查灯塔熄灭原因及老周下落。\n\n港务局 雾港分局" },
    { id: "map", title: "雾汀地图", opening: true,
      text: "            雾岛（海上）\n           /  育种所 · 灯塔\n          /\n         /\n   雾港（码头） ——— 海关 · 电报局 · 仓库 · 酒馆\n        |\n        |  白塔巷\n        |\n   雾汀市（城里） ——— 文书收件处 · 白塔巷 17 号" },
    { id: "last-telegram", title: "灯塔最后的电报", opening: false,
      text: "发报：雾岛灯塔\n时间：三天前 夜 23:40\n内容：油不对。\n\n只有四个字。发报手法和平时不一样。" },
    { id: "no-sender", title: "没有落款的电报", opening: false,
      text: "收报：雾港电报局\n时间：三天前 夜 23:55\n内容：灯灭了，别来。\n\n没有落款。不知道是谁发的。" },
    { id: "log", title: "老周的日志最后一页", opening: false,
      text: "油不对，有人动过油库。今晚去蹲守。\n——老周\n\n字很潦草，像是匆匆写下的。" },
    { id: "letter", title: "油桶里的信", opening: false,
      text: "收件：收件处收\n落款：陈\n\n灯灭了，别来。\n\n信纸很薄，像是匆匆写下的。没有收件人名字，只写着“收件处收”。落款只有一个“陈”字。" }
  ];

  /* ---------------- 规则速查（RULEBOOK.md 的 condensed 版） ---------------- */
  const RULES_SHORT = [
    "检定：掷 1d100，结果 <= 技能值 = 成功；> 技能值 = 失败。",
    "极难成功（大成功）：结果 <= 技能值 / 5。主持人给额外信息或好处。",
    "困难成功：结果 <= 技能值 / 2。",
    "大失败：结果 96–100。主持人给坏结果。",
    "难度：普通直接掷；困难技能值减半；简单技能值 +20（上限 95）。",
    "幸运：开局 10 点。花 1 点重掷一次自己的检定，或花 2 点把一次失败改成成功（不能改大失败）。整本剧本不补充。",
    "理智：开局 60。遇到“不对劲”的东西做意志检定：成功理智 -1，失败 -1d6，大失败 -1d10。理智到 0 会崩溃，本幕由主持人接管，跑完本幕后恢复到 10。",
    "三线索原则：每个关键结论至少有三条线索。卡住了，主持人会给新线索（推理检定、NPC 开口、或把已有线索重新讲一遍）。检定失败 = 拿到线索但付出代价，不是“什么都没找到”。"
  ].join("\n");

  /* ---------------- 主持人提示词用的完整文本（页面上不显示） ---------------- */
  const RULES_FULL = "轻量 d100 检定规则。主持人掷骰子，调查员说行动。\n"
    + "属性：体魄、敏捷、观察、推理、意志（30–80）。技能 = 属性 + 加成，角色卡上已经算好了。\n"
    + "常用技能：侦查（观察）、聆听（观察）、图书馆（推理）、说服（意志）、潜行（敏捷）、急救（推理）、航海（敏捷）、机械（推理）。主持人可以按需加新技能，基础值 = 对应属性的一半。\n"
    + "检定：掷 1d100，结果 <= 技能值 = 成功；> 技能值 = 失败。大成功：结果 <= 技能值 / 5。困难成功：结果 <= 技能值 / 2。大失败：结果 96–100。对抗：双方各掷一次，比成功程度。难度：普通直接掷；困难技能值减半；简单技能值 +20（上限 95）。\n"
    + "幸运：开局 10 点。花 1 点重掷一次自己的检定，或花 2 点把一次失败改成成功（不能改大失败）。整本剧本不补充。\n"
    + "理智：开局 60。遇到“不对劲”的东西做意志检定：成功理智 -1，失败 -1d6，大失败 -1d10。理智到 0 会崩溃，本幕由主持人接管，跑完本幕后恢复到 10。理智不是血条，是“这地方有多不对劲”的刻度。\n"
    + "三线索原则：每个关键结论至少有三条线索。调查员卡住了，主持人可以：让调查员做一次“推理”检定（成功给新线索）、让 NPC 主动开口、把已拿到的线索重新讲一遍。不要让调查员因为一次掷骰失败就卡死。检定失败 = 拿到线索但付出代价（花了更多时间、被人看见了、东西弄坏了），不是“什么都没找到”。\n"
    + "战斗：这本剧本里几乎没有战斗。如果调查员非要动手：攻击方掷体魄或敏捷，防守方掷敏捷对抗，胜者造成 1d6 伤害（体魄 -1d6）。体魄到 0 倒下，需要急救。主持人有权说“打起来了，但这不是办法”。\n"
    + "主持人替所有 NPC 掷骰子，也替调查员掷。骰子结果要公开说出来（“你掷了 42，侦查 60，成功”），别暗掷。";

  const CHARACTERS_TEXT = CHARACTERS.map(function (ch) {
    const attrs = Object.keys(ch.attrs).map(function (k) { return k + " " + ch.attrs[k]; }).join("、");
    const skills = Object.keys(ch.skills).map(function (k) { return k + " " + ch.skills[k]; }).join("、");
    return "【" + ch.name + " · " + ch.role + "】\n" + ch.desc + "\n属性：" + attrs + "\n技能：" + skills
      + "\n特长：" + ch.specialty + "\n背景：" + ch.background + "\n幸运 10，理智 60。";
  }).join("\n\n");

  const SCENARIO = "开局：雾岛的灯塔熄了三夜。港务局发了一封电报到雾汀市，请求派人调查。调查员来到雾港。开局时把开局电报贴给调查员。调查员的目标：查清楚灯塔为什么熄了，老周去了哪里。主持人的目标：让调查员自己拼出真相，别直接告诉他们。\n\n"
    + "真相速记：灯塔的油被人偷了，换成了掺水的油，灯烧不起来就熄了。偷油的是商人老陈，他把偷来的好油卖掉，换成掺水油补回去，账面上看不出来。老周（守塔人）发现了油不对，夜里去油库蹲守，被老陈的人锁进了灯塔地下室的储藏间，他还活着，但三天没吃东西，很虚弱。油桶里还藏着东西：老陈在用油桶走私——桶底夹层里塞着信，是寄往收件处的“无人认领”的信，信是写给陈聿的。（陈聿去了哪里、信里写了什么，不要在本剧本里揭开，留给以后的剧本。这是系列的暗线。）神秘访客（卖便宜油的人）是老陈的同伙。\n\n"
    + "三条主线线索（每条至少三个证据）：1. 油不对：油库的油气味不对 / 油桶底有夹层 / 账本上油的数目对不上。2. 老周失踪：灯塔日志最后一页 / 地下室储藏间的门从外面锁着 / 老周的烟斗掉在油库门口。3. 老陈是贼：有人看见老陈的船夜里去雾岛 / 老陈的账本上有两套账 / 老陈的伙计说漏嘴。\n\n"
    + "第一幕·雾港（码头、海关、电报局、酒馆）：开场调查员下船，雾很大，港务局的人在码头等他们，带到海关办公室。港务局长说灯塔熄了三夜，老周三天没回电报。场景 1 海关办公室：港务局长给调查员看三样东西——灯塔最后三天的电报记录（最后一条是三天前夜里发的，只有四个字“油不对”）、一张油库的出库单（数目对得上）、老周的烟斗（在油库门口捡到的）。检定：侦查（出库单）成功发现出库单上的字迹有两处不一样，像是两个人写的；图书馆（电报记录）成功发现“油不对”这封电报的发报手法和平时不一样，像是有人替老周发的。场景 2 电报局（沈小姐）：沈小姐是日班电报员，说老周每天夜里都会发一封“平安”电报，三天前夜里没发；她还说三天前夜里收到过一封没有落款的电报，只有一句话“灯灭了，别来”（老陈的人发的，吓唬人）。检定：说服（沈小姐）成功，她想起三天前夜里看见一艘没有挂灯的小船从雾岛方向划回来，船上堆着几只油桶；聆听成功，听出她在隐瞒什么，再追问，她说老陈前几天来过电报局，问“老周有没有发过什么奇怪的电报”。场景 3 酒馆（林老板）：林老板说老陈最近手头很宽，请全酒馆的人喝了三天酒；还说老陈的伙计昨晚喝多了，说漏嘴“油桶底下有东西，比油值钱”。检定：说服（林老板）成功，林老板说老陈的伙计叫小五，住在码头边的棚屋里；侦查（酒馆）成功，在角落的桌子底下找到一张揉皱的纸，是油库出库单的一角，上面有个数字被划掉了。场景 4 码头棚屋（小五）：小五是老陈的伙计，住在码头边的棚屋里，一开始什么都不肯说。检定：说服（小五）成功，他说老陈让他夜里去雾岛运油桶，桶很沉，底下有个夹层，他不知道里面是什么，只知道“不能打开看”；潜行（跟在小五后面）成功，看见小五半夜去了一趟油库，出来的时候手里拿着一只空油桶。本幕结束条件：调查员拿到至少两条主线线索，就可以去雾岛了。主持人可以让阿海开船送他们去雾岛。\n\n"
    + "第二幕·雾岛灯塔：开场船靠岸，雾更大了，灯塔黑着，门锁着，周围没有人。场景 5 灯塔外：灯塔的门从外面锁着，窗户关着，地上有一串脚印通向油库。检定：侦查（脚印）成功，脚印有两组，一组是老周的（鞋底有个缺口），一组是别人的，脚印很新，是三天前的；机械（开锁）成功把门锁打开，失败可以从窗户翻进去（敏捷检定），或者去油库找钥匙。场景 6 灯塔内（油库）：油库里堆着油桶，打开一只，油的气味不对——掺了水；有一只油桶的底是活动的，底下有个夹层，里面塞着一封信。检定：侦查（油桶）成功发现油桶底的夹层和信；图书馆（信）成功，信没有收件人，只写着“收件处收”，落款是一个“陈”字，信里只有一句话“灯灭了，别来”（和沈小姐收到的那封电报一模一样）。理智检定：发现油桶里藏着信，意志检定，失败理智 -1d6。场景 7 灯塔内（值班室）：值班室里有老周的日志，最后一页写着“油不对，有人动过油库。今晚去蹲守。——老周”，桌上有一盏熄了的油灯，旁边有一只空油桶。检定：侦查（值班室）成功，在桌子底下找到老周的烟斗，烟斗是摔碎的，像是被人打掉的；聆听成功，听见地下室有很轻的敲击声，像是有人在求救。场景 8 地下室储藏间：地下室储藏间的门从外面锁着，打开后老周躺在里面，三天没吃东西，很虚弱，但还活着。老周说：“是老陈。他偷油，换成掺水的。我夜里去蹲守，被他的人从后面打晕了，醒来就在这儿了。油桶里……油桶里有信，是寄给收件处的。我不知道信里写了什么，我只知道老陈每个月都往雾岛运一趟，桶里都有信。”检定：急救（老周）成功，老周缓过来了，能多说两句：“老陈的船今晚还要来一趟，运最后一批油桶。你们要是想抓他，今晚就别走。”\n\n"
    + "第三幕·收网：开场调查员知道了真相，现在他们要决定怎么做，主持人不要替他们决定，只把选择摆出来。选择 A 今晚在灯塔蹲守，等老陈的船来：老陈的船半夜靠岸，伙计小五和另外两个人搬油桶上船。检定：潜行（躲起来）成功没被发现，可以等他们搬完再动手，失败被发现了，对方有三个人，调查员要决定是动手还是谈判。对质：说服（老陈）成功，老陈认了，说他只是个中间人，信是有人让他运的，他不知道写信的人是谁，只知道“收件处收”；失败老陈不认，说调查员没有证据。检定：侦查（油桶）成功，在老陈船上的油桶里找到更多信，都是写给陈聿的，落款各不相同。结局 A（最好）：抓到老陈，救出老周，灯塔重新点亮，信被调查员收起来交给收件处（或自己留着），港务局给调查员发了感谢信，雾散了。选择 B 直接回雾港，找港务局抓人：港务局派人去抓老陈，但老陈听到风声，船已经开走了，只抓到小五，小五什么都招了，但信已经被老陈带走了。结局 B：老陈跑了，信没了，但老周得救了，灯塔重新点亮，港务局说“案子结了”，但调查员知道还有一半真相在海上。选择 C 调查员自己去追老陈的船：阿海开船去追（航海检定），成功追上了，在海上对峙，失败雾太大了跟丢了。追上后老陈把信扔进了海里，说“你们永远别想知道写了什么”。结局 C：信沉了，老陈被抓了，但最关键的东西没了。选择 D 调查员放走了老陈：如果调查员觉得“老陈只是个中间人，真正的主使还没露面”，可以选择放他走、跟着他，看他把信送到哪里去。主持人：老陈的船开向雾汀市，停在收件处后面的小码头，他把信交给了收件处的一个夜班值班员——那个人不是陈聿，但他说“陈聿让我收的”，然后他就走了。结局 D（暗线）：调查员发现收件处还在运转，只是换了地方、换了人，陈聿的去向依然是个谜。主持人可以说“这本剧本结束了，但雾汀的故事还没完。”\n\n"
    + "主持人备忘：节奏每幕约 40–60 分钟，调查员卡住了就给线索。NPC 怎么演：沈小姐紧张、话多；林老板圆滑、什么都知道一点；小五胆小、一吓就招；老陈镇定、不到最后不认；老周虚弱、但说得很清楚。骰子：检定失败不要卡死，给线索但加代价。理智：只在“发现油桶里藏着信”和“发现老陈的船”这两个地方做理智检定，别滥用。陈聿：不要在本剧本里写死陈聿去了哪里、信里写了什么，信是钩子，不是答案，留给以后的剧本。";

  const SEALED = "谁干的：商人老陈偷了灯塔的油，换成掺水油，好油拿去卖了。他的伙计小五和神秘访客（卖便宜油的人）是同伙。\n"
    + "为什么：老陈在用油桶走私。油桶底的夹层里塞着信，是寄往收件处的、写给陈聿的信。老陈每个月往雾岛运一趟，桶里都有信。他偷油是为了掩盖走私——油桶进出频繁，没人会注意多几只桶。\n"
    + "老周在哪：灯塔地下室储藏间，被老陈的人打晕后锁在里面。还活着，三天没吃东西，很虚弱。他夜里去油库蹲守，发现了油不对。\n"
    + "信里写了什么：不要在本剧本里揭开。信是写给陈聿的，落款各不相同，内容只有一句话：“灯灭了，别来。”陈聿去了哪里、是谁在给他写信，留给以后的剧本。这是系列的暗线，不要写死。\n"
    + "结局：A（最好）蹲守抓到老陈，救出老周，灯塔重新点亮，信被收起来。B 回雾港报官，老陈跑了，信没了，老周得救，灯塔重新点亮。C 追船，信被老陈扔进海里，老陈被抓，真相沉了。D（暗线）放走老陈、跟着他，发现收件处还在运转，只是换了地方、换了人。";

  const GM_DATA = {
    title: "雾汀跑团 · 灯塔熄灭之夜",
    rules: RULES_FULL,
    charactersText: CHARACTERS_TEXT,
    openingHandouts: HANDOUTS.filter(function (h) { return h.opening; }).map(function (h) { return "【" + h.title + "】\n" + h.text; }).join("\n\n"),
    scenario: SCENARIO,
    sealed: SEALED,
    notes: "节奏每幕约 40–60 分钟，调查员卡住了就给线索（见规则书第五节）。NPC：沈小姐紧张、话多；林老板圆滑、什么都知道一点；小五胆小、一吓就招；老陈镇定、不到最后不认；老周虚弱、但说得很清楚。检定失败不要卡死，给线索但加代价。理智只在“发现油桶里藏着信”和“发现老陈的船”这两个地方做，别滥用。陈聿不要在本剧本里写死。"
  };

  /* ---------------- 暴露给测试（Node） ---------------- */
  const API = { CHARACTERS: CHARACTERS, HANDOUTS: HANDOUTS, RULES_SHORT: RULES_SHORT, GM_DATA: GM_DATA };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.FogRPGGame = API;

  /* ---------------- 浏览器 UI ---------------- */
  if (typeof document === "undefined") return;
  const NOTES_KEY = "fog-h5-fog-rpg-notes";
  const CHAR_KEY = "fog-h5-fog-rpg-char";
  const HAND_KEY = "fog-h5-fog-rpg-handouts";
  let notes = R.loadNotes(NOTES_KEY);
  let myChar = null;
  try { myChar = JSON.parse(localStorage.getItem(CHAR_KEY) || "null"); } catch (e) { myChar = null; }
  let received = {};
  try { received = JSON.parse(localStorage.getItem(HAND_KEY) || "{}"); } catch (e) { received = {}; }
  let diceLog = [];

  function saveAll() {
    R.saveNotes(NOTES_KEY, notes);
    try { localStorage.setItem(CHAR_KEY, JSON.stringify(myChar)); } catch (e) {}
    try { localStorage.setItem(HAND_KEY, JSON.stringify(received)); } catch (e) {}
  }
  function receivedHandoutTexts() {
    return HANDOUTS.filter(function (h) { return h.opening || received[h.id]; })
      .map(function (h) { return "【" + h.title + "】\n" + h.text; });
  }
  /* 视觉大改：角色卡小剪影（头肩剪影 + 一件身份配饰，克制、不喧宾夺主） */
  const FC = (typeof window !== "undefined" && window.FogCreature) || null;
  function figureFor(role) {
    if (!FC) return "";
    const map = { "电报员": "headset", "海关稽查": "cap", "记者": "notepad", "船员": "sailor" };
    return '<span class="figure-mini">' + FC.figure(map[role] || "cap") + '</span>';
  }
  function render() {
    const root = document.getElementById("game");
    const html = [];
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
        "\n特长：" + ch.specialty + "\n背景：" + ch.background + "\n幸运 10，理智 60。") + '</div>');
    }
    html.push('</div>');
    // 手稿
    html.push('<div class="card"><h3>手稿</h3><p class="meta">开局的两份主持人已经发了。其余的等主持人在剧本里发给你之后，再勾选“已拿到”。</p>');
    HANDOUTS.forEach(function (h) {
      if (h.opening) {
        html.push('<div class="record"><span class="r-title">【' + esc(h.title) + '】</span>\n' + esc(h.text) + '</div>');
      } else {
        const got = !!received[h.id];
        html.push('<button class="btn secondary" data-handout="' + h.id + '">[' + esc(h.title) + ']' + (got ? ' ✓ 已拿到' : '（主持人发给你之后点一下）') + '</button>');
      }
    });
    html.push('</div>');
    // 规则速查
    html.push('<div class="card"><h3>规则速查</h3><div class="record">' + esc(RULES_SHORT) + '</div></div>');
    // d100 骰子
    html.push('<div class="card"><h3>d100 骰子</h3>');
    html.push('<div class="pick-group"><p class="pick-label">检定哪个技能？</p><div class="pick-options" id="dice-skills">');
    const skills = myChar ? CHARACTERS.find(function (x) { return x.id === myChar.id; }).skills : { 侦查: 60, 聆听: 60, 图书馆: 60, 说服: 60, 潜行: 50, 急救: 50, 航海: 50, 机械: 50 };
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
      const data = { title: "雾汀跑团 · 灯塔熄灭之夜" };
      C.copyText(R.buildHelpPrompt(data, notes, receivedHandoutTexts()), "求援提示词已复制，去问你的 AI 吧。");
    });
  }
  document.addEventListener("DOMContentLoaded", render);
})();

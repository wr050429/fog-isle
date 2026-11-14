// 雾系列 H5 · jsdom 渲染测试（视觉大改）
// 跑：node ~/workspace/fog-h5/tests/render-test.js（需先起 http.server 8811，见 tests/README）
// 每个页面在 390px 宽下加载：无 JS 报错、底图挂上、关键内容出现、横向不溢出。
const { JSDOM } = require("jsdom");
global.window = {};
require(__dirname + "/../assets/common.js");
const C = global.window.FogCommon;
const isle = require(__dirname + "/../fog-isle/game.js");
const BASE = "http://127.0.0.1:8811/";
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL " + label); }
}
async function load(path, width, height) {
  const errors = [];
  const dom = await JSDOM.fromURL(BASE + path, {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.onerror = function (msg) { errors.push(String(msg)); };
      // 默认 390px 手机视口；传宽高可测桌面
      Object.defineProperty(window, "innerWidth", { value: width || 390, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: height || 844, configurable: true });
    }
  });
  // 等脚本跑完（localStorage、渲染都是同步的，留 300ms 给动画/定时器）
  await new Promise(r => setTimeout(r, 400));
  return { dom, errors };
}
function noOverflow(dom, label) {
  const doc = dom.window.document;
  const sw = doc.documentElement.scrollWidth;
  const bw = doc.body ? doc.body.scrollWidth : 0;
  ok(sw <= 391 && bw <= 391, label + " 横向不溢出（scrollWidth " + sw + " / body " + bw + "）");
}
(async function () {
  // ---- 入口页：整幅地图 + 6 个灯点 ----
  {
    const { dom, errors } = await load("index.html");
    const doc = dom.window.document;
    ok(errors.length === 0, "入口页无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelector("#map-holder svg.map-svg"), "入口页整幅地图 SVG 挂上");
    ok(doc.querySelector("#map-holder svg").getAttribute("viewBox") === "0 0 800 1200", "390px 下挂的是手机竖版地图");
    ok(doc.querySelector("#map-holder").classList.contains("map-bg"), "地图是整页背景（.map-bg）");
    const points = doc.querySelectorAll(".lamp-point");
    ok(points.length === 6, "入口地图 6 个灯点（" + points.length + " 个）");
    const hrefs = Array.from(points).map(p => p.getAttribute("data-href"));
    ok(hrefs.includes("fog-isle/index.html") && hrefs.includes("fog-company/index.html"), "灯点指向六个游戏");
    ok(doc.querySelectorAll(".map-drawer-list a").length === 6, "底部抽屉有 6 个游戏入口");
    ok(!doc.querySelector(".map-list"), "旧卡片列表已撤掉");
    noOverflow(dom, "入口页");
  }
  // ---- 入口页（桌面 1280×800）：横幅地图 + 6 个灯点 ----
  {
    const { dom, errors } = await load("index.html", 1280, 800);
    const doc = dom.window.document;
    ok(errors.length === 0, "入口页（桌面）无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelector("#map-holder svg").getAttribute("viewBox") === "0 0 1280 800", "桌面挂的是横幅地图");
    ok(doc.querySelectorAll(".lamp-point").length === 6, "入口地图（桌面）6 个灯点");
    noOverflow(dom, "入口页（桌面）");
  }
  // ---- 六个游戏页：底图 + 无报错 + 不溢出 ----
  const pages = [
    ["baita-lane/index.html", "白塔巷"],
    ["fog-harbor/index.html", "电报局"],
    ["lighthouse/index.html", "灯塔"],
    ["fog-isle/index.html", "育种所"],
    ["fog-rpg/index.html", "灯塔熄灭之夜"],
    ["fog-company/index.html", "雾汀生物"]
  ];
  for (const [path, name] of pages) {
    const { dom, errors } = await load(path);
    const doc = dom.window.document;
    ok(errors.length === 0, name + "页无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    const bd = doc.querySelector("#backdrop");
    ok(bd && bd.querySelector("svg"), name + "页底图 SVG 挂上");
    ok(bd && bd.querySelector(".bd-shade") && bd.querySelector(".bd-fog"), name + "页底图有压暗 + 飘雾层");
    ok(doc.querySelector(".hero"), name + "页首屏是底图主视觉（.hero）");
    ok(!doc.querySelector(".cover"), name + "页卡片里的旧封面已删");
    noOverflow(dom, name + "页");
  }
  // ---- 育种所：标本册 + 小像（seed=1 开局只解锁 2 种，正好有未解锁格） ----
  {
    const { dom, errors } = await load("fog-isle/index.html?seed=1");
    const doc = dom.window.document;
    ok(errors.length === 0, "育种所（seed=1）无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelector(".specimen-tabs"), "育种所标本册有物种页签");
    ok(doc.querySelector(".specimen-grid"), "育种所标本册网格出现");
    const specimens = doc.querySelectorAll(".specimen");
    ok(specimens.length >= 1, "当前物种页有登记卡（" + specimens.length + " 张）");
    ok(doc.querySelectorAll(".specimen-art").length === 0, "登记卡没有画框（普通雾兽只用文字）");
    ok(doc.querySelectorAll(".creature-thumb").length === 0, "页面上没有任何雾兽小像");
    ok(doc.body.textContent.indexOf("图鉴 · 标本册") !== -1, "图鉴标题是标本册");
    // 登记卡标签：编号、首次孵出、父母、外显性状（手写体）
    const label = doc.querySelector(".specimen .hand");
    ok(label && /编号/.test(label.textContent) && /首次孵出/.test(label.textContent) && /父母/.test(label.textContent),
      "登记卡有编号/首次孵出/父母");
    // 图鉴不写规则标签
    ok(!/（显性）|（隐性）|（不完全显性）|（上位）/.test(doc.querySelector(".specimen-grid").textContent),
      "标本册不写规则标签");
    // 传说页签：点开是封蜡，不提示条件
    const legTab = doc.querySelector('[data-specimen-tab="legendary"]');
    ok(legTab, "有传说页签");
    if (legTab) {
      legTab.click();
      await new Promise(r => setTimeout(r, 200));
      ok(doc.querySelector(".wax-seal"), "传说格未解锁是一枚封蜡");
      const legCard = doc.querySelector(".specimen.legendary");
      ok(legCard && legCard.textContent.indexOf("条件") === -1, "传说格不提示条件");
      ok(legCard && /还没有人见过它/.test(legCard.textContent), "传说格写着还没人见过它");
    }
    noOverflow(dom, "育种所页");
  }
  // ---- 育种所：繁殖出新雾兽后，最新诞生有小像 ----
  {
    const { dom, errors } = await load("fog-isle/index.html?seed=7");
    const doc = dom.window.document;
    const win = dom.window;
    // 点两只雾兽再点繁殖（用页面自己的按钮）
    const picks = doc.querySelectorAll("[data-pick-creature]");
    if (picks.length >= 2) {
      picks[0].click(); picks[1].click();
      const breed = doc.querySelector("#act-breed");
      if (breed) breed.click();
      await new Promise(r => setTimeout(r, 200));
      const newborn = doc.querySelector(".newborn-row");
      ok(newborn && /#\d+/.test(newborn.textContent), "繁殖后最新诞生是文字登记（有编号）");
      ok(!doc.querySelector(".newborn .creature-thumb"), "最新诞生没有小像");
      const log = doc.body.textContent;
      ok(/繁殖成功/.test(log), "繁殖成功有提示");
    } else {
      ok(false, "繁殖测试：没找到两只可点雾兽");
    }
    noOverflow(dom, "育种所繁殖后");
    win.close();
  }
  // ---- 跑团角色卡：小剪影 ----
  {
    const { dom, errors } = await load("fog-rpg/index.html");
    const doc = dom.window.document;
    ok(errors.length === 0, "跑团页无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelectorAll(".figure-mini svg").length >= 4, "跑团角色卡有小剪影（" + doc.querySelectorAll(".figure-mini svg").length + " 个）");
    noOverflow(dom, "跑团页");
  }
  // ---- 电报局：嫌疑人小剪影 ----
  {
    const { dom, errors } = await load("fog-harbor/index.html");
    const doc = dom.window.document;
    ok(errors.length === 0, "电报局页无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelectorAll("#pick-person .figure-mini svg").length === 5, "电报局 5 个嫌疑人有小剪影");
    noOverflow(dom, "电报局页");
  }
  // ---- 秘卷页（未解锁）：门禁，只显示封蜡页，不露图不露字 ----
  {
    const { dom, errors } = await load("fog-isle/grimoire.html");
    const doc = dom.window.document;
    ok(errors.length === 0, "秘卷页（未解锁）无 JS 报错" + (errors.length ? "：" + errors.join(" | ") : ""));
    ok(doc.querySelector(".wax-seal"), "秘卷页未解锁是一枚封蜡");
    ok(!doc.querySelector(".grimoire-main img"), "秘卷页未解锁不露插画");
    ok(!doc.querySelector(".grimoire-text"), "秘卷页未解锁没有手稿文字卡");
    ok(doc.querySelector("#grimoire-body").textContent.indexOf("还没有人见过它") !== -1, "秘卷页未解锁写着还没人见过它");
    ok(doc.querySelector('.grimoire a[href="index.html"]'), "秘卷页能返回育种所");
    ok(doc.querySelector(".ink-veil"), "秘卷页有墨散开进场效果");
    const bd = doc.querySelector("#backdrop");
    ok(bd && bd.querySelector("svg"), "秘卷页底图 SVG 挂上");
    noOverflow(dom, "秘卷页（未解锁）");
  }
  // ---- 秘卷页（已解锁，won 存档）：插画与手稿文字出现 ----
  {
    const rng = C.RNG(7);
    const g = isle.createGame(7, rng); g._rng = rng;
    g.won = true; g.over = true; g.winner = ["A", g.players.A.creatures[0].id]; g.legendaryShown = true;
    const savedJSON = JSON.stringify(isle.gameToJSON(g));
    const errors2 = [];
    const dom = await JSDOM.fromURL(BASE + "fog-isle/grimoire.html", {
      resources: "usable",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.onerror = function (msg) { errors2.push(String(msg)); };
        window.localStorage.setItem("fog-h5-fog-isle", savedJSON);
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const doc = dom.window.document;
    ok(errors2.length === 0, "秘卷页（已解锁）无 JS 报错");
    const main = doc.querySelector(".grimoire-main img");
    ok(main && main.getAttribute("src").indexOf("grimoire-main.webp") !== -1, "秘卷页已解锁有竖幅大图");
    ok(doc.querySelectorAll(".grimoire-details img").length === 2, "秘卷页已解锁有两张局部草图");
    ok(doc.querySelector(".grimoire-text") && doc.querySelector(".grimoire-text").textContent.indexOf("雾最浓的那一夜") !== -1, "秘卷页已解锁有手稿体文字");
    ok(!doc.querySelector(".wax-seal"), "秘卷页已解锁不再是封蜡页");
    noOverflow(dom, "秘卷页（已解锁）");
    dom.window.close();
  }
  // ---- 首次培育出传说：进页面就墨迹转场（不是只弹 toast） ----
  {
    // Node 里造一个已赢、还没看过秘卷的存档，预置进 localStorage 再加载页面
    const rng = C.RNG(7);
    const g = isle.createGame(7, rng); g._rng = rng;
    g.won = true; g.over = true; g.winner = ["A", g.players.A.creatures[0].id]; g.legendaryShown = false;
    const savedJSON = JSON.stringify(isle.gameToJSON(g));
    const errors2 = [];
    const dom = await JSDOM.fromURL(BASE + "fog-isle/index.html?seed=7", {
      resources: "usable",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.onerror = function (msg) { errors2.push(String(msg)); };
        window.localStorage.setItem("fog-h5-fog-isle", savedJSON);
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const doc2 = dom.window.document;
    ok(errors2.length === 0, "转场测试页无 JS 报错");
    ok(doc2.querySelector(".ink-veil.spread"), "首次获胜：墨幕出现并带 .spread（墨迹真正洇开）");
    // 存档里的 legendaryShown 已被置真，回来不再重复转场
    const after = JSON.parse(dom.window.localStorage.getItem("fog-h5-fog-isle"));
    ok(after.legendaryShown === true, "转场后存档记下 legendaryShown");
    dom.window.close();
    // 再进一次（已看过秘卷）：不再转场，直接显示结局页
    const savedJSON2 = JSON.stringify(after);
    const errors3 = [];
    const dom3 = await JSDOM.fromURL(BASE + "fog-isle/index.html?seed=7", {
      resources: "usable",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.onerror = function (msg) { errors3.push(String(msg)); };
        window.localStorage.setItem("fog-h5-fog-isle", savedJSON2);
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const doc3 = dom3.window.document;
    ok(errors3.length === 0, "回程页无 JS 报错");
    ok(!doc3.querySelector(".ink-veil"), "看过秘卷回来不再转场");
    ok(doc3.body.textContent.indexOf("传说诞生") !== -1, "回程显示结局页（传说诞生）");
    ok(doc3.querySelector('a[href="grimoire.html"]'), "结局页能再打开秘卷");
    dom3.window.close();
  }
  console.log("\n通过 " + pass + " / 失败 " + fail);
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.log("渲染测试崩了：", e && e.message);
  process.exit(1);
});

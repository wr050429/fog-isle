/* 雾系列 H5 · 共享底座
   纯静态，无依赖。提供：种子随机数、URL 种子、localStorage 存档、
   复制求援提示词、轻提示、HTML 转义。
   （求援提示词的安全规则：各游戏只把“玩家已经在屏幕上看到的信息”
   写进 seen[]，提示词只从 seen[] 里拼，绝不碰隐藏答案、未读记录、真相。） */
(function () {
  "use strict";

  /* ---------- 种子随机数（mulberry32，同一种子同一局） ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    function rand() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // 存档用：暴露内部状态，读档后可恢复随机序列（不重头来）。
    rand._getState = function () { return a >>> 0; };
    rand._setState = function (s) { a = s >>> 0; };
    return rand;
  }
  function RNG(seed) {
    const rand = mulberry32(seed);
    return {
      random: rand,
      choice: function (arr) { return arr[Math.floor(rand() * arr.length)]; },
      randint: function (a, b) { return a + Math.floor(rand() * (b - a + 1)); },
      shuffle: function (arr) {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          const t = out[i]; out[i] = out[j]; out[j] = t;
        }
        return out;
      },
      sample: function (arr, n) { return this.shuffle(arr).slice(0, n); },
      choices: function (arr, weights) {
        let total = 0;
        for (const w of weights) total += w;
        let r = rand() * total;
        for (let i = 0; i < arr.length; i++) {
          r -= weights[i];
          if (r <= 0) return arr[i];
        }
        return arr[arr.length - 1];
      },
      getState: function () { return rand._getState(); },
      setState: function (s) { rand._setState(s); }
    };
  }

  /* ---------- 种子：URL ?seed=数字，缺省随机 ---------- */
  function seedFromURL(fallback) {
    try {
      const q = new URLSearchParams(window.location.search);
      const s = q.get("seed");
      if (s !== null && s !== "" && !isNaN(parseInt(s, 10))) {
        return parseInt(s, 10);
      }
    } catch (e) { /* 忽略，走随机 */ }
    return fallback !== undefined ? fallback : Math.floor(Math.random() * 900000) + 100000;
  }
  function seedURL(seed) {
    const u = new URL(window.location.href);
    u.searchParams.set("seed", String(seed));
    return u.toString();
  }
  function randomSeed() { return Math.floor(Math.random() * 900000) + 100000; }

  /* ---------- 存档：localStorage ---------- */
  function saveState(key, state) {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }
  function loadState(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clearState(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  /* ---------- 复制 + 轻提示 ---------- */
  function copyText(text, okMsg) {
    function done() { toast(okMsg || "已复制，去问你的 AI 吧。"); }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); }
      catch (e) { toast("复制失败，请长按手动复制。"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else { fallback(); }
  }
  function toast(msg) {
    let el = document.getElementById("fog-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "fog-toast";
      el.className = "fog-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("show"); }, 2200);
  }
  /* 第 9 项修法：进结局页时清掉残留的轻提示（比如电报局指认错的 toast 别带进胜局页）。 */
  function hideToast() {
    const el = document.getElementById("fog-toast");
    if (!el) return;
    clearTimeout(el._t);
    el.classList.remove("show");
  }

  /* ---------- 断点续玩提示（第 10 项） ----------
     打开带 ?seed= 的链接时，若本浏览器里已有该种子的中途存档，
     各游戏在页面顶部显示一条小提示「这一局你玩到第 X 步，继续／从头」。
     同一会话内点过“继续”就不再弹（sessionStorage 记一次）。 */
  function resumeDismissed(key) {
    try { return sessionStorage.getItem(key + ":resumed") === "1"; } catch (e) { return false; }
  }
  function markResumed(key) {
    try { sessionStorage.setItem(key + ":resumed", "1"); } catch (e) { /* 忽略 */ }
  }

  /* ---------- HTML 转义 ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.FogCommon = {
    RNG: RNG, mulberry32: mulberry32,
    seedFromURL: seedFromURL, seedURL: seedURL, randomSeed: randomSeed,
    saveState: saveState, loadState: loadState, clearState: clearState,
    copyText: copyText, toast: toast, hideToast: hideToast,
    resumeDismissed: resumeDismissed, markResumed: markResumed,
    esc: esc
  };
})();

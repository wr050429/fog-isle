/* 雾系列 H5 · 角色剪影（电报局嫌疑人、跑团角色卡的人像）
   新方案（2026-11-14）：代码画的雾兽全部撤掉——普通雾兽只用文字登记卡，
   只有传说雾兽有亲手画的插画（assets/grimoire-*.webp，见 fog-isle/grimoire.html）。
   这个文件现在只留 figure()：一个 80×80 的头肩剪影 + 一件身份配饰。 */
(function () {
  "use strict";
  function figure(role) {
    var uid = "fig-" + (role || "none");
    var acc = "";
    if (role === "cap") acc = '<path d="M28 26 L52 26 L50 18 Q40 12 30 18 Z" fill="#2b2620"/><rect x="26" y="24" width="28" height="3" fill="#2b2620"/>';
    else if (role === "sailor") acc = '<ellipse cx="40" cy="20" rx="15" ry="5" fill="#2b2620"/><path d="M40 15 L40 6 M40 6 L50 10" stroke="#2b2620" stroke-width="2" fill="none"/>';
    else if (role === "headset") acc = '<path d="M24 26 Q24 10 40 10 Q56 10 56 26" stroke="#2b2620" stroke-width="2.5" fill="none"/><rect x="20" y="24" width="6" height="10" rx="2" fill="#2b2620"/><rect x="54" y="24" width="6" height="10" rx="2" fill="#2b2620"/>';
    else if (role === "notepad") acc = '<rect x="52" y="44" width="14" height="18" rx="2" fill="#efe6d4" stroke="#2b2620" stroke-width="1.5" transform="rotate(12 59 53)"/><path d="M55 50 L63 50 M55 55 L63 55" stroke="#2b2620" stroke-width="1.2" transform="rotate(12 59 53)"/>';
    else if (role === "hood") acc = '<path d="M22 34 Q22 12 40 12 Q58 12 58 34 L52 34 Q52 20 40 20 Q28 20 28 34 Z" fill="#2b2620"/>';
    else if (role === "bun") acc = '<circle cx="40" cy="12" r="6" fill="#2b2620"/>';
    else if (role === "bowtie") acc = '<path d="M40 56 L32 51 L32 61 Z M40 56 L48 51 L48 61 Z" fill="#2b2620"/>';
    return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="人像剪影" style="display:block;">' +
      '<defs><radialGradient id="' + uid + '-fog" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#8b98a3" stop-opacity="0.35"/><stop offset="100%" stop-color="#8b98a3" stop-opacity="0"/>' +
      '</radialGradient></defs>' +
      '<ellipse cx="40" cy="44" rx="34" ry="30" fill="url(#' + uid + '-fog)"/>' +
      '<g fill="#3a4450" opacity="0.85">' +
        '<circle cx="40" cy="30" r="14"/>' +
        '<path d="M14 78 Q14 52 40 52 Q66 52 66 78 Z"/>' +
      '</g>' + acc +
    '</svg>';
  }
  var API = { figure: figure };
  if (typeof window !== "undefined") window.FogCreature = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();

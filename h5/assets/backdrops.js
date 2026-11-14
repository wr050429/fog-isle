/* 雾系列 H5 · 整页底图（前端 SVG 渲染，无位图拼贴）
   八幅场景：entry（整幅雾汀夜景地图，桌面横幅）、entryMobile（手机竖版地图）、
   baita（旧公寓楼道）、harbor（电报局柜台）、lighthouse（夜海与光柱）、isle（孵化棚）、
   rpg（熄灭的灯塔与码头）、company（深夜公司走廊）。
   风格：简笔线稿骨架 + 水彩灰雾晕染，琥珀灯光是唯一暖色。不要霓虹、不要毛玻璃。
   游戏页底图是固定背景（方形 viewBox，关键内容放中央安全区，裁切只裁掉雾与夜色）；
   入口地图是整幅可见的 SVG（宽 100%、高自适应，不裁切，灯点永不错位）。 */
(function () {
  "use strict";
  const INK = "#2b2620";
  const INK_SOFT = "#5a5348";
  const AMBER = "#e0a64a";
  const PAPER = "#efe6d4";
  const FOG = "#8b98a3";
  const SIL = "#141a20";      // 剪影填色（比夜空更深，建筑/灯塔/棚子填实）

  /* 共享渐变与滤镜（每幅底图内联一份，避免跨 SVG 引用失效） */
  function defs() {
    return '<defs>' +
      '<linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#1a232c"/><stop offset="55%" stop-color="#232f3a"/><stop offset="100%" stop-color="#2c3a44"/>' +
      '</linearGradient>' +
      '<linearGradient id="bd-sea" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#31424e"/><stop offset="100%" stop-color="#22303a"/>' +
      '</linearGradient>' +
      '<radialGradient id="bd-fog" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="' + FOG + '" stop-opacity="0.30"/>' +
        '<stop offset="70%" stop-color="' + FOG + '" stop-opacity="0.10"/>' +
        '<stop offset="100%" stop-color="' + FOG + '" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="bd-lamp" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="' + AMBER + '" stop-opacity="0.85"/>' +
        '<stop offset="45%" stop-color="' + AMBER + '" stop-opacity="0.28"/>' +
        '<stop offset="100%" stop-color="' + AMBER + '" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<linearGradient id="bd-beam" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="' + AMBER + '" stop-opacity="0.55"/>' +
        '<stop offset="100%" stop-color="' + AMBER + '" stop-opacity="0"/>' +
      '</linearGradient>' +
    '</defs>';
  }
  /* 星星：种子定的固定位置，避免每次渲染跳变 */
  function stars(n, seed, x0, y0, x1, y1) {
    let s = seed;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    let out = "";
    for (let i = 0; i < n; i++) {
      const x = Math.round(x0 + rnd() * (x1 - x0));
      const y = Math.round(y0 + rnd() * (y1 - y0));
      const r = (0.8 + rnd() * 1.4).toFixed(1);
      const o = (0.35 + rnd() * 0.5).toFixed(2);
      out += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#e8e2d4" opacity="' + o + '"/>';
    }
    return out;
  }
  /* 一盏灯点：光晕 + 灯芯（入口地图用，可点时包在 <g class="lamp-point"> 里） */
  function lampPoint(x, y, r) {
    r = r || 7;
    return '<circle cx="' + x + '" cy="' + y + '" r="' + (r * 3.2) + '" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + AMBER + '" stroke="' + PAPER + '" stroke-width="1.5" class="lamp-glow"/>';
  }

  /* ---------------- 入口页：整幅雾汀夜景地图（横幅 viewBox 1280×800） ----------------
     全页背景（slice 铺满）。1280×800 首屏看到全部六个地点。
     桌面横幅只保证宽屏首屏看到全部六个地点；手机竖屏改用 entryMobile 竖版构图。
     雾汀市、雾港、雾岛都有陆地填色与灯火（不再只有轮廓线）。
     灯塔熄灭之夜在灯塔旁边的码头上（与灯塔游戏点错开）。 */
  function entryMap() {
    return '<svg class="map-svg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="雾汀夜景地图：雾汀市、雾港、雾岛">' +
      defs() +
      '<rect x="0" y="0" width="1280" height="800" fill="url(#bd-sky)"/>' +
      stars(46, 7, 20, 20, 1260, 300) +
      '<circle cx="1180" cy="90" r="32" fill="#e8e2d4" opacity="0.85"/>' +
      '<circle cx="1180" cy="90" r="50" fill="#e8e2d4" opacity="0.12"/>' +
      '<ellipse cx="640" cy="220" rx="620" ry="150" fill="url(#bd-fog)"/>' +
      /* 海：下半幅 */
      '<path d="M0 540 C200 520 400 560 640 540 C880 520 1080 560 1280 535 L1280 800 L0 800 Z" fill="url(#bd-sea)"/>' +
      '<path d="M0 600 C220 584 420 616 660 600 C880 586 1080 612 1280 596" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.5"/>' +
      '<path d="M0 670 C240 654 460 684 700 668 C920 654 1100 680 1280 664" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.35"/>' +
      '<path d="M0 740 C200 726 420 752 640 738 C860 726 1060 750 1280 736" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.25"/>' +
      /* 雾汀市陆地（左）：有填色，不再只有轮廓线 */
      '<path d="M0 180 C120 160 260 185 380 175 C440 170 470 190 470 240 L470 540 L0 540 Z" fill="#26333e"/>' +
      '<path d="M0 180 C120 160 260 185 380 175 C440 170 470 190 470 240" stroke="#3a4a56" stroke-width="2" fill="none" opacity="0.7"/>' +
      /* 雾汀市建筑：白塔巷 + 收件处（填实 + 灯火） */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M80 540 L80 300 L200 300 L200 540 Z"/><path d="M110 300 L110 260 L170 260 L170 300 Z"/>' +
        '<path d="M120 540 L120 480 L160 480 L160 540 Z"/>' +
        '<path d="M230 540 L230 360 L330 360 L330 540 Z"/>' +
        '<path d="M360 540 L360 420 L440 420 L440 540 Z"/>' +
      '</g>' +
      '<rect x="130" y="330" width="16" height="20" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<rect x="260" y="390" width="14" height="16" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<rect x="390" y="450" width="14" height="16" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<text x="80" y="580" font-family="Georgia, \'Songti SC\', serif" font-size="30" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾汀市</text>' +
      '<text x="80" y="610" font-family="Georgia, \'Songti SC\', serif" font-size="16" fill="#e8e2d4" stroke="#1f2a33" stroke-width="3" paint-order="stroke">白塔巷 17 号 · 收件处</text>' +
      /* 雾汀生物（市郊，市区与雾港之间） */
      '<path d="M480 300 L660 300 L660 540 L480 540 Z" fill="#26333e"/>' +
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M500 540 L500 340 L640 340 L640 540 Z"/><path d="M540 540 L540 500 L600 500 L600 540 Z"/>' +
      '</g>' +
      '<path d="M500 400 L640 400" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<rect x="520" y="360" width="14" height="14" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<rect x="600" y="360" width="14" height="14" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<text x="480" y="580" font-family="Georgia, \'Songti SC\', serif" font-size="16" fill="#e8e2d4" stroke="#1f2a33" stroke-width="3" paint-order="stroke">雾汀生物 · 市郊</text>' +
      /* 雾港陆地（中右）：电报局、海关、仓库、码头 */
      '<path d="M680 300 C760 285 860 300 920 295 C960 292 980 310 980 340 L980 540 L680 540 Z" fill="#26333e"/>' +
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M700 540 L700 380 L810 380 L810 540 Z"/><path d="M730 380 L730 340 L780 340 L780 380 Z"/>' +
        '<path d="M740 540 L740 480 L770 480 L770 540 Z"/>' +
        '<path d="M840 540 L840 420 L920 420 L920 540 Z"/>' +
      '</g>' +
      '<rect x="748" y="400" width="16" height="20" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<rect x="870" y="440" width="14" height="16" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<text x="680" y="580" font-family="Georgia, \'Songti SC\', serif" font-size="28" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾港</text>' +
      '<text x="680" y="608" font-family="Georgia, \'Songti SC\', serif" font-size="15" fill="#e8e2d4" stroke="#1f2a33" stroke-width="3" paint-order="stroke">海关 · 电报局 · 仓库</text>' +
      /* 码头与桅杆 */
      '<g stroke="#b9b3a4" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85">' +
        '<path d="M700 540 L700 600 M750 540 L750 600 M800 540 L800 600 M700 600 L800 600"/>' +
        '<path d="M860 620 L860 540 M860 540 L900 600 L860 600"/>' +
        '<path d="M850 620 L910 620 L896 636 L864 636 Z"/>' +
      '</g>' +
      '<ellipse cx="700" cy="560" rx="420" ry="90" fill="url(#bd-fog)"/>' +
      /* 雾岛（右）：灯塔 + 育种所 */
      '<path d="M980 420 C1040 400 1120 410 1160 430 C1200 450 1210 500 1200 560 C1190 640 1140 720 1060 740 C1000 752 960 700 950 620 C944 560 950 460 980 420 Z" fill="#26333e"/>' +
      /* 灯塔 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M990 700 L1002 520 L1042 520 L1054 700 Z"/><path d="M1000 520 L1044 520 L1044 492 L1000 492 Z"/>' +
        '<path d="M1012 492 L1032 492 L1022 474 Z"/>' +
      '</g>' +
      '<circle cx="1022" cy="506" r="6" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<path d="M1044 506 L1150 470 L1150 540 Z" fill="url(#bd-beam)" class="lamp-glow"/>' +
      /* 育种所（灯塔脚下） */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M960 720 L960 650 L1040 650 L1040 720 Z"/><path d="M980 650 L980 622 L1020 622 L1020 650 Z"/>' +
      '</g>' +
      '<rect x="992" y="666" width="14" height="16" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<text x="980" y="390" font-family="Georgia, \'Songti SC\', serif" font-size="26" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾岛</text>' +
      '<text x="1040" y="390" font-family="Georgia, \'Songti SC\', serif" font-size="14" fill="#e8e2d4" stroke="#1f2a33" stroke-width="3" paint-order="stroke">灯塔 · 育种所</text>' +
      /* 雾里的船与航线 */
      '<g stroke="#b9b3a4" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7">' +
        '<path d="M420 660 L490 660 L476 676 L434 676 Z"/><path d="M455 660 L455 628"/><path d="M455 628 L482 656 L455 656"/>' +
      '</g>' +
      '<path d="M520 700 C620 680 700 710 800 720" stroke="#b9b3a4" stroke-width="1.5" stroke-dasharray="5 6" fill="none" opacity="0.6"/>' +
      '<ellipse cx="640" cy="700" rx="420" ry="90" fill="url(#bd-fog)"/>' +
      /* 六个灯点（可点）：光晕 + 灯芯 + 透明大点击区 + 纸签名字 */
      lampPointGroup(267, 398, "baita-lane/index.html", "白塔巷 17 号", 267, 340, "middle") +
      lampPointGroup(527, 367, "fog-company/index.html", "雾汀生物", 527, 310, "middle") +
      lampPointGroup(756, 410, "fog-harbor/index.html", "雾港电报局", 756, 350, "middle") +
      lampPointGroup(1022, 506, "lighthouse/index.html", "雾岛灯塔", 1022, 468, "middle") +
      lampPointGroup(999, 674, "fog-isle/index.html", "雾岛育种所", 999, 620, "middle") +
      lampPointGroup(950, 600, "fog-rpg/index.html", "灯塔熄灭之夜", 950, 660, "middle") +
    '</svg>';
  }
  /* 一个可点的灯点：透明大点击区（r=34，手指好点）+ 光晕 + 灯芯 + 名字。
     名字写在一张小纸签上（纸底 + 墨字），放在空处，不撞建筑、不撞别的标签；
     纸签比描边稳，在深色底上永远能看清。 */
  function lampPointGroup(x, y, href, label, lx, ly, anchor) {
    const w = label.length * 15 + 16; // 纸签宽（字数估算）
    const tagX = (anchor === "start") ? lx : (anchor === "end" ? lx - w : lx - w / 2);
    return '<g class="lamp-point" data-href="' + href + '" style="cursor:pointer;" role="link" tabindex="0" aria-label="' + label + '">' +
      '<circle cx="' + x + '" cy="' + y + '" r="34" fill="transparent"/>' +
      lampPoint(x, y, 8) +
      '<rect x="' + tagX + '" y="' + (ly - 13) + '" width="' + w + '" height="20" rx="4" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="1" opacity="0.94"/>' +
      '<text x="' + lx + '" y="' + (ly + 1) + '" text-anchor="' + (anchor || "middle") + '" font-family="Georgia, \'Songti SC\', serif" font-size="14" fill="' + INK + '">' + label + '</text>' +
    '</g>';
  }

  /* ---------------- 白塔巷：旧公寓楼道（viewBox 1000×1000，关键内容在中央安全区） ----------------
     透视走廊、302 的门、窗格透进的路灯光、楼梯扶手。 */
  function baita() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="白塔巷旧公寓楼道">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      /* 走廊透视：后墙 + 两侧墙 + 地板。整段上移 170，门与窗格落在首屏 hero 可见带
         （桌面 y 187–406、手机 y 0–350）里，不再躲在纸卡后面；挂灯位置不动，仍吊在楼道里。 */
      '<g stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M380 130 L620 130 L620 530 L380 530 Z"/>' +
        '<path d="M0 -50 L380 130 M1000 -50 L620 130 M0 710 L380 530 M1000 710 L620 530"/>' +
        '<path d="M0 -50 L0 710 M1000 -50 L1000 710"/>' +
        '<path d="M380 130 L380 530 M620 130 L620 530"/>' +
        '<path d="M0 330 L380 310 M1000 330 L620 310"/>' +
      '</g>' +
      /* 门：左 301、右 302（陈聿的房间） */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="none" stroke-linecap="round">' +
        '<path d="M120 210 L300 190 L300 470 L120 490 Z"/><circle cx="270" cy="340" r="6" fill="' + INK + '"/>' +
        '<path d="M700 190 L880 210 L880 490 L700 470 Z"/><circle cx="730" cy="340" r="6" fill="' + INK + '"/>' +
      '</g>' +
      '<text x="150" y="250" font-family="Georgia, \'Songti SC\', serif" font-size="26" fill="#b9b3a4">301</text>' +
      '<text x="790" y="250" font-family="Georgia, \'Songti SC\', serif" font-size="26" fill="' + AMBER + '">302</text>' +
      /* 楼梯扶手（右下，斜线 + 栏杆）：前景 */
      '<g class="bd-fg" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round">' +
        '<path d="M640 830 L900 590 L900 530"/><path d="M640 830 L640 730 M700 790 L700 680 M760 750 L760 640 M820 710 L820 600"/>' +
      '</g>' +
      /* 尽头窗格：路灯光透进来 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="none">' +
        '<rect x="440" y="190" width="120" height="180"/>' +
        '<path d="M500 190 L500 370 M440 280 L560 280"/>' +
      '</g>' +
      '<rect x="440" y="190" width="120" height="180" fill="' + AMBER + '" opacity="0.14"/>' +
      /* 光柱：从窗格斜洒到地板 */
      '<path d="M460 370 L560 370 L720 710 L380 710 Z" fill="' + AMBER + '" opacity="0.10"/>' +
      '<path d="M500 370 L520 370 L600 710 L480 710 Z" fill="' + AMBER + '" opacity="0.12"/>' +
      /* 近处台阶（前景）：底部中央一道深色台阶 */
      '<g class="bd-fg" stroke="' + INK + '" stroke-width="3" fill="' + SIL + '" stroke-linejoin="round">' +
        '<path d="M320 830 L340 770 L660 770 L680 830 Z"/>' +
      '</g>' +
      /* 挂灯（位置不动，仍吊在楼道里） */
      '<path d="M500 0 L500 150" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<circle cx="500" cy="170" r="46" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<path d="M480 150 L520 150 L512 185 L488 185 Z" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<ellipse cx="500" cy="390" rx="420" ry="170" fill="url(#bd-fog)"/>' +
      '<ellipse cx="500" cy="710" rx="480" ry="120" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 雾港电报局：柜台、挂钟、窗外港口 ---------------- */
  function harbor() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="雾港电报局柜台">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      /* 窗：右上，窗外港口的雾和桅杆 */
      '<g stroke="' + INK + '" stroke-width="3" fill="none">' +
        '<rect x="620" y="180" width="300" height="340"/>' +
        '<path d="M770 180 L770 520 M620 350 L920 350"/>' +
      '</g>' +
      '<rect x="620" y="180" width="300" height="340" fill="#31424e" opacity="0.7"/>' +
      '<g stroke="#b9b3a4" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.8">' +
        '<path d="M680 520 L680 300 M680 300 L720 380 L680 380"/><path d="M820 520 L820 330 M820 330 L860 400 L820 400"/>' +
        '<path d="M660 470 L740 470 L730 490 L670 490 Z"/>' +
      '</g>' +
      '<ellipse cx="770" cy="430" rx="180" ry="110" fill="url(#bd-fog)"/>' +
      /* 挂钟 */
      '<circle cx="345" cy="300" r="72" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="3"/>' +
      '<path d="M345 300 L345 252 M345 300 L377 318" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="345" cy="300" r="5" fill="' + INK + '"/>' +
      /* 柜台（前景） */
      '<g class="bd-fg" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M80 700 L920 700 L920 1000 L80 1000 Z"/>' +
        '<path d="M80 700 L920 700"/><path d="M80 760 L920 760"/>' +
      '</g>' +
      '<rect x="80" y="700" width="840" height="60" fill="#3a2f24" opacity="0.55"/>' +
      /* 柜台上的东西：电报机、小铃、纸 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="none" stroke-linecap="round">' +
        '<rect x="180" y="620" width="110" height="80" rx="4"/>' +
        '<path d="M200 660 L270 660 M200 640 L235 640"/>' +
        '<path d="M420 680 L460 640 L500 680 Z"/><circle cx="460" cy="632" r="4" fill="' + INK + '"/>' +
        '<path d="M600 660 L700 660 L710 700 L590 700 Z"/>' +
      '</g>' +
      /* 台灯 */
      '<path d="M780 700 L780 600" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="780" cy="580" r="60" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<path d="M752 600 L808 600 L796 640 L764 640 Z" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<ellipse cx="500" cy="880" rx="460" ry="120" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 灯塔：夜海、礁石、扫过的光柱（光柱很慢地转） ----------------
     塔身拉高：灯室落在首屏 hero 可见带（桌面 y 187–406、手机 y 0–350）里，塔基仍在海里。 */
  function lighthouse() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="雾岛灯塔夜海">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      stars(36, 11, 20, 20, 980, 380) +
      '<circle cx="820" cy="200" r="30" fill="#e8e2d4" opacity="0.8"/>' +
      '<circle cx="820" cy="200" r="48" fill="#e8e2d4" opacity="0.10"/>' +
      /* 海 */
      '<path d="M0 560 C200 530 400 580 600 560 C750 546 900 575 1000 558 L1000 1000 L0 1000 Z" fill="url(#bd-sea)"/>' +
      '<path d="M0 640 C180 622 340 655 520 640 C680 628 840 652 1000 636" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.5"/>' +
      '<path d="M0 730 C200 712 380 745 580 728 C740 716 880 740 1000 726" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.35"/>' +
      '<path d="M0 830 C160 814 360 844 560 828 C720 816 880 840 1000 824" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.25"/>' +
      /* 礁石（前景） */
      '<g class="bd-fg" fill="#141a20" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round">' +
        '<path d="M120 1000 L140 860 L220 800 L300 1000 Z"/>' +
        '<path d="M760 1000 L800 880 L880 830 L960 1000 Z"/>' +
      '</g>' +
      /* 灯塔（中央偏右） */
      '<g stroke="' + INK + '" stroke-width="3" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M540 900 L580 305 L670 305 L710 900 Z"/>' +
        '<path d="M575 305 L675 305 L675 255 L575 255 Z"/>' +
        '<path d="M600 255 L650 255 L625 225 Z"/>' +
      '</g>' +
      '<rect x="575" y="255" width="100" height="50" fill="#22303a"/>' +
      '<circle cx="625" cy="280" r="10" fill="' + AMBER + '" class="lamp-glow"/>' +
      /* 光柱：绕灯室很慢地转（transform-origin 就是灯室位置） */
      '<g class="bd-beam" style="transform-box: view-box; transform-origin: 625px 280px;">' +
        '<path d="M635 280 L1000 165 L1000 395 Z" fill="url(#bd-beam)"/>' +
      '</g>' +
      '<circle cx="625" cy="280" r="34" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      /* 近处礁石（前景）：底部中央一大块，竖屏也看得见 */
      '<path class="bd-fg" d="M380 1000 L420 880 L500 850 L580 880 L620 1000 Z" fill="#141a20" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      /* 雾里的船 */
      '<g stroke="#b9b3a4" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7">' +
        '<path d="M300 640 L370 640 L356 656 L314 656 Z"/><path d="M335 640 L335 610"/><path d="M335 610 L360 636 L335 636"/>' +
      '</g>' +
      '<ellipse cx="500" cy="620" rx="460" ry="120" fill="url(#bd-fog)"/>' +
      '<ellipse cx="500" cy="900" rx="480" ry="110" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 育种所：岛上的孵化棚（暖色孵化灯、玻璃罐、门缝进来的雾） ---------------- */
  function isle() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="雾岛育种所孵化棚">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      /* 棚顶与梁：屋顶与地面填实，棚子读得出是固体 */
      '<path d="M120 340 L500 180 L880 340 Z" fill="' + SIL + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<rect x="120" y="880" width="760" height="120" fill="' + SIL + '"/>' +
      '<g stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M120 340 L120 900 M880 340 L880 900"/>' +
        '<path d="M250 285 L250 900 M750 285 L750 900"/>' +
        '<path d="M120 340 L880 340"/>' +
      '</g>' +
      /* 架子与玻璃罐：罐子填一点深色，读得出是玻璃罐 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="#2c3a44" stroke-linecap="round">' +
        '<path d="M160 520 L420 520 M160 700 L420 700" fill="none"/>' +
        '<rect x="190" y="420" width="70" height="100" rx="12"/><rect x="290" y="420" width="70" height="100" rx="12"/>' +
        '<rect x="190" y="600" width="70" height="100" rx="12"/><rect x="290" y="600" width="70" height="100" rx="12"/>' +
      '</g>' +
      /* 罐子里雾兽的影子 */
      '<g stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8">' +
        '<path d="M205 490 C205 470 220 465 235 470 C248 476 250 490 238 496 C224 500 205 500 205 490 Z"/>' +
        '<path d="M305 690 C305 672 318 668 330 672 C342 678 344 690 334 695 C322 699 305 698 305 690 Z"/>' +
      '</g>' +
      /* 孵化灯（暖色） */
      '<path d="M330 180 L330 260 M670 180 L670 260" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<circle cx="330" cy="290" r="64" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<circle cx="670" cy="290" r="64" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<path d="M306 260 L354 260 L344 300 L316 300 Z" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<path d="M646 260 L694 260 L684 300 L656 300 Z" fill="' + AMBER + '" class="lamp-glow"/>' +
      /* 光池 */
      '<ellipse cx="330" cy="880" rx="170" ry="42" fill="' + AMBER + '" opacity="0.10"/>' +
      '<ellipse cx="670" cy="880" rx="170" ry="42" fill="' + AMBER + '" opacity="0.10"/>' +
      /* 门（右）：雾从门缝进来 */
      '<g stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round">' +
        '<path d="M880 420 L880 900 M880 420 L1000 420 M880 900 L1000 900"/>' +
      '</g>' +
      '<path d="M880 900 L1000 900 L1000 760 L920 820 Z" fill="url(#bd-fog)" opacity="0.9"/>' +
      '<ellipse cx="920" cy="860" rx="150" ry="80" fill="url(#bd-fog)"/>' +
      /* 工作台（前景）：填实 */
      '<g class="bd-fg" stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round">' +
        '<path d="M520 760 L760 760 L760 900 L520 900 Z"/><path d="M540 800 L740 800" fill="none"/>' +
        '<path d="M560 720 L660 720 L670 760 L550 760 Z"/>' +
      '</g>' +
      '<ellipse cx="500" cy="560" rx="420" ry="140" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 灯塔熄灭之夜：熄灭的灯塔和雾里的码头，只有一点残光 ----------------
     塔身拉高：熄灭的灯室与那一点残光落在首屏 hero 可见带里，塔基仍在海里。 */
  function rpg() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="熄灭的灯塔与雾里的码头">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      '<ellipse cx="500" cy="300" rx="480" ry="200" fill="url(#bd-fog)"/>' +
      /* 海（几乎被雾盖住） */
      '<path d="M0 620 C250 600 500 640 1000 615 L1000 1000 L0 1000 Z" fill="url(#bd-sea)"/>' +
      '<path d="M0 700 C220 684 420 712 650 696 C780 688 900 706 1000 694" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.3"/>' +
      /* 熄灭的灯塔（左，暗的） */
      '<g stroke="' + INK + '" stroke-width="3" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M300 900 L325 290 L395 290 L420 900 Z"/>' +
        '<path d="M315 290 L405 290 L405 250 L315 250 Z"/>' +
        '<path d="M340 250 L380 250 L360 224 Z"/>' +
      '</g>' +
      '<rect x="315" y="250" width="90" height="40" fill="#1a232c"/>' +
      /* 只有一点残光 */
      '<circle cx="360" cy="270" r="4" fill="' + AMBER + '" opacity="0.9" class="lamp-glow"/>' +
      '<circle cx="360" cy="270" r="16" fill="url(#bd-lamp)" opacity="0.6" class="lamp-glow"/>' +
      /* 码头（右下，伸进雾里）：前景 */
      '<g class="bd-fg" stroke="#b9b3a4" stroke-width="3" fill="none" stroke-linecap="round">' +
        '<path d="M620 1000 L680 760 L700 760 L760 1000"/>' +
        '<path d="M640 920 L740 920 M660 840 L720 840"/>' +
        '<path d="M680 760 L680 700 M700 760 L700 700"/>' +
      '</g>' +
      /* 系在码头边的小船（前景） */
      '<g class="bd-fg" stroke="#b9b3a4" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85">' +
        '<path d="M740 780 L830 780 L816 800 L754 800 Z"/><path d="M785 780 L785 740"/>' +
      '</g>' +
      /* 岸边一点远光 */
      '<circle cx="820" cy="600" r="5" fill="' + AMBER + '" opacity="0.8" class="lamp-glow"/>' +
      '<circle cx="820" cy="600" r="20" fill="url(#bd-lamp)" opacity="0.5"/>' +
      '<ellipse cx="500" cy="700" rx="480" ry="140" fill="url(#bd-fog)"/>' +
      '<ellipse cx="500" cy="920" rx="480" ry="110" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 雾汀生物：深夜公司走廊、门禁灯、桌上的交班表 ---------------- */
  function company() {
    return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-label="雾汀生物深夜走廊">' +
      defs() +
      '<rect class="bd-bg" x="0" y="0" width="1000" height="1000" fill="url(#bd-sky)"/>' +
      /* 走廊透视 */
      '<g stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M400 320 L600 320 L600 680 L400 680 Z"/>' +
        '<path d="M0 140 L400 320 M1000 140 L600 320 M0 860 L400 680 M1000 860 L600 680"/>' +
        '<path d="M0 140 L0 860 M1000 140 L1000 860"/>' +
      '</g>' +
      /* 两边的门 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="none" stroke-linecap="round">' +
        '<path d="M140 400 L300 380 L300 620 L140 640 Z"/>' +
        '<path d="M700 380 L860 400 L860 640 L700 620 Z"/>' +
        '<path d="M340 480 L360 480 M640 480 L660 480"/>' +
      '</g>' +
      /* 门禁灯（小小一盏琥珀） */
      '<circle cx="330" cy="470" r="5" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<circle cx="330" cy="470" r="14" fill="url(#bd-lamp)"/>' +
      '<circle cx="670" cy="470" r="5" fill="' + AMBER + '" class="lamp-glow"/>' +
      /* 挂钟（右墙：桌面 hero 可见带 y 187–406 与手机 y 0–350 都在，标题在左下方，不压标题；
         左墙那个位置桌面会被视口顶边切掉一半） */
      '<circle cx="690" cy="315" r="40" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M690 315 L690 291 M690 315 L708 325" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>' +
      /* 桌子（前景）：上面压着交班表 */
      '<g class="bd-fg" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M240 780 L760 780 L760 1000 L240 1000 Z"/>' +
        '<path d="M240 830 L760 830"/>' +
      '</g>' +
      '<rect x="240" y="780" width="520" height="50" fill="#3a2f24" opacity="0.5"/>' +
      /* 交班表：白班留下的那张纸 */
      '<g transform="rotate(-3 500 730)">' +
        '<rect x="380" y="690" width="240" height="140" rx="4" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M400 720 L600 720 M400 750 L600 750 M400 780 L600 780 M400 810 L540 810" stroke="' + INK_SOFT + '" stroke-width="1.5"/>' +
        '<circle cx="596" cy="800" r="10" fill="none" stroke="#a8382f" stroke-width="2"/>' +
      '</g>' +
      /* 走廊灯（只有尽头一盏亮着） */
      '<circle cx="500" cy="360" r="50" fill="url(#bd-lamp)" class="lamp-glow"/>' +
      '<path d="M482 330 L518 330 L510 360 L490 360 Z" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<ellipse cx="500" cy="560" rx="420" ry="150" fill="url(#bd-fog)"/>' +
      '<ellipse cx="500" cy="900" rx="480" ry="110" fill="url(#bd-fog)"/>' +
    '</svg>';
  }

  /* ---------------- 入口页（手机竖版）：雾汀夜景地图的竖构图 ----------------
     viewBox 800×1200：市区在上、雾港在中、海与雾岛在下，三段竖着排。
     手机 390×844 下 slice 只裁左右（可见 x 约 122–677），六个灯点都在带内，
     首屏竖向完整看到全部六个地点。标题与抽屉盖住的上下边不放灯点。 */
  function entryMobile() {
    return '<svg class="map-svg" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="雾汀夜景地图：雾汀市、雾港、雾岛">' +
      defs() +
      '<rect x="0" y="0" width="800" height="1200" fill="url(#bd-sky)"/>' +
      stars(30, 7, 20, 20, 780, 300) +
      '<circle cx="660" cy="110" r="26" fill="#e8e2d4" opacity="0.85"/>' +
      '<circle cx="660" cy="110" r="42" fill="#e8e2d4" opacity="0.12"/>' +
      '<ellipse cx="400" cy="240" rx="380" ry="110" fill="url(#bd-fog)"/>' +
      /* 雾汀市（上） */
      '<path d="M60 250 C200 232 420 244 740 238 L740 440 L60 440 Z" fill="#26333e"/>' +
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M120 440 L120 300 L220 300 L220 440 Z"/><path d="M150 300 L150 268 L190 268 L190 300 Z"/>' +
        '<path d="M250 440 L250 330 L350 330 L350 440 Z"/>' +
        '<path d="M560 440 L560 320 L660 320 L660 440 Z"/>' +
      '</g>' +
      '<rect x="160" y="330" width="14" height="18" fill="' + AMBER + '" class="lamp-glow"/>' +
      /* 雾港（中） */
      '<path d="M60 490 C220 474 460 488 740 482 L740 700 L60 700 Z" fill="#26333e"/>' +
      /* 海（下） */
      '<path d="M0 700 L800 700 L800 1200 L0 1200 Z" fill="url(#bd-sea)"/>' +
      '<path d="M0 760 C200 744 400 774 800 758" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.5"/>' +
      '<path d="M0 1140 C200 1126 400 1152 800 1136" stroke="#5a6a75" stroke-width="2" fill="none" opacity="0.25"/>' +
      /* 雾港建筑 + 码头（画在海上面，码头伸进海里） */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M300 700 L300 560 L500 560 L500 700 Z"/><path d="M370 560 L370 528 L430 528 L430 560 Z"/>' +
        '<path d="M540 700 L540 560 L640 560 L640 700 Z"/>' +
      '</g>' +
      '<rect x="340" y="590" width="14" height="18" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<rect x="570" y="590" width="12" height="14" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<g stroke="#b9b3a4" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85">' +
        '<path d="M300 700 L300 740 M360 700 L360 740 M300 740 L360 740"/>' +
      '</g>' +
      /* 雾岛 */
      '<path d="M220 820 C300 790 500 790 580 830 C640 870 640 980 600 1060 C560 1120 300 1120 250 1060 C200 990 190 870 220 820 Z" fill="#26333e"/>' +
      /* 灯塔 */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M370 1000 L382 860 L418 860 L430 1000 Z"/><path d="M380 860 L420 860 L420 836 L380 836 Z"/>' +
        '<path d="M390 836 L410 836 L400 820 Z"/>' +
      '</g>' +
      '<circle cx="400" cy="848" r="6" fill="' + AMBER + '" class="lamp-glow"/>' +
      '<path d="M420 848 L540 820 L540 876 Z" fill="url(#bd-beam)" class="lamp-glow"/>' +
      /* 育种所（灯塔脚下） */
      '<g stroke="' + INK + '" stroke-width="2.5" fill="' + SIL + '" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M440 1060 L440 1000 L540 1000 L540 1060 Z"/><path d="M465 1000 L465 978 L515 978 L515 1000 Z"/>' +
      '</g>' +
      /* 雾里的船 */
      '<g stroke="#b9b3a4" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7">' +
        '<path d="M560 740 L620 740 L608 754 L572 754 Z"/><path d="M590 740 L590 716"/><path d="M590 716 L612 738 L590 738"/>' +
      '</g>' +
      '<ellipse cx="400" cy="760" rx="360" ry="80" fill="url(#bd-fog)"/>' +
      '<ellipse cx="400" cy="1060" rx="360" ry="90" fill="url(#bd-fog)"/>' +
      /* 地名（画在雾上面） */
      '<text x="380" y="425" font-family="Georgia, \'Songti SC\', serif" font-size="26" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾汀市</text>' +
      '<text x="110" y="680" font-family="Georgia, \'Songti SC\', serif" font-size="26" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾港</text>' +
      '<text x="400" y="1115" text-anchor="middle" font-family="Georgia, \'Songti SC\', serif" font-size="24" fill="' + PAPER + '" stroke="#1f2a33" stroke-width="4" paint-order="stroke">雾岛</text>' +
      /* 六个灯点（可点）：与桌面地图同一批 href */
      lampPointGroup(300, 360, "baita-lane/index.html", "白塔巷 17 号", 300, 305, "middle") +
      lampPointGroup(610, 360, "fog-company/index.html", "雾汀生物", 610, 305, "middle") +
      lampPointGroup(400, 580, "fog-harbor/index.html", "雾港电报局", 400, 510, "middle") +
      lampPointGroup(400, 848, "lighthouse/index.html", "雾岛灯塔", 400, 775, "middle") +
      lampPointGroup(490, 1023, "fog-isle/index.html", "雾岛育种所", 490, 968, "middle") +
      lampPointGroup(280, 1000, "fog-rpg/index.html", "灯塔熄灭之夜", 280, 1060, "middle") +
    '</svg>';
  }

  const SCENES = { entry: entryMap, entryMobile: entryMobile, baita: baita, harbor: harbor, lighthouse: lighthouse, isle: isle, rpg: rpg, company: company };
  function svg(sceneId) {
    const fn = SCENES[sceneId];
    return fn ? fn() : "";
  }
  /* 把底图挂进一个容器：SVG + 一层压暗（保证纸卡上的字始终清楚）+ 两层缓慢飘动的雾
     视差：页面滚动时，前景（.bd-fg）比背景（.bd-bg）多平移一点，前中后三层拉开。
     很轻（前景最多 24 个 viewBox 单位，背景最多 10 个），rAF 节流，不耗电。 */
  function mount(sceneId, el) {
    if (!el) return;
    el.innerHTML = svg(sceneId) +
      '<div class="bd-shade"></div>' +
      '<div class="bd-fog bd-fog-a"></div>' +
      '<div class="bd-fog bd-fog-b"></div>';
    var svgEl = el.querySelector("svg");
    if (!svgEl) return;
    var fg = svgEl.querySelectorAll(".bd-fg");
    var bg = svgEl.querySelectorAll(".bd-bg");
    if (!fg.length && !bg.length) return;
    var ticking = false;
    function apply() {
      ticking = false;
      var y = (typeof window !== "undefined" && window.scrollY) || 0;
      var fgY = Math.min(24, y * 0.06);
      var bgY = Math.min(10, y * 0.02);
      for (var i = 0; i < fg.length; i++) fg[i].style.transform = "translateY(" + fgY + "px)";
      for (var j = 0; j < bg.length; j++) bg[j].style.transform = "translateY(" + bgY + "px)";
    }
    function onScroll() {
      if (!ticking) {
        ticking = true;
        if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(apply);
        else apply();
      }
    }
    if (typeof window !== "undefined") window.addEventListener("scroll", onScroll, { passive: true });
    apply();
  }
  /* 入口地图的灯点点击：事件委托（点灯点进游戏；键盘回车也行） */
  function bindMapClicks(holder, onNav) {
    if (!holder) return;
    holder.addEventListener("click", function (e) {
      const g = e.target.closest ? e.target.closest(".lamp-point") : null;
      if (g && g.getAttribute("data-href")) onNav(g.getAttribute("data-href"));
    });
    holder.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("lamp-point")) {
        e.preventDefault();
        onNav(e.target.getAttribute("data-href"));
      }
    });
  }

  const API = { svg: svg, mount: mount, bindMapClicks: bindMapClicks, scenes: Object.keys(SCENES) };
  if (typeof window !== "undefined") window.FogBackdrop = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();

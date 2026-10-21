/* Repris de trottinette-freestyle/js/tricks.js (noms et points des figures). */
/* ═══════════════════════════════════════════════════════════
   FIGURES : noms, points, gaps et livre des figures
   ═══════════════════════════════════════════════════════════ */
export const Tricks = (() => {
  const TAU = Math.PI * 2;

  const GRABS = {
    noHander: { name: 'No-hander', pts: 250 },
    xup: { name: 'X-up', pts: 300 },
    superman: { name: 'Superman', pts: 450 },
    canCan: { name: 'Can-can', pts: 350 },
    tuckNoHander: { name: 'Tuck no-hander', pts: 400 },
  };

  const GRINDS = {
    fiftyFifty: { name: '50-50', pts: 150 },
    nose: { name: 'Nose grind', pts: 250 },
    feeble: { name: 'Feeble', pts: 220 },
    smith: { name: 'Smith', pts: 220 },
    crooked: { name: 'Crooked', pts: 280 },
  };

  /* Gaps : décollage depuis un module, réception sur un autre */
  const GAPS = [
    { from: 'Funbox montée', to: ['Funbox descente'], name: 'Funbox gap', pts: 300 },
    { from: 'Saut moyen', to: ['Réception moyenne'], name: 'Gap moyen', pts: 250 },
    { from: 'Gros saut', to: ['Réception du gros saut'], name: 'Gros gap', pts: 700 },
    { from: 'Plateforme', to: [null], name: '5 marches', pts: 350, minDrop: 1.0 },
    { from: 'Escalier', to: [null], name: '5 marches', pts: 350, minDrop: 0.7 },
    { from: 'Tour de départ', to: [null, 'Roll-in'], name: 'Drop de la tour', pts: 500, minDrop: 2.5 },
  ];

  function multiName(n, one, names) { return n <= 0 ? '' : (names[n - 1] || `${n}× ${one}`); }

  /* Résumé d'un saut → { name, pts, summary } (null si rien à compter) */
  function scoreAir(a) {
    const s = {
      spinDeg: Math.round(Math.abs(a.spin) / Math.PI) * 180,
      flips: Math.round(Math.abs(a.flip) / TAU),
      back: a.flip < 0,
      whipsT: a.whipsT, whipsH: a.whipsH,
      barsF: a.barsF, barsB: a.barsB,
      grabs: Object.keys(a.grabs).filter(k => a.grabs[k] > 0.12),
      vert: a.vert, airTime: a.airTime, height: a.height, flat: !a.launchName && !a.fromRail,
      gap: null,
    };
    let pts = 0, cats = 0;
    const parts = [];

    if (s.spinDeg >= 180) {
      cats++;
      const h = s.spinDeg / 180;
      parts.push(String(s.spinDeg));
      pts += 180 * h * (1 + 0.3 * (h - 1));
    }

    const bars = s.barsF + s.barsB;
    const whips = s.whipsT + s.whipsH;
    let flipName = '';
    if (s.flips > 0) {
      cats++;
      const base = s.back ? 'Backflip' : 'Frontflip';
      flipName = (s.flips === 2 ? 'Double ' : s.flips === 3 ? 'Triple ' : '') + base;
      if (a.vert && s.back && s.flips === 1) flipName = 'Flair';
      pts += s.flips * (s.back ? 900 : 1150) * (s.flips > 1 ? 1.7 : 1);
    }
    let barName = '';
    if (bars > 0) {
      cats++;
      barName = s.barsB > 0 && s.barsF === 0
        ? multiName(bars, 'barspin inversé', ['Barspin inversé', 'Double barspin inversé', 'Triple barspin inversé'])
        : multiName(bars, 'barspin', ['Barspin', 'Double barspin', 'Triple barspin', 'Quad barspin']);
      for (let i = 0; i < bars; i++) pts += [300, 450, 700, 1000][Math.min(3, i)];
    }
    if (flipName === 'Backflip' && bars === 1 && whips === 0) { flipName = 'Bri flip'; barName = ''; pts += 250; }

    if (flipName) parts.push(flipName);
    if (whips > 0) {
      cats++;
      let n;
      if (s.whipsH === 0) n = multiName(whips, 'tailwhip', [flipName ? 'Tailwhip' : 'Tailwhip', 'Double whip', 'Triple whip', 'Quad whip']);
      else if (s.whipsT === 0) n = multiName(whips, 'heelwhip', ['Heelwhip', 'Double heelwhip', 'Triple heelwhip']);
      else n = `Whip ${s.whipsT}+${s.whipsH} heel`;
      if (flipName === 'Flair' && whips === 1 && s.whipsH === 0) n = 'Whip';
      parts.push(n);
      for (let i = 0; i < whips; i++) pts += [400, 650, 1000, 1500][Math.min(3, i)] * (s.whipsH > 0 ? 1.12 : 1);
    }
    if (barName) parts.push(barName);

    for (const g of s.grabs) {
      cats++;
      parts.push(GRABS[g].name);
      pts += GRABS[g].pts + a.grabs[g] * 260;
    }

    if (cats > 1) pts *= 1 + 0.3 * (cats - 1);
    pts += Math.max(0, a.airTime - 0.3) * 80 + Math.max(0, a.height - 0.6) * 90;

    let name = parts.join(' ');
    if (!name) {
      if ((a.airTime < 0.32 && !a.vert) || a.fromRail) return null;
      name = a.vert ? 'Air' : a.fromRail ? 'Sortie de rail' : a.launchName ? 'Saut' : 'Bunny hop';
      pts += a.vert ? 100 : 40;
    }

    // Gaps
    for (const g of GAPS) {
      if (a.launchName !== g.from) continue;
      if (!g.to.includes(a.landName)) continue;
      if (g.minDrop && a.drop < g.minDrop) continue;
      s.gap = g.name;
      name += ` + ${g.name}`;
      pts += g.pts;
      break;
    }
    if (a.height > 3.2) { name += ' (Big air)'; pts += 300; }

    return { name, pts: Math.round(pts / 10) * 10, summary: s };
  }

  function scoreGrind(type, time, railName) {
    const g = GRINDS[type];
    return { name: g.name, pts: Math.round((g.pts + time * 320) / 10) * 10, summary: { grind: type, time, rail: railName } };
  }

  function scoreManual(nose, time) {
    return { name: nose ? 'Nose manual' : 'Manual', pts: Math.round((nose ? 120 : 80) + time * 180), summary: { manual: true, nose, time } };
  }

  /* ── Livre des figures, de la plus simple à la plus dure ── */
  const air = f => s => s && s.airTime !== undefined && f(s);
  const BOOK = [
    { id: 'hop', name: 'Bunny hop', keys: 'Espace (maintenir = plus haut)', stars: 1, test: air(s => s.flat && s.airTime > 0.32) },
    { id: 'manual', name: 'Manual (2 s)', keys: 'Maj. au sol · équilibre Z / S', stars: 1, test: s => s.manual && !s.nose && s.time >= 2 },
    { id: '5050', name: 'Grind 50-50', keys: 'Atterrir sur un rail ou un ledge', stars: 1, test: s => s.grind === 'fiftyFifty' },
    { id: '180', name: '180', keys: 'Q ou D en l’air', stars: 1, test: air(s => s.spinDeg === 180) },
    { id: 'vertair', name: 'Air au quarter (1 m)', keys: 'Monter un quarter à fond', stars: 1, test: air(s => s.vert && s.height > 1) },
    { id: 'bar', name: 'Barspin', keys: 'K', stars: 2, test: air(s => s.barsF + s.barsB >= 1) },
    { id: 'nohander', name: 'No-hander', keys: 'L (maintenir)', stars: 2, test: air(s => s.grabs.includes('noHander')) },
    { id: 'whip', name: 'Tailwhip', keys: 'J', stars: 2, test: air(s => s.whipsT >= 1) },
    { id: 'xup', name: 'X-up', keys: 'L + Z', stars: 2, test: air(s => s.grabs.includes('xup')) },
    { id: 'feeble', name: 'Feeble grind', keys: 'S au contact du rail', stars: 2, test: s => s.grind === 'feeble' },
    { id: 'smith', name: 'Smith grind', keys: 'Q au contact du rail', stars: 2, test: s => s.grind === 'smith' },
    { id: '360', name: '360', keys: 'Q ou D maintenu', stars: 2, test: air(s => s.spinDeg === 360) },
    { id: 'cancan', name: 'Can-can', keys: 'L + Q', stars: 3, test: air(s => s.grabs.includes('canCan')) },
    { id: 'nosemanual', name: 'Nose manual (2 s)', keys: 'Maj. + Z au sol', stars: 3, test: s => s.manual && s.nose && s.time >= 2 },
    { id: 'crooked', name: 'Crooked / Nose grind', keys: 'D ou Z au contact', stars: 3, test: s => s.grind === 'crooked' || s.grind === 'nose' },
    { id: 'dbar', name: 'Double barspin', keys: 'K K', stars: 3, test: air(s => s.barsF + s.barsB >= 2) },
    { id: 'heel', name: 'Heelwhip', keys: 'U', stars: 3, test: air(s => s.whipsH >= 1) },
    { id: 'superman', name: 'Superman', keys: 'L + S', stars: 3, test: air(s => s.grabs.includes('superman')) },
    { id: 'tucknh', name: 'Tuck no-hander', keys: 'L + D', stars: 3, test: air(s => s.grabs.includes('tuckNoHander')) },
    { id: 'barwhip', name: 'Barspin + tailwhip', keys: 'K puis J (même saut)', stars: 3, test: air(s => s.barsF + s.barsB >= 1 && s.whipsT + s.whipsH >= 1) },
    { id: '360whip', name: '360 tailwhip', keys: 'Q/D + J', stars: 4, test: air(s => s.spinDeg >= 360 && s.whipsT + s.whipsH >= 1) },
    { id: 'dwhip', name: 'Double whip', keys: 'J J', stars: 4, test: air(s => s.whipsT + s.whipsH >= 2) },
    { id: '540', name: '540', keys: 'Q ou D maintenu (gros saut)', stars: 4, test: air(s => s.spinDeg >= 540) },
    { id: 'backflip', name: 'Backflip', keys: 'S maintenu en l’air', stars: 4, test: air(s => s.flips >= 1 && s.back) },
    { id: 'flair', name: 'Flair', keys: 'Backflip sur un quarter', stars: 4, test: air(s => s.flips === 1 && s.back && s.vert) },
    { id: 'frontflip', name: 'Frontflip', keys: 'Z maintenu en l’air', stars: 4, test: air(s => s.flips >= 1 && !s.back) },
    { id: 'briflip', name: 'Bri flip', keys: 'Backflip + K', stars: 5, test: air(s => s.flips >= 1 && s.back && s.barsF + s.barsB >= 1) },
    { id: 'bfwhip', name: 'Backflip tailwhip', keys: 'Backflip + J', stars: 5, test: air(s => s.flips >= 1 && s.back && s.whipsT + s.whipsH >= 1) },
    { id: 'twhip', name: 'Triple whip', keys: 'J J J', stars: 5, test: air(s => s.whipsT + s.whipsH >= 3) },
    { id: 'ffwhip', name: 'Frontflip tailwhip', keys: 'Frontflip + J', stars: 5, test: air(s => s.flips >= 1 && !s.back && s.whipsT + s.whipsH >= 1) },
    { id: 'dbf', name: 'Double backflip', keys: 'S maintenu longtemps (gros saut)', stars: 5, test: air(s => s.flips >= 2 && s.back) },
    { id: 'bfdwhip', name: 'Backflip double whip', keys: 'Backflip + J J', stars: 5, test: air(s => s.flips >= 1 && s.back && s.whipsT + s.whipsH >= 2) },
  ];

  /* Défis propres au park */
  const CHALLENGES = [
    { id: 'gap-fun', name: 'Passer la funbox d’un saut', test: s => s.gap === 'Funbox gap' },
    { id: 'gap-big', name: 'Franchir le gros gap', test: s => s.gap === 'Gros gap' },
    { id: 'stairs', name: 'Sauter les 5 marches', test: s => s.gap === '5 marches' },
    { id: 'tower', name: 'Sauter de la tour de départ', test: s => s.gap === 'Drop de la tour' },
    { id: 'handrail', name: 'Grinder la main courante', test: s => s.grind && s.rail === 'Main courante' },
    { id: 'coping', name: 'Grinder un coping', test: s => s.grind && s.rail === 'coping' },
    { id: 'vert2', name: 'Air de 2 m sur un quarter', test: s => s.vert && s.height >= 2 },
    { id: 'combo5', name: 'Combo de 5 figures', test: (s, c) => c && c.count >= 5 },
    { id: 'combo10k', name: 'Combo à 10 000 points', test: (s, c) => c && c.total >= 10000 },
    { id: 'session20k', name: '20 000 points en session 2 min', test: (s, c) => c && c.session >= 20000 },
  ];

  return { scoreAir, scoreGrind, scoreManual, BOOK, CHALLENGES, GRABS, GRINDS };
})();

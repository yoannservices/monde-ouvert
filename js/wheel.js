/* Roue de sélection des véhicules (façon roue des armes de GTA V).
   Maintenir Tab : la roue s'ouvre et le temps ralentit. Survoler une catégorie fait apparaître
   ses véhicules autour d'elle ; relâcher Tab (ou cliquer) fait apparaître le véhicule survolé. */
const ICONS = {
  car: '<path d="M6 30l5-11c1-2 3-3 5-3h20c2 0 4 1 5 3l5 11h3c1 0 2 1 2 2v7c0 1-1 2-2 2h-3a6 6 0 0 1-12 0H22a6 6 0 0 1-12 0H6c-1 0-2-1-2-2v-7c0-1 1-2 2-2zm9-1h28l-4-8c0-1-1-1-2-1H19c-1 0-2 0-2 1z"/>',
  bike: '<path d="M13 40a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm38 4a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM13 32l9-12h12l6-6h8l-3 4h-3l-5 6 8 8h-4l-7-7-8 7H22l5-8h-4z"/>',
  heli: '<path d="M8 10h48v3H34v4h3c7 0 12 5 13 10l1 6c0 2-1 3-3 3H24c-3 0-5-2-6-4l-1-2H6l-2-6h12l2-3c2-3 6-4 10-4h3v-4H8zm22 10c-3 0-5 2-5 5v3h12v-8zM20 42h30v3H20z"/>',
  plane: '<path d="M30 6c2 0 3 2 3 5v12l21 11v5l-21-6v11l7 5v4l-10-3-10 3v-4l7-5V33l-21 6v-5l21-11V11c0-3 1-5 3-5z"/>',
  drone: '<path d="M10 14a6 6 0 1 1 0 .1zM54 14a6 6 0 1 1 0 .1zM10 50a6 6 0 1 1 0 .1zM54 50a6 6 0 1 1 0 .1zM14 18l12 10h12l12-10 2 2-11 10v4l11 10-2 2-12-10H26L14 46l-2-2 11-10v-4L12 20z"/>',
};

export function createWheel(cats, onPick) {
  const el = document.getElementById('wheel'), svg = el.querySelector('svg'), center = el.querySelector('.wcenter'), cards = el.querySelector('.wcards');
  const N = cats.length, segA = Math.PI * 2 / N;
  let open = false, hoverCat = -1, hoverVeh = -1, current = null, R_IN = 90, R_OUT = 220, cx = 0, cy = 0;
  const lastPick = cats.map(() => 0);
  let mx = innerWidth / 2, my = innerHeight / 2;

  function layout() {
    const s = Math.min(innerWidth, innerHeight);
    R_OUT = Math.max(150, Math.min(240, s * 0.26)); R_IN = R_OUT * 0.42;
    cx = innerWidth / 2; cy = innerHeight / 2;
    svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    let h = `<defs><radialGradient id="wg" cx="50%" cy="50%" r="50%"><stop offset="40%" stop-color="rgba(10,14,20,.0)"/><stop offset="100%" stop-color="rgba(10,14,20,.55)"/></radialGradient></defs>`;
    cats.forEach((c, i) => {
      const a0 = -Math.PI / 2 - segA / 2 + i * segA + 0.025, a1 = a0 + segA - 0.05;
      const p = (r, a) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
      h += `<path class="seg" data-i="${i}" d="M${p(R_IN, a0)} L${p(R_OUT, a0)} A${R_OUT} ${R_OUT} 0 0 1 ${p(R_OUT, a1)} L${p(R_IN, a1)} A${R_IN} ${R_IN} 0 0 0 ${p(R_IN, a0)}Z"/>`;
      const am = (a0 + a1) / 2, rm = (R_IN + R_OUT) / 2, ix = cx + Math.cos(am) * rm, iy = cy + Math.sin(am) * rm, sc = R_OUT / 240;
      h += `<g class="ico" data-i="${i}" transform="translate(${ix - 26 * sc} ${iy - 34 * sc}) scale(${0.82 * sc})">${ICONS[c.icon]}</g>`;
      h += `<text class="lbl" data-i="${i}" x="${ix}" y="${iy + 34 * sc}" text-anchor="middle">${c.name}</text>`;
    });
    svg.innerHTML = h;
  }
  function vehAngles(ci) {
    const n = cats[ci].items.length, am = -Math.PI / 2 + ci * segA, step = Math.min(0.36, (segA * 1.6) / Math.max(1, n));
    return cats[ci].items.map((_, k) => am + (k - (n - 1) / 2) * step);
  }
  function renderCards() {
    cards.innerHTML = '';
    if (hoverCat < 0) return;
    const angs = vehAngles(hoverCat), rc = R_OUT + Math.max(70, R_OUT * 0.42);
    cats[hoverCat].items.forEach((v, k) => {
      const d = document.createElement('button');
      d.className = 'wcard' + (k === hoverVeh ? ' on' : '') + (current === v.id ? ' cur' : '');
      d.style.left = (cx + Math.cos(angs[k]) * rc) + 'px'; d.style.top = (cy + Math.sin(angs[k]) * rc) + 'px';
      d.style.animationDelay = (k * 40) + 'ms';
      d.innerHTML = `${v.thumb ? `<img src="${v.thumb}" alt="">` : '<i></i>'}<span>${v.name}</span>`;
      d.addEventListener('pointerenter', () => { hoverVeh = k; lastPick[hoverCat] = k; refresh(false); });
      d.addEventListener('click', e => { e.stopPropagation(); hoverVeh = k; close(true); });
      cards.appendChild(d);
    });
  }
  function refresh(rebuild = true) {
    svg.querySelectorAll('.seg,.ico,.lbl').forEach(n => n.classList.toggle('on', +n.dataset.i === hoverCat));
    if (rebuild) renderCards();
    else cards.querySelectorAll('.wcard').forEach((c, k) => c.classList.toggle('on', k === hoverVeh));
    const v = hoverCat >= 0 ? cats[hoverCat].items[hoverVeh >= 0 ? hoverVeh : lastPick[hoverCat]] : null;
    center.innerHTML = v ? `<b>${v.name}</b><small>${v.desc}</small>${current === v.id ? '<em>Véhicule actuel</em>' : ''}` : '<b>Véhicules</b><small>Survole une catégorie</small>';
  }
  function track(x, y) {
    mx = x; my = y;
    if (!open) return;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d < R_IN * 0.55) return;
    const a = Math.atan2(dy, dx);
    if (d < R_OUT + 10) {
      let i = Math.round((a + Math.PI / 2) / segA); i = ((i % N) + N) % N;
      if (i !== hoverCat) { hoverCat = i; hoverVeh = -1; refresh(true); }
    } else if (hoverCat >= 0) {
      const angs = vehAngles(hoverCat); let best = -1, bd = 1e9;
      angs.forEach((b, k) => { let dd = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); if (dd < bd) { bd = dd; best = k; } });
      if (bd < 0.4 && best !== hoverVeh) { hoverVeh = best; lastPick[hoverCat] = best; refresh(false); }
    }
  }
  function show() {
    if (open) return;
    open = true; layout(); el.classList.add('on');
    const ci = cats.findIndex(c => c.items.some(v => v.id === current));
    hoverCat = ci; hoverVeh = ci >= 0 ? cats[ci].items.findIndex(v => v.id === current) : -1;
    if (ci >= 0) lastPick[ci] = hoverVeh;
    refresh(true);
  }
  function close(confirm) {
    if (!open) return;
    open = false; el.classList.remove('on');
    if (confirm && hoverCat >= 0) {
      const v = cats[hoverCat].items[hoverVeh >= 0 ? hoverVeh : lastPick[hoverCat]];
      if (v && v.id !== current) onPick(v.id);
    }
    cards.innerHTML = '';
  }
  addEventListener('pointermove', e => track(e.clientX, e.clientY));
  addEventListener('resize', () => { if (open) { layout(); refresh(true); } });
  el.addEventListener('click', e => { if (e.target.closest('.seg')) close(true); });
  el.addEventListener('wheel', e => {
    if (!open || hoverCat < 0) return;
    const n = cats[hoverCat].items.length, cur = hoverVeh >= 0 ? hoverVeh : lastPick[hoverCat];
    hoverVeh = (cur + (e.deltaY > 0 ? 1 : -1) + n) % n; lastPick[hoverCat] = hoverVeh; refresh(false);
  }, { passive: true });
  return {
    show, close, get isOpen() { return open; },
    setCurrent(id) { current = id; },
    setThumb(id, url) { for (const c of cats) for (const v of c.items) if (v.id === id) v.thumb = url; },
  };
}

// Qualité graphique commune des jeux Three.js : distance d'affichage à 3 seuils (proche / moyen / rien), brouillard calé sur la coupure,
// camera.far réduit, ombres plus légères ou coupées, plafond 30 FPS. Branché par perf.js (aucun changement dans le code des jeux).
// Réglages sauvegardés dans localStorage. Échelle de distance par jeu : <html data-lod="3"> (défaut 1 ; un simulateur de vol met 8).
const KEY = 'site.quality.v2'; // v2 : tout le monde repart en qualité Moyen
export const LEVELS = {
  haut: { name: 'Haut', d1: 140, d2: 700, shadow: 2048 },
  moyen: { name: 'Moyen', d1: 90, d2: 420, shadow: 1024 },
  bas: { name: 'Bas', d1: 55, d2: 240, shadow: 512 },
};
const ORDER = ['haut', 'moyen', 'bas'];
export const Q = { mode: 'moyen', shadows: true, fps30: false, auto: 'haut', dist: 'normal', small: true, guide: 'both' }; // mode : auto | haut | moyen | bas ; auto = niveau choisi selon les FPS
try { Object.assign(Q, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* stockage indisponible */ }
if (Q.mode !== 'auto' && !LEVELS[Q.mode]) Q.mode = 'moyen';
const DIST = { court: 0.6, normal: 1, long: 1.6 };
if (!DIST[Q.dist]) Q.dist = 'normal';
if (!['both', 'haut', 'sol'].includes(Q.guide)) Q.guide = 'both';
Q.auto = 'haut';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ mode: Q.mode, shadows: Q.shadows, fps30: Q.fps30, dist: Q.dist, small: Q.small, guide: Q.guide })); } catch (e) { /* ignoré */ } };

export const level = () => LEVELS[Q.mode === 'auto' ? Q.auto : Q.mode];
export const maxFps = () => (Q.fps30 ? 30 : 60);
const lodScale = () => { const v = typeof document !== 'undefined' ? parseFloat(document.documentElement.dataset.lod) : NaN; return v > 0 ? v : 1; };

// Mode auto : si la résolution est déjà au plus bas et que ça rame encore, on raccourcit les distances ; quand tout va bien longtemps, on les rallonge.
let slow = 0, fast = 0;
export function autoTick(avgMs, resScale, dtMs) {
  if (Q.mode !== 'auto') return;
  if (avgMs > 1000 / 38 && resScale <= 0.6) { slow += dtMs; fast = 0; } else if (avgMs < 1000 / 56 && resScale >= 0.99) { fast += dtMs; slow = 0; } else { slow = Math.max(0, slow - dtMs); fast = Math.max(0, fast - dtMs); }
  const i = ORDER.indexOf(Q.auto);
  if (slow > 3000 && i < 2) { Q.auto = ORDER[i + 1]; slow = 0; }
  else if (fast > 20000 && i > 0) { Q.auto = ORDER[i - 1]; fast = 0; }
}

// ---------- état par objet (propriétés préfixées __q : jamais écrasées par les jeux) ----------
const skipObj = o => o.isSkinnedMesh || o.isSprite || (o.userData && o.userData.noLod);
const matOf = o => (Array.isArray(o.material) ? o.material[0] : o.material);

function sphereOf(o) {
  const g = o.geometry; if (!g) return null;
  let s = o.isInstancedMesh && o.boundingSphere !== undefined ? (o.boundingSphere || (o.computeBoundingSphere(), o.boundingSphere)) : (g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere));
  return s;
}

// Parcours (toutes les 8 images) : distance à la caméra -> proche / moyen (sans ombre projetée) / loin (masqué). Retourne le rayon du plus grand ciel détecté.
function sweep(root, cam, d1, d2, shadowsOn, lvl, small) {
  const cp = cam.matrixWorld.elements; const cx = cp[12], cy = cp[13], cz = cp[14];
  let skyR = 0;
  const visit = o => {
    if (o.isLight && o.shadow) lightShadow(o, shadowsOn, lvl);
    if (!o.visible && !o.__qHid) return; // masqué par le jeu : on ne touche pas à ses enfants
    if ((o.isMesh || o.isPoints || o.isLine) && o.geometry && !skipObj(o)) {
      const sp = sphereOf(o), m = matOf(o);
      if (sp) {
        const e = o.matrixWorld.elements, sc = Math.max(1e-6, Math.sqrt(Math.max(e[0] * e[0] + e[1] * e[1] + e[2] * e[2], e[4] * e[4] + e[5] * e[5] + e[6] * e[6], e[8] * e[8] + e[9] * e[9] + e[10] * e[10])));
        const r = sp.radius * sc;
        const px = e[0] * sp.center.x + e[4] * sp.center.y + e[8] * sp.center.z + e[12], py = e[1] * sp.center.x + e[5] * sp.center.y + e[9] * sp.center.z + e[13], pz = e[2] * sp.center.x + e[6] * sp.center.y + e[10] * sp.center.z + e[14];
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2) - r;
        if (m && (m.side === 1 || m.fog === false) && r > 100) { if (r > skyR) skyR = r; if (o.__qHid) { o.visible = true; o.__qHid = false; } }
        else if (r > 0.35 * d2) { if (o.__qHid) { o.visible = true; o.__qHid = false; } } // trop grand pour être coupé (sol, circuit, montagne)
        else if (dist > d2 || (!small && r < 1 && dist > d1 * 0.6)) { if (!o.__qHid) { o.__qHid = true; o.visible = false; } }
        else {
          if (o.__qHid) { o.visible = true; o.__qHid = false; }
          if (dist > d1) { if (o.castShadow && o.__qCs === undefined) { o.__qCs = true; o.castShadow = false; } }
          else if (o.__qCs) { o.castShadow = true; o.__qCs = undefined; }
        }
      }
    }
    const ch = o.children; for (let i = 0; i < ch.length; i++) visit(ch[i]);
  };
  visit(root);
  return skyR;
}

function lightShadow(l, on, lvl) {
  if (l.castShadow && !on) { l.__qOff = true; l.castShadow = false; }
  else if (!l.castShadow && on && l.__qOff) { l.__qOff = false; l.castShadow = true; }
  const sh = l.shadow; if (!sh || !sh.mapSize) return;
  if (sh.__qMs === undefined) sh.__qMs = sh.mapSize.x;
  const t = Math.min(sh.__qMs, lvl.shadow);
  if (sh.mapSize.x !== t) { sh.mapSize.set(t, t); if (sh.map) { sh.map.dispose(); sh.map = null; } }
}

function applyFog(T, scene, d2) {
  let f = scene.fog;
  if (!f) { // pas de brouillard : un léger brouillard de la couleur du fond, seulement si le fond est une couleur unie
    if (!(scene.background && scene.background.isColor)) return;
    f = scene.fog = new T.Fog(scene.background.clone(), d2 * 0.55, d2); f.__q = { far: d2, near: d2 * 0.55, wf: d2, wn: d2 * 0.55, mine: true }; return;
  }
  const st = f.__q || (f.__q = { far: f.far, near: f.near, density: f.density, wf: f.far, wn: f.near, wd: f.density });
  if (f.isFog) {
    if (f.far !== st.wf) { st.far = f.far; st.near = f.near; } // le jeu (météo) a réécrit le brouillard : c'est la nouvelle référence
    const far = Math.min(st.far, d2), near = Math.min(st.near, far * 0.55);
    f.far = st.wf = far; f.near = st.wn = near;
  } else if (f.isFogExp2) {
    if (f.density !== st.wd) st.density = f.density;
    f.density = st.wd = Math.max(st.density, 2 / d2);
  }
}

function applyFar(cam, d2, skyR) {
  const st = cam.__q || (cam.__q = { far: cam.far, set: cam.far });
  if (cam.far !== st.set) st.far = cam.far; // le jeu a changé la portée
  const target = Math.max(Math.min(st.far, d2 * 1.2), skyR * 1.8, cam.near * 10);
  const t = Math.min(st.far, target);
  if (Math.abs(cam.far - t) > 1) { cam.far = st.set = t; cam.updateProjectionMatrix(); }
}

let frame = 0, last = null;
// Appelée par perf.js avant chaque rendu écran d'une scène avec une caméra perspective.
export function frameUpdate(T, scene, cam) {
  const lvl = level(), k = lodScale() * DIST[Q.dist], d1 = lvl.d1 * k, d2 = lvl.d2 * k;
  const key = lvl.d2 + Q.dist + (Q.shadows ? 'S' : 'N') + (Q.small ? 'P' : 'x');
  let skyR = scene.__qSky || 0;
  if (++frame % 8 === 0 || last !== key || scene.__qLast !== key) {
    if (cam.matrixWorld) skyR = scene.__qSky = sweep(scene, cam, d1, d2, Q.shadows, lvl, Q.small);
    scene.__qLast = last = key;
  }
  applyFog(T, scene, d2);
  applyFar(cam, d2, skyR);
}

// ---------- panneau « Réglages » (bouton en bas à gauche + bouton « Réglages » des menus, via window.GameSettings.open()) ----------
// Guidage : <html data-guide="1"> sur les jeux qui ont une aide à la conduite ; ils lisent GameSettings.guide ('haut' | 'sol' | 'both') et l'événement 'gamesettings'.
export function initPanel() {
  if (typeof document === 'undefined' || document.getElementById('q-panel')) return;
  const css = document.createElement('style');
  css.textContent = `#q-panel{position:fixed;inset:0;z-index:100000;display:none;place-items:center;background:rgba(8,10,14,.72);font:14px Inter,system-ui,sans-serif;color:var(--ui-text,#e5e7eb)}
#q-panel.on{display:grid}#q-panel .q-card{width:min(460px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--ui-surface,#0f1115);border:1px solid rgba(255,255,255,.18);border-top:3px solid var(--ui-accent,#22c55e);border-radius:12px;padding:18px 20px}
#q-panel h3{margin:0 0 10px;font-size:18px}#q-panel .r{display:flex;gap:6px 10px;margin:9px 0;flex-wrap:wrap;align-items:center;justify-content:space-between}#q-panel .r>span:first-child{font-weight:600}
#q-panel button{font:inherit;color:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:5px 10px;cursor:pointer}
#q-panel button.sel{background:var(--ui-accent,#22c55e);color:#04130a;border-color:transparent;font-weight:700}#q-panel small{opacity:.65;display:block;margin-top:8px;line-height:1.35}
#q-panel .q-close{width:100%;margin-top:12px;padding:9px}`;
  document.head.appendChild(css);
  const p = document.createElement('div'); p.id = 'q-panel';
  const hasGuide = () => document.documentElement.dataset.guide === '1';
  const seg = (key, opts, cur) => opts.map(([v, n]) => `<button type="button" class="${String(cur) === String(v) ? 'sel' : ''}" data-k="${key}" data-v="${v}">${n}</button>`).join(' ');
  const draw = () => {
    p.innerHTML = `<div class="q-card"><h3>Réglages</h3>
<div class="r"><span>Qualité graphique</span><span>${seg('mode', [['auto', 'Auto'], ...ORDER.map(m => [m, LEVELS[m].name])], Q.mode)}</span></div>
<div class="r"><span>Ombres</span><span>${seg('shadows', [[1, 'Oui'], [0, 'Non']], +Q.shadows)}</span></div>
<div class="r"><span>Distance d'affichage</span><span>${seg('dist', [['court', 'Courte'], ['normal', 'Normale'], ['long', 'Longue']], Q.dist)}</span></div>
<div class="r"><span>Petits objets lointains</span><span>${seg('small', [[1, 'Oui'], [0, 'Non']], +Q.small)}</span></div>
<div class="r"><span>Limite d'images</span><span>${seg('fps30', [[0, '60 FPS'], [1, '30 FPS']], +Q.fps30)}</span></div>
${hasGuide() ? `<div class="r"><span>Guidage de conduite</span><span>${seg('guide', [['haut', 'Flèche en haut'], ['sol', 'Flèche au sol'], ['both', 'Les deux']], Q.guide)}</span></div>` : ''}
<small>Auto s'adapte aux FPS${Q.mode === 'auto' ? ' (niveau actuel : ' + LEVELS[Q.auto].name + ')' : ''}. La qualité règle la distance d'affichage, le brouillard, la portée de la caméra et la taille des ombres. Réglages gardés sur cet appareil.</small>
<button type="button" class="q-close" data-close>Fermer</button></div>`;
  };
  p.addEventListener('click', e => {
    if (e.target === p || e.target.closest('[data-close]')) { p.classList.remove('on'); return; }
    const t = e.target.closest('button[data-k]'); if (!t) return;
    const k = t.dataset.k, v = t.dataset.v;
    if (k === 'mode' || k === 'dist' || k === 'guide') Q[k] = v; else if (k === 'shadows' || k === 'small') Q[k] = v === '1'; else Q.fps30 = v === '1';
    save(); draw(); dispatchEvent(new CustomEvent('gamesettings', { detail: { ...Q } }));
  });
  const open = () => { draw(); p.classList.add('on'); };
  for (const ev of ['keydown', 'keyup']) p.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'keydown' && e.code === 'Escape') p.classList.remove('on'); });
  document.body.append(p);
  // Flèche de guidage en haut de l'écran : arrow(rel) avec rel = angle (rad) de la cible par rapport au cap, positif = à gauche ; arrow(null) la cache.
  let ar = null;
  const arrow = rel => {
    if (rel == null || Q.guide === 'sol') { if (ar) ar.style.display = 'none'; return; }
    if (!ar) { ar = document.createElement('div'); ar.setAttribute('aria-hidden', 'true'); ar.style.cssText = 'position:fixed;top:16px;left:50%;margin-left:-26px;width:52px;height:52px;z-index:5;pointer-events:none;filter:drop-shadow(0 2px 4px #000a)'; ar.innerHTML = '<svg viewBox="0 0 64 64"><path d="M32 4 L56 30 H41 V60 H23 V30 H8 Z" fill="#22c55e" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>'; document.body.append(ar); }
    ar.style.display = 'block'; ar.style.transform = `rotate(${-rel}rad)`;
    clearTimeout(ar._t); ar._t = setTimeout(() => { ar.style.display = 'none'; }, 250); // plus d'appel (pause, menu) : la flèche disparaît
  };
  // Menu de pause (touche Échap ou bouton ❚❚) : un bouton « Reprendre » visible reçoit un bouton Réglages juste après lui.
  const injectPause = () => {
    for (const b of document.querySelectorAll('button')) {
      if (!/^\s*(▶\s*)?Reprendre/i.test(b.textContent) || !b.getClientRects().length || b.closest('#q-panel')) continue;
      const host = b.parentElement;
      if (host.querySelector('.q-set') || host.closest('.hk-card')?.querySelector('.hk-set')) continue;
      const n = b.cloneNode(false); n.className = b.className.split(' ').filter(c => !['primary', 'go', 'hk-primary'].includes(c)).join(' ').trim() + ' q-set'; n.removeAttribute('id'); n.removeAttribute('data-act'); n.removeAttribute('data-a');
      n.textContent = '⚙ Réglages'; n.type = 'button'; n.onclick = e => { e.stopPropagation(); open(); };
      b.after(n);
    }
  };
  setInterval(injectPause, 400);
  window.GameSettings = { Q, open, close: () => p.classList.remove('on'), arrow, get guide() { return Q.guide; } };
}
if (typeof document !== 'undefined') { if (document.body) initPanel(); else addEventListener('DOMContentLoaded', initPanel); }

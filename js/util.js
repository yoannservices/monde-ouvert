/* Petits utilitaires partagés : maths, bruit, aléatoire reproductible */
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const approach = (c, t, d) => c < t ? Math.min(c + d, t) : Math.max(c - d, t);
export const wrapPi = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hash2(ix, iz) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
/* fbm dans [0,1] */
export function fbm(x, z, o = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, z * f - i * 9.1); n += a; f *= 2.03; a *= 0.5; }
  return s / n;
}
/* bruit « en crêtes » dans [0,1] : arêtes vives pour les montagnes */
export function ridged(x, z, o = 5) {
  let s = 0, a = 0.5, f = 1, n = 0, w = 1;
  for (let i = 0; i < o; i++) {
    let v = 1 - Math.abs(vnoise(x * f + i * 31.7, z * f + i * 11.3) * 2 - 1);
    v *= v; v *= w; w = clamp(v * 1.6, 0, 1);
    s += a * v; n += a; f *= 2.1; a *= 0.5;
  }
  return s / n;
}
/* distance d'un point à un segment */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function polyDist(px, pz, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

/* Grille de hachage spatial pour les collisions */
export class SpatialGrid {
  constructor(cell = 32) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = this.key(i, j); let l = this.map.get(k);
        if (!l) { l = []; this.map.set(k, l); }
        l.push(item);
      }
  }
  /* appelle fn(item) pour chaque objet proche (un objet peut revenir plusieurs fois si r > cell) */
  query(x, z, r, fn) {
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.map.get(this.key(i, j));
      if (l) for (let n = 0; n < l.length; n++) fn(l[n]);
    }
  }
}

export function canvasTexture(THREE, w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = o.aniso || 8;
  if (o.color !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  return t;
}

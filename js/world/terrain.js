/* ===== Relief, routes et surfaces de la carte =====
   Repère : x = est, z = sud (le nord est vers -z), y = altitude en mètres, mer à y = 0.
   La carte fait 8 km de côté : île principale (ville, aéroport, campagne, lac, forêt, désert,
   montagnes au nord), une île au sud-est reliée par un pont et un îlot avec un phare à l'ouest. */
import * as THREE from 'three';
import { clamp, lerp, sstep, fbm, ridged, vnoise, hash2, polyDist, SpatialGrid, canvasTexture } from '../util.js';

export const SIZE = 8000, HALF = SIZE / 2, N = 640, CELL = SIZE / N, NV = N + 1;
export const CITY = { x0: -700, x1: 700, z0: -650, z1: 550, y: 8, pitch: 100, road: 16 };
export const AIRPORT = { x0: 850, x1: 2550, z0: 250, z1: 760, y: 10, rwy: { x0: 980, x1: 2420, z: 540, w: 46 } };
export const STUNT = { x0: 1000, x1: 1510, z0: 800, z1: 1560, y: 12 };   // parc de cascades
export const LAKE = { x: -1250, z: 1620, r: 300, level: 13 };
export const ISLAND = { x: 2950, z: 2750, r: 620 };
export const ISLET = { x: -3450, z: 550, r: 230 };
export const VILLAGE = { x: 2880, z: 2690, r: 170, y: 7 };
export const PASS = [[700, -2050], [350, -2150], [0, -2050], [-350, -2150], [-700, -1950], [-1000, -1650], [-1250, -1300]];

/* Routes hors ville : points de contrôle [x, z], demi-largeur en mètres */
export const ROADS = [
  { name: 'Route du désert', hw: 6.5, pts: [[700, -50], [880, -55], [1150, -200], [1450, -480], [1700, -880], [1680, -1300], [1460, -1660], [1100, -1900], [700, -2050]] },
  { name: 'Col des Aigles', hw: 6, pts: PASS },
  { name: 'Route de la forêt', hw: 6, pts: [[-1250, -1300], [-1600, -900], [-1850, -400], [-1760, 100], [-1350, 260], [-1000, 140], [-700, 50]] },
  { name: 'Route du nord', hw: 6, pts: [[0, -650], [-40, -900], [-220, -1200], [-560, -1450], [-1000, -1650]] },
  { name: 'Route de l\'aéroport', hw: 6.5, pts: [[1150, -200], [1350, 20], [1560, 200], [1700, 250]] },
  { name: 'Route du parc', hw: 6.5, pts: [[700, 450], [860, 620], [960, 780], [1010, 900]] },
  { name: 'Route du sud', hw: 6.5, pts: [[0, 550], [40, 800], [150, 1100], [450, 1450], [900, 1750], [1400, 1960], [1880, 2110], [2150, 2240], [2400, 2400], [2640, 2560], [2830, 2660]] },
  { name: 'Route des champs', hw: 5.5, pts: [[150, 1100], [-300, 1240], [-760, 1200], [-1250, 1180], [-1640, 1400], [-1720, 1820], [-1420, 2160], [-900, 2330], [-400, 2470], [100, 2520], [450, 2200], [470, 1700], [450, 1450]] },
];

/* Tremplins (rampes en coin) : position, cap (direction de montée), longueur, largeur, hauteur */
export const RAMPS = [
  { x: 0, z: -100, yaw: Math.PI, len: 16, w: 9, h: 3.6 },          // avenue centrale
  { x: 1450, z: 360, yaw: 0, len: 22, w: 12, h: 5.5 },              // tarmac de l'aéroport
  { x: 1600, z: -1150, yaw: -2.4, len: 18, w: 10, h: 4.5 },        // désert
  { x: -30, z: 960, yaw: -1.7, len: 14, w: 8, h: 3 },              // campagne
  { x: 2780, z: 2860, yaw: 0.6, len: 14, w: 8, h: 3.2 },            // île
];

/* ---------- relief naturel ---------- */
function coastR(x, z) {
  const a = Math.atan2(z, x);
  return 3150 + (fbm(Math.cos(a) * 1.7 + 5, Math.sin(a) * 1.7 + 5, 4) - 0.5) * 760;
}
function flattenRect(h, x, z, R, y, blend) {
  const dx = Math.max(R.x0 - x, 0, x - R.x1), dz = Math.max(R.z0 - z, 0, z - R.z1);
  return lerp(y, h, sstep(0, blend, Math.hypot(dx, dz)));
}
export function natural(x, z) {
  const r = Math.hypot(x, z), R = coastR(x, z);
  let land = sstep(R + 80, R - 220, r);
  const dI = Math.hypot(x - ISLAND.x, z - ISLAND.z) * (1 + (fbm(x / 300, z / 300, 3) - 0.5) * 0.45);
  land = Math.max(land, sstep(ISLAND.r + 60, ISLAND.r - 200, dI));
  const dS = Math.hypot(x - ISLET.x, z - ISLET.z);
  land = Math.max(land, sstep(ISLET.r + 30, ISLET.r - 90, dS));
  let h = -40 + land * 44 + (fbm(x / 200, z / 200, 3) - 0.5) * 4;
  const inner = sstep(R - 60, R - 650, r);
  h += inner * (8 + fbm(x / 650, z / 650, 4) * 45);
  // montagnes au nord, creusées par la vallée du col
  const mz = sstep(-950, -1900, z) * inner;
  if (mz > 0) {
    const valley = lerp(0.12, 1, sstep(90, 650, polyDist(x, z, PASS)));
    h += mz * valley * (220 + 820 * ridged(x / 1100, z / 1100, 5));
  }
  // collines boisées à l'ouest
  const fw = sstep(-800, -1600, x) * inner * (1 - mz);
  h += fw * fbm(x / 420 + 3, z / 420, 4) * 95;
  // désert au nord-est : plateaux (mesas)
  const dz = sstep(950, 1500, x) * sstep(-260, -800, z) * (1 - mz * 0.7) * inner;
  if (dz > 0) { const m = fbm(x / 380 + 11, z / 380 - 7, 3); h += dz * (14 + sstep(0.56, 0.6, m) * 70 + sstep(0.67, 0.7, m) * 45); }
  // campagne au sud : relief doux
  h = lerp(h, 10 + (h - 10) * 0.45, sstep(500, 1100, z) * inner);
  // île du sud-est (colline) et îlot rocheux
  const dIs = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  h += sstep(ISLAND.r * 0.9, 0, dIs) * 60 * fbm(x / 160, z / 160, 3);
  h += sstep(ISLET.r * 0.7, 0, dS) * 26;
  // lac
  const dL = Math.hypot(x - LAKE.x, z - LAKE.z) * (1 + (fbm(x / 140, z / 140, 2) - 0.5) * 0.3);
  if (dL < LAKE.r + 200) {
    const bowl = lerp(LAKE.level - 7, LAKE.level + 2.5, sstep(LAKE.r * 0.5, LAKE.r, dL));
    h = lerp(bowl, Math.max(h, LAKE.level + 2.5), sstep(LAKE.r, LAKE.r + 180, dL));
  }
  // zones aplanies
  h = flattenRect(h, x, z, CITY, CITY.y, 170);
  h = flattenRect(h, x, z, AIRPORT, AIRPORT.y, 230);
  h = flattenRect(h, x, z, STUNT, STUNT.y, 200);
  const dV = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h = lerp(VILLAGE.y, h, sstep(VILLAGE.r, VILLAGE.r + 120, dV));
  return h;
}

/* ---------- grille finale ---------- */
const H = new Float32Array(NV * NV);       // hauteur du sol (routes et zones aplanies incluses)
const SURF = new Uint8Array(NV * NV);      // type de surface
export const S_GRASS = 0, S_ROAD = 1, S_SAND = 2, S_SNOW = 3, S_ROCK = 4, S_FIELD = 5, S_WATER = 6, S_FOREST = 7, S_DESERT = 8;
const idx = (i, j) => j * NV + i;
export const gx = x => (x + HALF) / CELL;

export function heightAt(x, z) {
  let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  fx = clamp(fx, 0, N - 1e-4); fz = clamp(fz, 0, N - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NV + i;
  return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + NV] * (1 - u) + H[k + NV + 1] * u) * v;
}
export function normalAt(x, z, out) {
  const e = 3;
  return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
}
export function surfaceAt(x, z) {
  const i = clamp(Math.round((x + HALF) / CELL), 0, N), j = clamp(Math.round((z + HALF) / CELL), 0, N);
  return SURF[idx(i, j)];
}

/* échantillons de routes (pour le placement, la carte et les ponts) */
export const bridgeColParts = [];   // tabliers de ponts (maillage de collision de la Tesla)
export const roadSamples = [];   // {x, z, y, dx, dz, hw, bridge, road}
export const bridgeGrid = new SpatialGrid(24);

function sampleRoad(road) {
  const curve = new THREE.CatmullRomCurve3(road.pts.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
  const len = curve.getLength(), n = Math.max(2, Math.round(len / 4));
  const pts = curve.getSpacedPoints(n);
  const s = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    const nat = natural(p.x, p.z);
    return { x: p.x, z: p.z, nat, y: Math.max(nat, nat < 1.5 ? 9 : 1.5), dx: dx / l, dz: dz / l, hw: road.hw, bridge: nat < 1.5, road };
  });
  // profil en long lissé puis limité à 10 % de pente
  for (let pass = 0; pass < 4; pass++) {
    const y0 = s.map(q => q.y);
    for (let i = 0; i < s.length; i++) {
      let sum = 0, w = 0;
      for (let k = -12; k <= 12; k++) { const q = y0[clamp(i + k, 0, s.length - 1)]; const ww = 1 - Math.abs(k) / 13; sum += q * ww; w += ww; }
      s[i].y = sum / w;
    }
  }
  const g = 0.1 * 4;
  for (let i = 1; i < s.length; i++) s[i].y = clamp(s[i].y, s[i - 1].y - g, s[i - 1].y + g);
  for (let i = s.length - 2; i >= 0; i--) s[i].y = clamp(s[i].y, s[i + 1].y - g, s[i + 1].y + g);
  for (const q of s) if (q.bridge) q.y = Math.max(q.y, 8);
  road.samples = s; road.length = len;
  return s;
}

export function buildTerrain(onProgress) {
  // 1. relief naturel
  const NAT = new Float32Array(NV * NV);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) NAT[idx(i, j)] = natural(-HALF + i * CELL, -HALF + j * CELL);
  onProgress && onProgress('Tracé des routes…');
  // 2. routes : on note pour chaque sommet la route la plus proche
  const RD = new Float32Array(NV * NV).fill(1e9), RY = new Float32Array(NV * NV), RHW = new Float32Array(NV * NV);
  for (const road of ROADS) {
    for (const q of sampleRoad(road)) {
      roadSamples.push(q);
      if (q.bridge) { bridgeGrid.add(q, q.x - 12, q.z - 12, q.x + 12, q.z + 12); continue; }
      const rad = q.hw + 7 + 200, i0 = Math.floor(gx(q.x - rad)), i1 = Math.ceil(gx(q.x + rad)), j0 = Math.floor(gx(q.z - rad)), j1 = Math.ceil(gx(q.z + rad));
      for (let j = Math.max(0, j0); j <= Math.min(N, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(N, i1); i++) {
        const k = idx(i, j), d = Math.hypot(-HALF + i * CELL - q.x, -HALF + j * CELL - q.z);
        if (d < RD[k]) { RD[k] = d; RY[k] = q.y; RHW[k] = q.hw; }
      }
    }
  }
  // 3. hauteur finale : route à plat, talus dont la largeur dépend du dénivelé
  for (let k = 0; k < H.length; k++) {
    let h = NAT[k];
    if (RD[k] < 1e8) {
      const hw = RHW[k] + 7, blend = Math.min(200, 18 + Math.abs(h - RY[k]) * 1.3);
      h = lerp(RY[k], h, sstep(hw, hw + blend, RD[k]));
    }
    H[k] = h;
  }
  // 4. surfaces
  const nrm = new THREE.Vector3();
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = idx(i, j), x = -HALF + i * CELL, z = -HALF + j * CELL, h = H[k];
    const ny = 2 * CELL / Math.hypot(H[idx(Math.max(0, i - 1), j)] - H[idx(Math.min(N, i + 1), j)], 2 * CELL, H[idx(i, Math.max(0, j - 1))] - H[idx(i, Math.min(N, j + 1))]);
    let s = S_GRASS;
    const inLake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.1 && h < LAKE.level;
    if (h < 0.3 || inLake) s = S_WATER;
    else if (RD[k] < RHW[k] + 1 || inRect(x, z, CITY, 0) || inRect(x, z, STUNT, 0) || onRunway(x, z, 8)) s = S_ROAD;
    else if (h > 640 + (vnoise(x / 90, z / 90) - 0.5) * 140 && ny > 0.55) s = S_SNOW;
    else if (ny < 0.72) s = S_ROCK;
    else if (h < 3.2) s = S_SAND;
    else if (isDesert(x, z)) s = S_DESERT;
    else if (z > 650 + (vnoise(x / 260, 3) - 0.5) * 300 && Math.hypot(x, z) < coastR(x, z) - 260 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 60) s = S_FIELD;
    else if (x < -800 || (z < -950 && h < 520) || Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r && h > 14) s = S_FOREST;
    SURF[k] = s;
  }
}
export function isDesert(x, z) {
  const n = vnoise(x / 220, z / 220) - 0.5;
  return x > 980 + n * 260 && z < -280 + n * 220 && z > -2350 && Math.hypot(x, z) < coastR(x, z) - 60 && !(z < -1500 && x < 1500 + n * 200);
}
export function inRect(x, z, R, m = 0) { return x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m; }
export function onRunway(x, z, m = 0) { const r = AIRPORT.rwy; return x > r.x0 - m && x < r.x1 + m && Math.abs(z - r.z) < r.w / 2 + m; }

/* ---------- maillage du relief ---------- */
const PAL = {
  grass: [0x5f8a3c, 0x6f9443, 0x557d35], forest: [0x3f6230, 0x4a6b33], field: [0xc9b55a, 0x8fa543, 0x7a5c3a, 0xa9c05a, 0xd6c072, 0x6f8f3a],
  sand: 0xdcc893, desert: [0xd6a66b, 0xc98e55], rock: 0x7f766a, redrock: 0xa8623f, snow: 0xf3f5f8, road: 0x5a5b5d, seabed: 0x8d8262, lakebed: 0x5d5a44,
};
export function buildTerrainMesh(renderer) {
  const group = new THREE.Group();
  const detail = canvasTexture(THREE, 256, 256, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = (fbm(x / 9, y / 9, 3) * 0.6 + Math.random() * 0.4);
      const v = 200 + n * 55; const k = (y * w + x) * 4;
      d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95, metalness: 0 });
  const CH = 64, col = new THREE.Color(), c2 = new THREE.Color();
  const pick = (a, x, z, s = 1) => Array.isArray(a) ? a[Math.floor(hash2(Math.floor(x / s), Math.floor(z / s) + 77) * a.length)] : a;
  // couleurs et normales calculées une fois pour toute la grille
  const COL = new Float32Array(NV * NV * 3), NOR = new Float32Array(NV * NV * 3);
  for (let J = 0; J < NV; J++) for (let I = 0; I < NV; I++) {
    const k = idx(I, J), x = -HALF + I * CELL, z = -HALF + J * CELL, h = H[k];
    const hl = H[idx(Math.max(0, I - 1), J)], hr = H[idx(Math.min(N, I + 1), J)], hu = H[idx(I, Math.max(0, J - 1))], hd = H[idx(I, Math.min(N, J + 1))];
    const nx = hl - hr, ny = 2 * CELL, nz = hu - hd, nl = Math.hypot(nx, ny, nz);
    NOR[k * 3] = nx / nl; NOR[k * 3 + 1] = ny / nl; NOR[k * 3 + 2] = nz / nl;
    const s = SURF[k], var1 = vnoise(x / 60, z / 60);
    switch (s) {
      case S_WATER: col.setHex(h < -3 ? PAL.seabed : PAL.lakebed); break;
      case S_ROAD: col.setHex(PAL.road); break;
      case S_SNOW: col.setHex(PAL.snow); break;
      case S_ROCK: col.setHex(x > 900 && z < -200 ? PAL.redrock : PAL.rock); break;
      case S_SAND: col.setHex(PAL.sand); break;
      case S_DESERT: col.setHex(pick(PAL.desert, x, z, 90)); break;
      case S_FIELD: { const a = 0.32, u = x * Math.cos(a) - z * Math.sin(a), w = x * Math.sin(a) + z * Math.cos(a); col.setHex(pick(PAL.field, u + 900, w + 900, 130)); break; }
      case S_FOREST: col.setHex(pick(PAL.forest, x, z, 50)); break;
      default: col.setHex(pick(PAL.grass, x, z, 70));
    }
    if (s !== S_ROAD && s !== S_WATER) col.multiplyScalar(0.88 + var1 * 0.24);
    if (s === S_GRASS || s === S_FOREST) { c2.setHex(PAL.sand); col.lerp(c2, sstep(5, 2.5, h)); }
    COL[k * 3] = col.r; COL[k * 3 + 1] = col.g; COL[k * 3 + 2] = col.b;
  }
  /* maillage d'une tuile avec un pas de « step » cellules, et une jupe verticale qui masque les fissures entre niveaux de détail */
  function chunkGeo(ci, cj, step, cx, cz) {
    const n = CH / step + 1, pos = [], nor = [], clr = [], uv = [], ix = [];
    const put = (I, J, dy) => {
      const k = idx(I, J), x = -HALF + I * CELL, z = -HALF + J * CELL;
      pos.push(x - cx, H[k] + dy, z - cz); nor.push(NOR[k * 3], NOR[k * 3 + 1], NOR[k * 3 + 2]);
      clr.push(COL[k * 3], COL[k * 3 + 1], COL[k * 3 + 2]); uv.push(x / 7, z / 7);
      return pos.length / 3 - 1;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(ci * CH + i * step, cj * CH + j * step, 0);
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; ix.push(a, c, b, b, c, d); }
    if (step > 1) {
      const edge = [];
      for (let i = 0; i < n; i++) edge.push([i, 0]); for (let j = 1; j < n; j++) edge.push([n - 1, j]);
      for (let i = n - 2; i >= 0; i--) edge.push([i, n - 1]); for (let j = n - 2; j > 0; j--) edge.push([0, j]);
      edge.push([0, 0]);
      let pa = -1, pb = -1;
      for (const [i, j] of edge) {
        const a = j * n + i, b = put(ci * CH + i * step, cj * CH + j * step, -18);
        if (pa >= 0) ix.push(pa, pb, a, a, pb, b, pa, a, pb, a, b, pb);
        pa = a; pb = b;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix); g.computeBoundingSphere();
    return g;
  }
  const chunks = [];
  for (let cj = 0; cj < N / CH; cj++) for (let ci = 0; ci < N / CH; ci++) {
    const cx = -HALF + (ci + 0.5) * CH * CELL, cz = -HALF + (cj + 0.5) * CH * CELL;
    const lod = new THREE.LOD(); lod.position.set(cx, 0, cz);
    for (const [step, dist] of [[1, 0], [2, 750], [4, 1600], [8, 3200]]) {
      const m = new THREE.Mesh(chunkGeo(ci, cj, step, cx, cz), mat); m.receiveShadow = step === 1;
      lod.addLevel(m, dist);
    }
    lod.updateMatrix(); lod.matrixAutoUpdate = false;
    group.add(lod); chunks.push(lod);
  }
  return {
    group,
    /* les tuiles au-delà de la distance de vue ne sont pas dessinées */
    update(cam, far) { for (const c of chunks) c.visible = Math.hypot(c.position.x - cam.x, c.position.z - cam.z) < far + 600; },
  };
}

/* ---------- routes, ponts ---------- */
export function buildRoadMeshes(renderer) {
  const group = new THREE.Group();
  const tex = canvasTexture(THREE, 128, 512, (g, w, h) => {
    g.fillStyle = '#3d3e41'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.09)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(240,240,232,.9)'; g.fillRect(5, 0, 4, h); g.fillRect(w - 9, 0, 4, h);
    g.fillStyle = 'rgba(250,250,240,.92)'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 2, y, 4, 70);
  });
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.4, metalness: 0.6 });
  for (const road of ROADS) {
    const s = road.samples, pos = [], uv = [], ix = [];
    let v = 0;
    for (let i = 0; i < s.length; i++) {
      const q = s[i], lx = -q.dz, lz = q.dx, y = q.bridge ? q.y : heightAt(q.x, q.z);
      const yl = q.bridge ? q.y : Math.max(y, heightAt(q.x + lx * q.hw, q.z + lz * q.hw)), yr = q.bridge ? q.y : Math.max(y, heightAt(q.x - lx * q.hw, q.z - lz * q.hw));
      pos.push(q.x + lx * q.hw, yl + 0.06, q.z + lz * q.hw, q.x - lx * q.hw, yr + 0.06, q.z - lz * q.hw);
      uv.push(0, v, 1, v); v += 4 / 40;
      if (i < s.length - 1) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; group.add(m);
    // ponts : tablier, garde-corps et piles
    const parts = [];
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i], b = s[i + 1];
      if (!a.bridge && !b.bridge) continue;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = (a.y + b.y) / 2, L = Math.hypot(b.x - a.x, b.z - a.z) + 0.3;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z), pitch = Math.atan2(b.y - a.y, L);
      const deck = new THREE.BoxGeometry(a.hw * 2 + 2, 1.2, L); deck.rotateX(-pitch); deck.rotateY(yaw); deck.translate(mx, my - 0.62, mz); parts.push([deck, deckMat]); bridgeColParts.push(deck.clone());
      for (const sd of [-1, 1]) {
        const r = new THREE.BoxGeometry(0.25, 1.0, L); r.rotateX(-pitch); r.rotateY(yaw);
        r.translate(mx + Math.cos(yaw) * sd * (a.hw + 0.8), my + 0.5, mz - Math.sin(yaw) * sd * (a.hw + 0.8)); parts.push([r, railMat]);
      }
      if (i % 10 === 0) {
        const ground = Math.min(heightAt(mx, mz), -2), hp = my - 1.2 - ground;
        const pil = new THREE.BoxGeometry(3, hp, 3); pil.translate(mx, ground + hp / 2, mz); parts.push([pil, deckMat]);
      }
    }
    if (parts.length) {
      for (const mt of [deckMat, railMat]) {
        const geos = parts.filter(p => p[1] === mt).map(p => p[0].index ? p[0].toNonIndexed() : p[0]);
        if (!geos.length) continue;
        const merged = mergeList(geos);
        const mm = new THREE.Mesh(merged, mt); mm.castShadow = true; mm.receiveShadow = true; group.add(mm);
      }
    }
  }
  return group;
}
function mergeList(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere(); return out;
}

/* hauteur du tablier si (x, z) est sur un pont, sinon -Infinity */
export function bridgeAt(x, z) {
  let best = -Infinity, bd = 1e9;
  bridgeGrid.query(x, z, 0, q => {
    const rx = x - q.x, rz = z - q.z, along = rx * q.dx + rz * q.dz, lat = Math.abs(-rx * q.dz + rz * q.dx);
    if (Math.abs(along) < 3 && lat < q.hw + 1.2 && Math.abs(along) < bd) { bd = Math.abs(along); best = q.y; }
  });
  return best;
}

/* ---------- carte (minicarte et grande carte) ---------- */
export function buildMapCanvas(size = 1024) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), col = new THREE.Color();
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = -HALF + (px + 0.5) / size * SIZE, z = -HALF + (py + 0.5) / size * SIZE, h = heightAt(x, z), s = surfaceAt(x, z);
    if (s === S_WATER) { const d = clamp(-h / 40, 0, 1); col.setRGB(0.16 - d * 0.08, 0.42 - d * 0.18, 0.55 - d * 0.15); }
    else {
      col.setHex(s === S_ROAD ? 0x8a8a8a : s === S_SNOW ? 0xf1f3f6 : s === S_ROCK ? 0x8b7e70 : s === S_SAND ? 0xe1cf98 : s === S_DESERT ? 0xd9ac72 : s === S_FIELD ? 0xb9b562 : s === S_FOREST ? 0x3f6a31 : 0x6c9a47);
      const shade = 0.8 + clamp((heightAt(x - 15, z - 15) - h) * 0.02 + 0.2, 0, 0.4);
      col.multiplyScalar(shade);
    }
    const k = (py * size + px) * 4;
    img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const P = (x, z) => [(x + HALF) / SIZE * size, (z + HALF) / SIZE * size];
  // ville
  g.fillStyle = 'rgba(120,124,132,.9)'; { const [a, b] = P(CITY.x0, CITY.z0), [c2, d] = P(CITY.x1, CITY.z1); g.fillRect(a, b, c2 - a, d - b); }
  g.strokeStyle = 'rgba(60,62,66,.9)'; g.lineWidth = 1;
  for (let x = CITY.x0; x <= CITY.x1; x += CITY.pitch) { g.beginPath(); g.moveTo(...P(x, CITY.z0)); g.lineTo(...P(x, CITY.z1)); g.stroke(); }
  for (let z = CITY.z0; z <= CITY.z1; z += CITY.pitch) { g.beginPath(); g.moveTo(...P(CITY.x0, z)); g.lineTo(...P(CITY.x1, z)); g.stroke(); }
  // routes
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const road of ROADS) {
    for (const [w, st] of [[4, 'rgba(40,40,40,.85)'], [2, 'rgba(250,236,170,.95)']]) {
      g.strokeStyle = st; g.lineWidth = w; g.beginPath();
      road.samples.forEach((q, i) => { const [a, b] = P(q.x, q.z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
      g.stroke();
    }
  }
  // piste
  { const r = AIRPORT.rwy, [a, b] = P(r.x0, r.z - r.w / 2), [c2, d] = P(r.x1, r.z + r.w / 2); g.fillStyle = '#2b2c2f'; g.fillRect(a, b, c2 - a, Math.max(2, d - b)); }
  return c;
}

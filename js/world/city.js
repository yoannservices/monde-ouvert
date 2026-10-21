/* ===== Ville : rues en damier, trottoirs, immeubles, lampadaires, voitures garées, parc ===== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, clamp } from '../util.js';
import { CITY } from './terrain.js';

const P = CITY.pitch, RW = CITY.road, Y = CITY.y, CURB = 0.2;
export const NBX = Math.round((CITY.x1 - CITY.x0) / P), NBZ = Math.round((CITY.z1 - CITY.z0) / P);
const PARK = new Set(['6,5', '7,5']);
export const isPark = (i, j) => PARK.has(i + ',' + j);

/* bloc (i, j) : rectangle intérieur (trottoir compris) */
export function blockRect(i, j) {
  const x0 = CITY.x0 + i * P + RW / 2, z0 = CITY.z0 + j * P + RW / 2;
  return { x0, z0, x1: x0 + P - RW, z1: z0 + P - RW };
}
/* hauteur du trottoir si (x, z) est dans un îlot, sinon 0 */
export function curbAt(x, z) {
  if (x < CITY.x0 || x > CITY.x1 || z < CITY.z0 || z > CITY.z1) return 0;
  const u = (x - CITY.x0) % P, v = (z - CITY.z0) % P;
  return u > RW / 2 && u < P - RW / 2 && v > RW / 2 && v < P - RW / 2 ? CURB : 0;
}

function facadeTextures(style, seed) {
  const r = rng(seed), W = 512, H = 512, cols = 8, rows = 8;
  const base = { glass: '#2c4357', office: '#a7a29a', brick: '#8c5a46', plaster: '#d8cbb3' }[style];
  const lit = [];
  const map = canvasTexture(THREE, W, H, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.04})`; g.fillRect(r() * W, r() * H, 3, 3); }
    const cw = W / cols, rh = H / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw, py = y * rh;
      if (style === 'glass') {
        const gr = g.createLinearGradient(px, py, px + cw, py + rh); gr.addColorStop(0, '#5f86a6'); gr.addColorStop(0.5, '#31506b'); gr.addColorStop(1, '#486e8d');
        g.fillStyle = gr; g.fillRect(px + 2, py + 2, cw - 4, rh - 6);
        g.fillStyle = '#1b2833'; g.fillRect(px, py + rh - 6, cw, 6);
      } else {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px + cw * 0.18, py + rh * 0.2, cw * 0.64, rh * 0.62);
        const gr = g.createLinearGradient(px, py, px, py + rh); gr.addColorStop(0, '#6d8aa2'); gr.addColorStop(1, '#2b3a47');
        g.fillStyle = gr; g.fillRect(px + cw * 0.2, py + rh * 0.22, cw * 0.6, rh * 0.56);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(px + cw * 0.2, py + rh * 0.76, cw * 0.6, 3);
      }
      lit.push(r() < 0.38 ? (r() < 0.8 ? '#ffd9a0' : '#cfe6ff') : null);
    }
  });
  const emissive = canvasTexture(THREE, W / 2, H / 2, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    lit.forEach((c, k) => { if (!c) return; const x = k % cols, y = Math.floor(k / cols); g.fillStyle = c; g.fillRect(x * cw + cw * 0.2, y * rh + rh * 0.22, cw * 0.6, rh * 0.56); });
  });
  return { map, emissive };
}

/* boîte d'immeuble : murs (UV en mètres, 1 motif = 24 m) et toit séparés */
function buildingGeos(x0, z0, x1, z1, y0, y1, tile, wallList, roofList) {
  const w = x1 - x0, d = z1 - z0, h = y1 - y0;
  const wall = new THREE.BoxGeometry(w, h, d);
  const uv = wall.attributes.uv, pos = wall.attributes.position, nrm = wall.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = nrm.getX(i), nz = nrm.getZ(i), px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const along = Math.abs(nx) > 0.5 ? pz : px;
    uv.setXY(i, (along + 1000) / tile, (py + h / 2) / tile);
  }
  // on retire les faces haut/bas (indices 2 et 3 du BoxGeometry)
  const idx = wall.index.array, keep = [];
  for (let g = 0; g < 6; g++) if (g !== 2 && g !== 3) for (let k = g * 6; k < g * 6 + 6; k++) keep.push(idx[k]);
  wall.setIndex(keep); wall.clearGroups();
  wall.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  wallList.push(wall.toNonIndexed());
  const roof = new THREE.PlaneGeometry(w, d); roof.rotateX(-Math.PI / 2); roof.translate((x0 + x1) / 2, y1, (z0 + z1) / 2);
  roofList.push(roof);
}

export function buildCity(renderer, colliders, treeSpots) {
  const group = new THREE.Group(), r = rng(1234);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const night = { facadeMats: [], lampMat: null, beaconMat: null };

  // --- chaussée (motif de 100 m répété) ---
  const streetTex = canvasTexture(THREE, 1024, 1024, (g, w) => {
    const s = w / P;
    g.fillStyle = '#3b3c3f'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    const hw = RW / 2 * s;
    g.fillStyle = 'rgba(245,245,235,.85)';
    for (let k = hw + 3 * s; k < w - hw - 3 * s; k += 6 * s) { g.fillRect(-2, k, 4, 3 * s); g.fillRect(w - 2, k, 4, 3 * s); g.fillRect(k, -2, 3 * s, 4); g.fillRect(k, w - 2, 3 * s, 4); }
    // passages piétons
    g.fillStyle = 'rgba(245,245,240,.9)';
    for (const c of [hw + 1.2 * s, w - hw - 4.6 * s]) for (let k = -hw; k < hw; k += 1.6 * s) {
      g.fillRect(((k + w) % w), c, 0.8 * s, 3.4 * s); g.fillRect(((k + w) % w) - w, c, 0.8 * s, 3.4 * s);
      g.fillRect(c, ((k + w) % w), 3.4 * s, 0.8 * s); g.fillRect(c, ((k + w) % w) - w, 3.4 * s, 0.8 * s);
    }
  });
  streetTex.anisotropy = aniso;
  const sx = CITY.x1 - CITY.x0 + RW, sz = CITY.z1 - CITY.z0 + RW;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set((CITY.x0 + CITY.x1) / 2, Y + 0.02, (CITY.z0 + CITY.z1) / 2);
  streetTex.repeat.set(sx / P, sz / P); streetTex.offset.set(-RW / 2 / P, -RW / 2 / P);
  ground.receiveShadow = true; group.add(ground);

  // --- trottoirs et parcs ---
  const concrete = canvasTexture(THREE, 256, 256, (g, w) => {
    g.fillStyle = '#a9a7a2'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let k = 0; k <= w; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, w); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
  });
  const grassTex = canvasTexture(THREE, 256, 256, (g, w) => {
    g.fillStyle = '#5d8b3d'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '30,60,20' : '140,190,90'},${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 3); }
  });
  const walkGeos = [], parkGeos = [];
  for (let i = 0; i < NBX; i++) for (let j = 0; j < NBZ; j++) {
    const b = blockRect(i, j), g = new THREE.BoxGeometry(b.x1 - b.x0, CURB, b.z1 - b.z0);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (b.x1 - b.x0) / 8, uv.getY(k) * (b.z1 - b.z0) / 8);
    g.translate((b.x0 + b.x1) / 2, Y + CURB / 2, (b.z0 + b.z1) / 2);
    (isPark(i, j) ? parkGeos : walkGeos).push(g);
  }
  const walk = new THREE.Mesh(mergeGeometries(walkGeos), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.92 })); walk.receiveShadow = true; group.add(walk);
  const park = new THREE.Mesh(mergeGeometries(parkGeos), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })); park.receiveShadow = true; group.add(park);
  // bassin et arbres du parc
  const pb0 = blockRect(6, 5), pb1 = blockRect(7, 5), pcx = (pb0.x0 + pb1.x1) / 2, pcz = (pb0.z0 + pb0.z1) / 2;
  const pond = new THREE.Mesh(new THREE.CircleGeometry(26, 48), new THREE.MeshStandardMaterial({ color: 0x2c6b85, roughness: 0.1, metalness: 0.1 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(pcx, Y + CURB + 0.03, pcz); group.add(pond);
  for (let k = 0; k < 70; k++) {
    const x = pb0.x0 + 4 + r() * (pb1.x1 - pb0.x0 - 8), z = pb0.z0 + 4 + r() * (pb0.z1 - pb0.z0 - 8);
    if (Math.hypot(x - pcx, z - pcz) < 32) continue;
    treeSpots.push({ x, z, y: Y + CURB, kind: 'leaf', s: 0.8 + r() * 0.5 });
  }

  // --- immeubles ---
  const STYLES = ['glass', 'office', 'brick', 'plaster'];
  const mats = {}, lists = {};
  STYLES.forEach((s, k) => {
    const t = facadeTextures(s, 77 + k); t.map.anisotropy = aniso;
    mats[s] = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: s === 'glass' ? 0.12 : 0.8, metalness: s === 'glass' ? 0.55 : 0.05, envMapIntensity: s === 'glass' ? 1.4 : 0.6 });
    night.facadeMats.push(mats[s]); lists[s] = {};
  });
  const roofs = {}, beacons = [];
  // la ville est découpée en tuiles de 200 m : une tuile hors champ ou trop loin n'est pas dessinée
  const TILE = 350, tk = (x, z) => Math.floor((x - CITY.x0) / TILE) + ',' + Math.floor((z - CITY.z0) / TILE);
  const tiles = [];   // { obj, x, z, near }
  const tileCenter = key => { const [i, j] = key.split(',').map(Number); return [CITY.x0 + (i + 0.5) * TILE, CITY.z0 + (j + 0.5) * TILE]; };
  const cx0 = (CITY.x0 + CITY.x1) / 2, cz0 = (CITY.z0 + CITY.z1) / 2;
  const addB = (x0, z0, x1, z1, h, style) => {
    const y0 = Y + CURB - 0.05, y1 = Y + CURB + h;
    const key = tk((x0 + x1) / 2, (z0 + z1) / 2);
    buildingGeos(x0, z0, x1, z1, y0, y1, 24, lists[style][key] || (lists[style][key] = []), roofs[key] || (roofs[key] = []));
    colliders.push({ x0, z0, x1, z1, y0: Y, top: y1 });
    if (h > 110) beacons.push([(x0 + x1) / 2, y1, (z0 + z1) / 2]);
  };
  for (let i = 0; i < NBX; i++) for (let j = 0; j < NBZ; j++) {
    if (isPark(i, j)) continue;
    const b = blockRect(i, j), m = 4, bx0 = b.x0 + m, bz0 = b.z0 + m, bx1 = b.x1 - m, bz1 = b.z1 - m;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - cx0, cz - cz0);
    const roll = r();
    if (roll < 0.06) continue;                                    // place / parking
    if (d < 320) {
      // centre-ville : tours
      if (roll < 0.5) { const ins = 4 + r() * 6; addB(bx0 + ins, bz0 + ins, bx1 - ins, bz1 - ins, 90 + r() * (240 - d * 0.45), r() < 0.6 ? 'glass' : 'office'); }
      else { const mid = (bx0 + bx1) / 2; addB(bx0, bz0 + 4, mid - 3, bz1 - 6, 60 + r() * 120, 'glass'); addB(mid + 3, bz0, bx1, bz1 - 10, 45 + r() * 90, r() < 0.5 ? 'office' : 'glass'); }
    } else if (d < 560) {
      const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2, g = 3;
      for (const [a0, c0, a1, c1] of [[bx0, bz0, mx - g, mz - g], [mx + g, bz0, bx1, mz - g], [bx0, mz + g, mx - g, bz1], [mx + g, mz + g, bx1, bz1]]) {
        if (r() < 0.12) continue;
        const s = r() < 0.5 ? 'office' : r() < 0.6 ? 'brick' : 'glass';
        addB(a0 + r() * 3, c0 + r() * 3, a1 - r() * 3, c1 - r() * 3, 16 + r() * 40, s);
      }
    } else {
      const n = 3, cw = (bx1 - bx0) / n, ch = (bz1 - bz0) / n;
      for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
        if ((u === 1 && v === 1) || r() < 0.1) continue;          // cour intérieure
        const a0 = bx0 + u * cw + 2, c0 = bz0 + v * ch + 2;
        addB(a0, c0, a0 + cw - 4 - r() * 4, c0 + ch - 4 - r() * 4, 7 + r() * 10, r() < 0.5 ? 'plaster' : 'brick');
      }
      treeSpots.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, y: Y + CURB, kind: 'leaf', s: 1 });
    }
  }
  for (const s of STYLES) for (const key in lists[s]) {
    const m = new THREE.Mesh(mergeGeometries(lists[s][key]), mats[s]); m.castShadow = true; m.receiveShadow = true; group.add(m);
    const [x, z] = tileCenter(key); tiles.push({ obj: m, x, z, near: false });
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x55575b, roughness: 0.9 });
  for (const key in roofs) {
    const m = new THREE.Mesh(mergeGeometries(roofs[key]), roofMat); m.receiveShadow = true; group.add(m);
    const [x, z] = tileCenter(key); tiles.push({ obj: m, x, z, near: false });
  }
  /* objets instanciés par tuile (lampadaires, voitures garées) : visibles seulement de près */
  const instTiles = (geo, mat, list, setter, cast) => {
    const by = {};
    list.forEach((it, k) => { const key = tk(it[0], it[1]); (by[key] || (by[key] = [])).push([it, k]); });
    const out = [];
    for (const key in by) {
      const im = new THREE.InstancedMesh(geo, mat, by[key].length);
      by[key].forEach(([it, k], n) => setter(im, n, it, k));
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.castShadow = cast; im.receiveShadow = true; group.add(im);
      const [x, z] = tileCenter(key); tiles.push({ obj: im, x, z, near: true });
    }
    return out;
  };
  // antennes et feux d'obstacle sur les tours
  night.beaconMat = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 1 });
  if (beacons.length) {
    const ant = [], lights = [];
    for (const [x, y, z] of beacons) {
      const a = new THREE.CylinderGeometry(0.25, 0.4, 14, 6); a.translate(x, y + 7, z); ant.push(a);
      const l = new THREE.SphereGeometry(0.7, 8, 6); l.translate(x, y + 14.4, z); lights.push(l);
    }
    group.add(new THREE.Mesh(mergeGeometries(ant), new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.8, roughness: 0.4 })));
    group.add(new THREE.Mesh(mergeGeometries(lights), night.beaconMat));
  }

  // --- lampadaires (instanciés) ---
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.16, 8, 6); poleGeo.translate(0, 4, 0);
  const armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2); armGeo.translate(0, 7.9, 1.0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.9); headGeo.translate(0, 7.8, 2.0);
  const lampPos = [];
  for (let i = 0; i <= NBX; i++) for (let j = 0; j < NBZ; j++) for (let k = 0; k < 3; k++) {
    const x = CITY.x0 + i * P, z = CITY.z0 + j * P + RW / 2 + 12 + k * 28;
    lampPos.push([x - RW / 2 - 0.8, z, 1], [x + RW / 2 + 0.8, z + 14, -1]);
  }
  for (let j = 0; j <= NBZ; j++) for (let i = 0; i < NBX; i++) for (let k = 0; k < 3; k++) {
    const z = CITY.z0 + j * P, x = CITY.x0 + i * P + RW / 2 + 12 + k * 28;
    lampPos.push([x, z - RW / 2 - 0.8, 2], [x + 14, z + RW / 2 + 0.8, -2]);
  }
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.6, roughness: 0.5 });
  night.lampMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffd79a, emissiveIntensity: 0 });
  const o = new THREE.Object3D();
  const lampSet = (im, n, [x, z, dir]) => {
    o.position.set(x, Y + CURB, z);
    o.rotation.set(0, dir === 1 ? Math.PI / 2 : dir === -1 ? -Math.PI / 2 : dir === 2 ? 0 : Math.PI, 0);
    o.updateMatrix(); im.setMatrixAt(n, o.matrix);
  };
  instTiles(mergeGeometries([poleGeo, armGeo]), poleMat, lampPos, lampSet, true);
  instTiles(headGeo, night.lampMat, lampPos, lampSet, false);

  // --- voitures garées (obstacles) ---
  const carBody = new THREE.BoxGeometry(1.9, 0.75, 4.4); carBody.translate(0, 0.72, 0);
  const carCab = new THREE.BoxGeometry(1.66, 0.6, 2.3); carCab.translate(0, 1.38, 0.2);
  const carGeo = mergeGeometries([carBody, carCab]);
  const parked = [];
  for (let i = 0; i <= NBX; i++) for (let j = 0; j < NBZ; j++) for (let k = 0; k < 4; k++) {
    if (r() > 0.45) continue;
    const x = CITY.x0 + i * P + (r() < 0.5 ? -1 : 1) * (RW / 2 - 1.3), z = CITY.z0 + j * P + RW / 2 + 8 + k * 21 + r() * 4;
    if (x < CITY.x0 + 2 || x > CITY.x1 - 2) continue;
    parked.push([x, z, 0]);
  }
  for (let j = 0; j <= NBZ; j++) for (let i = 0; i < NBX; i++) for (let k = 0; k < 4; k++) {
    if (r() > 0.4) continue;
    const z = CITY.z0 + j * P + (r() < 0.5 ? -1 : 1) * (RW / 2 - 1.3), x = CITY.x0 + i * P + RW / 2 + 8 + k * 21 + r() * 4;
    if (z < CITY.z0 + 2 || z > CITY.z1 - 2) continue;
    parked.push([x, z, Math.PI / 2]);
  }
  const CC = [0xd9d9d9, 0x1b1b1d, 0x7d8085, 0x2a4f8a, 0x9b1d20, 0xc9b27c, 0x2f5d3a, 0xe2e2df, 0x4b4f55, 0x0d2440], col = new THREE.Color();
  instTiles(carGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 }), parked, (im, n, [x, z, yaw], k) => {
    o.position.set(x, Y, z); o.rotation.set(0, yaw, 0); o.updateMatrix(); im.setMatrixAt(n, o.matrix);
    im.setColorAt(n, col.setHex(CC[k % CC.length]));
  }, true);
  for (const [x, z, yaw] of parked) { const hx = yaw ? 2.2 : 0.95, hz = yaw ? 0.95 : 2.2; colliders.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, y0: Y, top: Y + 1.7, soft: true }); }

  return {
    group, night,
    update(cam, far) {
      for (const t of tiles) { const d = Math.hypot(t.x - cam.x, t.z - cam.z) - 150; t.obj.visible = d < (t.near ? Math.min(far, 500) : far); }
    },
  };
}

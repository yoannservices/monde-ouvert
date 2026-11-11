/* ===== Ville : rues en damier, trottoirs, immeubles, lampadaires, voitures garées, parc ===== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, clamp } from '../util.js';
import { CITY } from './terrain.js';
import '../../../../assets/building-kit.js';

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

const LOD_NEAR = 60;   // m au-delà du bord de la tuile de bâtiments (175 m) : version détaillée en deçà
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

  // --- immeubles : kit commun assets/building-kit.js (fenêtres en relief, portes, vitrines, balcons, toits) ---
  const K = BuildingKit(THREE);
  const STY = {
    glass: { wall: '#8a97a6', style: 'concrete', frame: '#3c4652', glass: '#5a7a96' },
    office: { wall: '#b0aba2', style: 'stone', glass: '#2c4357', frame: '#e8e6e0' },
    brick: { wall: '#a0634c', style: 'brick', awning: '#b3262e' },
    plaster: { wall: '#ddd0b8', style: 'stucco', roof: 'tile' },
  };
  const mats = K.materials({ style: 'stucco', roof: 'tile', glass: '#3e5a70' });
  for (const st in STY) { const m = K.materials(STY[st]); mats['wall_' + st] = m.wall; m.wall.map.anisotropy = aniso; }
  night.facadeMats.push(mats.lit, mats.shop);
  const opts = (style, h) => {
    if (style === 'glass') return { fh: 3.6, gfh: 5, roof: 'flat', facade: 'curtain', cell: 2.4 };
    if (style === 'office') return { fh: 3.5, roof: 'flat', facade: 'ribbon', shop: true, door: '-z', doorType: 'block' };
    if (style === 'brick') { const shop = r() < 0.6; return { detail: h > 20 ? 1 : 2, fh: 3.2, roof: 'flat', shop, door: shop ? '-z' : '+z', doorType: 'block', balcony: r() < 0.4 ? 'alt' : false, win: [1.3, 1.6], awningColor: ['#b3262e', '#2b5d8a', '#2f7a4a', '#c98a1a'][Math.floor(r() * 4)] }; }
    return h < 11 ? { fh: 3, roof: 'gable', shutters: true, quoins: r() < 0.5, win: [1.2, 1.4] } : { fh: 3, roof: 'flat', shutters: true, door: '+z', doorType: 'block', win: [1.2, 1.4] };
  };
  const tint = { glass: () => null, office: () => new THREE.Color().setHSL(0.1, 0.08, 0.85 + r() * 0.15), brick: () => new THREE.Color().setHSL(0.03 + r() * 0.03, 0.25, 0.8 + r() * 0.2), plaster: () => new THREE.Color().setHSL(0.08 + r() * 0.06, 0.25 + r() * 0.2, 0.86 + r() * 0.14) };
  const accs = {}, beacons = [];
  // la ville est découpée en tuiles de 350 m : une tuile hors champ ou trop loin n'est pas dessinée
  const TILE = 350, tk = (x, z) => Math.floor((x - CITY.x0) / TILE) + ',' + Math.floor((z - CITY.z0) / TILE);
  const tiles = [];   // { obj, x, z, near }
  // bâtiments sur une grille plus fine (175 m) : la version détaillée ne couvre que les abords de la caméra
  const BT = TILE / 2, btk = (x, z) => Math.floor((x - CITY.x0) / BT) + ',' + Math.floor((z - CITY.z0) / BT);
  const tileCenter = key => { const [i, j] = key.split(',').map(Number); return [CITY.x0 + (i + 0.5) * TILE, CITY.z0 + (j + 0.5) * TILE]; };
  const cx0 = (CITY.x0 + CITY.x1) / 2, cz0 = (CITY.z0 + CITY.z1) / 2;
  // façade principale tournée vers le bord d'îlot le plus proche (la rue) ; emprise et collision inchangées
  const addB = (blk, x0, z0, x1, z1, h, style) => {
    const y0 = Y + CURB - 0.05, y1 = Y + CURB + h, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const side = [[cx - blk.x0, -1, 0], [blk.x1 - cx, 1, 0], [cz - blk.z0, 0, -1], [blk.z1 - cz, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    const yaw = Math.atan2(side[1], side[2]), q = side[1] !== 0;
    // deux versions par tuile : détaillée (de près) et simplifiée (de loin : cadres et vitres en plans, ni volets ni gouttières), même tirage
    const key = btk(cx, cz), T2 = accs[key] || (accs[key] = { near: K.acc(), far: K.acc() });
    const o = { w: q ? z1 - z0 : x1 - x0, d: q ? x1 - x0 : z1 - z0, h: h + 0.05, tint: tint[style](), equip: true, ...opts(style, h) }, seed = Math.floor(r() * 1e9);
    for (const [acc, det] of [[T2.near, o.detail ?? 2], [T2.far, 0]]) {
      acc.at(cx, y0, cz, yaw).keys({ wall: 'wall_' + style });
      K.building(acc, { ...o, detail: det, rand: rng(seed) });
    }
    colliders.push({ x0, z0, x1, z1, y0: Y, top: y1 });
    if (h > 110) beacons.push([cx, y1 + 0.9, cz]);
  };
  for (let i = 0; i < NBX; i++) for (let j = 0; j < NBZ; j++) {
    if (isPark(i, j)) continue;
    const b = blockRect(i, j), m = 4, bx0 = b.x0 + m, bz0 = b.z0 + m, bx1 = b.x1 - m, bz1 = b.z1 - m;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - cx0, cz - cz0);
    const roll = r();
    if (roll < 0.06) continue;                                    // place / parking
    if (d < 320) {
      // centre-ville : tours
      if (roll < 0.5) { const ins = 4 + r() * 6; addB(b, bx0 + ins, bz0 + ins, bx1 - ins, bz1 - ins, 90 + r() * (240 - d * 0.45), r() < 0.6 ? 'glass' : 'office'); }
      else { const mid = (bx0 + bx1) / 2; addB(b, bx0, bz0 + 4, mid - 3, bz1 - 6, 60 + r() * 120, 'glass'); addB(b, mid + 3, bz0, bx1, bz1 - 10, 45 + r() * 90, r() < 0.5 ? 'office' : 'glass'); }
    } else if (d < 560) {
      const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2, g = 3;
      for (const [a0, c0, a1, c1] of [[bx0, bz0, mx - g, mz - g], [mx + g, bz0, bx1, mz - g], [bx0, mz + g, mx - g, bz1], [mx + g, mz + g, bx1, bz1]]) {
        if (r() < 0.12) continue;
        const s = r() < 0.5 ? 'office' : r() < 0.6 ? 'brick' : 'glass';
        addB(b, a0 + r() * 3, c0 + r() * 3, a1 - r() * 3, c1 - r() * 3, 16 + r() * 40, s);
      }
    } else {
      const n = 3, cw = (bx1 - bx0) / n, ch = (bz1 - bz0) / n;
      for (let u = 0; u < n; u++) for (let v = 0; v < n; v++) {
        if ((u === 1 && v === 1) || r() < 0.1) continue;          // cour intérieure
        const a0 = bx0 + u * cw + 2, c0 = bz0 + v * ch + 2;
        addB(b, a0, c0, a0 + cw - 4 - r() * 4, c0 + ch - 4 - r() * 4, 7 + r() * 10, r() < 0.5 ? 'plaster' : 'brick');
      }
      treeSpots.push({ x: (bx0 + bx1) / 2, z: (bz0 + bz1) / 2, y: Y + CURB, kind: 'leaf', s: 1 });
    }
  }
  for (const key in accs) {
    const [i, j] = key.split(',').map(Number), x = CITY.x0 + (i + 0.5) * BT, z = CITY.z0 + (j + 0.5) * BT;
    for (const lod of ['near', 'far']) {
      const geos = accs[key][lod].geometries();
      for (const k in geos) {
        const m = new THREE.Mesh(geos[k], mats[k] || mats.trim); m.castShadow = BuildingKit.cast(k); m.receiveShadow = true; group.add(m);
        tiles.push({ obj: m, x, z, near: false, lod, r: BT * 0.71 });
      }
    }
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
      // bâtiments : version détaillée à moins de LOD_NEAR m du bord de la tuile, simplifiée au-delà
      for (const t of tiles) { const d = Math.hypot(t.x - cam.x, t.z - cam.z) - (t.r ?? 150); t.obj.visible = d < (t.near ? Math.min(far, 500) : far) && (t.lod === 'near' ? d < LOD_NEAR : t.lod === 'far' ? d >= LOD_NEAR : true); }
    },
  };
}

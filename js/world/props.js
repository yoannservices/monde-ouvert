/* ===== Décors : végétation, fermes, éoliennes, aéroport, village de l'île, phare, tremplins ===== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, canvasTexture, clamp, sstep, SpatialGrid, fbm } from '../util.js';
import {
  heightAt, surfaceAt, normalAt, roadSamples, AIRPORT, ISLAND, ISLET, VILLAGE, LAKE, CITY, RAMPS, HALF,
  S_WATER, S_ROAD, S_FOREST, S_FIELD, S_GRASS, S_DESERT, S_ROCK, S_SAND, S_SNOW, isDesert,
} from './terrain.js';

const roadGrid = new SpatialGrid(40);
let roadGridReady = false;
export function nearRoad(x, z, d) {
  if (!roadGridReady) { for (const q of roadSamples) roadGrid.add(q, q.x, q.z, q.x, q.z); roadGridReady = true; }
  let hit = false;
  roadGrid.query(x, z, d + 8, q => { if (!hit && Math.hypot(q.x - x, q.z - z) < d + q.hw) hit = true; });
  return hit;
}

/* géométrie avec couleurs par sommet (pour fusionner tronc + feuillage en un seul instancié) */
function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
function treeGeos() {
  const pine = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.22, 0.38, 3, 5, 1, true).translate(0, 1.5, 0), 0x5a3f2a),
    colored(new THREE.ConeGeometry(2.6, 5.5, 7).translate(0, 4.6, 0), 0x2f5a2b),
    colored(new THREE.ConeGeometry(2.0, 4.6, 7).translate(0, 7.0, 0), 0x356533),
    colored(new THREE.ConeGeometry(1.3, 3.6, 7).translate(0, 9.2, 0), 0x3b6d38),
  ]);
  const crown = new THREE.IcosahedronGeometry(3.1, 1); crown.scale(1, 0.85, 1);
  const leaf = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.25, 0.4, 3.6, 6, 1, true).translate(0, 1.8, 0), 0x6b4a32),
    colored(crown.translate(0, 5.6, 0), 0x4f7d34),
    colored(new THREE.IcosahedronGeometry(2.1, 1).translate(1.4, 4.6, 0.6), 0x5a8a3a),
  ]);
  const palmParts = [];
  let px = 0, py = 0;
  for (let k = 0; k < 5; k++) { const seg = new THREE.CylinderGeometry(0.2 - k * 0.015, 0.26 - k * 0.015, 1.9, 6, 1, true); seg.rotateZ(-0.06 * k); seg.translate(px, py + 0.95, 0); palmParts.push(colored(seg, 0x8a6a48)); px += 0.12 * k; py += 1.85; }
  for (let k = 0; k < 8; k++) {
    const lf = new THREE.ConeGeometry(0.45, 4.2, 4); lf.scale(1, 1, 0.18); lf.translate(0, 2.1, 0); lf.rotateZ(-1.9); lf.rotateY(k / 8 * Math.PI * 2);
    lf.translate(px, py, 0); palmParts.push(colored(lf, k % 2 ? 0x3d7a2e : 0x4c8c35));
  }
  const palm = mergeGeometries(palmParts);
  const cactus = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.35, 0.4, 4.2, 7).translate(0, 2.1, 0), 0x4f7a3a),
    colored(new THREE.CylinderGeometry(0.25, 0.25, 1.6, 6).rotateZ(Math.PI / 2).translate(0.75, 1.7, 0), 0x4f7a3a),
    colored(new THREE.CylinderGeometry(0.24, 0.24, 1.5, 6).translate(1.45, 2.4, 0), 0x557f3d),
    colored(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 6).rotateZ(Math.PI / 2).translate(-0.6, 2.5, 0), 0x4f7a3a),
    colored(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6).translate(-1.1, 3.0, 0), 0x557f3d),
  ]);
  const rock = colored(new THREE.DodecahedronGeometry(1.6, 0).scale(1.3, 0.75, 1.0), 0x8a8073);
  // versions simplifiées pour le lointain
  const pineFar = mergeGeometries([colored(new THREE.ConeGeometry(2.6, 10.5, 5).translate(0, 5.6, 0), 0x335f2f)]);
  const leafFar = mergeGeometries([colored(new THREE.CylinderGeometry(0.3, 0.4, 3.6, 4, 1, true).translate(0, 1.8, 0), 0x6b4a32), colored(new THREE.IcosahedronGeometry(3.1, 0).scale(1, 0.85, 1).translate(0, 5.6, 0), 0x527f36)]);
  return { pine, leaf, palm, cactus, rock, pineFar, leafFar };
}

/* calque d'objets instanciés découpé en tuiles (culling + masquage au loin) */
class Layer {
  constructor(geo, mat, farGeo = null, tile = 550) { this.geo = geo; this.farGeo = farGeo; this.mat = mat; this.tile = tile; this.items = new Map(); this.meshes = []; }
  add(x, y, z, yaw, s, color) {
    const k = Math.floor((x + HALF) / this.tile) + ',' + Math.floor((z + HALF) / this.tile);
    let l = this.items.get(k); if (!l) { l = []; this.items.set(k, l); }
    l.push([x, y, z, yaw, s, color]);
  }
  build(group, cast = true) {
    const o = new THREE.Object3D(), c = new THREE.Color();
    const make = (geo, l) => {
      const m = new THREE.InstancedMesh(geo, this.mat, l.length);
      l.forEach(([x, y, z, yaw, s, color], i) => {
        o.position.set(x, y, z); o.rotation.set(0, yaw, 0); o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.setHex(color));
      });
      m.computeBoundingSphere(); m.receiveShadow = true; group.add(m); return m;
    };
    for (const l of this.items.values()) {
      const near = make(this.geo, l), far = this.farGeo ? make(this.farGeo, l) : null;
      if (far) far.visible = false;
      this.meshes.push({ near, far, cast });
    }
  }
  /* détail complet et ombres de près, modèle simplifié au loin, rien au-delà de la distance de vue */
  update(cam, far, nearDist) {
    for (const t of this.meshes) {
      const s = t.near.boundingSphere, d = Math.hypot(s.center.x - cam.x, s.center.z - cam.z) - s.radius;
      const isNear = d < nearDist;
      t.near.visible = (isNear || !t.far) && d < far;
      t.near.castShadow = t.cast && d < 160;
      if (t.far) t.far.visible = !isNear && d < far;
    }
  }
}

export function buildProps(renderer, colliders, trees, treeSpots) {
  const group = new THREE.Group(), r = rng(99), layers = [];
  const G = treeGeos();
  const vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const L = { pine: new Layer(G.pine, vegMat, G.pineFar), leaf: new Layer(G.leaf, vegMat, G.leafFar), palm: new Layer(G.palm, vegMat), cactus: new Layer(G.cactus, vegMat), rock: new Layer(G.rock, vegMat) };
  const nrm = new THREE.Vector3();
  const TINT_P = [0xffffff, 0xe6f0d8, 0xcfe0c0, 0xf4ffe6], TINT_L = [0xffffff, 0xe9f5c8, 0xd8eab0, 0xfff1c0, 0xf6d9a0];
  const addTree = (kind, x, z, s, y) => {
    y = y == null ? heightAt(x, z) : y;
    const tint = kind === 'pine' ? TINT_P[(r() * 4) | 0] : kind === 'leaf' ? TINT_L[(r() * 5) | 0] : 0xffffff;
    L[kind].add(x, y - 0.2, z, r() * Math.PI * 2, s, tint);
    if (kind !== 'rock') { const t = { x, z, r: kind === 'cactus' ? 0.5 : 0.45 * s + 0.2, top: y + (kind === 'pine' ? 10 : kind === 'palm' ? 9 : kind === 'cactus' ? 4 : 7) * s }; trees.add(t, x - 1, z - 1, x + 1, z + 1); }
    else colliders.push({ x0: x - 1.6 * s, z0: z - 1.2 * s, x1: x + 1.6 * s, z1: z + 1.2 * s, y0: y - 2, top: y + 1.0 * s, rock: true });
  };
  const place = (n, tries, test, kind, scale) => {
    let k = 0;
    for (let t = 0; t < tries && k < n; t++) {
      const x = (r() * 2 - 1) * HALF * 0.92, z = (r() * 2 - 1) * HALF * 0.92;
      const s = test(x, z); if (!s) continue;
      if (nearRoad(x, z, 6)) continue;
      addTree(typeof kind === 'function' ? kind(x, z) : kind, x, z, scale(x, z)); k++;
    }
  };
  // forêt, montagnes
  place(15000, 160000, (x, z) => {
    const s = surfaceAt(x, z); if (s !== S_FOREST && s !== S_GRASS) return false;
    const h = heightAt(x, z); if (h < 3 || h > 560) return false;
    const dense = s === S_FOREST ? 0.85 : 0.08 * (fbm(x / 300, z / 300, 2) > 0.55 ? 6 : 1);
    if (r() > dense) return false;
    normalAt(x, z, nrm); return nrm.y > 0.8 && !(x > CITY.x0 - 30 && x < CITY.x1 + 30 && z > CITY.z0 - 30 && z < CITY.z1 + 30);
  }, (x, z) => (heightAt(x, z) > 160 || x < -900 ? 'pine' : (r() < 0.6 ? 'leaf' : 'pine')), () => 0.75 + r() * 0.75);
  // campagne : haies et bosquets
  place(2600, 60000, (x, z) => {
    const s = surfaceAt(x, z); if (s !== S_FIELD) return false;
    return fbm(x / 160 + 4, z / 160, 3) > 0.62 || r() < 0.02;
  }, 'leaf', () => 0.7 + r() * 0.6);
  // désert : cactus et rochers
  place(900, 30000, (x, z) => surfaceAt(x, z) === S_DESERT && r() < 0.6, (x, z) => r() < 0.65 ? 'cactus' : 'rock', () => 0.7 + r() * 0.7);
  place(1400, 30000, (x, z) => { const s = surfaceAt(x, z); return (s === S_ROCK || s === S_SNOW) && heightAt(x, z) > 30; }, 'rock', () => 0.8 + r() * 2.2);
  // palmiers des plages et de l'île
  place(900, 80000, (x, z) => {
    const h = heightAt(x, z); if (h < 1.8 || h > 12) return false;
    const onIsland = Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 80;
    return (onIsland && r() < 0.6) || (surfaceAt(x, z) === S_SAND && r() < 0.25);
  }, 'palm', () => 0.8 + r() * 0.5);
  for (const t of treeSpots) addTree(t.kind, t.x, t.z, t.s, t.y);
  for (const k in L) { L[k].build(group, k !== 'rock'); layers.push(L[k]); }

  // ---------- matériaux de bâtiments ----------
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.85 }), roof: new THREE.MeshStandardMaterial({ color: 0x8e3b2c, roughness: 0.8 }),
    barn: new THREE.MeshStandardMaterial({ color: 0x9c2f24, roughness: 0.85 }), metal: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.45, metalness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.6 }), dark: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x2b4a5f, roughness: 0.1, metalness: 0.6 }), wood: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8332a, roughness: 0.6 }), sign: new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb84a, emissiveIntensity: 0.6 }),
  };
  const parts = new Map();
  const put = (geo, mat, cast = true) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo.index ? geo.toNonIndexed() : geo); };
  const box = (x, y, z, w, h, d, mat, yaw = 0, collide = true) => {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); g.translate(x, y + h / 2, z); put(g, mat);
    if (collide) { const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2; colliders.push({ x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, y0: y - 1, top: y + h }); }
  };
  const gable = (x, y, z, w, h, d, mat, yaw = 0) => {
    const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.4, 0); sh.lineTo(w / 2 + 0.4, 0); sh.lineTo(0, h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d + 0.8, bevelEnabled: false }); g.translate(0, 0, -(d + 0.8) / 2); g.rotateY(yaw); g.translate(x, y, z); put(g, mat);
  };
  const house = (x, z, yaw, w, d, h, wallM, roofM) => { const y = heightAt(x, z); box(x, y - 0.5, z, w, h + 0.5, d, wallM, yaw); gable(x, y + h, z, w, Math.min(w, d) * 0.45, d, roofM, yaw); };
  const flatSpot = (x, z, rad) => { const h = heightAt(x, z); for (let a = 0; a < 6; a++) if (Math.abs(heightAt(x + Math.cos(a) * rad, z + Math.sin(a) * rad) - h) > 2.5) return false; return true; };

  // ---------- fermes ----------
  let farms = 0;
  for (let t = 0; t < 4000 && farms < 12; t++) {
    const x = -1800 + r() * 2700, z = 800 + r() * 1700;
    if (surfaceAt(x, z) !== S_FIELD || nearRoad(x, z, 25) || !nearRoad(x, z, 90) || !flatSpot(x, z, 30)) continue;
    const yaw = r() * Math.PI;
    house(x, z, yaw, 10, 8, 6, M.wall, M.roof);
    const bx = x + Math.cos(yaw) * 22, bz = z - Math.sin(yaw) * 22;
    house(bx, bz, yaw, 14, 22, 8, M.barn, M.dark);
    const sx = x - Math.sin(yaw) * 16, sz = z - Math.cos(yaw) * 16, sy = heightAt(sx, sz);
    put(new THREE.CylinderGeometry(3, 3, 16, 16).translate(sx, sy + 8, sz), M.metal); put(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(sx, sy + 16, sz), M.metal);
    colliders.push({ x0: sx - 3, z0: sz - 3, x1: sx + 3, z1: sz + 3, y0: sy, top: sy + 19 });
    farms++;
  }

  // ---------- éoliennes ----------
  const rotors = [];
  const bladeGeo = new THREE.BoxGeometry(1.6, 26, 0.4); bladeGeo.translate(0, 13.5, 0);
  let wt = 0;
  for (let t = 0; t < 3000 && wt < 7; t++) {
    const x = -600 + r() * 2400, z = 900 + r() * 1500;
    if (surfaceAt(x, z) !== S_FIELD || nearRoad(x, z, 40)) continue;
    const y = heightAt(x, z);
    put(new THREE.CylinderGeometry(1.2, 2.2, 70, 12).translate(x, y + 35, z), M.white);
    trees.add({ x, z, r: 2.2, top: y + 70 }, x - 3, z - 3, x + 3, z + 3);
    const hub = new THREE.Group(); hub.position.set(x, y + 70, z); hub.rotation.y = -0.7;
    const nac = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 8).translate(0, 0, 2), M.white); hub.add(nac);
    const rot = new THREE.Group(); rot.position.z = -2.2; hub.add(rot);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(bladeGeo, M.white); b.rotation.z = k * Math.PI * 2 / 3; b.castShadow = true; rot.add(b); }
    rot.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), M.white));
    group.add(hub); rotors.push(rot); wt++;
  }

  // ---------- aéroport ----------
  const rw = AIRPORT.rwy, Y = AIRPORT.y;
  const rwyTex = canvasTexture(THREE, 128, 2048, (g, w, h) => {
    g.fillStyle = '#2f3033'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.1)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#eeeeea'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h);
    for (let y = 120; y < h - 120; y += 60) g.fillRect(w / 2 - 1.5, y, 3, 30);
    for (const y0 of [8, h - 40]) for (let k = 0; k < 8; k++) g.fillRect(10 + k * 14 + (k >= 4 ? 8 : 0), y0, 8, 32);
    g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.save(); g.translate(w / 2, 80); g.fillText('09', 0, 0); g.restore();
    g.save(); g.translate(w / 2, h - 60); g.rotate(Math.PI); g.fillText('27', 0, 0); g.restore();
  });
  rwyTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const rwyMesh = new THREE.Mesh(new THREE.PlaneGeometry(rw.w, rw.x1 - rw.x0), new THREE.MeshStandardMaterial({ map: rwyTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  rwyMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2); rwyMesh.position.set((rw.x0 + rw.x1) / 2, Y + 0.04, rw.z); rwyMesh.receiveShadow = true; group.add(rwyMesh);
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x6b6c6e, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const slab = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), apronMat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, Y + 0.03, (z0 + z1) / 2); m.receiveShadow = true; group.add(m); };
  slab(rw.x0, rw.z - 120, rw.x1, rw.z - 96);          // voie de circulation
  slab(1350, 300, 2050, rw.z - 96);                    // tarmac
  for (const x of [1200, 2250]) slab(x - 12, rw.z - 96, x + 12, rw.z - rw.w / 2);
  // aérogare, tour, hangars, manche à air
  box(1700, Y, 285, 260, 14, 40, M.glass); box(1700, Y + 14, 285, 264, 1.2, 44, M.white, 0, false);
  box(2050, Y, 300, 9, 34, 9, M.white); box(2050, Y + 34, 300, 13, 6, 13, M.glass, 0, false); box(2050, Y + 40, 300, 14, 0.8, 14, M.dark, 0, false);
  for (const x of [1060, 1170, 1280]) {
    const y0 = Y, half = new THREE.CylinderGeometry(22, 22, 50, 24, 1, false, 0, Math.PI); half.rotateZ(Math.PI / 2); half.rotateY(Math.PI / 2); half.translate(x, y0, 330);
    put(half, M.metal); colliders.push({ x0: x - 22, z0: 305, x1: x + 22, z1: 355, y0, top: y0 + 20 });
  }
  { const p = new THREE.CylinderGeometry(0.12, 0.12, 9, 6).translate(2500, Y + 4.5, rw.z + 60); put(p, M.dark); const sock = new THREE.ConeGeometry(0.8, 4.5, 10, 1, true); sock.rotateZ(Math.PI / 2); sock.translate(2502.3, Y + 8.6, rw.z + 60); put(sock, M.red); }

  // ---------- île : village, hélisurface, ponton ----------
  const vr = rng(5);
  const COLS = [0xf3e9d6, 0xe8c6a0, 0xcde3ea, 0xf5d0c5, 0xffffff, 0xf1e3a6];
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2 + vr() * 0.3, d = 60 + vr() * 90, x = VILLAGE.x + Math.cos(a) * d, z = VILLAGE.z + Math.sin(a) * d;
    if (nearRoad(x, z, 8)) continue;
    const wm = new THREE.MeshStandardMaterial({ color: COLS[k % COLS.length], roughness: 0.85 });
    house(x, z, a, 8 + vr() * 5, 7 + vr() * 4, 4 + vr() * 3, wm, vr() < 0.5 ? M.roof : new THREE.MeshStandardMaterial({ color: 0x2e6f8e, roughness: 0.7 }));
  }
  const hpx = VILLAGE.x + 70, hpz = VILLAGE.z + 75, hpy = heightAt(hpx, hpz);
  const hpTex = canvasTexture(THREE, 256, 256, (g, w) => {
    g.fillStyle = '#3a3c40'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 20, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f2f2f2'; g.fillRect(80, 64, 22, 128); g.fillRect(154, 64, 22, 128); g.fillRect(80, 117, 96, 22);
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.6, 40), [new THREE.MeshStandardMaterial({ color: 0x3a3c40 }), new THREE.MeshStandardMaterial({ map: hpTex, transparent: true }), apronMat]);
  pad.position.set(hpx, hpy + 0.3, hpz); pad.receiveShadow = true; group.add(pad);
  colliders.push({ x0: hpx - 10, z0: hpz - 10, x1: hpx + 10, z1: hpz + 10, y0: hpy - 1, top: hpy + 0.6, pad: true });
  // ponton dans la mer, côté sud de l'île
  {
    let px = ISLAND.x + 40, pz = ISLAND.z + ISLAND.r * 0.7;
    for (let t = 0; t < 40 && heightAt(px, pz) > 0.5; t++) pz += 10;
    for (let k = 0; k < 9; k++) box(px, 1.2, pz - 30 + k * 9, 4, 0.4, 9.2, M.wood, 0, false);
    for (let k = 0; k < 10; k++) for (const s of [-1.8, 1.8]) put(new THREE.CylinderGeometry(0.2, 0.2, 6, 6).translate(px + s, -1.4, pz - 34 + k * 9), M.wood);
    colliders.push({ x0: px - 2, z0: pz - 34, x1: px + 2, z1: pz + 50, y0: 0, top: 1.6, pad: true });
  }
  // phare de l'îlot
  {
    const x = ISLET.x, z = ISLET.z, y = heightAt(x, z);
    for (let k = 0; k < 6; k++) put(new THREE.CylinderGeometry(3.6 - k * 0.25, 3.8 - k * 0.25, 4.2, 20).translate(x, y + 2.1 + k * 4.2, z), k % 2 ? M.red : M.white);
    put(new THREE.CylinderGeometry(2.4, 2.4, 3, 16).translate(x, y + 26.7, z), M.glass);
    put(new THREE.ConeGeometry(3, 3, 16).translate(x, y + 29.7, z), M.red);
    trees.add({ x, z, r: 3.8, top: y + 31 }, x - 4, z - 4, x + 4, z + 4);
  }
  // station-service du désert
  {
    const q = roadSamples.find(s => s.road.name === 'Route du désert' && s.z < -700);
    if (q) {
      const ox = q.x - q.dz * 28, oz = q.z + q.dx * 28, y = heightAt(ox, oz), yaw = Math.atan2(q.dx, q.dz);
      box(ox, y - 0.3, oz, 18, 5, 12, M.wall, yaw);
      box(ox - q.dx * 0, y + 5.2, oz, 22, 0.6, 16, M.red, yaw, false);
      const sg = new THREE.BoxGeometry(6, 2, 0.4); sg.rotateY(yaw + Math.PI / 2); sg.translate(q.x - q.dz * 12, y + 7, q.z + q.dx * 12); put(sg, M.sign);
      put(new THREE.CylinderGeometry(0.2, 0.2, 7, 6).translate(q.x - q.dz * 12, y + 3, q.z + q.dx * 12), M.dark);
    }
  }
  // chalet au col
  { const q = roadSamples.find(s => s.road.name === 'Col des Aigles' && Math.abs(s.x) < 30); if (q) house(q.x - q.dz * 24, q.z + q.dx * 24, Math.atan2(q.dx, q.dz), 12, 9, 5, M.wood, M.dark); }

  // ---------- tremplins ----------
  const rampTex = canvasTexture(THREE, 64, 256, (g, w, h) => {
    g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#f2b705'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 16); g.lineTo(w, y + 26); g.lineTo(0, y + 10); g.fill(); }
  });
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.6 });
  for (const rp of RAMPS) {
    const y = heightAt(rp.x, rp.z);
    rp.y = y;
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(rp.len, 0); sh.lineTo(rp.len, rp.h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: rp.w, bevelEnabled: false });
    g.translate(-rp.len / 2, 0, -rp.w / 2); g.rotateY(-Math.PI / 2);       // la montée suit +z local
    const m = new THREE.Mesh(g, rampMat); m.position.set(rp.x, y, rp.z); m.rotation.y = rp.yaw; m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  for (const [mat, list] of parts) {
    const m = new THREE.Mesh(mergeGeometries(list.map(g => { g.deleteAttribute('uv'); return g; })), mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  return {
    group,
    update(dt, camPos, far = 4000) {
      for (const rt of rotors) rt.rotation.z += dt * 1.1;
      for (const l of layers) l.update(camPos, l === L.rock || l === L.cactus ? Math.min(1200, far * 0.4) : far * 0.7, 380);
    },
  };
}

/* hauteur d'un tremplin en (x, z) (ou -Infinity) */
export function rampAt(x, z) {
  for (const rp of RAMPS) {
    if (rp.y == null) continue;
    const dx = x - rp.x, dz = z - rp.z, s = Math.sin(rp.yaw), c = Math.cos(rp.yaw);
    const along = dx * s + dz * c, lat = dx * c - dz * s;
    if (Math.abs(lat) < rp.w / 2 && Math.abs(along) < rp.len / 2) return rp.y + (along + rp.len / 2) / rp.len * rp.h;
  }
  return -Infinity;
}

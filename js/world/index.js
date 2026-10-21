/* ===== Monde : assemblage et requêtes physiques (sol, eau, obstacles) ===== */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { SpatialGrid, canvasTexture, clamp, rng } from '../util.js';
import {
  buildTerrain, buildTerrainMesh, buildRoadMeshes, buildMapCanvas, heightAt, normalAt, surfaceAt, bridgeAt,
  roadSamples, CITY, LAKE, AIRPORT, ISLAND, VILLAGE, HALF, SIZE, S_WATER, STUNT, RAMPS, bridgeColParts,
} from './terrain.js';
import { buildCity, curbAt, blockRect, NBX, NBZ } from './city.js';
import { buildStunts } from './stunts.js';
import { buildProps, rampAt } from './props.js';

const tick = () => new Promise(r => setTimeout(r, 0));

function waterNormalMap() {
  // bruit périodique (donc répétable sans couture) -> carte de normales
  const S = 256, P = 16, g = new Float32Array(P * P), rnd = rng(3);
  for (let i = 0; i < P * P; i++) g[i] = rnd();
  const smp = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => g[((b % P + P) % P) * P + ((a % P) + P) % P];
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
  const hgt = (x, y) => smp(x / S * P, y / S * P) + 0.5 * smp(x / S * P * 2 + 3, y / S * P * 2 + 7);
  return canvasTexture(THREE, S, S, (c) => {
    const d = c.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * 2.2, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
      d.data[k] = (-dx / l * 0.5 + 0.5) * 255; d.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; d.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; d.data[k + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  }, { color: false });
}

export async function createWorld(renderer, progress = () => {}) {
  const group = new THREE.Group();
  progress('Sculpture du relief…'); await tick();
  buildTerrain(progress);
  progress('Maillage du terrain…'); await tick();
  const terrainMesh = buildTerrainMesh(renderer);
  group.add(terrainMesh.group);
  group.add(buildRoadMeshes(renderer));

  const colliders = [], trees = new SpatialGrid(32), treeSpots = [];
  progress('Construction de la ville…'); await tick();
  const city = buildCity(renderer, colliders, treeSpots);
  group.add(city.group);
  progress('Plantation des forêts…'); await tick();
  const props = buildProps(renderer, colliders, trees, treeSpots);
  group.add(props.group);
  progress('Parc de cascades…'); await tick();
  const colParts = [];
  const stunts = buildStunts(colParts, colliders);
  group.add(stunts.group);
  const boxes = new SpatialGrid(32);
  for (const c of colliders) boxes.add(c, c.x0, c.z0, c.x1, c.z1);

  // maillage de collision « surfaces » (murs, plafonds, toits, trottoirs, tremplins, ponts, parc) pour la Tesla
  progress('Maillage de collision…'); await tick();
  const boxGeo = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
  for (const c of colliders) colParts.push(boxGeo(c.x0, c.y0 - 0.5, c.z0, c.x1, c.top, c.z1));
  for (let i = 0; i < NBX; i++) for (let j = 0; j < NBZ; j++) { const b = blockRect(i, j); colParts.push(boxGeo(b.x0, CITY.y - 0.6, b.z0, b.x1, CITY.y + 0.2, b.z1)); }
  for (const rp of RAMPS) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(rp.len, 0); sh.lineTo(rp.len, rp.h); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: rp.w, bevelEnabled: false }); g.translate(-rp.len / 2, 0, -rp.w / 2); g.rotateY(-Math.PI / 2); g.rotateY(rp.yaw); g.translate(rp.x, rp.y, rp.z);
    colParts.push(g);
  }
  for (const g of bridgeColParts) colParts.push(g);
  const colGeom = mergeGeometries(colParts.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k); n.clearGroups(); return n; }), false);
  const bvh = new MeshBVH(colGeom, { maxLeafTris: 8 });
  const _ray = new THREE.Ray(), _cpt = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }, _tn = new THREE.Vector3(), _tp = new THREE.Vector3();
  /* rayon contre le maillage et le relief : { point, distance, normal } ou null */
  function raycast(origin, dir, far) {
    _ray.origin.copy(origin); _ray.direction.copy(dir);
    let best = null;
    const h = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
    if (h && h.distance <= far) { const n = h.face.normal.clone(); if (n.dot(dir) > 0) n.negate(); best = { point: h.point.clone(), distance: h.distance, normal: n }; }
    // relief : marche le long du rayon
    const lim = best ? best.distance : far, step = 0.4;
    let prev = 0, inside = origin.y < heightAt(origin.x, origin.z) - 0.05;
    if (!inside) for (let t = step; t <= lim + step; t += step) {
      const tt = Math.min(t, lim);
      _tp.copy(origin).addScaledVector(dir, tt);
      if (_tp.y <= heightAt(_tp.x, _tp.z)) {
        let a = prev, b = tt;
        for (let k = 0; k < 8; k++) { const m = (a + b) / 2; _tp.copy(origin).addScaledVector(dir, m); if (_tp.y <= heightAt(_tp.x, _tp.z)) b = m; else a = m; }
        _tp.copy(origin).addScaledVector(dir, b); _tp.y = heightAt(_tp.x, _tp.z);
        const n = normalAt(_tp.x, _tp.z, new THREE.Vector3());
        if (n.dot(dir) < 0) best = { point: _tp.clone(), distance: b, normal: n };
        break;
      }
      prev = tt; if (tt >= lim) break;
    }
    return best;
  }
  /* point de surface le plus proche de p à moins de maxD : { point, distance } ou null */
  function closest(p, maxD) {
    let best = null;
    const r = bvh.closestPointToPoint(p, _cpt, 0, maxD);
    if (r && r.distance < maxD) best = { point: r.point.clone(), distance: r.distance };
    const h = heightAt(p.x, p.z);
    if (p.y - h < maxD) {
      normalAt(p.x, p.z, _tn); const d = (p.y - h) * _tn.y;
      if (!best || d < best.distance) best = { point: p.clone().addScaledVector(_tn, -d), distance: Math.max(d, 1e-5) };
    }
    return best;
  }
  const inStunt = (x, z) => x > STUNT.x0 - 5 && x < STUNT.x1 + 5 && z > STUNT.z0 - 5 && z < STUNT.z1 + 5;
  const _down = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3();

  // eau : mer et lac
  const wn = waterNormalMap(); wn.repeat.set(1600, 1600);
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1b5b73, roughness: 0.08, metalness: 0.15, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.receiveShadow = true; group.add(sea);
  const wn2 = wn.clone(); wn2.repeat.set(40, 40); wn2.needsUpdate = true;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 1.15, 64), new THREE.MeshStandardMaterial({ color: 0x2a6a5c, roughness: 0.06, metalness: 0.1, normalMap: wn2, normalScale: new THREE.Vector2(0.25, 0.25) }));
  lake.rotation.x = -Math.PI / 2; lake.position.set(LAKE.x, LAKE.level, LAKE.z); group.add(lake);

  progress('Dessin de la carte…'); await tick();
  const mapCanvas = buildMapCanvas(1024);

  /* ---------- requêtes ---------- */
  const inRectXZ = (c, x, z, m = 0) => x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m;
  /* sol sous (x, z) pour un objet à l'altitude y (les toits et tabliers ne comptent que si on est au-dessus) */
  function groundAt(x, z, y = 1e9) {
    let g = heightAt(x, z);
    const cb = curbAt(x, z); if (cb) g = Math.max(g, CITY.y + cb);
    const b = bridgeAt(x, z); if (b > -1e9 && y >= b - 3) g = Math.max(g, b);
    const rp = rampAt(x, z); if (rp > g) g = rp;
    boxes.query(x, z, 0, c => { if (inRectXZ(c, x, z) && y >= c.top - 1.2 && c.top > g) g = c.top; });
    if (inStunt(x, z) && y < 1e8) {
      _o.set(x, y + 1.2, z); _ray.origin.copy(_o); _ray.direction.copy(_down);
      const h = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, y + 1.2 - g);
      if (h && h.point.y > g) g = h.point.y;
    }
    return g;
  }
  function waterAt(x, z) {
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.15) return LAKE.level;
    return 0;
  }
  /* repousse un cercle (x, z, rayon) hors des bâtiments et des arbres, entre les altitudes y et y + h.
     Retourne null ou { nx, nz, depth, soft } du contact le plus profond (la position est corrigée dans p). */
  const _hit = { nx: 0, nz: 0, depth: 0, soft: false };
  function collideCircle(p, rad, h = 1.5, treesOnly = false) {
    let best = null;
    const test = (nx, nz, depth, soft) => { if (depth > 0 && (!best || depth > best.depth)) { best = _hit; _hit.nx = nx; _hit.nz = nz; _hit.depth = depth; _hit.soft = soft; } };
    for (let it = 0; it < 2; it++) {
      if (!treesOnly) boxes.query(p.x, p.z, rad, c => {
        if (p.y >= c.top - 0.4 || p.y + h < c.y0) return;
        const qx = clamp(p.x, c.x0, c.x1), qz = clamp(p.z, c.z0, c.z1);
        let dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
        if (d >= rad) return;
        if (d < 1e-6) { // centre dans la boîte : on sort par le côté le plus proche
          const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, bb = c.z1 - p.z, m = Math.min(l, rr, t, bb);
          if (m === l) { dx = -1; dz = 0; d = -l; } else if (m === rr) { dx = 1; dz = 0; d = -rr; } else if (m === t) { dx = 0; dz = -1; d = -t; } else { dx = 0; dz = 1; d = -bb; }
          p.x += dx * (rad - d); p.z += dz * (rad - d); test(dx, dz, rad - d, !!c.soft); return;
        }
        dx /= d; dz /= d; p.x += dx * (rad - d); p.z += dz * (rad - d); test(dx, dz, rad - d, !!c.soft);
      });
      trees.query(p.x, p.z, rad + 4, t => {
        if (p.y >= t.top || p.y + h < t.top - 60) return;
        let dx = p.x - t.x, dz = p.z - t.z; const d = Math.hypot(dx, dz), m = rad + t.r;
        if (d >= m || d < 1e-6) return;
        dx /= d; dz /= d; p.x += dx * (m - d); p.z += dz * (m - d); test(dx, dz, m - d, false);
      });
    }
    return best;
  }
  /* un point (pour les aéronefs) est-il dans un obstacle ? */
  function solidAt(x, y, z) {
    let hit = false;
    boxes.query(x, z, 0, c => { if (!hit && inRectXZ(c, x, z) && y < c.top - 0.3 && y > c.y0 - 5) hit = true; });
    if (!hit) trees.query(x, z, 4, t => { if (!hit && y < t.top - 1 && Math.hypot(x - t.x, z - t.z) < t.r + 0.6) hit = true; });
    return hit;
  }
  /* point de route le plus proche (pour réapparaître sur une route) */
  function nearestRoad(x, z) {
    let best = null, bd = 1e18;
    for (const q of roadSamples) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd && !q.bridge) { bd = d; best = { x: q.x - q.dz * 2.5, z: q.z + q.dx * 2.5, yaw: Math.atan2(-q.dx, -q.dz) }; } }
    // rues de la ville
    const P = CITY.pitch;
    const sxs = clamp(Math.round((x - CITY.x0) / P), 0, Math.round((CITY.x1 - CITY.x0) / P)) * P + CITY.x0, szs = clamp(Math.round((z - CITY.z0) / P), 0, Math.round((CITY.z1 - CITY.z0) / P)) * P + CITY.z0;
    const cxz = clamp(z, CITY.z0, CITY.z1), czx = clamp(x, CITY.x0, CITY.x1);
    for (const [px, pz, yaw] of [[sxs - 3, cxz, Math.PI], [czx, szs - 3, Math.PI / 2]]) {
      const d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; best = { x: px, z: pz, yaw }; }
    }
    best.y = groundAt(best.x, best.z);
    return best;
  }
  /* zone (pour l'affichage) */
  function zoneName(x, z) {
    if (x > CITY.x0 - 40 && x < CITY.x1 + 40 && z > CITY.z0 - 40 && z < CITY.z1 + 40) return 'Ville';
    if (x > AIRPORT.x0 && x < AIRPORT.x1 && z > AIRPORT.z0 && z < AIRPORT.z1) return 'Aéroport';
    if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 120) return 'Île aux Palmiers';
    if (Math.hypot(x + 3450, z - 550) < 400) return 'Îlot du Phare';
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 120) return 'Lac';
    if (inStunt(x, z)) return 'Parc de cascades';
    const s = surfaceAt(x, z), h = heightAt(x, z);
    if (s === S_WATER) return 'Mer';
    if (z < -1000 && h > 140) return 'Montagnes';
    if (x > 950 && z < -250) return 'Désert';
    if (x < -800) return 'Forêt';
    if (z > 600) return h < 4 ? 'Plage' : 'Campagne';
    return 'Collines';
  }

  return {
    group, mapCanvas, night: city.night, SIZE, HALF,
    heightAt, groundAt, waterAt, normalAt, surfaceAt, collideCircle, solidAt, nearestRoad, zoneName, raycast, closest, stuntNeon: stunts.neonMats,
    update(dt, camPos, far = 4000) {
      terrainMesh.update(camPos, far);
      wn.offset.x += dt * 0.004; wn.offset.y += dt * 0.0025;
      wn2.offset.x -= dt * 0.003;
      props.update(dt, camPos, far);
      city.update(camPos, far);
    },
  };
}

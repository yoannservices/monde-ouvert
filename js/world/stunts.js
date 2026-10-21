/* ===== Parc de cascades (repris de la Tesla Roadster) : tube 360°, tunnels, looping, half-pipe,
   mur vertical, tremplins. Toutes les surfaces vont dans le maillage de collision (murs et plafonds). ===== */
import * as THREE from 'three';
import { canvasTexture } from '../util.js';
import { STUNT } from './terrain.js';

export function buildStunts(colParts, colliders) {
  const group = new THREE.Group(), V3 = THREE.Vector3;
  const Y = STUNT.y, ZC = (STUNT.z0 + STUNT.z1) / 2, X0 = STUNT.x0;
  const concreteTex = canvasTexture(THREE, 256, 256, (g, w) => {
    g.fillStyle = '#9c9a94'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, w - 2);
  });
  const tubeTex = canvasTexture(THREE, 256, 256, (g, w) => {
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#2b2f36'; for (let k = 0; k < 4; k++) g.fillRect(0, k * 64, w, 8);
    g.fillStyle = 'rgba(34,211,255,.5)'; g.fillRect(0, 124, w, 6);
  });
  const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.85, side: THREE.DoubleSide });
  const tubeMat = new THREE.MeshStandardMaterial({ map: tubeTex, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const neonMats = [0x22d3ff, 0xff2bd6, 0xffb000, 0x39ff88].map(c => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 1.6 }));
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide });

  function colAdd(geo, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.clearGroups(); if (matrix) g.applyMatrix4(matrix);
    colParts.push(g);
  }
  function placeMesh(geo, mat, matrix, collide = true, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    if (matrix) m.applyMatrix4(matrix);
    m.castShadow = shadow; m.receiveShadow = true; group.add(m);
    if (collide) { m.updateMatrix(); colAdd(geo, m.matrix); }
    return m;
  }
  const mat4 = (x, y, z, ry = 0) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(1, 1, 1));
  function extrude(shape, depth, segs = 24) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segs, steps: 1 });
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
    return g;
  }
  function neonLine(points, mat, r = 0.12) { group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 2), r, 6), mat)); }

  // tunnel à section arrondie (sans plancher), axe le long de X
  function tunnel(x0, z, length, W, H, rc, outerW = W + 4, outerH = H + 2, slope = 0) {
    const s = new THREE.Shape(), ow = outerW / 2, hw = W / 2, y0 = 0;
    s.moveTo(-ow - slope, y0 - 0.05); s.lineTo(-ow, outerH); s.lineTo(ow, outerH); s.lineTo(ow + slope, y0 - 0.05); s.lineTo(hw - rc, y0 - 0.05);
    s.absarc(hw - rc, y0 - 0.05 + rc, rc, -Math.PI / 2, 0, false); s.lineTo(hw, H - rc); s.absarc(hw - rc, H - rc, rc, 0, Math.PI / 2, false);
    s.lineTo(-hw + rc, H); s.absarc(-hw + rc, H - rc, rc, Math.PI / 2, Math.PI, false); s.lineTo(-hw, y0 - 0.05 + rc);
    s.absarc(-hw + rc, y0 - 0.05 + rc, rc, Math.PI, Math.PI * 1.5, false); s.lineTo(-ow - slope, y0 - 0.05);
    const g = extrude(s, length, 16); g.rotateY(Math.PI / 2);
    placeMesh(g, concreteMat, mat4(x0, Y, z));
    neonLine([new V3(x0 + 2, Y + H - 0.15, z), new V3(x0 + length - 2, Y + H - 0.15, z)], neonMats[0], 0.1);
    for (const sd of [-1, 1]) neonLine([new V3(x0 + 2, Y + H * 0.55, z + sd * (hw - 0.12)), new V3(x0 + length - 2, Y + H * 0.55, z + sd * (hw - 0.12))], neonMats[1], 0.07);
    // murs du tunnel : obstacles pour les autres véhicules
    for (const sd of [-1, 1]) { const a = z + sd * hw, b = z + sd * (ow + slope * 0.5); colliders.push({ x0: x0, x1: x0 + length, z0: Math.min(a, b), z1: Math.max(a, b), y0: Y, top: Y + outerH }); }
  }
  // half-pipe : deux ailes extrudées, axe le long de X
  function halfPipe(x0, z, length, flat, rad, ext, deck) {
    for (const sg of [-1, 1]) {
      const s = new THREE.Shape(), a = flat / 2, b = a + rad;
      s.moveTo(sg * (b + deck), 0); s.lineTo(sg * (b + deck), rad + ext); s.lineTo(sg * b, rad + ext); s.lineTo(sg * b, rad);
      for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI / 2; s.lineTo(sg * (a + rad * Math.cos(t)), rad - rad * Math.sin(t)); }
      s.lineTo(sg * (b + deck), 0);
      const g = extrude(s, length, 24); g.rotateY(Math.PI / 2);
      placeMesh(g, concreteMat, mat4(x0, Y, z));
      neonLine([new V3(x0, Y + rad + ext + 0.12, z - sg * (flat / 2 + rad)), new V3(x0 + length, Y + rad + ext + 0.12, z - sg * (flat / 2 + rad))], neonMats[2], 0.12);
    }
  }
  // looping : ruban hélicoïdal, entrée en roulant vers -Z au point (x, z)
  function loop(x, z, Rl, width, shift) {
    const segs = 160, pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = -0.35 + (Math.PI * 2 + 0.7) * i / segs, aa = Math.min(Math.max(a, 0), Math.PI * 2), lat = shift * (aa / (Math.PI * 2));
      let py, pz, ny, nz;
      if (a < 0) { py = 0; pz = -Rl * a; ny = 1; nz = 0; } else if (a > Math.PI * 2) { py = 0; pz = -Rl * (a - Math.PI * 2); ny = 1; nz = 0; }
      else { py = Rl - Rl * Math.cos(a); pz = -Rl * Math.sin(a); ny = Math.cos(a); nz = Math.sin(a); }
      for (const s of [-1, 1]) { pos.push(x + lat + s * width / 2, Y + py + 0.02, z + pz); nor.push(0, ny, nz); uv.push((s + 1) * width / 16, i * Rl * 0.05); }
    }
    for (let i = 0; i < segs; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); placeMesh(g, concreteMat, null);
    for (const side of [0, 1]) {
      const rp = [], ri = [];
      for (let i = 0; i <= segs; i++) { const k = (i * 2 + side) * 3; rp.push(pos[k], pos[k + 1], pos[k + 2], pos[k] + nor[k] * 1.1, pos[k + 1] + nor[k + 1] * 1.1, pos[k + 2] + nor[k + 2] * 1.1); }
      for (let i = 0; i < segs; i++) { const k = i * 2; ri.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
      placeMesh(rg, railMat, null, true, false);
    }
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 64; i++) { const a = (Math.PI * 2) * i / 64, lat = shift * (a / (Math.PI * 2)); pts.push(new V3(x + lat + s * width / 2, Y + Rl - Rl * Math.cos(a) + 1.15 * Math.cos(a), z - Rl * Math.sin(a) + 1.15 * Math.sin(a))); }
      neonLine(pts, neonMats[3], 0.12);
    }
    for (const a of [Math.PI * 0.75, Math.PI, Math.PI * 1.25]) {
      const lat = shift * (a / (Math.PI * 2)), py = Rl - Rl * Math.cos(a), pz = -Rl * Math.sin(a);
      for (const s of [-1, 1]) { const h = py + 0.5, p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, h, 10), poleMat); p.position.set(x + lat + s * (width / 2 + 1.2), Y + h / 2, z + pz); p.castShadow = true; group.add(p); }
    }
  }
  // tube complet (rouler à 360°), axe le long de X
  function tube(x0, z, length, Rt) {
    const g = new THREE.CylinderGeometry(Rt, Rt, length, 64, 1, true);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * Math.PI * Rt) / 10, uv.getY(i) * length / 10);
    g.rotateZ(Math.PI / 2);
    placeMesh(g, tubeMat, mat4(x0 + length / 2, Y + Rt, z));
    for (let x = x0; x <= x0 + length + 0.1; x += 20) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Rt + 0.35, 0.35, 8, 48), poleMat); ring.rotation.y = Math.PI / 2; ring.position.set(x, Y + Rt, z); ring.castShadow = true; group.add(ring);
      const rn = new THREE.Mesh(new THREE.TorusGeometry(Rt + 0.72, 0.08, 6, 48), neonMats[0]); rn.rotation.y = Math.PI / 2; rn.position.set(x, Y + Rt, z); group.add(rn);
    }
    for (const a of [Math.PI / 2, Math.PI * 0.15, Math.PI * 0.85]) { const r = Rt - 0.06; neonLine([new V3(x0 + 1, Y + Rt + Math.sin(a) * r, z + Math.cos(a) * r), new V3(x0 + length - 1, Y + Rt + Math.sin(a) * r, z + Math.cos(a) * r)], neonMats[1], 0.06); }
  }
  // tremplin à profil parabolique, monte vers +X (rotation ry)
  function kicker(x, z, L, h, width, ry = 0) {
    const s = new THREE.Shape(); s.moveTo(0, 0);
    for (let i = 1; i <= 20; i++) { const u = i / 20; s.lineTo(u * L, h * u * u); }
    s.lineTo(L + 0.6, h); s.lineTo(L + 0.6, 0); s.lineTo(0, 0);
    const g = extrude(s, width, 12); g.translate(0, 0, -width / 2);
    placeMesh(g, concreteMat, mat4(x, Y, z, ry));
    const c = Math.cos(ry), sn = Math.sin(ry), p = (a, b, y) => new V3(x + a * c + b * sn, Y + y, z - a * sn + b * c);
    neonLine([p(L + 0.3, -width / 2, h + 0.1), p(L + 0.3, width / 2, h + 0.1)], neonMats[2], 0.1);
  }
  // mur vertical avec quarter-pipe à sa base, face vers -X
  function wallRide(x, z0, length, height, rq) {
    const s = new THREE.Shape(); s.moveTo(-rq, 0);
    for (let i = 1; i <= 28; i++) { const t = i / 28 * Math.PI / 2; s.lineTo(-rq + rq * Math.sin(t), rq - rq * Math.cos(t)); }
    s.lineTo(0, height); s.lineTo(8, height); s.lineTo(8, 0); s.lineTo(-rq, 0);
    const g = extrude(s, length, 24);
    placeMesh(g, concreteMat, mat4(x, Y, z0));
    for (const y of [height * 0.33, height * 0.66, height - 0.3]) neonLine([new V3(x - 0.08, Y + y, z0 + 2), new V3(x - 0.08, Y + y, z0 + length - 2)], neonMats[y > height * 0.9 ? 0 : 1], 0.1);
    colliders.push({ x0: x - 0.5, x1: x + 8, z0, z1: z0 + length, y0: Y, top: Y + height });
  }

  // disposition du parc d'origine (est de la ville de la Tesla), recentrée ici
  tube(X0 + 50, ZC - 270, 170, 11);
  tunnel(X0 + 50, ZC - 150, 220, 24, 13, 6, 30, 15, 0);
  loop(X0 + 330, ZC - 110, 22, 16, 20);
  halfPipe(X0 + 50, ZC + 40, 150, 18, 10, 4, 5);
  kicker(X0 + 240, ZC + 40, 40, 14, 16, 0);
  {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(24, 9); for (let i = 1; i <= 20; i++) { const u = i / 20; s.lineTo(24 + u * 50, 9 * (1 - u) * (1 - u)); } s.lineTo(0, 0);
    const g = extrude(s, 22, 12); g.translate(0, 0, -11);
    placeMesh(g, concreteMat, mat4(X0 + 345, Y, ZC + 40));
  }
  wallRide(STUNT.x1 - 10, STUNT.z0 + 20, STUNT.z1 - STUNT.z0 - 40, 45, 10);
  for (const [x, z, ry, L, h] of [[60, 200, 0, 10, 2.5], [110, 230, 0.6, 12, 3.5], [170, 190, -0.4, 10, 3], [230, 260, Math.PI / 2, 14, 4.5], [300, 210, Math.PI, 12, 3.5], [380, 280, -Math.PI / 2, 10, 2.5], [400, 180, 0.3, 16, 6], [260, 330, 0, 12, 4]])
    kicker(X0 + x, ZC + z, L, h, 10, ry);
  tunnel(X0 + 330, ZC - 300, 90, 18, 10, 5, 28, 16, 30);
  // dalle de béton
  const padMat = new THREE.MeshStandardMaterial({ map: concreteTex.clone(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  padMat.map.repeat.set((STUNT.x1 - STUNT.x0) / 10, (STUNT.z1 - STUNT.z0) / 10); padMat.map.needsUpdate = true;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(STUNT.x1 - STUNT.x0, STUNT.z1 - STUNT.z0), padMat);
  pad.rotation.x = -Math.PI / 2; pad.position.set((STUNT.x0 + STUNT.x1) / 2, Y + 0.03, ZC); pad.receiveShadow = true; group.add(pad);
  return { group, neonMats };
}

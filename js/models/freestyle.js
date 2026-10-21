/* Repris de trottinette-freestyle/js/rider.js, adapté en module (three r165). */
export function createFreestyleModel(THREE){
const Rider = (() => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const std = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  function box(w, h, d, mat) { return sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); }
  function cyl(r1, r2, h, mat, seg = 12) { return sh(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat)); }
  function put(parent, obj, x, y, z) { obj.position.set(x, y, z); parent.add(obj); return obj; }

  /* Segment de membre : pivot à l'articulation, os vers -y */
  function segment(len, r1, r2, mat) {
    const g = new THREE.Group();
    const m = cyl(r1, r2, len, mat, 10);
    m.position.y = -len / 2;
    g.add(m, sh(new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.03, 10, 8), mat)));
    g.userData.len = len;
    return g;
  }

  /* IK analytique à 2 os dans l'espace du rig */
  const DOWN = V(0, -1, 0);
  const _d = V(0, 0, 0), _q = V(0, 0, 0), _u = V(0, 0, 0), _b = V(0, 0, 0), _w = V(0, 0, 0);
  function ik(upper, lower, A, T, pole) {
    const l1 = upper.userData.len, l2 = lower.userData.len;
    _d.subVectors(T, A);
    let d = _d.length();
    if (d < 1e-4) { _d.set(0, -1, 0); d = 1e-4; } else _d.divideScalar(d);
    d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, d));
    const ang = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    _q.copy(pole).addScaledVector(_d, -pole.dot(_d));
    if (_q.lengthSq() < 1e-8) _q.set(0, 0, 1);
    _q.normalize();
    _u.copy(_d).multiplyScalar(Math.cos(ang)).addScaledVector(_q, Math.sin(ang));
    upper.position.copy(A);
    upper.quaternion.setFromUnitVectors(DOWN, _u);
    _b.copy(A).addScaledVector(_u, l1);
    _w.subVectors(T, _b);
    if (_w.lengthSq() < 1e-8) _w.copy(_u); else _w.normalize();
    lower.position.copy(_b);
    lower.quaternion.setFromUnitVectors(DOWN, _w);
    return _b.clone().addScaledVector(_w, l2);
  }

  /* ── Bibliothèque de poses (espace du rig) ── */
  const BASE = {
    hips: V(0, 1.0, -0.08), torsoPitch: 0.34, torsoYaw: 0, torsoRoll: 0, headPitch: -0.2,
    handFreeL: 0, handFreeR: 0, handL: V(0.3, 1.0, 0.1), handR: V(-0.3, 1.0, 0.1),
    footFreeL: 0, footFreeR: 0, footL: V(0.08, 0.35, 0.05), footR: V(-0.08, 0.35, -0.12),
  };
  const POSES = {
    ride: {},
    crouch: { hips: V(0, 0.8, -0.12), torsoPitch: 0.62, headPitch: -0.55 },
    push: { hips: V(0, 0.94, -0.05), torsoPitch: 0.42, footFreeR: 1, footR: V(-0.17, 0.08, -0.3) },
    air: { hips: V(0, 0.95, -0.07), torsoPitch: 0.36 },
    tuck: { hips: V(0, 1.02, -0.04), torsoPitch: 0.45, footFreeL: 1, footFreeR: 1, footL: V(0.1, 0.46, 0.02), footR: V(-0.1, 0.44, -0.08) },
    release: { handFreeL: 1, handFreeR: 1, handL: V(0.46, 1.1, 0.12), handR: V(-0.46, 1.1, 0.12), torsoPitch: 0.25 },
    noHander: { handFreeL: 1, handFreeR: 1, handL: V(0.78, 1.38, -0.05), handR: V(-0.78, 1.38, -0.05), torsoPitch: 0.08, hips: V(0, 1.0, -0.06), headPitch: 0.05 },
    superman: { hips: V(0, 1.08, -0.62), torsoPitch: 1.28, headPitch: 0.7, footFreeL: 1, footFreeR: 1, footL: V(0.12, 1.02, -1.28), footR: V(-0.12, 1.0, -1.25) },
    canCan: { footFreeL: 1, footL: V(0.55, 0.58, 0.32), torsoRoll: -0.15, torsoPitch: 0.3 },
    tuckNoHander: { hips: V(0, 1.02, -0.05), torsoPitch: 0.75, handFreeL: 1, handFreeR: 1, handL: V(0.14, 0.78, 0.28), handR: V(-0.14, 0.78, 0.28), footFreeL: 1, footFreeR: 1, footL: V(0.1, 0.5, 0.12), footR: V(-0.1, 0.5, 0.05) },
    xup: { torsoPitch: 0.42, hips: V(0, 0.95, -0.05) },
    manual: { hips: V(0, 0.92, -0.22), torsoPitch: 0.05, headPitch: -0.35 },
    noseManual: { hips: V(0, 0.92, 0.04), torsoPitch: 0.62, headPitch: -0.6 },
    grind: { hips: V(0, 0.88, -0.1), torsoPitch: 0.5, headPitch: -0.45 },
    bail: { hips: V(0, 0.55, -0.3), torsoPitch: -0.6, handFreeL: 1, handFreeR: 1, handL: V(0.6, 0.7, -0.4), handR: V(-0.6, 0.8, -0.3), footFreeL: 1, footFreeR: 1, footL: V(0.2, 0.3, 0.4), footR: V(-0.25, 0.2, 0.3) },
  };

  function clonePose(p) {
    const o = {};
    for (const k in p) o[k] = p[k] && p[k].isVector3 ? p[k].clone() : p[k];
    return o;
  }
  function makePose(names) {           // names : [[nom, poids], ...] appliqués dans l'ordre
    const out = clonePose(BASE);
    for (const [n, w] of names) {
      const p = POSES[n];
      if (!p || w <= 0) continue;
      for (const k in p) {
        if (p[k].isVector3) out[k].lerp(p[k], w);
        else out[k] += (p[k] - out[k]) * w;
      }
    }
    return out;
  }

  function create(colors = {}) {
    const C = Object.assign({
      shirt: 0x22c55e, pants: 0x2a313d, shoes: 0xeeeeee, skin: 0xd9a47e, helmet: 0x15171c,
      deck: 0x1b1d22, bars: 0xb8bdc6, core: 0x22c55e,
    }, colors);
    const M = {
      shirt: std(C.shirt, 0.85), pants: std(C.pants, 0.9), shoes: std(C.shoes, 0.6), sole: std(0x1a1a1a, 0.9),
      skin: std(C.skin, 0.7), helmet: std(C.helmet, 0.3, 0.25), deck: std(C.deck, 0.45, 0.5),
      grip: std(0x0b0b0b, 1), bars: std(C.bars, 0.28, 0.9), tire: std(0x202227, 0.85),
      core: std(C.core, 0.35, 0.6), rubber: std(0x101010, 0.9), visor: std(0x0e0e10, 0.12, 0.6),
    };

    const root = new THREE.Group();
    const com = put(root, new THREE.Group(), 0, 0.72, 0);           // pivot des flips au centre de gravité
    const body = put(com, new THREE.Group(), 0, -0.72, 0);
    const tilt = put(body, new THREE.Group(), 0, 0.055, -0.26);     // pivot autour de la roue arrière (manual)
    const rig = put(tilt, new THREE.Group(), 0, -0.055, 0.26);

    function wheel() {
      const g = new THREE.Group();
      const tire = cyl(0.055, 0.055, 0.024, M.tire, 18); tire.rotation.z = Math.PI / 2;
      const core = cyl(0.036, 0.036, 0.027, M.core, 12); core.rotation.z = Math.PI / 2;
      const spoke = box(0.028, 0.07, 0.012, M.bars);
      g.add(tire, core, spoke);
      return g;
    }

    /* ── Trottinette ── */
    const HEAD = V(0, 0.13, 0.25);
    const whip = put(rig, new THREE.Group(), HEAD.x, HEAD.y, HEAD.z);
    const deck = put(whip, new THREE.Group(), -HEAD.x, -HEAD.y, -HEAD.z);
    put(deck, box(0.125, 0.032, 0.5, M.deck), 0, 0.083, -0.03);
    put(deck, box(0.118, 0.005, 0.47, M.grip), 0, 0.101, -0.03);
    const neck = put(deck, box(0.05, 0.05, 0.1, M.deck), 0, 0.11, 0.21);
    neck.rotation.x = -0.35;
    put(deck, box(0.046, 0.012, 0.12, M.deck), 0, 0.12, -0.255);   // frein arrière
    const rearWheel = put(deck, wheel(), 0, 0.055, -0.26);

    const bar = put(rig, new THREE.Group(), HEAD.x, HEAD.y, HEAD.z);
    put(bar, cyl(0.024, 0.024, 0.11, M.deck), 0, 0, 0);                         // colonne
    put(bar, box(0.012, 0.11, 0.03, M.bars), 0.02, -0.06, 0.01);               // fourche
    put(bar, box(0.012, 0.11, 0.03, M.bars), -0.02, -0.06, 0.01);
    const frontWheel = put(bar, wheel(), 0, -0.075, 0.02);
    put(bar, cyl(0.016, 0.016, 0.78, M.bars), 0, 0.45, 0);                    // tube de guidon
    put(bar, box(0.05, 0.05, 0.05, M.deck), 0, 0.08, 0);                       // collier de serrage
    const cross = put(bar, cyl(0.013, 0.013, 0.56, M.bars), 0, 0.85, 0); cross.rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const gp = put(bar, cyl(0.02, 0.02, 0.12, M.rubber), sx * 0.24, 0.85, 0); gp.rotation.z = Math.PI / 2;
      const brace = put(bar, cyl(0.009, 0.009, 0.2, M.bars), sx * 0.07, 0.78, 0); brace.rotation.z = sx * 0.9;
    }
    const gripL = V(0.24, 0.85, 0), gripR = V(-0.24, 0.85, 0);
    const footFrontL = V(0.03, 0.105, 0.06), footBackR = V(-0.04, 0.105, -0.17);

    /* ── Corps ── */
    const hips = put(rig, new THREE.Group(), 0, 1.0, -0.07);
    put(hips, box(0.3, 0.17, 0.19, M.pants), 0, 0, 0);
    const torso = put(hips, new THREE.Group(), 0, 0.06, 0);
    const chest = put(torso, cyl(0.17, 0.14, 0.5, M.shirt, 14), 0, 0.27, 0);
    chest.scale.z = 0.66;
    put(torso, cyl(0.05, 0.05, 0.08, M.skin, 8), 0, 0.55, 0);                  // cou
    const head = put(torso, new THREE.Group(), 0, 0.62, 0);
    put(head, sh(new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 12), M.skin)), 0, 0, 0.01);
    const helmet = put(head, sh(new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), M.helmet)), 0, 0.02, -0.005);
    helmet.scale.set(1, 1, 1.08);
    put(head, box(0.2, 0.05, 0.06, M.visor), 0, 0.075, 0.115);

    const shoulderL = V(0.2, 0.47, 0), shoulderR = V(-0.2, 0.47, 0);
    const hipJL = V(0.09, -0.05, 0), hipJR = V(-0.09, -0.05, 0);
    const limb = (len, r1, r2, mat) => { const s = segment(len, r1, r2, mat); rig.add(s); return s; };
    const upperArmL = limb(0.29, 0.05, 0.043, M.shirt), foreArmL = limb(0.27, 0.041, 0.034, M.skin);
    const upperArmR = limb(0.29, 0.05, 0.043, M.shirt), foreArmR = limb(0.27, 0.041, 0.034, M.skin);
    for (const f of [foreArmL, foreArmR]) put(f, sh(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M.skin)), 0, -0.28, 0);
    const thighL = limb(0.43, 0.075, 0.06, M.pants), shinL = limb(0.42, 0.058, 0.047, M.pants);
    const thighR = limb(0.43, 0.075, 0.06, M.pants), shinR = limb(0.42, 0.058, 0.047, M.pants);
    function shoe() {
      const g = new THREE.Group();
      put(g, box(0.105, 0.075, 0.27, M.shoes), 0, -0.035, 0.05);
      put(g, box(0.11, 0.022, 0.28, M.sole), 0, -0.075, 0.05);
      rig.add(g);
      return g;
    }
    const shoeL = shoe(), shoeR = shoe();

    const S = clonePose(BASE);           // pose courante (lissée)
    let target = clonePose(BASE);
    const poleArmL = V(1, -0.25, -0.55), poleArmR = V(-1, -0.25, -0.55);
    const poleLegL = V(0.35, 0.2, 1), poleLegR = V(-0.35, 0.2, 1);
    const tmp = V(0, 0, 0);

    function blend(dt, rate = 14) {
      const k = 1 - Math.exp(-rate * dt);
      for (const key in S) {
        if (S[key].isVector3) S[key].lerp(target[key], k);
        else S[key] += (target[key] - S[key]) * k;
      }
    }

    function solve() {
      hips.position.copy(S.hips);
      hips.rotation.set(0, S.torsoYaw * 0.3, S.torsoRoll * 0.3);
      torso.rotation.set(S.torsoPitch, S.torsoYaw * 0.7, S.torsoRoll * 0.7);
      head.rotation.x = S.headPitch;
      hips.updateMatrix(); torso.updateMatrix(); bar.updateMatrix(); whip.updateMatrix(); deck.updateMatrix();

      const toRig = (local, ...mats) => { tmp.copy(local); for (const m of mats) tmp.applyMatrix4(m); return tmp.clone(); };
      // Bras
      const sL = toRig(shoulderL, torso.matrix, hips.matrix), sR = toRig(shoulderR, torso.matrix, hips.matrix);
      const gL = toRig(gripL, bar.matrix).lerp(S.handL, S.handFreeL);
      const gR = toRig(gripR, bar.matrix).lerp(S.handR, S.handFreeR);
      ik(upperArmL, foreArmL, sL, gL, poleArmL);
      ik(upperArmR, foreArmR, sR, gR, poleArmR);
      // Jambes (cheville 7 cm au-dessus de la semelle)
      const hL = toRig(hipJL, hips.matrix), hR = toRig(hipJR, hips.matrix);
      const fL = toRig(footFrontL, deck.matrix, whip.matrix).lerp(S.footL, S.footFreeL); fL.y += 0.075;
      const fR = toRig(footBackR, deck.matrix, whip.matrix).lerp(S.footR, S.footFreeR); fR.y += 0.075;
      const eL = ik(thighL, shinL, hL, fL, poleLegL);
      const eR = ik(thighR, shinR, hR, fR, poleLegR);
      shoeL.position.copy(eL); shoeR.position.copy(eR);
      shoeL.rotation.set(0, 0.12 + whip.rotation.y * (1 - S.footFreeL), 0);
      shoeR.rotation.set(0, -0.2 + whip.rotation.y * (1 - S.footFreeR), 0);
    }

    return {
      root, com, body, tilt, rig, whip, bar, deck, frontWheel, rearWheel,
      setTarget(names) { target = makePose(names); },
      update(dt, rate) { blend(dt, rate); solve(); },
      snap() { for (const k in S) { if (S[k].isVector3) S[k].copy(target[k]); else S[k] = target[k]; } solve(); },
      spinWheels(dist) { rearWheel.rotation.x += dist / 0.055; frontWheel.rotation.x += dist / 0.055; },
    };
  }

  return { create };
})();
return Rider;
}

/* Modèles 3D : voiture de drift (reprise de Drift King), supercar, deux hélicoptères et drone FPV.
   Tous les modèles regardent vers -Z, l'origine est au sol (sous les roues, les patins ou les trains). */
export function createExtraModels(THREE, RK) {
  const M = RK.M, A = RK.add, V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- voiture de drift (Drift King) ---------- */
  function buildDriftCar() {
    const root = new THREE.Group(), body = new THREE.Group(), inner = new THREE.Group();
    root.add(body); body.add(inner); inner.rotation.y = Math.PI;   // le modèle d'origine regarde vers +Z
    const paint = M.paint(0x1fb5b0, { metalness: 0.4, roughness: 0.3 });
    const mats = { paint };
    const bx = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(RK.rbox(w, h, d, Math.min(w, h, d) * 0.18, 2), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; inner.add(m); return m; };
    const glass = M.glass(0x15283a, { opacity: 0.85 }), dark = M.plastic(0x14202e);
    bx(1.9, 0.5, 4.2, paint, 0, 0.62, 0); bx(1.6, 0.45, 2, glass, 0, 1.07, -0.25); bx(1.5, 0.08, 1.5, paint, 0, 1.32, -0.25);
    bx(1.9, 0.07, 0.5, dark, 0, 1.18, -1.95); bx(0.08, 0.3, 0.1, dark, 0.7, 1.02, -1.9); bx(0.08, 0.3, 0.1, dark, -0.7, 1.02, -1.9);
    const head = M.glow(0xffe9b0, 1.6), tail = M.glow(0xff2a40, 1.4);
    bx(0.45, 0.14, 0.06, head, 0.65, 0.7, 2.1); bx(0.45, 0.14, 0.06, head, -0.65, 0.7, 2.1);
    bx(0.5, 0.12, 0.06, tail, 0.65, 0.72, -2.1); bx(0.5, 0.12, 0.06, tail, -0.65, 0.72, -2.1);
    bx(1.95, 0.12, 0.3, dark, 0, 0.4, 2.12); bx(1.95, 0.12, 0.3, dark, 0, 0.42, -2.12);
    const wheels = [];
    const tg = RK.tireGeo(0.36, 0.28, 0.24, { round: 0.4, seg: 32 }), tm = RK.tireMat('sport', tg), rimMat = M.alu(0x9aa0a8, { roughness: 0.25 });
    const rg = RK.rimGeo(0.24, 0.24, { spokes: 6, hub: 0.28, spokeW: 0.04, seg: 24 });
    for (const [x, z, front] of [[1, 1.35, true], [-1, 1.35, true], [1, -1.3, false], [-1, -1.3, false]]) {
      const mount = new THREE.Group(); mount.position.set(x * 0.92, 0.36, z); inner.add(mount);
      const steer = new THREE.Group(); mount.add(steer);
      const mir = new THREE.Group(); if (x < 0) mir.scale.x = -1; steer.add(mir);
      const spin = new THREE.Group(); mir.add(spin);
      A(spin, tg, tm); for (const g of [rg.face, rg.barrel, rg.hub]) A(spin, g, rimMat, 0.02, 0, 0);
      wheels.push({ mount, steer, spin, r: 0.36, front, baseY: 0.36, flip: -1 });
    }
    return { root, body, wheels, mats, cockpit: V(-0.4, 1.15, 0.35) };
  }

  /* ---------- supercar V12 (nouveau modèle) ---------- */
  function buildSupercar() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const paint = M.paint(0xf2b705, { metalness: 0.5, roughness: 0.22 });
    const carbon = M.std(0xffffff, 0.35, 0.3, { map: RK.carbonTex() }), black = M.plastic(0x0d0e10), glass = M.glass(0x0b1218, { opacity: 0.78 });
    const chrome = M.chrome(), head = M.glow(0xf2f7ff, 2.4), tail = M.glow(0xff1020, 1.8);
    const secs = [
      { z: -2.32, w: 0.72, t: 0.07, b: 0.1, y: 0.4, n: 2.4 }, { z: -2.12, w: 0.9, t: 0.13, b: 0.19, y: 0.43, n: 3 },
      { z: -1.75, w: 0.98, t: 0.18, b: 0.26, y: 0.5, n: 3.6 }, { z: -1.2, w: 1.0, t: 0.23, b: 0.3, y: 0.55, n: 4 },
      { z: -0.6, w: 0.97, t: 0.29, b: 0.31, y: 0.6, n: 4 }, { z: 0, w: 0.96, t: 0.3, b: 0.32, y: 0.61, n: 4 },
      { z: 0.6, w: 1.0, t: 0.31, b: 0.31, y: 0.62, n: 4 }, { z: 1.2, w: 1.03, t: 0.3, b: 0.3, y: 0.6, n: 4 },
      { z: 1.8, w: 1.0, t: 0.26, b: 0.28, y: 0.58, n: 3.6 }, { z: 2.2, w: 0.94, t: 0.2, b: 0.25, y: 0.57, n: 3 }, { z: 2.34, w: 0.88, t: 0.13, b: 0.2, y: 0.57, n: 2.6 },
    ];
    const shell = RK.loft(secs, { sides: 64, sub: 5 });
    A(body, shell, paint);
    // habitacle vitré
    const cab = RK.loft([
      { z: -1.0, w: 0.62, t: 0.02, b: 0.02, y: 0.88 }, { z: -0.6, w: 0.74, t: 0.22, b: 0.02, y: 0.88, n: 2.6, tw: 0.78 },
      { z: 0.1, w: 0.76, t: 0.32, b: 0.02, y: 0.88, n: 2.8, tw: 0.72 }, { z: 0.75, w: 0.72, t: 0.25, b: 0.02, y: 0.88, n: 2.6, tw: 0.7 }, { z: 1.35, w: 0.62, t: 0.05, b: 0.02, y: 0.88 },
    ], { sides: 48, sub: 5 });
    A(body, cab, paint);
    const P = (zA, zB, a0, a1, off, mat) => { const g = RK.loftPatch(cab, zA, zB, a0, a1, off); if (g) A(body, g, mat, 0, 0, 0, 0, 0, 0, { noShadow: true }).renderOrder = 2; };
    P(-0.95, -0.05, 0.25, Math.PI - 0.25, 0.006, glass);                    // pare-brise
    P(-0.55, 0.62, -0.05, 0.5, 0.006, glass); P(-0.55, 0.62, Math.PI - 0.5, Math.PI + 0.05, 0.006, glass); // vitres latérales
    P(0.75, 1.3, 0.35, Math.PI - 0.35, 0.006, glass);
    // prises d'air latérales, diffuseur, splitter, aileron
    for (const s of [-1, 1]) {
      A(body, RK.rbox(0.06, 0.26, 0.7, 0.03, 2), black, s * 1.0, 0.56, 0.75, 0, s * 0.08, 0);
      A(body, RK.rbox(0.05, 0.08, 1.9, 0.02, 1), carbon, s * 0.97, 0.26, -0.1);
      RK.rod(body, [s * 0.55, 0.92, 1.75], [s * 0.5, 1.12, 1.95], 0.025, black);
      A(body, RK.rbox(0.16, 0.05, 0.08, 0.02, 1), paint, s * 0.95, 0.84, -0.62);          // rétro
      A(body, RK.rbox(0.42, 0.05, 0.05, 0.02, 1), head, s * 0.6, 0.52, -2.18, 0, s * 0.35, 0, { noShadow: true });
    }
    A(body, RK.wing({ x: -0.95, y: 1.14, z: 1.82, c: 0.38, t: 0.12 }, { x: 0.95, y: 1.14, z: 1.82, c: 0.38, t: 0.12 }, { chord: 12, span: 2 }), carbon);
    A(body, RK.rbox(1.7, 0.1, 0.35, 0.03, 2), carbon, 0, 0.18, -2.2);
    A(body, RK.rbox(1.7, 0.18, 0.4, 0.04, 2), black, 0, 0.28, 2.15);
    for (let k = 0; k < 6; k++) A(body, RK.rbox(0.03, 0.16, 0.36, 0.01, 1), carbon, -0.55 + k * 0.22, 0.24, 2.2);
    A(body, RK.rbox(1.6, 0.04, 0.05, 0.02, 1), tail, 0, 0.78, 2.3, 0, 0, 0, { noShadow: true });
    for (const s of [-1, 1]) for (const dx of [0.08, 0.22]) A(body, new THREE.CylinderGeometry(0.05, 0.055, 0.2, 14), chrome, s * dx, 0.38, 2.3, Math.PI / 2, 0, 0);
    A(body, RK.rbox(0.5, 0.04, 0.9, 0.02, 1), black, 0, 0.93, 1.6);          // grille moteur
    // intérieur
    for (const s of [-1, 1]) { A(body, RK.rbox(0.48, 0.12, 0.5, 0.05, 2), black, s * 0.38, 0.5, 0.15); A(body, RK.rbox(0.48, 0.6, 0.12, 0.05, 2), black, s * 0.38, 0.8, 0.45, -0.3, 0, 0); }
    A(body, RK.rbox(1.4, 0.16, 0.35, 0.04, 2), black, 0, 0.82, -0.62);
    const wheel = new THREE.Group(); wheel.position.set(-0.38, 0.86, -0.38); wheel.rotation.x = -0.35; body.add(wheel);
    A(wheel, new THREE.TorusGeometry(0.17, 0.025, 8, 24), black, 0, 0, 0);
    // roues
    const wheels = [], rimMat = M.std(0x1b1c1f, 0.3, 0.8), cal = M.paint(0xd01818, { metalness: 0.3 }), disc = M.std(0xc5c9ce, 0.25, 1);
    for (const [x, z, R, W, front] of [[0.87, -1.45, 0.35, 0.27, true], [-0.87, -1.45, 0.35, 0.27, true], [0.88, 1.35, 0.36, 0.33, false], [-0.88, 1.35, 0.36, 0.33, false]]) {
      const mount = new THREE.Group(); mount.position.set(x, R, z); root.add(mount);
      const steer = new THREE.Group(); mount.add(steer);
      const mir = new THREE.Group(); if (x < 0) mir.scale.x = -1; steer.add(mir);
      const spin = new THREE.Group(); mir.add(spin);
      const tg = RK.tireGeo(R, W, R * 0.68, { round: 0.35, seg: 40 }); A(spin, tg, RK.tireMat('road', tg));
      const rg = RK.rimGeo(R * 0.68, W * 0.85, { spokes: 10, split: 0, hub: 0.24, spokeW: 0.022, seg: 32 }); for (const g of [rg.face, rg.barrel, rg.hub]) A(spin, g, rimMat, W * 0.05, 0, 0);
      A(spin, RK.discGeo(R * 0.55, R * 0.25, 0.025, { holes: 24 }), disc, -W * 0.15, 0, 0);
      A(mir, RK.rbox(0.06, 0.14, 0.2, 0.02, 1), cal, W * 0.05, R * 0.3, R * 0.3, 0.7, 0, 0);
      const liner = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, W + 0.1, 24, 1, true, -Math.PI * 0.5, Math.PI), M.plastic(0x08090a, { side: THREE.DoubleSide }));
      liner.rotation.z = Math.PI / 2; mount.add(liner);
      wheels.push({ mount, steer, spin, r: R, front, baseY: R });
    }
    const headLights = [];
    for (const sx of [-0.6, 0.6]) { const sl = new THREE.SpotLight(0xf2f6ff, 0, 160, 0.5, 0.55, 1.4); sl.position.set(sx, 0.55, -2.1); sl.target.position.set(sx * 1.6, 0, -30); root.add(sl, sl.target); headLights.push(sl); }
    return { root, body, wheels, headLights, mats: { paint, tail }, cockpit: V(-0.38, 1.08, -0.05) };
  }

  /* ---------- hélicoptère léger 2 places « Colibri » ---------- */
  function rotorBlades(par, n, R, chord, mat, tipMat) {
    const rot = new THREE.Group(); par.add(rot);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Group(); b.rotation.y = k / n * Math.PI * 2; rot.add(b);
      A(b, RK.rbox(R - 0.25, 0.05, chord, 0.02, 1), mat, (R - 0.25) / 2 + 0.25, 0, 0, 0.0, 0, 0.0);
      if (tipMat) A(b, RK.rbox(0.3, 0.052, chord, 0.02, 1), tipMat, R - 0.15, 0, 0);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0x15171a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; par.add(disc);
    return { rot, disc };
  }
  function pilot(par, x, y, z, suitHex = 0x2f3a48) {
    const pg = new THREE.Group(); pg.position.set(x, y, z); par.add(pg);
    A(pg, RK.rbox(0.42, 0.55, 0.28, 0.1, 2), M.std(suitHex, 0.8, 0), 0, 0.28, 0.05, -0.1, 0, 0);
    const hg = RK.helmet(pg, M.std(0xe8e8e8, 0.4, 0.2), M.std(0x111418, 0.08, 0.8), { r: 0.14, style: 'jet' }); hg.position.set(0, 0.72, 0); hg.rotation.y = Math.PI;
    return pg;
  }
  function seat(par, x, y, z, mat) {
    A(par, RK.rbox(0.5, 0.12, 0.5, 0.05, 2), mat, x, y, z);
    A(par, RK.rbox(0.5, 0.65, 0.1, 0.05, 2), mat, x, y + 0.36, z + 0.24, -0.12, 0, 0);
  }
  function buildHeliSmall() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const paint = M.paint(0xd62b2b, { metalness: 0.3, roughness: 0.28 }), white = M.paint(0xf3f3f1, { metalness: 0.2 }), dark = M.dark(), glass = M.glass(0x182630, { opacity: 0.45 });
    const blade = M.std(0x22252a, 0.5, 0.3), tip = M.std(0xf2c014, 0.5, 0);
    const fs = [
      { z: -1.75, w: 0.25, t: 0.25, b: 0.25, y: 1.25 }, { z: -1.5, w: 0.7, t: 0.62, b: 0.5, y: 1.25, n: 2.2 }, { z: -0.9, w: 0.82, t: 0.78, b: 0.6, y: 1.25, n: 2.4 },
      { z: -0.1, w: 0.82, t: 0.78, b: 0.62, y: 1.25, n: 2.6 }, { z: 0.6, w: 0.66, t: 0.62, b: 0.55, y: 1.28, n: 2.6 }, { z: 1.1, w: 0.36, t: 0.4, b: 0.3, y: 1.4, n: 2.4 },
    ];
    const fus = RK.loft(fs, { sides: 48, sub: 5 });
    A(body, fus, paint);
    const P = (zA, zB, a0, a1, mat) => { const g = RK.loftPatch(fus, zA, zB, a0, a1, 0.006); if (g) A(body, g, mat, 0, 0, 0, 0, 0, 0, { noShadow: true }).renderOrder = 2; };
    P(-1.7, -0.25, -0.75, Math.PI + 0.75, glass);                        // grande bulle vitrée
    P(-0.2, 0.5, -0.9, -0.35, white); P(-0.2, 0.5, Math.PI + 0.35, Math.PI + 0.9, white);
    // poutre de queue, dérive, stabilisateur
    A(body, RK.tube([[0, 1.45, 0.9], [0, 1.5, 2.6], [0, 1.55, 4.9]], 0.11, { radial: 12, seg: 20 }), paint);
    A(body, RK.wing({ x: 0, y: 1.5, z: 4.55, c: 0.5, t: 0.1 }, { x: 0, y: 2.25, z: 4.9, c: 0.32, t: 0.1 }, { chord: 10, span: 2 }), paint, 0, 0, 0).rotation.set(0, 0, 0);
    { const fin = new THREE.Group(); fin.position.set(0, 1.5, 4.6); fin.rotation.z = Math.PI / 2; body.add(fin); A(fin, RK.wing({ x: 0, y: 0, z: 0, c: 0.55, t: 0.1 }, { x: 0.75, y: 0, z: 0.28, c: 0.35, t: 0.1 }, { chord: 10, span: 2 }), white); }
    A(body, RK.wing({ x: -0.55, y: 1.42, z: 4.2, c: 0.3, t: 0.1 }, { x: 0.55, y: 1.42, z: 4.2, c: 0.3, t: 0.1 }, { chord: 8, span: 2 }), white);
    // moteur et mât
    A(body, RK.rbox(0.62, 0.42, 1.1, 0.12, 2), white, 0, 2.05, 0.15);
    A(body, new THREE.CylinderGeometry(0.06, 0.08, 0.7, 12), dark, 0, 2.45, -0.05);
    // patins
    for (const s of [-1, 1]) {
      A(body, RK.tube([[s * 0.95, 0.06, -1.55], [s * 0.95, 0.04, -1.2], [s * 0.95, 0.04, 1.1], [s * 0.95, 0.06, 1.3]], 0.045, { radial: 8 }), dark);
      for (const z of [-0.85, 0.5]) RK.rod(body, [s * 0.95, 0.06, z], [s * 0.45, 0.8, z], 0.035, dark);
    }
    // sièges et pilote
    seat(body, -0.33, 0.78, -0.55, M.std(0x2b2f35, 0.8, 0)); seat(body, 0.33, 0.78, -0.55, M.std(0x2b2f35, 0.8, 0));
    pilot(body, 0.33, 0.85, -0.6, 0x2f3a48);
    A(body, RK.rbox(1.1, 0.25, 0.25, 0.05, 2), dark, 0, 1.05, -1.25, 0.6, 0, 0);
    // rotors
    const mast = new THREE.Group(); mast.position.set(0, 2.82, -0.05); body.add(mast);
    A(mast, new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), dark, 0, 0, 0);
    const main = rotorBlades(mast, 2, 3.9, 0.19, blade, tip);
    const tailHub = new THREE.Group(); tailHub.position.set(0.16, 1.62, 4.95); body.add(tailHub);
    const tr = new THREE.Group(); tr.rotation.z = Math.PI / 2; tailHub.add(tr);
    const tail = rotorBlades(tr, 2, 0.62, 0.08, blade, null);
    root.traverse(o => { if (o.isMesh && o.material !== glass) o.castShadow = true; });
    return { root, body, main, tail, mats: { paint }, cockpit: V(0.33, 1.72, -0.75), passenger: V(-0.33, 1.72, -0.75) };
  }

  /* ---------- hélicoptère de transport « Atlas » (pilotes + 12 places à l'arrière) ---------- */
  function buildHeliBig() {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const paint = M.paint(0x24384f, { metalness: 0.35, roughness: 0.3 }), white = M.paint(0xe9ecef, { metalness: 0.2 }), dark = M.dark(), glass = M.glass(0x101820, { opacity: 0.55 });
    const blade = M.std(0x1f2226, 0.5, 0.3), tip = M.std(0xf2c014, 0.5, 0), seatMat = M.std(0x3a4350, 0.85, 0), floor = M.std(0x4a4f55, 0.9, 0);
    const Y0 = 1.9;
    const fs = [
      { z: -8.2, w: 0.3, t: 0.3, b: 0.3, y: Y0 + 0.1 }, { z: -7.7, w: 1.1, t: 0.95, b: 0.9, y: Y0 + 0.05, n: 2.2 }, { z: -6.8, w: 1.5, t: 1.25, b: 1.15, y: Y0, n: 2.5 },
      { z: -5.4, w: 1.65, t: 1.4, b: 1.25, y: Y0, n: 2.9 }, { z: -1, w: 1.7, t: 1.45, b: 1.3, y: Y0, n: 3 }, { z: 2.6, w: 1.68, t: 1.42, b: 1.25, y: Y0, n: 3 },
      { z: 4.2, w: 1.35, t: 1.25, b: 0.6, y: Y0 + 0.3, n: 2.6 }, { z: 6.4, w: 0.55, t: 0.6, b: 0.35, y: Y0 + 0.9, n: 2.3 }, { z: 9.6, w: 0.32, t: 0.4, b: 0.25, y: Y0 + 1.2, n: 2.2 }, { z: 10.4, w: 0.18, t: 0.25, b: 0.15, y: Y0 + 1.3 },
    ];
    const fus = RK.loft(fs, { sides: 56, sub: 5 });
    A(body, fus, paint);
    const P = (zA, zB, a0, a1, mat) => { const g = RK.loftPatch(fus, zA, zB, a0, a1, 0.01); if (g) A(body, g, mat, 0, 0, 0, 0, 0, 0, { noShadow: true }).renderOrder = 2; };
    P(-8.0, -6.6, 0.2, Math.PI - 0.2, glass); P(-8.0, -6.9, -0.35, 0.2, glass); P(-8.0, -6.9, Math.PI - 0.2, Math.PI + 0.35, glass);
    P(-6.6, 3.0, -0.95, -0.55, white); P(-6.6, 3.0, Math.PI + 0.55, Math.PI + 0.95, white);   // bande blanche
    // hublots de cabine
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) A(body, RK.rbox(0.05, 0.55, 0.6, 0.12, 2), glass, s * 1.69, Y0 + 0.35, -4.4 + k * 1.45, 0, 0, 0, { noShadow: true });
    // porte coulissante (côté droit, ouverte)
    A(body, RK.rbox(0.06, 1.75, 1.6, 0.05, 2), dark, 1.72, Y0 - 0.15, -1.7);
    A(body, RK.rbox(0.08, 1.8, 1.65, 0.05, 2), paint, 1.82, Y0 - 0.12, 0.05);
    // cabine : plancher, sièges face à face, passagers
    A(body, RK.rbox(3.0, 0.08, 9.0, 0.02, 1), floor, 0, Y0 - 1.15, -1.6);
    for (let row = 0; row < 3; row++) for (const s of [-1, 1]) for (const dx of [0.5, 1.05]) {
      const z = -4.6 + row * 2.4; seat(body, s * dx, Y0 - 1.0, z, seatMat);
      if ((row + dx * 2) % 3 < 1.2) pilot(body, s * dx, Y0 - 0.95, z - 0.05, 0x5a4a3a);
    }
    // cockpit
    seat(body, -0.55, Y0 - 1.0, -6.6, seatMat); seat(body, 0.55, Y0 - 1.0, -6.6, seatMat);
    pilot(body, 0.55, Y0 - 0.95, -6.65); pilot(body, -0.55, Y0 - 0.95, -6.65, 0x3a4a3a);
    A(body, RK.rbox(2.4, 0.5, 0.5, 0.08, 2), dark, 0, Y0 - 0.45, -7.45, 0.4, 0, 0);
    // moteurs, capot, mât
    for (const s of [-1, 1]) {
      A(body, RK.loft([{ z: -3.6, w: 0.35, t: 0.35, b: 0.3, y: Y0 + 1.75, x: s * 0.6 }, { z: -2.8, w: 0.42, t: 0.42, b: 0.35, y: Y0 + 1.78, x: s * 0.62, n: 2.4 }, { z: 0.4, w: 0.4, t: 0.4, b: 0.33, y: Y0 + 1.78, x: s * 0.62, n: 2.4 }, { z: 1.0, w: 0.25, t: 0.25, b: 0.25, y: Y0 + 1.78, x: s * 0.66 }], { sides: 28 }), white);
      A(body, new THREE.CylinderGeometry(0.2, 0.24, 0.5, 14), dark, s * 0.95, Y0 + 1.75, 0.9, 0, 0, s * 1.2);
    }
    A(body, RK.rbox(1.6, 0.6, 4.8, 0.25, 2), paint, 0, Y0 + 1.5, -1.6);
    // sponsons et trains
    for (const s of [-1, 1]) {
      A(body, RK.loft([{ z: -2.6, x: s * 1.8, w: 0.2, t: 0.25, b: 0.25, y: 0.75 }, { z: -2, x: s * 1.95, w: 0.45, t: 0.45, b: 0.4, y: 0.75, n: 2.5 }, { z: 0.6, x: s * 1.95, w: 0.45, t: 0.45, b: 0.4, y: 0.75, n: 2.5 }, { z: 1.4, x: s * 1.8, w: 0.2, t: 0.25, b: 0.25, y: 0.8 }], { sides: 24 }), paint);
      const tg = RK.tireGeo(0.42, 0.28, 0.25, { round: 0.4, seg: 28 }); A(body, tg, RK.tireMat('road', tg), s * 1.95, 0.42, -0.9);
      RK.rod(body, [s * 1.95, 0.42, -0.9], [s * 1.95, 0.9, -0.9], 0.08, dark);
    }
    { const tg = RK.tireGeo(0.32, 0.2, 0.18, { round: 0.4, seg: 24 }); for (const s of [-1, 1]) A(body, tg, RK.tireMat('road', tg), s * 0.16, 0.32, -6.3); RK.rod(body, [0, 0.32, -6.3], [0, 1.0, -6.2], 0.07, dark); }
    // queue : dérive, stabilisateur
    { const fin = new THREE.Group(); fin.position.set(0, Y0 + 1.3, 9.1); fin.rotation.z = Math.PI / 2 + 0.12; body.add(fin); A(fin, RK.wing({ x: 0, y: 0, z: -0.4, c: 1.6, t: 0.12 }, { x: 2.2, y: 0, z: 0.5, c: 0.9, t: 0.1 }, { chord: 12, span: 3 }), paint); }
    A(body, RK.wing({ x: 0, y: Y0 + 1.15, z: 8.4, c: 0.9, t: 0.1 }, { x: 1.9, y: Y0 + 1.25, z: 8.8, c: 0.6, t: 0.1 }, { chord: 10, span: 2 }), paint);
    // rotors
    const mast = new THREE.Group(); mast.position.set(0, Y0 + 2.35, -1.8); body.add(mast);
    A(mast, new THREE.CylinderGeometry(0.32, 0.36, 0.4, 16), dark, 0, 0, 0);
    const main = rotorBlades(mast, 5, 8.6, 0.55, blade, tip);
    const tailHub = new THREE.Group(); tailHub.position.set(-0.42, Y0 + 3.0, 9.9); body.add(tailHub);
    const tr = new THREE.Group(); tr.rotation.z = Math.PI / 2; tailHub.add(tr);
    const tail = rotorBlades(tr, 4, 1.55, 0.2, blade, null);
    root.traverse(o => { if (o.isMesh && o.material !== glass) o.castShadow = true; });
    return { root, body, main, tail, mats: { paint }, cockpit: V(0.55, Y0 + 0.65, -6.85), cabin: V(-1.05, Y0 + 0.55, 0.15) };
  }

  /* ---------- drone FPV 5" (Simulateur FPV) ---------- */
  function buildDrone() {
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner);
    const carbon = M.std(0x1d1d1f, 0.5, 0.3, { map: RK.carbonTex() });
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; inner.add(m); return m; };
    add(new THREE.BoxGeometry(0.06, 0.03, 0.12), carbon, 0, 0, 0);
    for (const a of [Math.PI / 4, -Math.PI / 4]) add(new THREE.BoxGeometry(0.026, 0.008, 0.25), carbon, 0, -0.012, 0, a);
    add(new THREE.BoxGeometry(0.036, 0.032, 0.08), M.std(0xf2c21b, 0.6, 0), 0, 0.033, 0.005);
    add(new THREE.BoxGeometry(0.022, 0.022, 0.02), M.std(0xff6a00, 0.5, 0), 0, 0.006, -0.062);
    add(new THREE.BoxGeometry(0.02, 0.004, 0.004), M.glow(0xff2020, 2), 0, 0.0, 0.062);
    const props = [];
    const propMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const motorMat = M.alu(0x8a8f99);
    for (const [x, z] of [[0.088, -0.088], [-0.088, -0.088], [0.088, 0.088], [-0.088, 0.088]]) {
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.018, 10), motorMat, x, 0.0, z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.0635, 20), propMat); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.014, z); inner.add(disc);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.002, 0.012), carbon); blade.position.set(x, 0.015, z); blade.userData.keep = true; inner.add(blade); props.push(blade);
    }
    // antenne vidéo et petite LED
    RK.rod(inner, [0, 0.02, 0.05], [0, 0.07, 0.09], 0.002, M.plastic(0x111111));
    return { root, inner, props };
  }

  return { buildDriftCar, buildSupercar, buildHeliSmall, buildHeliBig, buildDrone };
}

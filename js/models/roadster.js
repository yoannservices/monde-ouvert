/* Repris de tesla-roadster/js/model.js, adapté en module (three r165). */
/* ===== Modèle 3D procédural de la Tesla Roadster (2e génération) =====
   Repère : avant = -Z, droite = +X, haut = +Y, roues posées sur y = 0.
   Longueur ~4,36 m, largeur ~2,06 m, hauteur ~1,16 m. */
export function buildRoadster(THREE) {
  const V3 = THREE.Vector3;

  // Spline de Catmull-Rom 1D sur des clés [z, valeur]
  function cr(keys, z) {
    const n = keys.length;
    if (z <= keys[0][0]) return keys[0][1];
    if (z >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && z > keys[i + 1][0]) i++;
    const t = (z - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    const p0 = keys[Math.max(i - 1, 0)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(i + 2, n - 1)][1];
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }

  const L2 = 2.18;
  const HW = [[-2.18, .66], [-2.05, .84], [-1.85, .94], [-1.6, .99], [-1.32, 1.01], [-0.95, .97], [-0.5, .95], [0, .94], [0.45, .96], [0.9, 1.0], [1.3, 1.03], [1.7, 1.01], [2.0, .96], [2.18, .9]];
  const TOP = [[-2.18, .47], [-2.0, .57], [-1.75, .67], [-1.32, .75], [-0.9, .77], [-0.55, .78], [-0.2, .79], [0.3, .8], [0.8, .82], [1.3, .85], [1.75, .86], [2.05, .84], [2.18, .8]];
  const BOT = [[-2.18, .3], [-2.0, .2], [-1.7, .16], [1.8, .16], [2.05, .22], [2.18, .32]];
  const BULGE = [[-2.18, 0], [-1.8, .05], [-1.32, .09], [-0.9, .04], [-0.3, 0], [0.5, 0], [0.9, .03], [1.3, .06], [1.8, .03], [2.18, 0]];
  const COCK = [[-0.85, 0], [-0.66, .24], [-0.4, .52], [0.5, .52], [0.82, .26], [1.0, 0]];
  const WHEELS = [{ z: -1.32, r: .36 }, { z: 1.3, r: .37 }];

  function sect(z) {
    let hw = cr(HW, z), top = cr(TOP, z), bot = cr(BOT, z);
    const zf = -1.92, zr = 2.0;
    if (z < zf) {
      const k = (zf - z) / (L2 + zf), s = Math.sqrt(Math.max(0, 1 - k * k)), mid = 0.34;
      top = mid + (top - mid) * s; bot = mid + (bot - mid) * s; hw *= 0.62 + 0.38 * s;
    }
    if (z > zr) {
      const k = (z - zr) / (L2 - zr), s = Math.sqrt(Math.max(0, 1 - k * k)), mid = 0.56;
      top = mid + (top - mid) * s; bot = mid + (bot - mid) * s; hw *= 0.84 + 0.16 * s;
    }
    return { hw, top, bot };
  }

  // Point de la carrosserie pour une station z et un angle th (0 = flanc droit, PI/2 = dessus)
  function bodyPoint(z, th, out) {
    const { hw, top, bot } = sect(z);
    const cy = bot + (top - bot) * 0.45, ht = top - cy, hb = cy - bot;
    const c = Math.cos(th), s = Math.sin(th);
    const NT = 3.6, ex = s >= 0 ? 2 / NT : 2 / 5;
    let x = hw * Math.sign(c) * Math.pow(Math.abs(c), ex);
    let y = s >= 0 ? cy + ht * Math.pow(s, 2 / NT) : cy - hb * Math.pow(-s, 2 / 5);
    const ax = Math.abs(x) / Math.max(hw, 1e-3);
    if (s > 0) {
      y += cr(BULGE, z) * ax * ax * Math.sqrt(s);
      const d = Math.max(0, cr(COCK, z));
      if (d > 0) y -= d * Math.max(0, 1 - Math.pow(ax / 0.72, 8)) * Math.min(1, s / 0.5);
    }
    for (const w of WHEELS) {
      const dz = z - w.z, rA = w.r + 0.06;
      if (Math.abs(dz) < rA) {
        const ay = w.r + Math.sqrt(rA * rA - dz * dz);
        if (ax > 0.6 && y < ay) y = ay;
      }
    }
    return out.set(x, y, z);
  }

  // Surface « lissée » générique : grille stations x anneau
  function loft(zs, ths, fn, closed) {
    const nz = zs.length, nt = ths.length;
    const pos = new Float32Array(nz * nt * 3);
    const v = new V3();
    for (let i = 0; i < nz; i++) for (let j = 0; j < nt; j++) {
      fn(zs[i], ths[j], v);
      pos.set([v.x, v.y, v.z], (i * nt + j) * 3);
    }
    const idx = [];
    const jm = closed ? nt : nt - 1;
    for (let i = 0; i < nz - 1; i++) for (let j = 0; j < jm; j++) {
      const j2 = (j + 1) % nt;
      const a = i * nt + j, b = i * nt + j2, c = (i + 1) * nt + j2, d = (i + 1) * nt + j;
      idx.push(a, b, d, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const range = (a, b, n, ease) => Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1);
    return ease ? a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * u)) : a + (b - a) * u;
  });

  // ---------- Matériaux ----------
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x9a0a10, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x04070a, metalness: 0.3, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.8, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    roof: new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0.3, roughness: 0.15, clearcoat: 1, envMapIntensity: 1.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, metalness: 0.2 }),
    gloss: new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.12, metalness: 0.4, clearcoat: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92, metalness: 0 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.28, metalness: 0.95 }),
    rimLip: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.12, metalness: 1 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x6d6f73, roughness: 0.45, metalness: 0.9 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.35, metalness: 0.3 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 2.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 1.6 }),
    leather: new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.55 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.25, metalness: 1 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x050a12, emissive: 0x3f8cff, emissiveIntensity: 0.9, roughness: 0.2 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.3, metalness: 1, side: THREE.DoubleSide }),
    nozzleGlow: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x66ccff, emissiveIntensity: 0.2 }),
    plume: new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };

  const root = new THREE.Group();     // positionné par la physique
  const body = new THREE.Group();     // roulis / tangage visuels
  root.add(body);
  const add = (geo, mat, parent = body, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow; m.receiveShadow = shadow;
    parent.add(m);
    return m;
  };

  // ---------- Carrosserie ----------
  const zs = range(-L2, L2, 120, true);
  const ths = range(0, Math.PI * 2, 128).slice(0, 127);
  add(loft(zs, ths, bodyPoint, true), M.paint);

  // ---------- Habitacle vitré (canopée) ----------
  const GZ0 = -0.78, GZ1 = 1.55;
  const ROOF = [[-0.78, .78], [-0.55, .9], [-0.3, 1.04], [0, 1.12], [0.35, 1.14], [0.7, 1.09], [1.05, 0.99], [1.55, 0.86]];
  const GHW = [[-0.78, .6], [-0.4, .72], [0.2, .76], [0.8, .74], [1.2, .66], [1.55, .5]];
  function canopy(z, th, out, inflate = 0) {
    const t = (z - GZ0) / (GZ1 - GZ0);
    const base = sect(z).top - 0.1;
    const env = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, t)))), 0.3);
    const h = Math.max(0, cr(ROOF, z) - base) * env;
    const hw = cr(GHW, z);
    const c = Math.cos(th), s = Math.sin(th);
    const x = hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3) * (1 - 0.24 * s);
    const y = base + h * Math.pow(Math.max(0, s), 2 / 3);
    out.set(x * (1 + inflate), y + inflate * 0.5, z);
    return out;
  }
  add(loft(range(GZ0, GZ1, 50), range(0, Math.PI, 40), (z, th, o) => canopy(z, th, o), false), M.glass, body, false);
  // Toit targa noir amovible
  add(loft(range(-0.25, 0.72, 18), range(0.3 * Math.PI, 0.7 * Math.PI, 14), (z, th, o) => canopy(z, th, o, 0.012), false), M.roof);
  // Montants de pare-brise (A-pillars)
  for (const side of [1, -1]) {
    const pts = range(-0.68, -0.05, 8).map(z => canopy(z, side > 0 ? 0.22 : Math.PI - 0.22, new V3(), 0.008));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 6), M.gloss);
  }

  // ---------- Intérieur ----------
  const floorY = sect(0).top - 0.52;
  const tub = add(new THREE.BoxGeometry(1.2, 0.02, 1.45), M.carpet, body, false);
  tub.position.set(0, floorY + 0.03, 0.1);
  for (const sx of [-0.36, 0.36]) {
    const seat = new THREE.Group();
    const cush = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.5), M.leather); cush.position.set(0, 0.06, 0); seat.add(cush);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.12), M.leather); back.position.set(0, 0.33, 0.27); back.rotation.x = -0.28; seat.add(back);
    const bolsterL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.14), M.carpet); bolsterL.position.set(-0.24, 0.31, 0.25); bolsterL.rotation.x = -0.28; seat.add(bolsterL);
    const bolsterR = bolsterL.clone(); bolsterR.position.x = 0.24; seat.add(bolsterR);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), M.leather); headrest.position.set(0, 0.68, 0.38); headrest.rotation.x = -0.28; seat.add(headrest);
    seat.position.set(sx, floorY + 0.02, 0.3); seat.scale.setScalar(0.92);
    body.add(seat);
  }
  const dash = add(new THREE.BoxGeometry(1.3, 0.16, 0.3), M.carpet, body, false);
  dash.position.set(0, floorY + 0.3, -0.55);
  const scr = add(new THREE.PlaneGeometry(0.3, 0.2), M.screen, body, false);
  scr.position.set(0.02, floorY + 0.44, -0.37); scr.rotation.x = -0.5;
  // Volant type « yoke »
  const yoke = new THREE.Group();
  const rimY = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24, Math.PI), M.carpet); rimY.rotation.z = Math.PI; yoke.add(rimY);
  const barY = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.03), M.carpet); yoke.add(barY);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), M.alu); hub.rotation.x = Math.PI / 2; yoke.add(hub);
  yoke.position.set(-0.36, floorY + 0.42, -0.24); yoke.rotation.x = -0.35;
  body.add(yoke);

  // ---------- Optiques ----------
  const surf = (z, th, push) => {
    const p = bodyPoint(z, th, new V3());
    const p2 = bodyPoint(z, th + 0.01, new V3());
    const p3 = bodyPoint(z + 0.01, th, new V3());
    const n = new V3().subVectors(p2, p).cross(new V3().subVectors(p3, p)).normalize();
    return p.addScaledVector(n, push);
  };
  for (const side of [1, -1]) {
    const th = a => side > 0 ? a : Math.PI - a;
    const keys = [[-2.1, 0.62], [-2.0, 0.42], [-1.86, 0.3], [-1.7, 0.24]];
    const housing = new THREE.CatmullRomCurve3(keys.map(([z, a]) => surf(z, th(a), 0.0)));
    const led = new THREE.CatmullRomCurve3(keys.map(([z, a]) => surf(z, th(a), 0.026)));
    add(new THREE.TubeGeometry(housing, 24, 0.034, 8), M.gloss, body, false);
    add(new THREE.TubeGeometry(led, 24, 0.016, 8), M.head, body, false);
    // projecteur
    const lens = add(new THREE.SphereGeometry(0.035, 12, 8), M.head, body, false);
    lens.position.copy(surf(-1.98, th(0.38), 0.03));
  }
  {
    const angs = range(0.12, Math.PI - 0.12, 16);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(angs.map(a => surf(2.13, a, 0.0))), 48, 0.034, 8), M.gloss, body, false);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(angs.map(a => surf(2.13, a, 0.03))), 48, 0.02, 8), M.tail, body, false);
  }

  // ---------- Éléments noirs : prises d'air, diffuseur, rétros ----------
  const intake = add(new THREE.BoxGeometry(1.1, 0.1, 0.16), M.black, body, false);
  intake.position.set(0, 0.25, -2.06);
  for (const sx of [-0.58, 0.58]) {
    const ci = add(new THREE.BoxGeometry(0.28, 0.12, 0.14), M.black, body, false);
    ci.position.set(sx, 0.26, -2.0); ci.rotation.y = sx > 0 ? -0.35 : 0.35;
  }
  const diff = add(new THREE.BoxGeometry(1.4, 0.1, 0.4), M.black);
  diff.position.set(0, 0.2, 1.9);
  for (const sx of [-1, 1]) {
    const si = add(new THREE.BoxGeometry(0.05, 0.16, 0.42), M.black, body, false);
    si.position.set(sx * 0.95, 0.46, 0.72); si.rotation.y = sx * 0.06;
    const sill = add(new THREE.BoxGeometry(0.05, 0.06, 1.7), M.gloss, body, false);
    sill.position.set(sx * 0.93, 0.2, -0.05);
    // rétroviseur
    const stalk = add(new THREE.BoxGeometry(0.16, 0.022, 0.05), M.gloss, body, false);
    stalk.position.set(sx * 0.84, 0.86, -0.5);
    const mirror = add(new THREE.SphereGeometry(1, 20, 12), M.paint);
    mirror.scale.set(0.1, 0.045, 0.075); mirror.position.set(sx * 0.95, 0.88, -0.5);
    const glassM = add(new THREE.CircleGeometry(1, 16), M.gloss, body, false);
    glassM.scale.set(0.085, 0.035, 1); glassM.position.set(sx * 0.95, 0.88, -0.43);
  }

  // ---------- Propulseurs SpaceX ----------
  const plumes = { rear: [], bottom: [] };
  const nozzles = [];
  const nozzleGeo = new THREE.CylinderGeometry(0.06, 0.085, 0.12, 20, 1, true);
  for (const sx of [-0.26, 0.26]) {
    const nz = add(nozzleGeo, M.nozzle, body, false);
    nz.rotation.x = Math.PI / 2; nz.position.set(sx, 0.42, 2.17);
    const glow = add(new THREE.CircleGeometry(0.058, 20), M.nozzleGlow, body, false);
    glow.position.set(sx, 0.42, 2.14);
    const pl = add(new THREE.ConeGeometry(0.1, 1.6, 16, 1, true), M.plume.clone(), body, false);
    pl.rotation.x = Math.PI / 2; pl.position.set(sx, 0.42, 2.2 + 0.8);
    plumes.rear.push(pl); nozzles.push(new V3(sx, 0.42, 2.25));
  }
  const bottomNozzles = [];
  for (const [sx, sz] of [[-0.55, -1.0], [0.55, -1.0], [-0.55, 0.95], [0.55, 0.95]]) {
    const nz = add(nozzleGeo, M.nozzle, body, false);
    nz.position.set(sx, 0.12, sz);
    const glow = add(new THREE.CircleGeometry(0.058, 20), M.nozzleGlow, body, false);
    glow.rotation.x = Math.PI / 2; glow.position.set(sx, 0.16, sz);
    const pl = add(new THREE.ConeGeometry(0.11, 1.4, 16, 1, true), M.plume.clone(), body, false);
    pl.rotation.x = Math.PI; pl.position.set(sx, 0.12 - 0.7, sz);
    plumes.bottom.push(pl); bottomNozzles.push(new V3(sx, 0.05, sz));
  }

  // ---------- Roues ----------
  function makeWheel(r, w) {
    const spin = new THREE.Group();
    const prof = [[0.66, -0.5], [0.93, -0.5], [0.985, -0.42], [1, -0.26], [1, 0.26], [0.985, 0.42], [0.93, 0.5], [0.66, 0.5]]
      .map(([a, b]) => new THREE.Vector2(a * r, b * w));
    const tire = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.tire);
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; spin.add(tire);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.67, r * 0.67, w * 0.92, 32, 1, true), M.rim);
    barrel.rotation.z = Math.PI / 2; spin.add(barrel);
    const face = new THREE.Group(); face.position.x = w * 0.42; spin.add(face);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.665, 0.012, 8, 40), M.rimLip);
    lip.rotation.y = Math.PI / 2; face.add(lip);
    const dish = new THREE.Mesh(new THREE.CircleGeometry(r * 0.66, 32), M.black);
    dish.rotation.y = Math.PI / 2; dish.position.x = -0.06; face.add(dish);
    // 10 branches « turbine »
    const spokeGeo = new THREE.BoxGeometry(0.03, 0.05, r * 0.6);
    spokeGeo.translate(0, 0, r * 0.33);
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Mesh(spokeGeo, M.rim);
      sp.rotation.x = (i / 10) * Math.PI * 2;
      sp.rotateY(0.18); sp.rotateZ(0.5);
      sp.castShadow = true;
      face.add(sp);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.03, 20), M.rimLip);
    cap.rotation.z = Math.PI / 2; cap.position.x = 0.01; face.add(cap);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.03, 32), M.disc);
    disc.rotation.z = Math.PI / 2; disc.position.x = -0.02; spin.add(disc);
    return spin;
  }
  const wheels = [];
  const WP = [[0.86, -1.32, .36, .27, true], [-0.86, -1.32, .36, .27, true], [0.87, 1.3, .37, .33, false], [-0.87, 1.3, .37, .33, false]];
  for (const [x, z, r, w, front] of WP) {
    const mount = new THREE.Group(); mount.position.set(x, r, z); root.add(mount);
    const steer = new THREE.Group(); mount.add(steer);
    const mirrorG = new THREE.Group(); if (x < 0) mirrorG.scale.x = -1; steer.add(mirrorG);
    const spin = makeWheel(r, w); mirrorG.add(spin);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.2), M.caliper);
    cal.position.set(w * 0.1, r * 0.3, r * 0.32); cal.rotation.x = 0.7; mirrorG.add(cal);
    // passage de roue sombre
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, w + 0.08, 24, 1, true, -Math.PI * 0.5, Math.PI), M.black);
    liner.rotation.z = Math.PI / 2; liner.material = M.black;
    liner.material.side = THREE.DoubleSide;
    mount.add(liner);
    wheels.push({ mount, steer, spin, r, front, baseY: r, x, z });
  }

  // ---------- Phares (spots) et feux ----------
  const headLights = [];
  for (const sx of [-0.62, 0.62]) {
    const sl = new THREE.SpotLight(0xf2f6ff, 0, 160, 0.5, 0.55, 1.4);
    sl.position.set(sx, 0.55, -2.0);
    sl.target.position.set(sx * 1.6, 0, -30);
    root.add(sl); root.add(sl.target);
    headLights.push(sl);
  }

  const cockpitCam = new V3(-0.36, floorY + 0.92, 0.18);

  function setPaint(hex) { M.paint.color.setHex(hex); }

  return { root, body, wheels, plumes, nozzles, bottomNozzles, headLights, materials: M, setPaint, cockpitCam, yoke };
}

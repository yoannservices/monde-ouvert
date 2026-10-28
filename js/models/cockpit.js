/* Habitacles : planche de bord de voiture, tableau d'hélicoptère, cockpit d'avion. Tous les instruments sont des canvas
   redessinés en direct (update(st)) : vitesse, régime, attitude, altitude, cap… Repère des modèles : avant = -Z, droite = +X.
   `c` est la position de la caméra cockpit dans le repère du modèle ; les éléments sont placés devant elle. */
export function createCockpitKit(THREE) {
  const std = (color, rough = 0.7, metal = 0.2, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
  const DARK = std(0x16181c, 0.85, 0.1), DARKL = std(0x23262b, 0.8, 0.15), CHROME = std(0xd5dae0, 0.15, 1), RUBBER = std(0x0c0c0e, 0.95, 0);
  const add = (par, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.userData.keep = true; par.add(m); return m; };
  const box = (par, w, h, d, mat, x, y, z, rx, ry, rz) => add(par, new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, g: c.getContext('2d'), t }; };
  const screen = (par, s, w, h, x, y, z, rx = 0, ry = 0) => add(par, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: s.t, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), x, y, z, rx, ry, 0);
  const bezel = (par, w, h, x, y, z, rx = 0, ry = 0) => box(par, w + 0.03, h + 0.03, 0.02, DARK, x, y, z - 0.03, rx, ry, 0);
  const led = (par, color, x, y, z, rx = 0) => { const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: color, emissiveIntensity: 0 }); add(par, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10).rotateX(Math.PI / 2), m, x, y, z, rx); return m; };
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const throttled = (fn, ms = 50) => { let last = 0; return (st) => { const n = performance.now(); if (n - last < ms) return; last = n; fn(st); }; };

  // cadran à aiguille : graduations, chiffres, aiguille
  function dial(g, cx, cy, r, vmin, vmax, val, o = {}) {
    const a0 = o.a0 ?? Math.PI * 0.75, a1 = o.a1 ?? Math.PI * 2.25, step = o.step ?? (vmax - vmin) / 10, lab = o.lab ?? ((v) => String(Math.round(v)));
    g.fillStyle = o.bg ?? '#06090d'; g.beginPath(); g.arc(cx, cy, r + 4, 0, 7); g.fill();
    g.strokeStyle = o.ring ?? '#7fe8e8'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
    g.fillStyle = '#dce8f2'; g.textAlign = 'center'; g.font = 'bold ' + Math.round(r * 0.17) + 'px monospace';
    for (let v = vmin; v <= vmax + 1e-6; v += step) {
      const a = a0 + (v - vmin) / (vmax - vmin) * (a1 - a0), ca = Math.cos(a), sa = Math.sin(a);
      g.lineWidth = 3; g.beginPath(); g.moveTo(cx + ca * (r - r * 0.12), cy + sa * (r - r * 0.12)); g.lineTo(cx + ca * r, cy + sa * r); g.stroke();
      g.fillText(lab(v), cx + ca * (r - r * 0.32), cy + sa * (r - r * 0.32) + r * 0.06);
    }
    if (o.red) { g.strokeStyle = '#ff3030'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, r - 6, a0 + (o.red - vmin) / (vmax - vmin) * (a1 - a0), a1); g.stroke(); }
    const na = a0 + clamp((val - vmin) / (vmax - vmin), 0, 1) * (a1 - a0);
    g.strokeStyle = o.needle ?? '#ff5a3c'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - Math.cos(na) * r * 0.12, cy - Math.sin(na) * r * 0.12); g.lineTo(cx + Math.cos(na) * (r - r * 0.1), cy + Math.sin(na) * (r - r * 0.1)); g.stroke();
    g.fillStyle = o.needle ?? '#ff5a3c'; g.beginPath(); g.arc(cx, cy, r * 0.07, 0, 7); g.fill();
    if (o.title) { g.fillStyle = '#7fe8e8'; g.font = Math.round(r * 0.15) + 'px monospace'; g.fillText(o.title, cx, cy + r * 0.55); }
  }
  // horizon artificiel : ciel/sol, échelle de tangage, repère de roulis
  function horizon(g, cx, cy, r, pitch, bank) {
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    g.translate(cx, cy); g.rotate(-bank);
    const py = pitch * r * 1.6;
    g.fillStyle = '#2a73c4'; g.fillRect(-r * 2, -r * 2 + py, r * 4, r * 2);
    g.fillStyle = '#7a5130'; g.fillRect(-r * 2, py, r * 4, r * 2);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r * 2, py); g.lineTo(r * 2, py); g.stroke();
    g.font = Math.round(r * 0.12) + 'px monospace'; g.fillStyle = '#fff'; g.textAlign = 'center';
    for (const d of [-20, -10, 10, 20]) { const y = py - d * Math.PI / 180 * r * 1.6; g.beginPath(); g.moveTo(-r * (Math.abs(d) > 10 ? 0.25 : 0.35), y); g.lineTo(r * (Math.abs(d) > 10 ? 0.25 : 0.35), y); g.stroke(); g.fillText(String(Math.abs(d)), r * 0.42, y + 4); }
    g.restore();
    g.strokeStyle = '#ffd000'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - r * 0.55, cy); g.lineTo(cx - r * 0.2, cy); g.lineTo(cx - r * 0.2, cy + r * 0.08); g.moveTo(cx + r * 0.55, cy); g.lineTo(cx + r * 0.2, cy); g.lineTo(cx + r * 0.2, cy + r * 0.08); g.stroke();
    g.strokeStyle = '#7fe8e8'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }
  const gearFor = (kmh) => (kmh < 2 ? 'N' : String(clamp(1 + Math.floor(kmh / 48), 1, 7)));

  /* ───────── voiture : planche de bord moulée, combiné compteur/compte-tours, écran central, aérateurs, commandes ───────── */
  function carInterior(parent, c, o = {}) {
    const w = o.width ?? 1.7, g = new THREE.Group(); g.position.set(0, c.y - 0.52, c.z - 0.55); parent.add(g);
    const shape = new THREE.Shape([[0, 0], [0.55, 0], [0.52, 0.2], [0.34, 0.33], [0.12, 0.38], [0, 0.3]].map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
    add(g, geo, DARK, 0, 0, 0.1);
    add(g, new THREE.CylinderGeometry(0.01, 0.01, w, 8).rotateZ(Math.PI / 2), CHROME, 0, 0.385, -0.02);                 // jonc chromé
    const cl = cv(512, 192), sp = cv(256, 192);
    const px = c.x, lastGear = { v: 'N' };
    const clMesh = screen(g, cl, 0.5, 0.19, px, 0.5, -0.1, -0.7); bezel(g, 0.5, 0.19, px, 0.5, -0.1, -0.7);
    const cs = cv(384, 224), ctr = screen(g, cs, 0.32, 0.19, c.x * -0.2 + 0.1, 0.5, -0.24, -0.6);
    bezel(g, 0.32, 0.19, c.x * -0.2 + 0.1, 0.5, -0.24, -0.6);
    for (const x of [-0.5, 0.45, 0.62]) { box(g, 0.14, 0.04, 0.02, RUBBER, x, 0.44, -0.3, -0.5); for (let k = 0; k < 4; k++) box(g, 0.14, 0.004, 0.022, DARKL, x, 0.425 + k * 0.01, -0.3, -0.5); }
    const btnLed = [], cols = [0x4aa3ff, 0xffb000, 0x27d36b, 0xff3030];
    for (let i = 0; i < 4; i++) { add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14).rotateX(Math.PI / 2 - 0.4), std(0x2b2f35, 0.4, 0.4), c.x * -0.2 + 0.03 + i * 0.065, 0.4, -0.17, -0.4); btnLed.push(led(g, cols[i], c.x * -0.2 + 0.03 + i * 0.065, 0.417, -0.175, -0.4)); }
    // siège passager et montants intérieurs
    box(parent, 0.5, 0.75, 0.14, DARKL, -c.x, c.y - 0.6, c.z + 0.3, -0.12); box(parent, 0.3, 0.2, 0.1, DARKL, -c.x, c.y - 0.12, c.z + 0.32, -0.12);
    box(parent, 0.5, 0.75, 0.14, DARKL, c.x, c.y - 0.62, c.z + 0.45, -0.12);
    const draw = throttled((st) => {
      const { g: q } = cl, kmh = st.kmh, rpm = st.rpm;
      q.fillStyle = '#05080c'; q.fillRect(0, 0, 512, 192);
      dial(q, 130, 100, 78, 0, 9, rpm * 9, { step: 1, lab: (v) => String(v), red: 7.5, title: 'x1000 tr/min' });
      dial(q, 382, 100, 78, 0, 400, kmh, { step: 50, lab: (v) => String(v), title: 'km/h' });
      q.fillStyle = '#fff'; q.font = 'bold 40px monospace'; q.textAlign = 'center'; q.fillText(String(Math.round(kmh)), 382, 98);
      q.fillStyle = '#ffb000'; q.font = 'bold 34px monospace'; q.fillText(gearFor(kmh), 256, 110);
      q.fillStyle = st.lights ? '#4aa3ff' : '#1d2a36'; q.font = 'bold 16px monospace'; q.fillText('PHARES', 256, 160);
      cl.t.needsUpdate = true;
      const { g: m } = cs;
      m.fillStyle = '#0a1018'; m.fillRect(0, 0, 384, 224); m.strokeStyle = '#1d3347'; m.lineWidth = 1;
      for (let x = 0; x < 384; x += 32) { m.beginPath(); m.moveTo(x, 0); m.lineTo(x, 224); m.stroke(); } for (let y = 0; y < 224; y += 32) { m.beginPath(); m.moveTo(0, y); m.lineTo(384, y); m.stroke(); }
      m.save(); m.translate(192, 130); m.rotate(st.hdg * Math.PI / 180); m.fillStyle = '#7fe8e8'; m.beginPath(); m.moveTo(0, -26); m.lineTo(16, 18); m.lineTo(0, 8); m.lineTo(-16, 18); m.fill(); m.restore();
      m.fillStyle = '#9fb4d0'; m.font = 'bold 22px monospace'; m.textAlign = 'left'; m.fillText('NAV', 14, 30); m.textAlign = 'right'; m.fillText(String(Math.round(st.hdg)).padStart(3, '0') + '°', 372, 30);
      cs.t.needsUpdate = true;
      btnLed[0].emissiveIntensity = st.lights ? 2 : 0; btnLed[1].emissiveIntensity = st.boost ? 2 : 0; btnLed[2].emissiveIntensity = kmh > 1 ? 2 : 0; btnLed[3].emissiveIntensity = st.brake ? 2 : 0;
    }, 50);
    return { update: draw };
  }

  /* ───────── hélicoptère : tableau avec anémomètre, horizon, altimètre, variomètre, régime rotor ; manche cyclique et collectif ───────── */
  function heliInterior(parent, c, o = {}) {
    const w = o.width ?? 1.1, g = new THREE.Group(); g.position.set(0, c.y - 0.33, c.z - 0.62); parent.add(g);
    const shape = new THREE.Shape([[0, 0], [0.5, 0], [0.46, 0.24], [0.22, 0.3], [0.04, 0.26], [0, 0.18]].map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
    add(g, geo, DARK, 0, 0, 0.12);
    const pn = cv(512, 256), px = c.x, py = 0.18;
    screen(g, pn, 0.52, 0.26, px, 0.46, -0.16, -0.7); bezel(g, 0.52, 0.26, px, 0.46, -0.16, -0.7);
    const vs = cv(256, 128), vm = screen(g, vs, 0.28, 0.14, px + 0.4 * Math.sign(-c.x || 1), 0.4, -0.16, -0.7);
    // manche cyclique, collectif et palonniers
    const stick = new THREE.Group(); stick.position.set(c.x, -0.28, c.z * 0 + 0.5); g.add(stick);
    add(stick, new THREE.CylinderGeometry(0.014, 0.018, 0.34, 10), DARKL, 0, 0.17, 0); add(stick, new THREE.SphereGeometry(0.03, 12, 8), RUBBER, 0, 0.36, 0); box(stick, 0.025, 0.05, 0.03, std(0xff3030, 0.5), 0.0, 0.34, -0.03);
    const coll = new THREE.Group(); coll.position.set(c.x - Math.sign(c.x || 1) * 0.42, -0.32, 0.45); g.add(coll);
    add(coll, new THREE.CylinderGeometry(0.014, 0.016, 0.4, 10).rotateX(Math.PI / 2), DARKL, 0, 0.1, -0.2); add(coll, new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12).rotateX(Math.PI / 2), RUBBER, 0, 0.1, -0.42);
    for (const s of [-1, 1]) box(g, 0.1, 0.02, 0.18, DARKL, c.x + s * 0.12, -0.44, 0.15, -0.3);
    box(parent, 0.5, 0.75, 0.14, DARKL, c.x, c.y - 0.55, c.z + 0.42, -0.1); box(parent, 0.3, 0.2, 0.1, DARKL, c.x, c.y - 0.1, c.z + 0.44, -0.1);
    const lamps = [led(g, 0x27d36b, px - 0.2, 0.6, -0.14, -0.7), led(g, 0xffb000, px - 0.1, 0.6, -0.14, -0.7), led(g, 0xff3030, px + 0.1, 0.6, -0.14, -0.7)];
    const draw = throttled((st) => {
      const q = pn.g; q.fillStyle = '#05080c'; q.fillRect(0, 0, 512, 256);
      dial(q, 100, 128, 82, 0, 200, st.kmh * 0.54, { step: 20, lab: (v) => String(v), title: 'KT' });        // nœuds
      horizon(q, 256, 128, 86, st.pitch, st.bank);
      dial(q, 412, 128, 82, 0, 3000, Math.max(0, st.alt) * 3.28 / 1, { step: 500, lab: (v) => String(v / 100), title: 'ALT ft' });
      pn.t.needsUpdate = true;
      const r = vs.g; r.fillStyle = '#05080c'; r.fillRect(0, 0, 256, 128);
      dial(r, 64, 66, 52, -10, 10, st.vs, { step: 5, lab: (v) => String(v), title: 'VS', a0: Math.PI * 0.75, a1: Math.PI * 2.25 });
      r.fillStyle = '#7fe8e8'; r.font = 'bold 18px monospace'; r.textAlign = 'left'; r.fillText('ROTOR', 130, 30);
      r.fillStyle = '#243645'; r.fillRect(130, 40, 110, 14); r.fillStyle = st.rotor > 0.9 ? '#27d36b' : '#ffb000'; r.fillRect(130, 40, 110 * clamp(st.rotor ?? 0, 0, 1), 14);
      r.fillStyle = '#7fe8e8'; r.fillText('COLL', 130, 84); r.fillStyle = '#243645'; r.fillRect(130, 94, 110, 14); r.fillStyle = '#4aa3ff'; r.fillRect(130, 94, 110 * clamp(st.coll ?? 0, 0, 1), 14);
      vs.t.needsUpdate = true;
      stick.rotation.set(-st.pitch * 0.4 * 0 + (st.stickP ?? 0) * 0.3, 0, -(st.stickR ?? st.bank * 0.5) * 0.3);
      coll.rotation.x = -clamp(st.coll ?? 0, 0, 1) * 0.5;
      lamps[0].emissiveIntensity = (st.rotor ?? 0) > 0.9 ? 2 : 0; lamps[1].emissiveIntensity = st.alt < 30 ? 2 : 0; lamps[2].emissiveIntensity = st.warn ? 2 : 0;
    }, 50);
    return { update: draw };
  }

  /* ───────── avion : coaming, affichage tête haute, deux écrans (PFD + navigation), manche, manette, consoles à voyants ───────── */
  function planeInterior(parent, c, o = {}) {
    const g = new THREE.Group(); g.position.set(c.x, c.y - 0.42, c.z - 0.5); parent.add(g);
    const w = o.width ?? 0.95;
    const shape = new THREE.Shape([[0, 0], [0.42, 0], [0.4, 0.14], [0.26, 0.22], [0.06, 0.26], [0, 0.2]].map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
    add(g, geo, DARK, 0, 0, 0.1);
    const pfd = cv(512, 384), nav = cv(512, 384);
    const sx = o.screenW ?? 0.26, sy = sx * 0.75;
    screen(g, pfd, sx, sy, -sx * 0.55, 0.36, -0.14, -0.75); bezel(g, sx, sy, -sx * 0.55, 0.36, -0.14, -0.75);
    screen(g, nav, sx, sy, sx * 0.55, 0.36, -0.14, -0.75); bezel(g, sx, sy, sx * 0.55, 0.36, -0.14, -0.75);
    // affichage tête haute : support, verre combinateur
    box(g, 0.1, 0.05, 0.08, DARKL, 0, 0.3, -0.05);
    const hudGlass = add(g, new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }), 0, 0.42, -0.14, -0.2);
    const hud = cv(256, 160); const hudMesh = screen(g, hud, 0.2, 0.125, 0, 0.42, -0.141, -0.2); hudMesh.material.transparent = true; hudMesh.material.blending = THREE.AdditiveBlending; hudMesh.material.depthWrite = false;
    // manche à droite, manette des gaz à gauche, consoles latérales avec voyants
    const stick = new THREE.Group(); stick.position.set(0.0, -0.3, 0.38); g.add(stick);
    add(stick, new THREE.CylinderGeometry(0.014, 0.02, 0.32, 10), DARKL, 0, 0.16, 0); add(stick, new THREE.CylinderGeometry(0.026, 0.03, 0.1, 12), RUBBER, 0, 0.35, 0); box(stick, 0.016, 0.02, 0.02, std(0xff3030, 0.5), 0.0, 0.4, -0.02);
    const thr = new THREE.Group(); thr.position.set(-0.3, -0.28, 0.35); g.add(thr);
    add(thr, new THREE.CylinderGeometry(0.012, 0.014, 0.26, 10).rotateX(Math.PI / 2), DARKL, 0, 0.08, -0.1); add(thr, new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12).rotateX(Math.PI / 2), RUBBER, 0, 0.1, -0.24);
    const lamps = [];
    for (const s of [-1, 1]) { box(g, 0.2, 0.06, 0.4, DARKL, s * 0.52, -0.3, 0.3); for (let i = 0; i < 6; i++) lamps.push(led(g, [0x27d36b, 0xffb000, 0x4aa3ff, 0xff3030, 0x27d36b, 0xffb000][i], s * 0.52 - 0.07 + (i % 3) * 0.07, -0.265, 0.24 + Math.floor(i / 3) * 0.08)); }
    box(parent, 0.4, 0.55, 0.2, DARKL, c.x, c.y - 0.45, c.z + 0.4);                                                  // siège éjectable
    add(parent, new THREE.TorusGeometry(0.06, 0.012, 6, 16), std(0xf2c014, 0.5, 0), c.x, c.y - 0.15, c.z + 0.35);
    const draw = throttled((st) => {
      const q = pfd.g; q.fillStyle = '#04070b'; q.fillRect(0, 0, 512, 384);
      horizon(q, 256, 200, 140, st.pitch, st.bank);
      q.fillStyle = '#7fe8e8'; q.font = 'bold 30px monospace'; q.textAlign = 'left'; q.fillText(String(Math.round(st.kmh * 0.54)).padStart(3, ' '), 12, 52); q.font = '16px monospace'; q.fillText('KIAS', 12, 74);
      q.textAlign = 'right'; q.font = 'bold 30px monospace'; q.fillText(String(Math.round(st.alt)).padStart(5, '0'), 500, 52); q.font = '16px monospace'; q.fillText('ALT m', 500, 74);
      q.textAlign = 'center'; q.font = 'bold 26px monospace'; q.fillText(String(Math.round(st.hdg)).padStart(3, '0') + '°', 256, 36);
      q.fillStyle = '#ffb000'; q.font = '20px monospace'; q.textAlign = 'left'; q.fillText('M ' + (st.mach ?? 0).toFixed(2), 12, 372); q.textAlign = 'right'; q.fillText('G ' + (st.g ?? 1).toFixed(1), 500, 372);
      pfd.t.needsUpdate = true;
      const n = nav.g; n.fillStyle = '#04070b'; n.fillRect(0, 0, 512, 384); n.strokeStyle = '#7fe8e8'; n.lineWidth = 2; n.beginPath(); n.arc(256, 200, 130, 0, 7); n.stroke(); n.beginPath(); n.arc(256, 200, 65, 0, 7); n.stroke();
      n.strokeStyle = '#1d3347'; n.beginPath(); n.moveTo(256, 60); n.lineTo(256, 340); n.moveTo(116, 200); n.lineTo(396, 200); n.stroke();
      n.save(); n.translate(256, 200); n.rotate(-st.hdg * Math.PI / 180); n.fillStyle = '#7fe8e8'; n.font = 'bold 22px monospace'; n.textAlign = 'center'; for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['O', 270]]) { n.save(); n.rotate(a * Math.PI / 180); n.fillText(t, 0, -144); n.restore(); } n.restore();
      n.fillStyle = '#fff'; n.beginPath(); n.moveTo(256, 176); n.lineTo(270, 218); n.lineTo(256, 208); n.lineTo(242, 218); n.fill();
      n.fillStyle = '#7fe8e8'; n.font = 'bold 22px monospace'; n.textAlign = 'left'; n.fillText('TACTIQUE / NAV', 14, 34); n.textAlign = 'right'; n.fillText(Math.round(st.alt) + ' m', 498, 34);
      n.fillStyle = '#ffb000'; n.textAlign = 'left'; n.fillText('POUSSÉE ' + Math.round((st.thr ?? 0) * 100) + '%', 14, 372);
      nav.t.needsUpdate = true;
      const h = hud.g; h.clearRect(0, 0, 256, 160); h.strokeStyle = '#66ffaa'; h.fillStyle = '#66ffaa'; h.lineWidth = 3; h.font = 'bold 22px monospace';
      h.save(); h.translate(128, 80); h.rotate(-st.bank); h.translate(0, st.pitch * 150); h.beginPath(); h.moveTo(-90, 0); h.lineTo(-30, 0); h.moveTo(30, 0); h.lineTo(90, 0); h.stroke(); h.restore();
      h.beginPath(); h.arc(128, 80, 8, 0, 7); h.stroke(); h.textAlign = 'left'; h.fillText(String(Math.round(st.kmh * 0.54)), 8, 84); h.textAlign = 'right'; h.fillText(String(Math.round(st.alt)), 248, 84);
      hud.t.needsUpdate = true;
      thr.rotation.x = -(st.thr ?? 0) * 0.5; stick.rotation.z = -(st.bank * 0.3); stick.rotation.x = -(st.pitch * 0.2);
      lamps.forEach((l, i) => { l.emissiveIntensity = (i === 0 && st.gear) || (i === 3 && st.alt < 100) || (i === 1 && (st.thr ?? 0) > 0.99) || i === 4 ? 2 : 0; });
    }, 50);
    return { update: draw };
  }

  return { carInterior, heliInterior, planeInterior, gearFor };
}

/* Avions : F-35B (STOVL, tuyère orientable, post-combustion) et PV-40 (aile basculante).
   Modèle de vol repris du Sky Pilot (portance, traînée, décrochage, poussée vectorielle, pilotage assisté). */
import * as THREE from 'three';
import { clamp, lerp, sstep, approach } from '../util.js';
import { G as GRAV, V3, Q, UP } from './base.js';

const AIRCRAFT = {
  f35: { id: 'f35', kind: 'jet', tmil: 5.8, tab: 4.4, ram: 0.45, tvtol: 13.5, cd0: 0.0175, cdSuper: 0.0076, wave: 0.012, k: 0.065, cla: 5, clmax: 1.35, gmax: 13,
    vrot: 48, vstall: 44, pitchLo: 0.08, pitchHi: 0.47, pitchFast: 0.78, rollLo: 1.2, rollHi: 3.8, rollV: [80, 260], yaw: 0.45,
    gearH: 2.05, bellyH: 1.15, hit: [[-8.2, -0.2, 3], [8.2, -0.2, 3], [0, 0, -8.5], [0, 0.4, 5.5, 0.5]], cam: { dist: 21, h: 4.6 }, cockpit: [0, 0.91, -2.48], cruise: 160 },
  pv40: { id: 'pv40', kind: 'tiltwing', tstat: 12, tvtol: 14.5, power: 1080, cd0: 0.0165, k: 0.05, cla: 5.2, clmax: 1.55, gmax: 7,
    vrot: 30, vstall: 33, pitchLo: 0.1, pitchHi: 0.55, pitchFast: 0.35, rollLo: 1, rollHi: 2.6, rollV: [50, 180], yaw: 0.45,
    gearH: 3.05, bellyH: 1.75, hit: [[-16.9, 2.1, -1.6], [16.9, 2.1, -1.6], [0, -0.3, -16.6], [0, 0.45, 12, 0.6], [0, 1.5, 16.6, 0.6]], cam: { dist: 44, h: 9 }, cockpit: [-0.62, 1.18, -13.6], cruise: 85 },
};
const K_LIFT = 0.005, TILT_RATE = 0.27;
const smooth = sstep;
const _f = new V3(), _u = new V3(), _r = new V3(), _vh = new V3(), _tmp = new V3(), _n = new V3(), _qi = new Q(), _dq = new Q(), _w = new V3(), _vb = new V3(), _ld = new V3(), _td = new V3();
const speedOfSound = alt => clamp(340 - Math.max(alt, 0) * 0.003, 295, 340);
function slew(c, t, dt) { const rate = (t === 0 || (c !== 0 && Math.sign(t) !== Math.sign(c))) ? 9 : 6; return approach(c, t, rate * dt); }

export class Plane {
  constructor(ctx, id, model) {
    this.ctx = ctx; this.A = AIRCRAFT[id]; this.m = model; this.root = model.root; this.cat = 'plane'; this.pv = id === 'pv40';
    this.S = { p: new V3(), v: new V3(), q: new Q() };
    this.inp = { pitch: 0, roll: 0, yaw: 0 };
    const A = this.A;
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: A.cam.dist, h: A.cam.h, look: 1.5, flat: false, follow: 'vel', stiff: 6, roll: 0.5, speedPull: 0.4 },
      { name: 'Éloignée', type: 'chase', dist: A.cam.dist * 2, h: A.cam.h * 2, look: 2, flat: false, follow: 'vel', stiff: 4 },
      { name: 'Cockpit', type: 'attach', off: new V3(...A.cockpit).add(new V3(0, this.pv ? -0.06 : 0.12, 0)), near: 0.1 },
    ];
    this.help = [['Maj / Ctrl', 'Poussée + / − (Maj à 100 % : post-combustion)'], ['Z / S', 'Cabrer / piquer'], ['Q / D', 'Roulis gauche / droite'], ['A / E', 'Palonnier'],
      ['T', this.pv ? 'Basculer l\'aile vers 30°, 60°, 90°' : 'Tuyère verticale / horizontale (décollage vertical)'], ...(this.pv ? [['Y', 'Rabaisser l\'aile'], ['B', 'Freins VTOL'], ['O', 'Portes et rampe arrière']] : []),
      ['G', 'Train d\'atterrissage'], ['F', 'Volets (0 / 1 / 2)'], ['Espace', 'Freins de roues'], ['V', 'Pilotage assisté oui / non']];
  }
  get pos() { return this.S.p; } get vel() { return this.S.v; }
  spawn(at) {
    const S = this.S, A = this.A, pv = this.pv;
    if (at.quat && at.air) S.q.copy(at.quat); else S.q.setFromAxisAngle(UP, at.yaw);
    Object.assign(S, { thr: 0, flaps: 1, gear: true, gearPos: 1, brake: false, onGround: true, aspd: 0, mach: 0, agl: 0, vs: 0, bank: 0, pitch: 0, air: 0, assist: S.assist !== false, ab: false, abL: 0, upPrev: false,
      noz: 0, nozT: 0, holdP: 0, tilt: 0, tiltT: 0, doors: false, doorsP: 0, vbrake: true, propAng: 0, G: 1 });
    S.p.set(at.x, at.y, at.z); S.v.set(0, 0, 0);
    if (at.air) {
      // en l'air : même orientation et même vitesse ; trop lent pour voler -> vol stationnaire (VTOL)
      if (at.vel) S.v.copy(at.vel);
      S.gear = false; S.gearPos = 0; S.flaps = 0; S.onGround = false;
      if (S.v.length() < (pv ? 30 : 45)) {
        if (pv) { S.tilt = S.tiltT = Math.PI / 2; S.thr = 0.68; } else { S.noz = S.nozT = 1; S.thr = 0.73; }
        S.gear = true; S.gearPos = 1;
        this.ctx.toast('Vol stationnaire · T : vol normal');
      } else S.thr = 0.75;
    } else {
      S.p.y = this.ground(S.p.x, S.p.z) + A.gearH + 0.05;
      if (pv) { S.tilt = S.tiltT = Math.PI / 2; } else { S.noz = S.nozT = 1; }
      this.ctx.toast(pv ? 'Aile à 90° : Maj pour décoller à la verticale' : 'Tuyère verticale : Maj pour décoller à la verticale');
    }
    this.inp.pitch = this.inp.roll = this.inp.yaw = 0;
  }
  ground(x, z) { const w = this.ctx.world; return Math.max(w.groundAt(x, z, this.S.p.y), w.waterAt(x, z)); }
  onKey(c) {
    const S = this.S, pv = this.pv, t = this.ctx.toast;
    if (c === 'KeyT' || c === 'KeyY') {
      if (pv) {
        const deg = Math.round(S.tiltT * 180 / Math.PI / 30) * 30, d = c === 'KeyT' ? 1 : -1, next = d > 0 ? (deg >= 90 ? 0 : deg + 30) : (deg <= 0 ? 90 : deg - 30);
        S.tiltT = next * Math.PI / 180; t('Aile ' + next + '°');
      } else if (c === 'KeyT') { S.nozT = S.nozT > 0.5 ? 0 : 1; if (S.nozT && S.aspd > 140) S.nozT = 0; t(S.nozT ? 'Tuyère verticale' : 'Tuyère horizontale'); }
    } else if (c === 'KeyB' && pv) { S.vbrake = !S.vbrake; t(S.vbrake ? 'Freins VTOL actifs' : 'Freins VTOL coupés'); }
    else if (c === 'KeyO' && pv) { S.doors = !S.doors; t(S.doors ? 'Portes et rampe ouvertes' : 'Portes fermées'); }
    else if (c === 'KeyG') { if (!(S.onGround && S.gear)) { S.gear = !S.gear; t(S.gear ? 'Train sorti' : 'Train rentré'); } }
    else if (c === 'KeyF') { S.flaps = (S.flaps + 1) % 3; t('Volets ' + S.flaps); }
    else if (c === 'KeyV') { S.assist = !S.assist; t(S.assist ? 'Pilotage assisté' : 'Pilotage manuel'); }
  }
  readInputs(dt, K) {
    const S = this.S, inp = this.inp, pv = this.pv;
    const tp = (K.down('KeyW', 'ArrowDown') ? 1 : 0) - (K.down('KeyS', 'ArrowUp') ? 1 : 0), tr = (K.down('KeyD', 'ArrowRight') ? 1 : 0) - (K.down('KeyA', 'ArrowLeft') ? 1 : 0), ty = (K.down('KeyE') ? 1 : 0) - (K.down('KeyQ') ? 1 : 0);
    inp.pitch = slew(inp.pitch, tp, dt); inp.roll = slew(inp.roll, tr, dt); inp.yaw = slew(inp.yaw, ty, dt);
    const up = K.down('ShiftLeft', 'ShiftRight', 'PageUp') ? 1 : 0, dn = K.down('ControlLeft', 'ControlRight', 'PageDown') ? 1 : 0;
    if (up && !S.upPrev && S.thr >= 0.999 && !pv) { S.ab = true; this.ctx.toast('Post-combustion'); }
    S.upPrev = !!up;
    if (dn || S.thr < 0.999 || S.noz > 0.2 || pv) S.ab = false;
    if (up || dn) S.thr = clamp(S.thr + (up - dn) * 0.8 * dt, 0, 1);
    S.brake = K.down('Space');
  }
  step(dt, K) {
    this.readInputs(dt, K);
    const S = this.S, A = this.A, pv = this.pv, q = S.q, p = S.p, v = S.v, inp = this.inp, w = this.ctx.world;
    if (pv) S.tilt = approach(S.tilt, S.tiltT, dt * TILT_RATE);
    else { if (S.aspd > 140) S.nozT = 0; S.noz = approach(S.noz, S.nozT, dt * 0.5); }
    S.doorsP = approach(S.doorsP, S.doors ? 1 : 0, dt * 0.4);
    S.gearPos = approach(S.gearPos, S.gear ? 1 : 0, dt / 2.2);
    const vt = pv ? Math.sin(S.tilt) : S.noz, thrAng = pv ? S.tilt : S.noz * Math.PI / 2;
    _f.set(0, 0, -1).applyQuaternion(q); _u.set(0, 1, 0).applyQuaternion(q); _r.set(1, 0, 0).applyQuaternion(q);
    const rho = Math.exp(-Math.max(p.y, 0) / 9000), speed = v.length(); S.aspd = speed;
    const mach = speed / speedOfSound(p.y);
    if (S.mach < 1 && mach >= 1) this.ctx.trick('Mur du son !', 'Mach 1', 500);
    S.mach = mach;
    _qi.copy(q).invert(); _vb.copy(v).applyQuaternion(_qi);
    const alpha = speed > 1 ? Math.atan2(-_vb.y, -_vb.z) : 0, beta = speed > 1 ? Math.asin(clamp(_vb.x / speed, -1, 1)) : 0;
    S.bank = Math.atan2(-_r.y, _u.y); S.pitch = Math.asin(clamp(_f.y, -1, 1)); S.vs = v.y;
    // aérodynamique
    const fl = S.flaps, cl0 = 0.035 + fl * 0.12, CLa = A.cla, CLmax = A.clmax + fl * 0.2, aa = Math.abs(alpha);
    const st = speed > 8 ? smooth(0.36, 0.56, aa) * (1 - clamp(vt * 1.5, 0, 1)) : 0;
    const qk = K_LIFT * rho * speed * speed;
    let CL = clamp(CLa * alpha + cl0, -CLmax * 0.8, CLmax) * (1 - 0.7 * st);
    { const cap = A.gmax * GRAV / Math.max(qk, 1); CL = clamp(CL, -cap * 0.5, cap); }
    CL = lerp(CL, Math.sin(2 * alpha), smooth(0.35, 0.7, aa));
    if (pv) CL *= 1 - 0.6 * vt;
    const cd0 = pv ? A.cd0 + 0.03 * smooth(0.7, 0.85, mach) : lerp(A.cd0, A.cdSuper, smooth(1, 2, mach)) + A.wave * smooth(0.85, 1.02, mach) * (1 - smooth(1.05, 1.7, mach));
    const CD = cd0 + 0.02 * S.gearPos + fl * 0.018 + A.k * CL * CL + 1.2 * Math.sin(alpha) ** 2 * smooth(0.2, 0.6, aa) + 0.15 * st + (pv ? 0.12 * vt * vt + 0.02 * S.doorsP : 0);
    let ax = 0, ay = -GRAV, az = 0;
    if (speed > 0.5) {
      _vh.copy(v).multiplyScalar(1 / speed); _ld.crossVectors(_r, _vh); const ll = _ld.length(); if (ll > 1e-4) _ld.multiplyScalar(1 / ll); else _ld.copy(_u);
      const aL = qk * CL, aD = qk * CD;
      ax += _ld.x * aL - _vh.x * aD; ay += _ld.y * aL - _vh.y * aD; az += _ld.z * aL - _vh.z * aD;
      const sf = -v.dot(_r) * 1.6 * Math.min(1, speed / 35); ax += _r.x * sf; ay += _r.y * sf; az += _r.z * sf;
      S.G = (_ld.dot(_u) * aL) / GRAV;
    } else S.G = 1;
    // poussée
    const cn = Math.cos(thrAng), sn = Math.sin(thrAng);
    _td.set(_f.x * cn + _u.x * sn, _f.y * cn + _u.y * sn, _f.z * cn + _u.z * sn);
    let T;
    if (pv) { const lapse = Math.pow(rho, 0.7), vAl = Math.max(v.dot(_td), 0); T = S.thr * lapse * Math.min(lerp(A.tstat, A.tvtol, vt), A.power / Math.max(vAl, 1)); S.abL = 0; }
    else {
      S.abL = approach(S.abL, (S.ab && S.thr > 0.99) ? 1 : 0, dt * (S.ab ? 1.8 : 3));
      const conv = (A.tmil * S.thr + A.tab * S.abL) * Math.pow(rho, 0.75) * (1 + A.ram * clamp(mach, 0, 2.6));
      T = lerp(conv, A.tvtol * S.thr * Math.pow(rho, 0.7), S.noz);
    }
    ax += _td.x * T; ay += _td.y * T; az += _td.z * T;
    if (vt > 0) {
      if (!pv) { ay -= 0.6 * vt * v.y; ax -= 0.15 * vt * v.x; az -= 0.15 * vt * v.z; }
      else if (S.vbrake && !S.onGround) { const kk = smooth(0.5, 1, vt) * (1 - smooth(25, 45, speed)); ay -= 0.35 * kk * v.y; ax -= 0.45 * kk * v.x; az -= 0.45 * kk * v.z; }
    }
    // commandes angulaires
    let wx = 0, wy = 0, wz = 0;
    const airControl = smooth(25, 100, speed), eff = Math.max(airControl, vt * (pv ? 1 : 0.35));
    if (!S.onGround) {
      const pitchRate = A.pitchLo + clamp(speed / 180, 0, 1) * A.pitchHi + A.pitchFast * smooth(140, 330, speed);
      const rollRate = lerp(A.rollLo, A.rollHi, smooth(A.rollV[0], A.rollV[1], speed));
      const vb = pv && S.vbrake ? 1 - 0.35 * vt : 1;
      wx = inp.pitch * pitchRate * airControl * (1 - 0.6 * st) + inp.pitch * vt * (pv ? 0.75 : 0.25) * vb;
      wz = -inp.roll * (rollRate * airControl + (pv ? 0.8 : 0.4) * vt * vb) * (1 - 0.4 * st);
      wy = -inp.yaw * (A.yaw * eff + (pv ? 0.5 * vt : 0));
      const wv = smooth(6, 60, speed) * (1 - vt);
      wy += -1.6 * Math.sin(beta) * wv;
      const aEx = alpha - clamp(alpha, -0.08, 0.2);
      wx += -1.7 * Math.sin(aEx) * wv * (1 - 0.6 * Math.abs(inp.pitch));
      const vs1 = A.vstall / Math.sqrt(rho);
      if (S.assist && _u.y > 0.2 && st < 0.05 && (speed > vs1 * 1.12 || vt > 0.4)) {
        if (Math.abs(inp.pitch) < 0.05 && vt < 0.25) {
          const cosg = Math.cos(Math.asin(clamp(v.y / Math.max(speed, 1), -1, 1))), cb = Math.max(Math.cos(S.bank), 0.5);
          const aT = clamp((GRAV * cosg / cb - qk * cl0) / (qk * CLa + T + 1), -0.12, 0.18);
          wx += clamp(3 * (aT - alpha), -0.5, 0.5);
          const apy = ay - (ax * _vh.x + ay * _vh.y + az * _vh.z) * _vh.y, gd = apy / Math.max(speed * Math.max(cosg, 0.2), 5); wx += clamp(-0.6 * gd, -0.6, 0.6);
        }
        if (Math.abs(inp.roll) < 0.05 && Math.abs(S.bank) < 1.35) wz += clamp(2.5 * S.bank, -2.5, 2.5);
      }
      if (vt >= 0.25) { if (Math.abs(inp.pitch) > 0.05) S.holdP = S.pitch; else if (S.assist || (pv && S.vbrake)) wx += clamp((S.holdP - S.pitch) * 2.5, -0.8, 0.8); } else S.holdP = S.pitch;
      if (pv && S.vbrake && vt > 0.5 && Math.abs(inp.roll) < 0.05) wz += clamp(2.2 * S.bank, -1.5, 1.5);
      if (S.assist && S.agl < 8 && S.vs < 8 && inp.pitch > 0) { const lim = pv ? 0.2 : 0.26; wx = Math.min(wx, Math.max(0, (lim - S.pitch) * 3)); }
      if (st > 0.05) wx += -Math.sign(alpha) * 1.3 * st;
    } else {
      S.holdP = S.pitch;
      const gp = Math.atan2(this.ground(p.x + _f.x * 12, p.z + _f.z * 12) - this.ground(p.x - _f.x * 12, p.z - _f.z * 12), 24);
      wy = -(inp.yaw + inp.roll * 0.6) * 0.35 * clamp((speed - (pv ? 4 : 30)) / (pv ? 10 : 30), 0, 1) - (inp.yaw + inp.roll * 0.5) * 0.35 * vt * (speed < 8 ? 1 : 0);
      wz = clamp(S.bank * 4, -2, 2);
      if (inp.pitch > 0.05 && speed > A.vrot) wx = S.pitch < 0.22 ? inp.pitch * 0.2 * clamp((speed - A.vrot) / 18, 0, 1) : 0;
      else wx = clamp((gp - S.pitch) * 2.5, -1, 1);
    }
    _w.set(wx, wy, wz); const ang = _w.length() * dt; if (ang > 1e-6) { _dq.setFromAxisAngle(_w.normalize(), ang); q.multiply(_dq).normalize(); }
    v.x += ax * dt; v.y += ay * dt; v.z += az * dt; p.addScaledVector(v, dt);
    // contact avec le sol
    const gy = w.groundAt(p.x, p.z, p.y), wl = w.waterAt(p.x, p.z), water = gy < wl, sy = Math.max(gy, wl), gh = S.gearPos > 0.6 ? A.gearH : A.bellyH;
    S.agl = p.y - gh - sy;
    if (p.y - gh <= sy) {
      w.normalAt(p.x, p.z, _n); if (water) _n.set(0, 1, 0);
      const vn = v.dot(_n), sink = Math.max(0, -vn); let why = null;
      if (water && speed > 8 && !(pv && speed < 45 && sink < 4)) why = 'Amerrissage forcé : l\'avion ne flotte pas';
      else if (S.gearPos < 0.6 && !(pv && sink < 3 && speed < 70)) why = 'Atterrissage train rentré';
      else if (sink > (pv ? 8.5 : 7.5)) why = 'Impact trop violent (' + sink.toFixed(1) + ' m/s)';
      else if (Math.abs(S.bank) > 0.5) why = 'Une aile a touché le sol';
      else if (S.pitch < -0.3 && speed > 20) why = 'Le nez a touché le sol';
      else if (_n.y < 0.84 && speed > 18) why = 'Collision avec la pente';
      if (why) { this.ctx.crash(why); v.set(0, 0, 0); return; }
      if (S.air > 0.6 && sink > 0.3) this.ctx.toast(sink < 1.5 ? 'Atterrissage en douceur' : 'Atterrissage : ' + sink.toFixed(1) + ' m/s');
      S.onGround = true; S.air = 0; p.y = sy + gh; if (vn < 0) v.addScaledVector(_n, -vn);
      const hv = Math.hypot(v.x, v.z), fric = (water ? 2.2 : S.gearPos < 0.6 ? 3.5 : 0.35) + (S.brake ? 6.5 : 0);
      if (hv > 0.01) { const d = Math.min(hv, fric * dt); v.x -= v.x / hv * d; v.z -= v.z / hv * d; }
      v.addScaledVector(_r, -v.dot(_r) * Math.min(1, 10 * dt));
      if (hv < 0.6 && S.thr < 0.08) v.set(0, 0, 0);
    } else { S.onGround = false; S.air += dt; }
    // collisions du corps (relief, bâtiments, arbres)
    const pts = S.onGround ? A.hit.slice(0, 2) : A.hit;
    for (const c of pts) {
      _tmp.set(c[0], c[1], c[2]).applyQuaternion(q).add(p);
      const g2 = Math.max(w.groundAt(_tmp.x, _tmp.z, _tmp.y), w.waterAt(_tmp.x, _tmp.z)), tol = c[3] || 0;
      if (_tmp.y < g2 + 0.1 - tol || w.solidAt(_tmp.x, _tmp.y, _tmp.z)) { this.ctx.crash(g2 <= 0.1 && _tmp.y < 0.1 ? 'Impact dans l\'eau' : 'Collision'); v.set(0, 0, 0); return; }
    }
    if (w.solidAt(p.x, p.y, p.z)) { this.ctx.crash('Collision'); v.set(0, 0, 0); }
  }
  visual(dt) {
    const S = this.S, m = this.m;
    this.root.position.copy(S.p); this.root.quaternion.copy(S.q);
    if (!this.pv) {
      m.nozG.rotation.x = S.noz * Math.PI / 2;
      for (const door of m.liftFanDoors) door.hinge.rotation.z = -door.side * clamp(S.noz, 0, 1) * 1.28;
      m.liftFanRotor.rotation.y += dt * (S.noz > 0.2 ? 32 : 0);
      m.gearGroup.visible = S.gearPos > 0.02; m.gearGroup.scale.y = Math.max(S.gearPos, 0.01);
      m.flameMesh.visible = S.thr > 0.05; m.flameMesh.scale.set(1 + 0.4 * S.abL, 1 + 0.4 * S.abL, (0.4 + S.thr * 2.4 + S.abL * 4.5) * (0.9 + 0.2 * Math.random()));
    } else {
      const PV = m.PV, vt = Math.sin(S.tilt);
      PV.tilt.rotation.x = S.tilt;
      // nacelles du vrai modèle (posé à 90°) : bascule autour de l'axe d'aile, rotors contrarotatifs
      for (const k of this.nac || []) { k.n.rotation.x = S.tilt - Math.PI / 2; if (k.r) k.r.rotation.z = S.propAng * k.dir; }
      const om = S.thr > 0.02 ? 16 + 42 * S.thr : Math.min(S.aspd * 0.35, 22);
      S.propAng += om * dt;
      const ds = 1 + 0.2 * vt;
      for (const pr of PV.props) { pr.rotation.z = S.propAng * pr.userData.dir; pr.scale.set(ds, ds, 1); }
      for (const d of PV.discs) { d.material.opacity = clamp((om - 14) / 40, 0, 1) * 0.32; d.scale.set(ds, ds, 1); }
      PV.tailRotor.rotation.y += dt * (vt > 0.25 && S.thr > 0.05 ? 34 * vt : 0);
      const gp = S.gearPos, sw = (1 - smooth(0.55, 1, gp)) * Math.PI / 2, rt = 1 - smooth(0, 0.55, gp);
      for (const g of PV.mains) { g.rotation.y = sw; g.position.y = g.userData.y0 + rt * 1.0; }
      PV.nose.rotation.x = -rt * Math.PI / 2;
      for (const d of PV.doors) d.g.position.z = d.z + 1.35 * smooth(0, 0.6, S.doorsP);
      PV.ramp.rotation.x = lerp(-0.14, 0.47, smooth(0.3, 1, S.doorsP));
    }
  }
  hud() {
    const S = this.S;
    const lines = [['MACH', S.mach.toFixed(2)], ['FACTEUR G', S.G.toFixed(1)]];
    if (this.pv) lines.push(['AILE', Math.round(S.tilt * 180 / Math.PI) + '°']); else if (S.noz > 0.02) lines.push(['TUYÈRE', Math.round(S.noz * 90) + '°']);
    lines.push(['TRAIN', S.gearPos > 0.98 ? 'SORTI' : S.gearPos < 0.02 ? 'RENTRÉ' : '…'], ['VOLETS', S.flaps]);
    if (S.abL > 0.1) lines.push(['POST-COMB.', 'ON']);
    return { speed: S.aspd, alt: S.agl, vs: S.vs, thr: S.thr, thrLabel: 'POUSSÉE', lines };
  }
  audio() { return { kind: this.pv ? 'prop' : 'jet', rpm: this.S.thr, load: this.S.thr, boost: this.S.abL > 0.3 }; }
  upright() {
    const S = this.S; _f.set(0, 0, -1).applyQuaternion(S.q); const yaw = Math.atan2(-_f.x, -_f.z);
    if (S.onGround) S.q.setFromAxisAngle(UP, yaw);
    else { S.q.setFromAxisAngle(UP, yaw); const sp = Math.max(S.v.length(), this.A.cruise); _f.set(0, 0, -1).applyQuaternion(S.q); S.v.copy(_f).multiplyScalar(sp); }
  }
}

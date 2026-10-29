/* Drone FPV 5" : modèle de vol du FPV Racer (moteurs à retard, poussée selon l'air entrant,
   traînée anisotrope, propwash), en mode Angle (assisté) ou Acro. */
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';
import { G, V3, Q } from './base.js';

const P = { mass: 0.68, twr: 9, motorTau: 0.022, rateTau: 0.028, angAcc: 230, yawAcc: 70, vPitch: 72, cd: [0.0085, 0.032, 0.008], hLin: 0.11, radius: 0.13, crash: 9.5, prop: 0.127 };
const RATES = { roll: { rc: 1.0, sr: 0.7, ex: 0 }, pitch: { rc: 1.0, sr: 0.7, ex: 0 }, yaw: { rc: 1.0, sr: 0.7, ex: 0 } };
const RHO = 1.2, D2R = Math.PI / 180;
function bfRate(stick, r) {
  let rc = stick; const a = Math.abs(stick);
  if (r.ex) rc = stick * a * a * a * r.ex + stick * (1 - r.ex);
  let rate = 200 * r.rc * rc; if (r.sr) rate *= 1 / Math.min(1, Math.max(0.01, 1 - Math.abs(rc) * r.sr));
  return clamp(rate, -1998, 1998);
}
const _t = new V3(), _t2 = new V3(), _up = new V3(), _air = new V3(), _vb = new V3(), _F = new V3(), _qi = new Q(), _dq = new Q(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const ramp = (c, t, r, dt) => c + (t - c) * Math.min(1, r * dt);

export class Drone {
  constructor(ctx, model) {
    this.ctx = ctx; this.m = model; this.root = model.root; this.cat = 'drone';
    this.st = { pos: new V3(), vel: new V3(), q: new Q(), w: new V3(), motor: 0, sp: new V3(), propwash: 0, grounded: false };
    this.kb = { thr: 0, yaw: 0, pitch: 0, roll: 0 }; this.mode = 'angle'; this.armed = true; this.propA = 0;
    this.cams = [
      { name: 'Caméra FPV', type: 'attach', off: new V3(0, 0.01, -0.09), near: 0.02, tilt: 25 * D2R, fov: 100 },
      { name: 'Poursuite', type: 'chase', dist: 0.95, h: 0.32, look: 0.05, stiff: 8, near: 0.03 },
      { name: 'Éloignée', type: 'chase', dist: 2.8, h: 0.9, look: 0.1, stiff: 5, near: 0.03 },
    ];
    this.help = [['Z / S', 'Gaz (augmenter / diminuer)'], ['Q / D', 'Lacet (pivoter)'], ['↑ / ↓', 'Tangage (avancer / reculer)'], ['← / →', 'Roulis'],
      ['V', 'Mode Angle (assisté) / Acro'], ['Maj + S', 'Couper les gaz'], ['C', 'Caméra FPV / poursuite']];
  }
  get pos() { return this.st.pos; } get vel() { return this.st.vel; }
  spawn(at) {
    const st = this.st;
    st.pos.set(at.x, at.y + 0.3, at.z); st.vel.set(0, 0, 0); st.w.set(0, 0, 0);
    if (at.quat) st.q.copy(at.quat); else st.q.setFromEuler(new THREE.Euler(0, at.yaw, 0, 'YXZ'));
    if (at.vel) st.vel.copy(at.vel);
    st.motor = at.air ? 0.3 : 0; this.kb.thr = at.air ? 0.3 : 0; this.armed = true;
  }
  onKey(c) { if (c === 'KeyV') { this.mode = this.mode === 'angle' ? 'acro' : 'angle'; this.ctx.toast(this.mode === 'angle' ? 'Mode Angle (assisté)' : 'Mode Acro'); } }
  step(dt, K) {
    const st = this.st, kb = this.kb, k = (...c) => K.down(...c) ? 1 : 0, w = this.ctx.world;
    kb.thr = clamp(kb.thr + (k('KeyW') - k('KeyS')) * 0.7 * dt, 0, 1);
    if (k('ShiftLeft') && k('KeyS')) kb.thr = 0;
    kb.yaw = ramp(kb.yaw, (k('KeyD') - k('KeyA')) * 0.6, 5, dt);
    kb.pitch = ramp(kb.pitch, (k('ArrowUp') - k('ArrowDown')) * 0.6, 5, dt);
    kb.roll = ramp(kb.roll, (k('ArrowRight') - k('ArrowLeft')) * 0.6, 5, dt);
    const tMax = P.mass * G * P.twr, sp = st.sp;
    const yawRate = bfRate(kb.yaw, RATES.yaw) * D2R;
    if (this.mode === 'angle') {
      _e.setFromQuaternion(st.q);
      const maxA = 55 * D2R, tp = -kb.pitch / 0.6 * maxA, tr = -kb.roll / 0.6 * maxA;
      sp.x = clamp(7 * (tp - _e.x), -8, 8); sp.z = clamp(7 * (tr - _e.z), -8, 8); sp.y = -yawRate;
    } else { sp.x = -bfRate(kb.pitch, RATES.pitch) * D2R; sp.z = -bfRate(kb.roll, RATES.roll) * D2R; sp.y = -yawRate; }
    const thrTarget = this.armed ? 0.04 + kb.thr * 0.96 : 0;
    st.motor += (thrTarget - st.motor) * (1 - Math.exp(-dt / P.motorTau));
    const head = Math.min(st.motor, 1 - st.motor) * 2, auth = this.armed ? 0.55 + 0.45 * Math.min(1, head * 3 + 0.3) : 0;
    const aMax = [P.angAcc * auth, P.yawAcc * auth, P.angAcc * auth], tau = [P.rateTau, P.rateTau * 1.8, P.rateTau];
    ['x', 'y', 'z'].forEach((a, i) => { if (this.armed) st.w[a] += clamp((sp[a] - st.w[a]) / tau[i], -aMax[i], aMax[i]) * dt; else st.w[a] *= Math.exp(-dt * 2); });
    _air.copy(st.vel); _up.set(0, 1, 0).applyQuaternion(st.q);
    const vAx = _air.dot(_up), vTot = _air.length(), vPlane = Math.sqrt(Math.max(0, vTot * vTot - vAx * vAx));
    let wash = 0; if (vAx < -1.2) wash = Math.min(1, (-vAx - 1.2) / 6) * Math.max(0, 1 - vPlane / 11) * (0.35 + st.motor);
    st.propwash += (wash - st.propwash) * Math.min(1, dt * 12);
    if (st.propwash > 0.01) { const amp = st.propwash * 55 * dt; st.w.x += (Math.random() * 2 - 1) * amp; st.w.z += (Math.random() * 2 - 1) * amp; }
    const wl = st.w.length(); if (wl > 1e-6) { _t.copy(st.w).multiplyScalar(1 / wl); _dq.setFromAxisAngle(_t, wl * dt); st.q.multiply(_dq).normalize(); }
    const m = st.motor; let eff = clamp(m - vAx / P.vPitch, 0, m + 0.3);
    let T = tMax * m * eff * (1 - st.propwash * 0.12);
    const h = st.pos.y - w.groundAt(st.pos.x, st.pos.z, st.pos.y); if (h < P.prop * 4) T *= 1 + 0.12 * (1 - Math.max(0, h) / (P.prop * 4));
    _F.copy(_up).multiplyScalar(T); _F.y -= P.mass * G;
    _qi.copy(st.q).invert(); _vb.copy(_air).applyQuaternion(_qi); const s2 = _vb.length();
    _t.set(-0.5 * RHO * P.cd[0] * s2 * _vb.x - P.hLin * (0.3 + m) * _vb.x, -0.5 * RHO * P.cd[1] * s2 * _vb.y, -0.5 * RHO * P.cd[2] * s2 * _vb.z - P.hLin * (0.3 + m) * _vb.z).applyQuaternion(st.q);
    _F.add(_t);
    st.vel.addScaledVector(_F, dt / P.mass); st.pos.addScaledVector(st.vel, dt);
    this.collide(dt);
    this.propA += st.motor * 400 * dt;
  }
  collide(dt) {
    const st = this.st, w = this.ctx.world, p = st.pos, r = P.radius;
    const g = w.groundAt(p.x, p.z, p.y), wl = w.waterAt(p.x, p.z);
    if (p.y < wl && g < wl) { this.ctx.crash('Le drone est tombé à l\'eau'); st.vel.set(0, 0, 0); return; }
    st.grounded = false;
    let impact = 0;
    if (p.y - r < g) {
      p.y = g + r; const vn = -st.vel.y;
      if (vn > 0) { impact = vn; st.vel.y = vn > 2 ? vn * 0.28 : 0; st.vel.x *= 0.6; st.vel.z *= 0.6; }
      st.grounded = true;
    }
    const hit = w.collideCircle(p, r, 0.2);
    if (hit) { const vn = st.vel.x * hit.nx + st.vel.z * hit.nz; if (vn < 0) { impact = Math.max(impact, -vn); st.vel.x -= 1.28 * vn * hit.nx; st.vel.z -= 1.28 * vn * hit.nz; } }
    if (w.solidAt(p.x, p.y, p.z)) { impact = Math.max(impact, st.vel.length()); st.vel.multiplyScalar(-0.3); }
    if (impact > 0.5) {
      const spin = Math.min(25, impact * 1.6); st.w.x += (Math.random() * 2 - 1) * spin; st.w.z += (Math.random() * 2 - 1) * spin;
      if (impact > P.crash) { this.ctx.crash('Hélices cassées (' + impact.toFixed(1) + ' m/s)'); st.vel.set(0, 0, 0); return; }
      this.ctx.sfx.impact(impact * 2);
    }
    if (st.grounded && st.motor < 0.2) {
      st.w.multiplyScalar(Math.exp(-dt * 10));
      _up.set(0, 1, 0).applyQuaternion(st.q); _t.set(0, _up.y > -0.2 ? 1 : -1, 0);
      const ang = _up.angleTo(_t); if (ang > 0.01) { _t2.crossVectors(_up, _t).normalize(); _dq.setFromAxisAngle(_t2, Math.min(ang, dt * 4)); st.q.premultiply(_dq).normalize(); }
      st.vel.x *= Math.exp(-dt * 4); st.vel.z *= Math.exp(-dt * 4);
    }
  }
  visual(dt) {
    this.root.position.copy(this.st.pos); this.root.quaternion.copy(this.st.q);
    this.m.props.forEach((p, i) => { p.rotation.y = this.propA * (i % 2 ? 1 : -1); });
  }
  hud() {
    const st = this.st, g = this.ctx.world.groundAt(st.pos.x, st.pos.z, st.pos.y);
    return { speed: st.vel.length(), alt: st.pos.y - g, vs: st.vel.y, thr: this.kb.thr, thrLabel: 'GAZ', lines: [['MODE', this.mode === 'angle' ? 'ANGLE' : 'ACRO']] };
  }
  audio() { return { kind: 'drone', rpm: this.st.motor, load: this.kb.thr }; }
  upright() { const st = this.st; _e.setFromQuaternion(st.q); st.q.setFromEuler(new THREE.Euler(0, _e.y, 0, 'YXZ')); st.w.set(0, 0, 0); st.vel.set(0, 0, 0); st.pos.y += 0.5; }
}

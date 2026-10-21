/* Deux-roues : superbike (Simulateur Moto), Kukirin G6 (trottinette électrique), trottinette freestyle.
   Les modèles d'origine regardent vers +Z : ils sont retournés dans un groupe pour regarder vers -Z. */
import * as THREE from 'three';
import { clamp, lerp, wrapPi, TAU } from '../util.js';
import { G, V3, Q, GroundBody, groundQuat, ease, yawOf } from './base.js';
import { Tricks } from '../models/tricks.js';

const _f = new V3(), _l = new V3(), _q = new Q();
function wrap(model) { const root = new THREE.Group(), flip = new THREE.Group(); flip.rotation.y = Math.PI; flip.add(model); root.add(flip); return root; }
function slopeAlong(n, d) { return -(n.x * d.x + n.z * d.z) / Math.max(0.3, n.y); }

/* ===================== superbike ===================== */
const GEARF = [0.2, 0.31, 0.44, 0.58, 0.76, 1];
const powerShape = x => x < 0.2 ? 0.4 : x < 1 ? 1 - 0.9 * (1 - x) * (1 - x) : Math.max(0, 1 - 4 * (x - 1) * (x - 1) * 1.5);
export class Moto {
  constructor(ctx, motoModel, bikeIdx = 1) {
    this.ctx = ctx; this.cat = 'bike';
    const bk = Object.assign({}, motoModel.BIKES[bikeIdx]);
    bk.mass = bk.kg + 80; bk.pw = bk.hp * 745.7 * 0.89; const vt = bk.vtop / 3.6;
    bk.cda = Math.max(0.05, (bk.pw - 0.012 * bk.mass * G * vt) / (0.5 * 1.2 * vt * vt * vt)); bk.gtop = GEARF.map(f => f * vt * 1.02);
    this.bk = bk; this.m = motoModel.buildBike(bk); this.root = wrap(this.m.root);
    this.b = new GroundBody(ctx.world, { wb: 1.4, track: 0.3, circles: [[0.7, 0.4], [-0.6, 0.4]], height: 1.2, step: 0.45 });
    this.quat = new Q();
    Object.assign(this, { v: 0, u: 0, kap: 0, lean: 0, pitch: 0, gear: 1, rpm: 1300, brkS: 0, up: 0, spin: 0, steerV: 0, aT: 0, fallT: 0, thr: 0 });
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: 4.6, h: 1.55, look: 0.95, roll: 0 },
      { name: 'Éloignée', type: 'chase', dist: 8, h: 2.6, look: 1 },
      { name: 'Casque', type: 'attach', off: new V3(0, 1.32, -0.05), near: 0.05 },
    ];
    this.help = [['Z / S', 'Gaz / frein (ABS)'], ['Q / D', 'Pencher et tourner'], ['Boîte', 'Automatique, 6 rapports']];
  }
  get pos() { return this.b.pos; } get vel() { return this.b.vel; }
  spawn(at) {
    const b = this.b; b.place(at.x, at.y, at.z, at.quat ? yawOf(at.quat) : at.yaw);
    b.fwd(_f); if (at.vel) b.vel.copy(at.vel); else b.vel.set(0, 0, 0);
    if (b.grounded) b.vel.y = 0;
    this.v = b.vel.x * _f.x + b.vel.z * _f.z; this.lean = 0; this.kap = 0; this.u = 0; this.gear = 1; this.fallT = 0;
    if (!b.grounded && at.quat) this.quat.copy(at.quat); else groundQuat(b.yaw, b.n, this.quat);
    this.root.quaternion.copy(this.quat);
  }
  step(dt, K) {
    const b = this.b, bk = this.bk, ctx = this.ctx;
    const thr = K.down('KeyW', 'ArrowUp') ? 1 : 0, brk = K.down('KeyS', 'ArrowDown') ? 1 : 0, steer = (K.down('KeyA', 'ArrowLeft') ? 1 : 0) - (K.down('KeyD', 'ArrowRight') ? 1 : 0);
    this.thr = thr;
    if (this.fallT > 0) { // chute : la moto glisse sur le flanc puis se relève
      this.fallT -= dt; this.v = Math.max(0, this.v - 12 * dt); this.lean = ease(this.lean, 1.35 * Math.sign(this.lean || 1), 6, dt);
      b.fwd(_f); b.vel.x = _f.x * this.v; b.vel.z = _f.z * this.v; b.move(dt);
      if (this.fallT <= 0) { this.lean = 0; ctx.toast('Remise en selle'); }
      return;
    }
    if (b.grounded) {
      b.sampleNormal(b.n); b.fwd(_f);
      const s = ctx.world.surfaceAt(b.pos.x, b.pos.z), mu = s === 1 ? 1.2 : s === 2 || s === 8 ? 0.55 : 0.75;
      const v = this.v, g = this.gear, gt = bk.gtop[g - 1];
      const wheelRpm = bk.red * Math.min(1.2, v / gt), clutch = g === 1 && v < 8;
      this.rpm = lerp(this.rpm, clutch ? Math.max(wheelRpm, thr > 0 ? bk.red * 0.55 : 1300) : Math.max(1300, wheelRpm), Math.min(1, dt * 18));
      const p = bk.pw * powerShape(this.rpm / bk.pk * 0.96);
      let Fd = thr * p / Math.max(v, g === 1 ? 7 : 3); if (this.rpm > bk.red * 1.01) Fd = 0;
      Fd = Math.min(Fd, mu * bk.mass * G * 0.78, bk.mass * G * 1.25);
      this.brkS += (brk - this.brkS) * (1 - Math.exp(-dt / 0.045));
      const Fb = this.brkS * bk.mass * G * 1.4 * (mu / 1.2);
      const Fe = thr < 0.1 && !clutch ? bk.mass * G * 0.07 * clamp(this.rpm / bk.red, 0, 1) : 0;
      this.up += ((brk && v > 8 ? 1 : 0) - this.up) * Math.min(1, dt * 4);
      const aero = 0.5 * 1.2 * bk.cda * (1 + 1.1 * this.up) * v * v, roll = 0.012 * bk.mass * G + (s !== 1 ? bk.mass * G * 0.06 + v * 15 : 0);
      let a = (Fd - Fb - Fe - aero - roll) / bk.mass - G * slopeAlong(b.n, _f);
      if (v < 0.05 && a < 0 && !brk) a = Math.max(a, 0);
      if (brk && v < 0.3) { this.v = Math.max(-3, v - 3 * dt * (thr ? 0 : 1)); a = 0; }
      this.aT = (Fd - Fb - Fe) / bk.mass;
      this.v = Math.max(brk && v < 0.3 ? -3 : 0, v + a * dt);
      if (((this.rpm > bk.red * 0.955 && thr > 0.2) || this.rpm > bk.red * 1.03) && g < 6) this.gear = g + 1;
      else if (g > 1 && this.rpm < bk.red * (0.36 + 0.05 * g + (brk > 0.3 ? 0.12 : 0)) && brk + (thr < 0.1 ? 1 : 0) > 0) this.gear = g - 1;
      if (this.v < 2 && thr < 0.1) this.gear = 1;
      // direction : courbure limitée par l'adhérence (aide au pilotage toujours active)
      const k = 1 / (1 + Math.pow(this.v / 220, 2)), tau = 0.06 + 0.04 * Math.min(1, this.v / 40);
      this.u += (steer - this.u) * (1 - Math.exp(-dt / tau));
      const Kmax = Math.min(1 / 3.2, 1.6 * G * (mu / 1.2) / Math.max(this.v * this.v, 1));
      let kap = this.u * Kmax * k;
      const aT = Math.min(Math.abs(this.aT), mu * G * 1.45), amax = Math.sqrt(Math.max(0.01, (mu * G * 1.45) ** 2 - aT * aT * 0.9));
      if (this.v * this.v * Math.abs(kap) > amax) kap = Math.sign(kap) * amax / Math.max(this.v * this.v, 1);
      this.kap = lerp(this.kap, kap, Math.min(1, dt * 20));
      const alat = this.v * this.v * this.kap;
      b.yaw += this.v * this.kap * dt * (this.v < 0 ? -1 : 1);
      this.lean = ease(this.lean, Math.atan(alat / G), 9, dt);
      const pt = clamp(a / G, -1.8, 0.5) * 0.1; this.pitch = ease(this.pitch, pt, 7, dt);
      this.steerV = lerp(this.steerV, clamp(Math.atan(1.45 * this.kap) * 1.5 + this.u * 0.18 / (1 + Math.abs(this.v) / 10), -0.6, 0.6), Math.min(1, dt * 12));
      b.fwd(_f); b.vel.x = _f.x * this.v; b.vel.z = _f.z * this.v;
      groundQuat(b.yaw, b.n, this.quat);
    } else {
      this.lean = ease(this.lean, 0, 2, dt);
      this.v = Math.hypot(b.vel.x, b.vel.z);
      this.pitch = ease(this.pitch, clamp(-b.vel.y * 0.02, -0.3, 0.3), 2, dt);
    }
    const wasAir = !b.grounded;
    const ev = b.move(dt);
    if (wasAir && b.grounded && ev.land > 12) this.fall('Réception trop dure !');
    if (ev.hit > 8) this.fall('Choc !');
    else if (ev.hit > 2) { this.v *= 0.6; ctx.sfx.impact(ev.hit); }
    this.v = Math.sign(this.v || 1) * Math.min(Math.abs(this.v), Math.hypot(b.vel.x, b.vel.z) + 0.5);
    this.spin += this.v / 0.31 * dt;
    if (b.water > 1) ctx.respawnNearRoad('À l\'eau !');
  }
  fall(msg) { if (this.fallT > 0) return; this.fallT = 1.6; this.ctx.trick('Chute !', msg, 0); this.ctx.sfx.impact(25); this.ctx.shake(0.8); this.lean = this.lean || 0.1; }
  visual(dt) {
    const m = this.m, b = this.b;
    this.root.position.copy(b.pos); this.root.quaternion.slerp(this.quat, 1 - Math.exp(-dt * 16));
    m.leanG.rotation.z = -this.lean; m.pitchG.rotation.x = -this.pitch; m.rider.position.x = this.lean * 0.22;
    m.st.rotation.y = this.steerV;
    m.fw.userData.spin.rotation.x = this.spin; m.rw.userData.spin.rotation.x = this.spin;
    if (m.dash) m.dash({ v: this.v, rpm: this.rpm, gear: this.gear }, this.bk);
  }
  hud() { return { speed: Math.abs(this.v), lines: [['RAPPORT', this.v < 1 && this.rpm < 2000 ? 'N' : this.gear], ['RÉGIME', Math.round(this.rpm / 100) * 100 + ' tr/min']] }; }
  audio() { return { kind: 'moto', rpm: this.rpm / this.bk.red, load: this.thr }; }
  upright() { const b = this.b; b.place(b.pos.x, b.pos.y + 0.5, b.pos.z, b.yaw); this.v = 0; this.fallT = 0; this.lean = 0; groundQuat(b.yaw, b.n, this.quat); }
}

/* ===================== Kukirin G6 ===================== */
const TIRE_G = 24, WB_A = 0.6, WB_B = 0.6, YAW_K2 = 0.5, HAND_MU = 0.65, DRIFT_BETA = 0.55, WHEELIE_MAX = 75 * Math.PI / 180;
export class Kukirin {
  constructor(ctx, kukModel) {
    this.ctx = ctx; this.cat = 'bike';
    this.m = kukModel.buildScooter('g6', '#16d3d3'); this.root = wrap(this.m);
    this.st = { vmax: 120 / 3.6, acc: 8.2, brake: 14, grip: 8.6 };
    this.b = new GroundBody(ctx.world, { wb: 1.2, track: 0.4, circles: [[0.5, 0.35], [-0.5, 0.35]], height: 1.6, step: 0.32 });
    this.quat = new Q();
    Object.assign(this, { h: 0, vx: 0, vz: 0, steer: 0, dl: 0, pab: 0, yr: 0, rs: false, wheelie: 0, wv: 0, lean: 0, spin: 0, fallT: 0, slip: 0, thr: 0 });
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: 3.6, h: 1.5, look: 1.2 },
      { name: 'Éloignée', type: 'chase', dist: 7, h: 2.6, look: 1.1 },
      { name: 'Première personne', type: 'attach', off: new V3(0, 1.85, 0.05), near: 0.05, tilt: -0.25 },
    ];
    this.help = [['Z / S', 'Accélérer / freiner'], ['Q / D', 'Tourner'], ['Espace', 'Frein arrière : dérapage'], ['Maj', 'Wheelie (gaz pour le tenir)']];
  }
  get pos() { return this.b.pos; } get vel() { return this.b.vel; }
  spawn(at) {
    const b = this.b; b.place(at.x, at.y, at.z, at.quat ? yawOf(at.quat) : at.yaw); this.h = b.yaw + Math.PI;
    if (at.vel) b.vel.copy(at.vel); else b.vel.set(0, 0, 0);
    if (b.grounded) b.vel.y = 0;
    this.vx = b.vel.x; this.vz = b.vel.z;
    this.steer = 0; this.dl = 0; this.yr = 0; this.rs = false; this.wheelie = 0; this.wv = 0; this.fallT = 0;
    if (!b.grounded && at.quat) this.quat.copy(at.quat); else groundQuat(b.yaw, b.n, this.quat);
    this.root.quaternion.copy(this.quat);
  }
  step(dt, K) {
    const b = this.b, st = this.st, ctx = this.ctx;
    const fwdK = K.down('KeyW', 'ArrowUp'), backK = K.down('KeyS', 'ArrowDown'), hand = K.down('Space');
    const turnInput = (K.down('KeyA', 'ArrowLeft') ? 1 : 0) - (K.down('KeyD', 'ArrowRight') ? 1 : 0);
    this.thr = fwdK ? 1 : 0;
    if (this.fallT > 0) {
      this.fallT -= dt; this.vx *= Math.exp(-dt * 3); this.vz *= Math.exp(-dt * 3); this.lean = ease(this.lean, 1.4, 6, dt);
      b.vel.x = this.vx; b.vel.z = this.vz; b.move(dt);
      if (this.fallT <= 0) { this.lean = 0; ctx.toast('Trottinette relevée'); }
      return;
    }
    if (b.grounded) {
      b.sampleNormal(b.n);
      const mu = st.grip / 5.5 * (ctx.world.surfaceAt(b.pos.x, b.pos.z) === 1 ? 1 : 0.7);
      this.steer += (turnInput - this.steer) * Math.min(1, dt * (turnInput ? 7 : 11));
      // wheelie : Maj lève l'avant, les gaz le tiennent, le frein le rabat
      if (K.hit('ShiftLeft') || K.hit('ShiftRight')) { if (this.wheelie < 0.01 && Math.hypot(this.vx, this.vz) > 1) this.wv = 3.2; }
      if (this.wheelie > 0.002 || this.wv > 0) {
        let wa = -9 * Math.cos(this.wheelie); if (fwdK) wa += 9.7; if (backK) wa -= 16;
        this.wv += wa * dt; this.wheelie += this.wv * dt;
        if (this.wheelie >= WHEELIE_MAX) { this.wheelie = WHEELIE_MAX; if (this.wv > 0) this.wv = 0; }
        if (this.wheelie <= 0) { this.wheelie = 0; this.wv = 0; }
      }
      const lift = clamp(this.wheelie / 0.12, 0, 1), Nf = 0.5 * (1 - 0.75 * lift), Nr = 1 - Nf;
      const capF = Nf * mu * 0.92 * TIRE_G, capS = Nr * mu * 1.12 * TIRE_G, capK = capS * 0.72, CFs = Nf * mu * TIRE_G / 0.14, CRs = Nr * mu * TIRE_G / 0.14;
      const n = Math.max(2, Math.ceil(dt * 240)), h = dt / n;
      for (let s = 0; s < n; s++) {
        const sh = Math.sin(this.h), ch = Math.cos(this.h);
        let vf = this.vx * sh + this.vz * ch, vy = this.vx * ch - this.vz * sh, r = this.yr;
        const sp = Math.abs(vf);
        let fx = 0;
        if (fwdK && vf < st.vmax) { const q = clamp(vf / st.vmax, 0, 1); fx = st.acc * (0.5 + 0.5 * clamp((0.72 - q) / 0.48, 0, 1)); }
        const ymax = 2.15 / (1 + sp / 15) * (1 - 0.6 * lift);
        let dl = this.steer * Math.min(0.6, Math.atan(ymax * (WB_A + WB_B) / Math.max(sp, 1)));
        if (this.rs && sp > 3) {
          const beta = Math.atan2(vy, sp), ab = Math.abs(beta), bd = beta < 0 ? 1 : -1, db = (ab - this.pab) / h; this.pab = ab;
          let off;
          if (this.steer * bd > 0.1) { const tgt = (hand ? 1.1 : fx > 0 ? 1 : 0.4) * DRIFT_BETA * Math.abs(this.steer); off = bd * clamp(0.45 * (tgt - ab) - 0.07 * db, -0.35, 0.35); }
          else if (Math.abs(this.steer) > 0.1) off = Math.sign(this.steer) * 0.12;
          else off = bd * clamp(-0.25 * ab - 0.07 * db, -0.35, 0.35);
          dl = clamp(Math.atan2(vy + WB_A * r, sp) + off, -0.9, 0.9);
        } else this.pab = 0;
        this.dl += clamp(dl - this.dl, -12 * h, 12 * h); dl = this.dl;
        const cd = Math.cos(dl), sd = Math.sin(dl), vyf = vy + WB_A * r, lonF = vf * cd + vyf * sd, latF = -vf * sd + vyf * cd;
        const af = Math.atan2(latF, Math.max(Math.abs(lonF), 0.5)), wb = clamp((Math.hypot(vf, vy) - 2.5) / 2.5, 0, 1);
        const Fw = clamp(-CFs * af, -capF, capF), Ffx = -Fw * sd * wb, Ffy = Fw * cd;
        const vyr = vy - WB_B * r; let Frx = fx, Fry = 0;
        if (hand && sp > 0.8) { const mm = Math.hypot(vf, vyr) || 1, ck = capK * HAND_MU; Frx = -ck * vf / mm; Fry = -ck * vyr / mm; this.rs = true; }
        else {
          const ar = Math.atan2(vyr, Math.max(Math.abs(vf), 0.5));
          if (!this.rs) { Fry = -CRs * ar; if (Math.hypot(Frx, Fry) > capS && sp > 3) this.rs = true; else Fry = clamp(Fry, -capS, capS); }
          if (this.rs) {
            if (fx > 0) { const ws = 3 + 9 * fx / st.acc, mm = Math.hypot(ws, vyr); Frx = Math.min(capK * ws / mm, fx * 1.4); Fry = -capK * vyr / mm; }
            else { Frx = clamp(Frx, -capK * 0.92, capK * 0.92); Fry = -clamp(ar / 0.05, -1, 1) * Math.sqrt(capK * capK - Frx * Frx); }
            if (Math.abs(ar) < (fx > 0 ? 0.03 : 0.05) || sp < 2) this.rs = false;
          }
        }
        vf += (Frx + Ffx + r * vy) * h; vy += (Fry + Ffy - r * vf) * h; r += (WB_A * Ffy - WB_B * Fry) / YAW_K2 * h;
        if (backK) { if (vf > 0.6) vf -= st.brake * (lift > 0.5 ? 0.5 : 1) * h; else { vf -= 2.2 * h; if (vf < -2.6) vf = -2.6; } }
        if (vf > st.vmax) vf -= (vf - st.vmax) * Math.min(1, h * 1.5);
        vf -= vf * 0.035 * h + Math.sign(vf) * Math.min(Math.abs(vf), 0.35 * h);
        vf -= G * slopeAlong(b.n, _f.set(sh, 0, ch)) * h;
        if (wb < 1) { const rk = this.steer * ymax * clamp(sp / 2.5, 0, 1) * (vf < -0.2 ? -1 : 1); r = lerp(rk, r, wb); vy = lerp(vy * Math.exp(-14 * h), vy, wb); }
        this.h += r * h; this.yr = r;
        const s2 = Math.sin(this.h), c2 = Math.cos(this.h);
        this.vx = vf * s2 + vy * c2; this.vz = vf * c2 - vy * s2;
      }
      { const sh = Math.sin(this.h), ch = Math.cos(this.h), vf = this.vx * sh + this.vz * ch, vy = this.vx * ch - this.vz * sh; this.slip = Math.atan2(vy, Math.max(Math.abs(vf), 0.1)); }
      if (Math.abs(this.slip) > 1.35 && Math.hypot(this.vx, this.vz) > 11) this.fall('Tête-à-queue !');
      this.lean = ease(this.lean, clamp(-this.yr * Math.hypot(this.vx, this.vz) / G * 0.6, -0.6, 0.6), 8, dt);
    }
    b.yaw = this.h - Math.PI;
    b.vel.x = this.vx; b.vel.z = this.vz;
    const ev = b.move(dt);
    this.vx = b.vel.x; this.vz = b.vel.z;
    if (b.grounded) groundQuat(b.yaw, b.n, this.quat);
    if (ev.land > 10) this.fall('Réception trop dure !');
    if (ev.hit > 7) this.fall('Choc violent !');
    this.spin += Math.hypot(this.vx, this.vz) * dt;
    if (b.water > 1) ctx.respawnNearRoad('À l\'eau !');
  }
  fall(msg) { if (this.fallT > 0) return; this.fallT = 1.5; this.ctx.trick('Chute !', msg, 0); this.ctx.sfx.impact(20); this.ctx.shake(0.6); }
  visual(dt) {
    const d = this.m.userData;
    this.root.position.copy(this.b.pos); this.root.quaternion.slerp(this.quat, 1 - Math.exp(-dt * 16));
    d.tilt.rotation.set(-this.wheelie, 0, this.lean);
    for (const w of d.wheels) w.rotation.x = this.spin / w.userData.r;
    if (d.dg && (this._dt = (this._dt || 0) + dt) > 0.2) {
      this._dt = 0; const g = d.dg; g.fillStyle = '#05080b'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#e8f4ff'; g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.fillText(Math.round(Math.hypot(this.vx, this.vz) * 3.6), 128, 80);
      g.font = 'bold 18px Arial'; g.fillStyle = '#45f3dc'; g.fillText('km/h', 128, 110); d.displayTexture.needsUpdate = true;
    }
  }
  hud() { return { speed: Math.hypot(this.vx, this.vz), lines: this.rs ? [['GLISSE', Math.round(Math.abs(this.slip) * 57) + '°']] : null }; }
  audio() { return { kind: 'scooter', rpm: Math.hypot(this.vx, this.vz) / this.st.vmax, load: this.thr, slip: this.rs ? 0.6 : 0 }; }
  upright() { const b = this.b; b.place(b.pos.x, b.pos.y + 0.5, b.pos.z, b.yaw); this.vx = this.vz = 0; this.fallT = 0; this.lean = 0; this.wheelie = 0; groundQuat(b.yaw, b.n, this.quat); }
}

/* ===================== trottinette freestyle ===================== */
const PUSH = 4.2, MAX_PUSH = 7.8, MAX_SPEED = 22, SPIN_RATE = 9.5, FLIP_RATE = 7.6, WHIP_RATE = TAU / 0.3, BAR_RATE = TAU / 0.25;
export class Freestyle {
  constructor(ctx, Rider) {
    this.ctx = ctx; this.cat = 'bike';
    this.rider = Rider.create({ shirt: 0xf2b705, core: 0xf2b705 }); this.root = wrap(this.rider.root);
    this.b = new GroundBody(ctx.world, { wb: 0.55, track: 0.2, circles: [[0, 0.35]], height: 1.7, step: 0.25 });
    this.quat = new Q(); this.visQuat = new Q();
    this.s = {};
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: 4.3, h: 1.6, look: 1.0 },
      { name: 'Large', type: 'chase', dist: 7.8, h: 2.8, look: 0.9 },
      { name: 'Proche', type: 'chase', dist: 2.9, h: 1.15, look: 1.1 },
    ];
    this.help = [['Z', 'Pousser (accélérer)'], ['S', 'Freiner'], ['Q / D', 'Tourner · en l\'air : rotations'], ['Espace', 'Maintenir puis relâcher : sauter'],
      ['En l\'air Z / S', 'Flips avant / arrière'], ['J / U', 'Tailwhip / heelwhip'], ['K / I', 'Barspin / barspin inversé'], ['L', 'Grab (+ direction : X-up, superman, can-can…)']];
  }
  get pos() { return this.b.pos; } get vel() { return this.b.vel; }
  spawn(at) {
    const b = this.b; b.place(at.x, at.y, at.z, at.quat ? yawOf(at.quat) : at.yaw);
    if (at.vel) b.vel.copy(at.vel); else b.vel.set(0, 0, 0);
    if (b.grounded) b.vel.y = 0;
    this.s = { charge: 0, spin: 0, spinVel: 0, flip: 0, flipVel: 0, whipA: 0, whipT: 0, barA: 0, barT: 0, grab: null, grabW: 0, air: null, bailT: 0, pushT: 0, landT: 0, flipBlock: { up: false, down: false }, xupA: 0 };
    if (!b.grounded && at.quat) this.quat.copy(at.quat); else groundQuat(b.yaw, b.n, this.quat);
    this.root.quaternion.copy(this.quat);
    if (!b.grounded) this.goAir({ down: () => false });
    this.rider.setTarget([]); this.rider.snap();
  }
  step(dt, K) {
    const b = this.b, s = this.s, ctx = this.ctx, v = b.vel;
    const up = K.down('KeyW', 'ArrowUp'), down = K.down('KeyS', 'ArrowDown'), sx = (K.down('KeyA', 'ArrowLeft') ? 1 : 0) - (K.down('KeyD', 'ArrowRight') ? 1 : 0);
    s.landT = Math.max(0, s.landT - dt);
    const wasGround = b.grounded;
    if (s.bailT > 0) {
      s.bailT -= dt; v.x *= Math.exp(-dt * 4); v.z *= Math.exp(-dt * 4); b.move(dt);
      if (s.bailT <= 0) { s.spin = s.flip = s.whipA = s.whipT = s.barA = s.barT = 0; s.grab = null; s.grabW = 0; s.air = null; }
      return;
    }
    if (b.grounded && !s.air) {
      b.sampleNormal(b.n); b.fwd(_f); b.left(_l);
      if (K.down('Space')) s.charge = Math.min(0.45, s.charge + dt);
      else if (s.charge > 0) {
        const k = 0.55 + 0.45 * (s.charge / 0.45); s.charge = 0;
        v.y = 4.3 * k + Math.max(0, v.y); b.grounded = false; ctx.sfx.whoosh();
      }
      let vf = v.x * _f.x + v.z * _f.z, vl = v.x * _l.x + v.z * _l.z;
      const speed = Math.hypot(vf, vl);
      if (sx) b.yaw += sx * (2.6 - Math.min(1.35, speed * 0.11)) * dt * (vf < 0 ? -1 : 1);
      vl *= Math.exp(-9 * dt);
      s.pushT = up && vf < MAX_PUSH ? s.pushT + dt : 0;
      if (up && vf < MAX_PUSH) vf += PUSH * dt;
      if (down) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6.5 * dt);
      vf -= G * slopeAlong(b.n, _f) * dt;
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.16 + 0.0026 * vf * vf) * dt);
      vf = clamp(vf, -MAX_SPEED, MAX_SPEED);
      b.fwd(_f); b.left(_l);
      v.x = _f.x * vf + _l.x * vl; v.z = _f.z * vf + _l.z * vl;
      groundQuat(b.yaw, b.n, this.quat);
    }
    const ev = b.move(dt);
    if (wasGround && !b.grounded) this.goAir(K);
    if (!b.grounded && s.air) this.airStep(dt, K, up, down, sx);
    if (b.grounded && s.air) this.land(ev.land);
    if (ev.hit > 5.5 && !s.air) this.bail('Dans le mur !');
    if (b.water > 0.6) ctx.respawnNearRoad('À l\'eau !');
    this.rider.spinWheels(Math.hypot(v.x, v.z) * dt * (b.grounded ? 1 : 0));
  }
  goAir(K) {
    const s = this.s;
    s.air = { spin: 0, flip: 0, whipsT: 0, whipsH: 0, barsF: 0, barsB: 0, grabs: {}, airTime: 0, height: 0, startY: this.b.pos.y, vert: false, fromRail: false, launchName: null, landName: null, drop: 0 };
    s.flipBlock = { up: K.down('KeyW', 'ArrowUp'), down: K.down('KeyS', 'ArrowDown') };
  }
  airStep(dt, K, up, down, sx) {
    const s = this.s, a = s.air;
    a.airTime += dt; a.height = Math.max(a.height, this.b.pos.y - a.startY);
    const grabbing = K.down('KeyL');
    if (s.flipBlock.up && !up) s.flipBlock.up = false;
    if (s.flipBlock.down && !down) s.flipBlock.down = false;
    let py = (up ? 1 : 0) - (down ? 1 : 0);
    if ((py > 0 && s.flipBlock.up) || (py < 0 && s.flipBlock.down)) py = 0;
    if (grabbing && !s.grab) { s.grab = py > 0.5 ? 'xup' : py < -0.5 ? 'superman' : sx > 0.5 ? 'canCan' : sx < -0.5 ? 'tuckNoHander' : 'noHander'; this.ctx.sfx.whoosh(); }
    if (!grabbing && s.grab && s.grabW < 0.05) s.grab = null;
    s.grabW += ((grabbing ? 1 : 0) - s.grabW) * (1 - Math.exp(-(grabbing ? 9 : 11) * dt));
    if (s.grab && s.grabW > 0.7) a.grabs[s.grab] = (a.grabs[s.grab] || 0) + dt;
    const spinIn = grabbing ? 0 : sx;
    if (spinIn) { s.spinVel += (spinIn * SPIN_RATE - s.spinVel) * (1 - Math.exp(-14 * dt)); s.spin += s.spinVel * dt; }
    else if (s.spinVel) {
      const dir = Math.sign(s.spinVel), vv = Math.max(5, Math.abs(s.spinVel)), next = Math.ceil((s.spin * dir) / Math.PI - 0.08) * Math.PI * dir, ns = s.spin + dir * vv * dt;
      if ((next - ns) * dir <= 0) { s.spin = next; s.spinVel = 0; } else { s.spin = ns; s.spinVel = dir * vv; }
    }
    a.spin = s.spin;
    if (!grabbing && py) s.flipVel = py * FLIP_RATE;
    if (s.flipVel) {
      const dir = Math.sign(s.flipVel); s.flip += s.flipVel * dt;
      if (!py || grabbing) { const next = Math.ceil((s.flip * dir) / TAU - 0.03) * TAU * dir; if ((next - s.flip) * dir <= 0) { s.flip = next; s.flipVel = 0; } }
    }
    a.flip = s.flip;
    const ok = (t, A) => Math.abs(t - A) < TAU * 1.05;
    if (K.hit('KeyJ') && ok(s.whipT, s.whipA)) { s.whipT += TAU; a.whipsT++; this.ctx.sfx.whoosh(); }
    if (K.hit('KeyU') && ok(s.whipT, s.whipA)) { s.whipT -= TAU; a.whipsH++; this.ctx.sfx.whoosh(); }
    if (K.hit('KeyK') && ok(s.barT, s.barA)) { s.barT += TAU; a.barsF++; this.ctx.sfx.whoosh(); }
    if (K.hit('KeyI') && ok(s.barT, s.barA)) { s.barT -= TAU; a.barsB++; this.ctx.sfx.whoosh(); }
    s.whipA += clamp(s.whipT - s.whipA, -WHIP_RATE * dt, WHIP_RATE * dt);
    s.barA += clamp(s.barT - s.barA, -BAR_RATE * dt, BAR_RATE * dt);
  }
  land(impact) {
    const s = this.s, b = this.b;
    let reason = null;
    if (Math.abs(s.whipT - s.whipA) > 0.5) reason = 'Tailwhip pas fini';
    else if (Math.abs(s.barT - s.barA) > 0.75) reason = 'Barspin pas rattrapé';
    else if (s.grabW > 0.45) reason = 'Lâché trop tard';
    else if (Math.abs(wrapPi(s.flip)) > 0.8) reason = 'Flip pas fini';
    else if (Math.abs(Math.sin(s.spin)) > 0.6) reason = 'Réception de travers';
    else if (impact > 12.5) reason = 'Réception trop dure';
    if (reason) { this.bail(reason); return; }
    const fakie = Math.cos(s.spin) < 0;
    const t = Tricks.scoreAir(s.air);
    if (t) this.ctx.trick(t.name + (fakie ? ' (fakie)' : ''), '+' + t.pts.toLocaleString('fr-FR'), t.pts);
    s.air = null; s.spin = 0; s.flip = 0; s.flipVel = 0; s.spinVel = 0; s.whipA = s.whipT = 0; s.barA = s.barT = 0; s.grab = null; s.grabW = 0;
    s.landT = Math.min(0.35, 0.08 + impact * 0.03);
    groundQuat(b.yaw, b.n, this.quat);
  }
  bail(reason) {
    const s = this.s; if (s.bailT > 0) return;
    s.bailT = 1.3; s.air = null; this.ctx.trick('Chute !', reason, 0); this.ctx.sfx.impact(18);
  }
  visual(dt) {
    const s = this.s, r = this.rider, b = this.b;
    this.root.position.copy(b.pos);
    _q.setFromAxisAngle(_f.set(0, 1, 0), s.spin);
    this.visQuat.copy(this.quat).multiply(_q);
    this.root.quaternion.slerp(this.visQuat, 1 - Math.exp(-dt * 18));
    r.whip.rotation.y = s.whipA;
    s.xupA += ((s.grab === 'xup' ? Math.PI * 0.95 * s.grabW : 0) - s.xupA) * (1 - Math.exp(-14 * dt));
    r.bar.rotation.y = s.barA + s.xupA;
    r.com.rotation.set(s.bailT > 0 ? -1.35 * Math.min(1, (1.3 - s.bailT) / 0.45) : s.flip, 0, 0);
    const names = [];
    if (s.bailT > 0) names.push(['bail', 1]);
    else if (s.air) {
      names.push(['air', 1]);
      if (Math.abs(s.whipT - s.whipA) > 0.15 || Math.abs(s.flipVel) > 0.1) names.push(['tuck', 1]);
      if (Math.abs(s.barT - s.barA) > 0.25) names.push(['release', 1]);
      if (s.grab) names.push([s.grab, s.grabW]);
      if (s.air.airTime < 0.12) names.push(['crouch', 1 - s.air.airTime / 0.12]);
    } else {
      if (s.pushT > 0) names.push(['push', 0.5 + 0.5 * Math.sin(s.pushT * 7)]);
      names.push(['crouch', Math.max(s.charge / 0.45, s.landT / 0.35)]);
    }
    r.setTarget(names); r.update(dt, s.air ? 20 : 15);
  }
  hud() { return { speed: Math.hypot(this.b.vel.x, this.b.vel.z), gauge: this.s.charge > 0 ? { label: 'SAUT', value: this.s.charge / 0.45, active: true } : null }; }
  audio() { return { kind: 'kick', rpm: 0, load: 0 }; }
  upright() { const b = this.b; b.place(b.pos.x, b.pos.y + 0.3, b.pos.z, b.yaw); this.spawn({ x: b.pos.x, y: b.pos.y, z: b.pos.z, yaw: b.yaw }); }
}

/* Voitures : Tesla Roadster (propulseurs, boost, figures), voiture de drift (Drift King), supercar V12.
   Adhérence et glisse d'après le modèle de Drift King, propulseurs et figures d'après la Tesla. */
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';
import { G, V3, Q, UP, GroundBody, groundQuat, yawOf, ease, AirTricks } from './base.js';

const SPECS = {
  tesla: { acc: 18, vmax: 75, brake: 32, rev: 11, vrev: 20, grip: 34, loose: 0.12, steerYaw: 2.4, handbrake: false, boost: true, thrusters: true, wb: 2.62, track: 1.72, sound: 'electric' },
  drift: { acc: 22, vmax: 58, brake: 30, rev: 10, vrev: 15, grip: 24, loose: 0.62, steerYaw: 2.9, handbrake: true, wb: 2.65, track: 1.84, sound: 'car', drift: true },
  super: { acc: 25, vmax: 96, brake: 38, rev: 10, vrev: 18, grip: 36, loose: 0.22, steerYaw: 2.3, handbrake: true, wb: 2.8, track: 1.75, sound: 'v12', drift: true },
};
const PAINTS = {
  tesla: [['Rouge multicouche', 0x9a0a10], ['Blanc nacré', 0xe8e8e6], ['Noir intense', 0x07080a], ['Argent vif', 0x8f949b], ['Bleu outremer', 0x0f2a6b], ['Vert néon', 0x1f8a3c]],
  drift: [['Turquoise', 0x1fb5b0], ['Orange', 0xf06a1a], ['Blanc', 0xe9e9e6], ['Violet', 0x6a2bbf], ['Noir', 0x111214]],
  super: [['Jaune Modena', 0xf2b705], ['Rouge course', 0xc0101a], ['Vert lime', 0x7ccf1a], ['Gris titane', 0x5c6168], ['Bleu électrique', 0x1a4fd6], ['Blanc', 0xeeeeea]],
};
const _f = new V3(), _l = new V3(), _t = new V3(), _n = new V3(), _q = new Q(), _q2 = new Q(), _up = new V3();

export class Car {
  constructor(ctx, kind, model) {
    this.ctx = ctx; this.kind = kind; this.S = SPECS[kind]; this.m = model; this.root = model.root;
    this.b = new GroundBody(ctx.world, { wb: this.S.wb, track: this.S.track, circles: [[1.45, 1.05], [-1.35, 1.05]], height: 1.3 });
    this.quat = new Q(); this.visQuat = new Q(); this.visPos = new V3(); this.angVel = new V3();
    this.vf = 0; this.vl = 0; this.om = 0; this.steer = 0; this.fuel = 100; this.idle = 0; this.boosting = false; this.thrusting = false;
    this.spinA = 0; this.accLong = 0; this.lastVF = 0; this.flipT = 0; this.spaceWas = false;
    this.tricks = new AirTricks(); this.D = { t: 0, pts: 0, mult: 1, idle: 0 };
    this.paintIdx = 0; this.lightsOn = false;
    const cockpit = model.cockpit || (model.cockpitCam ? model.cockpitCam : new V3(-0.36, 1.1, 0));
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: 7.2, h: 2.3, look: 1.1 },
      { name: 'Éloignée', type: 'chase', dist: 13, h: 4.2, look: 1.2 },
      { name: 'Cockpit', type: 'attach', off: cockpit.clone(), near: 0.08 },
    ];
    this.help = [
      ['Z / S', 'Accélérer / freiner, marche arrière'], ['Q / D', 'Tourner'],
      ...(this.S.handbrake ? [['Espace', 'Frein à main (drift)']] : []),
      ...(this.S.boost ? [['Maj', 'Boost (sol et air)']] : []),
      ...(this.S.thrusters ? [['Espace', 'Propulseurs : décoller dans l\'axe du toit'], ['En l\'air', 'Z/S tangage · Q/D rotation · A/E tonneaux']] : []),
      ['K', 'Couleur de la peinture'], ['L', 'Phares'],
    ];
    this.cat = 'car';
  }
  get pos() { return this.b.pos; }
  get vel() { return this.b.vel; }
  spawn(at) {
    const b = this.b;
    b.place(at.x, at.y, at.z, at.quat ? yawOf(at.quat) : at.yaw);
    if (at.vel) b.vel.copy(at.vel); else b.vel.set(0, 0, 0);
    if (b.grounded) b.vel.y = 0;
    b.fwd(_f); b.left(_l);
    this.vf = b.vel.x * _f.x + b.vel.z * _f.z; this.vl = b.vel.x * _l.x + b.vel.z * _l.z; this.om = 0; this.steer = 0; this.fuel = 100; this.angVel.set(0, 0, 0);
    if (!b.grounded && at.quat) this.quat.copy(at.quat); else groundQuat(b.yaw, b.n, this.quat);
    this.visQuat.copy(this.quat); this.visPos.copy(b.pos);
    this.tricks.reset(); this.flipT = 0;
  }
  onKey(code) {
    if (code === 'KeyK') { const P = PAINTS[this.kind]; this.paintIdx = (this.paintIdx + 1) % P.length; this.m.mats ? this.m.mats.paint.color.setHex(P[this.paintIdx][1]) : this.m.setPaint(P[this.paintIdx][1]); this.ctx.toast(P[this.paintIdx][0]); }
    if (code === 'KeyL') { this.lightsForced = !this.lightsForced; this.ctx.toast(this.lightsForced ? 'Phares allumés' : 'Phares automatiques'); }
  }
  step(dt, K) {
    const S = this.S, b = this.b, v = b.vel, ctx = this.ctx;
    const thr = K.down('KeyW', 'ArrowUp') ? 1 : 0, brk = K.down('KeyS', 'ArrowDown') ? 1 : 0;
    const st = (K.down('KeyA', 'ArrowLeft') ? 1 : 0) - (K.down('KeyD', 'ArrowRight') ? 1 : 0);
    const hb = S.handbrake && K.down('Space');
    const wantBoost = S.boost && K.down('ShiftLeft', 'ShiftRight'), wantThrust = S.thrusters && K.down('Space');
    // jauge de la Tesla
    this.boosting = wantBoost && this.fuel > 0.5; this.thrusting = wantThrust && this.fuel > 0.5;
    if (this.boosting) this.fuel -= 20 * dt; if (this.thrusting) this.fuel -= 26 * dt;
    if (this.boosting || this.thrusting) this.idle = 0; else this.idle += dt;
    if (this.idle > 0.7) this.fuel += 17 * dt;
    this.fuel = clamp(this.fuel, 0, 100);

    if (b.grounded && this.flipT <= 0) {
      b.sampleNormal(b.n);
      const n = b.n;
      b.fwd(_f); b.left(_l);
      let vf = v.x * _f.x + v.z * _f.z, vl = v.x * _l.x + v.z * _l.z;
      const sp = Math.hypot(vf, vl);
      if (thr && !brk) vf += (vf < -0.5 ? S.brake : S.acc * (1 - Math.max(0, vf) / S.vmax * 0.85)) * dt;
      if (brk && !thr) { vf -= (vf > 1 ? S.brake : S.rev) * dt; vf = Math.max(vf, -S.vrev); }
      if (!thr && !brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.4 + 0.0005 * vf * vf) * dt);
      if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 5 * dt);
      if (this.boosting) vf = Math.min(Math.max(vf, 0) + 30 * dt, Math.max(vf, 128));
      if (vf > S.vmax && !this.boosting) vf -= (vf - S.vmax) * 0.6 * dt;
      vf -= vf * Math.abs(vf) * 0.00025 * dt; vf -= Math.sign(vf) * Math.abs(vl) * 0.28 * dt;
      // pente : la gravité freine en montée et accélère en descente
      const slopeF = -(n.x * _f.x + n.z * _f.z) / Math.max(0.3, n.y), slopeL = -(n.x * _l.x + n.z * _l.z) / Math.max(0.3, n.y);
      vf -= G * slopeF * dt; vl -= G * slopeL * dt * 0.5;
      // adhérence latérale (Drift King) : moins de grip aux gaz, frein à main = glisse
      const surf = ctx.world.surfaceAt(b.pos.x, b.pos.z), offRoad = surf !== 1;
      const slip = Math.atan2(Math.abs(vl), Math.abs(vf) + 0.5);
      let mg = S.grip * (offRoad ? 0.72 : 1) * (1 - S.loose * thr * Math.min(1, sp / 26));
      if (hb) mg = 6; mg *= 1 + Math.max(0, slip - 1) * 4;
      vl += clamp(-vl * 14, -mg, mg) * dt;
      // direction
      this.steer += (st - this.steer) * Math.min(1, dt * (st ? 10 : 13));
      const dir = vf >= -0.5 ? 1 : -1, Y = S.steerYaw / (1 + sp / 22) * Math.min(1, sp / 4);
      const wt = this.steer * Y * dir * (hb ? 1.4 : 1) + 0.05 * vl * (1 - 0.75 * thr) * (hb ? 0.4 : 1) * (S.drift ? 1 : 0.4);
      this.om += (wt - this.om) * Math.min(1, dt * (hb ? 5 : 9));
      b.yaw += this.om * dt;
      b.fwd(_f); b.left(_l);
      v.x = _f.x * vf + _l.x * vl; v.z = _f.z * vf + _l.z * vl;
      this.accLong = (vf - this.lastVF) / dt; this.lastVF = vf; this.vf = vf; this.vl = vl;
      groundQuat(b.yaw, n, _q); this.quat.slerp(_q, Math.min(1, dt * 20));
      // décollage par les propulseurs
      if (this.thrusting && !this.spaceWas) { v.addScaledVector(_up.set(0, 1, 0).applyQuaternion(this.quat), 5.5); b.grounded = false; this.angVel.set(0, 0, 0); this.tricks.start(b.pos.y); }
    } else if (!b.grounded) {
      // en l'air : rotations pilotées pour la Tesla, sinon légère stabilisation
      if (!this.tricks.active) this.tricks.start(b.pos.y);
      const T = this.tricks; T.t += b.airT > 0 ? dt : 0; T.maxH = Math.max(T.maxH, b.pos.y - T.y0);
      if (S.thrusters) {
        const tx = (brk - thr) * 3.2, ty = st * 2.6, tz = ((K.down('KeyQ') ? 1 : 0) - (K.down('KeyE') ? 1 : 0)) * 4.6, k = 1 - Math.exp(-dt * 7);
        this.angVel.x = lerp(this.angVel.x, tx, k); this.angVel.y = lerp(this.angVel.y, ty, k); this.angVel.z = lerp(this.angVel.z, tz, k);
        if (this.boosting) v.addScaledVector(_f.set(0, 0, -1).applyQuaternion(this.quat), 26 * dt);
      } else this.angVel.multiplyScalar(Math.exp(-dt * 1.5));
      const w = this.angVel.length();
      if (w > 1e-4) { _q.setFromAxisAngle(_t.copy(this.angVel).divideScalar(w), w * dt); this.quat.multiply(_q).normalize(); }
      T.roll += this.angVel.z * dt; T.pitch += this.angVel.x * dt; T.yaw += this.angVel.y * dt;
      if (!S.thrusters) { // les voitures normales se remettent doucement à plat
        _up.set(0, 1, 0).applyQuaternion(this.quat); _q2.setFromUnitVectors(_up, UP); _q.identity().slerp(_q2, Math.min(1, dt * 0.35)); this.quat.premultiply(_q);
      }
      b.yaw = yawOf(this.quat);
      this.vf = _f.set(0, 0, -1).applyQuaternion(this.quat).dot(v);
      this.steer = lerp(this.steer, 0, 1 - Math.exp(-dt * 5));
    }
    if (this.thrusting) v.addScaledVector(_up.set(0, 1, 0).applyQuaternion(this.quat), 26 * dt);
    this.spaceWas = wantThrust;
    v.multiplyScalar(1 - Math.min(0.5, 0.00025 * v.length() * dt));
    const wasAir = !b.grounded;
    const ev = b.move(dt);
    if (wasAir && b.grounded) this.land(ev.land);
    if (ev.hit > 9) { ctx.shake(Math.min(1, ev.hit / 30)); ctx.sfx.impact(ev.hit); if (this.tricks.active && !b.grounded) this.crashTrick(); }
    // voiture sur le toit : on la remet sur ses roues
    if (this.flipT > 0) { this.flipT -= dt; v.multiplyScalar(Math.exp(-dt * 3)); if (this.flipT <= 0) { b.sampleNormal(b.n); groundQuat(b.yaw, b.n, this.quat); b.pos.y += 0.6; ctx.toast('Redressement'); } }
    if (b.water > 1.2) ctx.respawnNearRoad('À l\'eau !');
    this.driftScore(dt, hb);
  }
  land(impact) {
    const b = this.b; b.sampleNormal(b.n);
    _up.set(0, 1, 0).applyQuaternion(this.quat);
    const up = _up.dot(b.n);
    if (up < 0.35) { this.flipT = 1.2; this.crashTrick(); this.ctx.sfx.impact(12); return; }
    if (impact > 10) { this.ctx.shake(Math.min(1, impact / 25)); this.ctx.sfx.impact(impact); }
    const T = this.tricks;
    if (T.active && T.t > 0.6 && this.S.thrusters) {
      const info = T.info(), perfect = up > 0.94, gained = info.pts * (perfect ? 2 : 1);
      this.ctx.trick(perfect ? 'Atterrissage parfait x2' : info.name, `${perfect ? info.name + ' · ' : ''}+${gained.toLocaleString('fr-FR')}`, gained);
    } else if (T.active && T.t > 1.2) this.ctx.trick(`Saut de ${T.t.toFixed(1)} s`, `${Math.round(Math.hypot(b.vel.x, b.vel.z) * 3.6)} km/h`, 0);
    T.reset(); this.angVel.set(0, 0, 0);
    groundQuat(this.b.yaw, b.n, this.quat);
  }
  crashTrick() { if (this.tricks.active && this.tricks.t > 0.5) this.ctx.trick('Crash !', 'Figure perdue', 0); this.tricks.reset(); }
  driftScore(dt, hb) {
    if (!this.S.drift) return;
    const D = this.D, sp = Math.hypot(this.vf, this.vl), beta = Math.atan2(Math.abs(this.vl), Math.abs(this.vf));
    const drifting = this.b.grounded && sp > 7 && this.vf > 0 && beta > 0.22;
    if (drifting) { D.t += dt; D.idle = 0; D.mult = 1 + Math.min(4, Math.floor(D.t / 2) * 0.5); D.pts += dt * sp * beta * 20 * D.mult; }
    else if (D.pts > 0 || D.t > 0) {
      D.idle += dt;
      if (D.idle > 0.8) { if (D.t > 0.8 && D.pts > 5) this.ctx.trick('Drift +' + Math.round(D.pts).toLocaleString('fr-FR'), `${D.t.toFixed(1)} s · x${D.mult.toFixed(1)}`, Math.round(D.pts)); D.pts = 0; D.t = 0; }
    }
    if (this.b.ev.hit > 4 && D.pts > 5) { this.ctx.trick('Raté !', 'Drift perdu', 0); D.pts = 0; D.t = 0; }
    this.ctx.driftHud(D.pts > 5 && D.t > 0.3 ? D : null);
  }
  visual(dt, env) {
    const m = this.m, b = this.b;
    this.visPos.copy(b.pos); this.visQuat.slerp(this.quat, 1 - Math.exp(-dt * 14));
    m.root.position.copy(this.visPos); m.root.quaternion.copy(this.visQuat);
    const lat = clamp(this.vf * this.om, -40, 40), lon = clamp(this.accLong, -40, 40);
    if (m.body) {
      m.body.rotation.z = ease(m.body.rotation.z, b.grounded ? -lat * 0.0022 : 0, 6, dt);
      m.body.rotation.x = ease(m.body.rotation.x, b.grounded ? lon * 0.0016 : 0, 6, dt);
    }
    this.spinA += this.vf * dt;
    for (const w of m.wheels) {
      w.spin.rotation.x = -this.spinA / w.r * (w.flip || 1);
      if (w.front) w.steer.rotation.y = this.steer * 0.45;
      w.mount.position.y = ease(w.mount.position.y, w.baseY + (b.grounded ? 0 : -0.08), 20, dt);
    }
    if (m.yoke) m.yoke.rotation.z = this.steer * 1.4;
    // propulseurs et phares de la Tesla
    if (m.plumes) {
      const bp = this.boosting ? 1 : 0, tp = this.thrusting ? 1 : 0;
      for (const pl of m.plumes.rear) { pl.material.opacity = ease(pl.material.opacity, bp * 0.8, 20, dt); pl.scale.set(1, 0.6 + Math.random() * 0.5, 1); pl.visible = pl.material.opacity > 0.01; }
      for (const pl of m.plumes.bottom) { pl.material.opacity = ease(pl.material.opacity, tp * 0.75, 20, dt); pl.scale.set(1, 0.6 + Math.random() * 0.5, 1); pl.visible = pl.material.opacity > 0.01; }
      m.materials.nozzleGlow.emissiveIntensity = 0.2 + (bp + tp) * 5;
    }
    const lightsOn = this.lightsForced || env.night > 0.25;
    if (m.headLights) for (const sl of m.headLights) sl.intensity = lightsOn ? 900 : 0;
    if (m.materials) { m.materials.head.emissiveIntensity = lightsOn ? 4 : 1.6; m.materials.tail.emissiveIntensity = (this.vf > 1 && this.ctx.keys.down('KeyS') ? 5 : lightsOn ? 2.2 : 1.2); }
    if (m.mats && m.mats.tail) m.mats.tail.emissiveIntensity = this.vf > 1 && this.ctx.keys.down('KeyS') ? 5 : lightsOn ? 2.4 : 1.4;
  }
  hud() {
    const sp = Math.hypot(this.b.vel.x, this.b.vel.z);
    return { speed: sp, gauge: this.S.boost ? { label: 'PROPULSEURS', value: this.fuel / 100, active: this.boosting || this.thrusting } : null };
  }
  audio() { return { kind: this.S.sound, rpm: clamp(Math.abs(this.vf) / this.S.vmax, 0, 1.2), load: this.ctx.keys.down('KeyW') ? 1 : 0, boost: this.boosting || this.thrusting, slip: Math.abs(this.vl) > 3 && this.b.grounded ? Math.min(1, Math.abs(this.vl) / 12) : 0 }; }
  upright() { const b = this.b; b.vel.set(0, 0, 0); b.place(b.pos.x, b.pos.y + 1, b.pos.z, b.yaw); groundQuat(b.yaw, b.n, this.quat); this.flipT = 0; this.angVel.set(0, 0, 0); }
}

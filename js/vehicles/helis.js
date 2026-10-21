/* Hélicoptères : « Colibri » (léger, 2 places) et « Atlas » (transport, pilotes + 12 places à l'arrière).
   Pilotage assisté : le cyclique incline l'appareil (Z/S, Q/D), le palonnier le fait pivoter (A/E),
   le collectif monte ou descend (Maj / Ctrl) ; sans action, l'appareil garde son altitude et revient à plat. */
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';
import { G, V3, Q, UP, ease } from './base.js';

const SPECS = {
  small: { mass: 650, tilt: 0.52, rate: 2.2, yawRate: 1.7, climb: 9, sink: 7, drag: 0.12, lin: 0.05, vmax: 62, spool: 3.5, blades: 2, rotorHz: 7.5, footprint: [[0.95, 1.3], [-0.95, 1.3], [0.95, -1.5], [-0.95, -1.5]], hit: 1.4 },
  big: { mass: 11000, tilt: 0.38, rate: 1.1, yawRate: 0.85, climb: 8, sink: 6, drag: 0.1, lin: 0.04, vmax: 82, spool: 6, blades: 5, rotorHz: 3.3, footprint: [[1.95, -0.9], [-1.95, -0.9], [0.2, -6.3], [-0.2, -6.3]], hit: 2.4 },
};
const _v = new V3(), _w = new V3(), _f = new V3(), _r = new V3(), _q = new Q(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class Heli {
  constructor(ctx, kind, model) {
    this.ctx = ctx; this.kind = kind; this.S = SPECS[kind]; this.m = model; this.root = model.root; this.cat = 'heli';
    this.p = new V3(); this.v = new V3(); this.q = new Q();
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.rpm = 0; this.onGround = true; this.rotorA = 0; this.tailA = 0; this.coll = 0; this.lift = 0;
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: kind === 'big' ? 26 : 13, h: kind === 'big' ? 7 : 4, look: kind === 'big' ? 3 : 1.6, flat: true, stiff: 6 },
      { name: 'Éloignée', type: 'chase', dist: kind === 'big' ? 45 : 24, h: kind === 'big' ? 12 : 7, look: 2, stiff: 5 },
      { name: 'Cockpit', type: 'attach', off: model.cockpit.clone(), near: 0.1 },
    ];
    if (model.cabin) this.cams.push({ name: 'Cabine (places arrière)', type: 'attach', off: model.cabin.clone(), near: 0.1, yaw: 0.5 });
    if (model.passenger) this.cams.push({ name: 'Place passager', type: 'attach', off: model.passenger.clone(), near: 0.1 });
    this.help = [['Maj / Ctrl', 'Monter / descendre (collectif)'], ['Z / S', 'Pencher vers l\'avant / l\'arrière'], ['Q / D', 'Pencher à gauche / à droite'],
      ['A / E', 'Pivoter (palonnier)'], ['Sans commande', 'Maintien d\'altitude et retour à plat'], ['C', 'Caméras : poursuite, cockpit' + (model.cabin ? ', cabine arrière' : ', passager')]];
  }
  get pos() { return this.p; } get vel() { return this.v; }
  spawn(at) {
    this.p.set(at.x, at.y, at.z); this.yaw = at.yaw; this.pitch = this.roll = 0;
    if (at.quat) { _e.setFromQuaternion(at.quat, 'YXZ'); this.pitch = _e.x; this.yaw = _e.y; this.roll = _e.z; }
    this.onGround = !at.air;
    if (at.vel) this.v.copy(at.vel); else this.v.set(0, 0, 0);
    if (at.air) this.rpm = 1;
    else { this.rpm = 0; this.v.set(0, 0, 0); this.pitch = this.roll = 0; this.p.y = this.ctx.world.groundAt(at.x, at.z, at.y + 3); }
    this.updateQuat();
    if (!at.air) this.ctx.toast('Démarrage du rotor…');
  }
  updateQuat() { _e.set(this.pitch, this.yaw, this.roll, 'YXZ'); this.q.setFromEuler(_e); }
  step(dt, K) {
    const S = this.S, w = this.ctx.world, p = this.p, v = this.v;
    const fwdIn = (K.down('KeyW', 'ArrowUp') ? 1 : 0) - (K.down('KeyS', 'ArrowDown') ? 1 : 0);
    const sideIn = (K.down('KeyD', 'ArrowRight') ? 1 : 0) - (K.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const yawIn = (K.down('KeyQ') ? 1 : 0) - (K.down('KeyE') ? 1 : 0);
    const upIn = (K.down('ShiftLeft', 'ShiftRight', 'Space') ? 1 : 0) - (K.down('ControlLeft', 'ControlRight') ? 1 : 0);
    this.rpm = Math.min(1, this.rpm + dt / S.spool);
    const ready = this.rpm > 0.9;
    // attitude visée : le cyclique incline, le relâcher remet à plat
    const tP = this.onGround ? 0 : -fwdIn * S.tilt, tR = this.onGround ? 0 : -sideIn * S.tilt * 0.9;
    this.pitch = ease(this.pitch, tP, S.rate * 1.6, dt);
    this.roll = ease(this.roll, tR, S.rate * 1.6, dt);
    const sp = Math.hypot(v.x, v.z);
    // lacet (palonnier) + virage coordonné en translation
    let yr = yawIn * S.yawRate;
    if (!this.onGround) { _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); const fwdSp = v.x * _f.x + v.z * _f.z; if (fwdSp > 15) yr += this.roll * 0.9 * clamp((fwdSp - 15) / 20, 0, 1); }
    if (this.onGround && !ready) yr = 0;
    this.yaw += yr * dt;
    this.updateQuat();
    // poussée du rotor le long de l'axe vertical de l'appareil, réglée pour tenir la vitesse verticale visée
    const vsT = upIn > 0 ? S.climb : upIn < 0 ? -S.sink : 0;
    _v.set(0, 1, 0).applyQuaternion(this.q);
    const cosT = Math.max(0.45, _v.y);
    let acc = (G + clamp((vsT - v.y) * 1.8, -G * 0.9, G * 1.4)) / cosT;
    acc = clamp(acc, 0, G * 2.2) * (ready ? 1 : this.rpm * 0.5);
    if (this.onGround && upIn <= 0) acc = Math.min(acc, G * 0.95);
    this.lift = acc / G;
    v.addScaledVector(_v, acc * dt); v.y -= G * dt;
    // traînée (plus forte en latéral) et vitesse max
    v.x -= v.x * (S.lin + S.drag * sp / S.vmax) * dt; v.z -= v.z * (S.lin + S.drag * sp / S.vmax) * dt;
    v.y -= v.y * 0.4 * dt;
    if (sp > S.vmax) { v.x *= S.vmax / sp; v.z *= S.vmax / sp; }
    p.addScaledVector(v, dt);
    // sol, toits, eau
    const gy = this.ground();
    const wl = w.waterAt(p.x, p.z);
    if (p.y <= gy) {
      const sink = -v.y;
      if (gy < wl - 0.5 && p.y < wl) { this.crash('Amerrissage : l\'hélicoptère coule.'); return; }
      if (sink > 7 || Math.abs(this.roll) > 0.5 || Math.abs(this.pitch) > 0.5 || (sp > 18 && sink > 1)) { this.crash(sink > 7 ? 'Atterrissage trop dur' : 'Le rotor a touché le sol'); return; }
      if (!this.onGround && sink > 0.5) this.ctx.sfx.impact(sink * 3);
      p.y = gy; if (v.y < 0) v.y = 0;
      v.x *= Math.exp(-dt * 4); v.z *= Math.exp(-dt * 4);
      this.onGround = true;
    } else if (p.y > gy + 0.3) this.onGround = false;
    if (p.y < wl - 0.5) { this.crash('À l\'eau !'); return; }
    // obstacles : corps de l'appareil et disque du rotor
    _f.set(0, 0, -1).applyQuaternion(this.q);
    for (const d of [0, this.kind === 'big' ? -6 : -1.4, this.kind === 'big' ? 8 : 4.2]) {
      if (w.solidAt(p.x + _f.x * d, p.y + 1, p.z + _f.z * d)) { this.crash('Collision'); return; }
    }
    const R = this.kind === 'big' ? 8 : 3.6, top = p.y + (this.kind === 'big' ? 4.3 : 2.85);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; if (w.solidAt(p.x + Math.cos(a) * R, top, p.z + Math.sin(a) * R)) { this.crash('Les pales ont touché un obstacle'); return; } }
    this.rotorA += this.rpm * S.rotorHz * Math.PI * 2 * dt; this.tailA += this.rpm * S.rotorHz * 5 * Math.PI * 2 * dt;
    this.coll = upIn;
  }
  ground() {
    const w = this.ctx.world, p = this.p;
    let g = w.groundAt(p.x, p.z, p.y + 0.5);
    _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); _r.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    for (const [x, z] of this.S.footprint) g = Math.max(g, w.groundAt(p.x + _r.x * x - _f.x * z, p.z + _r.z * x - _f.z * z, p.y + 0.5));
    return g;
  }
  crash(msg) { this.v.set(0, 0, 0); this.rpm = 0; this.ctx.crash(msg); }
  visual(dt) {
    const m = this.m;
    this.root.position.copy(this.p); this.root.quaternion.copy(this.q);
    m.main.rot.rotation.y = this.rotorA; m.tail.rot.rotation.y = this.tailA;
    const blur = clamp((this.rpm - 0.6) / 0.3, 0, 1);
    m.main.disc.material.opacity = blur * 0.22; m.tail.disc.material.opacity = blur * 0.25;
    m.main.rot.visible = true;
  }
  hud() {
    const gy = this.ctx.world.groundAt(this.p.x, this.p.z, this.p.y);
    return { speed: Math.hypot(this.v.x, this.v.z), alt: this.p.y - gy, vs: this.v.y, thr: this.lift / 2.2, thrLabel: 'COLLECTIF', lines: this.rpm < 0.9 ? [['ROTOR', Math.round(this.rpm * 100) + ' %']] : null };
  }
  audio() { return { kind: 'rotor', rpm: this.rpm, load: clamp(this.lift - 0.8, 0, 1), blades: this.S.blades, rotorHz: this.S.rotorHz }; }
  upright() { this.pitch = this.roll = 0; this.v.set(0, 0, 0); this.updateQuat(); }
}

/* Voiture volante, d'après le mod Cyberpunk 2077 « Let There Be Flight » :
   au sol c'est une voiture (Car), O active le vol, G / B changent de mode (Hover & Fly, Drone, Vol),
   propulseurs animés, vue sur le toit, sortie en maintenant F. Pas de système de vie. Règles pures dans flycar-logic.js. */
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';
import { G, V3, Q, yawOf, ease } from './base.js';
import { Car } from './cars.js';
import { MODES, EXIT_HOLD, nextMode, canLand } from './flycar-logic.js';

const _f = new V3(), _l = new V3(), _u = new V3(), _r = new V3(), _t = new V3(), _tv = new V3(), _q = new Q(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
// points du châssis testés contre les bâtiments (repère de la voiture)
const PTS = [[0, 0.6, -2.3], [0, 0.6, 2.3], [1.05, 0.6, 0], [-1.05, 0.6, 0], [0, 1.3, 0]];
const HOVER_THR = 1 / 2.3;   // poussée qui annule la gravité en mode Drone

function approach(v, target, a, dt) { _t.copy(target).sub(v); const l = _t.length(), m = a * dt; if (l > m) _t.multiplyScalar(m / l); v.add(_t); }

export class FlyCar {
  constructor(ctx, model) {
    this.ctx = ctx; this.m = model; this.root = model.root; this.cat = 'car';
    this.drv = new Car(ctx, 'fly', model);
    this.fp = new V3(); this.fv = new V3(); this.q = new Q(); this.w = new V3();
    this.yaw = 0; this.pit = 0; this.rol = 0;
    this.flying = false; this.mode = 0; this.landing = false; this.tkT = 0;
    this.thr = HOVER_THR; this.tl = 0; this.exitT = 0; this.lightsForced = false;
    this.s = { air: false }; this.dep = 0; this.tiltPod = 0; this.fanA = 0;
    const ck = model.cockpit.clone();
    this.cams = [
      { name: 'Poursuite', type: 'chase', dist: 8, h: 2.7, look: 1.1 },
      { name: 'Éloignée', type: 'chase', dist: 15, h: 5, look: 1.3 },
      { name: 'Cockpit', type: 'attach', off: ck, near: 0.08 },
      { name: 'Toit', type: 'attach', off: new V3(0, 1.62, 0.3), near: 0.1 },
    ];
    this.help = [
      ['Z / S', 'Sol : accélérer / freiner · Vol : avancer / reculer'], ['Q / D', 'Tourner (lacet)'],
      ['O', 'Activer / couper le vol (en vol : atterrissage assisté)'],
      ['G / B', 'Mode de vol suivant / précédent'],
      ['Espace', 'Monter · Ctrl : descendre (Hover & Fly) · poussée (Drone)'],
      ['A / E', 'Hover : glisser à gauche / droite · Drone : roulis'],
      ['Maj', 'Hover : boost · Mode Vol : plus de poussée (Ctrl : moins)'],
      ['Mode Vol', 'Z/S tangage · Q/D roulis · A/E lacet (comme les avions)'],
      ['F (maintenu)', 'Sortir du véhicule en vol'],
      ['K', 'Couleur'], ['L', 'Phares'], ['R', 'Redresser'], ['C', 'Caméra (4 vues dont le toit)'],
    ];
  }
  get pos() { return this.flying ? this.fp : this.drv.b.pos; }
  get vel() { return this.flying ? this.fv : this.drv.b.vel; }
  get rpm() { return this.flying ? this.tl : 0.3; }

  spawn(at) {
    this.exitT = 0; this.landing = false; this.thr = HOVER_THR; this.w.set(0, 0, 0);
    this.drv.spawn(at); this.flying = false; this.s.air = false;
    if (at.air) this.takeoff(at.vel, at.quat, at.yaw, false);
  }
  /* passe en vol : repart de la position, de la vitesse et du cap du moment */
  takeoff(vel, quat, yaw, announce = true) {
    const b = this.drv.b;
    this.fp.copy(b.pos); if (announce) this.fp.y += 0.15;
    this.fv.copy(vel || b.vel);
    if (quat) this.q.copy(quat); else this.q.copy(this.drv.quat);
    if (!quat && yaw != null && !announce) this.q.setFromEuler(_e.set(0, yaw, 0));
    _e.setFromQuaternion(this.q, 'YXZ'); this.yaw = _e.y; this.pit = _e.x; this.rol = _e.z;
    this.w.set(0, 0, 0); this.landing = false; this.flying = true; this.s.air = true; this.tkT = announce ? 1 : 0; this.thr = HOVER_THR;
    if (this.mode === 2 && Math.hypot(this.fv.x, this.fv.z) < 25) { this.mode = 0; if (announce) this.ctx.toast('Vol : vitesse insuffisante, mode ' + MODES[0]); }
    else if (announce) this.ctx.toast('Vol activé · ' + MODES[this.mode]);
    if (this.mode === 2) this.thr = clamp(Math.hypot(this.fv.x, this.fv.z) / 90, 0.25, 1);
  }
  land() {
    const p = this.fp, yaw = yawOf(this.q);
    this.flying = false; this.s.air = false; this.landing = false;
    this.drv.spawn({ x: p.x, y: p.y, z: p.z, yaw, vel: _tv.copy(this.fv).setY(0) });
    this.ctx.toast('Atterrissage');
  }
  eject() {
    const p = this.fp, alt = p.y - this.ctx.world.groundAt(p.x, p.z, p.y);
    this.exitT = 0;
    this.ctx.toast(alt > 3 ? 'Vous sautez du véhicule en vol !' : 'Vous sortez du véhicule'); this.land();
  }
  setMode(d) {
    this.mode = nextMode(this.mode, d); this.landing = false; this.w.set(0, 0, 0);
    _e.setFromQuaternion(this.q, 'YXZ'); this.yaw = _e.y; this.pit = _e.x; this.rol = _e.z;
    this.thr = this.mode === 2 ? clamp(Math.hypot(this.fv.x, this.fv.z) / 90, 0.25, 1) : HOVER_THR;
    this.ctx.toast('Mode : ' + MODES[this.mode]);
  }
  onKey(code) {
    if (code === 'KeyO') {
      if (!this.flying) this.takeoff();
      else if (this.landing) { this.landing = false; this.ctx.toast('Atterrissage annulé'); }
      else { this.landing = true; this.mode = 0; this.ctx.toast('Atterrissage assisté'); }
    } else if (code === 'KeyG' && this.flying) this.setMode(1);
    else if (code === 'KeyB' && this.flying) this.setMode(-1);
    else if (code === 'KeyK' || code === 'KeyL') { this.drv.onKey(code); this.lightsForced = this.drv.lightsForced; }
  }

  step(dt, K) {
    if (!this.flying) this.drv.step(dt, K); else this.flyStep(dt, K);
  }

  flyStep(dt, K) {
    const ctx = this.ctx, p = this.fp, v = this.fv, k = (...c) => (K.down(...c) ? 1 : 0), prevX = p.x, prevY = p.y, prevZ = p.z;
    if (k('KeyF')) { this.exitT += dt; if (this.exitT >= EXIT_HOLD) { this.eject(); return; } } else this.exitT = 0;
    if (this.mode === 0 || this.landing) this.hover(dt, k);
    else if (this.mode === 1) this.drone(dt, k);
    else this.plane(dt, k);
    if (this.tkT > 0) this.tkT -= dt;
    p.addScaledVector(v, dt);
    this.collide(dt, prevX, prevY, prevZ);
  }

  hover(dt, k) {
    const v = this.fv, boost = k('ShiftLeft', 'ShiftRight');
    const yawIn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight'), fwdIn = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), latIn = k('KeyE') - k('KeyQ');
    const upIn = k('Space') - k('ControlLeft', 'ControlRight');
    this.yaw += yawIn * 1.7 * dt;
    _f.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); _l.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const vmax = boost ? 95 : 48, vf = fwdIn > 0 ? fwdIn * vmax : fwdIn * vmax * 0.4;
    let vy = upIn * 16;
    if (this.landing) {
      if (upIn > 0) { this.landing = false; this.ctx.toast('Atterrissage annulé'); }
      else { const alt = this.fp.y - this.ctx.world.groundAt(this.fp.x, this.fp.z, this.fp.y); vy = -clamp(alt * 0.6, 1.5, 6); }
    }
    if (this.tkT > 0) vy = Math.max(vy, 5);
    _tv.set(_f.x * vf - _l.x * latIn * 20, vy, _f.z * vf - _l.z * latIn * 20);
    const acc = (fwdIn || latIn || upIn || this.landing || this.tkT > 0 ? 32 : 18) * (boost ? 1.8 : 1);
    const vfNow = v.x * _f.x + v.z * _f.z, vlNow = -(v.x * _l.x + v.z * _l.z);
    approach(v, _tv, acc, dt);
    // inclinaison visuelle : cabré / piqué selon l'accélération demandée
    const pitT = -clamp((vf - vfNow) * 0.02, -0.45, 0.45), rolT = -clamp((latIn * 20 - vlNow) * 0.02, -0.4, 0.4) - yawIn * 0.1;
    this.pit = ease(this.pit, pitT, 6, dt); this.rol = ease(this.rol, rolT, 6, dt);
    this.q.setFromEuler(_e.set(this.pit, this.yaw, this.rol));
    this.w.set(0, 0, 0);
    this.tl = clamp(0.35 + Math.abs(v.y) / 40 + Math.hypot(v.x, v.z) / 90, 0, 1);
  }

  /* Drone : corps libre, poussée selon le haut du véhicule, vitesses de rotation directes (acro) */
  drone(dt, k) {
    const v = this.fv, w = this.w, q = this.q;
    this.thr = clamp(this.thr + (k('Space') - k('ControlLeft', 'ControlRight')) * 0.55 * dt, 0, 1);
    const fwdIn = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), roll = k('KeyE') - k('KeyQ'), yawIn = k('KeyA', 'ArrowLeft') - k('KeyD', 'ArrowRight');
    const r = 1 - Math.exp(-dt * 10);
    w.x = lerp(w.x, fwdIn * 2.6, r); w.z = lerp(w.z, -roll * 3.2, r); w.y = lerp(w.y, yawIn * 2, r);
    const wl = w.length(); if (wl > 1e-5) { _q.setFromAxisAngle(_t.copy(w).divideScalar(wl), wl * dt); q.multiply(_q).normalize(); }
    _u.set(0, 1, 0).applyQuaternion(q);
    v.addScaledVector(_u, this.thr * 2.3 * G * dt); v.y -= G * dt;
    const sp = v.length(); v.multiplyScalar(Math.max(0, 1 - (0.12 + sp * 0.0018) * dt));
    this.tl = this.thr;
  }

  /* Vol : poussée vers l'avant, portance selon la vitesse, commandes d'avion */
  plane(dt, k) {
    const v = this.fv, w = this.w, q = this.q;
    this.thr = clamp(this.thr + (k('ShiftLeft', 'ShiftRight') - k('ControlLeft', 'ControlRight')) * 0.5 * dt, 0, 1);
    const pitch = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), roll = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'), yawIn = k('KeyQ') - k('KeyE');
    const r = 1 - Math.exp(-dt * 6);
    w.x = lerp(w.x, pitch * 1.1, r); w.z = lerp(w.z, -roll * 2.2, r); w.y = lerp(w.y, yawIn * 0.5, r);
    const wl = w.length(); if (wl > 1e-5) { _q.setFromAxisAngle(_t.copy(w).divideScalar(wl), wl * dt); q.multiply(_q).normalize(); }
    _f.set(0, 0, -1).applyQuaternion(q); _u.set(0, 1, 0).applyQuaternion(q); _r.set(1, 0, 0).applyQuaternion(q);
    const sp = v.dot(_f), lift = sp > 0 ? G * Math.min(2.2, (sp / 34) * (sp / 34)) : 0;
    v.addScaledVector(_f, this.thr * 24 * dt); v.addScaledVector(_u, lift * dt); v.y -= G * dt;
    if (sp > 8) { v.addScaledVector(_r, -v.dot(_r) * Math.min(1, 1.5 * dt)); v.addScaledVector(_u, -v.dot(_u) * Math.min(1, 0.8 * dt)); }
    const s = v.length(); v.multiplyScalar(Math.max(0, 1 - 0.0016 * s * dt));
    this.tl = this.thr;
  }

  /* retour sensoriel du choc (son, secousse) ; aucun dégât */
  hurt(impact) {
    if (impact < 0.5) return;
    this.ctx.sfx.impact(impact * 2); if (impact > 4) this.ctx.shake(Math.min(1, impact / 25));
  }
  collide(dt, px, py, pz) {
    const world = this.ctx.world, p = this.fp, v = this.fv;
    const g = world.groundAt(p.x, p.z, p.y + 0.5), wl = world.waterAt(p.x, p.z);
    if (g < wl - 0.5 && p.y < wl + 0.1) { this.ctx.respawnNearRoad('À l\'eau !'); return; }
    let impact = 0;
    // obstacles : points du châssis dans un bâtiment, puis cercle de poussée
    let hit = false;
    for (const [x, y, z] of PTS) { _t.set(x, y, z).applyQuaternion(this.q).add(p); if (world.solidAt(_t.x, _t.y, _t.z)) { hit = true; break; } }
    if (hit) { impact = Math.max(impact, v.length()); p.set(px, py, pz); v.multiplyScalar(-0.25); this.w.x += (Math.random() - 0.5) * 2; this.w.z += (Math.random() - 0.5) * 2; }
    const q2 = { x: p.x, y: p.y + 0.6, z: p.z }, cx = p.x, cz = p.z, h = world.collideCircle(q2, 1.3, 1.2);
    if (h) {
      p.x += q2.x - cx; p.z += q2.z - cz;
      const vn = v.x * h.nx + v.z * h.nz;
      if (vn < 0) { impact = Math.max(impact, -vn); v.x -= 1.25 * vn * h.nx; v.z -= 1.25 * vn * h.nz; }
    }
    // sol : on se pose si c'est doux et à plat, sinon choc
    if (p.y <= g + 0.02) {
      const sink = Math.max(0, -v.y), horiz = Math.hypot(v.x, v.z);
      _u.set(0, 1, 0).applyQuaternion(this.q); const upY = _u.y;
      p.y = g;
      if (canLand(sink, upY, horiz)) { this.hurt(sink); this.land(); return; }
      impact = Math.max(impact, sink + (upY < 0.5 ? horiz * 0.4 : 0));
      v.y = sink > 2 ? sink * 0.3 : 0; v.x *= 0.7; v.z *= 0.7;
      if (sink > 2) { this.w.x += (Math.random() - 0.5) * 3; this.w.z += (Math.random() - 0.5) * 3; }
    }
    this.hurt(impact);
  }

  visual(dt, env) {
    const m = this.m, F = m.fly;
    if (!this.flying) this.drv.visual(dt, env);
    else {
      this.root.position.copy(this.fp); this.root.quaternion.copy(this.q);
      const lightsOn = this.lightsForced || env.night > 0.25;
      if (m.headLights) for (const sl of m.headLights) sl.intensity = lightsOn ? 900 : 0;
      for (const w of m.wheels) { w.mount.position.y = ease(w.mount.position.y, w.baseY + 0.18, 6, dt); w.spin.rotation.x -= dt * 2; if (w.front) w.steer.rotation.y = ease(w.steer.rotation.y, 0, 8, dt); }
    }
    // propulseurs : sortent en vol, pivotent vers l'arrière en mode Vol, soufflent selon la poussée
    this.dep = ease(this.dep, this.flying ? 1 : 0, 4, dt);
    this.tiltPod = ease(this.tiltPod, this.flying && this.mode === 2 ? -1.2 : 0, 3, dt);
    this.fanA += dt * (this.flying ? 40 + this.tl * 160 : 0);
    const tl = this.flying ? this.tl : 0;
    for (const pd of F.pods) {
      pd.pivot.visible = this.dep > 0.03;
      pd.pivot.position.x = pd.sx * lerp(0.7, 1.3, this.dep); pd.pivot.scale.setScalar(lerp(0.4, 1, this.dep));
      pd.pivot.rotation.x = this.tiltPod; pd.fan.rotation.y = this.fanA * (pd.sx > 0 ? 1 : -1);
      const op = this.flying ? 0.25 + 0.55 * tl : 0;
      pd.plumeMat.opacity = ease(pd.plumeMat.opacity, op, 10, dt); pd.plume.visible = pd.plumeMat.opacity > 0.02;
      pd.plume.scale.set(1, (0.6 + tl * 0.9) * (0.9 + Math.random() * 0.2), 1);
    }
  }

  hud() {
    const p = this.pos, h = { speed: this.vel.length(), gauge: this.exitT > 0 ? { label: 'SORTIE', value: this.exitT / EXIT_HOLD, active: true } : null, lines: [['MODE', this.flying ? MODES[this.mode] + (this.landing ? ' · ATTERR.' : '') : 'SOL']] };
    if (this.flying) {
      h.alt = p.y - this.ctx.world.groundAt(p.x, p.z, p.y); h.vs = this.fv.y;
      if (this.mode !== 0 && !this.landing) { h.thr = this.thr; h.thrLabel = 'POUSSÉE'; }
    }
    return h;
  }
  audio() { return this.flying ? { kind: 'flycar', rpm: this.tl, load: this.tl } : this.drv.audio(); }
  upright() {
    if (!this.flying) { this.drv.upright(); return; }
    _e.setFromQuaternion(this.q, 'YXZ'); this.yaw = _e.y; this.pit = 0; this.rol = 0;
    this.q.setFromEuler(_e.set(0, this.yaw, 0)); this.fv.set(0, 0, 0); this.w.set(0, 0, 0); this.fp.y += 1;
  }
}

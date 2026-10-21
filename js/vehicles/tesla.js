/* Tesla Roadster : physique d'origine (tesla-roadster/js/main.js). Adhérence totale : la voiture roule sur les
   murs et les plafonds (immeubles, tunnels, tube 360°, looping), propulseurs dans l'axe du toit, boost, figures. */
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';
import { V3, Q } from './base.js';

const P = { G: 14, RIDE: 1.0, ACC: 18, VMAX: 88, BOOST_ACC: 30, VMAX_BOOST: 128, BRAKE: 32, REV_ACC: 11, VMAX_REV: 22, CLIMB_SPEED: 1, THRUST: 26, AIR_BOOST: 26, JUMP: 5.5, WB: 2.62, VMAX_ABS: 165 };
const WHEELS_LOCAL = [[0.86, -1.32], [-0.86, -1.32], [0.87, 1.3], [-0.87, 1.3]];
const SPHERES = [[0, 0.82, 0, 0.72], [0.42, 0.75, -1.38, 0.6], [-0.42, 0.75, -1.38, 0.6], [0.42, 0.75, 1.38, 0.6], [-0.42, 0.75, 1.38, 0.6]];
const PAINTS = [['Rouge multicouche', 0x9a0a10], ['Blanc nacré', 0xe8e8e6], ['Noir intense', 0x07080a], ['Argent vif', 0x8f949b], ['Bleu outremer', 0x0f2a6b], ['Vert néon', 0x1f8a3c]];
const WORLD_UP = new V3(0, 1, 0), TAU = Math.PI * 2;
const up = new V3(), fwd = new V3(), right = new V3(), tmp = new V3(), tmp2 = new V3(), nSum = new V3(), o = new V3(), down = new V3(), fT = new V3(), rT = new V3();
const qa = new Q(), qb = new Q(), qi = new Q();

export class Tesla {
  constructor(ctx, model) {
    this.ctx = ctx; this.m = model; this.root = model.root; this.cat = 'car';
    this.car = { pos: new V3(), vel: new V3(), quat: new Q(), angVel: new V3(), grounded: false, normal: new V3(0, 1, 0), detach: 0, steer: 0, fuel: 100, idle: 0, using: false,
      wheelDist: [1, 1, 1, 1], spin: 0, vF: 0, surface: 'SOL', spaceWas: false, stuckT: 0, airT: 0, rollAcc: 0, pitchAcc: 0, thrusting: false, boosting: false, accelLong: 0, accelLat: 0, lastVF: 0, water: 0 };
    this.vis = { posOff: new V3(), quatOff: new Q() };
    this.visPos = new V3(); this.visQuat = new Q();
    this.score = { active: false, crashed: false, takeoffY: 0, maxH: 0, yawAcc: 0 };
    this.paintIdx = 0;
    this.cams = [
      { name: 'Poursuite', type: 'upchase', dist: 7.2, h: 2.3 },
      { name: 'Éloignée', type: 'upchase', dist: 13, h: 4.2 },
      { name: 'Cockpit', type: 'attach', off: model.cockpitCam.clone(), near: 0.08 },
    ];
    this.help = [['Z / S', 'Accélérer / freiner, marche arrière'], ['Q / D', 'Tourner'], ['Maj', 'Boost (sol et air)'], ['Espace', 'Propulseurs : décoller dans l\'axe du toit'],
      ['Murs', 'Fonce sur un mur pour rouler dessus (aussi aux plafonds : tunnels, tube 360°)'], ['En l\'air', 'Z/S tangage · Q/D rotation · A/E tonneaux'], ['K', 'Couleur de la peinture'], ['L', 'Phares']];
  }
  get pos() { return this.car.pos; } get vel() { return this.car.vel; }
  get surface() { return this.car.surface; }
  spawn(at) {
    const car = this.car;
    car.pos.set(at.x, at.y, at.z);
    car.vel.copy(at.vel || new V3());
    if (at.quat) car.quat.copy(at.quat); else car.quat.setFromAxisAngle(WORLD_UP, at.yaw);
    car.angVel.set(0, 0, 0); car.grounded = false; car.detach = 0; car.fuel = 100; car.stuckT = 0; car.normal.set(0, 1, 0); car.water = 0;
    this.score.active = false; this.score.crashed = false;
    this.vis.posOff.set(0, 0, 0); this.vis.quatOff.identity();
    this.visPos.copy(car.pos); this.visQuat.copy(car.quat);
  }
  onKey(code) {
    if (code === 'KeyK') { this.paintIdx = (this.paintIdx + 1) % PAINTS.length; this.m.setPaint(PAINTS[this.paintIdx][1]); this.ctx.toast(PAINTS[this.paintIdx][0]); }
    if (code === 'KeyL') { this.lightsForced = !this.lightsForced; this.ctx.toast(this.lightsForced ? 'Phares allumés' : 'Phares automatiques'); }
  }
  axes() { const q = this.car.quat; up.set(0, 1, 0).applyQuaternion(q); fwd.set(0, 0, -1).applyQuaternion(q); right.set(1, 0, 0).applyQuaternion(q); }
  transition(nOld, nNew, point, ahead) {
    const car = this.car, w = this.ctx.world;
    const prevPos = car.pos.clone(), prevQuat = car.quat.clone();
    qa.setFromUnitVectors(nOld, nNew);
    car.quat.premultiply(qa).normalize(); car.vel.applyQuaternion(qa);
    this.axes();
    car.pos.copy(point).addScaledVector(nNew, 0.02).addScaledVector(fwd, ahead);
    o.copy(car.pos).addScaledVector(nNew, 1.2);
    const h = w.raycast(o, tmp.copy(nNew).negate(), 2.4);
    if (h) car.pos.copy(h.point);
    this.vis.posOff.add(prevPos.sub(car.pos));
    this.vis.quatOff.multiply(prevQuat.multiply(car.quat.clone().invert())); this.vis.quatOff.normalize();
  }
  step(dt, K) {
    const car = this.car, w = this.ctx.world, ctx = this.ctx, score = this.score;
    this.axes();
    car.detach = Math.max(0, car.detach - dt);
    const inThr = K.down('KeyW', 'ArrowUp') ? 1 : 0, inBrk = K.down('KeyS', 'ArrowDown') ? 1 : 0;
    const inL = K.down('KeyA', 'ArrowLeft') ? 1 : 0, inR = K.down('KeyD', 'ArrowRight') ? 1 : 0;
    const inRollL = K.down('KeyQ') ? 1 : 0, inRollR = K.down('KeyE') ? 1 : 0;
    const wantBoost = K.down('ShiftLeft', 'ShiftRight'), wantThrust = K.down('Space');
    const boosting = wantBoost && car.fuel > 0.5, thrusting = wantThrust && car.fuel > 0.5;
    car.boosting = boosting; car.thrusting = thrusting;
    if (boosting) car.fuel -= 20 * dt; if (thrusting) car.fuel -= 26 * dt;
    car.using = boosting || thrusting;
    if (car.using) car.idle = 0; else car.idle += dt;
    if (car.idle > 0.7) car.fuel += 17 * dt;
    car.fuel = clamp(car.fuel, 0, 100);
    if ((wantBoost || wantThrust) && car.fuel <= 0.5 && !car.emptyWarned) { ctx.toast('Jauge vide : elle se recharge'); car.emptyWarned = true; }
    if (car.fuel > 20) car.emptyWarned = false;

    // sondes des roues
    let hits = 0, dSum = 0; nSum.set(0, 0, 0);
    down.copy(up).negate();
    for (let i = 0; i < 4; i++) {
      const [wx, wz] = WHEELS_LOCAL[i];
      o.copy(car.pos).addScaledVector(right, wx).addScaledVector(fwd, -wz).addScaledVector(up, P.RIDE);
      const h = w.raycast(o, down, P.RIDE + 0.9);
      car.wheelDist[i] = h ? h.distance : P.RIDE + 0.9;
      if (h && h.distance < P.RIDE + 0.4) { hits++; dSum += h.distance; nSum.add(h.normal); }
      else if (h) nSum.addScaledVector(h.normal, 0.001);
    }
    if (hits < 2 && car.grounded && car.detach <= 0 && !thrusting) {
      o.copy(car.pos).addScaledVector(up, P.RIDE);
      const h = w.raycast(o, down, P.RIDE + 1.1);
      if (h && h.normal.dot(up) > 0.45) { hits = 1; dSum = h.distance; nSum.copy(h.normal); }
    }
    let grounded = hits >= 1 && car.detach <= 0;
    const n = car.normal;
    if (grounded) n.copy(nSum).normalize();
    if (thrusting && !car.spaceWas && grounded) { car.vel.addScaledVector(n, P.JUMP); car.detach = 0.3; grounded = false; }
    car.spaceWas = wantThrust;

    if (grounded) {
      const avgD = dSum / hits;
      if (!car.grounded) this.onLand(n);
      car.grounded = true; car.airT = 0;
      qa.setFromUnitVectors(up, n); qi.identity().slerp(qa, Math.min(1, dt * 24)); car.quat.premultiply(qi).normalize();
      this.axes();
      car.pos.addScaledVector(n, (P.RIDE - avgD) * Math.min(1, dt * 30));
      const floor = n.y > 0.55;
      if (floor) car.vel.y -= P.G * dt; else car.vel.addScaledVector(n, -8 * dt);
      let vn = car.vel.dot(n);
      if (vn < 3) { car.vel.addScaledVector(n, -vn); vn = 0; }
      fT.copy(fwd).addScaledVector(n, -fwd.dot(n)).normalize(); rT.crossVectors(fT, n);
      let vF = car.vel.dot(fT), vR = car.vel.dot(rT);
      if (inThr && !inBrk) { if (vF < -1) vF += P.BRAKE * dt; else if (vF < P.VMAX) vF += P.ACC * (1 - Math.max(0, vF) / P.VMAX * 0.85) * dt; }
      else if (inBrk && !inThr) { if (vF > 1) vF -= P.BRAKE * dt; else if (vF > -P.VMAX_REV) vF -= P.REV_ACC * dt; }
      else { const dec = (1.4 + 0.0005 * vF * vF) * dt; vF = Math.abs(vF) < dec ? 0 : vF - Math.sign(vF) * dec; }
      if (boosting) vF = Math.min(Math.max(vF, 0) + P.BOOST_ACC * dt, Math.max(vF, P.VMAX_BOOST));
      if (vF > P.VMAX && !boosting) vF -= (vF - P.VMAX) * 0.6 * dt;
      const grip = lerp(9, 4.5, clamp(Math.abs(vF) / 110, 0, 1));
      vR *= Math.exp(-grip * dt);
      car.vel.copy(fT).multiplyScalar(vF).addScaledVector(rT, vR).addScaledVector(n, vn);
      const steerIn = inL - inR, maxSteer = 0.58 / (1 + Math.abs(vF) / 9);
      car.steer = lerp(car.steer, steerIn * maxSteer, 1 - Math.exp(-dt * 10));
      const yawRate = vF * Math.tan(car.steer) / P.WB;
      qb.setFromAxisAngle(n, yawRate * dt); car.quat.premultiply(qb).normalize();
      car.vel.applyAxisAngle(n, yawRate * dt * 0.9);
      car.accelLong = (vF - car.lastVF) / dt; car.lastVF = vF; car.accelLat = vF * yawRate; car.vF = vF;
      this.axes();
      // passage sol -> mur, mur -> plafond, mur -> sol
      if (Math.abs(vF) > 1) {
        const dir = vF > 0 ? fT : tmp2.copy(fT).negate();
        o.copy(car.pos).addScaledVector(n, 0.55);
        const h = w.raycast(o, dir, 2.45 + Math.abs(vF) * dt * 2);
        if (h && h.normal.dot(n) < 0.5 && h.normal.dot(dir) < -0.3) {
          const toFloor = h.normal.y > 0.55;
          if (Math.abs(vF) > P.CLIMB_SPEED || toFloor) {
            const nOld = n.clone();
            this.transition(nOld, h.normal, h.point, vF > 0 ? 1.75 : -1.75);
            car.normal.copy(h.normal);
            const s = surfName(h.normal);
            if (s !== 'SOL') ctx.toast(s === 'MUR' ? 'Sur le mur !' : 'Au plafond !');
          }
        }
      }
    } else {
      if (car.grounded || (!score.active && !score.crashed)) this.startCombo();
      car.grounded = false; car.airT += dt;
      score.maxH = Math.max(score.maxH, car.pos.y - score.takeoffY);
      car.vel.y -= P.G * dt;
      const tx = (inBrk - inThr) * 3.2, ty = (inL - inR) * 2.6, tz = (inRollL - inRollR) * 4.6, k = 1 - Math.exp(-dt * 7);
      car.angVel.x = lerp(car.angVel.x, tx, k); car.angVel.y = lerp(car.angVel.y, ty, k); car.angVel.z = lerp(car.angVel.z, tz, k);
      const wl = car.angVel.length();
      if (wl > 1e-4) { qb.setFromAxisAngle(tmp.copy(car.angVel).divideScalar(wl), wl * dt); car.quat.multiply(qb).normalize(); }
      car.rollAcc += car.angVel.z * dt; car.pitchAcc += car.angVel.x * dt; score.yawAcc += car.angVel.y * dt;
      car.steer = lerp(car.steer, 0, 1 - Math.exp(-dt * 5));
      if (boosting) car.vel.addScaledVector(fwd, P.AIR_BOOST * dt);
      if (hits === 0 && nSum.lengthSq() > 0 && car.detach <= 0) {
        tmp.copy(nSum).normalize();
        if (up.dot(tmp) > 0.4 && car.vel.dot(tmp) < 0) { qa.setFromUnitVectors(up, tmp); qi.identity().slerp(qa, Math.min(1, dt * 3)); car.quat.premultiply(qi).normalize(); }
      }
      car.vF = car.vel.dot(fwd);
      this.axes();
    }
    if (thrusting) car.vel.addScaledVector(up, P.THRUST * dt);
    const sp = car.vel.length();
    car.vel.multiplyScalar(1 - Math.min(0.5, 0.00025 * sp * dt));
    if (sp > P.VMAX_ABS) car.vel.multiplyScalar(P.VMAX_ABS / sp);
    car.pos.addScaledVector(car.vel, dt);

    // collisions de la carrosserie (sphères contre le maillage et le relief)
    let contactN = null, impact = 0;
    for (const [sx, sy, sz, r] of SPHERES) {
      const c = tmp.copy(car.pos).addScaledVector(right, sx).addScaledVector(up, sy).addScaledVector(fwd, -sz);
      for (let it = 0; it < 2; it++) {
        const res = w.closest(c, r);
        if (!res) break;
        const d = res.distance, nrm = tmp2.copy(c).sub(res.point);
        if (d < 1e-5) break;
        nrm.divideScalar(d);
        const push = r - d;
        car.pos.addScaledVector(nrm, push); c.addScaledVector(nrm, push);
        const vn = car.vel.dot(nrm);
        if (vn < 0) {
          impact = Math.max(impact, -vn);
          const bounce = !car.grounded && -vn > 8 ? 0.25 : 0.02;
          car.vel.addScaledVector(nrm, -vn * (1 + bounce));
          car.vel.multiplyScalar(1 - Math.min(0.5, dt * (car.grounded ? 0.6 : 2)));
        }
        contactN = (contactN || new V3()).copy(nrm);
      }
    }
    // arbres (troncs)
    const th = w.collideCircle(car.pos, 1.1, 1.2, true);
    if (th) { const vn = car.vel.x * th.nx + car.vel.z * th.nz; if (vn < 0) { impact = Math.max(impact, -vn); car.vel.x -= 1.2 * vn * th.nx; car.vel.z -= 1.2 * vn * th.nz; } }
    if (impact > 14) { ctx.shake(Math.min(1.2, impact / 40)); ctx.sfx.impact(impact); }
    if (score.active && !car.grounded && contactN && impact > 6 && up.dot(contactN) < 0.3) this.crashCombo();
    // coincée sur le flanc ou le toit : redressement
    if (!car.grounded && contactN && car.vel.length() < 4) {
      car.stuckT += dt;
      if (car.stuckT > 1.1) {
        car.stuckT = 0;
        const prevQ = car.quat.clone(), prevP = car.pos.clone();
        tmp.copy(fwd); tmp.y = 0; if (tmp.lengthSq() < 1e-3) tmp.set(0, 0, -1); tmp.normalize();
        car.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(new V3(), tmp.clone(), WORLD_UP));
        car.pos.y += 1.2; car.vel.set(0, 0, 0); car.angVel.set(0, 0, 0);
        this.vis.posOff.add(prevP.sub(car.pos)); this.vis.quatOff.multiply(prevQ.multiply(car.quat.clone().invert()));
        this.crashCombo(); ctx.toast('Redressement');
      }
    } else car.stuckT = 0;
    // eau, bords du monde
    car.water = car.pos.y < w.waterAt(car.pos.x, car.pos.z) - 0.8 ? car.water + dt : 0;
    if (car.water > 1) ctx.respawnNearRoad('À l\'eau !');
    else if (Math.abs(car.pos.x) > 3990 || Math.abs(car.pos.z) > 3990 || car.pos.y < -60) ctx.respawnNearRoad('Retour sur la route');
    car.surface = car.grounded ? surfName(car.normal) : 'VOL';
  }
  startCombo() { const s = this.score, car = this.car; s.active = true; s.takeoffY = car.pos.y; s.maxH = 0; s.yawAcc = 0; car.airT = 0; car.rollAcc = 0; car.pitchAcc = 0; }
  comboInfo() {
    const car = this.car, s = this.score, turns = a => Math.floor(Math.abs(a) / TAU + 0.15);
    const named = (k, nm) => k === 1 ? nm : k <= 4 ? ['', '', 'Double ', 'Triple ', 'Quadruple '][k] + nm.toLowerCase() : `${nm} x${k}`;
    const r = turns(car.rollAcc), f = turns(car.pitchAcc), y = turns(s.yawAcc), parts = [];
    if (r) parts.push(named(r, 'Tonneau')); if (f) parts.push(named(f, 'Salto')); if (y) parts.push(named(y, 'Vrille'));
    const deg = (Math.abs(car.rollAcc) + Math.abs(car.pitchAcc) + Math.abs(s.yawAcc)) * 180 / Math.PI;
    let pts = car.airT * 60 + deg * 1.2 + Math.max(0, s.maxH) * 4 + r * 400 + f * 500 + y * 300;
    const kinds = (r > 0) + (f > 0) + (y > 0); if (kinds > 1) pts *= 1 + 0.25 * (kinds - 1);
    if (!parts.length) parts.push(car.airT > 2.5 ? `Vol de ${car.airT.toFixed(1)} s` : 'Saut');
    else if (car.airT > 4) parts.push(`vol de ${car.airT.toFixed(1)} s`);
    return { name: parts.join(' + '), pts: Math.round(pts) };
  }
  onLand(n) {
    const s = this.score; s.crashed = false;
    if (!s.active) return;
    s.active = false;
    if (this.car.airT < 0.5) return;
    const info = this.comboInfo(), perfect = up.dot(n) > 0.94, gained = info.pts * (perfect ? 2 : 1);
    this.ctx.trick(perfect ? 'Atterrissage parfait x2' : info.name, `${perfect ? info.name + ' · ' : ''}+${gained.toLocaleString('fr-FR')}`, gained);
  }
  crashCombo() { const s = this.score; if (!s.active) return; s.active = false; s.crashed = true; if (this.car.airT > 0.5) this.ctx.trick('Crash !', 'Combo perdu', 0); }
  visual(dt, env) {
    const car = this.car, m = this.m, vis = this.vis;
    vis.posOff.multiplyScalar(Math.exp(-dt * 9)); vis.quatOff.slerp(qi.identity(), 1 - Math.exp(-dt * 10));
    this.visPos.copy(car.pos).add(vis.posOff); this.visQuat.copy(vis.quatOff).multiply(car.quat);
    m.root.position.copy(this.visPos); m.root.quaternion.copy(this.visQuat);
    const lat = clamp(car.accelLat, -40, 40), lon = clamp(car.accelLong, -40, 40);
    m.body.rotation.z = lerp(m.body.rotation.z, car.grounded ? lat * 0.0022 : 0, 1 - Math.exp(-dt * 6));
    m.body.rotation.x = lerp(m.body.rotation.x, car.grounded ? lon * 0.0016 : 0, 1 - Math.exp(-dt * 6));
    car.spin += car.vF * dt;
    m.wheels.forEach((wh, i) => {
      const comp = car.grounded ? clamp(P.RIDE - car.wheelDist[i], -0.12, 0.14) : -0.08;
      wh.mount.position.y = lerp(wh.mount.position.y, wh.baseY + comp, 1 - Math.exp(-dt * 25));
      wh.spin.rotation.x = -car.spin / wh.r;
      if (wh.front) wh.steer.rotation.y = car.steer * 1.2;
    });
    m.yoke.rotation.z = car.steer * 3;
    const bp = car.boosting ? 1 : 0, tp = car.thrusting ? 1 : 0;
    for (const pl of m.plumes.rear) { pl.material.opacity = lerp(pl.material.opacity, bp * 0.8, 1 - Math.exp(-dt * 20)); pl.scale.set(1, 0.6 + Math.random() * 0.5, 1); pl.visible = pl.material.opacity > 0.01; }
    for (const pl of m.plumes.bottom) { pl.material.opacity = lerp(pl.material.opacity, tp * 0.75, 1 - Math.exp(-dt * 20)); pl.scale.set(1, 0.6 + Math.random() * 0.5, 1); pl.visible = pl.material.opacity > 0.01; }
    m.materials.nozzleGlow.emissiveIntensity = 0.2 + (bp + tp) * 5;
    const lightsOn = this.lightsForced || env.night > 0.25;
    for (const sl of m.headLights) sl.intensity = lightsOn ? 900 : 0;
    m.materials.head.emissiveIntensity = lightsOn ? 4 : 1.6;
    m.materials.tail.emissiveIntensity = this.ctx.keys.down('KeyS') && car.vF > 1 ? 5 : lightsOn ? 2.2 : 1.2;
  }
  hud() {
    const car = this.car;
    return { speed: car.vel.length(), lines: [['SURFACE', car.surface]], gauge: { label: 'PROPULSEURS', value: car.fuel / 100, active: car.using } };
  }
  audio() { const car = this.car; return { kind: 'electric', rpm: Math.abs(car.vF) / 70, load: this.ctx.keys.down('KeyW') && car.grounded ? 1 : 0, boost: car.boosting || car.thrusting }; }
  upright() {
    const car = this.car; this.axes();
    tmp.copy(fwd); tmp.y = 0; if (tmp.lengthSq() < 1e-3) tmp.set(0, 0, -1); tmp.normalize();
    car.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(new V3(), tmp.clone(), WORLD_UP));
    car.pos.y += 1.2; car.vel.set(0, 0, 0); car.angVel.set(0, 0, 0); car.grounded = false;
  }
}
function surfName(n) { return n.y > 0.55 ? 'SOL' : n.y < -0.55 ? 'PLAFOND' : 'MUR'; }

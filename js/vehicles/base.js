/* Briques communes aux véhicules : corps roulant sur le relief, orientation, petits outils */
import * as THREE from 'three';
import { clamp } from '../util.js';

export const G = 9.81;
export const V3 = THREE.Vector3, Q = THREE.Quaternion;
export const UP = new V3(0, 1, 0);
const _q = new Q(), _q2 = new Q(), _v = new V3(), _v2 = new V3();

/* quaternion : cap (yaw autour de Y, avant = -Z) puis inclinaison de Y vers la normale n */
export function groundQuat(yaw, n, out) {
  _q.setFromAxisAngle(UP, yaw);
  _q2.setFromUnitVectors(UP, n);
  return out.copy(_q2).multiply(_q);
}
/* cap d'un quaternion (projection de l'avant sur le plan horizontal) */
export function yawOf(q) {
  _v.set(0, 0, -1).applyQuaternion(q);
  if (_v.x * _v.x + _v.z * _v.z < 1e-6) { _v.set(0, 1, 0).applyQuaternion(q); return Math.atan2(_v.x, _v.z); }
  return Math.atan2(-_v.x, -_v.z);
}

/* Corps roulant : suit le sol (routes, trottoirs, toits, ponts, tremplins), décolle sur les bosses,
   se fait repousser par les bâtiments et les arbres. */
export class GroundBody {
  constructor(world, o) {
    this.world = world;
    this.o = Object.assign({ wb: 2.6, track: 1.6, circles: [[0, 1]], height: 1.4, step: 0.65 }, o);
    this.pos = new V3(); this.vel = new V3(); this.yaw = 0;
    this.grounded = true; this.airT = 0; this.n = new V3(0, 1, 0); this.water = 0; this.gy = 0;
    this.ev = { land: 0, hit: 0, hitN: new V3(), soft: false };
  }
  fwd(out) { return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  left(out) { return out.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  ground(x, z) { return this.world.groundAt(x, z, this.pos.y + 1.2); }
  place(x, y, z, yaw) {
    this.pos.set(x, y, z); this.yaw = yaw; this.vel.set(0, 0, 0);
    this.gy = this.ground(x, z); this.pos.y = Math.max(y, this.gy); this.grounded = this.pos.y - this.gy < 0.3; this.airT = 0;
    this.sampleNormal(this.n);
  }
  /* normale moyenne sous les quatre roues */
  sampleNormal(out) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw), hw = this.o.wb / 2, ht = this.o.track / 2, p = this.pos;
    const fx = -s * hw, fz = -c * hw, lx = -c * ht, lz = s * ht;
    const hf = (this.ground(p.x + fx + lx, p.z + fz + lz) + this.ground(p.x + fx - lx, p.z + fz - lz)) / 2;
    const hb = (this.ground(p.x - fx + lx, p.z - fz + lz) + this.ground(p.x - fx - lx, p.z - fz - lz)) / 2;
    const hl = (this.ground(p.x + fx + lx, p.z + fz + lz) + this.ground(p.x - fx + lx, p.z - fz + lz)) / 2;
    const hr = (this.ground(p.x + fx - lx, p.z + fz - lz) + this.ground(p.x - fx - lx, p.z - fz - lz)) / 2;
    // pentes le long de l'avant et de la gauche
    const sf = (hf - hb) / (2 * hw), sl = (hl - hr) / (2 * ht);
    const fwd = _v.set(-s, sf, -c).normalize(), left = _v2.set(-c, sl, s).normalize();
    out.crossVectors(fwd, left).normalize();
    if (out.y < 0) out.negate();
    return out;
  }
  /* avance d'un pas ; remplit this.ev (atterrissage, choc) */
  move(dt) {
    const p = this.pos, v = this.vel, ev = this.ev, w = this.world;
    ev.land = 0; ev.hit = 0; ev.soft = false;
    const ox = p.x, oz = p.z, oy = this.gy;
    p.x += v.x * dt; p.z += v.z * dt;
    let gy = this.ground(p.x, p.z);
    // marche trop haute (dos d'un tremplin, muret, quai) : on bute
    if (gy - p.y > (this.grounded ? this.o.step : 0.35) && gy - oy > 0.3) {
      const sp = Math.hypot(v.x, v.z);
      _v.set(ox - p.x, 0, oz - p.z).normalize();
      p.x = ox; p.z = oz; gy = oy;
      ev.hit = sp; ev.hitN.copy(_v);
      v.x *= -0.2; v.z *= -0.2;
    }
    if (this.grounded) {
      // vitesse verticale imposée par la pente (mesurée vers l'arrière : stable sur les bordures)
      const back = Math.max(0.06, 0.6 / Math.max(1, Math.hypot(v.x, v.z)));
      const gb = this.ground(p.x - v.x * back, p.z - v.z * back);
      const vy = clamp((gy - gb) / back, -40, 40);
      const predicted = p.y + v.y * dt - 0.5 * G * dt * dt;
      if (gy < predicted - 0.06) { this.grounded = false; this.airT = 0; }
      else { v.y = vy; p.y = gy; }
    }
    if (!this.grounded) {
      v.y -= G * dt; p.y += v.y * dt; this.airT += dt;
      if (p.y <= gy) { ev.land = Math.max(0.01, -v.y); p.y = gy; this.grounded = true; v.y = 0; }
    }
    this.gy = gy;
    // obstacles
    const f = this.fwd(_v2);
    for (const [dz, r] of this.o.circles) {
      const cx = p.x + f.x * dz, cz = p.z + f.z * dz;
      const q = { x: cx, y: p.y + 0.2, z: cz };
      const hit = w.collideCircle(q, r, this.o.height);
      if (!hit) continue;
      p.x += q.x - cx; p.z += q.z - cz;
      const vn = v.x * hit.nx + v.z * hit.nz;
      if (vn < 0) {
        const e = hit.soft ? 0.35 : 0.15;
        v.x -= (1 + e) * vn * hit.nx; v.z -= (1 + e) * vn * hit.nz;
        v.x *= 0.92; v.z *= 0.92;
        if (-vn > ev.hit) { ev.hit = -vn; ev.hitN.set(hit.nx, 0, hit.nz); ev.soft = hit.soft; }
      }
    }
    // eau
    const wl = w.waterAt(p.x, p.z);
    this.water = gy < wl - 0.7 && p.y < wl - 0.2 ? this.water + dt : 0;
    if (this.water > 0) { v.x *= Math.exp(-dt * 2); v.z *= Math.exp(-dt * 2); }
    return ev;
  }
}

/* aide : moyenne exponentielle */
export const ease = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

/* Petit compteur de figures (vol, tonneaux, saltos, vrilles) partagé par la Tesla et la trottinette */
export class AirTricks {
  constructor() { this.reset(); }
  reset() { this.active = false; this.t = 0; this.roll = 0; this.pitch = 0; this.yaw = 0; this.y0 = 0; this.maxH = 0; }
  start(y) { this.reset(); this.active = true; this.y0 = y; }
  info() {
    const TAU = Math.PI * 2, turns = a => Math.floor(Math.abs(a) / TAU + 0.15);
    const named = (k, n) => k === 1 ? n : k <= 4 ? ['', '', 'Double ', 'Triple ', 'Quadruple '][k] + n.toLowerCase() : `${n} x${k}`;
    const r = turns(this.roll), f = turns(this.pitch), y = turns(this.yaw), parts = [];
    if (r) parts.push(named(r, 'Tonneau')); if (f) parts.push(named(f, 'Salto')); if (y) parts.push(named(y, 'Vrille'));
    const deg = (Math.abs(this.roll) + Math.abs(this.pitch) + Math.abs(this.yaw)) * 180 / Math.PI;
    let pts = this.t * 60 + deg * 1.2 + Math.max(0, this.maxH) * 4 + r * 400 + f * 500 + y * 300;
    if (!parts.length) parts.push(this.t > 2.5 ? `Vol de ${this.t.toFixed(1)} s` : 'Saut');
    return { name: parts.join(' + '), pts: Math.round(pts) };
  }
}

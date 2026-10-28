/* Liste des véhicules, rangés par catégorie pour la roue de sélection */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRK } from '../models/rk.js';
import { buildRoadster } from '../models/roadster.js';
import { createExtraModels } from '../models/extra.js';
import { createMotoModel } from '../models/moto.js';
import { createKukirinModel } from '../models/kukirin.js';
import { createFreestyleModel } from '../models/freestyle.js';
import { createAircraftModels } from '../models/avions.js';
import { createCockpitKit } from '../models/cockpit.js';
import { Car } from './cars.js';
import { Tesla } from './tesla.js';
import { Moto, Kukirin, Freestyle } from './bikes.js';
import { Heli } from './helis.js';
import { Plane } from './planes.js';
import { Drone } from './drone.js';

export const CATS = [
  { id: 'car', name: 'Voitures', icon: 'car', items: [
    { id: 'tesla', name: 'Tesla Roadster', desc: 'Roule sur les murs et les plafonds, propulseurs, boost et tonneaux.' },
    { id: 'super', name: 'Supercar V12', desc: '850 ch, 345 km/h, grip énorme. Frein à main pour drifter.' },
    { id: 'drift', name: 'Voiture de drift', desc: 'Propulsion survireuse de Drift King : gaz et contre-braquage.' },
  ] },
  { id: 'bike', name: 'Deux-roues', icon: 'bike', items: [
    { id: 'moto', name: 'Ducati Panigale V4 R', desc: 'Superbike de 240 ch du Moto Rider, boîte automatique.' },
    { id: 'kukirin', name: 'Kukirin G6', desc: 'Trottinette électrique de 120 km/h : dérapages et wheelies.' },
    { id: 'freestyle', name: 'Trottinette freestyle', desc: 'Sauts, flips, tailwhips, barspins et grabs.' },
  ] },
  { id: 'heli', name: 'Hélicoptères', icon: 'heli', items: [
    { id: 'heli_small', name: 'Colibri (2 places)', desc: 'Petit hélicoptère léger et vif, bulle vitrée.' },
    { id: 'heli_big', name: 'Atlas (transport)', desc: 'Gros porteur : 2 pilotes et 12 places à l\'arrière.' },
  ] },
  { id: 'plane', name: 'Avions', icon: 'plane', items: [
    { id: 'f35', name: 'F-35B', desc: 'Chasseur à décollage vertical, post-combustion, Mach 1,6.' },
    { id: 'pv40', name: 'PV-40', desc: 'VTOL privé à aile basculante et 4 turbopropulseurs.' },
  ] },
  { id: 'drone', name: 'Drones', icon: 'drone', items: [
    { id: 'drone', name: 'Drone FPV 5"', desc: 'Freestyle 6S du FPV Racer : vue caméra, mode Angle ou Acro.' },
  ] },
];

/* Fusionne, dans chaque groupe, les pièces fixes qui partagent un matériau : beaucoup moins d'appels de dessin.
   Les groupes (roues, rotors, portes, pilote…) restent animables ; les pièces transparentes,
   à ordre de rendu particulier ou marquées userData.keep ne sont pas touchées. */
function optimizeModel(root) {
  const groups = [];
  root.traverse(o => { if (o.children.length) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || c.userData.keep || c.renderOrder !== 0 || Array.isArray(c.material) || c.material.transparent || !c.visible) continue;
      if (!c.geometry.attributes.normal) continue;
      const k = c.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(c);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map(m => {
        m.updateMatrix();
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', src.attributes.position.clone());
        out.setAttribute('normal', src.attributes.normal.clone());
        out.setAttribute('uv', src.attributes.uv ? src.attributes.uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
        out.applyMatrix4(m.matrix);
        if (m.matrix.determinant() < 0) { const p = out.attributes.position.array, n = out.attributes.normal.array, u = out.attributes.uv.array; for (let i = 0; i < p.length; i += 9) for (const [arr, w] of [[p, 3], [n, 3]]) for (let k = 0; k < w; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } for (let i = 0; i < u.length; i += 6) for (let k = 0; k < 2; k++) { const t = u[i + 2 + k]; u[i + 2 + k] = u[i + 4 + k]; u[i + 4 + k] = t; } }
        return out;
      });
      const merged = new THREE.Mesh(mergeGeometries(geos), list[0].material);
      merged.castShadow = list.some(m => m.castShadow); merged.receiveShadow = list.some(m => m.receiveShadow);
      for (const m of list) g.remove(m);
      g.add(merged);
    }
  }
}

export function createRoster(ctx, renderer) {
  const RK = createRK(THREE);
  RK.setEnv(renderer, { city: 0.6, hills: 1.2, sunU: 0.3, sunV: 0.25 });
  const X = createExtraModels(THREE, RK), K = createCockpitKit(THREE);
  // habitacle d'un modèle : instruments redessinés par main.js quand la caméra est en vue intérieure
  const fit = (m, ck) => { m.root.userData.cockpit = ck; return m; };
  let moto = null, kuk = null, rider = null, air = null;
  const makers = {
    tesla: () => new Tesla(ctx, buildRoadster(THREE)),
    super: () => { const m = X.buildSupercar(); return new Car(ctx, 'super', fit(m, K.carInterior(m.body || m.root, m.cockpit))); },
    drift: () => { const m = X.buildDriftCar(); return new Car(ctx, 'drift', fit(m, K.carInterior(m.body || m.root, m.cockpit))); },
    moto: () => new Moto(ctx, moto || (moto = createMotoModel(THREE, RK)), 1),
    kukirin: () => new Kukirin(ctx, kuk || (kuk = createKukirinModel(THREE, RK))),
    freestyle: () => new Freestyle(ctx, rider || (rider = createFreestyleModel(THREE))),
    heli_small: () => { const m = X.buildHeliSmall(); return new Heli(ctx, 'small', fit(m, K.heliInterior(m.body || m.root, m.cockpit, { width: 1.1 }))); },
    heli_big: () => { const m = X.buildHeliBig(); return new Heli(ctx, 'big', fit(m, K.heliInterior(m.body || m.root, m.cockpit, { width: 1.8 }))); },
    f35: () => { const m = (air || (air = createAircraftModels(THREE, RK))).buildF35(); return new Plane(ctx, 'f35', fit(m, K.planeInterior(m.root, new THREE.Vector3(0, 1.03, -2.48), { width: 0.95 }))); },
    pv40: () => { const m = (air || (air = createAircraftModels(THREE, RK))).buildPV40(); return new Plane(ctx, 'pv40', fit(m, K.planeInterior(m.root, new THREE.Vector3(-0.62, 1.12, -13.6), { width: 1.3, screenW: 0.3 }))); },
    drone: () => new Drone(ctx, X.buildDrone()),
  };
  const cache = {}, info = {};
  for (const c of CATS) for (const it of c.items) info[it.id] = { ...it, cat: c.id, catName: c.name };
  return {
    RK, info,
    ids: Object.keys(makers).filter(id => info[id]),
    get(id) {
      if (!cache[id]) { const v = makers[id](); optimizeModel(v.root); v.id = id; v.name = info[id].name; v.cat = info[id].cat; cache[id] = v; }
      return cache[id];
    },
  };
}

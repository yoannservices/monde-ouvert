// Charge un modèle .glb (compression Draco comprise) avec les loaders de Three.js r186.
// La page doit déclarer l'import map "three" (les loaders importent 'three' par son nom).
import * as THREE from 'three';

const LOADERS = 'https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/loaders/';
export async function loadGLB(url) {
  const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([import(LOADERS + 'GLTFLoader.js'), import(LOADERS + 'DRACOLoader.js')]);
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  return (await new GLTFLoader().setDRACOLoader(draco).loadAsync(url)).scene;
}

/* Détecte les roues d'un modèle cadré par fitGLB (nœuds dont le nom contient « wheel ») et prépare leur rotation.
   `left` : le côté gauche est sur +X (convention de rally-masters). Renvoie [{ front, left, c, pivot, spin, ax, ay }]. */
export function rigWheels(out, re = /wheel/i) {
  out.updateMatrixWorld(true);
  const hit = []; out.traverse((o) => { if (re.test(o.name)) hit.push(o); });
  const top = hit.filter((o) => { for (let p = o.parent; p; p = p.parent) if (hit.includes(p)) return false; return true; });
  return top.map((o) => {
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()), par = o.parent;
    const pivot = new THREE.Group(), spin = new THREE.Group(), inv = par.matrixWorld.clone().invert();
    pivot.position.copy(par.worldToLocal(c.clone())); par.add(pivot); pivot.add(spin); spin.attach(o);
    return { front: c.z > 0, left: c.x > 0, c, pivot, spin, ax: new THREE.Vector3(1, 0, 0).transformDirection(inv), ay: new THREE.Vector3(0, 1, 0).transformDirection(inv) };
  });
}
export function poseWheel(w, spin, steer = 0) {
  w.spin.quaternion.setFromAxisAngle(w.ax, spin);
  if (w.front) w.pivot.quaternion.setFromAxisAngle(w.ay, steer);
}

/* Supprime de la scène (et libère) tous les maillages de `root` sauf ceux situés sous un des objets de `keep` (pilote, afficheur...).
   Les lumières et les repères (Object3D) restent : les jeux s'en servent. */
export function purge(root, keep = []) {
  const dead = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (keep.includes(p)) return;
    dead.push(o);
  });
  for (const o of dead) { o.parent.remove(o); o.geometry.dispose(); }
}

/* Remplace l'apparence d'un groupe : supprime ses maillages (le jeu garde ses repères et groupes) et ajoute le modèle cadré.
   `url` est relatif à la page. */
export async function swapModel(group, url, length, yaw = 0, keepAxes = false) {
  const m = fitGLB(await loadGLB(new URL(url, location.href).href), length, yaw, keepAxes);
  purge(group);
  group.add(m);
  return m;
}

/* Cadre un modèle venu de Sketchfab (échelle et origine quelconques) : axe long le long de Z, longueur `length` (m),
   centré en X/Z, posé sur y = 0. `yaw` tourne le groupe retourné pour mettre l'avant du modèle sur +Z. */
export function fitGLB(model, length, yaw = 0, keepAxes = false) {
  const box = new THREE.Box3(), size = new THREE.Vector3(), c = new THREE.Vector3();
  model.updateMatrixWorld(true); box.setFromObject(model).getSize(size);
  if (!keepAxes && size.x > size.z) model.rotation.y = Math.PI / 2; // axe long -> Z ; avions : keepAxes (l'envergure dépasse la longueur)
  const holder = new THREE.Group(); holder.add(model);
  holder.updateMatrixWorld(true); box.setFromObject(holder).getSize(size);
  model.scale.setScalar(length / (keepAxes ? size.z : Math.max(size.x, size.z)));
  holder.updateMatrixWorld(true); box.setFromObject(holder); box.getCenter(c);
  model.position.set(-c.x, -box.min.y, -c.z);
  const out = new THREE.Group(); out.add(holder); out.rotation.y = yaw;
  return out;
}

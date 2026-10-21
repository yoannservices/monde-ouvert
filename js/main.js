/* ===== Monde ouvert multi-véhicules : rendu, ciel jour/nuit, caméras, entrées, changement de véhicule ===== */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, sstep } from './util.js';
import { createWorld } from './world/index.js';
import { createRoster, CATS } from './vehicles/index.js';
import { createWheel } from './wheel.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const loadMsg = $('loadmsg');
const progress = t => { loadMsg.textContent = t; };
const tick = () => new Promise(r => setTimeout(r, 0));

// ---------- rendu ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const gpuName = (() => { try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { return ''; } })();
let hiQ = !/intel|swiftshader|llvmpipe|mali|adreno|powervr|apple gpu/i.test(gpuName);
const maxPR = () => hiQ ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
renderer.setPixelRatio(maxPR());
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.25, 30000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const sky = new Sky(); sky.scale.setScalar(20000);
sky.material.depthTest = false; sky.material.depthWrite = false; sky.renderOrder = -1000; sky.frustumCulled = false;
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 6; skyU.rayleigh.value = 1.6; skyU.mieCoefficient.value = 0.004; skyU.mieDirectionalG.value = 0.82;
const stars = (() => {
  const n = 2500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - (Math.random() * 0.95 + 0.05)); p.set([Math.cos(th) * Math.sin(ph) * 15000, Math.cos(ph) * 15000, Math.sin(th) * Math.sin(ph) * 15000], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  s.frustumCulled = false; s.renderOrder = -999; scene.add(s); return s;
})();
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(hiQ ? 2048 : 1024, hiQ ? 2048 : 1024);
Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 2500 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3328, 0.8); scene.add(hemi);
scene.fog = new THREE.Fog(0xbfd4e6, 500, 4000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.92);
composer.addPass(bloom); composer.addPass(new OutputPass());

// ---------- entrées ----------
const keys = {}, hits = new Set();
const K = { down: (...c) => c.some(k => keys[k]), hit: c => hits.has(c) };
const GAME_CODES = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'PageUp', 'PageDown']);

// ---------- monde ----------
progress('Préparation du monde…'); await tick();
const world = await createWorld(renderer, progress);
scene.add(world.group);
const hud = createHUD(world);
const audio = createAudio();

// ---------- véhicules ----------
let shakeAmt = 0, score = 0;
try { score = +localStorage.getItem('monde:score') || 0; } catch (e) { score = 0; }
const ctx = {
  world, scene, keys: K,
  toast: t => hud.toast(t),
  trick: (t, s, pts) => { hud.trick(t, s); if (pts > 0) { score += pts; hud.setScore(score); try { localStorage.setItem('monde:score', score); } catch (e) { /* stockage indisponible */ } } },
  driftHud: D => hud.drift(D),
  shake: a => { shakeAmt = Math.min(1.2, shakeAmt + a); },
  sfx: { impact: v => audio.impact(v), whoosh: () => audio.whoosh() },
  respawnNearRoad: msg => respawnNearRoad(msg),
  crash: msg => crashed(msg),
};
progress('Préparation des véhicules…'); await tick();
const roster = createRoster(ctx, renderer);

/* miniatures pour la roue : chaque modèle est rendu une fois dans un coin du canevas puis copié */
async function makeThumbs() {
  const TW = 240, TH = 150, tScene = new THREE.Scene(), tCam = new THREE.PerspectiveCamera(30, TW / TH, 0.05, 500);
  tScene.environment = scene.environment;
  const l1 = new THREE.DirectionalLight(0xffffff, 3.2); l1.position.set(-4, 6, -3); tScene.add(l1, new THREE.HemisphereLight(0xdfeaff, 0x404040, 1.4));
  // rendu hors écran à double résolution (anticrénelage par réduction), indépendant de la taille de la fenêtre
  const RW = TW * 2, RH = TH * 2, rt = new THREE.WebGLRenderTarget(RW, RH, { colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
  const px = new Uint8Array(RW * RH * 4), big = document.createElement('canvas'); big.width = RW; big.height = RH;
  const bgc = big.getContext('2d'), img = bgc.createImageData(RW, RH);
  const out = document.createElement('canvas'); out.width = TW; out.height = TH; const og = out.getContext('2d');
  renderer.setClearColor(0x000000, 0);
  for (const id of roster.ids) {
    progress('Atelier : ' + roster.info[id].name + '…'); await tick();
    const v = roster.get(id), obj = v.root;
    obj.position.set(0, 0, 0); obj.quaternion.identity(); obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new V3()), s = box.getSize(new V3()), r = s.length() * 0.5;
    tScene.add(obj);
    const d = r / Math.sin(THREE.MathUtils.degToRad(15)) * 0.95;
    tCam.position.set(c.x - d * 0.62, c.y + d * 0.32, c.z - d * 0.72); tCam.lookAt(c); tCam.near = d * 0.05; tCam.far = d * 4; tCam.updateProjectionMatrix();
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(tScene, tCam);
    renderer.readRenderTargetPixels(rt, 0, 0, RW, RH, px);
    for (let y = 0; y < RH; y++) img.data.set(px.subarray((RH - 1 - y) * RW * 4, (RH - y) * RW * 4), y * RW * 4);
    bgc.putImageData(img, 0, 0);
    og.clearRect(0, 0, TW, TH); og.drawImage(big, 0, 0, TW, TH);
    wheel.setThumb(id, out.toDataURL('image/png'));
    tScene.remove(obj); scene.add(obj); obj.visible = false;
  }
  renderer.setRenderTarget(null); rt.dispose(); renderer.setClearColor(0x000000, 1);
}
const wheel = createWheel(CATS, id => switchVehicle(id));
await makeThumbs();

let cur = null, camMode = 0, camInit = true;
function heading() { return cur ? Math.atan2(_f.set(0, 0, -1).applyQuaternion(cur.root.quaternion).x, -_f.z) : 0; }
const _f = new V3(), _u = new V3(), _t = new V3(), _t2 = new V3();

/* Encombrement (rayon libre nécessaire) et hauteur du centre au-dessus du sol pour chaque véhicule */
const SPAN = { tesla: 2.3, super: 2.3, drift: 2.3, moto: 1.1, kukirin: 0.7, freestyle: 0.6, heli_small: 4.5, heli_big: 9.5, f35: 6, pv40: 18, drone: 0.4 };
const BASE = { f35: 2.05, pv40: 3.05 };
const FLYING = new Set(['heli', 'plane', 'drone']);
let rising = null;
/* Changement de véhicule : le nouveau reprend la position, l'orientation et la vitesse du précédent.
   En l'air, il reste en l'air (et tombe s'il ne vole pas). Sans place, il monte jusqu'à être dégagé. */
function switchVehicle(id, opt = {}) {
  const prev = cur, v = roster.get(id);
  let x, z, base, yaw, quat = null, vel = null;
  if (opt.at) { ({ x, z, yaw } = opt.at); base = opt.at.y; }
  else if (prev) {
    const p = prev.pos; x = p.x; z = p.z; base = p.y - (BASE[prev.id] || 0);
    quat = prev.root.quaternion.clone(); vel = prev.vel.clone();
    _f.set(0, 0, -1).applyQuaternion(quat); yaw = Math.atan2(-_f.x, -_f.z);
  } else ({ x, y: base, z, yaw } = START);
  if (prev) { prev.root.visible = false; if (prev.leave) prev.leave(); }
  rising = null;
  const g = world.groundAt(x, z, base + 0.5);
  let air = opt.at ? !!opt.at.air : base - g > 0.6;
  if (!air) base = Math.max(base, g);
  // pas de place : on cherche la première hauteur dégagée
  const r = SPAN[id] || 2;
  let free = base;
  if (!clearance(x, base, z, r, FLYING.has(v.cat))) { for (free = base + 1; free < base + 700; free += 1) if (clearance(x, free, z, r, FLYING.has(v.cat))) break; }
  const at = { x, y: base + (BASE[id] || 0), z, yaw, quat, vel, air: air || free > base, speed: vel ? Math.hypot(vel.x, vel.z) : 0 };
  cur = v; v.root.visible = true; v.spawn(at);
  if (free > base) {
    rising = { v, y0: at.y, y1: free + (BASE[id] || 0) + (FLYING.has(v.cat) ? 2 : 0.5), t: 0 };
    rising.dur = clamp((rising.y1 - rising.y0) / 30, 0.5, 2.5);
    hud.toast(FLYING.has(v.cat) ? 'Pas assez de place : montée…' : 'Obstacle : le véhicule est replacé au-dessus');
  }
  camMode = 0; camInit = true;
  wheel.setCurrent(id);
  hud.setVehicle(v, roster.info[id].catName);
  hud.drift(null);
  try { localStorage.setItem('monde:vehicle', id); } catch (e) { /* stockage indisponible */ }
}
function clearance(x, y, z, r, tall) {
  const hs = tall ? [1, 3, 5] : [0.5, 1.3];
  for (const hy of hs) {
    if (world.solidAt(x, y + hy, z)) return false;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; for (const rr of [r * 0.5, r]) if (world.solidAt(x + Math.cos(a) * rr, y + hy, z + Math.sin(a) * rr)) return false; }
  }
  return true;
}
function respawnNearRoad(msg) {
  const r = world.nearestRoad(cur.pos.x, cur.pos.z);
  if (msg) hud.toast(msg);
  const id = cur.id; cur.root.visible = false; cur = null;
  switchVehicle(id, { at: { x: r.x, y: r.y, z: r.z, yaw: r.yaw, air: false } });
}
let crashT = 0;
function crashed(msg) { if (crashT > 0) return; crashT = 2.6; hud.trick('Crash !', msg || ''); audio.impact(40); shakeAmt = 1.2; }

// ---------- jour / nuit (repris de la Tesla) ----------
let timeOfDay = 10.5, timeScale = 1 / 25, nightF = 0;
const sunDir = new V3(), FOG_DAY = new THREE.Color(0xb9cde0), FOG_SET = new THREE.Color(0xd49a72), FOG_NIGHT = new THREE.Color(0x0b1222), fogC = new THREE.Color();
const fmtTime = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
function updateDayNight(dt, focus, alt) {
  timeOfDay = (timeOfDay + dt * timeScale * (K.down('KeyT') ? 40 : 1)) % 24;
  const ph = (timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
  sunDir.set(Math.cos(ph) * 0.8, Math.sin(ph), 0.45).normalize();
  const el = sunDir.y, day = sstep(-0.06, 0.25, el), golden = sstep(0.35, 0.02, el) * sstep(-0.1, 0.02, el);
  nightF = 1 - sstep(-0.12, 0.08, el);
  skyU.sunPosition.value.copy(sunDir); skyU.rayleigh.value = lerp(1.4, 3.2, golden);
  if (el > -0.04) { sun.color.setRGB(1, lerp(0.95, 0.62, golden), lerp(0.9, 0.42, golden)); sun.intensity = 3.2 * day + 0.4 * golden; _t.copy(sunDir); }
  else { sun.color.setRGB(0.55, 0.65, 1.0); sun.intensity = 0.35; _t.set(-sunDir.x, -sunDir.y, sunDir.z).normalize(); }
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(_t, 900);
  hemi.intensity = 0.35 + 1.5 * day; hemi.color.setRGB(lerp(0.25, 0.75, day), lerp(0.32, 0.85, day), lerp(0.55, 1, day));
  scene.environmentIntensity = 0.12 + 0.7 * day;
  fogC.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_SET, golden * 0.7); scene.fog.color.copy(fogC);
  scene.fog.far = lerp(2400, 4200, day) + Math.max(0, alt) * 4; scene.fog.near = scene.fog.far * 0.15;
  renderer.toneMappingExposure = lerp(0.85, 0.74, day);
  stars.material.opacity = nightF; stars.visible = nightF > 0.02;
  const N = world.night;
  for (const m of N.facadeMats) m.emissiveIntensity = nightF * 0.85;
  N.lampMat.emissiveIntensity = nightF * 6;
  N.beaconMat.emissiveIntensity = (Math.sin(performance.now() / 300) > 0.2 ? 3 : 0.2) * (0.3 + nightF);
  bloom.strength = lerp(0.55, 0.28, day);
}

// ---------- caméras ----------
const camPos = new V3(), camLook = new V3(), camUp = new V3(0, 1, 0);
const orb = { yaw: 0, pitch: 0, drag: false, lx: 0, ly: 0, idle: 9 };
canvas.addEventListener('pointerdown', e => { if (e.button === 0 && !wheel.isOpen && started) { orb.drag = true; orb.lx = e.clientX; orb.ly = e.clientY; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => { if (!orb.drag) return; orb.yaw -= (e.clientX - orb.lx) * 0.006; orb.pitch = clamp(orb.pitch + (e.clientY - orb.ly) * 0.005, -0.45, 1.2); orb.lx = e.clientX; orb.ly = e.clientY; orb.idle = 0; });
const orbEnd = () => { orb.drag = false; orb.idle = 0; };
canvas.addEventListener('pointerup', orbEnd); canvas.addEventListener('pointercancel', orbEnd);
function updateCamera(dt) {
  const v = cur, cams = v.cams, c = cams[camMode % cams.length], root = v.root, q = root.quaternion;
  const sp = v.vel.length();
  const near = c.near || (v.cat === 'drone' ? 0.03 : 0.25);
  if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
  if (c.type === 'upchase') {
    _u.set(0, 1, 0).applyQuaternion(q); _f.set(0, 0, -1).applyQuaternion(q);
    if (camInit) camUp.copy(_u);
    const grounded = v.car ? v.car.grounded : true;
    camUp.lerp(_u, 1 - Math.exp(-dt * (grounded ? 5 : 2.5))).normalize();
    if (orb.drag || orb.idle < 1.6) _f.applyAxisAngle(camUp, orb.yaw);
    if (!orb.drag) { orb.idle += dt; if (orb.idle > 1.6) orb.yaw *= Math.exp(-dt * 2.2); }
    const desired = _t.copy(root.position).addScaledVector(_f, -c.dist - Math.min(3, sp * 0.02)).addScaledVector(camUp, c.h);
    if (camInit) { camPos.copy(desired); camInit = false; }
    camPos.lerp(desired, 1 - Math.exp(-dt * 9));
    const tgt = _t2.copy(root.position).addScaledVector(camUp, 1.3), dir = _u.subVectors(camPos, tgt), len = dir.length();
    camera.position.copy(camPos);
    if (len > 0.01) { dir.divideScalar(len); const h = world.raycast(tgt, dir, len); if (h) camera.position.copy(tgt).addScaledVector(dir, Math.max(0.6, h.distance - 0.4)); }
    camera.up.copy(camUp);
    camLook.copy(root.position).addScaledVector(camUp, 1.1).addScaledVector(_f, 3);
    camera.lookAt(camLook);
  } else if (c.type === 'attach') {
    camera.position.copy(c.off).applyQuaternion(q).add(root.position);
    camera.quaternion.copy(q);
    if (c.tilt) camera.rotateX(c.tilt);
    if (c.yaw) camera.rotateY(c.yaw);
    camPos.copy(camera.position); camInit = true;
  } else {
    if (!orb.drag) { orb.idle += dt; if (orb.idle > 1.6) { const f = Math.exp(-dt * 2.2); orb.yaw *= f; orb.pitch *= f; } }
    // direction de référence : avant du véhicule (à plat pour les véhicules au sol, réelle pour les aéronefs)
    _f.set(0, 0, -1).applyQuaternion(q);
    if (c.follow === 'vel' && sp > 8) _f.lerp(_t2.copy(v.vel).normalize(), 0.7).normalize();
    const flat = c.flat !== false;
    const fy = flat ? 0 : clamp(_f.y, -0.85, 0.85);
    _f.y = 0; if (_f.lengthSq() < 1e-4) _f.set(0, 0, -1); _f.normalize();
    const yaw = Math.atan2(_f.x, _f.z) + orb.yaw, pitch = Math.atan2(c.h, c.dist) - Math.asin(fy) * 0.8 + orb.pitch;
    const dist = Math.hypot(c.dist, c.h) + Math.min(c.dist * 0.4, sp * 0.02 * (c.speedPull || 1));
    _t.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    const tgt = _t2.copy(root.position).add(_u.set(0, c.look || 1, 0));
    const desired = _t.add(tgt);
    if (camInit) { camPos.copy(desired); camInit = false; }
    camPos.lerp(desired, 1 - Math.exp(-dt * (c.stiff || 9)));
    const g = world.groundAt(camPos.x, camPos.z, camPos.y) + 0.6;
    if (camPos.y < g) camPos.y = g;
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camLook.copy(tgt);
    camera.lookAt(camLook);
    if (c.roll) { _u.set(1, 0, 0).applyQuaternion(q); camera.rotateZ(clamp(-_u.y, -0.6, 0.6) * c.roll); }
  }
  if (shakeAmt > 0) { camera.position.add(_t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shakeAmt * 0.35)); shakeAmt = Math.max(0, shakeAmt - dt * 2.2); }
  const fovT = (c.fov || 62) + Math.min(24, sp * 0.12);
  camera.fov = lerp(camera.fov, fovT, 1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix();
}

// ---------- menu, pause, carte ----------
let started = false, paused = true;
function startGame() {
  audio.init();
  paused = false; started = true;
  $('menu').classList.add('hide');
}
function openMenu() { paused = true; $('menu').classList.remove('hide'); $('go').textContent = 'Reprendre'; }
$('go').onclick = startGame;
$('qbtn').onclick = () => { hiQ = !hiQ; applyQuality(); };
function applyQuality() {
  const sz = hiQ ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  resScale = 1; renderer.setPixelRatio(maxPR()); composer.setPixelRatio(maxPR()); onResize();
  $('qbtn').textContent = hiQ ? 'Qualité : haute' : 'Qualité : performance';
}
$('qbtn').textContent = hiQ ? 'Qualité : haute' : 'Qualité : performance';
function toggleMap(on) {
  const show = on === undefined ? hud.bigmapEl.hidden : on;
  hud.bigmapEl.hidden = !show;
}
hud.bigmapCanvas.addEventListener('click', e => {
  const r = hud.bigmapCanvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * world.SIZE - world.HALF, z = (e.clientY - r.top) / r.height * world.SIZE - world.HALF;
  const g = world.groundAt(x, z), flying = cur.cat === 'plane' || cur.cat === 'heli';
  const id = cur.id; cur.root.visible = false; cur = null;
  if (flying && (g < world.waterAt(x, z) || world.solidAt(x, g + 2, z))) switchVehicle(id, { at: { x, y: g + 250, z, yaw: 0, air: true } });
  else switchVehicle(id, { at: { x, y: g, z, yaw: 0, air: false } });
  hud.toast('Téléportation : ' + world.zoneName(x, z));
  toggleMap(false);
});

addEventListener('keydown', e => {
  if (GAME_CODES.has(e.code)) e.preventDefault();
  if (!started || paused) { if (e.code === 'Enter' || (started && e.code === 'Escape')) startGame(); return; }
  if (e.code === 'Tab') { if (!e.repeat) wheel.show(); return; }
  if (wheel.isOpen) { if (e.code === 'Escape') wheel.close(false); return; }
  keys[e.code] = true;
  if (e.repeat) return;
  hits.add(e.code);
  const k = e.code;
  if (k === 'Escape') { if (!hud.bigmapEl.hidden) toggleMap(false); else openMenu(); }
  else if (k === 'KeyC') { camMode = (camMode + 1) % cur.cams.length; camInit = true; hud.toast('Caméra : ' + cur.cams[camMode].name); }
  else if (k === 'KeyR') { cur.upright ? cur.upright() : null; hud.toast('Véhicule remis d\'aplomb'); }
  else if (k === 'KeyH') $('help').classList.toggle('hide');
  else if (k === 'KeyM') toggleMap();
  else if (k === 'KeyN') { timeOfDay = (timeOfDay + 6) % 24; hud.toast('Heure : ' + fmtTime(timeOfDay)); }
  else if (k === 'KeyP') { audio.muted = !audio.muted; hud.toast(audio.muted ? 'Son coupé' : 'Son activé'); }
  else if (k === 'KeyX') { hiQ = !hiQ; applyQuality(); hud.toast(hiQ ? 'Qualité haute' : 'Qualité performance'); }
  else if (cur.onKey) cur.onKey(k);
});
addEventListener('keyup', e => { if (e.code === 'Tab') { wheel.close(true); return; } keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (wheel.isOpen) wheel.close(false); });
$('wheelbtn').addEventListener('click', () => { if (wheel.isOpen) wheel.close(false); else wheel.show(); });
$('mapbtn').addEventListener('click', () => toggleMap());

function onResize() {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h);
}
addEventListener('resize', onResize);

// ---------- boucle ----------
const START = { x: 3, y: 8, z: 120, yaw: 0 };
let saved = 'tesla'; try { saved = localStorage.getItem('monde:vehicle') || 'tesla'; } catch (e) { /* stockage indisponible */ }
switchVehicle(roster.ids.includes(saved) ? saved : 'tesla');
hud.setScore(score);
let last = performance.now(), acc = 0, slow = 1;
const H = 1 / 120;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  slow = lerp(slow, wheel.isOpen ? 0.12 : 1, 1 - Math.exp(-rdt * 10));
  const dt = rdt * slow;
  if (!paused) {
    acc += dt;
    let n = 0;
    if (rising) {
      rising.t += dt; const k = Math.min(1, rising.t / rising.dur), e = k * k * (3 - 2 * k);
      cur.pos.y = rising.y0 + (rising.y1 - rising.y0) * e; acc = 0; hits.clear();
      if (k >= 1) { rising = null; if (cur.onRise) cur.onRise(); }
    } else while (acc >= H && n < 8) { cur.step(H, K); hits.clear(); acc -= H; n++; }
    if (n === 8) acc = 0;
    if (crashT > 0 && (crashT -= rdt) <= 0) respawnNearRoad(null);
  }
  const env = { night: nightF, time: now / 1000 };
  cur.visual(paused ? 0 : dt, env);
  if (!started) {
    const a = now / 9000, p = cur.root.position;
    camera.position.set(p.x + Math.sin(a) * 9, p.y + 3, p.z + Math.cos(a) * 9); camera.up.set(0, 1, 0); camera.lookAt(p.x, p.y + 0.8, p.z);
    camera.fov = 50; camera.updateProjectionMatrix();
  } else updateCamera(rdt);
  updateDayNight(paused ? 0 : dt, cur.pos, camera.position.y - world.heightAt(camera.position.x, camera.position.z));
  world.update(dt, camera.position, scene.fog.far);
  // l'interface (DOM, minicarte) est rafraîchie 15 fois par seconde, pas à chaque image
  hudT += rdt;
  if (hudT >= 1 / 15) {
  const h = cur.hud();
  _f.set(0, 0, -1).applyQuaternion(cur.root.quaternion);
  hud.update(hudT, {
    speed: h.speed, hud: h, x: cur.pos.x, z: cur.pos.z, heading: Math.atan2(_f.x, -_f.z),
    viewR: cur.cat === 'plane' ? 2200 : cur.cat === 'heli' ? 1200 : 450 + Math.min(600, h.speed * 6),
    clock: fmtTime(timeOfDay), clockIcon: nightF > 0.5 ? '🌙' : (timeOfDay > 17 && timeOfDay < 20) ? '🌇' : '☀️', zone: world.zoneName(cur.pos.x, cur.pos.z),
  });
  hudT = 0;
  }
  audio.update(cur.audio(), cur.vel.length(), paused || wheel.isOpen);
  if (innerWidth < 2 || innerHeight < 2) return;
  if (hiQ) composer.render(); else renderer.render(scene, camera);
  adaptResolution(rdt);
}
/* Résolution dynamique : vise ~55 images/s. Si ça reste lent en qualité haute, on passe en qualité performance. */
let hudT = 1, resScale = 1, frameAvg = 16, resT = 0, slowT = 0;
function adaptResolution(dt) {
  if (paused || document.hidden || !started) return;
  frameAvg = lerp(frameAvg, dt * 1000, 0.05);
  resT += dt;
  if (resT < 1) return;
  resT = 0;
  let ns = resScale;
  if (frameAvg > 20 && resScale > 0.6) ns = Math.max(0.6, resScale - 0.1);
  else if (frameAvg < 14 && resScale < 1) ns = Math.min(1, resScale + 0.05);
  if (ns !== resScale) { resScale = ns; const pr = maxPR() * resScale; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); onResize(); }
  slowT = frameAvg > 26 && resScale <= 0.6 ? slowT + 1 : 0;
  if (slowT >= 4 && hiQ) { hiQ = false; applyQuality(); hud.toast('Qualité performance activée automatiquement (X pour changer)'); slowT = 0; }
}
$('loading').classList.add('hide');
requestAnimationFrame(frame);
window.__monde = { get rising() { return rising; }, world, roster, K, keys, scene, camera, renderer, get cur() { return cur; }, switchVehicle, setTime: h => { timeOfDay = h; } };

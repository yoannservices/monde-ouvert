/* Sons synthétisés (Web Audio) : un moteur paramétrable selon le type de véhicule, vent, chocs */
import { clamp } from './util.js';

export function createAudio() {
  let ac = null, nodes = null, muted = false;
  function init() {
    if (ac) { ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const noise = () => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
      // moteur : deux oscillateurs filtrés + modulation d'amplitude (rotors, pales)
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), eg = ac.createGain(), am = ac.createGain(), lfo = ac.createOscillator(), lfoG = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.Q.value = 2; eg.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(am); am.connect(eg); eg.connect(master);
      lfo.frequency.value = 0; lfoG.gain.value = 0; lfo.connect(lfoG); lfoG.connect(am.gain); am.gain.value = 1;
      o1.start(); o2.start(); lfo.start();
      // souffle (réacteur, propulseurs, hélices)
      const n1 = noise(), bp = ac.createBiquadFilter(), bg = ac.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.8; bg.gain.value = 0;
      n1.connect(bp); bp.connect(bg); bg.connect(master);
      // vent
      const n2 = noise(), wl = ac.createBiquadFilter(), wg = ac.createGain(); wl.type = 'lowpass'; wl.frequency.value = 500; wg.gain.value = 0;
      n2.connect(wl); wl.connect(wg); wg.connect(master);
      // crissement des pneus
      const n3 = noise(), sq = ac.createBiquadFilter(), sg = ac.createGain(); sq.type = 'bandpass'; sq.frequency.value = 1300; sq.Q.value = 2.5; sg.gain.value = 0;
      n3.connect(sq); sq.connect(sg); sg.connect(master);
      nodes = { master, o1, o2, lp, eg, am, lfo, lfoG, bp, bg, wl, wg, sq, sg };
    } catch (e) { ac = null; }
  }
  /* a = {kind, rpm 0..1, load 0..1, boost, slip, thrust} ; speed en m/s */
  function update(a, speed, paused) {
    if (!ac || !nodes) return;
    const t = ac.currentTime, N = nodes, k = a.kind, rpm = clamp(a.rpm || 0, 0, 1.3), load = a.load || 0;
    N.master.gain.setTargetAtTime(muted || paused ? 0 : 0.5, t, 0.05);
    let f1 = 60, f2 = 30, cut = 900, vol = 0, lf = 0, lfd = 0, hiss = 0, hissF = 800;
    switch (k) {
      case 'electric': f1 = 140 + rpm * 900; f2 = 70 + rpm * 300; cut = 900 + rpm * 2200 + load * 800; vol = 0.02 + rpm * 0.05 + load * 0.03; break;
      case 'car': { const g = Math.min(4, Math.floor(rpm * 5)), r = rpm * 5 - g; f1 = 55 + r * 75 + g * 12 + load * 14; f2 = f1 / 2; cut = 650 + load * 600; vol = 0.03 + load * 0.04; break; }
      case 'v12': { const g = Math.min(6, Math.floor(rpm * 7)), r = rpm * 7 - g; f1 = 90 + r * 140 + g * 10 + load * 20; f2 = f1 * 0.5; cut = 900 + load * 1400 + r * 600; vol = 0.035 + load * 0.05; break; }
      case 'moto': f1 = 40 + rpm * 230; f2 = f1 * 0.5; cut = 600 + rpm * 2600 + load * 900; vol = 0.05 + load * 0.08 + rpm * 0.03; break;
      case 'scooter': f1 = 220 + rpm * 700; f2 = 110 + rpm * 350; cut = 1200 + rpm * 1800; vol = 0.01 + rpm * 0.03; break;
      case 'kick': vol = 0; hiss = Math.min(0.25, speed * 0.02); hissF = 380 + speed * 80; break;
      case 'rotor': f1 = 32 + rpm * 20; f2 = 64 + rpm * 30; cut = 260 + load * 300; vol = 0.08 * rpm; lf = (a.blades || 2) * (a.rotorHz || 6) * rpm; lfd = 0.85; hiss = 0.05 * rpm + load * 0.05; hissF = 500; break;
      case 'jet': f1 = 120 + rpm * 500; f2 = 2400 + rpm * 1800; cut = 3000; vol = 0.012 + rpm * 0.02; hiss = 0.05 + rpm * 0.25 + (a.boost ? 0.25 : 0); hissF = 500 + rpm * 400; break;
      case 'prop': f1 = 70 + rpm * 60; f2 = 140 + rpm * 120; cut = 700; vol = 0.05 * Math.max(0.2, rpm); lf = 4 * 12 * Math.max(0.2, rpm); lfd = 0.4; hiss = 0.04 + rpm * 0.12; hissF = 700; break;
      case 'drone': f1 = 260 + rpm * 900; f2 = 520 + rpm * 1500; cut = 2500 + rpm * 3000; vol = 0.012 + rpm * 0.035; hiss = rpm * 0.05; hissF = 2400; break;
    }
    if (a.boost && k !== 'jet') hiss += 0.3;
    N.o1.frequency.setTargetAtTime(f1, t, 0.04); N.o2.frequency.setTargetAtTime(f2, t, 0.04);
    N.lp.frequency.setTargetAtTime(cut, t, 0.05); N.eg.gain.setTargetAtTime(vol, t, 0.08);
    N.lfo.frequency.setTargetAtTime(lf, t, 0.1); N.lfoG.gain.setTargetAtTime(lfd * 0.5, t, 0.1); N.am.gain.setTargetAtTime(1 - lfd * 0.5, t, 0.1);
    N.bg.gain.setTargetAtTime(hiss, t, 0.06); N.bp.frequency.setTargetAtTime(hissF, t, 0.1);
    N.wg.gain.setTargetAtTime(Math.min(0.25, speed * speed * 0.000016), t, 0.2); N.wl.frequency.setTargetAtTime(300 + speed * 6, t, 0.2);
    N.sg.gain.setTargetAtTime((a.slip || 0) * 0.09, t, 0.05);
  }
  function impact(v) {
    if (!ac || muted || !nodes) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    g.gain.setValueAtTime(Math.min(0.8, v / 40), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(nodes.master); o.start(t); o.stop(t + 0.4);
  }
  function whoosh() {
    if (!ac || muted || !nodes) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.18);
    f.type = 'bandpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(f); f.connect(g); g.connect(nodes.master); o.start(t); o.stop(t + 0.3);
  }
  return { init, update, impact, whoosh, get muted() { return muted; }, set muted(v) { muted = v; } };
}

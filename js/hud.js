/* Interface : compteur, jauges, minicarte, grande carte, messages, aide contextuelle */
import { clamp } from './util.js';

const $ = id => document.getElementById(id);

export function createHUD(world) {
  const mini = $('mini'), mg = mini.getContext('2d');
  const bigmap = $('bigmap'), bmc = $('bigmapc'), bg = bmc.getContext('2d');
  let toastT = 0, trickT = 0, zoneT = 0, lastZone = '';
  const MAPSZ = world.mapCanvas.width, W2M = MAPSZ / world.SIZE;

  function toast(t) { const e = $('msg'); e.textContent = t; e.classList.add('on'); toastT = 2.4; }
  function trick(title, sub) {
    const e = $('trick'); $('tricktitle').textContent = title; $('tricksub').textContent = sub || '';
    e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); trickT = 2.6;
  }
  function drift(D) {
    const e = $('drift');
    if (D) { e.classList.add('on'); e.innerHTML = `DRIFT ${Math.round(D.pts).toLocaleString('fr-FR')}<i>×${D.mult.toFixed(1)}</i>`; }
    else e.classList.remove('on');
  }
  function setVehicle(v, catName) {
    $('vname').textContent = v.name; $('vcat').textContent = catName;
    $('helpgrid').innerHTML = v.help.map(([k, d]) => `<span>${k.split(' / ').map(x => `<kbd>${x}</kbd>`).join(' / ')}</span><span>${d}</span>`).join('');
  }
  function setScore(total) { $('scoreval').textContent = total.toLocaleString('fr-FR'); }

  function drawMini(x, z, heading, viewR, markers) {
    const S = mini.width, R = S / 2;
    mg.clearRect(0, 0, S, S);
    mg.save(); mg.beginPath(); mg.arc(R, R, R - 2, 0, Math.PI * 2); mg.clip();
    mg.fillStyle = '#16384a'; mg.fillRect(0, 0, S, S);
    mg.translate(R, R); mg.rotate(-heading);
    const k = R / viewR, src = viewR * W2M * 1.5;
    const sx = (x + world.HALF) * W2M, sz = (z + world.HALF) * W2M;
    mg.drawImage(world.mapCanvas, sx - src, sz - src, src * 2, src * 2, -viewR * 1.5 * k, -viewR * 1.5 * k, viewR * 3 * k, viewR * 3 * k);
    // nord
    mg.restore();
    mg.save(); mg.translate(R, R);
    const na = -heading - Math.PI / 2, nr = R - 13;
    mg.fillStyle = '#fff'; mg.font = 'bold 12px Barlow, sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
    mg.beginPath(); mg.arc(Math.cos(na) * nr, Math.sin(na) * nr, 9, 0, Math.PI * 2); mg.fillStyle = 'rgba(10,14,20,.8)'; mg.fill();
    mg.fillStyle = '#ff5a4a'; mg.fillText('N', Math.cos(na) * nr, Math.sin(na) * nr + 0.5);
    // joueur
    mg.fillStyle = '#ffd34a'; mg.strokeStyle = '#111'; mg.lineWidth = 2;
    mg.beginPath(); mg.moveTo(0, -9); mg.lineTo(6.5, 7); mg.lineTo(0, 3.5); mg.lineTo(-6.5, 7); mg.closePath(); mg.stroke(); mg.fill();
    mg.restore();
    mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineWidth = 3; mg.beginPath(); mg.arc(R, R, R - 2, 0, Math.PI * 2); mg.stroke();
  }
  function drawBig(x, z, heading) {
    const S = Math.min(innerWidth, innerHeight) * 0.86 | 0;
    if (bmc.width !== S) { bmc.width = S; bmc.height = S; }
    bg.drawImage(world.mapCanvas, 0, 0, S, S);
    const k = S / world.SIZE, px = (x + world.HALF) * k, pz = (z + world.HALF) * k;
    bg.font = '600 13px Barlow, sans-serif'; bg.textAlign = 'center';
    for (const [n, lx, lz] of LABELS) { bg.fillStyle = 'rgba(0,0,0,.55)'; bg.fillText(n, (lx + world.HALF) * k + 1, (lz + world.HALF) * k + 1); bg.fillStyle = '#fff'; bg.fillText(n, (lx + world.HALF) * k, (lz + world.HALF) * k); }
    bg.save(); bg.translate(px, pz); bg.rotate(heading);
    bg.fillStyle = '#ffd34a'; bg.strokeStyle = '#111'; bg.lineWidth = 2;
    bg.beginPath(); bg.moveTo(0, -11); bg.lineTo(8, 9); bg.lineTo(0, 4); bg.lineTo(-8, 9); bg.closePath(); bg.stroke(); bg.fill();
    bg.restore();
  }
  const LABELS = [['Ville', 0, -40], ['Aéroport', 1700, 640], ['Parc de cascades', 1255, 1180], ['Désert', 1900, -1000], ['Montagnes', 0, -2550], ['Col des Aigles', 0, -2010], ['Forêt', -2100, -500], ['Campagne', 300, 1500], ['Lac', -1250, 1620], ['Plage', 0, 2850], ['Île aux Palmiers', 2950, 2950], ['Îlot du Phare', -3450, 380]];

  function speedo(sp, h) {
    const kmh = Math.round(sp * 3.6);
    $('spd').textContent = kmh;
    const lines = [];
    if (h.alt != null) lines.push(`<span>ALT</span><b>${Math.round(h.alt)} m</b>`);
    if (h.vs != null) lines.push(`<span>V/S</span><b>${h.vs >= 0 ? '+' : ''}${h.vs.toFixed(1)} m/s</b>`);
    if (h.thr != null) lines.push(`<span>${h.thrLabel || 'GAZ'}</span><b>${Math.round(h.thr * 100)} %</b>`);
    if (h.lines) for (const [a, b] of h.lines) lines.push(`<span>${a}</span><b>${b}</b>`);
    $('spdx').innerHTML = lines.join('');
    const g = $('gauge');
    if (h.gauge) { g.hidden = false; $('gaugel').textContent = h.gauge.label; $('gaugef').style.width = clamp(h.gauge.value, 0, 1) * 100 + '%'; g.classList.toggle('act', !!h.gauge.active); }
    else g.hidden = true;
  }

  function update(dt, s) {
    speedo(s.speed, s.hud);
    drawMini(s.x, s.z, s.heading, s.viewR, null);
    if (!bigmap.hidden) drawBig(s.x, s.z, s.heading);
    $('clock').textContent = s.clock; $('clockicon').textContent = s.clockIcon;
    if (s.zone !== lastZone) { lastZone = s.zone; const e = $('zone'); e.textContent = s.zone; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); zoneT = 3; }
    if (toastT > 0 && (toastT -= dt) <= 0) $('msg').classList.remove('on');
    if (trickT > 0 && (trickT -= dt) <= 0) $('trick').classList.remove('on');
    if (zoneT > 0 && (zoneT -= dt) <= 0) $('zone').classList.remove('on');
  }
  return { toast, trick, drift, setVehicle, setScore, update, bigmapEl: bigmap, bigmapCanvas: bmc };
}

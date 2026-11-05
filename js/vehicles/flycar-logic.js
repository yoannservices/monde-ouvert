/* Règles pures de la voiture volante (sans Three.js, testables avec Node : test/flycar-check.mjs).
   Inspirées du mod Cyberpunk « Let There Be Flight » : modes de vol, sortie en maintenant. Pas de système de vie. */
export const MODES = ['Hover & Fly', 'Drone', 'Vol'];
export const EXIT_HOLD = 0.3;     // secondes à maintenir F pour sortir
export const LAND_MAX_SINK = 9;   // vitesse de descente max pour se poser sur les roues

export const nextMode = (i, d) => (i + d + MODES.length) % MODES.length;
/* sink : vitesse de descente (m/s), upY : verticalité de la voiture (1 = à plat), horiz : vitesse horizontale (m/s) */
export const canLand = (sink, upY, horiz) => sink <= LAND_MAX_SINK && upY > 0.8 && horiz < 30;

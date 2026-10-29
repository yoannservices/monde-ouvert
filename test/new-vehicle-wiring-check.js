const assert = require('assert');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '../js/vehicles/index.js'), 'utf8');
assert(source.includes("heli_small: { file: 'petit helico'"), 'small helicopter GLB should be wired');
assert(source.includes("heli_big: { file: 'gros helico'"), 'large helicopter GLB should be wired');
assert(source.includes('v.m.main.rot') && source.includes('v.m.tail.rot'), 'animated helicopter rotors must remain');
console.log('Open World helicopter model wiring verified');

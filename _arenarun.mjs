import { buildArenaScene } from './_arena_t.mjs';
let added=0; const scene={add(){added++;}}; const renderer={shadowMap:{}};
const r=buildArenaScene(scene, renderer);
console.log('ArenaScene v3 OK. objetos:', added, ' devuelve ground:', !!(r&&r.ground));

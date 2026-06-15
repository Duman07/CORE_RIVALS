import { buildArenaScene } from './_arena_t.mjs';
let n=0; const scene={add(){n++;}}; const r=buildArenaScene(scene,{shadowMap:{}});
console.log('ArenaScene OK, objetos:',n,'ground:',!!(r&&r.ground));

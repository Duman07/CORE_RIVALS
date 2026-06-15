import { terrainHeight } from './shared/terrain/TerrainUtils.js';
import { getObstacles } from './shared/arena/ArenaLayout.js';
let ok=true;
for(const o of getObstacles()){
  // muestreo del terreno bajo la huella
  const hl = o.kind==='wall'? o.hw : o.radius;
  const hd = o.kind==='wall'? o.hd : o.radius;
  const cos=Math.cos(o.yaw||0), sin=Math.sin(o.yaw||0);
  let tmin=Infinity,tmax=-Infinity;
  for(let u=-1;u<=1;u++)for(let v=-1;v<=1;v++){
    const lx=u*hl,lz=v*hd; const wx=o.x+lx*cos+lz*sin, wz=o.z-lx*sin+lz*cos;
    const h=terrainHeight(wx,wz); tmin=Math.min(tmin,h); tmax=Math.max(tmax,h);
  }
  const bottom=o.cy-o.hh, top=o.cy+o.hh;
  const buried = bottom <= tmin + 1e-6;       // base por debajo del punto más bajo
  const clears = top >= tmax + 1.0;            // tope bien por encima del más alto
  if(!buried||!clears){ ok=false; console.log('  FALLA',o.kind,'bottom',bottom.toFixed(2),'tmin',tmin.toFixed(2),'top',top.toFixed(2),'tmax',tmax.toFixed(2)); }
}
console.log(ok?'  TODOS anclados correctamente (sin flotar, tope visible)':'  HAY PROBLEMAS');

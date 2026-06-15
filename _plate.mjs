import { terrainHeight } from './shared/terrain/TerrainUtils.js';
// Replica de makeConformingPlate + transforma cada vértice como lo hace Three (Ry(theta) + pos)
const CORE={x:26,y:0,z:15}; // un Core
const lx=0, lz=13, w=4, len=18, yOffset=0.05;
const theta=Math.atan2(CORE.x,CORE.z), cos=Math.cos(theta), sin=Math.sin(theta);
const cwx=lx*cos+lz*sin, cwz=-lx*sin+lz*cos;
// vértices de muestra (esquinas del plano local en XZ)
const verts=[[-w/2,-len/2],[w/2,-len/2],[-w/2,len/2],[w/2,len/2],[0,0]];
let maxErr=0;
for(const [vx,vz] of verts){
  // y horneado en el vértice (local)
  const wx=cwx+(vx*cos+vz*sin), wz=cwz+(-vx*sin+vz*cos);
  const yLocal=terrainHeight(wx,wz)+yOffset;
  // transforma como Three: world = Ry(theta)*(vx,yLocal,vz) + (cwx,0,cwz)
  const worldX=cwx+(vx*cos+vz*sin);
  const worldZ=cwz+(-vx*sin+vz*cos);
  const worldY=yLocal; // Y no cambia con rotación en Y
  const expected=terrainHeight(worldX,worldZ)+yOffset;
  maxErr=Math.max(maxErr,Math.abs(worldY-expected));
}
console.log('Placa centrada en spoke -> mundo (', cwx.toFixed(1), ',', cwz.toFixed(1), ') hacia Core');
console.log('Error máx altura vértice vs terreno:', maxErr.toFixed(6), maxErr<1e-9?'(CONFORMA EXACTO)':'(REVISAR)');

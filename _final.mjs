import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const BR=0.25, WALL_HALF=36, WALL_HEIGHT=8, WALL_REST=0.8, IMP=7, ANG=0.576;
const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,Hf=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;Hf[r*(N+1)+c]=terrainHeight(x,z);}}
function mkWorld(){
  const w=new RAPIER.World({x:0,y:-9.81,z:0});
  const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,Hf,{x:S,y:1,z:S}).setFriction(0.6),fb);
  const hy=WALL_HEIGHT/2, cy=hy-1, span=WALL_HALF+2, h=WALL_HALF;
  for(const [cx,cyy,cz,hx,hhy,hz] of [[0,cy,h,span,hy,0.5],[0,cy,-h,span,hy,0.5],[h,cy,0,0.5,hy,span],[-h,cy,0,0.5,hy,span]]){
    const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx,cyy,cz));
    w.createCollider(RAPIER.ColliderDesc.cuboid(hx,hhy,hz).setRestitution(WALL_REST).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),b);
  }
  return w;
}
function mkBall(w,x,z){const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,terrainHeight(x,z)+BR,z).setLinearDamping(0.55).setAngularDamping(0.8));w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35),b);return b;}
// Tiro a máxima potencia desde cerca de una pared, apuntando a la pared (+Z)
const w=mkWorld(); const b=mkBall(w,0,28);
const horiz=IMP*Math.cos(ANG), vert=IMP*Math.sin(ANG);
b.applyImpulse({x:0,y:vert,z:-(-horiz)},true); // hacia +Z (pared norte)
let peak=0,maxY=0,bounced=false,escaped=false;
for(let i=0;i<2500;i++){w.step();const t=b.translation();const v=b.linvel();peak=Math.max(peak,t.y-(terrainHeight(t.x,t.z)+BR));maxY=Math.max(maxY,t.y);if(v.z<-0.5)bounced=true;if(Math.abs(t.x)>WALL_HALF+0.6||Math.abs(t.z)>WALL_HALF+0.6){escaped=true;break;}if(Math.hypot(v.x,v.y,v.z)<0.15)break;}
const t=b.translation();
console.log('Tiro full hacia pared: alturaPico='+peak.toFixed(1)+'m  maxY='+maxY.toFixed(1)+' (top muro='+WALL_HEIGHT+')');
console.log('  rebotó hacia adentro:',bounced,' escapó:',escaped,' final z='+t.z.toFixed(1)+' (dentro ±36:',Math.abs(t.z)<36&&Math.abs(t.x)<36,')');
console.log('RESULT:',(peak>2 && !escaped && bounced)?'PASS':'CHECK');

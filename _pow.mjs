import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const BR=0.25;
function mk(lin,ang){
  const w=new RAPIER.World({x:0,y:-9.81,z:0});
  const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,h=new Float32Array((N+1)*(N+1));
  for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;h[r*(N+1)+c]=terrainHeight(x,z);}}
  const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,h,{x:S,y:1,z:S}).setFriction(0.6),fb);
  const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,terrainHeight(0,0)+BR,0).setLinearDamping(lin).setAngularDamping(ang));
  w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35).setFriction(0.5),b);
  return {w,b};
}
function shot(lin,ang,imp,loft){
  const {w,b}=mk(lin,ang);
  // mass
  const mass=b.mass();
  b.applyImpulse({x:0,y:loft,z:-imp},true); // straight -Z
  let maxAir=0;
  for(let i=0;i<1500;i++){ w.step(); const t=b.translation(); maxAir=Math.max(maxAir,t.y-(terrainHeight(t.x,t.z)+BR)); const v=b.linvel(); if(Math.hypot(v.x,v.y,v.z)<0.15) break; }
  const t=b.translation();
  return {dist:Math.hypot(t.x,t.z), mass, air:maxAir};
}
const m=mk(1,1).b.mass(); console.log('ball mass kg:', m.toFixed(3));
for(const lin of [0.4,0.55,0.7]){
  for(const imp of [4,6,8]){
    const r=shot(lin,0.8,imp,imp*0.25);
    console.log(`lin=${lin} imp=${imp}  dist=${r.dist.toFixed(1)}m air=${r.air.toFixed(2)}m`);
  }
}
rm:0;

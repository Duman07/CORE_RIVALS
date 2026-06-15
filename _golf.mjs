import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const BR=0.25;
const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,H=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;H[r*(N+1)+c]=terrainHeight(x,z);}}
function world(wallRest){
  const w=new RAPIER.World({x:0,y:-9.81,z:0});
  const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,H,{x:S,y:1,z:S}).setFriction(0.6),fb);
  for(const [cx,cy,cz,hx,hy,hz] of [[0,2.5,36,38,4,0.5],[0,2.5,-36,38,4,0.5],[36,2.5,0,0.5,4,38],[-36,2.5,0,0.5,4,38]]){
    const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx,cy,cz));
    w.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setRestitution(wallRest).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),b);
  }
  return w;
}
function ball(w,x,z){
  const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,terrainHeight(x,z)+BR,z).setLinearDamping(0.55).setAngularDamping(0.8));
  w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35),b);
  return b;
}
function shot(imp,angleDeg){
  const w=world(0.8); const b=ball(w,0,0);
  const a=angleDeg*Math.PI/180, M=imp;
  b.applyImpulse({x:0,y:M*Math.sin(a),z:-M*Math.cos(a)},true);
  let peak=0;
  for(let i=0;i<2000;i++){w.step();const t=b.translation();peak=Math.max(peak,t.y-(terrainHeight(t.x,t.z)+BR));const v=b.linvel();if(Math.hypot(v.x,v.y,v.z)<0.15)break;}
  const t=b.translation();return {dist:Math.hypot(t.x,t.z),peak};
}
console.log('--- modelo ángulo de lanzamiento (full power) ---');
for(const imp of [7,8,9]) for(const ang of [28,33]){const r=shot(imp,ang);console.log(`imp=${imp} ang=${ang}°  dist=${r.dist.toFixed(1)}m  alturaPico=${r.peak.toFixed(1)}m`);}
console.log('--- rebote contra pared (imp recto +X, low) ---');
{ const w=world(0.8); const b=ball(w,20,0); b.applyImpulse({x:9,y:1.0,z:0},true);
  let bounced=false,minVx=0;
  for(let i=0;i<1200;i++){w.step();const v=b.linvel();if(v.x<-0.5)bounced=true;const t=b.translation(); if(Math.abs(t.x)>36.5){console.log('ESCAPO en x=',t.x.toFixed(1));break;}}
  const t=b.translation();
  console.log('rebotó hacia adentro:',bounced,' posicion final x=',t.x.toFixed(1),'(dentro de ±36:',Math.abs(t.x)<36,')');
}

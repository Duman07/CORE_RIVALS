import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
import { getObstacles, surfaceAt, SURFACE_DAMPING } from './shared/arena/ArenaLayout.js';
await RAPIER.init();
const BR=0.25, PLAYER_Y=0.85;
const GRP_PLAYER=1,GRP_BALL=2,GRP_WORLD=4,GRP_SOLID=8;
const CGRP_PLAYER=(GRP_PLAYER<<16)|(GRP_WORLD|GRP_PLAYER|GRP_SOLID);
const CGRP_BALL=(GRP_BALL<<16)|(GRP_WORLD|GRP_SOLID);
const CGRP_WORLD=(GRP_WORLD<<16)|(GRP_PLAYER|GRP_BALL);
const CGRP_SOLID=((GRP_WORLD|GRP_SOLID)<<16)|(GRP_PLAYER|GRP_BALL);
const SOLID_FILTER=(0xFFFF<<16)|GRP_SOLID;
function build(){
  const w=new RAPIER.World({x:0,y:-9.81,z:0});
  const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,Hf=new Float32Array((N+1)*(N+1));
  for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;Hf[r*(N+1)+c]=terrainHeight(x,z);}}
  const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,Hf,{x:S,y:1,z:S}).setFriction(0.6).setCollisionGroups(CGRP_WORLD),fb);
  for(const o of getObstacles()){
    const y=terrainHeight(o.x,o.z)+o.hh;
    if(o.kind==='wall'){
      const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(o.x,y,o.z).setRotation({x:0,y:Math.sin(o.yaw/2),z:0,w:Math.cos(o.yaw/2)}));
      w.createCollider(RAPIER.ColliderDesc.cuboid(o.hw,o.hh,o.hd).setRestitution(0.6).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max).setCollisionGroups(CGRP_SOLID),b);
    } else {
      const b=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(o.x,y,o.z));
      w.createCollider(RAPIER.ColliderDesc.cylinder(o.hh,o.radius).setRestitution(0.5).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max).setCollisionGroups(CGRP_SOLID),b);
    }
  }
  return w;
}
// TEST 1: jugador choca con muro funnel del Core 0
{ const w=build(); const ctrl=w.createCharacterController(0.05);
  const obs=getObstacles().filter(o=>o.kind==='wall');
  const target=obs[0]; // un muro funnel
  // empieza 4m antes del muro hacia el centro y empuja hacia el muro
  const dirx=target.x/Math.hypot(target.x,target.z), dirz=target.z/Math.hypot(target.x,target.z);
  let px=target.x-dirx*5, pz=target.z-dirz*5;
  const pb=w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(px,terrainHeight(px,pz)+PLAYER_Y,pz));
  const pcol=w.createCollider(RAPIER.ColliderDesc.capsule(0.45,0.40).setCollisionGroups(CGRP_PLAYER),pb);
  let blocked=false;
  for(let i=0;i<60;i++){
    const cur=pb.translation(); const dx=dirx*0.25, dz=dirz*0.25;
    ctrl.computeColliderMovement(pcol,{x:dx,y:0,z:dz},undefined,SOLID_FILTER);
    const mv=ctrl.computedMovement();
    const nx=cur.x+mv.x, nz=cur.z+mv.z;
    pb.setNextKinematicTranslation({x:nx,y:terrainHeight(nx,nz)+PLAYER_Y,z:nz}); w.step();
  }
  const t=pb.translation();
  const distToWall=Math.hypot(t.x-target.x,t.z-target.z);
  console.log('TEST1 jugador vs muro funnel: dist final al muro=',distToWall.toFixed(2),'m (frenó, no atravesó:',distToWall>0.7,')');
}
// TEST 2: rebote pelota contra muro funnel
{ const w=build(); const obs=getObstacles().filter(o=>o.kind==='wall')[0];
  const dirx=obs.x/Math.hypot(obs.x,obs.z), dirz=obs.z/Math.hypot(obs.x,obs.z);
  const sx=obs.x-dirx*3, sz=obs.z-dirz*3;
  const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(sx,terrainHeight(sx,sz)+BR,sz).setLinearDamping(0.2).setAngularDamping(0.8));
  w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35),b);
  b.applyImpulse({x:dirx*5,y:0.3,z:dirz*5},true);
  let approached=1e9, rebounded=false; const d0=Math.hypot(sx-obs.x,sz-obs.z);
  for(let i=0;i<400;i++){w.step();const t=b.translation();const d=Math.hypot(t.x-obs.x,t.z-obs.z);approached=Math.min(approached,d);if(i>5){const v=b.linvel();const away=(v.x*dirx+v.z*dirz);if(away<-0.5)rebounded=true;}}
  console.log('TEST2 pelota vs muro: se acercó a',approached.toFixed(2),'m y rebotó:',rebounded);
}
// TEST 3: distancia segun damping de superficie
{ function roll(d){const w=build();const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,terrainHeight(0,0)+BR,0).setLinearDamping(d).setAngularDamping(0.8));w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35).setFriction(0.5),b);b.applyImpulse({x:0,y:0,z:-4},true);for(let i=0;i<1500;i++){w.step();const v=b.linvel();if(Math.hypot(v.x,v.y,v.z)<0.12)break;}const t=b.translation();return Math.hypot(t.x,t.z);}
  console.log('TEST3 rodadura  metal('+SURFACE_DAMPING.metal+')='+roll(SURFACE_DAMPING.metal).toFixed(1)+'m  grass('+SURFACE_DAMPING.grass+')='+roll(SURFACE_DAMPING.grass).toFixed(1)+'m  sand('+SURFACE_DAMPING.sand+')='+roll(SURFACE_DAMPING.sand).toFixed(1)+'m');
}
console.log('surfaceAt(0,-14)=',surfaceAt(0,-14),' surfaceAt(0,-24)=',surfaceAt(0,-24),' surfaceAt(0,0)=',surfaceAt(0,0));

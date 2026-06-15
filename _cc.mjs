import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
console.log('createCharacterController?', typeof (new RAPIER.World({x:0,y:0,z:0})).createCharacterController);
const GRP_PLAYER=0x0001,GRP_BALL=0x0002,GRP_WORLD=0x0004,GRP_SOLID=0x0008;
const CGRP_PLAYER=(GRP_PLAYER<<16)|(GRP_WORLD|GRP_PLAYER|GRP_SOLID);
const CGRP_SOLID=((GRP_WORLD|GRP_SOLID)<<16)|(GRP_PLAYER|GRP_BALL);
const w=new RAPIER.World({x:0,y:-9.81,z:0});
const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,Hf=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;Hf[r*(N+1)+c]=terrainHeight(x,z);}}
const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,Hf,{x:S,y:1,z:S}).setCollisionGroups((GRP_WORLD<<16)|(GRP_PLAYER|GRP_BALL)),fb);
// obstacle box at (3,?,0), 1m half-extents
const ob=w.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(3,terrainHeight(3,0)+0.6,0));
w.createCollider(RAPIER.ColliderDesc.cuboid(1,0.6,1).setCollisionGroups(CGRP_SOLID),ob);
// player capsule kinematic
const PLAYER_Y=0.85;
const pb=w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,terrainHeight(0,0)+PLAYER_Y,0));
const pcol=w.createCollider(RAPIER.ColliderDesc.capsule(0.45,0.40).setCollisionGroups(CGRP_PLAYER),pb);
const ctrl=w.createCharacterController(0.05);
const filterGroups=(0xFFFF<<16)|GRP_SOLID; // solo colisiona con SOLID (excluye heightfield)
function tryMove(dx,dz){
  const cur=pb.translation();
  ctrl.computeColliderMovement(pcol,{x:dx,y:0,z:dz},undefined,filterGroups);
  const mv=ctrl.computedMovement();
  const nx=cur.x+mv.x, nz=cur.z+mv.z;
  pb.setNextKinematicTranslation({x:nx,y:terrainHeight(nx,nz)+PLAYER_Y,z:nz});
  w.step();
  return {req:{dx,dz},got:{x:mv.x,z:mv.z}};
}
// move toward obstacle repeatedly
let r;
for(let i=0;i<40;i++){ r=tryMove(0.2,0); }
const t=pb.translation();
console.log('tras empujar hacia obstáculo (x=3): jugador x=',t.x.toFixed(2),'(deberia frenar < ~1.6)');
// move along open ground (z dir) should be free
const before=pb.translation();
for(let i=0;i<10;i++) tryMove(0,0.2);
const after=pb.translation();
console.log('mov libre en z: dz total=',(after.z-before.z).toFixed(2),'(deberia ~2.0)');

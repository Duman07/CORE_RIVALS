import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const BALL_RADIUS=0.25, PLAYER_Y=0.85;
const world=new RAPIER.World({x:0,y:-9.81,z:0});
const N=TERRAIN_SEGMENTS,SIZE=TERRAIN_SIZE,h=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-SIZE/2+(r/N)*SIZE;for(let c=0;c<=N;c++){const z=-SIZE/2+(c/N)*SIZE;h[r*(N+1)+c]=terrainHeight(x,z);}}
const fb=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(RAPIER.ColliderDesc.heightfield(N,N,h,{x:SIZE,y:1,z:SIZE}).setFriction(0.6),fb);
for(const [cx,cy,cz,hx,hy,hz] of [[0,2.5,36,38,3,0.5],[0,2.5,-36,38,3,0.5],[36,2.5,0,0.5,3,38],[-36,2.5,0,0.5,3,38]]){
  const b=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx,cy,cz));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz),b);
}
const pbody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,terrainHeight(0,-17)+PLAYER_Y,-17));
world.createCollider(RAPIER.ColliderDesc.capsule(0.45,0.40),pbody);
let pErr=0;
for(const [x,z] of [[0,-17],[14.72,8.5],[-10,4],[5,-25],[20,0]]){
  pbody.setNextKinematicTranslation({x,y:terrainHeight(x,z)+PLAYER_Y,z}); world.step();
  const t=pbody.translation(); pErr+=Math.abs(t.y-(terrainHeight(x,z)+PLAYER_Y));
}
const bball=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0).setLinearDamping(1.0).setAngularDamping(1.5));
world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setDensity(5).setRestitution(0.35).setFriction(0.5),bball);
for(let i=0;i<240;i++) world.step();
let t=bball.translation();
const restErr=Math.abs(t.y-(terrainHeight(t.x,t.z)+BALL_RADIUS));
bball.applyImpulse({x:60,y:0,z:0},true);
for(let i=0;i<600;i++) world.step();
t=bball.translation();
const contained=Math.abs(t.x)<37&&Math.abs(t.z)<37&&t.y>terrainHeight(t.x,t.z)-0.5;
console.log('player y err (sum):',pErr.toFixed(4));
console.log('ball rest err:',restErr.toFixed(4),'pos:('+t.x.toFixed(1)+','+t.y.toFixed(2)+','+t.z.toFixed(1)+')');
console.log('ball contained:',contained);
console.log('RESULT:',(pErr<0.01&&restErr<0.05&&contained)?'PASS':'CHECK');

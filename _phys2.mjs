import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const BALL_RADIUS=0.25;
const world=new RAPIER.World({x:0,y:-9.81,z:0});
const N=TERRAIN_SEGMENTS,SIZE=TERRAIN_SIZE,h=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-SIZE/2+(r/N)*SIZE;for(let c=0;c<=N;c++){const z=-SIZE/2+(c/N)*SIZE;h[r*(N+1)+c]=terrainHeight(x,z);}}
const fb=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(RAPIER.ColliderDesc.heightfield(N,N,h,{x:SIZE,y:1,z:SIZE}).setFriction(0.6),fb);
for(const [cx,cy,cz,hx,hy,hz] of [[0,2.5,36,38,3,0.5],[0,2.5,-36,38,3,0.5],[36,2.5,0,0.5,3,38],[-36,2.5,0,0.5,3,38]]){
  const b=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx,cy,cz));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz),b);
}
const bball=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,0).setLinearDamping(1.0).setAngularDamping(1.5));
world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setDensity(5).setRestitution(0.35).setFriction(0.5),bball);
for(let i=0;i<120;i++) world.step();
// realistic max swing impulse 2.5 N·s along +x, then a 2nd toward +z
bball.applyImpulse({x:2.5,y:0.8,z:0},true);
for(let i=0;i<400;i++) world.step();
let t=bball.translation(); const d1=Math.hypot(t.x,t.z);
const onGround1=Math.abs(t.y-(terrainHeight(t.x,t.z)+BALL_RADIUS))<0.1;
console.log('after full swing: travelled',d1.toFixed(1),'m  rest-on-terrain',onGround1,' pos('+t.x.toFixed(1)+','+t.z.toFixed(1)+')');
const contained=Math.abs(t.x)<36&&Math.abs(t.z)<36;
console.log('contained within field:',contained);
console.log('RESULT:',(onGround1&&contained)?'PASS':'CHECK');

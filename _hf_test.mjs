import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const BALL_RADIUS = 0.25;
function terrainHeight(x, z) {
  return 0.45*Math.sin(x*0.16)*Math.cos(z*0.13) + 0.30*Math.sin((x+z)*0.085+0.6) + 0.22*Math.cos(x*0.06-z*0.09);
}
const N = 96, SIZE = 88;
function buildHeights(mode){
  const h=new Float32Array((N+1)*(N+1));
  for(let r=0;r<=N;r++)for(let c=0;c<=N;c++){
    const u=-SIZE/2+(r/N)*SIZE, v=-SIZE/2+(c/N)*SIZE;
    const x=mode.xAxis==='r'?u:v, z=mode.xAxis==='r'?v:u;
    const idx=mode.order==='rc'?r*(N+1)+c:c*(N+1)+r;
    h[idx]=terrainHeight(x,z);
  }
  return h;
}
function testMode(mode){
  const world=new RAPIER.World({x:0,y:-9.81,z:0});
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.heightfield(N,N,buildHeights(mode),{x:SIZE,y:1,z:SIZE}),body);
  const pts=[[6,-3],[-10,4],[12,8],[-5,-14],[2,2]];
  let err=0,maxe=0;
  for(const [x,z] of pts){
    const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,terrainHeight(x,z)+1.0,z).setLinearDamping(2.0).setAngularDamping(2.0));
    world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setRestitution(0).setFriction(0.95),b);
    for(let i=0;i<1200;i++) world.step();
    const t=b.translation();
    const surf=terrainHeight(t.x,t.z)+BALL_RADIUS;
    const e=Math.abs(t.y-surf);
    err+=e; maxe=Math.max(maxe,e);
  }
  return {err,maxe};
}
for(const order of ['rc','cr'])for(const xAxis of ['r','c']){
  const {err,maxe}=testMode({order,xAxis});
  console.log(`order=${order} xAxis=${xAxis}  sum|y-surf|=${err.toFixed(4)}  max=${maxe.toFixed(4)}`);
}

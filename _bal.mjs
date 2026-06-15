import RAPIER from '@dimforge/rapier3d-compat';
import { terrainHeight, TERRAIN_SIZE, TERRAIN_SEGMENTS } from './shared/terrain/TerrainUtils.js';
await RAPIER.init();
const ATTR={
  moises:{precision:9,estrategia:10,reaccion:4,fuerza:3,resistencia:8,movilidad:5,competitividad:8},
  sebastian:{precision:9,estrategia:8,reaccion:7,fuerza:7,resistencia:4,movilidad:5,competitividad:6},
  duman:{precision:7,estrategia:5,reaccion:9,fuerza:9,resistencia:7,movilidad:8,competitividad:9},
};
const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)); const k=(v,p)=>1+(v-6)*p;
function derive(a){return{
  moveScale:cl(k(a.movilidad,0.035),0.85,1.20),
  swingPower:cl(k(a.fuerza,0.045)*k(a.precision,0.010),0.80,1.25),
  pushForce:cl(k(a.fuerza,0.040)*k(a.competitividad,0.015),0.80,1.30),
  accuracySpread:cl(0.10*(1-(a.precision-1)/9),0,0.10),
  swingCooldownScale:cl(k(a.reaccion,-0.030),0.80,1.20),
  blockDurationScale:cl(k(a.resistencia,0.050),0.70,1.30),
};}
const MOVE=5,SPRINT=8,SWING_MAX_IMPULSE=6,LOFT=1.5,BR=0.25,COOLDOWN=1.5,BLOCKMAX=3.0;
const N=TERRAIN_SEGMENTS,S=TERRAIN_SIZE,H=new Float32Array((N+1)*(N+1));
for(let r=0;r<=N;r++){const x=-S/2+(r/N)*S;for(let c=0;c<=N;c++){const z=-S/2+(c/N)*S;H[r*(N+1)+c]=terrainHeight(x,z);}}
function fullShotDist(swingPower){
  const w=new RAPIER.World({x:0,y:-9.81,z:0});
  const fb=w.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  w.createCollider(RAPIER.ColliderDesc.heightfield(N,N,H,{x:S,y:1,z:S}).setFriction(0.6),fb);
  const b=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,terrainHeight(0,0)+BR,0).setLinearDamping(0.55).setAngularDamping(0.8));
  w.createCollider(RAPIER.ColliderDesc.ball(BR).setDensity(5).setRestitution(0.35).setFriction(0.5),b);
  const imp=1.0*SWING_MAX_IMPULSE*swingPower; // power=1 full
  b.applyImpulse({x:0,y:1.0*LOFT,z:-imp},true);
  for(let i=0;i<1500;i++){w.step();const v=b.linvel();if(Math.hypot(v.x,v.y,v.z)<0.15)break;}
  const t=b.translation();return Math.hypot(t.x,t.z);
}
console.log('Personaje  | vel(m/s) sprint | swingPow | dist tiro | empuje | precis σ(°) | cooldown(s) | bloqueo(s)');
for(const name of ['moises','sebastian','duman']){
  const s=derive(ATTR[name]);
  const dist=fullShotDist(s.swingPower);
  console.log(
    name.padEnd(10)+'| '+(MOVE*s.moveScale).toFixed(2)+' / '+(SPRINT*s.moveScale).toFixed(2)+
    '   | '+s.swingPower.toFixed(3)+'   | '+dist.toFixed(1)+'m'+
    '   | '+s.pushForce.toFixed(2)+'  | '+(s.accuracySpread*180/Math.PI).toFixed(1)+
    '       | '+(COOLDOWN*s.swingCooldownScale).toFixed(2)+'      | '+(BLOCKMAX*s.blockDurationScale).toFixed(2));
}

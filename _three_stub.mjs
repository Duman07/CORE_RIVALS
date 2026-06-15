export class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}clone(){return new Vector3(this.x,this.y,this.z);}normalize(){return this;}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}getWorldScale(){return this;}}
export class Vector2{constructor(x=0,y=0){this.x=x;this.y=y;}}
export class Euler{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
export class Quaternion{setFromEuler(){return this;}setFromUnitVectors(){return this;}setFromAxisAngle(){return this;}copy(){return this;}multiply(){return this;}}
class Attr{constructor(n){this.count=n;}getX(i){return ((i*13%89)-44);}getZ(i){return ((i*29%89)-44);}setY(){}}
class Geo{constructor(){this.attributes={position:new Attr(40)};}rotateX(){}computeVertexNormals(){}}
export class PlaneGeometry extends Geo{}
class Mock{constructor(){this.rotation={x:0,y:0,z:0};this.position={x:0,y:0,z:0,set(a,b,c){this.x=a;this.y=b;this.z=c;}};this.quaternion=new Quaternion();this.shadow={mapSize:{},camera:{}};this.shadowMap={};this.scale={setScalar(){}};}add(){return this;}}
export class Color extends Mock{} export class FogExp2 extends Mock{}
export class AmbientLight extends Mock{} export class DirectionalLight extends Mock{}
export class Mesh extends Mock{} export class Group extends Mock{}
export class BoxGeometry extends Mock{} export class CircleGeometry extends Mock{}
export class RingGeometry extends Mock{} export class CylinderGeometry extends Mock{}
export class MeshLambertMaterial extends Mock{} export class MeshBasicMaterial extends Mock{}
export class MeshStandardMaterial extends Mock{}
export const PCFSoftShadowMap=2; export const DoubleSide=2;

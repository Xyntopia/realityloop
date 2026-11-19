import * as THREE from 'three'

/** Runtime-independent mesh collision import. Coordinates are metres, X/Y/Z.
 * Shape metadata must be authored explicitly; visual meshes are not assumed
 * to be safe collision proxies. No external URI or network access. */
export type ColliderMesh={
  id:string
  kind:'shelf'|'obstruction'|'generic'
  type:'box'|'mesh'
  vertices:readonly [number,number,number][]
  triangles:readonly [number,number,number][]
  bounds:{min:[number,number,number];max:[number,number,number]}
}
export type CollisionAsset={version:1;colliders:readonly ColliderMesh[]}
export type CollisionGlbOptions={
  /** Opt in explicitly: an untagged GLB may also contain visual-only meshes. */
  includeUntagged?:boolean
}
export type BoxCollider=ColliderMesh&{
  type:'box'
  center:[number,number,number]
  halfExtents:[number,number,number]
}
const MAX_BYTES=32*1024*1024,MAX_VERTICES=200000,MAX_TRIANGLES=300000
function ensure(ok:unknown,message:string):asserts ok {
  if(!ok)throw Error('Collision asset: '+message)
}
const xyz=(x:number,y:number,z:number):[number,number,number]=>[x,y,z]
const boundsFor=(vertices:readonly [number,number,number][])=>{
  ensure(vertices.length>0&&vertices.length<=MAX_VERTICES,'invalid vertex count')
  const min=xyz(Infinity,Infinity,Infinity),max=xyz(-Infinity,-Infinity,-Infinity)
  for(const v of vertices)for(let i=0;i<3;i++){
    ensure(Number.isFinite(v[i]),'nonfinite mesh coordinate')
    min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i])
  }
  return {min,max}
}
export const makeCollisionMesh=(id:string,kind:ColliderMesh['kind'],type:ColliderMesh['type'],
  vertices:[number,number,number][],triangles:[number,number,number][]):ColliderMesh=>{
  ensure(/^[a-zA-Z][\w-]{0,99}$/.test(id),'invalid or missing collider ID')
  ensure(triangles.length>0&&triangles.length<=MAX_TRIANGLES,'invalid triangle count')
  for(const face of triangles)for(const i of face)
    ensure(Number.isInteger(i)&&i>=0&&i<vertices.length,'triangle index out of range')
  return {id,kind,type,vertices,triangles,bounds:boundsFor(vertices)}
}
const toBytes=(input:Uint8Array|ArrayBuffer):Uint8Array=>
  input instanceof Uint8Array?input:new Uint8Array(input)
const getJson=(bytes:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const array=(v:unknown):unknown[]=>Array.isArray(v)?v:[]
const n=(v:unknown):number=>{
  ensure(typeof v==='number'&&Number.isFinite(v),'nonfinite numeric mesh field')
  return v
}
const vec=(v:unknown,length:number,defaults:number[]):number[]=>{
  if(v===undefined)return defaults
  ensure(Array.isArray(v)&&v.length===length,'invalid transform vector')
  return v.map(n)
}
const fromGLB=(input:Uint8Array,options:CollisionGlbOptions={}):CollisionAsset=>{
  ensure(input.byteLength>=20&&input.byteLength<=MAX_BYTES,'GLB size exceeds bounds')
  const d=new DataView(input.buffer,input.byteOffset,input.byteLength)
  ensure(d.getUint32(0,true)===0x46546c67&&d.getUint32(4,true)===2,'expected glTF 2.0 GLB')
  ensure(d.getUint32(8,true)===input.byteLength,'inconsistent GLB byte length')
  let pos=12,json:unknown,bin:Uint8Array|undefined
  while(pos<input.byteLength){
    ensure(pos+8<=input.byteLength,'truncated GLB chunk header')
    const length=d.getUint32(pos,true),kind=d.getUint32(pos+4,true)
    pos+=8
    ensure(length%4===0&&pos+length<=input.byteLength,'truncated GLB chunk')
    if(kind===0x4e4f534a){ensure(json===undefined,'duplicate GLB JSON');json=getJson(input.subarray(pos,pos+length))}
    if(kind===0x004e4942){ensure(!bin,'duplicate GLB BIN');bin=input.subarray(pos,pos+length)}
    pos+=length
  }
  ensure(pos===input.byteLength&&record(json)&&!!bin,'GLB must contain embedded JSON and BIN')
  const doc=json as Record<string,unknown>
  const views=array(doc.bufferViews),accessors=array(doc.accessors)
  const gltfMeshes=array(doc.meshes),nodes=array(doc.nodes),scenes=array(doc.scenes)
  const rootScene=scenes[n(doc.scene??0)]
  ensure(record(rootScene),'missing default GLB scene')
  const accessor=(index:number,expected:'VEC3'|'SCALAR')=>{
    const a=accessors[index];ensure(record(a),'missing accessor')
    ensure(a.type===expected,'accessor type mismatch')
    const view=views[n(a.bufferView)];ensure(record(view)&&n(view.buffer)===0,'external buffers unsupported')
    const component=n(a.componentType),count=n(a.count)
    ensure(Number.isInteger(count)&&count>=1&&count<=MAX_VERTICES*3,'accessor count out of range')
    ensure(component===(expected==='VEC3'?5126:5123)||expected==='SCALAR'&&component===5125,
      'unsupported accessor component type')
    const components=expected==='VEC3'?3:1,elementBytes=component===5125?4:component===5123?2:4
    const bytesPer=components*elementBytes
    const stride=n(view.byteStride??bytesPer)
    const start=n(view.byteOffset??0)+n(a.byteOffset??0)
    const bytesView=n(view.byteLength),offset=n(view.byteOffset??0)
    ensure(Number.isInteger(start)&&Number.isInteger(stride)&&stride>=bytesPer&&start>=offset&&
      start+(count-1)*stride+bytesPer<=offset+bytesView&&start+(count-1)*stride+bytesPer<=bin.length,
      'accessor exceeds embedded buffer')
    const source=new DataView(bin.buffer,bin.byteOffset,bin.byteLength)
    const values:number[]=[]
    for(let i=0;i<count;i++)for(let c=0;c<components;c++){
      const at=start+i*stride+c*elementBytes
      values.push(component===5126?source.getFloat32(at,true):
        component===5125?source.getUint32(at,true):source.getUint16(at,true))
    }
    return values
  }
  const result:ColliderMesh[]=[]
  const visited=new Set<number>()
  const walk=(id:number,parent:THREE.Matrix4,active:Set<number>)=>{
    ensure(!active.has(id),'cyclic GLB node graph')
    ensure(!visited.has(id),'duplicate glTF node instance unsupported')
    visited.add(id);active.add(id)
    const node=nodes[id];ensure(record(node),'invalid GLB node')
    const transform=new THREE.Matrix4()
    if(node.matrix!==undefined){
      transform.fromArray(vec(node.matrix,16,[]))
    }else{
      const t=vec(node.translation,3,[0,0,0]),s=vec(node.scale,3,[1,1,1])
      const q=vec(node.rotation,4,[0,0,0,1])
      transform.compose(new THREE.Vector3(...t),new THREE.Quaternion(...q),
        new THREE.Vector3(...s))
    }
    const world=parent.clone().multiply(transform)
    if(node.mesh!==undefined){
      const mesh=gltfMeshes[n(node.mesh)]
      ensure(record(mesh),'missing GLB mesh')
      const extras=record(node.extras)?node.extras:{}
      const metadata=record(extras.realityloopCollider)
        ?extras.realityloopCollider
        :options.includeUntagged?{id:'mesh_'+id,kind:'generic',type:'mesh'}:undefined
      if(metadata){
        const id=metadata.id
        ensure(typeof id==='string','collider node requires ID')
        const kind=metadata.kind
        ensure(kind==='shelf'||kind==='obstruction'||kind==='generic','invalid collider kind')
        const type=metadata.type
        ensure(type==='box'||type==='mesh','invalid collider shape type')
        const primitives=array(mesh.primitives)
        ensure(primitives.length>0&&primitives.length<=32,'collider mesh primitive count exceeds limits')
        const vertices:[number,number,number][]=[]
        const triangles:[number,number,number][]=[]
        for(const primitive of primitives){
          ensure(record(primitive)&&record(primitive.attributes),'invalid primitive')
          ensure(primitive.mode===undefined||primitive.mode===4,'only GL_TRIANGLES supported')
          const floats=accessor(n(primitive.attributes.POSITION),'VEC3')
          const offset=vertices.length
          for(let i=0;i<floats.length;i+=3){
            const p=new THREE.Vector3(floats[i],floats[i+1],floats[i+2]).applyMatrix4(world)
            vertices.push(xyz(p.x,p.y,p.z))
          }
          const indices=primitive.indices===undefined
            ?Array.from({length:vertices.length-offset},(_,i)=>i)
            :accessor(n(primitive.indices),'SCALAR')
          ensure(indices.length%3===0,'indices must form triangles')
          for(let i=0;i<indices.length;i+=3)
            triangles.push(xyz(indices[i]+offset,indices[i+1]+offset,indices[i+2]+offset))
        }
        const shape=makeCollisionMesh(id,kind,type,vertices,triangles)
        if(type==='box'){
          // AABB is exact only for the eight corners of a world-aligned box.
          const {min,max}=shape.bounds
          ensure(vertices.length===8&&new Set(vertices.map(v=>v.join(','))).size===8,
            'box collider must have 8 distinct corners')
          for(const v of vertices)for(let j=0;j<3;j++)
            ensure(Math.abs(v[j]-min[j])<1e-5||Math.abs(v[j]-max[j])<1e-5,
              'rotated or skewed box cannot be compiled as an AABB')
          ensure(min.every((v,i)=>max[i]-v>1e-6),'degenerate box collider')
        }
        ensure(!result.some(r=>r.id===id),'duplicate collision ID')
        result.push(shape)
      }
    }
    for(const child of array(node.children))walk(n(child),world,active)
    active.delete(id)
  }
  for(const root of array(rootScene.nodes))walk(n(root),new THREE.Matrix4(),new Set())
  ensure(result.length>0&&result.length<=256,'GLB has no supported colliders')
  return {version:1,colliders:result}
}
export const importCollisionGLB=(
  bytes:Uint8Array|ArrayBuffer,options:CollisionGlbOptions={},
):CollisionAsset=>fromGLB(toBytes(bytes),options)
export const toBoxColliders=(asset:CollisionAsset):readonly BoxCollider[]=>
  asset.colliders.map(item=>{
    ensure(item.type==='box','mesh colliders need a narrow-phase backend, not an AABB approximation')
    const {min,max}=item.bounds
    return {...item,type:'box' as const,
      center:xyz(...min.map((v,i)=>(v+max[i])/2) as [number,number,number]),
      halfExtents:xyz(...min.map((v,i)=>(max[i]-v)/2) as [number,number,number]),
    }
  })

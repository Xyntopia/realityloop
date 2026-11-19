import {
  importCollisionGLB,makeCollisionMesh,type CollisionAsset,
  type ColliderMesh,type CollisionGlbOptions,
} from './mesh-import.ts'

export type MeshFormat='glb'|'obj'|'stl'
type Vec3=[number,number,number]
type Triangle=[number,number,number]
const MAX_BYTES=32*1024*1024,MAX_TRIANGLES=300000,MAX_VERTICES=200000
const xyz=(x:number,y:number,z:number):Vec3=>[x,y,z]
const check=(ok:unknown,message:string)=>{
  if(!ok)throw Error('Collision asset: '+message)
}
const bytesOf=(input:Uint8Array|ArrayBuffer)=>
  input instanceof Uint8Array?input:new Uint8Array(input)
const subtract=(a:Vec3,b:Vec3):Vec3=>xyz(a[0]-b[0],a[1]-b[1],a[2]-b[2])
const cross=(a:Vec3,b:Vec3):Vec3=>xyz(
  a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const ensureConvexPlanarFace=(indices:number[],vertices:Vec3[])=>{
  const pts=indices.map(i=>vertices[i])
  const origin=pts[0]
  const normal=cross(subtract(pts[1],origin),subtract(pts[2],origin))
  const normal2=dot(normal,normal)
  check(normal2>1e-20,'OBJ face has degenerate first triangle')
  if(pts.length===3)return
  const scale=Math.max(1,...pts.flatMap(p=>p.map((n,i)=>Math.abs(n-origin[i]))))
  const threshold=1e-10*normal2
  for(let i=0;i<pts.length;i++){
    check(Math.abs(dot(subtract(pts[i],origin),normal))<
      1e-6*scale*Math.sqrt(normal2),'OBJ n-gon is not planar')
    const a=pts[i],b=pts[(i+1)%pts.length],c=pts[(i+2)%pts.length]
    const turn=dot(cross(subtract(b,a),subtract(c,b)),normal)
    check(turn>threshold,
      'OBJ n-gon is concave, self-intersecting or degenerate; triangulate in source CAD')
  }
}
const fromOBJ=(bytes:Uint8Array,id:string,kind:ColliderMesh['kind']):ColliderMesh=>{
  const str=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  const vertices:Vec3[]=[],triangles:Triangle[]=[]
  for(const line of str.split(/\r?\n/)){
    const text=line.trim()
    if(!text||text.startsWith('#'))continue
    const columns=text.split(/\s+/)
    if(columns[0]==='v'){
      check(columns.length>=4,'OBJ vertex must have XYZ')
      const numbers=columns.slice(1,4).map(Number)
      check(numbers.every(Number.isFinite),'OBJ has nonfinite vertex')
      vertices.push(xyz(numbers[0],numbers[1],numbers[2]))
      check(vertices.length<=MAX_VERTICES,'OBJ vertex budget exceeded')
    }else if(columns[0]==='f'){
      const refs=columns.slice(1).map(field=>{
        const first=field.split('/')[0]
        const index=Number(first)
        check(/^[-+]?\d+$/.test(first)&&index!==0,'OBJ face index malformed')
        const mapped=index>0?index-1:vertices.length+index
        check(mapped>=0&&mapped<vertices.length,'OBJ face index exceeds vertex range')
        return mapped
      })
      check(refs.length>=3&&refs.length<=1024,'invalid OBJ face')
      ensureConvexPlanarFace(refs,vertices)
      for(let j=1;j<refs.length-1;j++)
        triangles.push(xyz(refs[0],refs[j],refs[j+1]))
      check(triangles.length<=MAX_TRIANGLES,'OBJ triangle budget exceeded')
    }
    // vt/vn/usemtl and material references are visual metadata, not collision.
  }
  return makeCollisionMesh(id,kind,'mesh',vertices,triangles)
}
const fromSTL=(bytes:Uint8Array,id:string,kind:ColliderMesh['kind']):ColliderMesh=>{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const vertices:Vec3[]=[],triangles:Triangle[]=[]
  const index=new Map<string,number>()
  const add=(v:Vec3)=>{
    check(v.every(Number.isFinite),'nonfinite STL vertex')
    const key=v.join(',')
    const previous=index.get(key)
    if(previous!==undefined)return previous
    check(vertices.length<MAX_VERTICES,'STL vertex budget exceeded')
    const next=vertices.length
    vertices.push(v);index.set(key,next)
    return next
  }
  const addFace=(v:Vec3[])=>{
    check(v.length===3,'STL triangle needs 3 vertices')
    triangles.push(xyz(add(v[0]),add(v[1]),add(v[2])))
    check(triangles.length<=MAX_TRIANGLES,'STL triangle budget exceeded')
  }
  const binaryCount=bytes.length>=84?view.getUint32(80,true):0
  if(bytes.length>=84&&binaryCount>0&&84+50*binaryCount===bytes.length){
    for(let i=0;i<binaryCount;i++){
      const start=84+i*50
      addFace(Array.from({length:3},(_,j)=>{
        const p=start+12+j*12
        return xyz(view.getFloat32(p,true),view.getFloat32(p+4,true),
          view.getFloat32(p+8,true))
      }))
    }
  }else{
    const str=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    const lines=str.split(/\r?\n/)
    let face:Vec3[]=[]
    for(const line of lines){
      const trimmed=line.trim()
      if(/^vertex\s+/i.test(trimmed)){
        const parts=trimmed.split(/\s+/)
        check(parts.length===4,'malformed ASCII STL vertex')
        const numbers=parts.slice(1).map(Number)
        check(numbers.every(Number.isFinite),'nonfinite ASCII STL vertex')
        face.push(xyz(numbers[0],numbers[1],numbers[2]))
        check(face.length<=3,'too many STL facet vertices')
      }else if(/^endfacet\s*$/i.test(trimmed)){
        addFace(face);face=[]
      }
    }
    check(face.length===0,'incomplete STL facet')
  }
  return makeCollisionMesh(id,kind,'mesh',vertices,triangles)
}

/** Import external triangle geometry as *mesh* colliders, never silently
 * approximate concave shapes by boxes. That decision belongs to the model. */
export const importCollisionGeometry=(
  bytes:Uint8Array|ArrayBuffer,format:MeshFormat,
  id='imported-mesh',kind:ColliderMesh['kind']='generic',
  glbOptions:CollisionGlbOptions={},
):CollisionAsset=>{
  const input=bytesOf(bytes)
  check(input.byteLength>0&&input.byteLength<=MAX_BYTES,'mesh file size exceeds bounds')
  if(format==='glb')return importCollisionGLB(input,glbOptions)
  if(format==='obj')return {version:1,colliders:[fromOBJ(input,id,kind)]}
  if(format==='stl')return {version:1,colliders:[fromSTL(input,id,kind)]}
  throw Error('Unsupported collision format: '+format)
}

import type {ColliderMesh,CollisionAsset} from './mesh-import.ts'
import {buildCollisionBVH} from './bvh.ts'

type Vec3=readonly [number,number,number]
const cross=(a:Vec3,b:Vec3):Vec3=>[
  a[1]*b[2]-a[2]*b[1],
  a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0],
]
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const subtract=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const finite=(n:number)=>Number.isFinite(n)
const number=(n:number)=>Object.is(n,-0)?'0':String(Math.round(n*1e9)/1e9)
const vector=(v:readonly number[])=>'{'+v.map(number).join(',')+'}'
const matrix=(rows:readonly (readonly number[])[])=>'{'+rows.map(vector).join(',')+'}'

/** Checks the topology of a closed, consistently oriented triangle-soup
 * surface. Only such meshes can use inside/outside (solid) collision laws. */
export const validateClosedCollisionMesh=(mesh:ColliderMesh)=>{
  if(mesh.triangles.length<4)throw Error('Closed mesh requires at least four faces')
  const edges=new Map<string,{count:number;directions:number}>()
  let signedVolume=0
  for(const face of mesh.triangles){
    if(face.some(i=>!Number.isInteger(i)||i<0||i>=mesh.vertices.length))
      throw Error('Closed mesh has invalid triangle vertex indices')
    if(new Set(face).size!==3)throw Error('Closed mesh has degenerate triangle indices')
    const [a,b,c]=face.map(i=>mesh.vertices[i])
    const ab=subtract(b,a),ac=subtract(c,a),n=cross(ab,ac)
    if(dot(n,n)<1e-22)throw Error('Closed mesh contains zero-area triangle')
    signedVolume+=dot(a,cross(b,c))/6
    for(let j=0;j<3;j++){
      const from=face[j],to=face[(j+1)%3]
      const key=Math.min(from,to)+':'+Math.max(from,to)
      const existing=edges.get(key)||{count:0,directions:0}
      existing.count++
      existing.directions+=from<to?1:-1
      edges.set(key,existing)
    }
  }
  if([...edges.values()].some(({count,directions})=>count!==2||directions!==0))
    throw Error('Closed mesh has an open, nonmanifold or inconsistent-winding edge')
  if(!(signedVolume>1e-12))throw Error('Closed mesh requires outward winding and positive enclosed volume')
  return {faces:mesh.triangles.length,uniqueEdges:edges.size,signedVolume}
}
export type ModelicaMeshCompileOptions={
  packageName?:string
  maxVertices?:number
  maxTriangles?:number
  solid?:boolean
}
export const compileCollisionModelica=(
  asset:CollisionAsset,options:ModelicaMeshCompileOptions={},
):string=>{
  const name=options.packageName??'RealityLoopImportedCollision'
  if(!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name))
    throw Error('Invalid Modelica package identifier')
  if(asset.version!==1||asset.colliders.length<1||asset.colliders.length>256)
    throw Error('Invalid collision asset')
  const maxVertices=options.maxVertices??4096,maxTriangles=options.maxTriangles??8192
  const allVertices:Vec3[]=[],allTriangles:[number,number,number][]=[]
  const triangleStart:number[]=[],vertexStart:number[]=[],triangleCount:number[]=[]
  const vertexCount:number[]=[],boundsMin:Vec3[]=[],boundsMax:Vec3[]=[]
  const bodyNames:string[]=[]
  const bvhRoot:number[]=[],bvhLeft:number[]=[],bvhRight:number[]=[]
  const bvhStart:number[]=[],bvhCount:number[]=[],bvhMin:Vec3[]=[],bvhMax:Vec3[]=[]
  const bvhTriangleOrder:number[]=[]
  for(const shape of asset.colliders){
    if(!/^[A-Za-z][\w-]{0,99}$/.test(shape.id)||bodyNames.includes(shape.id))
      throw Error('Duplicate or invalid collider ID')
    bodyNames.push(shape.id)
    if(options.solid)validateClosedCollisionMesh(shape)
    vertexStart.push(allVertices.length+1)
    triangleStart.push(allTriangles.length+1)
    triangleCount.push(shape.triangles.length)
    vertexCount.push(shape.vertices.length)
    boundsMin.push(shape.bounds.min)
    boundsMax.push(shape.bounds.max)
    for(const vertex of shape.vertices){
      if(vertex.length!==3||!vertex.every(finite))throw Error('Invalid mesh vertex')
      allVertices.push(vertex)
    }
    for(const face of shape.triangles){
      if(face.length!==3||face.some(i=>!Number.isInteger(i)||i<0||i>=shape.vertices.length))
        throw Error('Invalid mesh triangle index')
      allTriangles.push(face.map(i=>i+vertexStart.at(-1)!) as [number,number,number])
    }
    if(allVertices.length>maxVertices||allTriangles.length>maxTriangles)
      throw Error('Modelica mesh exceeds configured compile-time geometry budget')
    const tree=buildCollisionBVH(shape,4)
    const nodeOffset=bvhLeft.length
    const orderOffset=bvhTriangleOrder.length
    bvhRoot.push(nodeOffset+1)
    for(const node of tree.nodes){
      bvhMin.push(node.min)
      bvhMax.push(node.max)
      bvhLeft.push(node.left>=0?node.left+nodeOffset+1:0)
      bvhRight.push(node.right>=0?node.right+nodeOffset+1:0)
      bvhStart.push(node.count>0?node.start+orderOffset+1:0)
      bvhCount.push(node.count)
    }
    for(const index of tree.triangleOrder)
      bvhTriangleOrder.push(index+triangleStart.at(-1)!)
  }
  const constant=(declaration:string,value:string)=>
    '  constant '+declaration+'='+value+';'
  return [
    '// GENERATED FROM COLLISION MESH; do not hand-edit.',
    'package '+name,
    constant('Integer nBodies',String(bodyNames.length)),
    constant('Integer nVertices',String(allVertices.length)),
    constant('Integer nTriangles',String(allTriangles.length)),
    constant('Integer nBvhNodes',String(bvhLeft.length)),
    constant('Integer vertexStart[nBodies]',vector(vertexStart)),
    constant('Integer triangleStart[nBodies]',vector(triangleStart)),
    constant('Integer vertexCount[nBodies]',vector(vertexCount)),
    constant('Integer triangleCount[nBodies]',vector(triangleCount)),
    constant('Real boundsMin[nBodies,3]',matrix(boundsMin)),
    constant('Real boundsMax[nBodies,3]',matrix(boundsMax)),
    constant('Real vertices[nVertices,3]',matrix(allVertices)),
    constant('Integer triangles[nTriangles,3]',matrix(allTriangles)),
    constant('Integer bvhRoot[nBodies]',vector(bvhRoot)),
    constant('Real bvhMin[nBvhNodes,3]',matrix(bvhMin)),
    constant('Real bvhMax[nBvhNodes,3]',matrix(bvhMax)),
    constant('Integer bvhLeft[nBvhNodes]',vector(bvhLeft)),
    constant('Integer bvhRight[nBvhNodes]',vector(bvhRight)),
    constant('Integer bvhStart[nBvhNodes]',vector(bvhStart)),
    constant('Integer bvhCount[nBvhNodes]',vector(bvhCount)),
    constant('Integer bvhTriangleOrder[nTriangles]',vector(bvhTriangleOrder)),
    'end '+name+';',
    '',
  ].join('\n')
}

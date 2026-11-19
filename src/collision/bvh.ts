import type {ColliderMesh} from './mesh-import.ts'
type Vec3=[number,number,number]
export type CollisionBVHNode={
  min:Vec3;max:Vec3;left:number;right:number;start:number;count:number
}
export type CollisionBVH={
  nodes:readonly CollisionBVHNode[]
  triangleOrder:readonly number[]
  leafSize:number
}
const box=()=>({
  min:[Infinity,Infinity,Infinity] as Vec3,
  max:[-Infinity,-Infinity,-Infinity] as Vec3,
})
const include=(b:ReturnType<typeof box>,v:Vec3)=>{
  for(let i=0;i<3;i++){b.min[i]=Math.min(b.min[i],v[i]);b.max[i]=Math.max(b.max[i],v[i])}
}
const overlap=(a:ReturnType<typeof box>,b:ReturnType<typeof box>)=>
  a.min.every((v,i)=>v<=b.max[i]&&a.max[i]>=b.min[i])

/** Deterministic median-split triangle BVH for offline geometry compilation.
 * The BVH is a candidate filter, NOT a triangle penetration/contact solver.
 * Leaf selection requires a Modelica or external narrow-phase calculation. */
export const buildCollisionBVH=(mesh:ColliderMesh,leafSize=8):CollisionBVH=>{
  if(!Number.isInteger(leafSize)||leafSize<1||leafSize>64)
    throw Error('BVH leaf size must be 1..64')
  const triangles=mesh.triangles
  const order=triangles.map((_,i)=>i)
  const centroids=triangles.map(face=>{
    const sum:[number,number,number]=[0,0,0]
    for(const vi of face){
      const point=mesh.vertices[vi]
      if(!point)throw Error('BVH invalid mesh index')
      for(let axis=0;axis<3;axis++)sum[axis]+=point[axis]/3
    }
    return sum
  })
  const nodes:CollisionBVHNode[]=[]
  const build=(start:number,end:number):number=>{
    const nodeIndex=nodes.length
    const b=box(),c=box()
    for(let i=start;i<end;i++){
      const idx=order[i]
      for(const v of triangles[idx])include(b,mesh.vertices[v])
      include(c,centroids[idx])
    }
    const count=end-start
    const node:CollisionBVHNode={...b,left:-1,right:-1,start,count}
    nodes.push(node)
    if(count>leafSize){
      const extent=c.max.map((x,i)=>x-c.min[i])
      const axis=extent.indexOf(Math.max(...extent))
      const middle=start+Math.floor(count/2)
      const sorted=order.slice(start,end).sort((a,b)=>
        centroids[a][axis]-centroids[b][axis]||a-b)
      order.splice(start,count,...sorted)
      node.left=build(start,middle)
      node.right=build(middle,end)
      node.count=0
    }
    return nodeIndex
  }
  if(order.length)build(0,order.length)
  return {nodes,triangleOrder:order,leafSize}
}
/** Returns conservative candidate triangles; exact intersection is *not*
 * inferred from AABB overlap. */
export const queryCollisionBVH=(mesh:ColliderMesh,bvh:CollisionBVH,
  min:Vec3,max:Vec3):number[]=>{
  if(!min.every((v,i)=>Number.isFinite(v)&&Number.isFinite(max[i])&&v<=max[i]))
    throw Error('BVH query needs finite ordered bounds')
  const b={min,max},found:number[]=[]
  const visit=(index:number)=>{
    const node=bvh.nodes[index]
    if(!node||!overlap(node,b))return
    if(node.left>=0&&node.right>=0){visit(node.left);visit(node.right);return}
    for(let i=node.start;i<node.start+node.count;i++){
      const tri=mesh.triangles[bvh.triangleOrder[i]]
      const t=box()
      for(const j of tri)include(t,mesh.vertices[j])
      if(overlap(t,b))found.push(bvh.triangleOrder[i])
    }
  }
  if(bvh.nodes.length)visit(0)
  return found.sort((a,b)=>a-b)
}

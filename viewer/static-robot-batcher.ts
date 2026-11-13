import * as THREE from 'three'

type Shapes={boxes:THREE.Matrix4[];cylinders:THREE.Matrix4[]}

/** One static, moving-with-root robot body. Each material renders as a single
 * BatchedMesh instead of one draw call per fixed panel/wheel/sensor mount.
 * Articulated pieces must remain separate and must not enter this batcher. */
export const createStaticRobotBatcher=(root:THREE.Group)=>{
  const boxes=new THREE.BoxGeometry(1,1,1)
  const cylinders=new THREE.CylinderGeometry(1,1,1,20)
  const pending=new Map<THREE.Material,Shapes>()
  const pose=new THREE.Object3D()
  const add=(kind:keyof Shapes,material:THREE.Material)=>{
    const shapes=pending.get(material)??{boxes:[],cylinders:[]}
    if(!pending.has(material))pending.set(material,shapes)
    pose.updateMatrix()
    shapes[kind].push(pose.matrix.clone())
  }
  const box=(
    w:number,h:number,d:number,x:number,y:number,z:number,
    material:THREE.Material,tilt=0,
  )=>{
    pose.position.set(x,y,z)
    pose.rotation.set(0,0,tilt)
    pose.scale.set(w,h,d)
    add('boxes',material)
  }
  const cylinder=(
    radius:number,height:number,x:number,y:number,z:number,
    material:THREE.Material,axis:'x'|'y'|'z'='z',
  )=>{
    pose.position.set(x,y,z)
    pose.rotation.set(axis==='z'?Math.PI/2:0,
      axis==='y'?Math.PI/2:0,axis==='x'?Math.PI/2:0)
    pose.scale.set(radius,height,radius)
    add('cylinders',material)
  }
  const flush=()=>{
    for(const [material,shapes] of pending){
      const count=shapes.boxes.length+shapes.cylinders.length
      const hasBoxes=shapes.boxes.length>0
      const hasCylinders=shapes.cylinders.length>0
      const vertices=(hasBoxes?boxes.getAttribute('position').count:0)+
        (hasCylinders?cylinders.getAttribute('position').count:0)
      const indices=(hasBoxes?boxes.index!.count:0)+
        (hasCylinders?cylinders.index!.count:0)
      const mesh=new THREE.BatchedMesh(count,vertices,indices,material)
      mesh.name='Static Tennant body by material'
      mesh.sortObjects=false
      mesh.castShadow=true
      mesh.receiveShadow=true
      if(hasBoxes){
        const id=mesh.addGeometry(boxes)
        for(const matrix of shapes.boxes){
          const i=mesh.addInstance(id)
          mesh.setMatrixAt(i,matrix)
        }
      }
      if(hasCylinders){
        const id=mesh.addGeometry(cylinders)
        for(const matrix of shapes.cylinders){
          const i=mesh.addInstance(id)
          mesh.setMatrixAt(i,matrix)
        }
      }
      root.add(mesh)
    }
    boxes.dispose()
    cylinders.dispose()
    pending.clear()
  }
  return {box,cylinder,flush}
}

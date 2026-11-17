import * as THREE from 'three'

type TrailPoint=Readonly<{x:number;z:number}>

/** Pre-upload the immutable replay route once; subsequent animation only
 * increases the draw range. Avoid per-frame setFromPoints (which cannot grow
 * an existing GPU buffer), reallocations and O(frames²) copies. */
export const createReplayTrail=()=>{
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(0),3))
  geometry.setDrawRange(0,0)
  const setObservations=(points:readonly TrailPoint[])=>{
    const positions=new Float32Array(points.length*3)
    for(let i=0;i<points.length;i++){
      positions[3*i]=points[i].x
      positions[3*i+1]=.04
      positions[3*i+2]=points[i].z
    }
    // Release the old WebGL buffer before replacing the attribute.
    geometry.dispose()
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
    geometry.setDrawRange(0,0)
    geometry.computeBoundingSphere()
  }
  const showThrough=(index:number)=>{
    const attribute=geometry.getAttribute('position')
    geometry.setDrawRange(0,Math.max(0,Math.min(attribute.count,index+1)))
  }
  const reset=()=>geometry.setDrawRange(0,0)
  return {geometry,setObservations,showThrough,reset}
}

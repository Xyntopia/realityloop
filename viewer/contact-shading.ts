import * as THREE from 'three'

/** Soft alpha contact decals are visual-only, not geometry or LiDAR input.
 * One tiny procedural texture, zero shadow maps, and one floor-plane draw call
 * for the moving vehicle. The shadow follows its parent transform. */
export const createRobotContactShadow=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=128
  canvas.height=128
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Robot contact-shading canvas unavailable')
  const gradient=ctx.createRadialGradient(64,64,7,64,64,63)
  gradient.addColorStop(0,'rgba(12,16,20,.86)')
  gradient.addColorStop(.37,'rgba(12,16,20,.71)')
  gradient.addColorStop(.76,'rgba(12,16,20,.23)')
  gradient.addColorStop(1,'rgba(12,16,20,0)')
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,128,128)
  const texture=new THREE.CanvasTexture(canvas)
  const material=new THREE.MeshBasicMaterial({
    map:texture,transparent:true,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-2,
    side:THREE.DoubleSide,
  })
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.95,1.35),material)
  mesh.name='Robot ground contact shading (visual-only)'
  mesh.position.y=.009
  mesh.rotation.x=-Math.PI/2
  mesh.renderOrder=1
  return {
    mesh,
    setQuality:(quality:'high'|'balanced'|'performance',enabled=true)=>{
      mesh.visible=enabled
      material.opacity=quality==='high' ? .62 : .55
    },
    dispose:()=>{
      mesh.geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}

/** Subtle wall seam gradient. Its opacity is coordinated with the baked floor
 * AO and dynamic lamp shadows so the seams never become broad dark bands. */
export const createWallSeamShading=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=16
  canvas.height=64
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Wall shading canvas unavailable')
  const gradient=ctx.createLinearGradient(0,0,0,64)
  gradient.addColorStop(0,'rgba(10,16,20,.0)')
  gradient.addColorStop(.42,'rgba(10,16,20,.11)')
  gradient.addColorStop(1,'rgba(10,16,20,.27)')
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,16,64)
  const texture=new THREE.CanvasTexture(canvas)
  const material=new THREE.MeshBasicMaterial({
    map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,
  })
  const root=new THREE.Group()
  root.name='Floor and wall seam shading (visual-only)'
  const positions=[
    {width:20,depth:.5,x:4.2,z:-7.2,rotation:0},
    {width:20,depth:.5,x:4.2,z:7.2,rotation:Math.PI},
    {width:15,depth:.5,x:-5.55,z:0,rotation:-Math.PI/2},
    {width:15,depth:.5,x:13.95,z:0,rotation:Math.PI/2},
  ]
  const plane=new THREE.PlaneGeometry(1,1)
  const geometry=new THREE.InstancedMesh(plane,material,positions.length)
  const transform=new THREE.Object3D()
  for(const [index,position] of positions.entries()){
    transform.position.set(position.x,.007,position.z)
    transform.rotation.set(-Math.PI/2,0,position.rotation)
    transform.scale.set(position.width,position.depth,1)
    transform.updateMatrix()
    geometry.setMatrixAt(index,transform.matrix)
  }
  geometry.instanceMatrix.needsUpdate=true
  geometry.name='Static seam shading'
  root.add(geometry)
  return {
    root,
    setOpacity:(opacity:number)=>{
      root.visible=opacity>0
      material.opacity=opacity
    },
    dispose:()=>{
      plane.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}

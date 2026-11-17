import * as THREE from 'three'
import {isSoftwareRenderer} from './renderer-capabilities.ts'
import {createSolarGroundMaterial,addSolarSky,addSkyReflections} from './solar-ground.ts'
import {
  plantLayout,solarEquipment,solarPosition,
  type SolarPlantSample,type SolarPlantScenario,
} from '../src/solar-plant.ts'

/**
 * Utility-scale site visualization inspired by the existing Joulios Darden
 * packer/3D renderer: its PV table dimensions, equipment envelopes, world
 * axes and instanced-mesh strategy are reused. This independently authored
 * scene is an illustrative plant layout, not an as-built Darden asset.
 */
const mat=(color:number,metalness=0,roughness=.7)=>
  new THREE.MeshStandardMaterial({color,metalness,roughness})
const steel=mat(0x9aa9b4,.78,.28)
const frameMat=mat(0x87949f,.74,.32)
const galvanised=mat(0xaeb9b3,.52,.55)
const glass=mat(0x263a46,.28,.18)
const transformer=mat(0x688276,.45,.59)
const weathered=mat(0xb2ae9f,.05,.9)
const gravel=mat(0x847a67,.08,.95)
const asphalt=mat(0x5c615b,.04,.92)
const security=mat(0x343d43,.64,.45)
const grass=mat(0x858663,.02,.95)
const box=(root:THREE.Object3D,w:number,h:number,d:number,
  x:number,y:number,z:number,material:THREE.Material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material)
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true
  root.add(mesh);return mesh
}
const rod=(root:THREE.Object3D,from:THREE.Vector3,to:THREE.Vector3,
  radius:number,material:THREE.Material)=>{
  const direction=to.clone().sub(from)
  const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(radius,radius,direction.length(),9),material)
  mesh.position.copy(from).add(to).multiplyScalar(.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize())
  root.add(mesh);mesh.castShadow=true
  return mesh
}
const groundHeight=(x:number,z:number)=>
  .65*Math.sin(x*.017)*Math.cos(z*.019)
  +.25*Math.sin(x*.058+z*.027)+.15*Math.cos(z*.073)
const cellTexture=()=>{
  const width=512,height=1024
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('PV module texture requires Canvas2D')
  ctx.fillStyle='#142b49';ctx.fillRect(0,0,width,height)
  // The tracker table has a 4.5 m east–west chord and 12 m north–south
  // length. Four cells across and six lengthwise avoids stretched cells.
  for(let row=0;row<6;row++)for(let col=0;col<4;col++){
    const x=col*width/4+4,y=row*height/6+4
    const w=width/4-8,h=height/6-8
    const fill=ctx.createLinearGradient(x,y,x+w,y+h)
    fill.addColorStop(0,'#234875');fill.addColorStop(.42,'#143358')
    fill.addColorStop(1,'#101d34')
    ctx.fillStyle=fill;ctx.fillRect(x,y,w,h)
    ctx.strokeStyle='rgba(162,194,225,.28)'
    ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1)
    for(let i=1;i<=3;i++){
      ctx.fillStyle='rgba(128,168,196,.13)'
      ctx.fillRect(x+i*w/4,y,1,h)
    }
    ctx.fillStyle='rgba(190,210,226,.16)'
    ctx.fillRect(x+3,y+3,w-6,1.5)
  }
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=8
  return texture
}

const addTerrain=(scene:THREE.Scene)=>{
  const geo=new THREE.PlaneGeometry(700,580,130,114)
  geo.rotateX(-Math.PI/2)
  const attr=geo.attributes.position
  const colors=new Float32Array(attr.count*3)
  const c=new THREE.Color()
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),z=attr.getZ(i)
    const far=Math.max(0,Math.hypot(x*.72,z*.8)-125)
    const hills=Math.pow(far/240,1.7)
      *(12+10*Math.sin(x*.018)+7*Math.cos(z*.013))
    const y=groundHeight(x,z)+Math.max(0,hills)
    attr.setY(i,y)
    const noise=.05*Math.sin(x*.23+z*.19)+.035*Math.cos(x*.67-z*.39)
    const dry=Math.min(1,far/230)
    // Vertex tint is deliberately near-neutral: multiplying a dark
    // ground texture by another dark tint would make soil look black.
    c.setRGB(.88+.06*dry+noise,.87+.05*dry+noise,
      .83+.05*dry+noise,THREE.SRGBColorSpace)
    colors.set(c.toArray(),i*3)
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3))
  geo.computeVertexNormals()
  const land=new THREE.Mesh(geo,createSolarGroundMaterial())
  land.name='Undulating semi-arid plant terrain'
  land.receiveShadow=true
  scene.add(land)
  scene.fog=new THREE.Fog(0xc0c4b7,220,670)
  scene.background=new THREE.Color(0x91b8d4)
  const access=box(scene,230,.1,9,0,groundHeight(0,58)+.04,58,gravel)
  access.castShadow=false
  const loop=box(scene,8,.1,64,88,groundHeight(88,70)+.06,70,gravel)
  loop.castShadow=false
  // Small deterministic shrubs beyond the PV field; no imported nature assets.
  const shrubs=new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1,0),grass,480)
  const t=new THREE.Object3D()
  for(let i=0;i<480;i++){
    const x=-270+((i*137.53)%540)
    const z=-235+((i*77.31)%470)
    const inside=Math.abs(x)<99&&z>-93&&z<95
    const atX=inside?(x<0?-112:112):x
    const size=.3+(i%9)*.105
    t.position.set(atX,groundHeight(atX,z)+size*.29,z)
    t.scale.set(size*1.9,size*.55,size*1.35)
    t.rotation.y=i*.73
    t.updateMatrix();shrubs.setMatrixAt(i,t.matrix)
  }
  shrubs.instanceMatrix.needsUpdate=true
  shrubs.name='Native dryland shrubs (instanced)'
  scene.add(shrubs)
}
const addPerimeter=(root:THREE.Group)=>{
  const metal=mat(0x7f8884,.66,.54)
  for(const x of [-113,113])for(let z=-117;z<=115;z+=6){
    rod(root,new THREE.Vector3(x,groundHeight(x,z),z),
      new THREE.Vector3(x,groundHeight(x,z)+2.1,z),.045,metal)
  }
  for(const z of [-117,115])for(let x=-112;x<=112;x+=6){
    rod(root,new THREE.Vector3(x,groundHeight(x,z),z),
      new THREE.Vector3(x,groundHeight(x,z)+2.1,z),.045,metal)
  }
  // Low-visibility fence rails are kept off the critical rendering path.
  for(const x of [-113,113]){
    box(root,.025,.025,232,x,groundHeight(x,0)+1.3,0,metal)
  }
  for(const z of [-117,115]){
    box(root,226,.025,.025,0,groundHeight(0,z)+1.3,z,metal)
  }
}
const addSkid=(root:THREE.Group,x:number,z:number,kind:'inverter'|'bess')=>{
  const g=new THREE.Group()
  g.position.set(x,groundHeight(x,z),z)
  root.add(g)
  const isBess=kind==='bess'
  const w=isBess?solarEquipment.bessWidthM:solarEquipment.inverterWidthM
  const d=isBess?solarEquipment.bessDepthM:solarEquipment.inverterDepthM
  const h=isBess?2.9:2.5
  g.name=isBess?'BESS 1 MW / 4 MWh':'Central inverter skid'
  box(g,w+.5,.19,d+.5,0,.08,0,weathered)
  box(g,w,h,d,0,h/2+.23,0,isBess?galvanised:steel)
  for(let i=0;i<Math.floor(w/.5);i++){
    const px=-w/2+.27+i*.5
    box(g,.028,h*.83,.055,px,h*.54,.5*d+.032,frameMat)
  }
  for(const px of [-w*.34,w*.34]){
    box(g,.7,1.55,.07,px,1.2,d/2+.06,security)
    box(g,.24,.22,.075,px+.18,1.18,d/2+.1,glass)
  }
  for(const px of [-w*.32,0,w*.32]){
    box(g,.9,.1,.44,px,h+.26,-.6,security)
    for(const nz of [-.17,.17])
      box(g,.5,.08,.05,px,h+.32,-.6+nz,frameMat)
  }
  return g
}
const addSubstation=(root:THREE.Group,x:number,z:number)=>{
  const g=new THREE.Group()
  g.name='Substation transformers switchgear and bus'
  g.position.set(x,groundHeight(x,z),z)
  root.add(g)
  box(g,30,.15,20,0,.07,0,gravel).castShadow=false
  // Rows of outdoor transformer equipment.
  for(const [i,xx] of [-8,0,8].entries()){
    box(g,5,3.2,4,xx,1.72,1,transformer)
    for(let k=0;k<8;k++)
      box(g,.10,2.6,.16,xx-2.3+k*.66,1.72,3.05,steel)
    for(const cx of [xx-1,xx,xx+1]){
      rod(g,new THREE.Vector3(cx,3.4,1),
        new THREE.Vector3(cx,4.5,1),.10,security)
      const insulator=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.7,12),rustMaterial())
      insulator.position.set(cx,4.2,1);g.add(insulator)
    }
    if(i===2)box(g,7,2.8,3.2,xx,1.55,-5,galvanised)
  }
  for(let k=-1;k<=1;k++){
    for(const zx of [-6,5]){
      rod(g,new THREE.Vector3(k*11,0,zx),
        new THREE.Vector3(k*11,6,zx),.09,steel)
    }
    rod(g,new THREE.Vector3(k*11,6,-6),
      new THREE.Vector3(k*11,6,5),.09,frameMat)
  }
  return g
}
const rustMaterial=()=>mat(0x695e51,.2,.6)
const addServiceInfrastructure=(scene:THREE.Scene)=>{
  const root=new THREE.Group()
  root.name='Electrical balance-of-system equipment'
  scene.add(root)
  const eq=plantLayout().equipment
  for(const item of eq){
    if(item.kind==='substation')addSubstation(root,item.x,item.z)
    else addSkid(root,item.x,item.z,item.kind)
  }
  addPerimeter(root)
  const mast=new THREE.Group()
  mast.position.set(-89,groundHeight(-89,66),66)
  root.add(mast)
  rod(mast,new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,8.5,0),.1,steel)
  for(const [x,y,z] of [[.45,8.2,0],[-.4,7.8,.2],[0,8.5,.4]])
    box(mast,.55,.2,.32,x,y,z,security)
  box(mast,.48,.6,.38,0,3.2,0,galvanised)
  mast.name='Weather monitoring station'
}
const addPanelField=(scene:THREE.Scene,softwareRenderer:boolean)=>{
  const layout=plantLayout()
  const moduleTex=cellTexture()
  const panelMaterial=new THREE.MeshPhysicalMaterial({
    map:moduleTex,metalness:.04,roughness:.23,
    clearcoat:.48,clearcoatRoughness:.15,
    envMapIntensity:.65,side:THREE.DoubleSide,
  })
  const frame=frameMat
  const c=solarEquipment
  // 12 m north–south torque axis; 4.5 m east–west PV chord.
  // Rotating around +Z represents a realistic one-axis tracker, rather
  // than rotating 12 m across the east–west axis.
  const geometry=new THREE.PlaneGeometry(c.tableHeightM,c.tableWidthM)
  const rackGeometry=new THREE.BoxGeometry(c.tableHeightM,.12,c.tableWidthM)
  const tubeGeometry=new THREE.CylinderGeometry(.12,.12,c.tableWidthM,9)
  tubeGeometry.rotateX(Math.PI/2)
  const pileGeometry=new THREE.CylinderGeometry(.085,.10,2.05,8)
  const panels=new THREE.InstancedMesh(geometry,panelMaterial,layout.pvTables.length)
  const rails=new THREE.InstancedMesh(rackGeometry,frame,layout.pvTables.length)
  const tubes=new THREE.InstancedMesh(tubeGeometry,steel,layout.pvTables.length)
  const piles=new THREE.InstancedMesh(pileGeometry,galvanised,layout.pvTables.length*2)
  // Software GPU fallback: one instanced pass approximates contact shade
  // below the actual sunlit tracking rows. Hardware uses real shadow maps.
  const shadow=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(c.tableHeightM,c.tableWidthM),
    new THREE.MeshBasicMaterial({color:0x1b211b,transparent:true,
      depthWrite:false,opacity:.24,side:THREE.DoubleSide}),
    layout.pvTables.length)
  shadow.name='Cheap instanced PV contact shade (software renderer)'
  shadow.renderOrder=2
  shadow.visible=softwareRenderer
  panels.name='192 tracking PV tables · reflective cells'
  rails.name='PV galvanized table structures'
  tubes.name='North-south tracker torque tubes'
  piles.name='PV pile support foundations'
  panels.castShadow=true;panels.receiveShadow=true
  rails.castShadow=true
  const obj=new THREE.Object3D()
  for(let i=0;i<layout.pvTables.length;i++){
    const placement=layout.pvTables[i]
    for(let j=0;j<2;j++){
      obj.position.set(placement.x,
        groundHeight(placement.x,placement.z)+1.0,
        placement.z+(j===0?-4:4))
      obj.quaternion.identity();obj.scale.setScalar(1);obj.updateMatrix()
      piles.setMatrixAt(i*2+j,obj.matrix)
    }
  }
  piles.instanceMatrix.needsUpdate=true
  scene.add(panels,rails,tubes,piles,shadow)
  const baseRotation=new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1,0,0),-Math.PI/2)
  const axis=new THREE.Vector3(0,0,1)
  const tiltQuaternion=new THREE.Quaternion()
  const surfaceQuaternion=new THREE.Quaternion()
  const temp=new THREE.Object3D()
  const applyTilt=(degrees:number)=>{
    tiltQuaternion.setFromAxisAngle(axis,-degrees*Math.PI/180)
    surfaceQuaternion.multiplyQuaternions(tiltQuaternion,baseRotation)
    for(let i=0;i<layout.pvTables.length;i++){
      const placement=layout.pvTables[i]
      const y=groundHeight(placement.x,placement.z)
      temp.scale.setScalar(1)
      temp.position.set(placement.x,y+2.13,placement.z)
      temp.quaternion.copy(tiltQuaternion)
      temp.updateMatrix()
      rails.setMatrixAt(i,temp.matrix)
      temp.quaternion.copy(surfaceQuaternion)
      temp.position.y+=.067
      temp.updateMatrix()
      panels.setMatrixAt(i,temp.matrix)
      temp.position.y=y+2.05
      temp.quaternion.identity()
      temp.updateMatrix()
      tubes.setMatrixAt(i,temp.matrix)
    }
    panels.instanceMatrix.needsUpdate=true
    rails.instanceMatrix.needsUpdate=true
    tubes.instanceMatrix.needsUpdate=true
  }
  const updateShadow=(sun:{x:number;y:number;z:number})=>{
    if(!softwareRenderer)return
    shadow.visible=sun.y>.05
    const k=2.05/Math.max(sun.y,.15)
    for(let i=0;i<layout.pvTables.length;i++){
      const position=layout.pvTables[i]
      const x=position.x-sun.x*k,z=position.z-sun.z*k
      obj.scale.set(1,Math.max(.25,Math.abs(Math.cos(
        Math.atan2(sun.x,Math.max(0,sun.y))))),1)
      obj.position.set(x,groundHeight(x,z)+.12,z)
      obj.quaternion.copy(baseRotation)
      obj.updateMatrix()
      shadow.setMatrixAt(i,obj.matrix)
    }
    shadow.instanceMatrix.needsUpdate=true
  }
  applyTilt(0)
  return {applyTilt,updateShadow,layout}
}
const addSun=(scene:THREE.Scene,renderer:THREE.WebGLRenderer)=>{
  const sunlight=new THREE.DirectionalLight(0xfff3df,3.65)
  sunlight.castShadow=renderer.capabilities.isWebGL2
    &&!isSoftwareRenderer(renderer)
  sunlight.shadow.mapSize.set(2048,2048)
  sunlight.shadow.camera.left=-150;sunlight.shadow.camera.right=150
  sunlight.shadow.camera.top=150;sunlight.shadow.camera.bottom=-150
  sunlight.shadow.camera.near=.1;sunlight.shadow.camera.far=480
  sunlight.shadow.bias=-.00019
  sunlight.shadow.normalBias=.06
  sunlight.target.position.set(0,0,-12)
  scene.add(sunlight,sunlight.target)
  const hemi=new THREE.HemisphereLight(0xe5f3ff,0x736554,1.2)
  scene.add(hemi)
  return {sunlight,hemi}
}
export const createSolarPlantWorld=(renderer:THREE.WebGLRenderer,
  scenario:SolarPlantScenario)=>{
  const scene=new THREE.Scene()
  addTerrain(scene)
  const field=addPanelField(scene,isSoftwareRenderer(renderer))
  addServiceInfrastructure(scene)
  const updateSky=addSolarSky(scene)
  if(!isSoftwareRenderer(renderer))addSkyReflections(scene,renderer)
  const lights=addSun(scene,renderer)
  const camera=new THREE.PerspectiveCamera(52,16/9,.2,1300)
  camera.position.set(82,48,110)
  camera.lookAt(-6,3,-9)
  const update=(sample:SolarPlantSample)=>{
    const position=solarPosition(scenario.latitudeDegrees,
      scenario.dayOfYear,sample.solarHour)
    const sun=position.sun
    lights.sunlight.position.set(sun.x*185,sun.y*185,sun.z*185)
    lights.sunlight.intensity=Math.max(.06,3.65*Math.max(0,sun.y))
    lights.hemi.intensity=Math.max(.12,1.25*Math.max(0,sun.y))
    field.applyTilt(sample.trackerTiltDegrees)
    field.updateShadow(sun)
    updateSky(new THREE.Vector3(sun.x,sun.y,sun.z))
  }
  return {scene,camera,update,layout:field.layout}
}

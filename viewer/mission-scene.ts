import * as THREE from 'three'
import {addMarsHabitat,addMarsRoverContactShadow} from './mars-habitat.ts'
import {proceduralMarsGroundMaps} from './mars-materials.ts'
import {addOrbitalEarth} from './orbital-earth.ts'
import {addOrbitalServicer} from './orbital-servicer.ts'
import type {OrbitalState} from '../src/orbital-formation.ts'
import type {InspectionSnapshot} from '../src/orbital-inspection.ts'
import {solarWingDimensions} from '../src/satellite-scan-geometry.ts'
import {
  addConstructionSite,addConstructionContactShadow,
  proceduralConstructionGroundMaps,
} from './construction-site.ts'
import {
  calculateSatelliteInertia,satelliteModules,terrainElevation,terrainHazards,
  type CubeModule,type TerrainKind,
} from '../src/mission-experiments.ts'

export type MissionScene='satellite'|'mars'|'construction'
export type OrbitalCameraMode='formation'|'chief'|'servicer'
export type MissionFrame=Record<string,unknown>
const gold=new THREE.MeshStandardMaterial({color:0xbda669,metalness:.75,roughness:.4})
const dark=new THREE.MeshStandardMaterial({color:0x30383f,metalness:.55,roughness:.4})
const silver=new THREE.MeshStandardMaterial({color:0xabb7c4,metalness:.83,roughness:.26})
const blue=new THREE.MeshStandardMaterial({color:0x1b365e,metalness:.16,roughness:.37})
const copper=new THREE.MeshStandardMaterial({color:0xc77c47,metalness:.72,roughness:.38})
const emissive=new THREE.MeshStandardMaterial({
  color:0x6289ad,emissive:0x1a405a,emissiveIntensity:.5,metalness:.34,
})
const addBox=(root:THREE.Group,
  w:number,h:number,d:number,x:number,y:number,z:number,
  mat:THREE.Material):THREE.Mesh=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat)
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true
  root.add(mesh)
  return mesh
}
const addCylinder=(root:THREE.Group,r:number,depth:number,
  x:number,y:number,z:number,material:THREE.Material):THREE.Mesh=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,24),material)
  mesh.position.set(x,y,z);mesh.castShadow=true;root.add(mesh);return mesh
}
const addTorus=(root:THREE.Group,r:number,tube:number,
  x:number,y:number,z:number,material:THREE.Material,face:'x'|'y'|'z')=>{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,24),material)
  ring.position.set(x,y,z)
  if(face==='x')ring.rotation.y=Math.PI/2
  if(face==='y')ring.rotation.x=Math.PI/2
  root.add(ring)
}
const addStarfield=(scene:THREE.Scene)=>{
  scene.background=new THREE.Color(0x070d19)
  const count=900,coords=new Float32Array(count*3)
  for(let i=0;i<count;i++){
    const a=i*2.399963229728653
    const v=1-2*(i+.5)/count
    const radius=68*Math.sqrt(1-v*v)
    coords[3*i]=Math.cos(a)*radius
    coords[3*i+1]=v*68
    coords[3*i+2]=Math.sin(a)*radius
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(coords,3))
  const points=new THREE.Points(geometry,new THREE.PointsMaterial({
    color:0xdce8fb,size:.08,sizeAttenuation:true,
  }))
  scene.add(points)
  scene.add(new THREE.AmbientLight(0xc6d8f2,.62))
  const sun=new THREE.DirectionalLight(0xfff5e9,3.15)
  sun.position.set(7,10,5)
  sun.castShadow=true
  sun.shadow.mapSize.set(1024,1024)
  sun.shadow.camera.left=-18;sun.shadow.camera.right=18
  sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18
  sun.shadow.camera.near=.5;sun.shadow.camera.far=50
  sun.shadow.normalBias=.014
  scene.add(sun)
}
const boxModule=(parent:THREE.Group,m:CubeModule,offset:THREE.Vector3)=>{
  const node=new THREE.Group()
  node.position.set(m.position.x-offset.x,m.position.y-offset.y,
    m.position.z-offset.z)
  const bodyMaterial=m.function==='wheel' ? dark : gold
  addBox(node,.364,.364,.364,0,0,0,bodyMaterial)
  // Reflective aluminum corner caps and rigid conductive frame.
  for(const sy of [-1,1])for(const sz of [-1,1])
    addBox(node,.416,.022,.022,0,sy*.194,sz*.194,silver)
  for(const sx of [-1,1])for(const sz of [-1,1])
    addBox(node,.022,.416,.022,sx*.194,0,sz*.194,silver)
  for(const sx of [-1,1])for(const sy of [-1,1])
    addBox(node,.022,.022,.416,sx*.194,sy*.194,0,silver)
  for(const face of ['x','y','z'] as const)
    for(const sign of [-1,1]){
      const x=face==='x'?sign*.208:0
      const y=face==='y'?sign*.208:0
      const z=face==='z'?sign*.208:0
      addTorus(node,.107,.014,x,y,z,copper,face)
      addTorus(node,.056,.011,
        x+(face==='x'?sign*.004:0),
        y+(face==='y'?sign*.004:0),
        z+(face==='z'?sign*.004:0),silver,face)
    }
  if(m.function==='wheel'){
    const wheel=addCylinder(node,.117,.16,0,0,0,silver)
    wheel.rotation.x=Math.PI/2
    addCylinder(node,.048,.17,0,0,0,copper).rotation.x=Math.PI/2
  }
  if(m.function==='sensor'){
    const camera=addCylinder(node,.063,.1,0,.25,0,dark)
    camera.rotation.x=Math.PI/2
    addCylinder(node,.036,.12,0,.25,0,emissive).rotation.x=Math.PI/2
  }
  if(m.function==='power')addBox(node,.25,.012,.24,0,.213,0,blue)
  parent.add(node)
}
const solarPanel=(group:THREE.Group,direction:-1|1,extent:number)=>{
  const wing=new THREE.Group()
  const origin=direction*(extent+.28)
  addBox(wing,1.65,.024,.8,origin,0,0,blue)
  for(let i=0;i<8;i++)addBox(wing,.009,.029,.79,
    origin-.77+i*.22,0,0,silver)
  for(let i=0;i<5;i++)addBox(wing,1.64,.03,.009,
    origin,0,-.36+i*.18,silver)
  addBox(wing,.3,.055,.06,direction*(extent-.1),0,0,silver)
  wing.rotation.x=1.13 // angle solar cells toward the sun-facing camera
  group.add(wing)
}
export const createModularSatellite=(layout:'compact'|'distributed'|'asymmetric')=>{
  const modules=satelliteModules(layout)
  const inertia=calculateSatelliteInertia(modules)
  const spacecraft=new THREE.Group()
  const c=new THREE.Vector3(
    inertia.centerOfMass.x,inertia.centerOfMass.y,inertia.centerOfMass.z)
  for(const m of modules)boxModule(spacecraft,m,c)
  for(const wing of solarWingDimensions(modules,inertia.centerOfMass))
    solarPanel(spacecraft,wing.direction,wing.extent)
  // Stylized high-gain antenna, attached to a top block.
  const ytop=Math.max(...modules.map(m=>m.position.y-c.y))+.3
  const dish=new THREE.Mesh(new THREE.ConeGeometry(.24,.15,32),silver)
  dish.position.set(0,ytop+.12,0);dish.rotation.x=Math.PI
  spacecraft.add(dish)
  addCylinder(spacecraft,.03,.24,0,ytop-.06,0,silver)
  return spacecraft
}
const createGround=(scene:THREE.Scene,terrain:TerrainKind)=>{
  scene.background=new THREE.Color(terrain==='mars'?0x8d5540:0xa6c9df)
  scene.fog=new THREE.Fog(scene.background,16,45)
  const sun=new THREE.DirectionalLight(terrain==='mars'?0xffd6b0:0xffe9d2,
    terrain==='mars'?2.8:2.85)
  sun.position.set(terrain==='mars'?-4:-9,
    terrain==='mars'?9:13,terrain==='mars'?-7:5)
  sun.castShadow=true
  sun.shadow.mapSize.set(1024,1024)
  sun.shadow.camera.left=-14;sun.shadow.camera.right=14
  sun.shadow.camera.top=13;sun.shadow.camera.bottom=-13
  sun.shadow.bias=-.0003
  sun.shadow.normalBias=.025
  scene.add(sun,new THREE.HemisphereLight(
    terrain==='mars'?0xdbe7ee:0xe9f3ff,
    terrain==='mars'?0x746251:0x574d41,
    terrain==='mars'?1.05:.97))
  const floor=new THREE.PlaneGeometry(
    terrain==='mars'?28:112,terrain==='mars'?17:96,
    terrain==='mars'?150:150,terrain==='mars'?95:125)
  const vertices=floor.attributes.position
  const colors=new Float32Array(vertices.count*3)
  const color=new THREE.Color()
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=-vertices.getY(i)
    vertices.setZ(i,terrainElevation(terrain,x,z))
    const variation=.07*Math.sin(x*1.8+z*2.1)+.04*Math.cos(x*3.8-z)
    const weathering=terrain==='mars'
      ?Math.max(0,Math.sin(x*.75)*Math.cos(z*.88)+.27*Math.sin(1.8*z+.33*x)-.20)*.22
      :0
    color.set(terrain==='mars'?0xf7e4d5:0xe7dcd0)
    const earthVariation=terrain==='construction'
      ? .035*Math.sin(x*.32+z*.61)+.027*Math.cos(x*.97-z*.47)
      : 0
    color.multiplyScalar(1+variation+earthVariation-weathering)
    colors.set(color.toArray(),i*3)
  }
  floor.setAttribute('color',new THREE.BufferAttribute(colors,3))
  floor.computeVertexNormals()
  const surfaceMaps=terrain==='construction'
    ? proceduralConstructionGroundMaps() : proceduralMarsGroundMaps()
  const mesh=new THREE.Mesh(floor,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,
    map:surfaceMaps.diffuse,normalMap:surfaceMaps.normal,
    normalScale:terrain==='mars'
      ?new THREE.Vector2(.35,.35):new THREE.Vector2(.23,.23),
  }))
  mesh.rotation.x=-Math.PI/2
  mesh.receiveShadow=true;scene.add(mesh)
  const props=new THREE.Group();scene.add(props)
  for(const [index,hazard] of terrainHazards(terrain).entries()){
    const elevation=terrainElevation(terrain,hazard.x,hazard.z)
    if(terrain==='mars'){
      const stone=new THREE.Mesh(new THREE.IcosahedronGeometry(hazard.radius*.8,1),
        new THREE.MeshStandardMaterial({color:index%2?0x78604f:0x96705a,roughness:1}))
      stone.position.set(hazard.x,elevation+hazard.radius*.38,hazard.z)
      stone.rotation.set(.3*index,.5*index,.2)
      stone.castShadow=true;props.add(stone)
    }else{
      const hazardGroup=new THREE.Group()
      hazardGroup.position.set(hazard.x,elevation,hazard.z)
      if(hazard.kind==='exclusion'){
        const mat=new THREE.MeshStandardMaterial({color:0xf3aa4b,roughness:.8})
        for(let j=0;j<10;j++){
          const theta=j*2*Math.PI/10
          const cone=new THREE.Mesh(new THREE.ConeGeometry(.13,.46,8),mat)
          cone.position.set(Math.cos(theta)*hazard.radius,.23,
            Math.sin(theta)*hazard.radius)
          hazardGroup.add(cone)
        }
      }else{
        // Visual worksite generator/compressor within the existing canonical
        // equipment hazard footprint. Its details are not collision bodies.
        const industrial=new THREE.MeshStandardMaterial({
          color:0xad863c,metalness:.26,roughness:.82,
        })
        const frame=new THREE.MeshStandardMaterial({
          color:0x464847,metalness:.53,roughness:.67,
        })
        const grill=new THREE.MeshStandardMaterial({
          color:0x24292b,metalness:.58,roughness:.83,
        })
        addBox(hazardGroup,1.07,.13,.94,0,.15,0,frame)
        addBox(hazardGroup,.99,1.14,.80,0,.77,0,industrial)
        addBox(hazardGroup,1.05,.11,.89,0,1.38,0,frame)
        for(const x of [-.42,.42]){
          addBox(hazardGroup,.055,1.16,.045,x,.78,-.423,frame)
          addBox(hazardGroup,.055,1.16,.045,x,.78,.423,frame)
        }
        for(let j=0;j<7;j++){
          addBox(hazardGroup,.78,.032,.024,0,.52+j*.095,-.435,grill)
          addBox(hazardGroup,.78,.032,.024,0,.52+j*.095,.435,grill)
        }
        // Dark cooling fan inset and exhaust stub communicate equipment,
        // rather than a featureless yellow shipping box.
        const fan=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.038,16),grill)
        fan.rotation.x=Math.PI/2
        fan.position.set(0,.92,.45)
        hazardGroup.add(fan)
        const exhaust=addCylinder(hazardGroup,.085,.33,.28,1.58,.17,frame)
        exhaust.rotation.z=.1
        for(const x of [-.38,.38])
          addBox(hazardGroup,.11,.14,.09,x,.075,-.35,grill)
      }
      props.add(hazardGroup)
    }
  }
  if(terrain==='mars'){
    for(let i=0;i<45;i++){
      const x=-12+(i*7.31)%25,z=-7+(i*3.71)%14
      const radius=.08+(i%5)*.055
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(radius,0),
        new THREE.MeshStandardMaterial({color:0x84614d,roughness:1}))
      rock.position.set(x,terrainElevation('mars',x,z)+radius*.5,z)
      props.add(rock)
    }
  }
}
const buildRover=(terrain:TerrainKind)=>{
  const vehicle=new THREE.Group()
  const isMars=terrain==='mars'
  const hull=new THREE.MeshStandardMaterial({
    color:isMars?0xc47b42:0xdfa442,metalness:.5,roughness:.48,
  })
  addBox(vehicle,1.36,.36,.85,0,.46,0,hull)
  addBox(vehicle,.96,.18,.68,-.05,.71,0,dark)
  if(isMars){
    // Low-poly six-wheel cargo rover with a high-mounted sensor housing,
    // modular side rails and articulated delivery manipulator.
    addBox(vehicle,1.72,.10,.91,0,.71,0,dark)
    addBox(vehicle,.87,.58,.79,-.33,1.04,0,hull)
    addBox(vehicle,.73,.31,.59,-.36,1.14,.12,emissive)
    addBox(vehicle,.95,.11,.90,-.35,1.46,0,silver)
    for(const side of [-1,1]){
      addBox(vehicle,1.65,.06,.08,0,.47,side*.58,silver)
      addBox(vehicle,.42,.30,.05,-.16,1.13,side*.43,dark)
    }
    addBox(vehicle,.65,.58,.70,.62,1.08,0,hull)
    const interfaceRing=new THREE.Mesh(
      new THREE.TorusGeometry(.21,.03,8,20),dark)
    interfaceRing.position.set(.62,1.13,.36)
    vehicle.add(interfaceRing)
    addCylinder(vehicle,.07,.62,-.52,1.78,0,silver)
    addBox(vehicle,.31,.18,.21,-.52,2.12,0,dark)
    const detector=addCylinder(vehicle,.06,.09,-.39,2.12,0,emissive)
    detector.rotation.z=Math.PI/2
    const armStart=new THREE.Vector3(.38,1.43,-.24)
    const armElbow=new THREE.Vector3(.87,2.07,-.38)
    const armTip=new THREE.Vector3(1.3,1.72,-.3)
    const link=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{
      const delta=b.clone().sub(a)
      const member=addCylinder(vehicle,r,delta.length(),
        (a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,silver)
      member.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())
      for(const jointPoint of [b]){
        const bearing=new THREE.Mesh(new THREE.SphereGeometry(r*1.45,12,8),dark)
        bearing.position.copy(jointPoint);vehicle.add(bearing)
      }
    }
    link(armStart,armElbow,.065)
    link(armElbow,armTip,.055)
    addBox(vehicle,.19,.11,.10,armTip.x+.07,armTip.y,armTip.z,dark)
  }else{
    addBox(vehicle,.9,.72,.75,-.35,1.0,0,hull)
    addBox(vehicle,.3,.55,.5,-.35,1.05,0,emissive)
    addBox(vehicle,.7,.12,.9,.8,.37,0,silver)
    addBox(vehicle,.48,.16,.75,1.07,.33,0,hull)
  }
  if(isMars)addMarsRoverContactShadow(vehicle)
  else addConstructionContactShadow(vehicle,2.8,1.8,.043)
  const tire=new THREE.MeshStandardMaterial({color:0x222325,roughness:.95})
  for(const x of isMars?[-.54,0,.54]:[-.45,.55])
    for(const z of [-.59,.59]){
      const wheel=addCylinder(vehicle,isMars ? .22 : .31,.17,x,.23,z,tire)
      wheel.rotation.x=Math.PI/2
      const hub=addCylinder(vehicle,.09,.18,x,.23,z,silver)
      hub.rotation.x=Math.PI/2
    }
  return vehicle
}
export const createMissionWorld=(kind:MissionScene,layout:'compact'|'distributed'|'asymmetric'='compact')=>{
  const scene=new THREE.Scene()
  const root=new THREE.Group();scene.add(root)
  const camera=new THREE.PerspectiveCamera(56,16/9,.06,120)
  let moving:THREE.Group
  let marsHabitat:ReturnType<typeof addMarsHabitat>|undefined
  let earth:THREE.Group|undefined
  let servicer:ReturnType<typeof addOrbitalServicer>|undefined
  let cameraMode:OrbitalCameraMode='formation'
  let currentOrbit:OrbitalState|undefined
  const setOrbitalCameraMode=(mode:OrbitalCameraMode)=>{
    cameraMode=mode
    if(kind!=='satellite')return
    if(mode==='chief'){
      camera.position.set(3.4,2.5,7.1)
      camera.lookAt(0,0,0)
    }else if(mode==='servicer'){
      const r=currentOrbit?.relativeRTN??{x:-4.8,y:9.2,z:0}
      camera.position.set(r.x+3.2,r.y+2.2,r.z+5.5)
      camera.lookAt(r.x,r.y,r.z)
    }else{
      // Formation overview: both spacecraft in the center and Earth limb
      // behind them. Physical range is unchanged by the camera.
      camera.position.set(6.2,9.7,18.5)
      camera.lookAt(-2.3,4.6,0)
    }
  }
  if(kind==='satellite'){
    addStarfield(scene)
    earth=addOrbitalEarth(scene)
    moving=createModularSatellite(layout)
    root.add(moving)
    servicer=addOrbitalServicer(scene,moving)
    setOrbitalCameraMode('formation')
  }else{
    const terrain=kind==='mars'?'mars':'construction'
    createGround(scene,terrain)
    moving=buildRover(terrain)
    root.add(moving)
    if(kind==='mars'){
      marsHabitat=addMarsHabitat(scene)
      camera.fov=58;camera.updateProjectionMatrix()
      camera.position.set(7.0,5.35,-8.1)
      camera.lookAt(1.2,1.15,1.65)
    }else{
      addConstructionSite(scene)
      camera.fov=58;camera.updateProjectionMatrix()
      // Show the moving vehicle and dirt works in front of the building,
      // rather than hiding the delivery route behind the concrete frame.
      camera.position.set(5.3,6.6,-10.2)
      camera.lookAt(-.2,1.2,1.45)
    }
  }
  const move=(sample:Record<string,any>)=>{
    if(kind==='satellite'){
      const q=sample.quaternion
      if(q)moving.quaternion.set(q.x,q.y,q.z,q.w)
      const orbit=sample.orbit as OrbitalState|undefined
      if(orbit){
        // In the chief RTN frame, the Earth center lies exactly in -R.
        // The globe is graphically scaled; actual ECI positions and
        // relative range stay in metres in the observation record.
        currentOrbit=orbit
        earth?.position.set(-34,0,0)
        if(earth){
          earth.rotation.y=-.45+orbit.timeSeconds*7.292115e-5
          const clouds=earth.getObjectByName('Procedural atmospheric clouds')
          if(clouds)clouds.rotation.y=.04+orbit.timeSeconds*.000045
        }
        servicer?.update(orbit,sample.inspection as InspectionSnapshot|undefined)
        if(cameraMode==='servicer')setOrbitalCameraMode(cameraMode)
      }
    }else{
      moving.position.set(sample.x??-8,(sample.y??0),sample.z??0)
      moving.rotation.y=-(sample.yaw??0)
      marsHabitat?.update(sample.timeSeconds??0,
        1-(sample.distanceToGoalMetres??16)/16)
    }
  }
  move({})
  return {scene,camera,move,root,setOrbitalCameraMode}
}

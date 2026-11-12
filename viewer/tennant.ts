import * as THREE from 'three'
import { lidars } from '../src/slam.ts'

/**
 * Lightweight procedural visual approximation of the Tennant T7AMR.
 * Reference dimensions: ~1.651 m length, 0.889 m width (with squeegee),
 * ~1.499 m height. Appearance is neither Tennant-provided CAD nor validated geometry.
 * RealityLoop axis: nose +X, ground Y=0, lateral +Z.
 */
export const createTennantT7AMR = (): THREE.Group => {
  const root = new THREE.Group()
  root.name = 'Tennant T7AMR (reference-inspired prototype)'
  const teal = new THREE.MeshStandardMaterial({ color: 0x068d98, roughness: 0.48, metalness: 0.12 })
  const tealLight = new THREE.MeshStandardMaterial({ color: 0x0da8ae, roughness: 0.52 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x18252a, roughness: 0.8 })
  const black = new THREE.MeshStandardMaterial({ color: 0x101519, roughness: 0.89 })
  const grey = new THREE.MeshStandardMaterial({ color: 0x697275, roughness: 0.78 })
  const greyLight = new THREE.MeshStandardMaterial({ color: 0x899497, roughness: 0.65 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x13181a, roughness: 0.97 })
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcb22, roughness: 0.4 })
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8f14, emissive: 0x7e3100, emissiveIntensity: 0.35, roughness: 0.4 })
  const red = new THREE.MeshStandardMaterial({ color: 0xc44c32, roughness: 0.75 })

  const box = (sx:number,sy:number,sz:number,x:number,y:number,z:number,material:THREE.Material,bevel=0) => {
    const geometry = new THREE.BoxGeometry(sx,sy,sz)
    const mesh = new THREE.Mesh(geometry,material)
    mesh.position.set(x,y,z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    if(bevel) mesh.rotation.z=bevel
    root.add(mesh)
    return mesh
  }
  const cylinder = (radius:number,depth:number,x:number,y:number,z:number,material:THREE.Material,axis:'x'|'y'|'z'='z')=>{
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,20),material)
    mesh.rotation[axis==='x'?'z':axis==='z'?'x':'y']=Math.PI/2
    mesh.position.set(x,y,z)
    mesh.castShadow=true
    root.add(mesh)
    return mesh
  }

  // Lower frame / long grey battery tray.
  box(1.49,0.27,0.70,-0.02,0.28,0,grey)
  box(1.43,0.055,0.74,0,0.45,0,dark)
  // Rear recovery tank housing, characteristic high grey cap and teal sides.
  box(0.55,0.58,0.66,-0.48,0.80,0,teal)
  box(0.50,0.36,0.60,-0.50,1.22,0,greyLight)
  box(0.45,0.035,0.63,-0.50,1.39,0,grey)
  // Mid chassis / solution tank side panels, seat pedestal.
  box(0.87,0.36,0.72,-0.06,0.65,0,tealLight)
  box(0.57,0.15,0.56,0.05,0.87,0,dark)
  box(0.48,0.12,0.54,0.03,1.00,0,black)
  box(0.13,0.48,0.49,-0.16,1.19,0,black,-0.09)
  // Front operator console and molded steering mast.
  box(0.33,0.77,0.67,0.63,0.79,0,teal)
  box(0.27,0.15,0.62,0.62,1.16,0,tealLight)
  box(0.03,0.26,0.35,0.465,1.16,0,black)
  box(0.38,0.16,0.63,0.67,0.43,0,teal)
  // Front instrument display.
  box(0.035,0.16,0.23,0.469,1.16,0,dark)
  box(0.038,0.10,0.16,0.445,1.17,0,new THREE.MeshStandardMaterial({color:0x265761,emissive:0x064e59,emissiveIntensity:0.3}))
  // Steering wheel, slender axle.
  cylinder(0.022,0.23,0.48,1.33,0,grey,'x')
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.20,0.021,8,30),black)
  steeringWheel.rotation.y=Math.PI/2
  steeringWheel.rotation.z=0.25
  steeringWheel.position.set(0.46,1.33,0)
  root.add(steeringWheel)
  // Safety arm around seated operator.
  box(0.70,0.045,0.04,0.05,1.16,0.32,yellow)
  box(0.70,0.045,0.04,0.05,1.16,-0.32,yellow)
  // Orange beacon at the rear.
  cylinder(0.047,0.11,-0.51,1.47,0,orange,'y')
  // Wheel locations: front driven/steered wheel and two rear supports.
  cylinder(0.17,0.11,0.55,0.17,0,rubber,'z')
  for(const z of [-0.34,0.34]) {
    cylinder(0.16,0.09,-0.49,0.16,z,rubber,'z')
    cylinder(0.075,0.10,-0.49,0.16,z,black,'z')
  }
  // Brush deck, red pad rims and rear squeegee assembly.
  box(0.39,0.12,0.65,0.13,0.16,0,dark)
  for(const z of [-0.18,0.18]) cylinder(0.18,0.038,0.16,0.085,z,red,'y')
  box(0.085,0.07,0.84,-0.79,0.13,0,rubber)
  box(0.13,0.13,0.70,0.80,0.12,0,dark)
  // One front scanner and two small scanners on each side.
  // Visualization mounts only; optical extrinsics not manufacturer-verified.
  const housing=new THREE.MeshStandardMaterial({color:0x172a34,roughness:0.55})
  const lens=new THREE.MeshStandardMaterial({color:0x57e8de,metalness:0.4,roughness:0.18,emissive:0x085e5c})
  for(const sensor of lidars){
    cylinder(sensor.side==='front'?0.078:0.047,sensor.side==='front'?0.065:0.045,
      sensor.x,sensor.y,sensor.z,housing,'y')
    cylinder(sensor.side==='front'?0.062:0.038,0.016,
      sensor.x,sensor.y+0.035,sensor.z,lens,'y')
  }
  // Label applied as a canvas texture; not an official CAD or logo asset.
  const label = (text:string, x:number,y:number,z:number,rotationY:number,scaleW:number)=>{
    const c=document.createElement('canvas')
    c.width=512;c.height=150
    const ctx=c.getContext('2d')
    if(!ctx)return
    ctx.fillStyle='#ffffff'
    ctx.font='bold 63px sans-serif'
    ctx.textBaseline='middle';ctx.fillText(text,16,73)
    const texture=new THREE.CanvasTexture(c)
    texture.colorSpace=THREE.SRGBColorSpace
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(scaleW,scaleW*150/512),
      new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}))
    plane.position.set(x,y,z)
    plane.rotation.y=rotationY
    root.add(plane)
  }
  label('T7 AMR',-0.53,1.04,0.339,0,0.31)
  label('T7 AMR',-0.53,1.04,-0.339,Math.PI,0.31)
  label('TENNANT',0.824,0.77,0,Math.PI/2,0.28)
  return root
}

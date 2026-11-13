import * as THREE from 'three'
import {supermarketObstacles,type Obstacle} from '../src/geometry.ts'

type PalletCarton=Readonly<{
  x:number;y:number;z:number
  width:number;height:number;depth:number
}>

/** Derive all sixty decorative cartons from the same collision AABB.
 * Layout remains bounded when scenario dimensions change. */
export const palletCartonLayout=(obstacle:Obstacle):readonly PalletCarton[]=>{
  const rows=6
  const layers=5
  const baseHeight=Math.min(.14,obstacle.height*.13)
  const stepY=(obstacle.height-baseHeight)/layers
  const stepZ=obstacle.halfZ*2/(rows+.18)
  return Array.from({length:rows*2*layers},(_,index)=>{
    const side=index%2
    const row=Math.floor(index/2)%rows
    const layer=Math.floor(index/(rows*2))
    return {
      x:obstacle.x+(side-.5)*obstacle.halfX*.94,
      y:baseHeight+stepY*(layer+.42),
      z:obstacle.z+(row-(rows-1)/2)*stepZ,
      width:obstacle.halfX*.84,
      height:stepY*.84,
      depth:stepZ*.90,
    }
  })
}

const textureFromCanvas=(canvas:HTMLCanvasElement)=>{
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=2
  return texture
}

/** Decorative boxed goods stay strictly inside the canonical blocker AABB. */
const crateTexture=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=256
  const ctx=canvas.getContext('2d')!
  ctx.fillStyle='#b59164'
  ctx.fillRect(0,0,256,256)
  for(let y=0;y<256;y+=3){
    ctx.fillStyle=y%2?'rgba(61,42,20,.045)':'rgba(255,242,199,.055)'
    ctx.fillRect(0,y,256,1)
  }
  ctx.fillStyle='#e5d5ad';ctx.fillRect(15,44,226,156)
  ctx.strokeStyle='#68563a';ctx.lineWidth=3
  ctx.strokeRect(15,44,226,156)
  ctx.fillStyle='#355449'
  ctx.textAlign='center'
  ctx.font='bold 37px Arial,sans-serif'
  ctx.fillText('FRESH',128,101)
  ctx.font='bold 21px Arial,sans-serif'
  ctx.fillText('MARKET GOODS',128,138)
  ctx.font='15px monospace'
  ctx.fillText('HANDLE WITH CARE',128,169)
  ctx.fillStyle='#654e2e'
  for(let i=0;i<29;i++)ctx.fillRect(43+i*5.8,213,1+i%3,20)
  return textureFromCanvas(canvas)
}

/** Stationary distant cooler wall. Not a navigable shelf or LiDAR object.
 * All detail is painted into one image; no dynamic reflection pass. */
const refrigeratorTexture=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=1536;canvas.height=512
  const ctx=canvas.getContext('2d')!
  const background=ctx.createLinearGradient(0,0,0,512)
  background.addColorStop(0,'#5c747b')
  background.addColorStop(.14,'#243e46')
  background.addColorStop(1,'#172b32')
  ctx.fillStyle=background;ctx.fillRect(0,0,1536,512)
  for(let bay=0;bay<12;bay++){
    const x=bay*128
    ctx.fillStyle='#63777c';ctx.fillRect(x,0,7,512)
    ctx.fillStyle='#7f9090';ctx.fillRect(x+121,0,7,512)
    const interior=ctx.createLinearGradient(x,0,x+128,0)
    interior.addColorStop(0,'#253b41')
    interior.addColorStop(.22,'#40565a')
    interior.addColorStop(.83,'#31494e')
    interior.addColorStop(1,'#182b33')
    ctx.fillStyle=interior;ctx.fillRect(x+7,14,114,474)
    for(let shelf=0;shelf<5;shelf++){
      const sy=65+shelf*82
      ctx.fillStyle='#a7b5af';ctx.fillRect(x+8,sy+55,113,7)
      for(let product=0;product<8;product++){
        const xx=x+13+product*13.3
        const hue=(bay*23+shelf*37+product*17)%360
        const height=28+(product*5+bay)%18
        ctx.fillStyle='hsl('+hue+' 45% 63%)'
        ctx.fillRect(xx,sy+54-height,10,height)
        ctx.fillStyle='rgba(255,255,255,.63)'
        ctx.fillRect(xx+2,sy+54-height+7,6,4)
        ctx.fillStyle='rgba(0,0,0,.16)'
        ctx.fillRect(xx+8,sy+54-height,2,height)
      }
    }
    const glare=ctx.createLinearGradient(x+15,0,x+104,0)
    glare.addColorStop(0,'rgba(255,255,255,.02)')
    glare.addColorStop(.35,'rgba(210,242,248,.15)')
    glare.addColorStop(.58,'rgba(210,242,248,.035)')
    glare.addColorStop(1,'rgba(255,255,255,.01)')
    ctx.fillStyle=glare;ctx.fillRect(x+8,14,113,474)
    ctx.fillStyle='#d6dfe0';ctx.fillRect(x+105,175,4,138)
    ctx.fillStyle='#677c7d';ctx.fillRect(x+105,175,2,138)
  }
  ctx.fillStyle='#d5d9d2';ctx.fillRect(0,0,1536,14)
  ctx.fillStyle='#718587';ctx.fillRect(0,488,1536,24)
  return textureFromCanvas(canvas)
}

const endcapTexture=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=256;canvas.height=384
  const ctx=canvas.getContext('2d')!
  const gradient=ctx.createLinearGradient(0,0,256,384)
  gradient.addColorStop(0,'#e3e2c7');gradient.addColorStop(1,'#b3c7a1')
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,384)
  ctx.fillStyle='#315d52';ctx.fillRect(0,0,256,77)
  ctx.fillStyle='#faf9ec';ctx.textAlign='center'
  ctx.font='bold 30px Arial';ctx.fillText('FRESH PICKS',128,50)
  for(let i=0;i<6;i++){
    const x=67+(i%2)*112
    const y=118+Math.floor(i/2)*80
    ctx.fillStyle=i%3===0?'#d79d44':i%3===1?'#b65b3f':'#769c55'
    ctx.beginPath();ctx.ellipse(x,y,32,29,0,0,Math.PI*2);ctx.fill()
    ctx.fillStyle='rgba(255,255,255,.36)'
    ctx.beginPath();ctx.ellipse(x-11,y-8,11,5,-.7,0,Math.PI*2);ctx.fill()
  }
  ctx.fillStyle='#315d52';ctx.fillRect(0,341,256,43)
  ctx.fillStyle='#fff9e1';ctx.font='bold 23px Arial'
  ctx.fillText('GOOD EVERY DAY',128,370)
  return textureFromCanvas(canvas)
}

/** Photo-facing visual-only details. No mutations to src/geometry.ts. */
export const createSupermarketDecor=(room:THREE.Group,rack:THREE.Group)=>{
  const textures:THREE.Texture[]=[]
  const blocker=supermarketObstacles.find(o=>o.kind==='obstruction')
  if(!blocker)throw Error('Supermarket display obstruction missing')
  const label=crateTexture()
  textures.push(label)
  const crateGeometry=new THREE.BoxGeometry(1,1,1)
  const crateMaterial=new THREE.MeshLambertMaterial({map:label,color:0xffffff})
  const cartons=palletCartonLayout(blocker)
  const crates=new THREE.InstancedMesh(crateGeometry,crateMaterial,cartons.length)
  const matrix=new THREE.Matrix4()
  const color=new THREE.Color()
  cartons.forEach((carton,index)=>{
    matrix.makeScale(carton.width,carton.height,carton.depth)
      .setPosition(carton.x,carton.y,carton.z)
    crates.setMatrixAt(index,matrix)
    color.setHSL(.095+(index%5)*.003,.2,.81+(index%7)*.012)
    crates.setColorAt(index,color)
  })
  crates.instanceMatrix.needsUpdate=true
  if(crates.instanceColor)crates.instanceColor.needsUpdate=true
  crates.castShadow=false;crates.receiveShadow=false
  crates.name='Decorative cardboard pallet display (canonical obstruction AABB)'
  rack.add(crates)
  const wood=new THREE.MeshLambertMaterial({color:0x886a4b})
  const baseHeight=Math.min(.14,blocker.height*.13)
  const slatGeometry=new THREE.BoxGeometry(
    blocker.halfX*1.75,baseHeight*.7,blocker.halfZ*.125,
  )
  const slats=new THREE.InstancedMesh(slatGeometry,wood,6)
  for(let row=0;row<6;row++)
    slats.setMatrixAt(row,matrix.makeTranslation(
      blocker.x,baseHeight*.4,cartons[row*2]!.z,
    ))
  slats.instanceMatrix.needsUpdate=true
  slats.name='Pallet supports (render only)'
  rack.add(slats)

  const coolerTexture=refrigeratorTexture()
  textures.push(coolerTexture)
  const coolers=new THREE.Mesh(
    new THREE.PlaneGeometry(12.8,2.85),
    new THREE.MeshBasicMaterial({map:coolerTexture}),
  )
  coolers.rotation.y=-Math.PI/2
  coolers.position.set(14.115,1.58,0)
  coolers.name='Distant grocery refrigeration backdrop (not physical)'
  room.add(coolers)

  const poster=endcapTexture()
  textures.push(poster)
  const posterMesh=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.74,1.26),
    new THREE.MeshBasicMaterial({map:poster,side:THREE.DoubleSide}),8,
  )
  let count=0
  const transform=new THREE.Object3D()
  for(const shelf of supermarketObstacles.filter(o=>o.kind==='shelf')){
    for(const face of [-1,1]){
      transform.position.set(shelf.x+face*(shelf.halfX+.02),1.2,shelf.z)
      transform.rotation.set(0,face===1?Math.PI/2:-Math.PI/2,0)
      transform.updateMatrix()
      posterMesh.setMatrixAt(count++,transform.matrix)
    }
  }
  posterMesh.instanceMatrix.needsUpdate=true
  posterMesh.name='Grocery endcap artwork'
  rack.add(posterMesh)
  return {dispose:()=>textures.forEach(texture=>texture.dispose())}
}

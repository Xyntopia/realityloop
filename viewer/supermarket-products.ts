import * as THREE from 'three'
import {supermarketObstacles} from '../src/geometry.ts'

type Packaging='carton'|'can'|'bottle'|'pouch'
type Product=Readonly<{
  brand:string
  name:string
  descriptor:string
  color:number
  accent:number
  packaging:Packaging
}>
const products:readonly Product[]=[
  {brand:'MORNING',name:'CORN FLAKES',descriptor:'TOASTED & GOLDEN',color:0xe3b34f,accent:0x9b5b2d,packaging:'carton'},
  {brand:'NATURE',name:'WHOLE GRAIN',descriptor:'ORIGINAL RECIPE',color:0x659374,accent:0xe6d4a3,packaging:'carton'},
  {brand:'GOLDEN',name:'OAT CRUNCH',descriptor:'FAMILY FAVORITE',color:0xe8c561,accent:0x65865d,packaging:'carton'},
  {brand:'FARMHOUSE',name:'RICE CRISPS',descriptor:'LIGHT & CRISP',color:0xdadac0,accent:0x7492ad,packaging:'carton'},
  {brand:'SUNNY',name:'APPLE JUICE',descriptor:'100% FRUIT',color:0xee9b36,accent:0xffe6af,packaging:'carton'},
  {brand:'VALLEY',name:'BERRY MIX',descriptor:'NATURAL FLAVOR',color:0x99476d,accent:0xe2a6b5,packaging:'carton'},
  {brand:'GARDEN',name:'TOMATO SOUP',descriptor:'SLOW COOKED',color:0xc74743,accent:0xf4d99b,packaging:'can'},
  {brand:'TASTY',name:'BAKED BEANS',descriptor:'WITH TOMATO SAUCE',color:0xa85133,accent:0xf4cc73,packaging:'can'},
  {brand:'COASTAL',name:'PURE WATER',descriptor:'FRESH SPRING',color:0x74bfce,accent:0xe6f7f6,packaging:'bottle'},
  {brand:'SPARK',name:'LEMON SODA',descriptor:'REFRESHING',color:0xe4d04b,accent:0x729f74,packaging:'bottle'},
  {brand:'BLOOM',name:'HERBAL TEA',descriptor:'CALMING BLEND',color:0x739e88,accent:0xdcd9a3,packaging:'carton'},
  {brand:'TENDER',name:'PENNE PASTA',descriptor:'TRADITIONAL',color:0x427ba4,accent:0xf2d179,packaging:'pouch'},
  {brand:'HOMESTEAD',name:'BROWN RICE',descriptor:'LONG GRAIN',color:0xd2a968,accent:0x6b8b61,packaging:'pouch'},
  {brand:'PANTRY',name:'BLACK PEPPER',descriptor:'GROUND SPICES',color:0x5b6c59,accent:0xd8c7a4,packaging:'carton'},
  {brand:'CREAMERY',name:'ALMOND MILK',descriptor:'UNSWEETENED',color:0xece0c9,accent:0x6eafae,packaging:'carton'},
  {brand:'GROVE',name:'ORANGE BLEND',descriptor:'VITAMIN C',color:0xf0a137,accent:0xe4d272,packaging:'bottle'},
  {brand:'SEASIDE',name:'SEA SALT',descriptor:'FINE CRYSTALS',color:0x4d88a3,accent:0xe0edec,packaging:'carton'},
  {brand:'HEARTH',name:'DARK COCOA',descriptor:'RICH CHOCOLATE',color:0x75514b,accent:0xd7ae7c,packaging:'carton'},
  {brand:'ORCHARD',name:'DRIED FRUIT',descriptor:'SWEET & TART',color:0xb15f53,accent:0xe7ca72,packaging:'pouch'},
  {brand:'NUTRI',name:'PROTEIN MIX',descriptor:'NUT & SEED',color:0x718c57,accent:0xd4b375,packaging:'pouch'},
  {brand:'MELLOW',name:'STRAWBERRY',descriptor:'YOGURT DRINK',color:0xd989a6,accent:0xf3e0ed,packaging:'bottle'},
  {brand:'EVERGREEN',name:'GREEN PEAS',descriptor:'NO PRESERVATIVES',color:0x518064,accent:0xc7d38c,packaging:'can'},
  {brand:'BRIGHT',name:'MANGO NECTAR',descriptor:'FRUIT DRINK',color:0xe0aa4b,accent:0xe1cd65,packaging:'bottle'},
  {brand:'BAKERY',name:'COOKIE BITES',descriptor:'CHOCOLATE CHIPS',color:0x9f684f,accent:0xe6c99d,packaging:'pouch'},
]

const hex=(value:number)=>'#'+value.toString(16).padStart(6,'0')
const productTexture=(item:Product,index:number):THREE.CanvasTexture=>{
  const canvas=document.createElement('canvas')
  canvas.width=256
  canvas.height=384
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Product texture canvas unavailable')
  const hue=hex(item.color),accent=hex(item.accent)
  const background=ctx.createLinearGradient(0,0,256,384)
  background.addColorStop(0,'#ffffff')
  background.addColorStop(.12,hue)
  background.addColorStop(.73,hue)
  background.addColorStop(1,accent)
  ctx.fillStyle=background
  ctx.fillRect(0,0,256,384)
  // Vertical glossy wrap strip, folded corner and high-contrast category band.
  ctx.fillStyle='rgba(255,255,255,.22)'
  ctx.fillRect(4,0,11,384)
  ctx.fillStyle='rgba(20,29,28,.11)'
  ctx.fillRect(240,0,16,384)
  ctx.fillStyle=accent
  ctx.fillRect(0,58,256,18)
  ctx.fillStyle='rgba(255,255,255,.8)'
  ctx.fillRect(0,310,256,2)
  ctx.fillStyle='#ffffff'
  ctx.textAlign='center'
  ctx.textBaseline='middle'
  ctx.font='800 29px Arial,sans-serif'
  ctx.fillText(item.brand,128,31,238)
  ctx.font='700 20px Arial,sans-serif'
  ctx.fillText(item.name,128,94,240)
  ctx.font='600 13px Arial,sans-serif'
  ctx.fillText(item.descriptor,128,340,235)
  // Category illustration: embossed rings and a printed product photograph
  // proxy. Self-authored artwork avoids external/trademarked package images.
  const cx=128,cy=208
  const disk=ctx.createRadialGradient(cx-20,cy-25,5,cx,cy,105)
  disk.addColorStop(0,'#fff4d8')
  disk.addColorStop(.46,accent)
  disk.addColorStop(1,hue)
  ctx.fillStyle=disk
  ctx.beginPath();ctx.ellipse(cx,cy,88,91,0,0,Math.PI*2);ctx.fill()
  ctx.lineWidth=7
  ctx.strokeStyle='rgba(255,255,255,.78)'
  ctx.stroke()
  if(item.packaging==='can'||item.packaging==='bottle'){
    ctx.fillStyle='rgba(255,255,255,.8)'
    ctx.beginPath();ctx.ellipse(cx,cy,41,53,.16,0,Math.PI*2);ctx.fill()
    ctx.fillStyle=hue
    ctx.beginPath();ctx.ellipse(cx+7,cy-1,26,35,.1,0,Math.PI*2);ctx.fill()
  }else{
    for(let i=0;i<12;i++){
      const a=(index*7+i)*2.3999
      const r=10+Math.sqrt(i)*15
      const x=cx+Math.cos(a)*r
      const y=cy+Math.sin(a)*r*.71
      ctx.fillStyle=i%2?'rgba(255,248,202,.97)':'rgba(114,81,35,.54)'
      ctx.beginPath();ctx.ellipse(x,y,7+i%3,4+i%3,a,0,Math.PI*2);ctx.fill()
    }
  }
  ctx.fillStyle='rgba(255,255,255,.84)'
  ctx.fillRect(9,354,238,20)
  ctx.fillStyle='#343e40'
  ctx.font='700 11px monospace'
  ctx.fillText('QUALITY GUARANTEED · '+String(100+index).padStart(3,'0'),128,365,240)
  // Barcode on the side of the printed wrapper.
  ctx.fillStyle='#283134'
  for(let k=0;k<28;k++)if((k*11+index*7)%5!==1){
    ctx.fillRect(15+k*2.5,295,1+(k%3)*.4,9)
  }
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=4
  return texture
}

const priceStrip=():THREE.CanvasTexture=>{
  const canvas=document.createElement('canvas')
  canvas.width=1024;canvas.height=40
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Price strip canvas unavailable')
  ctx.fillStyle='#f6f9f5';ctx.fillRect(0,0,1024,40)
  ctx.fillStyle='#496e65';ctx.fillRect(0,0,1024,4)
  for(let i=0;i<12;i++){
    const x=i*85
    const sale=i%5===0
    if(sale){ctx.fillStyle='#eb683e';ctx.fillRect(x+3,5,74,28)}
    ctx.fillStyle=sale?'#ffffff':'#273635'
    ctx.textAlign='left';ctx.font='bold 24px Arial,sans-serif'
    ctx.fillText('$'+(1.49+i%6*.50).toFixed(2),x+6,28,72)
    ctx.fillStyle='#a1b4b3';ctx.fillRect(x+82,5,1,33)
  }
  const texture=new THREE.CanvasTexture(canvas)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.anisotropy=2
  return texture
}

const productGeometry=(kind:Packaging):THREE.BufferGeometry=>{
  switch(kind){
    case 'can':return new THREE.CylinderGeometry(.054,.054,.25,12,1)
    case 'bottle':return new THREE.CylinderGeometry(.044,.064,.28,10,1)
    case 'pouch':return new THREE.BoxGeometry(.117,.28,.17)
    default:return new THREE.BoxGeometry(.126,.296,.22)
  }
}

export type StockDetails=Readonly<{
  products:number
  prices:number
  setQuality:(quality:'high'|'balanced'|'performance')=>void
  dispose:()=>void
}>

/** Dense retail stock is a cosmetic layer. Nothing is added to contact/SLAM.
 * 1 InstancedMesh per SKU and 1 for every shelf-edge price strip. */
export const createSupermarketStock=(group:THREE.Group):StockDetails=>{
  const distributions:THREE.Matrix4[][]=products.map(()=>[])
  const pose=new THREE.Object3D()
  let prices=0
  const pricesMatrices:THREE.Matrix4[]=[]
  const shelves=supermarketObstacles.filter(o=>o.kind==='shelf')
  shelves.forEach((obstacle,shelfIndex)=>{
    const columns=18
    const spacing=obstacle.halfX*2/columns
    for(let tier=0;tier<5;tier++){
      const shelfY=.27+tier*.39
      for(const side of [-1,1]){
        const stripPose=new THREE.Object3D()
        stripPose.position.set(obstacle.x,shelfY+.052,
          obstacle.z+side*(obstacle.halfZ+.024))
        stripPose.rotation.set(0,side>0?0:Math.PI,0)
        stripPose.scale.set(obstacle.halfX*2,.078,1)
        stripPose.updateMatrix()
        pricesMatrices.push(stripPose.matrix.clone())
        prices++
        for(let depth=0;depth<2;depth++){
          for(let column=0;column<columns;column++){
            const family=Math.floor(column/3)
            const variant=(family+shelfIndex*5+tier*3+depth*7)%products.length
            const product=products[variant]!
            const orientation=side===1?Math.PI:0
            pose.position.set(
              obstacle.x-obstacle.halfX+spacing*(column+.5),
              shelfY+(product.packaging==='can' ? .145 : product.packaging==='bottle' ? .156 : .164),
              obstacle.z+side*(obstacle.halfZ-(depth===0 ? .145 : .355)),
            )
            const size=.92+((column+3*tier+shelfIndex)%5)*.021
            pose.scale.set(size,product.packaging==='pouch' ? .91 : 1,size)
            pose.rotation.set(0,orientation,0)
            pose.updateMatrix()
            distributions[variant]!.push(pose.matrix.clone())
          }
        }
      }
    }
  })
  const textures:THREE.Texture[]=[]
  const geometries:THREE.BufferGeometry[]=[]
  const materials:THREE.Material[]=[]
  const detailedMeshes:THREE.InstancedMesh[]=[]
  distributions.forEach((matrices,index)=>{
    if(!matrices.length)return
    const product=products[index]!
    const texture=productTexture(product,index)
    const material=new THREE.MeshStandardMaterial({
      map:texture,
      roughness:product.packaging==='can' ? .29 : product.packaging==='bottle' ? .28 : .71,
      metalness:product.packaging==='can' ? .48 : .02,
    })
    const geometry=productGeometry(product.packaging)
    const mesh=new THREE.InstancedMesh(geometry,material,matrices.length)
    mesh.name='Photographic-layout shelf stock: '+product.brand+' '+product.name
    mesh.frustumCulled=false
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix))
    mesh.instanceMatrix.needsUpdate=true
    // Dense stock does not cast hundreds of shadows every frame.
    mesh.castShadow=false
    mesh.receiveShadow=false
    group.add(mesh)
    detailedMeshes.push(mesh)
    textures.push(texture);materials.push(material);geometries.push(geometry)
  })
  const labelTexture=priceStrip()
  const labelGeometry=new THREE.PlaneGeometry(1,1)
  const labelMaterial=new THREE.MeshBasicMaterial({
    map:labelTexture,
    side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-1,
  })
  const labels=new THREE.InstancedMesh(labelGeometry,labelMaterial,pricesMatrices.length)
  pricesMatrices.forEach((matrix,i)=>labels.setMatrixAt(i,matrix))
  labels.instanceMatrix.needsUpdate=true
  labels.name='Shelf edge price labels'
  labels.frustumCulled=false
  group.add(labels)
  // Exactly one untextured draw call for software renderers, retaining
  // all original shelf locations but avoiding dozens of PBR shaders/uploads.
  const simplifiedGeometry=new THREE.BoxGeometry(.123,.267,.20)
  const simplifiedMaterial=new THREE.MeshLambertMaterial({color:0xffffff})
  const simplified=new THREE.InstancedMesh(simplifiedGeometry,simplifiedMaterial,
    distributions.reduce((n,m)=>n+m.length,0))
  let simplifiedIndex=0
  distributions.forEach((matrices,index)=>{
    const color=new THREE.Color(products[index]!.color)
    for(const matrix of matrices){
      simplified.setMatrixAt(simplifiedIndex,matrix)
      simplified.setColorAt(simplifiedIndex,color)
      simplifiedIndex++
    }
  })
  simplified.name='Performance-mode instanced colored retail stock'
  simplified.frustumCulled=false
  simplified.instanceMatrix.needsUpdate=true
  if(simplified.instanceColor)simplified.instanceColor.needsUpdate=true
  simplified.visible=false
  group.add(simplified)
  return {
    products:distributions.reduce((count,items)=>count+items.length,0),
    prices,
    setQuality:quality=>{
      const low=quality==='performance'
      detailedMeshes.forEach(mesh=>{mesh.visible=!low})
      simplified.visible=low
      labels.visible=!low
    },
    dispose:()=>{
      textures.forEach(texture=>texture.dispose())
      geometries.forEach(geometry=>geometry.dispose())
      materials.forEach(material=>material.dispose())
      labelTexture.dispose()
      labelGeometry.dispose()
      labelMaterial.dispose()
      simplifiedGeometry.dispose()
      simplifiedMaterial.dispose()
    },
  }
}

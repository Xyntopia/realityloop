import * as THREE from 'three'

const size=256
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n))
const hash=(x:number,y:number)=>{
  let n=(Math.imul(x,374761393)^Math.imul(y,668265263))>>>0
  n=Math.imul(n^(n>>>13),1274126177)
  return ((n^(n>>>16))>>>0)/4294967295
}

/** Tileable deterministic noise. Each scale divides the shared 256px tile. */
const noise=(x:number,y:number,scale:number)=>{
  const cells=size/scale
  const gx=Math.floor(x/scale),gy=Math.floor(y/scale)
  const fx=x/scale-gx,fy=y/scale-gy
  const tx=fx*fx*(3-2*fx),ty=fy*fy*(3-2*fy)
  const h=(dx:number,dy:number)=>
    hash((gx+dx+cells)%cells,(gy+dy+cells)%cells)
  const a=h(0,0)*(1-tx)+h(1,0)*tx
  const b=h(0,1)*(1-tx)+h(1,1)*tx
  return a*(1-ty)+b*ty
}

/** Multi-scale disturbed earth: clay, damp silt, fine gravel and aggregates.
 * Entirely generated in-memory from deterministic noise. */
export const constructionSoilSample=(x:number,y:number)=>{
  const coarse=noise(x,y,64),mid=noise(x,y,16),fine=noise(x,y,4)
  const grain=hash(x,y)
  const damp=clamp((.56-coarse)*.38,0,.18)
  const aggregate=grain>.978 ? .16 : grain<.035 ? -.14 : 0
  const shade=clamp(.24+.28*coarse+.27*mid+.18*fine+aggregate-damp,.16,.82)
  return {
    r:Math.round(93+88*shade),
    g:Math.round(79+78*shade),
    b:Math.round(64+65*shade),
    height:.24*coarse+.32*mid+.30*fine+.14*grain,
  }
}

const textureFrom=(canvas:HTMLCanvasElement,color:boolean,repeatX:number,repeatY:number)=>{
  const texture=new THREE.CanvasTexture(canvas)
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping
  texture.repeat.set(repeatX,repeatY)
  texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace
  texture.anisotropy=8
  return texture
}

export const proceduralConstructionGroundMaps=()=>{
  const diffuseCanvas=document.createElement('canvas')
  const normalCanvas=document.createElement('canvas')
  diffuseCanvas.width=normalCanvas.width=size
  diffuseCanvas.height=normalCanvas.height=size
  const diffuseContext=diffuseCanvas.getContext('2d')
  const normalContext=normalCanvas.getContext('2d')
  if(!diffuseContext||!normalContext)throw Error('Construction ground canvas unsupported')
  const diffuse=diffuseContext.createImageData(size,size)
  const normals=normalContext.createImageData(size,size)
  const height=new Float32Array(size*size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sample=constructionSoilSample(x,y)
    const at=y*size+x,offset=at*4
    height[at]=sample.height
    diffuse.data[offset]=sample.r
    diffuse.data[offset+1]=sample.g
    diffuse.data[offset+2]=sample.b
    diffuse.data[offset+3]=255
  }
  const h=(x:number,y:number)=>height[((y+size)%size)*size+(x+size)%size]
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(h(x+1,y)-h(x-1,y))*1.8
    const dy=(h(x,y+1)-h(x,y-1))*1.8
    const length=Math.hypot(dx,dy,1)
    const at=(y*size+x)*4
    normals.data[at]=Math.round(127.5*(1-dx/length))
    normals.data[at+1]=Math.round(127.5*(1-dy/length))
    normals.data[at+2]=Math.round(127.5*(1+1/length))
    normals.data[at+3]=255
  }
  diffuseContext.putImageData(diffuse,0,0)
  normalContext.putImageData(normals,0,0)
  return {
    diffuse:textureFrom(diffuseCanvas,true,18,15),
    normal:textureFrom(normalCanvas,false,18,15),
  }
}

/** Worn site machinery paint: fine scratches, embedded dust and old grime.
 * The texture modulates the equipment's base paint instead of copying decals. */
export const proceduralConstructionPaintMap=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=size
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Construction paint canvas unsupported')
  const pixels=ctx.createImageData(size,size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const coarse=noise(x,y,64),mid=noise(x,y,16),fine=noise(x,y,4)
    const grain=hash(x,y)
    const scratch=grain>.994 ? .31 : 0
    const grime=clamp((.54-coarse)*.37+(1-y/size)*.035,0,.22)
    const value=clamp(.76+.19*coarse+.09*mid+.04*fine-grime-scratch,.38,1)
    const offset=(y*size+x)*4
    pixels.data[offset]=Math.round(242*value)
    pixels.data[offset+1]=Math.round(232*value)
    pixels.data[offset+2]=Math.round(217*value)
    pixels.data[offset+3]=255
  }
  ctx.putImageData(pixels,0,0)
  return textureFrom(canvas,true,1,1)
}

export const proceduralConcreteMap=()=>{
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=size
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Concrete texture canvas unsupported')
  const image=ctx.createImageData(size,size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const blotch=noise(x,y,64)*.46+noise(x,y,16)*.34+noise(x,y,4)*.20
    const pores=hash(x,y)
    const streak=.14*Math.max(0,noise(x,0,16)-.68)*(y/size)
    const value=clamp(.58+.38*blotch-streak+(pores-.5)*.14,0,1)
    const offset=(y*size+x)*4
    image.data[offset]=Math.round(150+77*value)
    image.data[offset+1]=Math.round(146+72*value)
    image.data[offset+2]=Math.round(135+66*value)
    image.data[offset+3]=255
  }
  ctx.putImageData(image,0,0)
  return textureFrom(canvas,true,1,1)
}

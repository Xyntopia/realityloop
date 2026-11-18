import * as THREE from 'three'

const size=256
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
const fract=(v:number)=>v-Math.floor(v)
const hash=(x:number,y:number)=>fract(Math.sin(x*127.1+y*311.7+7.8)*43758.5453)
const tileNoise=(x:number,y:number,resolution:number)=>{
  const ix=Math.floor(x/resolution),iy=Math.floor(y/resolution)
  const u=fract(x/resolution),v=fract(y/resolution)
  const tx=u*u*(3-2*u),ty=v*v*(3-2*v)
  const count=size/resolution
  const h=(a:number,b:number)=>hash(
    ((ix+a)%count+count)%count,((iy+b)%count+count)%count)
  const a=h(0,0)*(1-tx)+h(1,0)*tx
  const b=h(0,1)*(1-tx)+h(1,1)*tx
  return a*(1-ty)+b*ty
}

/** Ferric dust, fine sand, basalt chips and shallow sediment staining.
 * Artistic procedural field, not a sampled Martian regolith dataset. */
export const sampleMartianRegolith=(x:number,y:number)=>{
  const large=tileNoise(x,y,64),mid=tileNoise(x,y,16)
  const grain=tileNoise(x,y,4),speck=hash(x,y)
  const darkChip=speck>.985 ? -.33 : speck<.019 ? .25 : 0
  const stain=.6*large+.26*mid+.14*grain
  const value=clamp(.33+.54*stain+darkChip,.15,.94)
  return {
    r:Math.round(135+94*value),
    g:Math.round(75+88*value),
    b:Math.round(50+72*value),
    height:large*.28+mid*.30+grain*.35+speck*.07,
  }
}

const texture=(canvas:HTMLCanvasElement,srgb:boolean)=>{
  const result=new THREE.CanvasTexture(canvas)
  result.wrapS=result.wrapT=THREE.RepeatWrapping
  result.repeat.set(13,9)
  result.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace
  result.anisotropy=8
  return result
}
export const proceduralMarsGroundMaps=()=>{
  const diffuseCanvas=document.createElement('canvas')
  const normalCanvas=document.createElement('canvas')
  diffuseCanvas.width=normalCanvas.width=size
  diffuseCanvas.height=normalCanvas.height=size
  const dc=diffuseCanvas.getContext('2d'),nc=normalCanvas.getContext('2d')
  if(!dc||!nc)throw Error('Mars regolith canvas unsupported')
  const pixels=dc.createImageData(size,size),normals=nc.createImageData(size,size)
  const heights=new Float32Array(size*size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sample=sampleMartianRegolith(x,y)
    const i=y*size+x,k=i*4
    heights[i]=sample.height
    pixels.data[k]=sample.r
    pixels.data[k+1]=sample.g
    pixels.data[k+2]=sample.b
    pixels.data[k+3]=255
  }
  const h=(x:number,y:number)=>heights[((y+size)%size)*size+(x+size)%size]
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=1.5*(h(x+1,y)-h(x-1,y))
    const dy=1.5*(h(x,y+1)-h(x,y-1))
    const len=Math.hypot(dx,dy,1),i=(y*size+x)*4
    normals.data[i]=Math.round(127.5*(1-dx/len))
    normals.data[i+1]=Math.round(127.5*(1-dy/len))
    normals.data[i+2]=Math.round(127.5*(1+1/len))
    normals.data[i+3]=255
  }
  dc.putImageData(pixels,0,0)
  nc.putImageData(normals,0,0)
  return {diffuse:texture(diffuseCanvas,true),normal:texture(normalCanvas,false)}
}

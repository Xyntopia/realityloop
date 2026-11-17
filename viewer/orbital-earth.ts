import * as THREE from 'three'
import blueMarbleUrl from '../assets/textures/blue-marble-july-2048.jpg?url'

/**
 * A display-only Earth backdrop, not propagated orbital state or a calibrated
 * geospatial model. The surface is the downscaled July 2004 Blue Marble:
 * Next Generation global composite from NASA Earth Observatory.
 * Asset provenance and NASA usage terms: assets/textures/README.md.
 */
const rand=(x:number,y:number)=>{
  const n=Math.sin(x*127.1+y*311.7)*43758.5453
  return n-Math.floor(n)
}
const noise=(x:number,y:number)=>{
  const ix=Math.floor(x),iy=Math.floor(y)
  const tx=x-ix,ty=y-iy
  const sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty)
  const v00=rand(ix,iy),v10=rand(ix+1,iy)
  const v01=rand(ix,iy+1),v11=rand(ix+1,iy+1)
  return ((1-sx)*v00+sx*v10)*(1-sy)+((1-sx)*v01+sx*v11)*sy
}
/** Intentionally subtle clouds: the Blue Marble base map is cloud-free.
 * Keeping this layer procedurally generated avoids a second image download. */
const makeCloudMap=()=>{
  const width=512,height=256
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Earth cloud layer requires Canvas2D')
  const pixels=ctx.createImageData(width,height)
  for(let y=0;y<height;y++){
    const v=y/height
    for(let x=0;x<width;x++){
      const u=x/width
      const n=.55*noise(u*16,v*8)
        +.27*noise(u*38,v*19)
        +.18*noise(u*91,v*45)
      const belts=.065*Math.sin(v*48+3*Math.sin(u*13))
      const alpha=Math.min(175,Math.max(0,(n+belts-.58)*850))
      const offset=(y*width+x)*4
      pixels.data[offset]=237
      pixels.data[offset+1]=243
      pixels.data[offset+2]=247
      pixels.data[offset+3]=alpha
    }
  }
  ctx.putImageData(pixels,0,0)
  const tex=new THREE.CanvasTexture(canvas)
  tex.colorSpace=THREE.SRGBColorSpace
  tex.anisotropy=2
  return tex
}

/** The static backdrop has no effect on ADCS, contacts or sensors. */
export const addOrbitalEarth=(scene:THREE.Scene)=>{
  const globe=new THREE.Group()
  globe.name='NASA Blue Marble Earth backdrop'
  globe.position.set(-2,-29,-51)
  globe.rotation.set(.13,-.45,-.08)
  scene.add(globe)
  const radius=22
  const surfaceMap=new THREE.TextureLoader().load(blueMarbleUrl)
  surfaceMap.name='NASA Blue Marble July 2004 (2048x1024)'
  surfaceMap.colorSpace=THREE.SRGBColorSpace
  surfaceMap.anisotropy=4
  const ground=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),
    new THREE.MeshStandardMaterial({
      map:surfaceMap,roughness:1,metalness:0,
    }))
  ground.name='Earth globe'
  globe.add(ground)
  const clouds=new THREE.Mesh(
    new THREE.SphereGeometry(radius*1.009,72,48),
    new THREE.MeshStandardMaterial({
      map:makeCloudMap(),transparent:true,depthWrite:false,roughness:1,
      opacity:.65,metalness:0,
    }))
  clouds.name='Subtle synthetic cloud layer'
  globe.add(clouds)
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.025,80,48),
    new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,
      side:THREE.FrontSide,
      vertexShader:`
        varying vec3 surfaceNormal;
        varying vec3 viewVector;
        void main(){
          vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
          surfaceNormal=normalize(normalMatrix*normal);
          viewVector=normalize(-mvPosition.xyz);
          gl_Position=projectionMatrix*mvPosition;
        }
      `,
      fragmentShader:`
        varying vec3 surfaceNormal;
        varying vec3 viewVector;
        void main(){
          float fresnel=pow(1.0-max(0.0,dot(normalize(surfaceNormal),
            normalize(viewVector))),3.6);
          vec3 air=mix(vec3(.05,.25,.53),vec3(.31,.66,.94),fresnel);
          gl_FragColor=vec4(air,clamp(fresnel*.85,0.0,.64));
        }
      `,
    }))
  atmosphere.name='Atmospheric rim'
  globe.add(atmosphere)
  return globe
}

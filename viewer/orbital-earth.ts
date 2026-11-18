import * as THREE from 'three'
import blueMarbleUrl from '../assets/textures/blue-marble-july-2048.jpg?url'
import {earthCloudAlpha} from '../src/earth-clouds.ts'

/**
 * A display-only Earth backdrop, not propagated orbital state or a calibrated
 * geospatial model. The surface is the downscaled July 2004 Blue Marble:
 * Next Generation global composite from NASA Earth Observatory.
 * Asset provenance and NASA usage terms: assets/textures/README.md.
 */
/** Longitude-periodic, multi-scale cloud bands with two atmospheric
 * decks. Procedural: this is not observed meteorology or a weather forecast. */
const makeCloudMap=(layer:number)=>{
  const width=layer===0?1024:512,height=layer===0?512:256
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Earth cloud layer requires Canvas2D')
  const pixels=ctx.createImageData(width,height)
  for(let y=0;y<height;y++){
    const v=y/(height-1)
    for(let x=0;x<width;x++){
      const u=x/(width-1)
      const alpha=earthCloudAlpha(u,v,layer)
      const offset=(y*width+x)*4
      pixels.data[offset]=layer===0?241:224
      pixels.data[offset+1]=layer===0?246:236
      pixels.data[offset+2]=250
      pixels.data[offset+3]=alpha
    }
  }
  ctx.putImageData(pixels,0,0)
  const tex=new THREE.CanvasTexture(canvas)
  tex.colorSpace=THREE.SRGBColorSpace
  tex.anisotropy=4
  return tex
}

/** Display-only globe: positioned from the chief's recorded ECI radial
 * direction but compressed in size/distance; no orbital force or sensors. */
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
  const clouds=new THREE.Group()
  clouds.name='Procedural atmospheric clouds'
  const decks=[
    {radius:radius*1.010,opacity:.94,layer:0},
    {radius:radius*1.018,opacity:.33,layer:1},
  ]
  for(const deck of decks){
    const cloud=new THREE.Mesh(new THREE.SphereGeometry(deck.radius,96,64),
      new THREE.MeshStandardMaterial({
        map:makeCloudMap(deck.layer),transparent:true,
        depthWrite:false,roughness:1,opacity:deck.opacity,metalness:0,
        side:THREE.FrontSide,
      }))
    cloud.name=deck.layer===0?'Lower atmospheric cloud deck':'High wispy clouds'
    clouds.add(cloud)
  }
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

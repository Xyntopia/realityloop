import * as THREE from 'three'

/** Procedural outdoor textures and sky: local artifacts with no source photos,
 * external network dependencies or bake-time infrastructure. */
const clamp=(x:number)=>Math.max(0,Math.min(1,x))
const hash=(x:number,y:number)=>{
  const n=Math.sin(x*127.1+y*311.7)*43758.5453
  return n-Math.floor(n)
}
const valueNoise=(u:number,v:number)=>{
  const x=Math.floor(u),y=Math.floor(v)
  const tx=(u-x)**2*(3-2*(u-x)),ty=(v-y)**2*(3-2*(v-y))
  const a=hash(x,y),b=hash(x+1,y)
  const c=hash(x,y+1),d=hash(x+1,y+1)
  return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
}
const createGroundMaps=()=>{
  const size=256
  const canvas=document.createElement('canvas')
  const normals=document.createElement('canvas')
  canvas.width=canvas.height=normals.width=normals.height=size
  const context=canvas.getContext('2d')
  const normalContext=normals.getContext('2d')
  if(!context||!normalContext)throw Error('Soil materials require Canvas2D')
  const colors=context.createImageData(size,size)
  const map=normalContext.createImageData(size,size)
  const height=(u:number,v:number)=>
    .57*valueNoise(u*22,v*22)+.30*valueNoise(u*63,v*63)
      +.13*valueNoise(u*119,v*119)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size,i=(y*size+x)*4
    const texture=height(u,v)
    const small=hash(x,y)
    const grit=Math.round(27*(small-.5))
    const vegetation=clamp((valueNoise(u*8,v*8)-.55)*3)
    colors.data[i]=Math.round(139+28*(texture-.5)+grit-42*vegetation)
    colors.data[i+1]=Math.round(131+23*(texture-.5)+grit+4*vegetation)
    colors.data[i+2]=Math.round(106+15*(texture-.5)+grit-33*vegetation)
    colors.data[i+3]=255
    const dx=(height(u+1/size,v)-height(u-1/size,v))*1.2
    const dy=(height(u,v+1/size)-height(u,v-1/size))*1.2
    const normal=new THREE.Vector3(-dx,-dy,1).normalize()
    map.data[i]=Math.round((normal.x+1)*127.5)
    map.data[i+1]=Math.round((normal.y+1)*127.5)
    map.data[i+2]=Math.round((normal.z+1)*127.5)
    map.data[i+3]=255
  }
  context.putImageData(colors,0,0)
  normalContext.putImageData(map,0,0)
  const diffuse=new THREE.CanvasTexture(canvas)
  const normal=new THREE.CanvasTexture(normals)
  for(const tex of [diffuse,normal]){
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping
    tex.repeat.set(24,20)
    tex.anisotropy=4
  }
  diffuse.colorSpace=THREE.SRGBColorSpace
  normal.colorSpace=THREE.NoColorSpace
  return {diffuse,normal}
}
export const createSolarGroundMaterial=()=>{
  const maps=createGroundMaps()
  return new THREE.MeshStandardMaterial({
    vertexColors:true,map:maps.diffuse,normalMap:maps.normal,
    normalScale:new THREE.Vector2(.32,.32),roughness:1,metalness:0,
  })
}

export const addSolarSky=(scene:THREE.Scene)=>{
  const sun=new THREE.Vector3(.3,.6,.4).normalize()
  const dome=new THREE.Mesh(new THREE.SphereGeometry(950,28,20),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{sunDirection:{value:sun}},
      vertexShader:`
        varying vec3 direction;
        void main(){
          direction=normalize(position);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        }
      `,
      fragmentShader:`
        uniform vec3 sunDirection;
        varying vec3 direction;
        void main(){
          vec3 ray=normalize(direction);
          float h=clamp(ray.y,0.,1.);
          vec3 horizon=vec3(.74,.77,.76);
          vec3 high=vec3(.31,.55,.76);
          vec3 color=mix(horizon,high,pow(h,.58));
          float sunGlow=pow(max(0.,dot(ray,normalize(sunDirection))),46.);
          float sunDisk=pow(max(0.,dot(ray,normalize(sunDirection))),2200.);
          color+=vec3(.79,.58,.34)*.24*sunGlow
               +vec3(.86,.77,.60)*.5*sunDisk;
          gl_FragColor=vec4(color,1.);
        }
      `,
    }))
  dome.name='Atmospheric sky with actual sun direction'
  dome.renderOrder=-10
  scene.add(dome)
  return (direction:THREE.Vector3)=>{
    sun.copy(direction).normalize()
  }
}

export const addSkyReflections=(scene:THREE.Scene,renderer:THREE.WebGLRenderer)=>{
  const width=256,height=128
  const bytes=new Uint8Array(width*height*4)
  for(let y=0;y<height;y++){
    const altitude=1-y/(height-1)
    const h=Math.max(0,(altitude-.5)*2)
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4
      bytes[i]=Math.round(155-93*h)
      bytes[i+1]=Math.round(175-57*h)
      bytes[i+2]=Math.round(178+28*h)
      bytes[i+3]=255
    }
  }
  const env=new THREE.DataTexture(bytes,width,height)
  env.mapping=THREE.EquirectangularReflectionMapping
  env.colorSpace=THREE.SRGBColorSpace
  env.needsUpdate=true
  const generator=new THREE.PMREMGenerator(renderer)
  const target=generator.fromEquirectangular(env)
  scene.environment=target.texture
  env.dispose()
  generator.dispose()
  return target
}

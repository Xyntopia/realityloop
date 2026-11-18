import type {Obstacle} from '../src/geometry.ts'

/** Cheap static indirect-light occlusion for the floor, sampled once at scene
 * creation from the canonical shelf footprints. Not part of physics/sensors.
 * Dynamic robot contacts and direct lamp highlights remain real-time. */
export const bakedFloorOcclusion=(
  x:number,z:number,obstacles:readonly Obstacle[],
):number=>{
  // Falloff at room edges approximates indirect bounce loss in wall/floor seams.
  const edge=Math.max(0,Math.min(x+5.8,14.2-x,z+7.45,7.45-z))
  const wall=.11*Math.exp(-edge/.28)
  let shelf=0
  for(const obstacle of obstacles){
    const dx=Math.max(0,Math.abs(x-obstacle.x)-obstacle.halfX)
    const dz=Math.max(0,Math.abs(z-obstacle.z)-obstacle.halfZ)
    const distance=Math.hypot(dx,dz)
    const occlusion=obstacle.kind==='shelf' ? .32 : .25
    // Indirect-light occlusion is strongest beneath the fixed shelves and
    // decays rapidly into the open aisle; no hard, view-dependent shadow line.
    shelf=Math.max(shelf,occlusion*Math.exp(-((distance/.28)**2)))
  }
  return Math.max(.5,1-wall-shelf)
}

/** Returned canvas can become a single 2nd-UV aoMap (no runtime AO pass).
 * Floor UV orientation is shared with THREE.PlaneGeometry after rotation.
 * Draw the same deterministic gray channel in R/G/B (Three.js aoMap reads R). */
export const bakeFloorOcclusion=(obstacles:readonly Obstacle[])=>{
  const width=384,height=288
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height
  const context=canvas.getContext('2d')
  if(!context)throw Error('Static floor AO canvas unavailable')
  const pixels=context.createImageData(width,height)
  for(let y=0;y<height;y++){
    const z=-7.5+(y+.5)/height*15
    for(let x=0;x<width;x++){
      const worldX=-5.8+(x+.5)/width*20
      const intensity=Math.round(255*bakedFloorOcclusion(worldX,z,obstacles))
      const pixel=4*(y*width+x)
      pixels.data[pixel]=pixels.data[pixel+1]=pixels.data[pixel+2]=intensity
      pixels.data[pixel+3]=255
    }
  }
  context.putImageData(pixels,0,0)
  return canvas
}

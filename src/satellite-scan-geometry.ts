import {
  calculateSatelliteInertia,satelliteModules,type CubeModule,type Point3,
} from './mission-experiments.ts'

export type SatelliteLayout='compact'|'distributed'|'asymmetric'
export type ProjectedBodyBox={xmin:number;xmax:number;ymin:number;ymax:number}

/** Shared solar-panel dimensions and centers for the rendered bus and the
 * sensor's 2D projected silhouette. Panels are angled 1.13 radians about X
 * and rectangular 1.65 x .024 x .8 metres before rotation. */
export const solarWingDimensions=(
  modules:readonly CubeModule[],center:Point3,
)=>{
  const minX=Math.min(...modules.map(m=>m.position.x-center.x))
  const maxX=Math.max(...modules.map(m=>m.position.x-center.x))
  return ([-1,1] as const).map(direction=>{
    const extent=(direction<0?-minX:maxX)+.24
    const origin=direction*(extent+.28)
    const halfY=(.8*Math.sin(1.13)+.024*Math.cos(1.13))/2
    return {
      direction,extent,origin,
      projectedBox:{
        xmin:origin-1.65/2,xmax:origin+1.65/2,
        ymin:-halfY,ymax:halfY,
      },
    }
  })
}

export const satelliteProjectedBoxes=(layout:SatelliteLayout):ProjectedBodyBox[]=>{
  const modules=satelliteModules(layout)
  const com=calculateSatelliteInertia(modules).centerOfMass
  const boxes=modules.map(m=>({
    xmin:m.position.x-com.x-.182,xmax:m.position.x-com.x+.182,
    ymin:m.position.y-com.y-.182,ymax:m.position.y-com.y+.182,
  }))
  return [...boxes,...solarWingDimensions(modules,com).map(wing=>wing.projectedBox)]
}

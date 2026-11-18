import type {Point3,Quaternion} from './mission-experiments.ts'
import {satelliteProjectedBoxes} from './satellite-scan-geometry.ts'
import type {OrbitalState} from './orbital-formation.ts'

type Point={x:number;y:number}
type Pose=Point&{yaw:number}
export type InspectionSnapshot={
  scanPoints:Point[]
  mapPoints:Point[]
  sensor:Pose
  matches:number
  rmsMetres:number|null
  rays:number
  coveragePercent:number
}
type Box={xmin:number;xmax:number;ymin:number;ymax:number}
const sq=(n:number)=>n*n
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
const rotate=(p:Point,a:number):Point=>({
  x:p.x*Math.cos(a)-p.y*Math.sin(a),
  y:p.x*Math.sin(a)+p.y*Math.cos(a),
})
const transform=(point:Point,pose:Pose):Point=>{
  const r=rotate(point,pose.yaw)
  return {x:r.x+pose.x,y:r.y+pose.y}
}
/** Transform RTN coordinates into the satellite's body coordinates with
 * the conjugate of its normalized quaternion (not just planar Euler yaw). */
export const rotateIntoSatelliteBody=(r:Point3,q:Quaternion):Point3=>{
  const size=Math.hypot(q.x,q.y,q.z,q.w)
  if(size<1e-12)throw Error('Degenerate satellite quaternion')
  const x=-q.x/size,y=-q.y/size,z=-q.z/size,w=q.w/size
  const tx=2*(y*r.z-z*r.y),ty=2*(z*r.x-x*r.z),tz=2*(x*r.y-y*r.x)
  return {
    x:r.x+w*tx+(y*tz-z*ty),
    y:r.y+w*ty+(z*tx-x*tz),
    z:r.z+w*tz+(x*ty-y*tx),
  }
}

const rayBox=(origin:Point,direction:Point,b:Box):number=>{
  let near=0,far=25
  for(const [p,d,min,max] of [
    [origin.x,direction.x,b.xmin,b.xmax],
    [origin.y,direction.y,b.ymin,b.ymax],
  ]){
    if(Math.abs(d)<1e-12){
      if(p<min||p>max)return Infinity
    }else{
      const a=(min-p)/d,z=(max-p)/d
      near=Math.max(near,Math.min(a,z))
      far=Math.min(far,Math.max(a,z))
    }
  }
  return far>=near&&far>0?near:Infinity
}

const measuredScan=(origin:Point,yaw:number,boxes:readonly Box[])=>{
  const points:Point[]=[]
  for(let i=0;i<120;i++){
    const angle=-.42+.84*i/119
    const direction={x:Math.cos(yaw+angle),y:Math.sin(yaw+angle)}
    const range=Math.min(...boxes.map(box=>rayBox(origin,direction,box)))
    if(range>24||range<.3||!Number.isFinite(range))continue
    const noisy=range+.003*Math.sin(i*8.711+origin.x*3.7)
    points.push({x:noisy*Math.cos(angle),y:noisy*Math.sin(angle)})
  }
  return points
}
const nearest=(p:Point,points:readonly Point[])=>{
  let best:Point|undefined,d2=Infinity
  for(const q of points){
    const d=sq(p.x-q.x)+sq(p.y-q.y)
    if(d<d2){d2=d;best=q}
  }
  return {point:best,distanceSquared:d2}
}

/** Point-to-point rigid 2D ICP with bounded nearest-neighbour correspondence.
 * A known initial coarse pose prior anchors the first scan; subsequent scans
 * refine dead-reckoned bearing/translation, without feeding truth to ICP. */
export const registerPlanarScan=(
  points:readonly Point[],map:readonly Point[],startingPose:Pose,
)=>{
  const pose={...startingPose}
  let matches=0,rmsMetres:number|null=null
  for(let iteration=0;iteration<5;iteration++){
    const pairs:{source:Point;target:Point}[]=[]
    for(const point of points){
      const source=transform(point,pose)
      const found=nearest(source,map)
      if(found.point&&found.distanceSquared<sq(.24))
        pairs.push({source,target:found.point})
    }
    matches=pairs.length
    if(matches<3)break
    const center=(key:'source'|'target'):Point=>({
      x:pairs.reduce((s,p)=>s+p[key].x,0)/matches,
      y:pairs.reduce((s,p)=>s+p[key].y,0)/matches,
    })
    const c=center('source'),d=center('target')
    let xy=0,xx=0
    for(const p of pairs){
      const ax=p.source.x-c.x,ay=p.source.y-c.y
      const bx=p.target.x-d.x,by=p.target.y-d.y
      xx+=ax*bx+ay*by
      xy+=ax*by-ay*bx
    }
    const rotation=Math.atan2(xy,xx)
    const rc=rotate(c,rotation)
    const shift={x:d.x-rc.x,y:d.y-rc.y}
    const corrected=rotate(pose,rotation)
    pose.x=corrected.x+shift.x
    pose.y=corrected.y+shift.y
    pose.yaw+=rotation
    if(Math.abs(rotation)<1e-7&&Math.hypot(shift.x,shift.y)<1e-5)break
  }
  const pairs=points.map(p=>nearest(transform(p,pose),map).distanceSquared)
    .filter(d=>d<sq(.24))
  matches=pairs.length
  if(matches>=3)rmsMetres=Math.sqrt(pairs.reduce((s,d)=>s+d,0)/matches)
  return {pose,matches,rmsMetres}
}

/** Sparse two-dimensional active range scans of target projected CAD geometry.
 * No capture, true 6DoF visual SLAM, or sensor calibration is claimed.
 * A coarse initial pose prior is carried forward by noisy relative odometry;
 * later scans do not get a fresh absolute ground-truth pose reset.
 * Geometry is kept separate from the actual Kepler orbit and reaction wheels. */
export const inspectFormation=(
  orbit:readonly OrbitalState[],layout:'compact'|'distributed'|'asymmetric',
  quaternions:readonly {x:number;y:number;z:number;w:number}[]=[],
):Array<[number,InspectionSnapshot]>=>{
  const boxes:Box[]=satelliteProjectedBoxes(layout)
  const map:Point[]=[]
  const result:Array<[number,InspectionSnapshot]>=[]
  let lastActual:Pose|undefined
  let lastEstimated:Pose|undefined
  const scanStep=Math.max(1,Math.round(2/(orbit[1]?.timeSeconds??2)))
  for(let i=0;i<orbit.length;i+=scanStep){
    const relative=orbit[i]!.relativeRTN
    const bodyPosition=rotateIntoSatelliteBody(
      relative,quaternions[i]??{x:0,y:0,z:0,w:1},
    )
    // The synthetic planar scanner is steered through the target-body XY
    // silhouette. The transverse Z component is deliberately not modeled.
    const sensor={x:bodyPosition.x,y:bodyPosition.y}
    if(distance(sensor,{x:0,y:0})>24||distance(sensor,{x:0,y:0})<1)continue
    const heading=Math.atan2(-sensor.y,-sensor.x)
    const points=measuredScan(sensor,heading,boxes)
    if(!points.length)continue
    const actual:Pose={x:sensor.x,y:sensor.y,yaw:heading}
    // Only the first scan has an absolute coarse pose prior; subsequent
    // predictions integrate relative synthetic odometry with bounded bias.
    const deltaYaw=lastActual
      ?Math.atan2(Math.sin(heading-lastActual.yaw),
        Math.cos(heading-lastActual.yaw)) : 0
    const initial:Pose=lastActual&&lastEstimated?{
      x:lastEstimated.x+(sensor.x-lastActual.x)*
        (1+.025*Math.sin(i*.33))+.004*Math.sin(i*.43),
      y:lastEstimated.y+(sensor.y-lastActual.y)*
        (1+.022*Math.cos(i*.49))+.004*Math.cos(i*.31),
      yaw:lastEstimated.yaw+deltaYaw+.003*Math.sin(i*.37),
    }:{
      x:sensor.x+.028*Math.sin(i*2.1+1),
      y:sensor.y+.026*Math.cos(i*.7+2),
      yaw:heading+.006*Math.sin(i*.31+1),
    }
    const aligned=map.length>3
      ?registerPlanarScan(points,map,initial)
      :{pose:initial,matches:0,rmsMetres:null}
    lastActual=actual
    lastEstimated={...aligned.pose}
    const scanPoints=points.map(point=>transform(point,aligned.pose))
    for(const p of scanPoints){
      if(map.length<1200&&nearest(p,map).distanceSquared>sq(.05))map.push(p)
    }
    const coveragePercent=Math.min(100,Math.round(map.length/240*100))
    result.push([i,{
      scanPoints,mapPoints:map.map(p=>({...p})),sensor:aligned.pose,
      matches:aligned.matches,rmsMetres:aligned.rmsMetres,
      rays:points.length,coveragePercent,
    }])
  }
  return result
}

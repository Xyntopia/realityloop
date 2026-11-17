import {
  sampleRobotSensors, scanLidar3D, type SensorFrame, type PointCloud3D,
} from './sensors.ts'
import type { Pose2D } from './slam.ts'

type PoseSample=Pose2D & {speed:number;timeSeconds:number}
const isPoseSample=(sample:unknown):sample is PoseSample=>{
  if(!sample || typeof sample!=='object')return false
  const r=sample as Record<string,unknown>
  return ['x','z','yaw','speed','timeSeconds'].every(k=>
    typeof r[k]==='number' && Number.isFinite(r[k]))
}

export type RealityLoopObservations = {
  schema:'realityloop.sensor-observations/v1'
  available:boolean
  frames:readonly SensorFrame[]
  lidar:readonly {timeSeconds:number;clouds:readonly PointCloud3D[]}[]
  source:'simulation-trajectory'
  lidarPeriodSeconds:number
}

/** Deterministic post-processing of the DAG simulation artifact.
 * Does not advance, mutate or resimulate the physical state.
 * XYZ clouds are downsampled in time; raw IMU/encoder readings remain
 * timestamped at the solver's observation cadence.
 */
export const createSensorObservations=(
  result:{observations:readonly unknown[];scenario?:unknown},
  lidarPeriodSeconds=1,
):RealityLoopObservations=>{
  if(!(lidarPeriodSeconds>0 && Number.isFinite(lidarPeriodSeconds))) {
    throw Error('Invalid LiDAR observation period')
  }
  // The existing LiDAR extrinsics/obstacles belong to the supermarket only.
  // Never silently export supermarket scans for Mars or a construction site.
  const scenario=result.scenario
  if(scenario&&typeof scenario==='object'&&'kind' in scenario&&
    ['satellite-adcs','orbital-docking','terrain-traverse'].includes(String(scenario.kind))){
    return {schema:'realityloop.sensor-observations/v1',available:false,
      frames:[],lidar:[],source:'simulation-trajectory',lidarPeriodSeconds}
  }
  const poses=result.observations.filter(isPoseSample)
  if(poses.length!==result.observations.length || poses.length===0){
    return {
      schema:'realityloop.sensor-observations/v1',
      available:false,
      frames:[],lidar:[],source:'simulation-trajectory',lidarPeriodSeconds,
    }
  }
  let previous: {pose:Pose2D;speed:number;stampSeconds:number}|undefined
  const frames:SensorFrame[]=[]
  const lidar:{timeSeconds:number;clouds:PointCloud3D[]}[]=[]
  let nextLidar=-Infinity
  for(const sample of poses){
    const pose={x:sample.x,z:sample.z,yaw:sample.yaw}
    frames.push(sampleRobotSensors(pose,sample.speed,sample.timeSeconds,previous))
    previous={pose,speed:sample.speed,stampSeconds:sample.timeSeconds}
    if(sample.timeSeconds>=nextLidar-1e-9){
      lidar.push({
        timeSeconds:sample.timeSeconds,
        clouds:scanLidar3D(pose,sample.timeSeconds),
      })
      nextLidar=sample.timeSeconds+lidarPeriodSeconds
    }
  }
  return {
    schema:'realityloop.sensor-observations/v1',
    available:true,
    frames,lidar,source:'simulation-trajectory',lidarPeriodSeconds,
  }
}

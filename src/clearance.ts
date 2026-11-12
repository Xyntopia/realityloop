import {
  referenceFootprint, supermarketObstacles, type Obstacle,
} from './geometry.ts'
import type { Pose2D } from './slam.ts'

/**
 * Signed separation of a robot-oriented rectangle and an axis-aligned obstacle.
 * Positive = a valid separating axis, negative = colliding. The positive
 * value is a conservative lower bound on Euclidean distance (SAT projection).
 */
export const signedFootprintClearance = (
  pose: Pose2D,
  obstacle: Obstacle,
  halfLength = referenceFootprint.halfLengthMetres,
  halfWidth = referenceFootprint.halfWidthMetres,
): number => {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw)
  const forward = { x: c, z: -s }
  const lateral = { x: s, z: c }
  const axes = [{x:1,z:0},{x:0,z:1},forward,lateral]
  const dx = obstacle.x-pose.x, dz = obstacle.z-pose.z
  return Math.max(...axes.map(a =>
    Math.abs(dx*a.x+dz*a.z)
      - halfLength*Math.abs(a.x*forward.x+a.z*forward.z)
      - halfWidth*Math.abs(a.x*lateral.x+a.z*lateral.z)
      - obstacle.halfX*Math.abs(a.x)
      - obstacle.halfZ*Math.abs(a.z)))
}

export type ClearanceReading = {
  clearanceMetres: number
  obstacleId: string | null
}

/** Conservative SAT projection clearance, minimum across all obstacles. */
export const clearanceAtPose = (
  pose: Pose2D,
  obstacles: readonly Obstacle[] = supermarketObstacles,
): ClearanceReading => obstacles.reduce<ClearanceReading>((best,o) => {
  const d=signedFootprintClearance(pose,o)
  return d<best.clearanceMetres ? {clearanceMetres:d,obstacleId:o.id} : best
}, {clearanceMetres:Infinity,obstacleId:null})

export type TimedPose = Pose2D & {timeSeconds: number}
export type ClearanceReport = ClearanceReading & {
  timeSeconds: number
  maximumPenetrationMetres: number
  samplesChecked: number
}

/**
 * Swept footprint approximation: densify successive solver samples in both
 * translation and heading. Returns most conservative projected clearance.
 * Local sampling is NOT continuous-time collision detection or a safety cert.
 */
export const checkSweptClearance = (
  observations: readonly TimedPose[],
  obstacles: readonly Obstacle[] = supermarketObstacles,
  maximumStepMetres = 0.035,
): ClearanceReport => {
  if (!(maximumStepMetres > 0)) throw Error('Maximum clearance step must be positive')
  if (observations.length === 0) throw Error('Clearance trajectory must not be empty')
  let reading: ClearanceReading = {clearanceMetres:Infinity,obstacleId:null}
  let timeSeconds=0, samplesChecked=0
  observations.forEach((current,i) => {
    if (![current.x,current.z,current.yaw,current.timeSeconds].every(Number.isFinite)) {
      throw Error('Clearance trajectory contains non-finite coordinates')
    }
    const previous=observations[i-1] ?? current
    const deltaYaw=Math.atan2(Math.sin(current.yaw-previous.yaw),
      Math.cos(current.yaw-previous.yaw))
    const translation=Math.hypot(current.x-previous.x,current.z-previous.z)
    const segments=Math.max(1,Math.ceil(Math.max(
      translation/maximumStepMetres,Math.abs(deltaYaw)/0.04)))
    for (let step= i===0 ? 0 : 1; step<=segments;step++) {
      const t=step/segments
      const pose={
        x:previous.x+(current.x-previous.x)*t,
        z:previous.z+(current.z-previous.z)*t,
        yaw:previous.yaw+deltaYaw*t,
      }
      const at=clearanceAtPose(pose,obstacles)
      samplesChecked++
      if (at.clearanceMetres<reading.clearanceMetres) {
        reading=at
        timeSeconds=previous.timeSeconds+(current.timeSeconds-previous.timeSeconds)*t
      }
    }
  })
  return {
    ...reading,timeSeconds,samplesChecked,
    maximumPenetrationMetres:Math.max(0,-reading.clearanceMetres),
  }
}

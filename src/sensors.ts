import { supermarketObstacles, type Obstacle } from './geometry.ts'
import { lidars, sensorOrigin, type Pose2D } from './slam.ts'

/**
 * Coordinate convention: X forward, Y up, Z lateral; positive yaw rotates
 * robot +X towards world -Z. Sensor extrinsics are illustrative, not T7AMR CAD.
 */
export type Point3D = { x: number; y: number; z: number; range: number; intensity: number }
export type PointCloud3D = {
  stampSeconds: number
  frameId: string
  sensorId: string
  points: Point3D[]
  totalBeams: number
}
export type SensorMount = {
  id: string
  frameId: string
  kind: 'rgb-camera' | 'depth-camera' | 'imu' | 'wheel-encoder'
  x: number
  y: number
  z: number
  yaw: number
  rateHz: number
  width?: number
  height?: number
  horizontalFovDegrees?: number
}

export const sensorMounts: readonly SensorMount[] = [
  { id: 'front-rgb', frameId: 'front_rgb_optical', kind: 'rgb-camera', x: 0.65, y: 1.19, z: 0, yaw: 0, rateHz: 10, width: 640, height: 360, horizontalFovDegrees: 78 },
  { id: 'front-depth', frameId: 'front_depth_optical', kind: 'depth-camera', x: 0.69, y: 0.84, z: 0, yaw: 0, rateHz: 10, width: 320, height: 180, horizontalFovDegrees: 76 },
  { id: 'rear-rgb', frameId: 'rear_rgb_optical', kind: 'rgb-camera', x: -0.72, y: 0.98, z: 0, yaw: Math.PI, rateHz: 10, width: 640, height: 360, horizontalFovDegrees: 95 },
  { id: 'imu', frameId: 'base_imu', kind: 'imu', x: 0, y: 0.48, z: 0, yaw: 0, rateHz: 100 },
  { id: 'wheel-encoder', frameId: 'front_drive_wheel', kind: 'wheel-encoder', x: 0.55, y: 0.17, z: 0, yaw: 0, rateHz: 100 },
]

const unit = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z)
const finite = (...v: number[]) => v.every(Number.isFinite)

/** Ray/AABB slab query in metres: finite, nearest front surface, deterministic. */
const rayBox3D = (
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  box: Obstacle,
): number => {
  let near = 0
  let far = Infinity
  const bmin = [box.x - box.halfX, 0, box.z - box.halfZ]
  const bmax = [box.x + box.halfX, box.height, box.z + box.halfZ]
  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-12) {
      if (origin[i] < bmin[i] || origin[i] > bmax[i]) return Infinity
    } else {
      const a = (bmin[i] - origin[i]) / direction[i]
      const b = (bmax[i] - origin[i]) / direction[i]
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
      if (far < near) return Infinity
    }
  }
  return far >= 0 ? near : Infinity
}

export const scanLidar3D = (
  pose: Pose2D,
  stampSeconds: number,
  obstacles: readonly Obstacle[] = supermarketObstacles,
): PointCloud3D[] => {
  if (!finite(pose.x, pose.z, pose.yaw, stampSeconds) || stampSeconds < 0) {
    throw Error('Invalid LiDAR pose/time')
  }
  return lidars.map(sensor => {
    const sensorPosition = sensorOrigin(pose, sensor)
    const origin: [number, number, number] = [sensorPosition.x, sensor.y, sensorPosition.z]
    const layers = sensor.side === 'front' ? 9 : 5
    const elevationLimit = sensor.side === 'front' ? 17 : 12
    const points: Point3D[] = []
    for (let layer = 0; layer < layers; layer++) {
      const elevation = (layer / (layers - 1) - 0.5) * 2 * elevationLimit * Math.PI / 180
      for (let beam = 0; beam < sensor.beams; beam++) {
        const azimuth = pose.yaw + sensor.yaw +
          (beam / (sensor.beams - 1) - 0.5) * sensor.fovRadians
        const dx = Math.cos(elevation) * Math.cos(azimuth)
        const dy = Math.sin(elevation)
        const dz = -Math.cos(elevation) * Math.sin(azimuth)
        const direction: [number, number, number] = [dx, dy, dz]
        const range = Math.min(sensor.maxRange,
          ...obstacles.map(box => rayBox3D(origin, direction, box)),
          dy < -1e-9 ? -sensor.y / dy : Infinity)
        if (range >= sensor.maxRange || range < 0.035 || !Number.isFinite(range)) continue
        const x = origin[0] + dx * range
        const y = origin[1] + dy * range
        const z = origin[2] + dz * range
        // Deterministic reflectivity placeholder, not calibrated optical intensity.
        points.push({ x, y, z, range, intensity: Math.max(0, 1 - range / sensor.maxRange) })
      }
    }
    return {
      stampSeconds, frameId: sensor.id + '_lidar', sensorId: sensor.id,
      totalBeams: sensor.beams * layers, points,
    }
  })
}

export type ImuMeasurement = {
  stampSeconds: number
  frameId: 'base_imu'
  orientation: { x: number; y: number; z: number; w: number }
  angularVelocityRadiansPerSecond: { x: number; y: number; z: number }
  specificForceMetresPerSecondSquared: { x: number; y: number; z: number }
}
export type EncoderMeasurement = {
  stampSeconds: number
  frameId: 'front_drive_wheel'
  ticks: number
  ticksPerRevolution: number
  wheelAngularVelocityRadiansPerSecond: number
}
export type CameraFrameMetadata = {
  stampSeconds: number
  frameId: string
  width: number
  height: number
  horizontalFovDegrees: number
  encoding: 'rgb8' | 'depth32f'
  /** Image bytes are produced by a separately configured renderer/reader. */
  imageAvailable: false
}
export type SensorFrame = {
  stampSeconds: number
  imu: ImuMeasurement
  encoder: EncoderMeasurement
  cameras: CameraFrameMetadata[]
}

/**
 * Surrogate samples from truth trajectory, for repeatable test fixtures only.
 * This emits a physically dimensioned IMU/encoder interface but does not model
 * covariance, sensor noise/bias, delays, drift or ground-truth-independent odometry.
 */
export const sampleRobotSensors = (
  pose: Pose2D, speed: number, stampSeconds: number,
  previous?: { pose: Pose2D; speed: number; stampSeconds: number },
): SensorFrame => {
  const dt = previous ? stampSeconds - previous.stampSeconds : 0
  if (!finite(pose.x, pose.z, pose.yaw, speed, stampSeconds) || dt < 0) {
    throw Error('Invalid sensor sample')
  }
  const yawDelta = previous
    ? Math.atan2(Math.sin(pose.yaw - previous.pose.yaw), Math.cos(pose.yaw - previous.pose.yaw)) : 0
  const yawRate = dt > 0 ? yawDelta / dt : 0
  const acceleration = dt > 0 ? (speed - (previous?.speed ?? 0)) / dt : 0
  const radius = 0.165
  const ticksPerRevolution = 2048
  const wheelOmega = speed / radius
  const forwardTravel = dt > 0 ? speed * dt : 0
  return {
    stampSeconds,
    imu: {
      stampSeconds, frameId: 'base_imu',
      orientation: { x: 0, y: Math.sin(pose.yaw / 2), z: 0, w: Math.cos(pose.yaw / 2) },
      angularVelocityRadiansPerSecond: { x: 0, y: yawRate, z: 0 },
      specificForceMetresPerSecondSquared: { x: acceleration, y: 9.81, z: speed * yawRate },
    },
    encoder: {
      stampSeconds, frameId: 'front_drive_wheel',
      ticks: Math.round(forwardTravel / (2 * Math.PI * radius) * ticksPerRevolution),
      ticksPerRevolution, wheelAngularVelocityRadiansPerSecond: wheelOmega,
    },
    cameras: sensorMounts.filter(m => m.kind === 'rgb-camera' || m.kind === 'depth-camera')
      .map(c => ({
        stampSeconds, frameId: c.frameId,
        width: c.width!, height: c.height!, horizontalFovDegrees: c.horizontalFovDegrees!,
        encoding: c.kind === 'depth-camera' ? 'depth32f' as const : 'rgb8' as const,
        imageAvailable: false as const,
      })),
  }
}

import { supermarketObstacles, type Obstacle } from './cleaning.ts'

export type Pose2D = { x: number; z: number; yaw: number }
export type LidarSpec = {
  id: string
  side: 'front' | 'left' | 'right'
  x: number
  z: number
  y: number
  yaw: number
  fovRadians: number
  beams: number
  maxRange: number
}
export type LidarRay = { angle: number; range: number; hit: boolean }
export type LidarScan = { sensor: LidarSpec; rays: LidarRay[] }
export type SlamEstimate = {
  pose: Pose2D
  scans: LidarScan[]
  occupiedCells: number
  freeCells: number
  scanMatchScore: number
}

/**
 * Requested demo configuration: one frontal scanner, two compact scanners
 * on each side (five total). Placement/FOV are illustrative, not Tennant CAD.
 */
export const lidars: readonly LidarSpec[] = [
  { id: 'front', side: 'front', x: 0.75, z: 0, y: 0.43,
    yaw: 0, fovRadians: Math.PI * 1.55, beams: 75, maxRange: 7 },
  { id: 'left-front', side: 'left', x: 0.32, z: -0.40, y: 0.35,
    yaw: Math.PI / 2, fovRadians: Math.PI * 0.85, beams: 27, maxRange: 3 },
  { id: 'left-rear', side: 'left', x: -0.43, z: -0.40, y: 0.35,
    yaw: Math.PI / 2, fovRadians: Math.PI * 0.85, beams: 27, maxRange: 3 },
  { id: 'right-front', side: 'right', x: 0.32, z: 0.40, y: 0.35,
    yaw: -Math.PI / 2, fovRadians: Math.PI * 0.85, beams: 27, maxRange: 3 },
  { id: 'right-rear', side: 'right', x: -0.43, z: 0.40, y: 0.35,
    yaw: -Math.PI / 2, fovRadians: Math.PI * 0.85, beams: 27, maxRange: 3 },
]

const finitePose = (pose: Pose2D): boolean =>
  [pose.x, pose.z, pose.yaw].every(Number.isFinite)
const wrapAngle = (yaw: number): number => Math.atan2(Math.sin(yaw), Math.cos(yaw))

export const sensorOrigin = (pose: Pose2D, sensor: LidarSpec): { x: number; z: number } => ({
  x: pose.x + sensor.x * Math.cos(pose.yaw) + sensor.z * Math.sin(pose.yaw),
  z: pose.z - sensor.x * Math.sin(pose.yaw) + sensor.z * Math.cos(pose.yaw),
})

/** Positive robot yaw is a clockwise rotation in world x,z coordinates. */
export const beamEnd = (
  pose: Pose2D, sensor: LidarSpec, ray: LidarRay,
): { x: number; z: number } => {
  const origin = sensorOrigin(pose, sensor)
  const heading = pose.yaw + sensor.yaw + ray.angle
  return { x: origin.x + ray.range * Math.cos(heading),
    z: origin.z - ray.range * Math.sin(heading) }
}

const hitBox = (x: number, z: number, dx: number, dz: number, box: Obstacle): number => {
  let near = 0
  let far = Infinity
  for (const [start, direction, low, high] of [
    [x, dx, box.x - box.halfX, box.x + box.halfX],
    [z, dz, box.z - box.halfZ, box.z + box.halfZ],
  ]) {
    if (Math.abs(direction) < 1e-12) {
      if (start < low || start > high) return Infinity
    } else {
      const a = (low - start) / direction
      const b = (high - start) / direction
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
      if (far < near) return Infinity
    }
  }
  return far >= 0 ? near : Infinity
}

/** Pure, deterministic 2D LiDAR ray/box intersection; never invokes a physics integrator. */
export const scanLidars = (
  pose: Pose2D,
  obstacles: readonly Obstacle[] = supermarketObstacles,
): LidarScan[] => {
  if (!finitePose(pose)) throw Error('Invalid LiDAR pose')
  return lidars.map(sensor => {
    const origin = sensorOrigin(pose, sensor)
    return {
      sensor,
      rays: Array.from({ length: sensor.beams }, (_, i): LidarRay => {
        const angle = sensor.fovRadians * (i / (sensor.beams - 1) - 0.5)
        const heading = pose.yaw + sensor.yaw + angle
        const dx = Math.cos(heading)
        const dz = -Math.sin(heading)
        const range = Math.min(sensor.maxRange,
          ...obstacles.map(box => hitBox(origin.x, origin.z, dx, dz, box)))
        return { angle, range, hit: range < sensor.maxRange - 1e-9 }
      }),
    }
  })
}

export class OccupancyGrid {
  readonly resolution = 0.20
  readonly minX = -2
  readonly minZ = -6
  readonly width = 60
  readonly height = 60
  readonly logOdds = new Int16Array(this.width * this.height)

  cell(x: number, z: number): number {
    const ix = Math.floor((x - this.minX) / this.resolution)
    const iz = Math.floor((z - this.minZ) / this.resolution)
    return ix >= 0 && ix < this.width && iz >= 0 && iz < this.height
      ? iz * this.width + ix : -1
  }

  get(x: number, z: number): number {
    const idx = this.cell(x, z)
    return idx >= 0 ? this.logOdds[idx] : 0
  }

  integrate(pose: Pose2D, scans: readonly LidarScan[]): void {
    for (const scan of scans) {
      const start = sensorOrigin(pose, scan.sensor)
      for (const ray of scan.rays) {
        const end = beamEnd(pose, scan.sensor, ray)
        const steps = Math.max(1, Math.ceil(ray.range / (this.resolution * 0.5)))
        const last = ray.hit ? steps - 1 : steps
        for (let step = 0; step < last; step++) {
          const t = step / steps
          const idx = this.cell(start.x + (end.x - start.x) * t,
            start.z + (end.z - start.z) * t)
          if (idx >= 0) this.logOdds[idx] = Math.max(-40, this.logOdds[idx] - 1)
        }
        if (ray.hit) {
          const idx = this.cell(end.x, end.z)
          if (idx >= 0) this.logOdds[idx] = Math.min(80, this.logOdds[idx] + 8)
        }
      }
    }
  }

  counts(): { occupiedCells: number; freeCells: number } {
    let occupiedCells = 0
    let freeCells = 0
    for (const confidence of this.logOdds) {
      if (confidence > 5) occupiedCells++
      else if (confidence < -3) freeCells++
    }
    return { occupiedCells, freeCells }
  }
}

export class SlamTracker {
  readonly grid = new OccupancyGrid()
  private previousTruth: Pose2D | undefined
  private estimate: Pose2D = { x: 0, z: 0, yaw: 0 }
  private steps = 0

  /** A small deterministic scan-to-grid local alignment, not production scan matching. */
  private align(predicted: Pose2D, scans: readonly LidarScan[]): { pose: Pose2D; score: number } {
    if (this.steps < 3) return { pose: predicted, score: 0 }
    let best = { pose: predicted, score: -Infinity }
    const offsets = [-0.1, 0, 0.1]
    const yawOffsets = [-0.02, 0, 0.02]
    for (const dx of offsets) for (const dz of offsets) for (const dyaw of yawOffsets) {
      const candidate = {
        x: predicted.x + dx, z: predicted.z + dz,
        yaw: wrapAngle(predicted.yaw + dyaw),
      }
      let score = -0.15 * (Math.abs(dx) + Math.abs(dz)) - 0.1 * Math.abs(dyaw)
      for (const scan of scans) {
        for (const ray of scan.rays) {
          if (!ray.hit) continue
          const end = beamEnd(candidate, scan.sensor, ray)
          score += this.grid.get(end.x, end.z)
        }
      }
      if (score > best.score) best = { pose: candidate, score }
    }
    return best
  }

  step(truth: Pose2D): SlamEstimate {
    const scans = scanLidars(truth)
    let predicted: Pose2D
    if (this.previousTruth) {
      // Surrogate wheel odometry: relative motion with deterministic drift.
      // Ground truth is used ONLY to synthesize the odometry and raw ray ranges.
      predicted = {
        x: this.estimate.x + (truth.x - this.previousTruth.x) * 1.008,
        z: this.estimate.z + (truth.z - this.previousTruth.z) * 1.008,
        yaw: wrapAngle(this.estimate.yaw +
          wrapAngle(truth.yaw - this.previousTruth.yaw) * 1.003),
      }
    } else {
      predicted = { x: 0, z: 0, yaw: 0 }
    }
    const matched = this.align(predicted, scans)
    this.estimate = matched.pose
    this.grid.integrate(this.estimate, scans)
    this.previousTruth = { ...truth }
    this.steps++
    return {
      pose: { ...this.estimate },
      scans,
      scanMatchScore: matched.score,
      ...this.grid.counts(),
    }
  }
}

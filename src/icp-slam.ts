import type * as PCL from 'pcl.js'
import {
  OccupancyGrid, scanLidars, type Pose2D, type LidarScan, type SlamEstimate,
} from './slam.ts'
import { sampleRobotSensors } from './sensors.ts'
import { registerPointScans, type Point2 } from './pcl-icp.ts'

const normalize = (yaw: number): number =>
  Math.atan2(Math.sin(yaw), Math.cos(yaw))

/** Point Cloud Library ICP supplies real scan-to-scan registration; grid is mapping only. */
export class PclIcpSlamTracker {
  readonly grid = new OccupancyGrid()
  private previousCloud: Point2[] | undefined
  private previousPose: Pose2D = { x: 0, z: 0, yaw: 0 }
  private previousSensorTruth: { pose: Pose2D; speed: number; stampSeconds: number } | undefined
  private estimate: Pose2D = { x: 0, z: 0, yaw: 0 }
  private acceptedMatches = 0

  private readonly pcl: typeof PCL
  constructor(pcl: typeof PCL) { this.pcl = pcl }

  private scanPoints(scans: readonly LidarScan[]): Point2[] {
    // Fixed extrinsics turn sensor-local ranges into robot-local XY points.
    return scans.flatMap(scan => scan.rays.filter(ray => ray.hit).map(ray => ({
      x: scan.sensor.x + Math.cos(scan.sensor.yaw + ray.angle) * ray.range,
      z: scan.sensor.z - Math.sin(scan.sensor.yaw + ray.angle) * ray.range,
    })))
  }

  step(truth: Pose2D, speed: number, stampSeconds: number): SlamEstimate & {
    icpAccepted: boolean
    acceptedMatches: number
    fitnessMetres: number
  } {
    const scans = scanLidars(truth)
    const cloud = this.scanPoints(scans)
    const sensorFrame = sampleRobotSensors(
      truth, speed, stampSeconds, this.previousSensorTruth,
    )
    let icpAccepted = false
    let fitnessMetres = Infinity

    if (this.previousCloud && this.previousSensorTruth) {
      const dt = stampSeconds - this.previousSensorTruth.stampSeconds
      if (!(dt > 0)) throw Error('SLAM time must advance')
      const gyro = sensorFrame.imu.angularVelocityRadiansPerSecond.y
      const displacement = sensorFrame.encoder.ticks /
        sensorFrame.encoder.ticksPerRevolution * 2 * Math.PI * 0.165
      const midYaw = this.estimate.yaw + gyro * dt / 2
      const odom = {
        x: this.estimate.x + displacement * Math.cos(midYaw),
        z: this.estimate.z - displacement * Math.sin(midYaw),
        yaw: normalize(this.estimate.yaw + gyro * dt),
      }
      const registration = registerPointScans(this.pcl, cloud, this.previousCloud)
      fitnessMetres = registration.rmsErrorMetres
      const change = Math.hypot(registration.dx, registration.dz)
      if (registration.converged && registration.rmsErrorMetres < 0.17 &&
          change < Math.max(0.3, 2 * Math.abs(displacement) + 0.15) &&
          Math.abs(registration.dyaw) < 0.35) {
        const p = this.previousPose
        this.estimate = {
          x: p.x + Math.cos(p.yaw) * registration.dx +
            Math.sin(p.yaw) * registration.dz,
          z: p.z - Math.sin(p.yaw) * registration.dx +
            Math.cos(p.yaw) * registration.dz,
          yaw: normalize(p.yaw + registration.dyaw),
        }
        this.acceptedMatches++
        icpAccepted = true
      } else {
        this.estimate = odom
      }
    }
    this.grid.integrate(this.estimate, scans)
    this.previousCloud = cloud
    this.previousPose = { ...this.estimate }
    this.previousSensorTruth = { pose: {...truth}, speed, stampSeconds }
    return {
      pose: {...this.estimate}, scans,
      scanMatchScore: Number.isFinite(fitnessMetres) ? -fitnessMetres : 0,
      ...this.grid.counts(),
      icpAccepted, acceptedMatches: this.acceptedMatches, fitnessMetres,
    }
  }
}

import * as THREE from 'three'
import { beamEnd, lidars, sensorOrigin, SlamTracker, type Pose2D, type SlamEstimate } from '../src/slam.ts'

/** Small visualization adapter: mapping remains a deterministic, headless library. */
export class SlamView {
  private tracker = new SlamTracker()
  private readonly beams: THREE.LineSegments[]
  private readonly pixelCanvas = document.createElement('canvas')
  private visible = true
  private latest: SlamEstimate | undefined

  constructor(private readonly mapCanvas: HTMLCanvasElement, scene: THREE.Scene) {
    this.pixelCanvas.width = this.tracker.grid.width
    this.pixelCanvas.height = this.tracker.grid.height
    this.beams = lidars.map(sensor => {
      const material = new THREE.LineBasicMaterial({
        color: sensor.side === 'front' ? 0x55eff0 : 0xefc073,
        transparent: true,
        opacity: sensor.side === 'front' ? 0.27 : 0.23,
        depthWrite: false,
      })
      const lines = new THREE.LineSegments(new THREE.BufferGeometry(), material)
      lines.frustumCulled = false
      scene.add(lines)
      return lines
    })
    this.drawMap()
  }

  reset(): void {
    this.tracker = new SlamTracker()
    this.latest = undefined
    for (const beam of this.beams) {
      beam.geometry.dispose()
      beam.geometry = new THREE.BufferGeometry()
    }
    this.drawMap()
  }

  toggleRays(): boolean {
    this.visible = !this.visible
    for (const beam of this.beams) beam.visible = this.visible
    return this.visible
  }

  step(truth: Pose2D, redraw = true): void {
    this.latest = this.tracker.step(truth)
    if (!redraw) return
    for (let i = 0; i < this.latest.scans.length; i++) {
      const { sensor, rays } = this.latest.scans[i]
      const origin = sensorOrigin(truth, sensor)
      const points: THREE.Vector3[] = []
      for (const ray of rays) {
        const end = beamEnd(truth, sensor, ray)
        points.push(new THREE.Vector3(origin.x, sensor.y, origin.z))
        points.push(new THREE.Vector3(end.x, sensor.y, end.z))
      }
      const beam = this.beams[i]
      beam.geometry.dispose()
      beam.geometry = new THREE.BufferGeometry().setFromPoints(points)
    }
    this.drawMap()
    const hitCount = this.latest.scans.reduce(
      (sum, scan) => sum + scan.rays.filter(ray => ray.hit).length, 0)
    document.getElementById('slam-cells')!.textContent =
      this.latest.occupiedCells + ' occupied / ' + this.latest.freeCells + ' free'
    document.getElementById('slam-hits')!.textContent = hitCount + ' hits'
  }

  private drawMap(): void {
    const grid = this.tracker.grid
    const raw = this.pixelCanvas.getContext('2d')!
    const img = raw.createImageData(grid.width, grid.height)
    for (let z = 0; z < grid.height; z++) {
      for (let x = 0; x < grid.width; x++) {
        const weight = grid.logOdds[z * grid.width + x]
        const offset = ((grid.height - 1 - z) * grid.width + x) * 4
        const rgb = weight > 5 ? [233, 183, 96] : weight < -3
          ? [51, 105, 109] : [17, 39, 48]
        img.data.set([...rgb, 255], offset)
      }
    }
    raw.putImageData(img, 0, 0)
    const ctx = this.mapCanvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, this.mapCanvas.width, this.mapCanvas.height)
    ctx.drawImage(this.pixelCanvas, 0, 0, this.mapCanvas.width, this.mapCanvas.height)
    if (!this.latest) return
    const pose = this.latest.pose
    const scaleX = this.mapCanvas.width / (grid.width * grid.resolution)
    const scaleZ = this.mapCanvas.height / (grid.height * grid.resolution)
    const px = (pose.x - grid.minX) * scaleX
    const pz = this.mapCanvas.height - (pose.z - grid.minZ) * scaleZ
    ctx.save()
    ctx.translate(px, pz)
    ctx.rotate(-pose.yaw)
    ctx.fillStyle = '#3ef4d6'
    ctx.strokeStyle = '#e6f7f2'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 0, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(11, 0)
    ctx.stroke()
    ctx.restore()
  }
}

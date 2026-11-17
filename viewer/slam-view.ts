import * as THREE from 'three'
import * as PCL from 'pcl.js'
import pclWasmUrl from 'pcl.js/pcl-core.wasm?url'
import { beamEnd, lidars, sensorOrigin, SlamTracker, type Pose2D, type SlamEstimate } from '../src/slam.ts'
import { PclIcpSlamTracker } from '../src/icp-slam.ts'
import { assertPclRuntime } from '../src/pcl-icp.ts'
import { sampleRobotSensors, scanLidar3D } from '../src/sensors.ts'

type Tracker = SlamTracker | PclIcpSlamTracker

/** Scene visualization + real external ICP scan front end. */
export class SlamView {
  private tracker: Tracker = new SlamTracker()
  private pclReady = false
  private readonly beams: THREE.LineSegments[]
  private readonly points: THREE.Points
  private readonly pixelCanvas = document.createElement('canvas')
  private readonly cameraRenderer: THREE.WebGLRenderer
  private readonly frontCamera: THREE.PerspectiveCamera
  private lastStamp = -Infinity
  private previousTruth: {pose: Pose2D; speed: number; stampSeconds: number} | undefined
  private visible = true
  private overlaysVisible = true
  private latest: SlamEstimate | undefined

  constructor(private readonly mapCanvas: HTMLCanvasElement, scene: THREE.Scene) {
    this.pixelCanvas.width = this.tracker.grid.width
    this.pixelCanvas.height = this.tracker.grid.height
    this.beams = lidars.map(sensor => {
      const material = new THREE.LineBasicMaterial({
        color: sensor.side === 'front' ? 0xd6deea : 0xf78f3b,
        transparent: true, opacity: sensor.side === 'front' ? 0.27 : 0.23,
        depthWrite: false,
      })
      const lines = new THREE.LineSegments(new THREE.BufferGeometry(), material)
      lines.frustumCulled = false
      scene.add(lines)
      return lines
    })
    this.points = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({color: 0xd6deea, size: 0.035, transparent: true,
        opacity: 0.85, sizeAttenuation: true, depthWrite: false}),
    )
    this.points.frustumCulled = false
    scene.add(this.points)
    const video = document.getElementById('front-camera') as HTMLCanvasElement
    this.cameraRenderer = new THREE.WebGLRenderer({canvas: video, antialias: false})
    this.cameraRenderer.setSize(240, 135, false)
    this.cameraRenderer.outputColorSpace = THREE.SRGBColorSpace
    this.cameraRenderer.toneMapping = THREE.ACESFilmicToneMapping
    this.cameraRenderer.toneMappingExposure = 1.48
    this.frontCamera = new THREE.PerspectiveCamera(78, 16/9, 0.06, 15)
    this.drawMap()
  }

  /** Load the actual PCL ICP compiled to WASM once, lazily and with fallback. */
  async enablePclIcp(): Promise<void> {
    try {
      const response = await fetch(pclWasmUrl)
      if (!response.ok) throw Error('PCL wasm HTTP ' + response.status)
      await PCL.init({arrayBuffer: await response.arrayBuffer()})
      assertPclRuntime(PCL)
      this.pclReady = true
      this.reset()
      document.getElementById('slam-method')!.textContent = 'PCL WASM · ICP + occupancy grid'
    } catch (error) {
      this.pclReady = false
      this.reset()
      // Explicitly indicate fallback; do not call the grid matcher real SLAM.
      document.getElementById('slam-method')!.textContent =
        'Scan-to-grid fallback · ICP unavailable'
      console.warn('PCL ICP initialization failed', error)
    }
  }

  reset(): void {
    this.tracker = this.pclReady ? new PclIcpSlamTracker(PCL) : new SlamTracker()
    this.lastStamp = -Infinity
    this.previousTruth = undefined
    this.latest = undefined
    this.points.geometry.dispose()
    this.points.geometry = new THREE.BufferGeometry()
    for (const beam of this.beams) {
      beam.geometry.dispose()
      beam.geometry = new THREE.BufferGeometry()
    }
    this.drawMap()
  }

  private syncOverlays(): void {
    const visible=this.visible&&this.overlaysVisible
    for(const beam of this.beams)beam.visible=visible
    this.points.visible=visible
  }

  toggleRays(): boolean {
    this.visible = !this.visible
    this.syncOverlays()
    return this.visible
  }

  /** Hides diagnostic geometry in aisle view without changing scan results
   * or overriding the operator's preferred LiDAR toggle. */
  setOverlaysVisible(visible:boolean):void {
    this.overlaysVisible=visible
    this.syncOverlays()
  }

  step(truth: Pose2D, redraw = true, speed = 0, stampSeconds = 0): void {
    if (!redraw || stampSeconds - this.lastStamp < 0.23) return
    this.lastStamp = stampSeconds
    const sensors = sampleRobotSensors(truth, speed, stampSeconds, this.previousTruth)
    this.previousTruth = {pose: {...truth}, speed, stampSeconds}
    try{
      this.latest = this.tracker instanceof PclIcpSlamTracker
        ? this.tracker.step(truth, speed, stampSeconds)
        : this.tracker.step(truth)
    }catch(error){
      // Native PCL can also fail after initialization. Optional ICP must not
      // terminate an otherwise valid physics/DAG replay.
      if(!(this.tracker instanceof PclIcpSlamTracker))throw error
      console.warn('PCL ICP runtime failure, switching to grid fallback',error)
      this.pclReady=false
      this.tracker=new SlamTracker()
      this.latest=this.tracker.step(truth)
      document.getElementById('slam-method')!.textContent=
        'Scan-to-grid fallback · PCL runtime failure'
      document.getElementById('icp-matches')!.textContent='ICP unavailable'
    }
    for (let i = 0; i < this.latest.scans.length; i++) {
      const { sensor, rays } = this.latest.scans[i]
      const origin = sensorOrigin(truth, sensor)
      const lines: THREE.Vector3[] = []
      for (const ray of rays) {
        const end = beamEnd(truth, sensor, ray)
        lines.push(new THREE.Vector3(origin.x, sensor.y, origin.z))
        lines.push(new THREE.Vector3(end.x, sensor.y, end.z))
      }
      const beam = this.beams[i]
      beam.geometry.dispose()
      beam.geometry = new THREE.BufferGeometry().setFromPoints(lines)
    }
    // True 3D returns: multiple elevation rings, multiple sensors and height.
    const clouds = scanLidar3D(truth, stampSeconds)
    const hits = clouds.flatMap(scan => scan.points)
    const positions = new Float32Array(hits.length * 3)
    for (let i = 0; i < hits.length; i++) {
      positions[3*i] = hits[i].x
      positions[3*i+1] = hits[i].y
      positions[3*i+2] = hits[i].z
    }
    this.points.geometry.dispose()
    this.points.geometry = new THREE.BufferGeometry()
    this.points.geometry.setAttribute('position', new THREE.BufferAttribute(positions,3))
    this.drawMap()
    document.getElementById('slam-cells')!.textContent =
      this.latest.occupiedCells + ' occupied / ' + this.latest.freeCells + ' free'
    document.getElementById('slam-hits')!.textContent = hits.length + ' 3D returns'
    document.getElementById('imu-rate')!.textContent =
      sensors.imu.angularVelocityRadiansPerSecond.y.toFixed(3) + ' rad/s'
    document.getElementById('wheel-ticks')!.textContent =
      sensors.encoder.ticks + ' ticks/sample'
    if ('acceptedMatches' in this.latest) {
      document.getElementById('icp-matches')!.textContent =
        this.latest.acceptedMatches + ' accepted ICP registrations'
    }
  }

  /** A camera render from a sensor mounted on the robot (not camera metadata). */
  renderCamera(robot: THREE.Object3D, scene: THREE.Scene): void {
    robot.updateWorldMatrix(true, false)
    const origin = robot.localToWorld(new THREE.Vector3(0.65,1.19,0))
    this.frontCamera.position.copy(origin)
    const rotation = new THREE.Quaternion()
    robot.getWorldQuaternion(rotation)
    this.frontCamera.quaternion.copy(rotation)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI/2, 0)))
    this.frontCamera.updateMatrixWorld()
    const visible = this.points.visible
    this.points.visible = false
    this.cameraRenderer.render(scene,this.frontCamera)
    this.points.visible = visible
  }

  private drawMap(): void {
    const grid = this.tracker.grid
    const raw = this.pixelCanvas.getContext('2d')!
    const img = raw.createImageData(grid.width, grid.height)
    for (let z = 0; z < grid.height; z++) for (let x = 0; x < grid.width; x++) {
      const weight = grid.logOdds[z * grid.width + x]
      const offset = ((grid.height - 1 - z) * grid.width + x) * 4
      const rgb = weight > 5 ? [247,143,59] : weight < -3
        ? [42,53,72] : [13,17,23]
      img.data.set([...rgb,255],offset)
    }
    raw.putImageData(img,0,0)
    const ctx = this.mapCanvas.getContext('2d')!
    ctx.imageSmoothingEnabled=false
    ctx.clearRect(0,0,this.mapCanvas.width,this.mapCanvas.height)
    ctx.drawImage(this.pixelCanvas,0,0,this.mapCanvas.width,this.mapCanvas.height)
    if (!this.latest) return
    const pose = this.latest.pose
    const scaleX = this.mapCanvas.width/(grid.width*grid.resolution)
    const scaleZ = this.mapCanvas.height/(grid.height*grid.resolution)
    const px = (pose.x-grid.minX)*scaleX
    const pz = this.mapCanvas.height-(pose.z-grid.minZ)*scaleZ
    ctx.save()
    ctx.translate(px,pz)
    ctx.rotate(-pose.yaw)
    ctx.fillStyle='#f78f3b'
    ctx.strokeStyle='#f3f5f8'
    ctx.lineWidth=1.5
    ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill()
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(11,0);ctx.stroke()
    ctx.restore()
  }
}

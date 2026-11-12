import RAPIER from '@dimforge/rapier3d-compat'
import { z } from 'zod'
import { supermarketObstacles } from './cleaning.ts'

/** Tennant T7AMR *concept* dimensions; tires, drivetrain geometry and control gains are estimates. */
export const t7amr = {
  lengthMetres: 1.651,
  widthMetres: 0.889,
  heightMetres: 1.499,
  massKilograms: 479,
  cleaningWidthMetres: 0.65,
  maxAutonomousSpeedMetresPerSecond: 1,
} as const

export const tennantScenarioSchema = z.object({
  name: z.string().min(1),
  vehicle: z.literal('tennant-t7amr'),
  route: z.enum(['blocked', 'detour']),
  timestepSeconds: z.number().finite().positive().max(0.02),
  steps: z.number().int().positive().max(30_000),
  frictionCoefficient: z.number().finite().min(0.05).max(2),
  seed: z.number().int().nonnegative(),
}).strict()
export type TennantScenario = z.infer<typeof tennantScenarioSchema>
export const parseTennantScenario = (value: unknown): TennantScenario => tennantScenarioSchema.parse(value)

export type TennantSample = {
  step: number
  timeSeconds: number
  x: number
  z: number
  yaw: number
  speed: number
  steerAngle: number
  driveWheelSlip: number
  lateralSlip: number
  cleanedAreaSqMetres: number
}
export type TennantResult = {
  scenario: TennantScenario
  engine: { name: 'rapier3d-compat'; version: '0.21.0'; model: 't7amr-front-steer-concept-v1' }
  result: {
    passed: boolean
    goalReached: boolean
    goalDistanceMetres: number
    cleanedAreaSqMetres: number
    maximumAbsSlipMetresPerSecond: number
    stalledSeconds: number
  }
  observations: TennantSample[]
}

const clamp = (x:number,a:number,b:number):number => Math.max(a,Math.min(b,x))
const angleDiff = (a:number):number => Math.atan2(Math.sin(a),Math.cos(a))

const planFor = (route:TennantScenario['route']): ReadonlyArray<{x:number;z:number}> =>
  route === 'blocked'
    ? [{x:7.5,z:0}]
    : [{x:0.8,z:1.9},{x:2.3,z:2.1},{x:5.9,z:2.1},{x:7.5,z:0}]

/**
 * Single steerable FRONT drive wheel with two undriven rear support wheels.
 * Rapier owns rigid body/contact state for this early prototype; Modelica/Rumoca
 * will eventually own the dynamics. Lateral tire resistance is a regularized
 * surrogate, not a manufacturer-derived tire model.
 */
export const runTennantScenario = async (scenario:TennantScenario):Promise<TennantResult> => {
  await RAPIER.init()
  const world = new RAPIER.World({x:0,y:0,z:0})
  try {
    const dt=scenario.timestepSeconds
    world.timestep=dt
    for(const obstacle of supermarketObstacles){
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(
        obstacle.x,obstacle.height/2,obstacle.z))
      world.createCollider(RAPIER.ColliderDesc.cuboid(
        obstacle.halfX,obstacle.height/2,obstacle.halfZ),body)
    }
    const mass=t7amr.massKilograms
    const robot=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0,0.4,0).setLinearDamping(0.3).setAngularDamping(0.4))
    robot.setEnabledTranslations(true,false,true,true)
    robot.setEnabledRotations(false,true,false,true)
    const collider=RAPIER.ColliderDesc.cuboid(t7amr.lengthMetres/2,0.38,t7amr.widthMetres/2)
      .setDensity(mass/(t7amr.lengthMetres*0.76*t7amr.widthMetres))
    world.createCollider(collider,robot)

    // These are explicit estimated *concept* parameters, not Tennant data.
    const driveWheelRadius=0.165
    const driveWheelInertia=1.7
    const frontWheelX=0.54
    const rearAxleX=-0.55
    const normalFront=mass*9.81*0.58
    let omegaDrive=0
    let steerAngle=0
    let goalReached=false
    let stalledSeconds=0
    let maximumAbsSlip=0
    let goalDistance=Infinity
    let waypointIndex=0
    const path=planFor(scenario.route)
    const cleanedCells=new Set<string>()
    const grid=0.16
    const observations:TennantSample[]=[]

    for(let step=0;step<scenario.steps;step++){
      const pos=robot.translation()
      const vel=robot.linvel()
      const yaw=2*Math.atan2(robot.rotation().y,robot.rotation().w)
      const yawRate=robot.angvel().y
      const fwdX=Math.cos(yaw), fwdZ=-Math.sin(yaw)
      const latX=Math.sin(yaw), latZ=Math.cos(yaw)
      const forwardSpeed=vel.x*fwdX+vel.z*fwdZ
      const sidewaysSpeed=vel.x*latX+vel.z*latZ
      const target=path[waypointIndex]
      if(Math.hypot(target.x-pos.x,target.z-pos.z)<0.65 && waypointIndex<path.length-1){
        waypointIndex++
      }
      const next=path[waypointIndex]
      const distance=Math.hypot(next.x-pos.x,next.z-pos.z)
      const desiredHeading=Math.atan2(-(next.z-pos.z),next.x-pos.x)
      const headingError=angleDiff(desiredHeading-yaw)
      const targetSteer=clamp(1.8*headingError-0.12*yawRate,-0.78,0.78)
      steerAngle+=dt*(targetSteer-steerAngle)/0.17
      const speedTarget=t7amr.maxAutonomousSpeedMetresPerSecond *
        clamp(distance/0.9,0.1,1) * clamp(1-Math.abs(headingError)/2.8,0.26,1)
      const wheelX=Math.cos(yaw+steerAngle)
      const wheelZ=-Math.sin(yaw+steerAngle)
      const velocityFrontX=vel.x
      const velocityFrontZ=vel.z-yawRate*frontWheelX
      const forwardWheelSpeed=velocityFrontX*wheelX+velocityFrontZ*wheelZ
      const slip=driveWheelRadius*omegaDrive-forwardWheelSpeed
      const force=scenario.frictionCoefficient*normalFront*Math.tanh(slip/0.22)
      const desiredOmega=speedTarget/driveWheelRadius
      const motorTorque=clamp(140*(desiredOmega-omegaDrive),-135,135)
      omegaDrive+=dt*(motorTorque-driveWheelRadius*force-1.9*omegaDrive)/driveWheelInertia
      robot.applyImpulseAtPoint(
        {x:force*dt*wheelX,y:0,z:force*dt*wheelZ},
        {x:pos.x+frontWheelX*fwdX,y:0.4,z:pos.z+frontWheelX*fwdZ},true)
      // Rear wheels predominantly roll longitudinally, resisting lateral translation.
      const rearLatSpeed=sidewaysSpeed-rearAxleX*yawRate
      const rearSideForce=-0.48*mass*9.81*scenario.frictionCoefficient*Math.tanh(rearLatSpeed/0.25)
      robot.applyImpulseAtPoint(
        {x:dt*rearSideForce*latX,y:0,z:dt*rearSideForce*latZ},
        {x:pos.x+rearAxleX*fwdX,y:0.4,z:pos.z+rearAxleX*fwdZ},true)
      world.step()
      const now=robot.translation()
      goalDistance=Math.hypot(7.5-now.x,now.z)
      if(goalDistance<0.55)goalReached=true
      if(speedTarget>0.4&&Math.hypot(robot.linvel().x,robot.linvel().z)<0.07)stalledSeconds+=dt
      maximumAbsSlip=Math.max(maximumAbsSlip,Math.abs(slip))
      // Squeegee/brush coverage is recorded as a 0.65m wide swept footprint proxy.
      const nowYaw=2*Math.atan2(robot.rotation().y,robot.rotation().w)
      for(let j=-2;j<=2;j++){
        const x=now.x+0.13*j*Math.sin(nowYaw)
        const z=now.z+0.13*j*Math.cos(nowYaw)
        if(x>=0&&x<=8&&Math.abs(z)<=2.7)cleanedCells.add(Math.floor(x/grid)+':'+Math.floor(z/grid))
      }
      if(step%10===0||step===scenario.steps-1||goalReached){
        observations.push({
          step:step+1,timeSeconds:(step+1)*dt,x:now.x,z:now.z,yaw:nowYaw,
          speed:Math.hypot(robot.linvel().x,robot.linvel().z),
          steerAngle,driveWheelSlip:slip,lateralSlip:rearLatSpeed,
          cleanedAreaSqMetres:cleanedCells.size*grid*grid,
        })
      }
      if(goalReached)break
    }
    return {
      scenario,engine:{name:'rapier3d-compat',version:'0.21.0',model:'t7amr-front-steer-concept-v1'},
      result:{passed:goalReached,goalReached,goalDistanceMetres:goalDistance,
        cleanedAreaSqMetres:cleanedCells.size*grid*grid,
        maximumAbsSlipMetresPerSecond:maximumAbsSlip,stalledSeconds},
      observations,
    }
  }finally{world.free()}
}

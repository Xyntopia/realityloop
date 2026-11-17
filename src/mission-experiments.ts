import {z} from 'zod'

/** Geometry and examples are independently authored, not imported artwork.
 * Every solver below is deterministic and scoped to rigid-body attitude or
 * reduced-order terrain mobility, not flight or field-qualified hardware. */
export const satelliteScenarioSchema=z.object({
  kind:z.literal('satellite-adcs'),
  name:z.string().min(1),
  layout:z.enum(['compact','distributed','asymmetric']),
  durationSeconds:z.number().positive().max(160),
  intervalSeconds:z.number().min(.01).max(.15),
  torqueLimitNm:z.number().positive().max(2),
}).strict()
export const terrainScenarioSchema=z.object({
  kind:z.literal('terrain-traverse'),
  name:z.string().min(1),
  terrain:z.enum(['mars','construction']),
  durationSeconds:z.number().positive().max(180),
  intervalSeconds:z.number().min(.01).max(.15),
  frictionCoefficient:z.number().min(.15).max(1.5),
  roverCandidate:z.enum(['ares-rtg','helios-solar','pathfinder-light']).optional(),
}).strict()
export const missionScenarioSchema=z.discriminatedUnion('kind',[
  satelliteScenarioSchema,terrainScenarioSchema,
])
export type MissionScenario=z.infer<typeof missionScenarioSchema>
export const parseMissionScenario=(raw:unknown):MissionScenario=>missionScenarioSchema.parse(raw)
export type Point3={x:number;y:number;z:number}
export type Quaternion={x:number;y:number;z:number;w:number}
export type CubeModule={
  id:string;position:Point3;massKg:number;function:'bus'|'wheel'|'payload'|'power'|'sensor'
}
const edge=.4
const moduleMasses=[24,28,21,22,17,25,19]
const purposes:CubeModule['function'][]=['bus','wheel','payload','power','sensor','wheel','bus']
const cube=(x:number,y:number,z:number):Point3=>({x:x*edge,y:y*edge,z:z*edge})
const grids={
  compact:[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[1,1,1]],
  distributed:[[0,0,0],[1,0,0],[2,0,0],[0,1,0],[2,1,0],[0,0,1],[2,0,1]],
  asymmetric:[[0,0,0],[1,0,0],[2,0,0],[2,1,0],[2,2,0],[2,2,1],[1,2,0]],
} as const
export const satelliteModules=(layout:SatelliteScenario['layout']):CubeModule[]=>
  grids[layout].map(([x,y,z],index)=>({
    id:'module-'+index,
    position:cube(x,y,z),
    massKg:moduleMasses[index]!,
    function:purposes[index]!,
  }))
type SatelliteScenario=z.infer<typeof satelliteScenarioSchema>
type TerrainScenario=z.infer<typeof terrainScenarioSchema>
type Vector=[number,number,number]
type Matrix=[Vector,Vector,Vector]
const add=(a:Vector,b:Vector):Vector=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]
const scale=(a:Vector,s:number):Vector=>[a[0]*s,a[1]*s,a[2]*s]
const cross=(a:Vector,b:Vector):Vector=>[
  a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0],
]
const multiply=(a:Matrix,v:Vector):Vector=>
  a.map(row=>row[0]*v[0]+row[1]*v[1]+row[2]*v[2]) as Vector
const inverse=(m:Matrix):Matrix=>{
  const [[a,b,c],[d,e,f],[g,h,i]]=m
  const cof:Matrix=[
    [e*i-f*h,c*h-b*i,b*f-c*e],
    [f*g-d*i,a*i-c*g,c*d-a*f],
    [d*h-e*g,b*g-a*h,a*e-b*d],
  ]
  const det=a*cof[0][0]+b*cof[1][0]+c*cof[2][0]
  if(!(det>1e-9))throw Error('Degenerate satellite inertia')
  return cof.map(row=>row.map(x=>x/det) as Vector) as Matrix
}
export const calculateSatelliteInertia=(modules:readonly CubeModule[])=>{
  const totalMassKg=modules.reduce((s,m)=>s+m.massKg,0)
  if(!(totalMassKg>0))throw Error('Empty spacecraft')
  const center:Vector=[0,1,2].map(axis=>
    modules.reduce((s,m)=>s+m.massKg*
      [m.position.x,m.position.y,m.position.z][axis],0)/totalMassKg) as Vector
  const inertia:Matrix=[[0,0,0],[0,0,0],[0,0,0]]
  for(const m of modules){
    const v:Vector=[
      m.position.x-center[0],m.position.y-center[1],m.position.z-center[2],
    ]
    const local=m.massKg*edge*edge/6
    for(let row=0;row<3;row++)for(let column=0;column<3;column++)
      inertia[row][column]+=(row===column?local+m.massKg*
        (v[(row+1)%3]**2+v[(row+2)%3]**2):-m.massKg*v[row]*v[column])
  }
  return {totalMassKg,centerOfMass:{x:center[0],y:center[1],z:center[2]},inertia}
}
const qmul=(a:Quaternion,b:Quaternion):Quaternion=>({
  x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
  y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
  z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
  w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
})
const qnormalize=(q:Quaternion):Quaternion=>{
  const n=Math.hypot(q.x,q.y,q.z,q.w)
  return {x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n}
}
const qaxis=(axis:Vector,degrees:number):Quaternion=>{
  const angle=degrees*Math.PI/360,s=Math.sin(angle)
  return {x:axis[0]*s,y:axis[1]*s,z:axis[2]*s,w:Math.cos(angle)}
}
const target=qnormalize(qmul(qmul(qaxis([0,1,0],34),qaxis([1,0,0],-12)),
  qaxis([0,0,1],8)))
const identity:Quaternion={x:0,y:0,z:0,w:1}
const errorQuaternion=(q:Quaternion)=>{
  const e=qmul({x:-q.x,y:-q.y,z:-q.z,w:q.w},target)
  return e.w<0?{x:-e.x,y:-e.y,z:-e.z,w:-e.w}:e
}
const attitudeErrorDegrees=(q:Quaternion)=>
  2*Math.acos(Math.min(1,Math.max(-1,Math.abs(errorQuaternion(q).w))))*180/Math.PI
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x))
export const runSatelliteScenario=(s:SatelliteScenario)=>{
  const modules=satelliteModules(s.layout)
  const properties=calculateSatelliteInertia(modules)
  const I=properties.inertia
  const inverted=inverse(I)
  let q:Quaternion={...identity}
  let omega:Vector=[0,0,0]
  let h:Vector=[0,0,0] // reaction wheel stored angular momentum per body axis
  const observations:Array<{
    step:number;timeSeconds:number;quaternion:Quaternion;angularVelocity:Vector;
    errorDegrees:number;controlTorqueNm:Vector;wheelMomentumNms:Vector;
  }>=[]
  let peakRateDeg=0
  for(let i=0;i<=Math.round(s.durationSeconds/s.intervalSeconds);i++){
    const timeSeconds=i*s.intervalSeconds
    const e=errorQuaternion(q)
    const requested:Vector=[
      .48*2*e.x-2.7*omega[0],
      .48*2*e.y-2.7*omega[1],
      .48*2*e.z-2.7*omega[2],
    ]
    const torque:Vector=requested.map((value,axis)=>{
      const clipped=clamp(value,-s.torqueLimitNm,s.torqueLimitNm)
      // A wheel can only continue accelerating within its momentum envelope.
      return (Math.abs(h[axis])>=8&&clipped*h[axis]<0)?0:clipped
    }) as Vector
    observations.push({
      step:i,timeSeconds,quaternion:{...q},angularVelocity:[...omega],
      errorDegrees:attitudeErrorDegrees(q),controlTorqueNm:[...torque],
      wheelMomentumNms:[...h],
    })
    peakRateDeg=Math.max(peakRateDeg,Math.hypot(...omega)*180/Math.PI)
    if(i===Math.round(s.durationSeconds/s.intervalSeconds))break
    const totalH=add(multiply(I,omega),h)
    const acceleration=multiply(inverted,
      add(torque,scale(cross(omega,totalH),-1)))
    const dt=s.intervalSeconds
    omega=add(omega,scale(acceleration,dt))
    h=add(h,scale(torque,-dt))
    const halfOmega:Quaternion={x:omega[0],y:omega[1],z:omega[2],w:0}
    const dq=qmul(q,halfOmega)
    q=qnormalize({
      x:q.x+.5*dt*dq.x,y:q.y+.5*dt*dq.y,
      z:q.z+.5*dt*dq.z,w:q.w+.5*dt*dq.w,
    })
  }
  const finalErrorDegrees=attitudeErrorDegrees(q)
  return {
    scenario:s,
    engine:{name:'reduced-order-rigid-body',model:'Euler rigid body + 3-axis reaction-wheel PD'},
    result:{passed:finalErrorDegrees<4,finalErrorDegrees,
      totalMassKg:properties.totalMassKg,
      centerOfMass:properties.centerOfMass,inertia:I,
      peakRateDegreesPerSecond:peakRateDeg,
      wheelMomentumNms:h,modules:modules.length},
    observations,
  }
}


/** Concept candidates mirrored from the bundled Taskyon Mars rover example;
 * not calibrated spacecraft performance or vendor specifications. */
export const marsRoverCandidates={
  'ares-rtg':{name:'Ares RTG Explorer',massKg:315,powerW:780,costUsd:16_800_000},
  'helios-solar':{name:'Helios Solar Rover',massKg:218,powerW:620,costUsd:9_600_000},
  'pathfinder-light':{name:'Pathfinder Light',massKg:128,powerW:410,costUsd:5_400_000},
} as const
export type TerrainKind=TerrainScenario['terrain']
export type Hazard={x:number;z:number;radius:number;kind:'rock'|'exclusion'|'equipment'}
export const terrainHazards=(terrain:TerrainKind):readonly Hazard[]=>
  terrain==='mars'
    ?[{x:-2,z:-.65,radius:1,kind:'rock'},{x:3,z:1.15,radius:1,kind:'rock'},
      {x:6,z:2.8,radius:.7,kind:'rock'}]
    :[{x:-1,z:-1.55,radius:.95,kind:'equipment'},
      {x:3,z:-1.45,radius:1.15,kind:'exclusion'},
      {x:-6,z:3.2,radius:.9,kind:'equipment'}]
export const terrainElevation=(terrain:TerrainKind,x:number,z:number):number=>
  terrain==='mars'
    ? .17*Math.sin(x*.45)*Math.cos(z*.42)+.08*Math.sin(1.3*z+.7*x)
      -.21*Math.exp(-((x+1)**2+(z-2.5)**2)/4)
      +.024*Math.sin(x*7.2+.55*Math.sin(z*2.8))
    : .07*Math.sin(x*.8)*Math.cos(z*.6)+.03*Math.cos(2*z)
const terrainWaypoints=(terrain:TerrainKind):readonly [number,number][]=>
  terrain==='mars'
    ?[[-6,0],[-4,2.1],[0,2.3],[2,-1.8],[4,-1.6],[8,-1.5]]
    :[[-6,-1],[-4,1.6],[0,1.7],[5,1.6],[8,.8]]
export const runTerrainScenario=(s:TerrainScenario)=>{
  const gravity=s.terrain==='mars'?3.71:9.81
  const candidate=s.terrain==='mars'
    ?marsRoverCandidates[s.roverCandidate??'ares-rtg']:null
  const maxVehicleSpeed=candidate
    ?Math.sqrt(candidate.powerW/candidate.massKg)*.55:1.35
  const hazards=terrainHazards(s.terrain)
  const waypoints=terrainWaypoints(s.terrain)
  const roverRadius=s.terrain==='mars' ? .55 : .7
  let x=-8,z=s.terrain==='mars'?0:-1,yaw=0,speed=0
  let waypointIndex=0,minimumClearance=Infinity,peakSlip=0
  let unsafe=false,delivered=false
  const observations:Array<{
    step:number;timeSeconds:number;x:number;y:number;z:number;yaw:number;
    speed:number;wheelSlip:number;gradeRadians:number;
    distanceToGoalMetres:number;minimumClearanceMetres:number;
  }>=[]
  const goal=waypoints.at(-1)!
  for(let i=0;i<=Math.round(s.durationSeconds/s.intervalSeconds);i++){
    const now=waypoints[waypointIndex]!
    const range=Math.hypot(x-now[0],z-now[1])
    if(range<.55&&waypointIndex<waypoints.length-1)waypointIndex++
    const target=waypoints[waypointIndex]!
    const heading=Math.atan2(target[1]-z,target[0]-x)
    const e=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))
    const dt=s.intervalSeconds
    const desiredSpeed=maxVehicleSpeed*
      clamp(1-Math.abs(e)*.4,.23,1)
    const grade=Math.atan(
      (terrainElevation(s.terrain,x+.2*Math.cos(yaw),z+.2*Math.sin(yaw))-
       terrainElevation(s.terrain,x-.2*Math.cos(yaw),z-.2*Math.sin(yaw)))/.4)
    const desiredAccel=clamp((desiredSpeed-speed)*1.4,-2.5,2.5)
    const tractionLimit=s.frictionCoefficient*gravity*.85
    const actualAccel=clamp(desiredAccel-gravity*Math.sin(grade),
      -tractionLimit,tractionLimit)
    const wheelSlip=Math.max(0,Math.abs(desiredAccel-gravity*Math.sin(grade))-
      tractionLimit)*.14
    peakSlip=Math.max(peakSlip,wheelSlip)
    speed=clamp(speed+actualAccel*dt,0,desiredSpeed+.1)
    yaw+=clamp(e*2.4,-.85,.85)*dt
    x+=Math.cos(yaw)*speed*dt
    z+=Math.sin(yaw)*speed*dt
    for(const hazard of hazards)minimumClearance=Math.min(minimumClearance,
      Math.hypot(x-hazard.x,z-hazard.z)-roverRadius-hazard.radius)
    if(minimumClearance<0)unsafe=true
    const distanceToGoalMetres=Math.hypot(x-goal[0],z-goal[1])
    if(distanceToGoalMetres<.6){delivered=true}
    if(i%3===0||delivered||i===Math.round(s.durationSeconds/s.intervalSeconds))
      observations.push({step:i,timeSeconds:i*dt,x,y:terrainElevation(s.terrain,x,z),
        z,yaw,speed,wheelSlip,gradeRadians:grade,distanceToGoalMetres,
        minimumClearanceMetres:minimumClearance})
    if(delivered)break
  }
  const last=observations.at(-1)!
  return {scenario:s,engine:{name:'reduced-order-terrain-rover',
    model:'tractive-force limit + terrain grade + bounded differential steering'},
    result:{passed:delivered&&!unsafe,goalReached:delivered,unsafe,
      goalDistanceMetres:last.distanceToGoalMetres,minimumClearanceMetres:minimumClearance,
      peakWheelSlipMetresPerSecond:peakSlip,
      deliveryCompleted:delivered&&s.terrain==='construction',
      gravityMetresPerSecondSquared:gravity,
      candidate:candidate?.name??null,
      roverMassKg:candidate?.massKg??null,
      availableDrivePowerW:candidate?.powerW??null},
    observations}
}
export const runMissionExperiment=(raw:unknown)=>{
  const scenario=parseMissionScenario(raw)
  switch(scenario.kind){
    case 'satellite-adcs':return runSatelliteScenario(scenario)
    case 'terrain-traverse':return runTerrainScenario(scenario)
  }
}
export type MissionResult=ReturnType<typeof runMissionExperiment>

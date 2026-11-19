import type {Pose2D} from '../slam.ts'

/** Backend-neutral geometric query. No rigid-body integration is allowed in
 * a query provider: Rumoca/Modelica retains the complete physical state. */
export type CollisionContact={
  obstacleId:string
  distanceMetres:number
  penetrationMetres:number
  /** Unit normal from obstacle toward the robot, in X/Z ground coordinates. */
  normalX:number
  normalZ:number
  pointX:number
  pointZ:number
}
export type CollisionQuery={
  query:(pose:Pose2D)=>CollisionContact[]
  close:()=>void
}
export type CollisionProvider='modelica'|'rapier'|'mujoco'
export type ExternalCollisionProvider=Exclude<CollisionProvider,'modelica'>
export const collisionProviders={
  modelica:{name:'Modelica/Rumoca',runtime:'compiled',integratesDynamics:false},
  rapier:{name:'Rapier WASM geometric queries',runtime:'host-callback',integratesDynamics:false},
  mujoco:{name:'MuJoCo WASM mj_collision',runtime:'host-callback',integratesDynamics:false},
} as const
/** Default is intentionally *not* an in-JS approximation. It is native
 * Modelica compiled via Rumoca, which runs from the Modelica scene package. */
export const createExternalCollisionQuery=async (
  provider:ExternalCollisionProvider,
):Promise<CollisionQuery>=>{
  switch(provider){
    case 'rapier':
      return (await import('./rapier.ts')).createRapierCollisionScene()
    case 'mujoco':
      return (await import('../mujoco-collision.ts')).createMujocoCollisionScene()
  }
}

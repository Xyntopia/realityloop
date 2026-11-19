import RAPIER from '@dimforge/rapier3d-compat'
import {supermarketObstacles,type Obstacle} from '../geometry.ts'
import type {Pose2D} from '../slam.ts'
import type {CollisionContact,CollisionQuery} from './contract.ts'

/** Query-only shape pairing. No RAPIER.World and no RAPIER.World.step().
 * The solver stays exclusively in Modelica; this is an optional narrow phase. */
export const createRapierCollisionScene=async (
  obstacles:readonly Obstacle[]=supermarketObstacles,
  robotRadiusMetres=.44,
):Promise<CollisionQuery>=>{
  if(!(Number.isFinite(robotRadiusMetres)&&robotRadiusMetres>0))
    throw Error('Invalid robot collision radius')
  await RAPIER.init()
  const ball=new RAPIER.Ball(robotRadiusMetres)
  const boxes=obstacles.map(o=>({
    obstacle:o,shape:new RAPIER.Cuboid(o.halfX,o.height/2,o.halfZ),
    center:{x:o.x,y:o.height/2,z:o.z},
  }))
  const identity={x:0,y:0,z:0,w:1}
  let closed=false
  return {
    query:(pose:Pose2D):CollisionContact[]=>{
      if(closed)throw Error('Rapier collision scene already closed')
      if(![pose.x,pose.z,pose.yaw].every(Number.isFinite))
        throw Error('Invalid pose')
      const robot={x:pose.x,y:robotRadiusMetres,z:pose.z}
      const contacts:CollisionContact[]=[]
      for(const {obstacle,shape,center} of boxes){
        const contact=shape.contactShape(center,identity,ball,robot,identity,0)
        if(!contact||contact.distance>0)continue
        contacts.push({
          obstacleId:obstacle.id,
          distanceMetres:contact.distance,
          penetrationMetres:Math.max(0,-contact.distance),
          normalX:contact.normal1.x,
          normalZ:contact.normal1.z,
          pointX:contact.point1.x,
          pointZ:contact.point1.z,
        })
      }
      return contacts.sort((a,b)=>
        a.obstacleId.localeCompare(b.obstacleId)||a.distanceMetres-b.distanceMetres)
    },
    close:()=>{closed=true},
  }
}

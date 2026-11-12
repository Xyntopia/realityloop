import loadMuJoCo from '@mujoco/mujoco'
import { supermarketObstacles, type Obstacle } from './geometry.ts'
import type { Pose2D } from './slam.ts'

export type CollisionContact = {
  obstacleId: string
  distanceMetres: number
  penetrationMetres: number
  /** From obstacle into robot, expressed in RealityLoop X/Z ground coordinates. */
  normalX: number
  normalZ: number
  pointX: number
  pointZ: number
}

/**
 * Collision-only MuJoCo WASM. Rumoca remains sole owner of dynamics.
 * The current published Rumoca runtime does NOT call this from Modelica;
 * this is a verified backend prototype for a future standard external C ABI.
 */
export const createMujocoCollisionScene = async (
  obstacles: readonly Obstacle[] = supermarketObstacles,
  robotRadiusMetres = 0.44,
) => {
  if (!(robotRadiusMetres > 0) || !Number.isFinite(robotRadiusMetres)) {
    throw Error('Invalid robot collision radius')
  }
  const mujoco = await loadMuJoCo()
  const geoms = obstacles.map((box, i) =>
    '<geom name="obstacle_' + i + '" type="box" pos="' +
    [box.x, -box.z, box.height / 2].join(' ') + '" size="' +
    [box.halfX, box.halfZ, box.height / 2].join(' ') + '"/>')
  const xml = [
    '<mujoco model="realityloop_collision"><option gravity="0 0 0"/><worldbody>',
    ...geoms,
    '<body name="robot" pos="0 0 ' + robotRadiusMetres + '">',
    '<freejoint name="robot_free"/>',
    '<geom name="robot_sphere" type="sphere" size="' +
      robotRadiusMetres + '" mass="479"/>',
    '</body></worldbody></mujoco>',
  ].join('\n')
  const filename = '/tmp/realityloop_collision_' + Math.random().toString(36).slice(2) + '.xml'
  mujoco.FS.writeFile(filename, xml)
  const model = mujoco.MjModel.mj_loadXML(filename)
  mujoco.FS.unlink(filename)
  const data = new mujoco.MjData(model)
  const robotGeomId = obstacles.length
  let closed = false

  return {
    query: (pose: Pose2D): CollisionContact[] => {
      if (closed) throw Error('MuJoCo collision scene already closed')
      if (![pose.x, pose.z, pose.yaw].every(Number.isFinite)) throw Error('Invalid pose')
      // Modelica X,Z ground -> MuJoCo X,Y ground; physical up -> MuJoCo Z.
      data.qpos[0] = pose.x
      data.qpos[1] = -pose.z
      data.qpos[2] = robotRadiusMetres
      data.qpos[3] = Math.cos(pose.yaw / 2)
      data.qpos[4] = 0
      data.qpos[5] = 0
      data.qpos[6] = -Math.sin(pose.yaw / 2)
      mujoco.mj_kinematics(model, data)
      mujoco.mj_collision(model, data) // No MuJoCo simulation timestep.
      const contacts: CollisionContact[] = []
      for (let i = 0; i < data.ncon; i++) {
        const contact = data.contact.get(i)
        if (!contact || contact.dist > 0) continue
        const other = contact.geom1 === robotGeomId ? contact.geom2 :
          contact.geom2 === robotGeomId ? contact.geom1 : -1
        if (other < 0 || other >= obstacles.length) continue
        const outward = contact.geom1 === robotGeomId ? -1 : 1
        contacts.push({
          obstacleId: obstacles[other].id,
          distanceMetres: contact.dist,
          penetrationMetres: Math.max(0, -contact.dist),
          normalX: contact.frame[0] * outward,
          normalZ: -contact.frame[1] * outward,
          pointX: contact.pos[0],
          pointZ: -contact.pos[1],
        })
      }
      return contacts.sort((a, b) =>
        a.obstacleId.localeCompare(b.obstacleId) || a.distanceMetres - b.distanceMetres)
    },
    close: () => {
      if (closed) return
      closed = true
      data.delete()
      model.delete()
    },
  }
}
export type MujocoCollisionScene = Awaited<ReturnType<typeof createMujocoCollisionScene>>

import { supermarketObstacles, type Obstacle } from '../geometry.ts'

const BEGIN = '    // @realityloop-scene-begin'
const END = '    // @realityloop-scene-end'
const number = (n: number): string => Object.is(n, -0) ? '0' : String(n)

/**
 * Generate Modelica parameter declarations from the *same* typed obstacle
 * geometry used by LiDAR, MuJoCo and the Three.js visualizer. The default
 * .mo source remains directly compilable, but execution always injects scene.
 * No host-side physics loop or collision adapter.
 */
export const withModelicaScene = (
  source: string,
  obstacles: readonly Obstacle[] = supermarketObstacles,
): string => {
  if (obstacles.length < 1 || obstacles.length > 32) {
    throw Error('Modelica scene requires 1–32 collision obstacles')
  }
  const ids = new Set<string>()
  for (const o of obstacles) {
    if (!o.id || ids.has(o.id)) throw Error('Duplicate or invalid obstacle ID')
    ids.add(o.id)
    if (![o.x, o.z, o.halfX, o.halfZ, o.height].every(Number.isFinite) ||
        o.halfX <= 0 || o.halfZ <= 0 || o.height <= 0) {
      throw Error('Modelica obstacles must have finite positive dimensions')
    }
  }
  const start = source.indexOf(BEGIN)
  const end = source.indexOf(END, start + BEGIN.length)
  if (start < 0 || end < 0 || source.indexOf(BEGIN, start + BEGIN.length) !== -1 ||
      source.indexOf(END, end + END.length) !== -1) {
    throw Error('Modelica source must declare one RealityLoop scene section')
  }
  const array = (name: string, values: number[]): string =>
    '    parameter Real ' + name + '[nObstacles]={' + values.map(number).join(',') + '};'
  const replacement = [
    BEGIN,
    '    parameter Integer nObstacles=' + obstacles.length + ';',
    array('obstacleX', obstacles.map(o => o.x)),
    array('obstacleZ', obstacles.map(o => o.z)),
    array('obstacleHalfX', obstacles.map(o => o.halfX)),
    array('obstacleHalfZ', obstacles.map(o => o.halfZ)),
    END,
  ].join('\n')
  return source.slice(0, start) + replacement +
    source.slice(end + END.length)
}

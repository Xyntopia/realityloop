import {generatedSupermarketObstacles,supermarketGeometrySha256} from
  './generated/supermarket-obstacles.ts'

/** Generated from a compiled GLB asset rather than reauthoring geometry in
 * TypeScript. The same boxes drive Modelica, LiDAR, Rapier, MuJoCo and visuals.
 * Units: metres, X forward, +Z towards the south shelves. */
export {supermarketGeometrySha256}
export type Obstacle = {
  id: string
  x: number
  z: number
  halfX: number
  halfZ: number
  height: number
  kind: 'shelf' | 'obstruction'
}

export const supermarketObstacles: readonly Obstacle[] = generatedSupermarketObstacles

/** Tennant reference body dimensions; swept clearance is conservative, not exact CAD. */
export const referenceFootprint = {
  halfLengthMetres: 1.651 / 2,
  halfWidthMetres: 0.889 / 2,
} as const

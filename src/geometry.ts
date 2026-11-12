/** Shared static layout for renderers, raycasters, clearance and FFI backends.
 * Units: metres, X forward, +Z towards the south shelves. */
export type Obstacle = {
  id: string
  x: number
  z: number
  halfX: number
  halfZ: number
  height: number
  kind: 'shelf' | 'obstruction'
}

export const supermarketObstacles: readonly Obstacle[] = [
  {id:'blocked-aisle',x:4.35,z:0,halfX:0.45,halfZ:1.27,height:1.6,kind:'obstruction'},
  {id:'shelf-n1',x:2.1,z:-3.2,halfX:1.25,halfZ:0.46,height:2.1,kind:'shelf'},
  {id:'shelf-n2',x:5.2,z:-3.2,halfX:1.25,halfZ:0.46,height:2.1,kind:'shelf'},
  {id:'shelf-s1',x:2.1,z:3.2,halfX:1.25,halfZ:0.46,height:2.1,kind:'shelf'},
  {id:'shelf-s2',x:5.2,z:3.2,halfX:1.25,halfZ:0.46,height:2.1,kind:'shelf'},
]

/** Tennant reference body dimensions; swept clearance is conservative, not exact CAD. */
export const referenceFootprint = {
  halfLengthMetres: 1.651 / 2,
  halfWidthMetres: 0.889 / 2,
} as const

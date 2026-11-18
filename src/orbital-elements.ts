import {z} from 'zod'

/** Classical (chief) Keplerian osculating elements at t=0.
 * Distances are metres and every angle is radians in the ECI frame.
 * Range bounds deliberately exclude intersecting Earth and hyperbolic paths.
 * The servicer uses small fixed differential e and mean anomaly in Modelica. */
export const orbitalElementsSchema=z.object({
  semiMajorAxis:z.number().finite().min(6_700_000).max(7_800_000),
  eccentricity:z.number().finite().min(0).max(.012),
  inclination:z.number().finite().min(0).max(Math.PI),
  raan:z.number().finite().min(0).max(2*Math.PI),
  argumentOfPeriapsis:z.number().finite().min(0).max(2*Math.PI),
  meanAnomalyAtEpoch:z.number().finite().min(0).max(2*Math.PI),
}).strict()
export type OrbitalElements=z.infer<typeof orbitalElementsSchema>

export const defaultOrbitalElements:Readonly<OrbitalElements>=Object.freeze({
  semiMajorAxis:6_878_137,
  eccentricity:.0011,
  inclination:.901288,
  raan:.35,
  argumentOfPeriapsis:.42,
  meanAnomalyAtEpoch:.1,
})

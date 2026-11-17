import type * as PCL from 'pcl.js'

/** pcl.js v1.16 resolves native WASM types through JavaScript class .name.
 * Browser bundles must preserve PointXYZ and related constructor names.
 * A successful WASM download/init alone does not prove the ICP ABI works. */
export const assertPclRuntime=(pcl:typeof PCL):void=>{
  if(pcl.PointXYZ.name!=='PointXYZ'){
    throw Error('pcl.js PointXYZ constructor renamed by bundling: '+pcl.PointXYZ.name)
  }
  const cloud=new pcl.PointCloud(pcl.PointXYZ)
  try{
    const icp=new pcl.IterativeClosestPoint()
    icp.manager.delete()
  }finally{
    cloud.manager.delete()
  }
}

export type Point2 = { x: number; z: number }
export type PclRegistration = {
  converged: boolean
  rmsErrorMetres: number
  /** Transform a current local scan into the previous local scan frame. */
  dx: number
  dz: number
  dyaw: number
  matches: number
}

/**
 * Real C++ Point Cloud Library ICP (pcl.js WASM), not a hand-written scan matcher.
 * PCL.js does not expose getFinalTransformation; recover its rigid XY transform
 * from the source/aligned corresponding points using the 2D Procrustes solution.
 * PCL owns correspondence matching, registration and iteration.
 */
export const registerPointScans = (
  pcl: typeof PCL,
  source: readonly Point2[],
  target: readonly Point2[],
  maxCorrespondenceDistance = 0.5,
): PclRegistration => {
  const failure: PclRegistration = {
    converged: false, rmsErrorMetres: Infinity, dx: 0, dz: 0, dyaw: 0, matches: 0,
  }
  if (source.length < 12 || target.length < 12) return failure
  const a = new pcl.PointCloud(pcl.PointXYZ)
  const b = new pcl.PointCloud(pcl.PointXYZ)
  const aligned = new pcl.PointCloud(pcl.PointXYZ)
  const icp = new pcl.IterativeClosestPoint()
  try {
    for (const p of source) a.addPoint(new pcl.PointXYZ(p.x, -p.z, 0))
    for (const p of target) b.addPoint(new pcl.PointXYZ(p.x, -p.z, 0))
    icp.setInputSource(a)
    icp.setInputTarget(b)
    icp.setMaximumIterations(25)
    icp.setMaxCorrespondenceDistance(maxCorrespondenceDistance)
    icp.setTransformationEpsilon(1e-6)
    icp.align(aligned)
    const fitness = icp.getFitnessScore()
    if (!icp.hasConverged() || !Number.isFinite(fitness) ||
        aligned.size !== source.length) return failure
    let cx = 0, cy = 0, bx = 0, by = 0
    const out = aligned.points
    for (let i = 0; i < source.length; i++) {
      cx += source[i].x; cy += -source[i].z
      const p = out.get(i)
      bx += p.x; by += p.y
    }
    const n = source.length
    cx /= n; cy /= n; bx /= n; by /= n
    let cross = 0, dot = 0
    for (let i = 0; i < n; i++) {
      const sx = source[i].x - cx, sy = -source[i].z - cy
      const t = out.get(i)
      const tx = t.x - bx, ty = t.y - by
      dot += sx * tx + sy * ty
      cross += sx * ty - sy * tx
    }
    const dyaw = Math.atan2(cross, dot)
    const c = Math.cos(dyaw), s = Math.sin(dyaw)
    const dx = bx - (c * cx - s * cy)
    const dz = -(by - (s * cx + c * cy))
    return {
      converged: Number.isFinite(dx + dz + dyaw),
      rmsErrorMetres: Math.sqrt(fitness),
      dx, dz, dyaw, matches: n,
    }
  } finally {
    for (const obj of [icp, aligned, b, a]) obj.manager.delete()
  }
}

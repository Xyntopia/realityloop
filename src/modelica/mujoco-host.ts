import {runExternalCollisionModelica,
  type ExternalCollisionReport,type ExternalCollisionSample}
  from './external-host.ts'

/** Compatibility wrapper for the original MuJoCo-only external host proof. */
export type ExternalMuJoCoSample=ExternalCollisionSample
export type ExternalMuJoCoReport=Omit<ExternalCollisionReport,'backend'>&{
  backend:'@mujoco/mujoco'
}
export const runMuJoCoExternalModelica=async(
  externalWasmDirectory:string,
):Promise<ExternalMuJoCoReport>=>{
  const r=await runExternalCollisionModelica(externalWasmDirectory,'mujoco')
  return {...r,backend:'@mujoco/mujoco'}
}

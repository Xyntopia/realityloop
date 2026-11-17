import type * as THREE from 'three'

/** Browser vendor strings are best-effort; the result gates costly optional
 * visual effects, never changes physics or WebGL basic functionality. */
export const isSoftwareRenderer=(renderer:THREE.WebGLRenderer):boolean=>{
  const gl=renderer.getContext()
  const info=gl.getExtension('WEBGL_debug_renderer_info')
  const name=String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER))
  return /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(name)
}

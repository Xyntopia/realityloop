within ;
package RealityLoopMuJoCo
  // STANDARD MODELICA EXTERNAL C INTERFACE — NOT EXECUTABLE BY CURRENT RUMOCA WASM.
  // Requires Rumoca ExternalObject + foreign-function linking to a target-specific
  // native/WASM build of realityloop_mujoco and Google DeepMind MuJoCo.
  class Scene
    extends ExternalObject;
    function constructor
      input String mjcfFile;
      output Scene scene;
      external "C" scene = rl_mujoco_scene_create(mjcfFile)
        annotation(Include="#include \"realityloop_mujoco.h\"",
                   Library="realityloop_mujoco");
    end constructor;
    function destructor
      input Scene scene;
      external "C" rl_mujoco_scene_destroy(scene)
        annotation(Include="#include \"realityloop_mujoco.h\"",
                   Library="realityloop_mujoco");
    end destructor;
  end Scene;

  function detect
    input Scene scene;
    input Real x "World forward position, metres";
    input Real z "World lateral position, metres";
    input Real yaw "Positive yaw rotates +X toward -Z";
    output Integer count;
    output Real penetration[32] "Metres, unused slots zero";
    output Real normalX[32] "Outward from obstacle, world X";
    output Real normalZ[32] "Outward from obstacle, world Z";
    external "C"
      count = rl_mujoco_detect(scene, x, z, yaw, 32,
                               penetration, normalX, normalZ)
      annotation(Include="#include \"realityloop_mujoco.h\"",
                 Library="realityloop_mujoco");
  end detect;
end RealityLoopMuJoCo;

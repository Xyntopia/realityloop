#ifndef REALITYLOOP_MUJOCO_H
#define REALITYLOOP_MUJOCO_H

#ifdef __cplusplus
extern "C" {
#endif

/* Stable C ABI for native or WASM builds linked by Modelica external "C".
   The scene owns mjModel and mjData. Return count >=0, or -1 on error.
   Query never integrates time or steps MuJoCo dynamics. */
typedef struct rl_mujoco_scene rl_mujoco_scene;
rl_mujoco_scene *rl_mujoco_scene_create(const char *mjcf_path);
void rl_mujoco_scene_destroy(rl_mujoco_scene *scene);
int rl_mujoco_detect(rl_mujoco_scene *scene,
                     double x, double z, double yaw, int capacity,
                     double *penetration,
                     double *normal_x, double *normal_z);

#ifdef __cplusplus
}
#endif
#endif

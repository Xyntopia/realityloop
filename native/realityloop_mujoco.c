#include "realityloop_mujoco.h"
#include <mujoco/mujoco.h>
#include <math.h>
#include <stdlib.h>

struct rl_mujoco_scene {
  mjModel *model;
  mjData *data;
  int robot_geom;
};

rl_mujoco_scene *rl_mujoco_scene_create(const char *mjcf_path) {
  if (!mjcf_path) return NULL;
  char error[1024] = {0};
  mjModel *model = mj_loadXML(mjcf_path, NULL, error, sizeof(error));
  if (!model) return NULL;
  mjData *data = mj_makeData(model);
  if (!data) { mj_deleteModel(model); return NULL; }
  const int robot_geom = mj_name2id(model, mjOBJ_GEOM, "robot_sphere");
  if (robot_geom < 0 || model->nq < 7) {
    mj_deleteData(data);
    mj_deleteModel(model);
    return NULL;
  }
  rl_mujoco_scene *scene = (rl_mujoco_scene *)malloc(sizeof(*scene));
  if (!scene) {
    mj_deleteData(data);
    mj_deleteModel(model);
    return NULL;
  }
  scene->model = model;
  scene->data = data;
  scene->robot_geom = robot_geom;
  return scene;
}

void rl_mujoco_scene_destroy(rl_mujoco_scene *scene) {
  if (!scene) return;
  mj_deleteData(scene->data);
  mj_deleteModel(scene->model);
  free(scene);
}

/* MuJoCo X,Y,Z => RealityLoop X,-Z,Y. Modelica's y is not used
   by this planar scene. Results are deterministic for given poses. */
int rl_mujoco_detect(rl_mujoco_scene *scene,
                     double x, double z, double yaw, int capacity,
                     double *penetration, double *normal_x, double *normal_z) {
  if (!scene || capacity < 0 || !penetration || !normal_x || !normal_z ||
      !isfinite(x) || !isfinite(z) || !isfinite(yaw)) return -1;
  for (int i = 0; i < capacity; ++i) {
    penetration[i] = normal_x[i] = normal_z[i] = 0;
  }
  mjData *data = scene->data;
  const mjModel *model = scene->model;
  data->qpos[0] = x;
  data->qpos[1] = -z;
  /* Retain the configured robot centre elevation from the MJCF model. */
  data->qpos[2] = model->qpos0[2];
  data->qpos[3] = cos(yaw * 0.5);
  data->qpos[4] = 0;
  data->qpos[5] = 0;
  data->qpos[6] = -sin(yaw * 0.5);
  mj_kinematics(model, data);
  mj_collision(model, data); /* NO mj_step, mj_forward or state integration */
  int count = 0;
  for (int i = 0; i < data->ncon; ++i) {
    const mjContact *contact = &data->contact[i];
    if (contact->dist > 0 ||
        (contact->geom[0] != scene->robot_geom &&
         contact->geom[1] != scene->robot_geom)) continue;
    if (count >= capacity) return -1; /* Never silently truncate */
    const double outward = contact->geom[0] == scene->robot_geom ? -1.0 : 1.0;
    penetration[count] = fmax(0.0, -contact->dist);
    normal_x[count] = outward * contact->frame[0];
    normal_z[count] = -outward * contact->frame[1];
    ++count;
  }
  return count;
}

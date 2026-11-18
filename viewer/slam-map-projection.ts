import type {OccupancyGrid,Pose2D} from '../src/slam.ts'

type GridBounds=Pick<OccupancyGrid,'minX'|'minZ'|'width'|'height'|'resolution'>

/** Top-down view from +Y: world +X is right and world +Z is down.
 * Both the occupancy pixels and the pose marker must use this convention. */
export const slamMapCellOffset=(x:number,z:number,gridWidth:number):number=>
  (z*gridWidth+x)*4

/** Three.js yaw turns the robot's local +X nose toward world -Z.
 * On a top-down canvas (whose Y increases with +Z), this is -yaw. */
export const slamMapPose=(
  pose:Pose2D,grid:GridBounds,canvasWidth:number,canvasHeight:number,
):Readonly<{x:number;y:number;rotation:number}>=>({
  x:(pose.x-grid.minX)*canvasWidth/(grid.width*grid.resolution),
  y:(pose.z-grid.minZ)*canvasHeight/(grid.height*grid.resolution),
  rotation:-pose.yaw,
})

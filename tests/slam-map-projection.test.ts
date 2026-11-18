import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {beamEnd,lidars,OccupancyGrid,sensorOrigin} from '../src/slam.ts'
import {slamMapCellOffset,slamMapPose} from '../viewer/slam-map-projection.ts'

const near=(actual:number,expected:number)=>assert.ok(
  Math.abs(actual-expected)<1e-9,`Expected ${actual} ≈ ${expected}`)

test('SLAM grid and marker use the same top-down Z orientation',()=>{
  const grid=new OccupancyGrid()
  const north=slamMapPose({x:2,z:-3.2,yaw:0},grid,240,240)
  const south=slamMapPose({x:2,z:3.2,yaw:0},grid,240,240)
  assert.equal(north.x,south.x)
  assert(south.y>north.y,'World +Z must appear lower when viewed from above')
  assert.equal(slamMapCellOffset(2,0,grid.width),8)
  assert.equal(slamMapCellOffset(2,1,grid.width),8+4*grid.width,
    'Increasing grid Z advances one image row, not one mirrored row')
  near(slamMapPose({x:0,z:0,yaw:0},grid,240,240).x,40)
  near(slamMapPose({x:0,z:0,yaw:0},grid,240,240).y,120)
})

test('heading marker aligns with physical robot +X and front LiDAR at all turns',()=>{
  const grid=new OccupancyGrid()
  const front=lidars[0]
  for(const yaw of [0,Math.PI/2,-Math.PI/2,Math.PI,-Math.PI/3]){
    const pose={x:0.5,z:0.25,yaw}
    const marker=slamMapPose(pose,grid,240,240)
    const origin=sensorOrigin(pose,front)
    const end=beamEnd(pose,front,{angle:0,range:1,hit:false})
    const screenOrigin=slamMapPose({...origin,yaw},grid,240,240)
    const screenEnd=slamMapPose({...end,yaw},grid,240,240)
    const dx=screenEnd.x-screenOrigin.x
    const dy=screenEnd.y-screenOrigin.y
    const distance=Math.hypot(dx,dy)
    near(dx/distance,Math.cos(marker.rotation))
    near(dy/distance,Math.sin(marker.rotation))
  }
  near(slamMapPose({x:0,z:0,yaw:Math.PI/2},grid,240,240).rotation,-Math.PI/2)
  near(slamMapPose({x:0,z:0,yaw:-Math.PI/2},grid,240,240).rotation,Math.PI/2)
})

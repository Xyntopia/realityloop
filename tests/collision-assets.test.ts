import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {importCollisionGLB,toBoxColliders} from '../src/collision/mesh-import.ts'
import {supermarketObstacles,supermarketGeometrySha256} from '../src/geometry.ts'

const asset=fileURLToPath(new URL('../assets/meshes/supermarket-layout.glb',import.meta.url))
const bytes=await readFile(asset)
test('compiled GLB is the source of the runtime collision boxes and hash',()=>{
  const parsed=importCollisionGLB(bytes)
  const colliders=toBoxColliders(parsed)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),supermarketGeometrySha256)
  const round=(value:number)=>Math.round(value*1e9)/1e9
  assert.deepEqual(colliders.map(o=>({
    id:o.id,kind:o.kind,x:round(o.center[0]),z:round(o.center[2]),
    halfX:round(o.halfExtents[0]),halfZ:round(o.halfExtents[2]),
    height:round(o.halfExtents[1]*2),
  })),supermarketObstacles)
  assert.equal(colliders.length,5)
  assert.equal(parsed.colliders.reduce((n,c)=>n+c.triangles.length,0),60)
})
test('the same GLB is a loadable Three.js scene with named collision objects',async()=>{
  const loader=new GLTFLoader()
  const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)
  const gltf=await loader.parseAsync(ab,'')
  const names:string[]=[]
  gltf.scene.traverse(child=>{if(child.type==='Mesh')names.push(child.name)})
  assert.equal(names.length,5)
  for(const obstacle of supermarketObstacles)
    assert(names.includes('Collider_'+obstacle.id))
})
test('malformed GLB, bad indexes, oversized buffers and invalid box transforms fail closed',()=>{
  assert.throws(()=>importCollisionGLB(new Uint8Array(12)),/GLB/)
  const truncated=bytes.subarray(0,bytes.length-4)
  assert.throws(()=>importCollisionGLB(truncated),/length/)
  const malformed=Buffer.from(bytes)
  malformed.writeUInt32LE(0x7fffffff,12)
  assert.throws(()=>importCollisionGLB(malformed),/chunk/)
  const parsed=importCollisionGLB(bytes)
  assert.throws(()=>toBoxColliders({version:1,colliders:[{
    ...parsed.colliders[0],type:'mesh',
  }]}),/narrow-phase/)
})

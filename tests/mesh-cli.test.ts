import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {importCollisionGLB} from '../src/collision/mesh-import.ts'

const execFileAsync=promisify(execFile)
const root=fileURLToPath(new URL('..',import.meta.url))
const tool=fileURLToPath(new URL('../scripts/compile-collision-mesh.mjs',import.meta.url))
const run=(src:string,dst:string,...opts:string[])=>
  execFileAsync(process.execPath,['--experimental-strip-types',tool,src,dst,...opts],
    {cwd:root,timeout:30000,maxBuffer:1024*1024})

const tetra=`# A watertight tetrahedron, outward-wound.
v 0 0 0
v 1 0 0
v 0 1 0
v 0 0 1
f 1 3 2
f 1 2 4
f 1 4 3
f 2 3 4
`

test('CLI compiles arbitrary OBJ into Modelica with provenance and verifies determinism',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'realityloop-mesh-'))
  try{
    const input=join(directory,'tetra.obj'),output=join(directory,'Tetra.mo')
    await writeFile(input,tetra)
    const first=JSON.parse((await run(input,output,'--solid','--units=cm',
      '--package=TetraCollider','--id=tetra')).stdout)
    const modelica=await readFile(output,'utf8')
    const manifest=JSON.parse(await readFile(output+'.json','utf8'))
    assert.equal(first.result,'generated')
    assert.equal(first.bodies,1)
    assert.equal(first.triangles,4)
    assert.equal(manifest.unitScaleToMetres,.01)
    assert.equal(manifest.solid,true)
    assert.equal(manifest.bodies[0].id,'tetra')
    assert.match(modelica,/package TetraCollider/)
    assert.match(modelica,/constant Integer nTriangles=4;/)
    assert.match(modelica,/constant Integer nBvhNodes=1;/)
    assert.match(modelica,/0\.01/)
    assert.equal(JSON.parse((await run(input,output,'--solid','--units=cm',
      '--package=TetraCollider','--id=tetra','--check')).stdout).result,'verified')
    await writeFile(input,tetra.replace('v 0 0 1','v 0 0 2'))
    await assert.rejects(run(input,output,'--solid','--units=cm',
      '--package=TetraCollider','--id=tetra','--check'),/stale/)
  }finally{await rm(directory,{recursive:true,force:true})}
})
test('generic untagged GLB geometry requires explicit opt-in; no decoration becomes a collider silently',async()=>{
  const original=await readFile(new URL('../assets/meshes/supermarket-layout.glb',import.meta.url))
  const jsonLength=original.readUInt32LE(12)
  const json=JSON.parse(original.subarray(20,20+jsonLength).toString('utf8'))
  for(const node of json.nodes)delete node.extras
  const text=Buffer.from(JSON.stringify(json))
  const jsonPadded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)])
  const binStart=20+jsonLength
  const binChunk=original.subarray(binStart)
  const untagged=Buffer.alloc(20+jsonPadded.length+binChunk.length)
  untagged.writeUInt32LE(0x46546c67,0)
  untagged.writeUInt32LE(2,4)
  untagged.writeUInt32LE(untagged.length,8)
  untagged.writeUInt32LE(jsonPadded.length,12)
  untagged.writeUInt32LE(0x4e4f534a,16)
  jsonPadded.copy(untagged,20)
  binChunk.copy(untagged,20+jsonPadded.length)
  assert.throws(()=>importCollisionGLB(untagged),/no supported colliders/)
  const candidate=importCollisionGLB(untagged,{includeUntagged:true})
  assert.equal(candidate.colliders.length,5)
  assert(candidate.colliders.every(c=>c.type==='mesh'&&c.kind==='generic'))
  const directory=await mkdtemp(join(tmpdir(),'realityloop-untagged-'))
  try{
    const input=join(directory,'untagged.glb'),output=join(directory,'Imported.mo')
    await writeFile(input,untagged)
    await assert.rejects(run(input,output,'--solid'),/no supported colliders/)
    const response=JSON.parse((await run(input,output,'--solid','--all-meshes')).stdout)
    assert.equal(response.triangles,60)
    const text=await readFile(output,'utf8')
    assert.match(text,/constant Integer nBodies=5;/)
  }finally{await rm(directory,{recursive:true,force:true})}
})

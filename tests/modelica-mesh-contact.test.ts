import {strict as assert} from 'node:assert'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'
import {readFile} from 'node:fs/promises'
import {runModelicaScenario} from '../src/modelica/node.ts'
import {parseModelicaScenario} from '../src/modelica/runtime.ts'
import {importCollisionGLB} from '../src/collision/mesh-import.ts'
import {compileCollisionModelica,validateClosedCollisionMesh}
  from '../src/collision/modelica-compile.ts'

const directory=fileURLToPath(new URL('..',import.meta.url))
const scenarioFor=(name:'MeshContactProbe'|'ImportedSolidProbe'|
  'ImportedContactDynamics'|'ImportedBvhParityProbe')=>parseModelicaScenario({
  name:'sphere-mesh-'+name,kind:'modelica',
  model:'RealityLoopMeshContacts.'+name,
  durationSeconds:1.6,intervalSeconds:.05,
  frictionCoefficient:.72,motorTorqueNewtonMetres:0,
})
test('Rumoca compiles 3D sphere-triangle narrow-phase in Modelica',async()=>{
  const result=await runModelicaScenario(scenarioFor('MeshContactProbe'),directory)
  assert.equal(result.engine.name,'rumoca-wasm')
  assert(result.observations.length>=30)
  const first=result.observations[0].channels
  assert(first.depth<1e-9)
  const mid=result.observations.find(p=>Math.abs(p.timeSeconds-1)<.025)?.channels
  assert(mid,'time=1 sample must exist')
  assert(Math.abs(mid.depth-.1)<1e-5,'sphere above triangle should penetrate by .1m')
  assert(Math.abs(mid.normalY-1)<1e-5,'surface should push up')
  assert(Math.abs(mid.surfaceY)<1e-8)
  assert(mid.triangleID===1||mid.triangleID===2)
  const last=result.observations.at(-1)!.channels
  assert(last.depth<1e-6,'sphere below triangle after fully crossing must separate')
  assert.equal(last.normalY<0,true,'two-sided triangle normal follows query side')
})
test('GLB generates exactly one Modelica package of watertight 3D triangles',async()=>{
  const input=await readFile(new URL('../assets/meshes/supermarket-layout.glb',import.meta.url))
  const asset=importCollisionGLB(input)
  for(const mesh of asset.colliders){
    const topology=validateClosedCollisionMesh(mesh)
    assert.equal(topology.faces,12)
    assert(topology.signedVolume>0)
  }
  const generated=compileCollisionModelica(asset,{solid:true})
  assert.equal(generated,
    await readFile(new URL('../modelica/RealityLoopImportedCollision.mo',import.meta.url),'utf8'))
  assert.match(generated,/constant Integer nVertices=40;/)
  assert.match(generated,/constant Integer nTriangles=60;/)
  assert.throws(()=>compileCollisionModelica(asset,{maxTriangles:20}),/budget/)
  const broken={...asset,colliders:[{...asset.colliders[0],
    triangles:asset.colliders[0].triangles.slice(1)}]}
  assert.throws(()=>compileCollisionModelica(broken,{solid:true}),/open|nonmanifold/)
})
test('pure Modelica detects outside and inside an imported closed GLB',async()=>{
  const result=await runModelicaScenario(scenarioFor('ImportedSolidProbe'),directory)
  const samples=result.observations
  const first=samples[0].channels
  assert.equal(first.inside,0)
  assert(first.depth<1e-9)
  const near=samples.find(s=>Math.abs(s.timeSeconds-.75)<.025)?.channels
  assert(near)
  assert(near.depth>.08&&near.depth<.16)
  assert(near.normalX<-.95)
  const mid=samples.find(s=>Math.abs(s.timeSeconds-1.35)<.025)?.channels
  assert(mid)
  assert.equal(mid.inside,1,'center must be inside a watertight shelf collider')
  assert(mid.depth>.4,'solid penetration includes escape depth inside mesh')
  assert(mid.normalX<-.9,'inside normal must point toward shortest escape')
  assert(mid.triangleID>=1&&mid.triangleID<=60)
})
test('Modelica contact forces prevent a dynamic sphere crossing the GLB shelf',async()=>{
  const result=await runModelicaScenario(scenarioFor('ImportedContactDynamics'),directory)
  const samples=result.observations
  assert(samples.length>=30)
  const last=samples.at(-1)!.channels
  const maximum=Math.max(...samples.map(s=>s.channels.depth))
  assert(maximum>.002,'there must be a real contact-force episode')
  assert(last.x<3.9,'sphere must not cross the shelf surface')
  assert(samples.some(s=>s.channels.contactForce>0),
    'force must be calculated inside compiled Modelica')
  assert(samples.every(s=>Object.values(s.channels).every(Number.isFinite)))
})

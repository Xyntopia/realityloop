import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {importCollisionGLB,toBoxColliders} from '../src/collision/mesh-import.ts'
import {compileCollisionModelica} from '../src/collision/modelica-compile.ts'

const root=fileURLToPath(new URL('../',import.meta.url))
const source=resolve(root,'assets/meshes/supermarket-layout.json')
const binaryPath=resolve(root,'assets/meshes/supermarket-layout.glb')
const typescriptPath=resolve(root,'src/generated/supermarket-obstacles.ts')
const modelicaPath=resolve(root,'modelica/RealityLoopImportedCollision.mo')
const src=JSON.parse(await readFile(source,'utf8'))
if(src.format!=='realityloop-collision-layout/v1'||!Array.isArray(src.objects)||
   src.objects.length<1||src.objects.length>32)throw Error('Invalid collision source manifest')
const unitVertices=[
  [-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],
  [-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],
]
const indices=[
  0,2,1,0,3,2,4,5,6,4,6,7,
  0,1,5,0,5,4,3,7,6,3,6,2,
  0,4,7,0,7,3,1,2,6,1,6,5,
]
const vertices=new Float32Array(unitVertices.flat()),faces=new Uint16Array(indices)
const bin=Buffer.alloc(vertices.byteLength+faces.byteLength)
for(let i=0;i<vertices.length;i++)bin.writeFloatLE(vertices[i],i*4)
for(let i=0;i<faces.length;i++)bin.writeUInt16LE(faces[i],vertices.byteLength+i*2)
const objects=src.objects.map(item=>{
  if(!item||!['shelf','obstruction'].includes(item.kind)||!
     /^[a-zA-Z][\w-]{0,99}$/.test(item.id)||
     !Array.isArray(item.center)||!Array.isArray(item.size)||
     item.center.length!==3||item.size.length!==3||
     ![...item.center,...item.size].every(Number.isFinite)||
     !item.size.every(n=>n>0))throw Error('Invalid collider source: '+JSON.stringify(item))
  return item
})
if(new Set(objects.map(o=>o.id)).size!==objects.length)throw Error('Repeated collider id')
const gltf={
  asset:{version:'2.0',generator:'RealityLoop deterministic collision asset compiler'},
  scene:0,scenes:[{nodes:objects.map((_,i)=>i)}],
  nodes:objects.map(o=>({
    name:'Collider '+o.id,mesh:o.kind==='shelf'?0:1,
    translation:o.center,scale:o.size,
    extras:{realityloopCollider:{id:o.id,kind:o.kind,type:'box'}},
  })),
  meshes:[
    {name:'Shelf contact box',primitives:[{attributes:{POSITION:0},indices:1,material:0}]},
    {name:'Obstruction contact box',primitives:[{attributes:{POSITION:0},indices:1,material:1}]},
  ],
  materials:[
    {name:'Shelf collision preview',pbrMetallicRoughness:{baseColorFactor:[.36,.63,.77,.18],metallicFactor:0,roughnessFactor:.9},alphaMode:'BLEND',doubleSided:true},
    {name:'Aisle blocker collision preview',pbrMetallicRoughness:{baseColorFactor:[.97,.51,.25,.18],metallicFactor:0,roughnessFactor:.9},alphaMode:'BLEND',doubleSided:true},
  ],
  buffers:[{byteLength:bin.length}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:vertices.byteLength},
    {buffer:0,byteOffset:vertices.byteLength,byteLength:faces.byteLength}],
  accessors:[
    {bufferView:0,componentType:5126,count:8,type:'VEC3',
      min:[-.5,-.5,-.5],max:[.5,.5,.5]},
    {bufferView:1,componentType:5123,count:36,type:'SCALAR'},
  ],
}
const padding=(count)=>((count+3)&~3)-count
const json=Buffer.from(JSON.stringify(gltf))
const paddedJson=Buffer.concat([json,Buffer.alloc(padding(json.length),0x20)])
const paddedBin=Buffer.concat([bin,Buffer.alloc(padding(bin.length))])
const totalLength=12+8+paddedJson.length+8+paddedBin.length
const glb=Buffer.alloc(totalLength)
glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(totalLength,8)
glb.writeUInt32LE(paddedJson.length,12);glb.writeUInt32LE(0x4e4f534a,16)
paddedJson.copy(glb,20)
const at=20+paddedJson.length
glb.writeUInt32LE(paddedBin.length,at);glb.writeUInt32LE(0x004e4942,at+4)
paddedBin.copy(glb,at+8)
// Crucially, generated TypeScript is derived from the *compiled* GLB, not
// independently from the JSON manifest.
const collisionAsset=importCollisionGLB(glb)
const colliders=toBoxColliders(collisionAsset)
// Float32 geometry and matrix multiplication introduce a few ULPs of noise.
 // Canonicalize to 1 nm before emitting physical parameters.
const round=(value)=>Math.round(value*1e9)/1e9
const obstacles=colliders.map(o=>{
  if(o.kind==='generic')throw Error('Supermarket asset contains an unexpected collider type')
  if(Math.abs(o.bounds.min[1])>1e-5)throw Error('Supermarket box must touch Y=0')
  return {id:o.id,x:round(o.center[0]),z:round(o.center[2]),
    halfX:round(o.halfExtents[0]),halfZ:round(o.halfExtents[2]),
    height:round(o.halfExtents[1]*2),kind:o.kind}
})
const hash=createHash('sha256').update(glb).digest('hex')
const moduleText=[
  '// GENERATED from assets/meshes/supermarket-layout.glb — do not edit.',
  '// Regenerate with npm run build:collision-assets',
  `export const supermarketGeometrySha256='${hash}'`,
  'export const generatedSupermarketObstacles='+JSON.stringify(obstacles,null,2)+' as const',
  '',
].join('\n')
const modelicaText=compileCollisionModelica(collisionAsset,{
  packageName:'RealityLoopImportedCollision',solid:true,
})
const generated=[
  {path:binaryPath,data:glb},
  {path:typescriptPath,data:Buffer.from(moduleText)},
  {path:modelicaPath,data:Buffer.from(modelicaText)},
]
const check=process.argv.includes('--check')
for(const {path,data} of generated){
  const previous=await readFile(path).catch(()=>null)
  if(previous?.equals(data))continue
  if(check)throw Error('Stale collision artifact: '+path)
  await mkdir(dirname(path),{recursive:true})
  await writeFile(path,data)
}
console.log('Collision GLB:',objects.length,'boxes,',glb.length,'bytes, SHA-256',hash,
  check?'(verified)':'(generated)')

#!/usr/bin/env node
/** Compile a user-supplied GLB/OBJ/STL into a deterministic Modelica mesh
 * package and provenance manifest. The compiler never imports runtime
 * physics engines or fetches external assets. */
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {dirname,extname,resolve} from 'node:path'
import {importCollisionGeometry} from '../src/collision/mesh-formats.ts'
import {makeCollisionMesh} from '../src/collision/mesh-import.ts'
import {compileCollisionModelica} from '../src/collision/modelica-compile.ts'
import {buildCollisionBVH} from '../src/collision/bvh.ts'

const usage='Usage: npm run compile:collision-mesh -- <input.glb|obj|stl> <output.mo> '+
  '[--package=Name] [--id=mesh_id] [--units=m|cm|mm] [--solid] [--all-meshes] [--check]'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const parseArgs=args=>{
  if(args.length<2)throw Error(usage)
  const [src,dst,...flags]=args
  const parsed={src,dst,packageName:'RealityLoopImportedMesh',id:'imported-mesh',
    units:'m',solid:false,allMeshes:false,check:false}
  for(const flag of flags){
    if(flag==='--solid')parsed.solid=true
    else if(flag==='--all-meshes')parsed.allMeshes=true
    else if(flag==='--check')parsed.check=true
    else if(flag.startsWith('--package='))parsed.packageName=flag.slice(10)
    else if(flag.startsWith('--id='))parsed.id=flag.slice(5)
    else if(flag.startsWith('--units='))parsed.units=flag.slice(8)
    else throw Error('Unknown option '+flag+'\n'+usage)
  }
  if(!['m','cm','mm'].includes(parsed.units))throw Error('Unknown length unit '+parsed.units)
  return parsed
}
const options=parseArgs(process.argv.slice(2))
const format=extname(options.src).slice(1).toLowerCase()
if(!['glb','obj','stl'].includes(format))
  throw Error('Input file must have a .glb, .obj or .stl extension')
if(format==='glb'&&options.units!=='m')
  throw Error('glTF coordinates are defined in metres; --units overrides are for OBJ/STL only')
if(options.allMeshes&&format!=='glb')
  throw Error('--all-meshes is only meaningful for GLB')
if(extname(options.dst).toLowerCase()!=='.mo')throw Error('Output must have .mo extension')
const input=await readFile(resolve(options.src))
const imported=importCollisionGeometry(input,format,options.id,'generic',
  {includeUntagged:options.allMeshes})
const unitFactor={m:1,cm:.01,mm:.001}[options.units]
const asset=unitFactor===1?imported:{
  version:1,colliders:imported.colliders.map(c=>makeCollisionMesh(
    c.id,c.kind,c.type,
    c.vertices.map(v=>v.map(n=>n*unitFactor)),
    c.triangles.map(face=>[...face]),
  )),
}
const source=compileCollisionModelica(asset,{
  packageName:options.packageName,solid:options.solid,
})
const encoded=Buffer.from(source,'utf8')
const meta={
  schema:'realityloop-mesh-compiler/v1',
  inputSha256:digest(input),modelicaSha256:digest(encoded),
  format,unitScaleToMetres:unitFactor,solid:options.solid,
  includeUntagged:options.allMeshes,
  packageName:options.packageName,
  bodies:asset.colliders.map(mesh=>({
    id:mesh.id,type:mesh.type,
    nVertices:mesh.vertices.length,nTriangles:mesh.triangles.length,
    bvhNodes:buildCollisionBVH(mesh,4).nodes.length,
    bounds:mesh.bounds,
  })),
}
const manifest=Buffer.from(JSON.stringify(meta,null,2)+'\n')
for(const entry of [
  {path:resolve(options.dst),data:encoded},
  {path:resolve(options.dst+'.json'),data:manifest},
]){
  if(options.check){
    const existing=await readFile(entry.path)
    if(!existing.equals(entry.data))
      throw Error('Generated collision artifact is stale: '+entry.path)
  }else{
    await mkdir(dirname(entry.path),{recursive:true})
    await writeFile(entry.path,entry.data)
  }
}
console.log(JSON.stringify({
  result:options.check?'verified':'generated',
  modelicaPath:resolve(options.dst),
  packageName:options.packageName,
  bodies:meta.bodies.length,triangles:meta.bodies.reduce((n,c)=>n+c.nTriangles,0),
  inputSha256:meta.inputSha256,modelicaSha256:meta.modelicaSha256,
},null,2))

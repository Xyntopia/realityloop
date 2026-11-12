import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  canonicalHash, MissingDagArtifact, type DagHash,
  type DagStorageBackend, type DagObjectStore,
} from './vendor/taskyon-comp-dag.mjs'

const safeSegment = (segment: string) => /^[a-zA-Z0-9._-]+$/.test(segment) &&
  segment !== '.' && segment !== '..'
const safePath = (root: string, relative: string) => {
  const parts = relative.split('/')
  if (!parts.length || parts.some(part => !safeSegment(part))) {
    throw Error('Invalid DAG repository path ' + relative)
  }
  const target = resolve(root, ...parts)
  if (!target.startsWith(resolve(root) + sep)) throw Error('DAG path escaped repository')
  return target
}
const missing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
const readMaybe = async (path: string): Promise<string|null> => {
  try { return await readFile(path, 'utf8') }
  catch (error) { if (missing(error)) return null; throw error }
}
const atomicText = async (path: string, content: string) => {
  await mkdir(dirname(path), {recursive:true})
  const temp = path + '.tmp-' + randomUUID()
  await writeFile(temp, content, {flag:'wx'})
  await rename(temp,path)
}
const filename = (hash: DagHash) => hash.replace(':','_') + '.json'

export const createLocalDagStorage = (baseDirectory: string): {
  backend: DagStorageBackend
  repositoryStore: DagObjectStore
} => {
  const base = resolve(baseDirectory)
  const artifactPath = (id:DagHash) => safePath(base,'artifacts/' + filename(id))
  const cachePath = (key:string) => safePath(base,'cache/' + key.replace(':','_') + '.json')
  const backend:DagStorageBackend = {
    readArtifact: async <T>(hash:DagHash): Promise<T> => {
      const raw = await readMaybe(artifactPath(hash))
      if (raw === null) throw new MissingDagArtifact(hash)
      const artifact:unknown = JSON.parse(raw)
      if (canonicalHash(artifact) !== hash) {
        throw Error('DAG cached artifact checksum mismatch: ' + hash)
      }
      return artifact as T
    },
    writeArtifact: async (value:unknown) => {
      const id=canonicalHash(value)
      const path=artifactPath(id)
      const old=await readMaybe(path)
      if (old===null) await atomicText(path,JSON.stringify(value)+'\n')
      else if (canonicalHash(JSON.parse(old))!==id) throw Error('DAG artifact corrupted')
      return id
    },
    getCacheEntry:async key => {
      const raw=await readMaybe(cachePath(key))
      if (raw===null) return null
      const entry:unknown=JSON.parse(raw)
      if (!entry || typeof entry!=='object' || !('artifact' in entry) ||
          typeof entry.artifact!=='string' || !entry.artifact.startsWith('sha256:')) {
        throw Error('Invalid DAG cache entry')
      }
      return {artifact:entry.artifact as DagHash}
    },
    setCacheEntry:async (key,entry) => {
      await atomicText(cachePath(key),JSON.stringify(entry)+'\n')
    },
  }
  const root=join(base,'design-graph')
  const repositoryStore:DagObjectStore = {
    readText:async path=>{
      const raw=await readMaybe(safePath(root,path))
      if (raw===null) throw Error('Design graph object not found: '+path)
      return raw
    },
    writeText:async (path,content)=>atomicText(safePath(root,path),content),
    writeTextIfUnchanged:async (path,expected,content)=>{
      const p=safePath(root,path)
      const old=await readMaybe(p)
      const previous=old===null?null:canonicalHash(old)
      if (expected!==previous) return {written:false,currentContentHash:previous}
      await atomicText(p,content)
      return {written:true,currentContentHash:canonicalHash(content)}
    },
    list:async directory=>{
      const rootPath=safePath(root,directory)
      const files=async(dir:string,prefix=''):Promise<string[]>=>{
        let entries
        try {entries=await readdir(dir,{withFileTypes:true})}
        catch(error){if(missing(error))return [];throw error}
        const children=await Promise.all(entries.map(async entry=>
          entry.isDirectory()?files(join(dir,entry.name),prefix+entry.name+'/'):
            [prefix+entry.name]))
        return children.flat().sort()
      }
      return files(rootPath)
    },
  }
  return {backend,repositoryStore}
}

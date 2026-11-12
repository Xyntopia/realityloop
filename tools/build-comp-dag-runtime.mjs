import { build, version as esbuildVersion } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(root, '..')
const entry = join(root, 'tools/comp-dag-entry.ts')
const bundlePath = join(root, 'src/vendor/taskyon-comp-dag.mjs')
const lockPath = join(root, 'src/vendor/taskyon-comp-dag.lock.json')

const hash = (value) =>
  'sha256:' + createHash('sha256').update(value).digest('hex')

const buildResult = await build({
  entryPoints: [entry],
  outfile: bundlePath,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  bundle: true,
  metafile: true,
  logLevel: 'warning',
  legalComments: 'eof',
  write: true,
})
if (!buildResult.metafile) throw Error('Missing esbuild input manifest')
const sources = await Promise.all(Object.keys(buildResult.metafile.inputs)
  .sort()
  .map(async name => {
    const bytes = await readFile(resolve(root, name))
    return [name, hash(bytes)]
  }))
const file = await readFile(bundlePath)
const frontendRevision = execFileSync('git', [
  '-C', join(repoRoot, 'frontend'), 'rev-parse', 'HEAD',
], {encoding:'utf8'}).trim()
const lock = {
  schema:'realityloop.comp-dag-bundle/v1',
  source:'frontend/packages/comp-dag (canonical Taskyon implementation)',
  frontendRevision,
  inputCount:sources.length,
  inputSetSha256:hash(JSON.stringify(sources)),
  entrySha256:hash(await readFile(entry)),
  esbuildVersion,
  bundleSha256:hash(file),
  bundleBytes:file.byteLength,
}
await writeFile(lockPath, JSON.stringify(lock,null,2) + '\n')
console.log(JSON.stringify(lock,null,2))

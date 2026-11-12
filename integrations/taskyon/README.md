# RealityLoop × Taskyon Design Graph

## Mandatory local runtime — implemented

RealityLoop uses **Taskyon's actual `@taskyon/comp-dag`** for all normal CLI and browser simulation paths. Source: `frontend/packages/comp-dag`; pinned offline executable: `src/vendor/taskyon-comp-dag.mjs` and its recorded lock. This is not a parallel DAG runtime.

Canonical graph:

```
RealityLoop.Scenario → RealityLoop.Simulation
                                  ├── RealityLoop.Metrics
                                  └── RealityLoop.Observations
```

Node uses `createNode`, `call(params).run({…},{execution:{mode:'local'},storageBackend})`. The headless runner stores graph revisions, invocation definitions, invocation runs, project revisions and SHA-256-addressed results using actual `createDesignGraphRepository`, `createGraphRevision`, `createInvocationDefinition`, `createInvocationRun` and `createProjectRevision`. `src/dag-storage.ts` provides only the injected Taskyon storage interfaces, not another graph identity system. Stored under `runs/.dag/`, no server, account, Taskyon UI, Space, network or P2P needed. Browser currently caches DAG outputs in memory.

The headless v2 execution lock fingerprints the entire `src/` implementation tree, dependency lockfile, Modelica source, Rumoca WASM and canonical DAG bundle, plus Node runtime identity. Repeated invocations reuse stored artifacts; corrupt artifacts fail checksum checks; changed inputs or source produce new invocation IDs. `realityloop verify <invocation-id> [store-dir]` re-executes the recorded invocation through the **same Taskyon DAG in a fresh, uncached store** and verifies trajectory, metrics and observations hashes. This distinguishes true replay verification from simply loading a cache hit. Single-writer local storage only; a concurrency-safe backend remains future work.

## Optional Taskyon UI and P2P — **not yet implemented**

P2P is a **transport/synchronization choice**, not a simulation or graph dependency. Later an explicitly authorized user can expose these Taskyon-format artifacts, run and project records over P2P or another permitted transport and render them in Taskyon. There is no active Taskyon UI integration or automatic Space import today.

Outstanding: stable independently versioned `@taskyon/comp-dag` distribution, authored stored NodeRecord/module-lock closure (currently graph nodes refer to pinned trusted runtime implementations), browser offline run persistence/export, import/reconciliation tests into Taskyon's repository and UI, narrow StorageClient grants for optional publication, and schema/version compatibility. Do not create a second DAG engine, duplicate artifact IDs or new P2P scheduler.

The future streaming/async graph optimization idea remains deferred research with no target release or agreed architecture.

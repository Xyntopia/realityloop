# Optional Taskyon integration (not implemented)

Do not invent a parallel DAG execution or artifact identity system. Plan to reuse
`@taskyon/comp-dag`'s `InvocationDefinition`, evaluation dependencies, run/attempt
and artifact repository, and `@taskyon/protocol` for suitable service/event boundaries.

Current blocker: `frontend/packages/comp-dag` is marked private, exposes source
subpaths and depends on monorepo `workspace:*` packages. Extract/build a stable
standalone package/API with graph-identity parity tests before wiring this starter
as an external consumer. Do not point external customers at relative `../frontend`
source paths.

When available:
- Graph nodes describe scene construction, simulation, observation, acceptance and image fitting.
- CI invokes them directly using a pinned, independent runner; Taskyon UI is optional.
- Each worker writes only to its granted StorageClient namespace/folder or a customer-owned
  equivalent using a scoped service principal. Wider Spaces may read/reference artifacts
  under separately authorized grants; no ambient Space root authority.
- The resulting run manifest records exact source/engine/assets/model, timestep schedule,
  PRNG seeds, snapshots, camera/physics settings, controller image, and artifact digests.
- Exact-replay comparisons are promised only for qualified deterministic backend profiles.

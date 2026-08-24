# Report Schema

Skillpackager reports are deterministic JSON objects.

## Top-level fields

- `skillDir`: absolute path inspected on the local machine.
- `manifest`: package planning metadata.
- `checks`: validation checks with `id`, `ok`, and `message`.
- `summary`: aggregate pass and fail counts.

## Stability

The `generatedAt` field is fixed for deterministic local review output. Future versions may add fields, but should not remove existing MVP fields without a major version bump.

## Manifest files

`manifest.files` is a sorted list of dry-run package contents.
`manifest.fileCount` is its length, and `manifest.packagePlan.include` is the
same list. Directory trees named `.git`, `node_modules`, `.cache`, or
`coverage` are excluded at any depth so repository metadata, installed
dependencies, caches, and generated coverage do not appear as package source.

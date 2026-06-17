# Report Schema

Skillpackager reports are deterministic JSON objects.

## Top-level fields

- `skillDir`: absolute path inspected on the local machine.
- `manifest`: package planning metadata.
- `checks`: validation checks with `id`, `ok`, and `message`.
- `summary`: aggregate pass and fail counts.

## Stability

The `generatedAt` field is fixed for deterministic local review output. Future versions may add fields, but should not remove existing MVP fields without a major version bump.

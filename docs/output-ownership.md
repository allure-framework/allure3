# Output ownership

The built-in filesystem writer records successful non-live, non-dump generation
in `.allure-output.json`. Custom writers and writers whose root differs from the
configured output do not participate.

The inventory contains output-relative paths, optional plugin IDs, and the current
plugin layout after flattening. It retains earlier recorded paths because this
stage does not remove obsolete files. It is preparation for output cleanup,
not a transaction or a guarantee that every previous path still exists.

## Existing metadata and plugin files

If the inventory path contains unrelated content, an unsupported schema version,
invalid paths, or a symlink, generation continues without updating the inventory.
The existing content is preserved. Publication is also skipped if the inventory
changes during generation.

Plugins can continue writing legacy `.allure-output.json` filenames. Such writes
disable inventory publication for that generation. Normal plugin writes and
flattening keep their existing semantics; the bookkeeping does not overwrite the
plugin's file with generated metadata.

## Concurrent generation

Before the first output write, or before finalization starts, Core exclusively
creates `.allure-output.lock`. Merely starting a report to read results does not
create a lock. The lock is released after generation, including failures in
startup or finalization, and waits for outstanding writer operations to settle.
The lock filename and its platform aliases are reserved for Core.

A second participating generator cannot write to the same output while this lock
is held. The lock includes the owner PID for diagnosis. After an abrupt process
termination it may remain on disk: remove it only after confirming that no
generation using that output is still running. Core does not automatically steal
an existing lock or remove a replacement created by another owner.

This is advisory coordination between participating Core generators. Older
versions, custom writers, live generation, and external filesystem modifications
are not coordinated. CLI operations that clear output before Core starts,
including `run` and `generate --clean`, remain outside this lock boundary. Use
separate output directories for concurrent commands that clean output.

The inventory does not provide staging, rollback, crash recovery, atomic output
replacement, or retirement of resources still used by open report clients.

# Output ownership and replacement

The built-in filesystem writer records successful non-live, non-dump generation
in `.allure-output.json`. Custom writers, subclasses, and writers whose root differs
from the configured output do not participate.

The inventory contains output-relative paths, optional plugin IDs, and the current
plugin layout after flattening. An optional `directories` list remembers directory
provenance across directory/single-file transitions. Unrecorded user files inside a previously owned directory are preserved. Directory
provenance is retained across generations; a historically owned directory does not
become foreign merely because only user files remain inside it. An unrelated
new top-level directory still preserves the established nested report layout.
Ownership applies to paths: replacing an owned file's contents does not relinquish
its ownership. A previous owned path replaced by a directory or symlink fails
preflight rather than guessing whether it can be safely retired. Use unrecorded paths for user-managed files.

## Replacing an existing report

Finalization stages files when a valid inventory exists, including an empty inventory.
Files written before finalization remain immediately visible and are copied into
staging. First generation and legacy output retain their existing direct-write
behavior when no valid inventory exists.

Before remote publication, Core checks staged files and replacement destinations.
After generation and publication handling, replacement backs up affected files,
installs resources before HTML, and records the new inventory. Previously recorded
files absent from the new snapshot are retired. Unrecorded files are not inferred
from extensions or filenames and are never retired merely because they look like
report assets. Empty owned directories are removed only when they contain no files.

A failed plugin finalization during replacement discards the staged snapshot,
retains the previous report, and rejects `done()`. The owned snapshot is the unit
of replacement: healthy plugins are not published from an incomplete replacement.
First-generation direct writes retain the existing per-plugin failure behavior. Remote publication errors keep their existing local-report fallback:
generated local files can be installed, but old files and the previous inventory
are retained. The same conservative policy applies to non-fatal history and
artifact bookkeeping errors. External plugin writes, history/known-issue updates,
and performance diagnostics are outside the filesystem transaction. In particular,
`plugin-metrics` intentionally writes root-level `export/*` files directly for
existing scrapers and can push metrics externally. Those exports can change even
when report replacement aborts; they are not part of the owned report snapshot.

If remote completion succeeds but local replacement subsequently fails, Core
attempts to delete the new remote report and rethrows the local failure. A failed
compensation is logged; it cannot make remote and local storage atomic.

`context.output` remains the configured output root. Writes made directly there
bypass staging. Prefer `reportFiles.addFile` for generated report files. Its returned
path is readable during generation; it is a resource path, not a permanent URL.
Final flattening can move files even without staging, and successful replacement
removes its staging tree. Upload consumes these paths before that cleanup.

This prepares directory reports for selective assets. It does not change which
assets the report plugins select or promise an atomic directory swap for readers.

## Existing metadata and plugin files

If the inventory path contains unrelated content, an unsupported schema version,
invalid paths, or a symlink, generation continues without transactional replacement
or inventory publication. The existing metadata is preserved. Legacy plugin writes
to `.allure-output.json` remain supported; they disable generated inventory
publication and retirement for that generation.

## Concurrent generation

Before the first output write, or before finalization starts, Core exclusively
creates `.allure-output.lock`. Merely starting a report to read results does not
create a lock. The lock is released after generation, including failures, and waits
for outstanding writer operations to settle. The lock and recovery directory names
and their platform aliases are reserved for Core.

A second participating generator cannot write while this lock is held. Its PID is
diagnostic; after abrupt termination the lock can remain. Remove it only after
confirming that no generation using that output is still running. If a filesystem
reports inode zero, Core preserves the unidentifiable lock and warns rather than
risk deleting another writer's lock. Cleanup failures are warnings and do not
replace the original generation error.

Coordination does not cover older versions, custom writers, live generation, or
external filesystem modifications. CLI operations that clear output before Core
starts, including `run`, `watch`, and `generate --clean`, are outside this boundary.
Use separate output directories for concurrent commands that clean output.

## Rollback and interrupted replacement

Staging lives at `.allure-output-transaction/stage` inside the output, on the same
filesystem as its files. Before creating staged files, Core writes a `staging`
receipt to `.allure-output-transaction/journal.json`. Before moving visible files,
it persists `installing` with the output, staging location and planned previous/next
paths. Backups are under the recovery directory's `files/` directory.

An installation error restores backed-up files and removes newly installed files.
Rollback attempts all restorations; if any fail, the error preserves the original
cause and lists failures, and backup/staging data remain available. Cleanup errors
after successful commit are warnings.

After the stale writer's lock has been handled, the next generation can discard a
recognized interrupted `staging` phase, terminal receipts, or a journal-less directory
that is empty or contains only journal temporary files. These states have not moved
visible files, or have completed rollback/commit. A staging receipt with unexpected
backup files, an unfinished `installing` receipt, or malformed metadata blocks writes
and preserves recovery data. Core does not infer successful installation merely
from the presence of next-generation filenames.

Recovery after process termination is manual. Stop writers and copy the output,
recovery directory, and remaining stage before changing anything. Inspect the
journal and actual backup contents; some files may already have been restored.
Restore resources and HTML from backup, with ownership metadata last. Remove newly
installed targets only after comparing them with the journal and backup. Preserve
unrelated files. Verify the restored report before removing recovery data and the
stale lock.

This is exception rollback and interrupted-operation detection, not automatic crash
recovery, power-loss durability, or a transaction across remote publication and
local output. Live-client resource retirement remains excluded. Recovery files are internal but
not an access-control boundary: a generic static server pointed at output can serve
`.allure-output-transaction`, including a retained backup. Do not serve output while
replacing or repairing it, and exclude this directory when publishing report files
through a server or artifact hosting system. Backups must remain until a terminal
journal is persisted; deleting them earlier would remove rollback evidence.

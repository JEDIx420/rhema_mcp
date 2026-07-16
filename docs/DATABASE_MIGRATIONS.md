# Database Migration and Recovery

`schema-version.txt` is the single repository source for the current SQLite schema version. The Rust build script generates `CURRENT_SCHEMA_VERSION` from it. `scripts/finalize_seed_database.py`, invoked at the end of `setup.sh`, writes the same value to the generated seed database. `npm run verify:desktop` reads the SQLite header and fails when the bundled `PRAGMA user_version` differs.

## Startup Behavior

- Fresh install: Rhelo copies the current bundled seed to the platform app-data directory. No migration or backup is created.
- Current install: Rhelo opens the existing writable database without replacing, migrating, or backing it up.
- Older install: Rhelo creates a backup beside the writable database, then runs ordered migrations in transactions.

## Backups

Backups are stored beside the writable `rhelo.db`. The first backup is named `rhelo.backup-schema-v{from}-to-v{to}.sqlite3`; collisions receive `-1`, `-2`, and higher numeric suffixes. Files are created with non-overwriting semantics, so a retry cannot replace an earlier backup.

Rhelo does not automatically delete migration backups. Users may archive or remove old backups after confirming the upgraded database works.

## Recovery

1. Quit Rhelo.
2. Preserve the failed writable `rhelo.db` separately for diagnosis.
3. Copy the desired migration backup into the same app-data directory.
4. Rename the copied file to `rhelo.db`.
5. Reopen a Rhelo version that supports the backup's schema, or retry the newer version after correcting the migration failure.

Do not restore over a running application, and do not test upgrades against the only copy of a user database.

# SQLCipher compatibility fixture

`sqlcipher-4.bin` contains synthetic data only. It was created with the
SQLCipher 4.5.3 source shipped by libsqlite3-sys 0.28.0, the previous desktop
dependency. No SQLite3 Multiple Ciphers code created or converted this fixture.

The raw 32-byte key contains `0x11` repeated 32 times. The SQL was:

```sql
PRAGMA key = "x'1111111111111111111111111111111111111111111111111111111111111111'";
CREATE TABLE interop(v TEXT);
INSERT INTO interop VALUES('shared');
```

The file was closed normally, with no remaining transaction log. The `.bin`
extension keeps this intentional test fixture separate from local database files.

`sqlcipher-wal-base.bin` and `sqlcipher-wal.bin` were created by the same
SQLCipher build and key. After creating the table and first row above, it ran:

```sql
PRAGMA journal_mode=WAL;
PRAGMA wal_autocheckpoint=0;
INSERT INTO interop VALUES('wal-row');
```

The process exited with `_Exit(0)`, leaving the committed second row in the WAL
file. These two files test recovery when upgrading after an interrupted session.

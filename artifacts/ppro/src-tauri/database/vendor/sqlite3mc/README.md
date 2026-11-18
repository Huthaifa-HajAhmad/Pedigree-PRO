# SQLite3 Multiple Ciphers 2.7.1

These unmodified source files come from the official release archive:
https://github.com/utelle/SQLite3MultipleCiphers/releases/tag/v2.7.1

Archive: `sqlite3mc-2.7.1-sqlite-3.54.1-amalgamation.zip`

Archive SHA-256:
`d6bc59678e015c5ac6d3ec5d7b657c351230b36c8052b185e446c9d52ba01af0`

`sqlite3mc_amalgamation.c` SHA-256:
`065561274c387230cb32443e830b2da0bb91f3c92f495b39308e416464488a4d`

The archive checksum matches upstream's SHA256SUMS. The upstream release also
publishes signatures and artifact attestations for independent verification.
The MIT license is included in LICENSE. Embedded component license notices remain
in the unmodified amalgamation; retain them when updating the source.

Build flags are maintained in `../../native-builder/src/main.rs`. SQLCipher 4
compatibility is selected explicitly when opening encrypted databases. Perl and
OpenSSL are not used. Generated upstream sources are kept intact rather than
split to match application file-size limits.

To update: download a pinned upstream release, verify its published checksum and
provenance, replace the source files and license, update these version/hash
references, and run `pnpm test:native` plus all platform build checks.

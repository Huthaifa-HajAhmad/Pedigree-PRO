use ppro_database::rusqlite::Connection;
use std::{fs, path::Path};
use tempfile::tempdir;

const KEY: [u8; 32] = [0x11; 32];
const NEW_KEY: [u8; 32] = [0x22; 32];

fn open(path: &Path, key: &[u8; 32]) -> rusqlite::Result<Connection> {
    ppro_database::open_encrypted(path, key)
}

fn count(db: &Connection) -> i64 {
    db.query_row("SELECT count(*) FROM interop", [], |row| row.get(0))
        .unwrap()
}

#[test]
fn linked_engine_reports_sqlcipher() {
    let dir = tempdir().unwrap();
    let db = open(&dir.path().join("engine.db"), &KEY).unwrap();
    let cipher: String = db.query_row("PRAGMA cipher", [], |row| row.get(0)).unwrap();
    assert_eq!(cipher, "sqlcipher");
}

#[test]
fn rejects_plaintext_before_returning_an_encrypted_connection() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("plaintext.db");
    let db = Connection::open(&path).unwrap();
    db.execute_batch("CREATE TABLE example(value TEXT);")
        .unwrap();
    drop(db);
    assert!(open(&path, &KEY).is_err());
}

#[test]
fn opens_database_created_by_sqlcipher_4_with_existing_raw_key() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("existing.db");
    fs::write(&path, include_bytes!("fixtures/sqlcipher-4.bin")).unwrap();
    let db = open(&path, &KEY).unwrap();
    let value: String = db
        .query_row("SELECT v FROM interop", [], |row| row.get(0))
        .unwrap();
    assert_eq!(value, "shared");
}

#[test]
fn recovers_committed_wal_created_by_sqlcipher_after_abrupt_exit() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("recovered.db");
    fs::write(&path, include_bytes!("fixtures/sqlcipher-wal-base.bin")).unwrap();
    fs::write(
        dir.path().join("recovered.db-wal"),
        include_bytes!("fixtures/sqlcipher-wal.bin"),
    )
    .unwrap();
    let db = open(&path, &KEY).unwrap();
    assert_eq!(count(&db), 2);
}

#[test]
fn writes_encrypted_data_and_rejects_wrong_key_after_reopen() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("encrypted.db");
    let db = open(&path, &KEY).unwrap();
    db.execute_batch("CREATE TABLE interop(v TEXT); INSERT INTO interop VALUES('private-marker');")
        .unwrap();
    drop(db);
    let bytes = fs::read(&path).unwrap();
    assert!(!bytes.starts_with(b"SQLite format 3\0"));
    assert!(!bytes.windows(14).any(|window| window == b"private-marker"));
    let db = open(&path, &KEY).unwrap();
    assert_eq!(count(&db), 1);
    drop(db);
    let wrong = open(&path, &NEW_KEY);
    assert!(
        wrong.is_err()
            || wrong
                .unwrap()
                .query_row("SELECT count(*) FROM interop", [], |row| row
                    .get::<_, i64>(0))
                .is_err()
    );
}

#[test]
fn rotates_raw_key_in_wal_mode_without_losing_committed_rows() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("rotate.db");
    let db = open(&path, &KEY).unwrap();
    db.execute_batch("CREATE TABLE interop(v TEXT); PRAGMA journal_mode=WAL; INSERT INTO interop VALUES('committed');").unwrap();
    ppro_database::rekey(&db, &NEW_KEY).unwrap();
    drop(db);
    let db = open(&path, &NEW_KEY).unwrap();
    assert_eq!(count(&db), 1);
    drop(db);
    let old = open(&path, &KEY);
    assert!(
        old.is_err()
            || old
                .unwrap()
                .query_row("SELECT count(*) FROM interop", [], |row| row
                    .get::<_, i64>(0))
                .is_err()
    );
}

#[test]
fn encrypted_backup_contains_committed_wal_rows() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("live.db");
    let backup_path = dir.path().join("backup.db");
    let db = open(&path, &KEY).unwrap();
    db.execute_batch("CREATE TABLE interop(v TEXT); PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; INSERT INTO interop VALUES('committed');").unwrap();
    db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .unwrap();
    fs::copy(&path, &backup_path).unwrap();
    let restored = open(&backup_path, &KEY).unwrap();
    assert_eq!(count(&restored), 1);
    assert!(!fs::read(&backup_path)
        .unwrap()
        .starts_with(b"SQLite format 3\0"));
}

#[test]
fn allows_plain_sqlite_connections_for_legacy_import() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("legacy.db");
    let db = Connection::open(&path).unwrap();
    db.execute_batch("CREATE TABLE interop(v TEXT); INSERT INTO interop VALUES('legacy');")
        .unwrap();
    drop(db);
    let db = Connection::open(&path).unwrap();
    assert_eq!(count(&db), 1);
}

#[test]
fn applies_all_application_migrations_and_enforces_foreign_keys() {
    let dir = tempdir().unwrap();
    let db = open(&dir.path().join("schema.db"), &KEY).unwrap();
    for sql in [
        include_str!("../../../../../lib/db/migrations/001_initial.sql"),
        include_str!("../../../../../lib/db/migrations/002_clinical_annotations.sql"),
        include_str!("../../../../../lib/db/migrations/003_drop_deprecated_columns.sql"),
        include_str!("../../../../../lib/db/migrations/004_share_log.sql"),
        include_str!("../../../../../lib/db/migrations/005_share_links.sql"),
        include_str!("../../../../../lib/db/migrations/006_nodes_couple_counts.sql"),
    ] {
        db.execute_batch(sql).unwrap();
    }
    db.execute_batch("PRAGMA foreign_keys=ON; INSERT INTO patients(first_name,last_name) VALUES('Synthetic','Patient');").unwrap();
    assert!(db
        .execute(
            "INSERT INTO pedigrees(title,patient_id) VALUES('Invalid',999)",
            []
        )
        .is_err());
    let integrity: String = db
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .unwrap();
    assert_eq!(integrity, "ok");
}

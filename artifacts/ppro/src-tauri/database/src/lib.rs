pub use rusqlite;

use rusqlite::Connection;
use std::{fs::File, io::Read, path::Path};

/// Opens a database using the SQLCipher 4 file format and a raw 256-bit key.
pub fn open_encrypted(path: &Path, key: &[u8; 32]) -> rusqlite::Result<Connection> {
    let db = Connection::open(path)?;
    let mut header = [0u8; 16];
    File::open(path)
        .and_then(|mut file| file.read(&mut header))
        .map_err(|error| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_IOERR),
                Some(error.to_string()),
            )
        })?;
    if header == *b"SQLite format 3\0" {
        return Err(rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_NOTADB),
            Some("Expected an encrypted database, found plaintext SQLite".into()),
        ));
    }
    db.execute_batch("PRAGMA cipher='sqlcipher'; PRAGMA legacy=4;")?;
    db.execute_batch(&format!("PRAGMA key = \"x'{}'\";", hex::encode(key)))?;
    // Plain SQLite ignores unknown PRAGMA settings. Require the encryption engine.
    let cipher: String = db.query_row("PRAGMA cipher", [], |row| row.get(0))?;
    if cipher != "sqlcipher" {
        return Err(rusqlite::Error::InvalidQuery);
    }
    Ok(db)
}

/// Changes the raw key without changing the database encryption format.
pub fn rekey(db: &Connection, key: &[u8; 32]) -> rusqlite::Result<()> {
    db.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", hex::encode(key)))
}

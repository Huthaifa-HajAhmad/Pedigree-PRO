use std::{env, fs, path::PathBuf};

fn main() {
    let args: Vec<String> = env::args().collect();
    let host = &args[1];
    let target = &args[2];
    let output = PathBuf::from(&args[3]);
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../vendor/sqlite3mc");
    fs::create_dir_all(&output).expect("Failed to create native library directory");
    cc::Build::new()
        .host(host)
        .target(target)
        .out_dir(output)
        .opt_level(2)
        .debug(false)
        .cargo_metadata(false)
        .file(source.join("sqlite3mc_amalgamation.c"))
        .include(&source)
        .define("SQLITE_THREADSAFE", "1")
        .define("SQLITE_TEMP_STORE", "2")
        .define("SQLITE_DEFAULT_FOREIGN_KEYS", "1")
        .define("SQLITE_ENABLE_API_ARMOR", None)
        .define("SQLITE_ENABLE_COLUMN_METADATA", "1")
        .define("SQLITE_ENABLE_DBSTAT_VTAB", None)
        .define("SQLITE_ENABLE_FTS3", None)
        .define("SQLITE_ENABLE_FTS3_PARENTHESIS", None)
        .define("SQLITE_ENABLE_FTS5", "1")
        .define("SQLITE_ENABLE_RTREE", "1")
        .define("SQLITE_ENABLE_STAT4", None)
        .define("SQLITE_SOUNDEX", None)
        .define("SQLITE_USE_URI", "1")
        .define("CODEC_TYPE", "CODEC_TYPE_SQLCIPHER")
        .define("SQLITE3MC_USE_SQLCIPHER_LEGACY", None)
        .define("SQLCIPHER_VERSION_DEFAULT", "4")
        .warnings(false)
        .compile("sqlite3");
}

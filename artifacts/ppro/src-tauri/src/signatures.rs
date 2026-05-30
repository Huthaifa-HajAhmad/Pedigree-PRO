// Pedigree PRO — Cryptographic Primitives
//
// Provides Ed25519 signing/verification and SHA-256 content hashing
// for cryptographic provenance (ADR-001) and content integrity (ADR-002).

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signature, SigningKey, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};

/// Generates a new Ed25519 keypair.
/// Returns (base64url_public_key, base64url_private_key).
pub fn generate_keypair() -> (String, String) {
    let mut csprng = rand::rngs::OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();

    let public_b64 = URL_SAFE_NO_PAD.encode(verifying_key.as_bytes());
    let private_b64 = URL_SAFE_NO_PAD.encode(signing_key.to_bytes());

    (public_b64, private_b64)
}

/// Verifies an Ed25519 signature.
pub fn verify(data: &[u8], signature_b64: &str, public_key_b64: &str) -> Result<bool, String> {
    let sig_bytes = URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|e| format!("Invalid signature encoding: {}", e))?;

    let sig_bytes: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| "Signature must be 64 bytes".to_string())?;

    let pk_bytes = URL_SAFE_NO_PAD
        .decode(public_key_b64)
        .map_err(|e| format!("Invalid public key encoding: {}", e))?;

    let pk_bytes: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| "Public key must be 32 bytes".to_string())?;

    let signature = Signature::from_bytes(&sig_bytes);
    let verifying_key = VerifyingKey::from_bytes(&pk_bytes)
        .map_err(|e| format!("Invalid public key: {}", e))?;

    Ok(verifying_key.verify(data, &signature).is_ok())
}

/// Computes SHA-256 hash of data.
/// Returns hex-encoded 32-byte digest.
pub fn hash_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

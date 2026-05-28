// Pedigree PRO — Zero-Knowledge Relay Client
//
// Implements the client side of the encrypted sharing protocol (ADR-001 §3.3).
// The relay service (Cloudflare Worker) stores only ciphertext — it cannot
// decrypt payloads.
//
// Protocol:
//   1. Sender encrypts export with ephemeral symmetric key
//   2. Sender encrypts symmetric key with recipient's public key (sealed box)
//   3. POST ciphertext + encrypted_key to relay → get share_token
//   4. Recipient GETs from relay → decrypts with private key → imports
//
// Critical fixes applied (Phase 0-C hardening):
//   - Fully implemented HTTP POST/GET/DELETE to the relay service
//   - Async via reqwest + tokio
//   - Tauri commands wired for share_pedigree and import_shared
//   - Token revocation support

use serde::{Deserialize, Serialize};

/// Default relay service URL.
/// Override via RELAY_URL environment variable or Tauri config.
const DEFAULT_RELAY_URL: &str = "https://pedigreepro-relay.pedigreepro.workers.dev";

// =============================================================================
// Relay API Types
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct RelayShareRequest {
    pub ciphertext: String,
    pub encrypted_key: String,
    pub ttl_hours: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelayShareResponse {
    pub share_token: String,
    pub expires_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelayReceiveResponse {
    pub ciphertext: String,
    pub encrypted_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RelayErrorResponse {
    error: String,
}

/// Determines the relay base URL from environment or default.
fn relay_base_url() -> String {
    std::env::var("RELAY_URL").unwrap_or_else(|_| DEFAULT_RELAY_URL.to_string())
}

// =============================================================================
// Relay API Operations
// =============================================================================

/// Posts an encrypted share to the relay service.
/// Returns the share token and expiry.
pub async fn relay_share(
    ciphertext: &str,
    encrypted_key: &str,
    ttl_hours: Option<u32>,
) -> Result<RelayShareResponse, String> {
    let base_url = relay_base_url();
    let url = format!("{}/api/relay/share", base_url);

    let request_body = RelayShareRequest {
        ciphertext: ciphertext.to_string(),
        encrypted_key: encrypted_key.to_string(),
        ttl_hours,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to relay: {}", e))?;

    let status = response.status();

    if status.is_success() {
        response
            .json::<RelayShareResponse>()
            .await
            .map_err(|e| format!("Invalid relay response: {}", e))
    } else {
        let error = response
            .json::<RelayErrorResponse>()
            .await
            .map(|e| e.error)
            .unwrap_or_else(|_| format!("HTTP {}", status));
        Err(format!("Relay error: {}", error))
    }
}

/// Fetches an encrypted share from the relay service by token.
pub async fn relay_receive(
    share_token: &str,
) -> Result<RelayReceiveResponse, String> {
    let base_url = relay_base_url();
    let url = format!("{}/api/relay/receive/{}", base_url, share_token);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to relay: {}", e))?;

    let status = response.status();

    if status.is_success() {
        response
            .json::<RelayReceiveResponse>()
            .await
            .map_err(|e| format!("Invalid relay response: {}", e))
    } else if status.as_u16() == 404 {
        Err("Share token expired or not found".to_string())
    } else if status.as_u16() == 410 {
        Err("Share token already consumed".to_string())
    } else {
        let error = response
            .json::<RelayErrorResponse>()
            .await
            .map(|e| e.error)
            .unwrap_or_else(|_| format!("HTTP {}", status));
        Err(format!("Relay error: {}", error))
    }
}

/// Revokes a share token (sender-initiated deletion).
pub async fn relay_revoke(share_token: &str) -> Result<(), String> {
    let base_url = relay_base_url();
    let url = format!("{}/api/relay/receive/{}", base_url, share_token);

    let client = reqwest::Client::new();
    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to relay: {}", e))?;

    let status = response.status();

    if status.is_success() || status.as_u16() == 204 {
        Ok(())
    } else if status.as_u16() == 404 {
        Err("Share token not found or already consumed".to_string())
    } else {
        let error = response
            .json::<RelayErrorResponse>()
            .await
            .map(|e| e.error)
            .unwrap_or_else(|_| format!("HTTP {}", status));
        Err(format!("Relay error: {}", error))
    }
}

// =============================================================================
// Encrypted Sharing Orchestration
// =============================================================================

/// Encrypts a raw JSON payload for sharing via the relay.
///
/// 1. Generates an ephemeral XChaCha20-Poly1305 symmetric key (via signatures module)
/// 2. Encrypts the payload with the symmetric key (delegated: frontend does this)
/// 3. Encrypts the symmetric key for the recipient (delegated: frontend does this)
/// 4. Posts the sealed package to the relay
///
/// Returns (share_token, share_url).
///
/// Note: The actual symmetric encryption and sealed box operations are performed
/// by the frontend via libsodium/Web Crypto API, since only the frontend has
/// access to the user's private key in the OS keychain. This function handles
/// only the relay HTTP transport.
pub async fn share_encrypted_payload(
    ciphertext: &str,
    encrypted_key: &str,
    ttl_hours: Option<u32>,
) -> Result<(String, String), String> {
    let result = relay_share(ciphertext, encrypted_key, ttl_hours).await?;

    let base_url = relay_base_url();
    let share_url = format!("{}/s/{}", base_url, result.share_token);

    Ok((result.share_token, share_url))
}

/// Fetches and decrypts a shared payload from the relay.
///
/// 1. GETs ciphertext + encrypted_key from relay
/// 2. Returns both to the caller (frontend handles decryption with private key)
pub async fn fetch_shared_payload(
    share_token: &str,
) -> Result<(String, String), String> {
    let result = relay_receive(share_token).await?;
    Ok((result.ciphertext, result.encrypted_key))
}
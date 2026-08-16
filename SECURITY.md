# Security Policy

The security and privacy of clinical pedigree data is central to the design of **Pedigree PRO**.

---

## Supported Versions

Security updates are provided for the current active release line:

| Version | Supported |
| :--- | :--- |
| `1.3.x` | :white_check_mark: Active Support |
| `< 1.3.0` | :x: Unsupported (Upgrade Recommended) |

---

## Reporting a Vulnerability

If you discover a security vulnerability, cryptographic weakness, or privacy issue, please **do not open a public GitHub issue**.

### Preferred Reporting Method
Please submit a confidential report using **[GitHub Private Security Advisories](https://github.com/Huthaifa-HajAhmad/Pedigree-PRO/security/advisories/new)**.

Alternatively, contact the lead maintainer directly via GitHub at [@Huthaifa-HajAhmad](https://github.com/Huthaifa-HajAhmad).

### What to Include
* Description of the vulnerability.
* Steps to reproduce or proof-of-concept exploit payload.
* Impact assessment (e.g. key extraction, memory corruption, unauthenticated relay leak).
* Operating environment (Tauri Desktop OS or Browser runtime).

### Response SLA
* **Initial Acknowledgement:** Within 48 hours.
* **Assessment & Triage:** Within 5 business days.
* **Fix & Coordinated Disclosure:** We will work collaboratively with the reporter on a timeline before releasing a patch and CVE advisory.

---

## Security Model Overview

Pedigree PRO enforces a strict zero-server, local-first trust architecture:

1. **Zero Central Database:** All pedigree and patient data resides solely on the user's local disk (Tauri SQLCipher) or browser storage (sql.js in encrypted IndexedDB).
2. **Key Material Isolation:** Profile Ed25519 signing keys and database encryption keys are stored exclusively in IndexedDB using `idb-keyval`, never in `localStorage` (mitigating DOM XSS extraction).
3. **Peer-to-Peer & Relay Sharing:** Sharing uses ephemeral hybrid encryption (Ed25519 + AES-256-GCM envelope). Encrypted relay payloads are zero-knowledge and auto-expire.
4. **Supply Chain Defense:** The repository enforces a 24-hour quarantine (`minimumReleaseAge: 1440` in `pnpm-workspace.yaml`) and restricts native build hooks to audited dependencies only.

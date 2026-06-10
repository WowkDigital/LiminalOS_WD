# Security & Performance Audit Report: LiminalOS

This document details the security and performance audit of the LiminalOS application. It outlines the vulnerabilities discovered and patched, along with a performance profiling overview of the rendering engine and database storage layer.

---

## 1. Security Analysis & Patches

During the audit of the PHP backend (`admin/api.php`, `admin/index.php`), three critical security weaknesses were identified and immediately remediated.

### 1.1 Unrestricted File Upload (Remote Code Execution - RCE)
*   **Vulnerability**: The media upload endpoint (`action=upload_media`) did not validate file extensions before storing them in the public `media/uploads/` directory. While it ran `processImage()` afterwards, if that call failed (e.g. on a non-image file), the uploaded file remained on the disk. A malicious actor could upload a `.php` script and execute arbitrary shell code on the server.
*   **Remediation**:
    *   Added a strict whitelist verification for both image (`jpg`, `jpeg`, `png`, `gif`, `webp`) and audio (`mp3`, `wav`, `ogg`, `m4a`) formats.
    *   Implemented automatic cleanup: If `processImage()` fails or throws an exception, the uploaded file is immediately deleted via `@unlink($dest)`.

### 1.2 Disk space Leak (Orphaned Media Assets)
*   **Vulnerability**: When an administrator deleted an image via the admin panel (`action=delete_media`), only the raw upload file was deleted. The compressed variant created in `media/images/` and the thumbnail created in `media/images/thumbs/` were orphaned and left on the disk, leading to potential storage exhaustion.
*   **Remediation**:
    *   Updated the deletion logic to calculate the paths for all three files (original, compressed version, and thumbnail version) and delete all three variants programmatically.

### 1.3 Session Security & Preventing Fixation
*   **Vulnerability**: The PHP session setup relied on default settings which didn't protect cookies against Cross-Site Scripting (XSS) access, Cross-Site Request Forgery (CSRF), or session fixation attacks.
*   **Remediation**:
    *   Hardened session initialization with secure cookie parameters in both `admin/index.php` and `admin/api.php`:
        ```php
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'Strict',
            'cookie_secure' => isset($_SERVER['HTTPS'])
        ]);
        ```
    *   Added `session_regenerate_id(true)` immediately upon successful credential match to defend against session fixation attacks.

---

## 2. Performance Analysis

### 2.1 Physics Simulation Optimization (Map Visualization)
*   **Observation**: Interactive canvas-based map generation often suffers from performance degradation due to perpetual render/tick loops running in the background.
*   **Analysis**:
    *   `MapGraph` in `mapgen.js` implements a custom spring-repulsion force layout.
    *   The simulation is fully **synchronous and bounded to exactly 120 iterations** during graph generation/rendering.
    *   Once the coordinates are calculated, the canvas is drawn once. There are no asynchronous `requestAnimationFrame` ticks or idle loops running.
    *   **Result**: CPU usage drops to **0%** as soon as the map finishes rendering.

### 2.2 Database Query & Data Sync Performance
*   **Observation**: SQLite database lookups must remain performant to ensure game client requests (`GET` api queries) remain instantaneous.
*   **Analysis**:
    *   The code utilizes prepared statements (`$pdo->prepare()`) for all parametric database transactions, ensuring query plans are cached and sql injections are completely blocked.
    *   Primary keys (`INTEGER PRIMARY KEY AUTOINCREMENT`) are correctly declared on all tables.
    *   Database reads are batch-fetched in single requests, reducing connection overhead and minimizing SQLite disk I/O.

### 2.3 Offloading Network Overhead
*   **Observation**: Loading high-resolution background assets directly from the primary application server consumes significant bandwidth.
*   **Analysis**:
    *   The recent implementation of the `CONFIG_MEDIA_BASE_URL` directive allows decoupling media files from code.
    *   Assets can be hosted on a fast, decentralized CDN or Object Storage (such as Cloudflare R2, AWS S3), reducing primary server network overhead to nearly zero.

---

## 3. Audit Status Summary

| Area | Status | Notes |
| :--- | :---: | :--- |
| **SQL Injection** | **SECURE** | Checked. All queries utilize parameterized PDO statements. |
| **File Upload (RCE)** | **SECURE** | Patched. Enforced extension whitelist + auto-cleanup. |
| **File Traversal** | **SECURE** | Checked. Filenames are strictly sanitized to alphanumeric characters. |
| **Session Security** | **SECURE** | Patched. Enabled HttpOnly, SameSite, and Session ID regeneration. |
| **Asset Disk Leaks** | **RESOLVED** | Patched. Deletion cleans up original, compressed, and thumbnail variants. |
| **CPU Rendering Footprint** | **OPTIMAL** | Checked. Synchronous, bounded 120-iteration layout. No background loop leaks. |

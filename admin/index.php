<?php
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'cookie_secure' => isset($_SERVER['HTTPS'])
]);

// Helper to parse .env file
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $name = trim($parts[0]);
            $value = trim($parts[1]);
            
            // Strip surrounding quotes
            if (strlen($value) >= 2 && (
                ($value[0] === '"' && substr($value, -1) === '"') ||
                ($value[0] === "'" && substr($value, -1) === "'")
            )) {
                $value = substr($value, 1, -1);
            }
            
            if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

loadEnv(__DIR__ . '/../.env');

$adminPassword = $_ENV['ADMIN_PASSWORD'] ?? (getenv('ADMIN_PASSWORD') !== false ? getenv('ADMIN_PASSWORD') : 'liminal_secret_99');

// Handle login POST
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === $adminPassword) {
        session_regenerate_id(true);
        $_SESSION['admin_auth'] = true;
        header('Location: index.php');
        exit;
    } else {
        $error = 'ACCESS DENIED: INVALID AUTHORIZATION KEY';
    }
}

// Handle logout GET
if (isset($_GET['logout'])) {
    unset($_SESSION['admin_auth']);
    header('Location: index.php');
    exit;
}

// If authenticated, render the admin page
if (isset($_SESSION['admin_auth']) && $_SESSION['admin_auth'] === true):
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liminal // Control Terminal</title>
    <script>
        // Force trailing slash for correct relative path resolution
        if (window.location.pathname.endsWith('/admin')) {
            window.location.replace(window.location.pathname + '/');
        }
    </script>
    <link rel="stylesheet" href="style.css">
    <script src="https://unpkg.com/lucide@latest"></script>
</head>

<body>
    <div class="admin-container">

        <!-- Sidebar / Navigation -->
        <aside class="sidebar">
            <div class="logo">
                <span>LIMINAL</span><span class="dim">ADMIN</span>
            </div>
            <nav>
                <button id="btn-dashboard" class="nav-btn active"><i data-lucide="layout-dashboard"></i>
                    Dashboard</button>
                <button id="btn-media" class="nav-btn"><i data-lucide="image"></i> Media Library</button>
                 <button id="btn-interactables" class="nav-btn"><i data-lucide="package"></i> Interactables</button>
                <button id="btn-transitions" class="nav-btn"><i data-lucide="repeat"></i> Transitions</button>
                <button id="btn-terminal" class="nav-btn"><i data-lucide="terminal"></i> Terminal Dialogues</button>
                <button id="btn-taxonomy" class="nav-btn"><i data-lucide="settings"></i> System Config</button>
                <button id="btn-sfx" class="nav-btn"><i data-lucide="music"></i> SFX Engine</button>
                <button id="btn-add-room" class="nav-btn"><i data-lucide="plus-circle"></i> Add New Room</button>

                <label class="nav-btn" for="json-import-input" style="cursor: pointer;">
                    <i data-lucide="file-up"></i>
                    Import Locations
                    <input type="file" id="json-import-input" accept=".json" style="display:none">
                </label>
                <a href="import_template.json" download class="nav-link"
                    style="font-size: 0.8rem; margin-top: -8px; opacity: 0.6; margin-bottom: 10px;">
                    <i data-lucide="download" style="width: 14px; height: 14px;"></i> (Download Template)
                </a>

                <label class="nav-btn" for="trans-import-input" style="cursor: pointer;">
                    <i data-lucide="file-up"></i>
                    Import Transitions
                    <input type="file" id="trans-import-input" accept=".json" style="display:none">
                </label>
                <a href="api.php?action=export_transitions" download class="nav-link"
                    style="font-size: 0.8rem; margin-top: -8px; opacity: 0.6;">
                    <i data-lucide="eye" style="width: 14px; height: 14px;"></i> (View Current JSON)
                </a>

                <div class="separator"></div>
                <div class="nav-title">System Sync</div>
                <button id="btn-export-all" class="nav-btn"><i data-lucide="file-down"></i> Export All Data</button>
                <label class="nav-btn" for="all-import-input" style="cursor: pointer;">
                    <i data-lucide="refresh-cw"></i>
                    Import All Data
                    <input type="file" id="all-import-input" accept=".json" style="display:none">
                </label>
                <div class="separator"></div>
                <div class="nav-title">Diagnostics</div>
                <button id="btn-tests" class="nav-btn"><i data-lucide="shield-check"></i> Unit Tests</button>
                <div class="separator"></div>
                <a href="../index.html" target="_blank" class="nav-link"><i data-lucide="external-link"></i> Open
                    Game</a>
                <a href="?logout=1" class="nav-link" style="color: var(--error);"><i data-lucide="log-out"></i> Log Out</a>
            </nav>
            <div class="status-indicator">
                <span class="dot"></span> System Online
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="content">

            <!-- Dashboard View -->
            <section id="view-dashboard" class="view">
                <header class="section-header">
                    <div>
                        <h2>World Overview</h2>
                        <p class="subtitle">Manage existing liminal spaces.</p>
                    </div>
                    <div id="world-integrity-status"></div>
                </header>

                <div id="dashboard-search-container" style="margin-bottom: 24px; display: flex; gap: 16px; align-items: center; max-width: 480px;"></div>

                <div class="rooms-grid" id="rooms-list">
                    <!-- Rooms will be injected here via JS -->
                    <div class="loading">Loading reality data...</div>
                </div>
            </section>

            <!-- Media Library View -->
            <section id="view-media" class="view hidden">
                <header class="section-header">
                    <h2>Media Library</h2>
                    <div class="header-actions">
                        <label class="btn-primary" for="media-upload-input">
                            + Upload New Image
                            <input type="file" id="media-upload-input" accept="image/*" style="display:none" multiple>
                        </label>
                    </div>
                </header>

                <div class="media-controls">
                    <div id="media-search-container" style="flex: 1;"></div>
                    <select id="media-filter-type">
                        <option value="all">All Types</option>
                        <option value="room">Rooms</option>
                        <option value="transition">Transitions</option>
                        <option value="interactable">Interactables</option>
                        <option value="none">Unassigned</option>
                    </select>
                </div>

                <div id="media-tag-chips" class="media-tag-chips">
                    <!-- Tag filter chips injected by JS -->
                </div>

                <div class="media-grid" id="media-list">
                    <!-- Media items will be injected here via JS -->
                </div>
            </section>

            <!-- Editor View -->
            <section id="view-editor" class="view hidden">
                <header class="section-header">
                    <div>
                        <h2 id="editor-title">Define New Space</h2>
                    </div>
                    <div class="header-actions">
                        <button id="btn-delete-room" class="btn-remove hidden">Delete</button>
                        <button id="btn-cancel-edit" class="btn-secondary">Cancel</button>
                        <button type="submit" form="room-form" class="btn-primary">Save Reality</button>
                    </div>
                </header>

                <form id="room-form">
                    <div class="editor-layout">
                        <div class="editor-main">

                            <!-- ACCORDION: Location Metadata -->
                            <details class="editor-accordion" open>
                                <summary class="editor-accordion-header">
                                    <span class="accordion-icon-wrap"><i data-lucide="map-pin"></i></span>
                                    <span class="accordion-title">Location Metadata</span>
                                    <i data-lucide="chevron-down" class="accordion-chevron"></i>
                                </summary>
                                <div class="editor-accordion-body">
                                    <div class="form-row-3">
                                        <div class="form-group">
                                            <label for="room-id">Unique Room ID</label>
                                            <input type="text" id="room-id" name="id" placeholder="e.g. infinite_hallway" required>
                                            <small>Unique, lowercase, no spaces.</small>
                                        </div>
                                        <div class="form-group">
                                            <label for="room-name">Display Name</label>
                                            <input type="text" id="room-name" name="name" placeholder="e.g. The Infinite Hallway" required>
                                        </div>
                                        <div class="form-group">
                                            <label for="room-tags">Tags (comma separated)</label>
                                            <input type="text" id="room-tags" name="tags" placeholder="liminal, dark, industrial">
                                        </div>
                                    </div>
                                </div>
                            </details>

                            <!-- ACCORDION: Active Room Transitions (Portals) -->
                            <details class="editor-accordion" open>
                                <summary class="editor-accordion-header">
                                    <span class="accordion-icon-wrap"><i data-lucide="git-fork"></i></span>
                                    <span class="accordion-title">Active Room Transitions <span class="accordion-subtitle">(Portals)</span></span>
                                    <i data-lucide="chevron-down" class="accordion-chevron"></i>
                                </summary>
                                <div class="editor-accordion-body">
                                    <div id="transitions-container">
                                        <!-- Checkboxes will be injected here via JS -->
                                    </div>
                                </div>
                            </details>

                            <!-- ACCORDION: Terminal Interaction -->
                            <details class="editor-accordion">
                                <summary class="editor-accordion-header">
                                    <span class="accordion-icon-wrap"><i data-lucide="terminal"></i></span>
                                    <span class="accordion-title">Terminal Interaction</span>
                                    <i data-lucide="chevron-down" class="accordion-chevron"></i>
                                </summary>
                                <div class="editor-accordion-body">
                                    <!-- Hidden tab panel kept for JS compat -->
                                    <div id="room-tab-terminal" class="room-tab-content">
                                        <label class="checkbox-container" style="display: flex; align-items: center; gap: 8px; font-size: 1rem; margin-bottom: 1.5rem; cursor: pointer;">
                                            <input type="checkbox" id="room-terminal-enabled">
                                            <span class="checkbox-label" style="font-weight: 600;">Enable Terminal Interaction in this Room</span>
                                        </label>
                                        <div id="room-terminal-config" class="hidden" style="border-top: 1px dashed var(--glass-border); padding-top: 1.5rem;">
                                            <div class="form-group">
                                                <label for="room-terminal-text">Screen Content Text</label>
                                                <textarea id="room-terminal-text" rows="4" placeholder="Text displayed on CRT screen when player interacts with the terminal in this room..."></textarea>
                                                <small>Use {ROOM} for room display name placeholder.</small>
                                            </div>
                                            <div class="form-section" style="margin-top: 1.5rem; background: rgba(0,0,0,0.15); padding: 1.5rem; border-radius: var(--radius-sm);">
                                                <h3 style="border-bottom: 1px dashed var(--glass-border); padding-bottom: 8px; margin-bottom: 1rem;">Terminal Options</h3>
                                                <div id="room-terminal-options-list"></div>
                                                <button type="button" id="btn-add-room-terminal-option" class="btn-small" style="margin-top: 12px;">+ Add Option</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>

                            <!-- ACCORDION: Scenes Manager -->
                            <details class="editor-accordion" open>
                                <summary class="editor-accordion-header">
                                    <span class="accordion-icon-wrap"><i data-lucide="layers"></i></span>
                                    <span class="accordion-title">Scenes Manager</span>
                                    <i data-lucide="chevron-down" class="accordion-chevron"></i>
                                </summary>
                                <div class="editor-accordion-body" style="padding: 0;">
                                    <div id="room-tab-scenes" class="room-tab-content">
                                        <div class="scenes-manager-v3">
                                            <!-- Top: Scene cards bar -->
                                            <div class="scenes-topbar-v3">
                                                <div id="scene-list-container" class="scene-list-container-h">
                                                    <!-- Cards injected by renderScenesSection() -->
                                                </div>
                                                <div class="scenes-topbar-actions">
                                                    <button type="button" id="btn-add-scene" class="btn-primary scenes-add-btn">+ Add Scene</button>
                                                </div>
                                            </div>
                                            <!-- Bottom: Active scene editor -->
                                            <div id="active-scene-editor" class="scene-editor-panel scenes-editor-v3">
                                                <div class="empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888; padding: 3rem;">
                                                    <i data-lucide="layers" style="width: 40px; height: 40px; margin-bottom: 1rem; opacity: 0.3;"></i>
                                                    <span style="font-size: 0.9rem; text-align: center;">Select a scene state above or create a new one.</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </details>

                            <!-- ACCORDION: Data Control (JSON) — at the bottom -->
                            <details class="editor-accordion editor-accordion--json">
                                <summary class="editor-accordion-header">
                                    <span class="accordion-icon-wrap"><i data-lucide="code-2"></i></span>
                                    <span class="accordion-title">Data Control <span class="accordion-subtitle">(JSON)</span></span>
                                    <i data-lucide="chevron-down" class="accordion-chevron"></i>
                                </summary>
                                <div class="editor-accordion-body">
                                    <!-- Dummy tab panels so JS selectors still work -->
                                    <div id="room-tab-general" class="room-tab-content" style="display:none;"></div>
                                    <div class="json-tabs">
                                        <button type="button" class="json-tab-btn active" data-tab-type="export" data-target="room-export-container">Export</button>
                                        <button type="button" class="json-tab-btn" data-tab-type="import" data-target="room-import-container">Import</button>
                                    </div>
                                    <div id="room-export-container" class="json-tab-panel active">
                                        <div class="form-group compact" style="margin-top: 10px;">
                                            <textarea id="room-json-export" readonly rows="10"
                                                style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); color: var(--accent-primary); resize: none;"></textarea>
                                            <button type="button" id="btn-copy-room-json" class="btn-secondary full-width" style="margin-top: 10px;">
                                                <i data-lucide="copy" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                                Copy JSON
                                            </button>
                                        </div>
                                    </div>
                                    <div id="room-import-container" class="json-tab-panel hidden">
                                        <div class="form-group compact" style="margin-top: 10px;">
                                            <textarea id="room-json-import" rows="10" placeholder="Paste room JSON data here..."
                                                style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); resize: none;"></textarea>
                                            <button type="button" id="btn-apply-room-json" class="btn-primary full-width" style="margin-top: 10px;">
                                                <i data-lucide="upload" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                                Apply JSON Data
                                            </button>
                                            <small style="margin-top: 8px;">Warning: This will overwrite currently entered data.</small>
                                        </div>
                                    </div>
                                </div>
                            </details>

                        </div>
                    </div>

                    <!-- form-actions moved to header -->
                </form>
            </section>

            <!-- Interactables View -->
            <section id="view-interactables" class="view hidden">
                <header class="section-header">
                    <h2>Interactable Objects</h2>
                    <button id="btn-add-interactable" class="btn-primary">+ Create New Object</button>
                </header>

                <div class="rooms-grid" id="interactables-list">
                    <!-- Interactables will be injected here via JS -->
                </div>
            </section>

            <!-- Interactable Editor View -->
            <section id="view-interactable-editor" class="view hidden">
                <header class="section-header">
                    <div>
                        <h2 id="inter-editor-title">Define Interactable</h2>
                    </div>
                    <div class="header-actions">
                        <button id="btn-delete-interactable" class="btn-remove hidden">Delete</button>
                        <button id="btn-cancel-inter-edit" class="btn-secondary">Cancel</button>
                        <button type="submit" form="inter-form" class="btn-primary">Save Object</button>
                    </div>
                </header>

                <form id="inter-form">
                    <div class="editor-layout">
                        <div class="editor-main">
                            <div class="form-row-3">
                                <div class="form-group">
                                    <label for="inter-id">Object ID</label>
                                    <input type="text" id="inter-id" name="id" placeholder="e.g. wall_switch" required>
                                    <small>Unique ID, lowercase, no spaces.</small>
                                </div>

                                <div class="form-group">
                                    <label for="inter-label">Label</label>
                                    <input type="text" id="inter-label" name="label" placeholder="e.g. Old Light Switch"
                                        required>
                                </div>

                                <div class="form-group">
                                    <label for="inter-room-id">Belongs to Room</label>
                                    <select id="inter-room-id" name="room_id" required>
                                        <!-- Injected via JS -->
                                    </select>
                                    <small>Select the parent room for this object.</small>
                                </div>
                            </div>

                            <div class="form-section">
                                <h3>Logical States</h3>
                                <p class="small-dim">Define what happens when users interact with this object.</p>
                                <div id="states-list"></div>
                                <button type="button" id="btn-add-state" class="btn-small">+ Add New State</button>
                            </div>

                            <div class="form-section json-control-section">
                                <h3 style="margin-bottom: 0.75rem;">Data Control (JSON)</h3>
                                
                                <div class="json-tabs">
                                    <button type="button" class="json-tab-btn active" data-tab-type="export" data-target="inter-export-container">Export</button>
                                    <button type="button" class="json-tab-btn" data-tab-type="import" data-target="inter-import-container">Import</button>
                                </div>
                                
                                <div id="inter-export-container" class="json-tab-panel active">
                                    <div class="form-group compact" style="margin-top: 10px;">
                                        <textarea id="inter-json-export" readonly rows="10"
                                            style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); color: var(--accent-primary); resize: none;"></textarea>
                                        <button type="button" id="btn-copy-inter-json" class="btn-secondary full-width"
                                            style="margin-top: 10px;">
                                            <i data-lucide="copy"
                                                style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                            Copy JSON
                                        </button>
                                    </div>
                                </div>
                                
                                <div id="inter-import-container" class="json-tab-panel hidden">
                                    <div class="form-group compact" style="margin-top: 10px;">
                                        <textarea id="inter-json-import" rows="10"
                                            placeholder="Paste interactable JSON data here..."
                                            style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); resize: none;"></textarea>
                                        <button type="button" id="btn-apply-inter-json" class="btn-primary full-width"
                                            style="margin-top: 10px;">
                                            <i data-lucide="upload"
                                                style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                            Apply JSON Data
                                        </button>
                                        <small style="margin-top: 8px;">Warning: This will overwrite currently entered data.</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- form-actions moved to header -->
                </form>
            </section>

            <!-- Transitions View -->
            <section id="view-transitions" class="view hidden">
                <header class="section-header">
                    <h2>Expansion Overlays (Transitions)</h2>
                    <button id="btn-add-transition" class="btn-primary">+ New Transition</button>
                </header>

                <div class="rooms-grid" id="transitions-list">
                    <!-- Transitions will be injected here via JS -->
                </div>
            </section>

            <!-- Transition Editor View -->
            <section id="view-transition-editor" class="view hidden">
                <header class="section-header">
                    <div>
                        <h2 id="trans-editor-title">Define Transition</h2>
                    </div>
                    <div class="header-actions">
                        <button id="btn-delete-transition" class="btn-remove hidden">Delete</button>
                        <button id="btn-cancel-trans-edit" class="btn-secondary">Cancel</button>
                        <button type="submit" form="trans-form" class="btn-primary">Save Transition</button>
                    </div>
                </header>

                <form id="trans-form">
                    <div class="editor-layout">
                        <div class="editor-main">
                            <div class="form-row-2">
                                <div class="form-group">
                                    <label for="trans-id">Unique Transition ID</label>
                                    <input type="text" id="trans-id" name="id" placeholder="e.g. industrial_elevator_01"
                                        required>
                                </div>

                                <div class="form-group">
                                    <label for="trans-label">Label</label>
                                    <input type="text" id="trans-label" name="label"
                                        placeholder="e.g. Descending into Level 1" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Categories (Matching Rooms)</label>
                                <div id="trans-category-group" class="checkbox-group grid-2">
                                    <!-- Dynamic checkboxes here -->
                                </div>
                            </div>

                            <div class="form-row-2">
                                <div class="form-group">
                                    <label for="trans-desc">Description</label>
                                    <textarea id="trans-desc" name="desc" rows="2" placeholder="..." required></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="trans-tags">Tags (comma separated)</label>
                                    <input type="text" id="trans-tags" name="tags"
                                        placeholder="elevator, humming, descending">
                                </div>
                            </div>

                            <div class="form-section">
                                <h3>Transition Texts</h3>
                                <div class="text-list-header">
                                    <span class="col-text">Atmospheric Line</span>
                                    <span class="col-sanity">Sanity Range</span>
                                    <span class="col-dialog">Dialog ID</span>
                                    <span class="col-action"></span>
                                </div>
                                <div id="trans-texts-list"></div>
                                <button type="button" id="btn-add-trans-text" class="btn-small">+ Add Text Line</button>
                            </div>

                            <div class="form-section">
                                <h3>Transition Graphics</h3>
                                <p class="small-dim">Visuals for this transition.</p>
                                <div id="trans-images-preview" class="image-preview-grid"></div>
                                <button type="button" id="btn-manage-trans-media"
                                    class="btn-secondary full-width">Manage Graphics</button>
                            </div>

                            <div class="form-section json-control-section">
                                <h3 style="margin-bottom: 0.75rem;">Data Control (JSON)</h3>
                                
                                <div class="json-tabs">
                                    <button type="button" class="json-tab-btn active" data-tab-type="export" data-target="trans-export-container">Export</button>
                                    <button type="button" class="json-tab-btn" data-tab-type="import" data-target="trans-import-container">Import</button>
                                </div>
                                
                                <div id="trans-export-container" class="json-tab-panel active">
                                    <div class="form-group compact" style="margin-top: 10px;">
                                        <textarea id="trans-json-export" readonly rows="10"
                                            style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); color: var(--accent-primary); resize: none;"></textarea>
                                        <button type="button" id="btn-copy-trans-json" class="btn-secondary full-width"
                                            style="margin-top: 10px;">
                                            <i data-lucide="copy"
                                                style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                            Copy JSON
                                        </button>
                                    </div>
                                </div>
                                
                                <div id="trans-import-container" class="json-tab-panel hidden">
                                    <div class="form-group compact" style="margin-top: 10px;">
                                        <textarea id="trans-json-import" rows="10"
                                            placeholder="Paste transition JSON data here..."
                                            style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.5); resize: none;"></textarea>
                                        <button type="button" id="btn-apply-trans-json" class="btn-primary full-width"
                                            style="margin-top: 10px;">
                                            <i data-lucide="upload"
                                                style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                                            Apply JSON Data
                                        </button>
                                        <small style="margin-top: 8px;">Warning: This will overwrite currently entered data.</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- form-actions moved to header -->
                </form>
            </section>
            <!-- Taxonomy Management View -->
            <section id="view-taxonomy" class="view hidden">
                <header class="section-header">
                    <h2>System Taxonomy & Modularity</h2>
                </header>

                <div class="taxonomy-grid">
                    <!-- Room Tags Section -->
                    <div class="taxonomy-box">
                        <header class="box-header">
                            <i data-lucide="tag" class="accent"></i>
                            <div>
                                <h3>Room Tags</h3>
                                <p class="small-dim">Defining descriptors for room ambiance.</p>
                            </div>
                        </header>
                        <div id="list-room-tags" class="tax-list"></div>
                        <div class="tax-add">
                            <input type="text" id="new-room-tag" placeholder="new_tag...">
                            <button id="btn-add-room-tag" class="btn-primary">Add</button>
                        </div>
                    </div>

                    <!-- Transition Categories Section -->
                    <div class="taxonomy-box">
                        <header class="box-header">
                            <i data-lucide="split" class="accent"></i>
                            <div>
                                <h3>Transition Categories</h3>
                                <p class="small-dim">Linking room types via portal logic.</p>
                            </div>
                        </header>
                        <div id="list-transition-categories" class="tax-list"></div>
                        <div class="tax-add">
                            <input type="text" id="new-trans-cat" placeholder="new_category...">
                            <button id="btn-add-trans-cat" class="btn-primary">Add</button>
                        </div>
                    </div>

                    <!-- Transition Tags Section -->
                    <div class="taxonomy-box">
                        <header class="box-header">
                            <i data-lucide="zap" class="accent"></i>
                            <div>
                                <h3>Transition Tags</h3>
                                <p class="small-dim">Specific descriptors for movement types.</p>
                            </div>
                        </header>
                        <div id="list-transition-tags" class="tax-list"></div>
                        <div class="tax-add">
                            <input type="text" id="new-trans-tag" placeholder="new_tag...">
                            <button id="btn-add-trans-tag" class="btn-primary">Add</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- SFX View -->
            <section id="view-sfx" class="view hidden">
                <header class="section-header">
                    <h2>SFX & Audio Engine</h2>
                    <div class="header-actions">
                        <label class="btn-primary" for="audio-upload-input">
                            + Upload New Audio
                            <input type="file" id="audio-upload-input" accept="audio/*" style="display:none" multiple>
                        </label>
                    </div>
                </header>

                <div class="sfx-unified-layout">
                    <!-- Section 1: Audio Library -->
                    <div class="sfx-card collapsible active" id="sfx-sec-library">
                        <div class="sfx-card-header">
                            <div class="sfx-card-title">
                                <i data-lucide="library" class="accent"></i>
                                <span>Audio Library</span>
                                <small class="sec-meta" id="library-count-meta"></small>
                            </div>
                            <i data-lucide="chevron-down" class="chevron-icon"></i>
                        </div>
                        <div class="sfx-card-body">
                            <p class="small-dim" style="margin-bottom: 12px;">Uploaded audio files. Click play to listen, pencil to edit name, trash to delete.</p>
                            <div id="audio-search-container" style="margin-bottom: 15px;"></div>
                            <div id="audio-items-list" class="audio-items-list">
                                <!-- Injected -->
                            </div>
                        </div>
                    </div>

                    <!-- Section 2: Music Mappings (BGM) -->
                    <div class="sfx-card collapsible" id="sfx-sec-bgm">
                        <div class="sfx-card-header">
                            <div class="sfx-card-title">
                                <i data-lucide="music" class="accent"></i>
                                <span>Music Mappings (BGM)</span>
                                <small class="sec-meta">Background ambient loops mapped to rooms</small>
                            </div>
                            <i data-lucide="chevron-down" class="chevron-icon"></i>
                        </div>
                        <div class="sfx-card-body">
                            <div id="bgm-mapping-list" class="mapping-container"></div>
                        </div>
                    </div>

                    <!-- Section 3: Object State Mappings (SFX) -->
                    <div class="sfx-card collapsible" id="sfx-sec-states">
                        <div class="sfx-card-header">
                            <div class="sfx-card-title">
                                <i data-lucide="package" class="accent"></i>
                                <span>Object State Mappings (SFX)</span>
                                <small class="sec-meta">One-shot SFX loops mapped to object states</small>
                            </div>
                            <i data-lucide="chevron-down" class="chevron-icon"></i>
                        </div>
                        <div class="sfx-card-body">
                            <div id="states-mapping-list" class="mapping-container"></div>
                        </div>
                    </div>

                    <!-- Section 4: Transition Mappings -->
                    <div class="sfx-card collapsible" id="sfx-sec-transitions">
                        <div class="sfx-card-header">
                            <div class="sfx-card-title">
                                <i data-lucide="repeat" class="accent"></i>
                                <span>Transition Mappings</span>
                                <small class="sec-meta">SFX played during transition events</small>
                            </div>
                            <i data-lucide="chevron-down" class="chevron-icon"></i>
                        </div>
                        <div class="sfx-card-body">
                            <div id="transitions-mapping-list" class="mapping-container"></div>
                        </div>
                    </div>

                    <!-- Section 5: UI Event Mappings -->
                    <div class="sfx-card collapsible" id="sfx-sec-ui">
                        <div class="sfx-card-header">
                            <div class="sfx-card-title">
                                <i data-lucide="mouse-pointer" class="accent"></i>
                                <span>UI Event Mappings (Click)</span>
                                <small class="sec-meta">Procedural sounds overridden by custom SFX</small>
                            </div>
                            <i data-lucide="chevron-down" class="chevron-icon"></i>
                        </div>
                        <div class="sfx-card-body">
                            <div id="ui-mapping-list" class="mapping-container"></div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Terminal Dialogues View -->
            <section id="view-terminal" class="view hidden">
                <header class="section-header">
                    <div>
                        <h2>Terminal Dialogue Tree</h2>
                        <p class="subtitle">Configure dialogue nodes, options, entry conditions, and state effects for interactive terminals.</p>
                    </div>
                    <div class="header-actions">
                        <button id="btn-save-terminal" class="btn-primary">Save Dialogues</button>
                    </div>
                </header>

                <div class="terminal-manager-layout">
                    <!-- Left pane: Node List and Add Node -->
                    <div class="terminal-sidebar-pane">
                        <div class="form-section">
                            <h3>Dialogue Nodes</h3>
                            <div id="terminal-node-search-container" style="margin-bottom: 12px;"></div>
                            <div id="terminal-nodes-list" class="node-items-list">
                                <!-- Nodes will be injected here -->
                            </div>
                            <button type="button" id="btn-add-terminal-node" class="btn-small">+ Create New Node</button>
                        </div>
                    </div>

                    <!-- Right pane: Node Editor -->
                    <div class="terminal-editor-pane">
                        <div class="form-section" id="terminal-node-editor-card">
                            <h3 id="terminal-editor-node-id">Select a node to edit</h3>
                            
                            <div id="terminal-editor-fields" class="hidden">
                                <div class="form-group">
                                    <label for="terminal-node-id-input">Dialogue Node ID</label>
                                    <input type="text" id="terminal-node-id-input" placeholder="e.g. ROOM_LOBBY_SUB" required>
                                    <small>Unique ID matching dialogue_id field in room texts, uppercase, e.g., ROOM_XXX.</small>
                                </div>

                                <div class="form-group">
                                    <label for="terminal-node-text-input">Screen Content Text</label>
                                    <textarea id="terminal-node-text-input" rows="4" placeholder="Text displayed on CRT screen... Use {ROOM} for current room name placeholder." required></textarea>
                                </div>

                                <div class="form-section" style="margin-top: 1.5rem; background: rgba(0,0,0,0.15);">
                                    <h3 style="border-bottom: 1px dashed var(--glass-border); padding-bottom: 8px;">Interactive Options</h3>
                                    <div id="terminal-options-list">
                                        <!-- Options list goes here -->
                                    </div>
                                    <button type="button" id="btn-add-terminal-option" class="btn-small" style="margin-top: 12px;">+ Add Option</button>
                                </div>

                                <div style="margin-top: 2rem; display: flex; justify-content: space-between;">
                                    <button type="button" id="btn-delete-terminal-node" class="btn-remove">Delete Node</button>
                                </div>
                            </div>

                            <div id="terminal-editor-placeholder" class="empty">
                                <i data-lucide="terminal" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 8px;"></i>
                                <p>Select an existing dialogue node or create a new one to begin editing.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Unit Tests / Diagnostics View -->
            <section id="view-tests" class="view hidden">
                <header class="section-header">
                    <div>
                        <h2>Diagnostics & Unit Tests</h2>
                        <p class="subtitle">Run validation suites to verify backend integrity, schema alignment, and dynamic API endpoints.</p>
                    </div>
                    <div class="header-actions">
                        <button id="btn-run-tests" class="btn-primary">
                            <i data-lucide="play" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 5px;"></i>
                            Run Test Suite
                        </button>
                    </div>
                </header>

                <div class="tests-layout">
                    <!-- Test Results Panel -->
                    <div class="tests-card">
                        <div class="box-header">
                            <i data-lucide="shield-check" class="accent"></i>
                            <div>
                                <h3>Test Runner Results</h3>
                                <p class="small-dim">System assertions status.</p>
                            </div>
                        </div>

                        <!-- Summary Counters -->
                        <div id="tests-summary-bar" class="tests-summary-container hidden">
                            <div class="summary-metric">
                                <span class="metric-val" id="tests-count-total">0</span>
                                <span class="metric-lbl">Total Tests</span>
                            </div>
                            <div class="summary-metric success">
                                <span class="metric-val" id="tests-count-passed">0</span>
                                <span class="metric-lbl">Passed</span>
                            </div>
                            <div class="summary-metric error">
                                <span class="metric-val" id="tests-count-failed">0</span>
                                <span class="metric-lbl">Failed</span>
                            </div>
                        </div>

                        <div id="tests-results-list" class="tests-results-list">
                            <div class="empty">
                                <i data-lucide="play-circle" style="width: 32px; height: 32px; opacity: 0.5; margin-bottom: 8px;"></i>
                                <p>Initiate diagnostic scan to execute backend assertions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- Media Selector Modal -->
    <div id="media-modal" class="modal hidden">
        <div class="modal-content">
            <header class="modal-header">
                <h3>Select Graphics</h3>
                <button id="btn-close-modal" class="btn-close">&times;</button>
            </header>
            <div class="modal-body">
                <div class="media-selector-grid" id="modal-media-list"></div>
            </div>
            <footer class="modal-footer">
                <button id="btn-confirm-media" class="btn-primary">Confirm Selection</button>
            </footer>
        </div>
    </div>

    <!-- Requirements Modal -->
    <div id="req-modal" class="modal hidden">
        <div class="modal-content" style="max-width: 500px;">
            <header class="modal-header">
                <h3 id="req-modal-title">Configure Conditions</h3>
                <button id="btn-close-req-modal" class="btn-close">&times;</button>
            </header>
            <div class="modal-body">
                <div class="form-group">
                    <label>Interactable Dependency</label>
                    <select id="req-interactable-id">
                        <option value="">None</option>
                    </select>
                </div>
                <div id="req-state-group" class="form-group hidden">
                    <label>Required State</label>
                    <select id="req-state-id"></select>
                </div>
                <div class="form-section" style="margin-top: 1.5rem;">
                    <h3>Sanity Range</h3>
                    <div style="display:flex; gap:15px; align-items: flex-end;">
                        <div style="flex:1">
                            <label style="font-size: 0.75rem;">Minimum (%)</label>
                            <input type="number" id="req-sanity-min" value="0" min="0" max="100">
                        </div>
                        <div style="flex:1">
                            <label style="font-size: 0.75rem;">Maximum (%)</label>
                            <input type="number" id="req-sanity-max" value="100" min="0" max="100">
                        </div>
                    </div>
                    <small>Visibility will be restricted to this sanity range.</small>
                </div>
            </div>
            <footer class="modal-footer">
                <button id="btn-clear-req" class="btn-secondary">Clear All</button>
                <button id="btn-save-req" class="btn-primary">Apply Conditions</button>
            </footer>
        </div>
    </div>

    <!-- Click Area Modal -->
    <div id="click-area-modal" class="modal hidden">
        <div class="modal-content" style="max-width: 800px; width: 90%;">
            <header class="modal-header">
                <h3 id="click-area-modal-title">Configure Transition Click Area</h3>
                <button id="btn-close-click-area-modal" class="btn-close">&times;</button>
            </header>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 15px;">
                <p class="small-dim" style="margin: 0; font-size: 0.8rem;">Click and drag on the image below to define the clickable area for this transition category.</p>
                <div id="click-area-editor-container" style="position: relative; background: #000; display: flex; justify-content: center; align-items: center; min-height: 300px; max-height: 50vh; overflow: hidden; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); user-select: none;">
                    <img id="click-area-target-img" src="" alt="Room graphic" style="max-width: 100%; max-height: 50vh; width: auto; height: auto; display: block; pointer-events: none;">
                    <div id="click-area-drawing-overlay" style="position: absolute; cursor: crosshair; z-index: 10;">
                        <div id="click-area-selection-box" style="position: absolute; border: 2px dashed var(--accent-primary); background: rgba(234, 179, 8, 0.15); display: none; pointer-events: none; box-shadow: 0 0 8px var(--accent-glow);">
                            <div style="position: absolute; right: 4px; bottom: 4px; background: rgba(0,0,0,0.8); color: var(--accent-primary); font-family: var(--font-mono); font-size: 0.65rem; padding: 2px 4px; border-radius: 2px;" id="click-area-box-coords">0% 0%</div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; font-family: var(--font-mono); font-size: 0.8rem;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.75rem; margin-bottom: 4px;">Left (%)</label>
                        <input type="number" id="click-area-left" min="0" max="100" step="0.1" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: #fff; padding: 6px; border-radius: 4px; font-size: 0.85rem;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.75rem; margin-bottom: 4px;">Top (%)</label>
                        <input type="number" id="click-area-top" min="0" max="100" step="0.1" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: #fff; padding: 6px; border-radius: 4px; font-size: 0.85rem;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.75rem; margin-bottom: 4px;">Width (%)</label>
                        <input type="number" id="click-area-width" min="0" max="100" step="0.1" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: #fff; padding: 6px; border-radius: 4px; font-size: 0.85rem;">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.75rem; margin-bottom: 4px;">Height (%)</label>
                        <input type="number" id="click-area-height" min="0" max="100" step="0.1" style="width: 100%; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: #fff; padding: 6px; border-radius: 4px; font-size: 0.85rem;">
                    </div>
                </div>
            </div>
            <footer class="modal-footer">
                <button id="btn-clear-click-area" class="btn-secondary">Clear Area</button>
                <button id="btn-save-click-area" class="btn-primary">Save Area</button>
            </footer>
        </div>
    </div>

    <!-- Import Preview Modal -->
    <div id="import-preview-modal" class="modal hidden">
        <div class="modal-content" style="max-width: 600px;">
            <header class="modal-header">
                <h3>Data Sync Preview</h3>
                <button id="btn-close-import-modal" class="btn-close">&times;</button>
            </header>
            <div class="modal-body">
                <div id="import-summary" class="import-summary-container">
                    <!-- Summary info will be injected here -->
                </div>
                <div id="import-details" class="import-details-list">
                    <!-- Detailed changes will be injected here -->
                </div>
            </div>
            <footer class="modal-footer">
                <button id="btn-cancel-import" class="btn-secondary">Decline</button>
                <button id="btn-confirm-import" class="btn-primary">Execute Sync</button>
            </footer>
        </div>
    </div>

    <!-- Toast Notification Container -->
    <div id="toast-container"></div>

    <script type="module" src="js/main.js"></script>
    <script>
        // Initialize lucide icons for elements created dynamically/late
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    </script>
</body>

</html>
<?php else: ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Liminal // Access Authorization</title>
    <link rel="stylesheet" href="style.css">
    <style>
        .login-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-core);
            background-image: radial-gradient(circle at 50% 50%, rgba(234, 179, 8, 0.04) 0%, transparent 40%);
            font-family: var(--font-sans);
            padding: 20px;
        }
        .login-card {
            background: rgba(10, 10, 10, 0.85);
            border: 1px solid var(--glass-border);
            padding: 2.5rem;
            border-radius: var(--radius-md);
            width: 100%;
            max-width: 420px;
            box-shadow: var(--shadow-card);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            text-align: center;
        }
        .login-logo {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-main);
            letter-spacing: 2px;
            margin-bottom: 0.5rem;
        }
        .login-logo span.dim {
            color: var(--accent-primary);
            text-shadow: 0 0 10px var(--accent-glow);
        }
        .login-subtitle {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            text-transform: uppercase;
        }
        .login-form input[type="password"] {
            width: 100%;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid var(--glass-border);
            color: var(--text-main);
            padding: 0.8rem 1rem;
            border-radius: var(--radius-sm);
            font-family: var(--font-mono);
            font-size: 0.9rem;
            margin-bottom: 1.2rem;
            outline: none;
            transition: all var(--transition-fast);
            text-align: center;
        }
        .login-form input[type="password"]:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 8px rgba(234, 179, 8, 0.15);
        }
        .login-form button {
            width: 100%;
            background: var(--accent-primary);
            color: #000;
            border: none;
            padding: 0.8rem;
            border-radius: var(--radius-sm);
            font-family: var(--font-sans);
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition-fast);
            letter-spacing: 1px;
            text-transform: uppercase;
            font-size: 0.8rem;
        }
        .login-form button:hover {
            opacity: 0.9;
            box-shadow: 0 0 15px var(--accent-glow);
        }
        .login-error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid var(--error);
            color: var(--error);
            font-family: var(--font-mono);
            font-size: 0.72rem;
            padding: 0.7rem;
            border-radius: var(--radius-sm);
            margin-bottom: 1.2rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-wrapper">
        <div class="login-card">
            <div class="login-logo">
                LIMINAL<span class="dim">ADMIN</span>
            </div>
            <div class="login-subtitle">Authorization Protocol Required</div>
            
            <form method="POST" class="login-form">
                <?php if ($error): ?>
                    <div class="login-error"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                <input type="password" name="password" placeholder="ENTER ACCESS KEY..." required autofocus autocomplete="off">
                <button type="submit">Initialize Override</button>
            </form>
        </div>
    </div>
</body>
</html>
<?php endif; ?>

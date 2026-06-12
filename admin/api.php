<?php
// admin/api.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Start session to access authentication state
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

// Check authorization
$isAuthorized = isset($_SESSION['admin_auth']) && $_SESSION['admin_auth'] === true;

// Publicly readable endpoints required by the game client:
// 1. Loading game database (GET request with no action)
// 2. Loading game audio mapping (GET request with action=get_audio)
$action = $_GET['action'] ?? '';
$isPublicEndpoint = ($_SERVER['REQUEST_METHOD'] === 'GET' && ($action === '' || $action === 'get_audio'));

if (!$isAuthorized && !$isPublicEndpoint) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized: Please authenticate via the admin login panel.']);
    exit;
}

ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

$dbFile = __DIR__ . '/../world_data/database.sqlite';
require_once __DIR__ . '/image_utils.php';
require_once __DIR__ . '/data_sync.php';

$mediaDir = realpath(__DIR__ . '/../media');
if (!$mediaDir) {
    mkdir(__DIR__ . '/../media', 0777, true);
    $mediaDir = realpath(__DIR__ . '/../media');
}
if (!file_exists($mediaDir . '/uploads'))
    mkdir($mediaDir . '/uploads', 0777, true);
if (!file_exists($mediaDir . '/sound_effects'))
    mkdir($mediaDir . '/sound_effects', 0777, true);


function php_delete_file_on_disk($path) {
    if (empty($path)) return;
    $rootPath = realpath(__DIR__ . '/../');
    $absPath = $rootPath . '/' . $path;

    if (file_exists($absPath)) {
        @unlink($absPath);
    }

    // If it's a media image, also delete compressed and thumbnail versions
    $filename = basename($path);
    if (strpos($path, 'media/uploads/') === 0) {
        $compressedPath = $rootPath . '/media/images/' . $filename;
        if (file_exists($compressedPath)) {
            @unlink($compressedPath);
        }

        $thumbPath = $rootPath . '/media/images/thumbs/' . $filename;
        if (file_exists($thumbPath)) {
            @unlink($thumbPath);
        }
    }
}

function migrateDatabase($pdo) {
    // Ensure core and metadata tables exist first
    $pdo->exec("CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT,
        desc TEXT
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS transitions (
        id TEXT PRIMARY KEY,
        category TEXT,
        label TEXT,
        desc TEXT
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS interactables (
        id TEXT PRIMARY KEY,
        label TEXT,
        current_state_index INTEGER DEFAULT 0
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS global_definitions (
        type TEXT,
        value TEXT,
        PRIMARY KEY (type, value)
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS taxonomy_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        label TEXT UNIQUE
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS media_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        filepath TEXT,
        context_type TEXT,
        context_id TEXT,
        tags TEXT
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS audio_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT,
        filepath TEXT,
        tags TEXT,
        category TEXT
    )");

    // Check current version
    $version = 0;
    try {
        $stmt = $pdo->query("SELECT value FROM global_definitions WHERE type = 'db_version'");
        if ($stmt) {
            $val = $stmt->fetchColumn();
            if ($val !== false) {
                $version = (int)$val;
            }
        }
    } catch (PDOException $e) {
        // Table global_definitions or version column might not exist or be empty
    }

    if ($version < 2) {
        $pdo->exec("PRAGMA foreign_keys = OFF;");
        $pdo->beginTransaction();
        try {
            // Re-create each child table with ON DELETE CASCADE

            // 1. room_tags
            $pdo->exec("CREATE TABLE IF NOT EXISTS room_tags_new (
                room_id TEXT,
                tag TEXT,
                PRIMARY KEY (room_id, tag),
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT OR IGNORE INTO room_tags_new SELECT * FROM room_tags");
                $pdo->exec("DROP TABLE room_tags");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE room_tags_new RENAME TO room_tags");

            // 2. room_transitions
            $pdo->exec("CREATE TABLE IF NOT EXISTS room_transitions_new (
                room_id TEXT,
                category TEXT,
                requirements TEXT,
                PRIMARY KEY (room_id, category),
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT OR IGNORE INTO room_transitions_new SELECT * FROM room_transitions");
                $pdo->exec("DROP TABLE room_transitions");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE room_transitions_new RENAME TO room_transitions");

            // 3. room_interactables
            $pdo->exec("CREATE TABLE IF NOT EXISTS room_interactables_new (
                room_id TEXT,
                interactable_id TEXT,
                requirements TEXT,
                PRIMARY KEY (room_id, interactable_id),
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
                FOREIGN KEY(interactable_id) REFERENCES interactables(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT OR IGNORE INTO room_interactables_new SELECT * FROM room_interactables");
                $pdo->exec("DROP TABLE room_interactables");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE room_interactables_new RENAME TO room_interactables");

            // 4. room_texts
            $pdo->exec("CREATE TABLE IF NOT EXISTS room_texts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT,
                text TEXT,
                sanity_min INTEGER DEFAULT 0,
                sanity_max INTEGER DEFAULT 100,
                dialogue_id TEXT,
                FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT INTO room_texts_new (room_id, text, sanity_min, sanity_max, dialogue_id) 
                            SELECT room_id, text, sanity_min, sanity_max, dialogue_id FROM room_texts");
                $pdo->exec("DROP TABLE room_texts");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE room_texts_new RENAME TO room_texts");

            // 5. interactable_states
            $pdo->exec("CREATE TABLE IF NOT EXISTS interactable_states_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interactable_id TEXT,
                state_id TEXT,
                desc TEXT,
                image TEXT,
                sort_order INTEGER,
                effects TEXT,
                FOREIGN KEY(interactable_id) REFERENCES interactables(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT INTO interactable_states_new (id, interactable_id, state_id, desc, image, sort_order, effects) 
                            SELECT id, interactable_id, state_id, desc, image, sort_order, effects FROM interactable_states");
                $pdo->exec("DROP TABLE interactable_states");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE interactable_states_new RENAME TO interactable_states");

            // 6. transition_tags
            $pdo->exec("CREATE TABLE IF NOT EXISTS transition_tags_new (
                transition_id TEXT,
                tag TEXT,
                PRIMARY KEY (transition_id, tag),
                FOREIGN KEY(transition_id) REFERENCES transitions(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT OR IGNORE INTO transition_tags_new SELECT * FROM transition_tags");
                $pdo->exec("DROP TABLE transition_tags");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE transition_tags_new RENAME TO transition_tags");

            // 7. transition_texts
            $pdo->exec("CREATE TABLE IF NOT EXISTS transition_texts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transition_id TEXT,
                text TEXT,
                sanity_min INTEGER DEFAULT 0,
                sanity_max INTEGER DEFAULT 100,
                dialogue_id TEXT,
                FOREIGN KEY(transition_id) REFERENCES transitions(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT INTO transition_texts_new (transition_id, text, sanity_min, sanity_max, dialogue_id) 
                            SELECT transition_id, text, sanity_min, sanity_max, dialogue_id FROM transition_texts");
                $pdo->exec("DROP TABLE transition_texts");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE transition_texts_new RENAME TO transition_texts");

            // 8. transition_category_links
            $pdo->exec("CREATE TABLE IF NOT EXISTS transition_category_links_new (
                transition_id TEXT,
                category TEXT,
                PRIMARY KEY (transition_id, category),
                FOREIGN KEY(transition_id) REFERENCES transitions(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT OR IGNORE INTO transition_category_links_new SELECT * FROM transition_category_links");
                $pdo->exec("DROP TABLE transition_category_links");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE transition_category_links_new RENAME TO transition_category_links");

            // 9. audio_mappings
            $pdo->exec("CREATE TABLE IF NOT EXISTS audio_mappings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mapping_type TEXT,
                context_id TEXT,
                audio_file_id INTEGER,
                volume REAL DEFAULT 0.5,
                loop BOOLEAN DEFAULT 0,
                FOREIGN KEY(audio_file_id) REFERENCES audio_library(id) ON DELETE CASCADE
            )");
            try {
                $pdo->exec("INSERT INTO audio_mappings_new (id, mapping_type, context_id, audio_file_id, volume, loop) 
                            SELECT id, mapping_type, context_id, audio_file_id, volume, loop FROM audio_mappings");
                $pdo->exec("DROP TABLE audio_mappings");
            } catch (PDOException $e) {}
            $pdo->exec("ALTER TABLE audio_mappings_new RENAME TO audio_mappings");

            // Update version in global_definitions
            $pdo->exec("INSERT OR REPLACE INTO global_definitions (type, value) VALUES ('db_version', '2')");
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        } finally {
            $pdo->exec("PRAGMA foreign_keys = ON;");
        }
    }
}

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec("PRAGMA foreign_keys = ON;");

    // Register PHP function for SQLite triggers to clean up files
    if (method_exists($pdo, 'createFunction')) {
        $pdo->createFunction('delete_file_on_disk', 'php_delete_file_on_disk', 1);
    } else {
        @$pdo->sqliteCreateFunction('delete_file_on_disk', 'php_delete_file_on_disk', 1);
    }

    // Create Triggers
    $pdo->exec("CREATE TRIGGER IF NOT EXISTS trg_delete_media AFTER DELETE ON media_library
    BEGIN
        SELECT delete_file_on_disk(OLD.filepath);
    END;");

    $pdo->exec("CREATE TRIGGER IF NOT EXISTS trg_delete_audio AFTER DELETE ON audio_library
    BEGIN
        SELECT delete_file_on_disk(OLD.filepath);
    END;");

    // Re-create the standard tables with ON DELETE CASCADE and run migration
    migrateDatabase($pdo);
}
catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Helper to get full world data for the game
function getFullWorld($pdo)
{
    // 1. Rooms
    $rooms = [];
    $stmt = $pdo->query("SELECT * FROM rooms");
    while ($row = $stmt->fetch()) {
        $id = $row['id'];
        $rooms[$id] = [
            'name' => $row['name'],
            'desc' => $row['desc'],
            'tags' => [],
            'transitions' => [],
            'interactables' => [],
            'texts' => []
        ];

        // Tags
        $stmtTags = $pdo->prepare("SELECT tag FROM room_tags WHERE room_id = ?");
        $stmtTags->execute([$id]);
        $rooms[$id]['tags'] = $stmtTags->fetchAll(PDO::FETCH_COLUMN);

        // Transitions
        $stmtTrans = $pdo->prepare("SELECT category, requirements FROM room_transitions WHERE room_id = ?");
        $stmtTrans->execute([$id]);
        $rawTrans = $stmtTrans->fetchAll(PDO::FETCH_ASSOC);
        $rooms[$id]['transitions'] = array_map(function ($t) {
            $req = !empty($t['requirements']) ? json_decode($t['requirements'], true) : null;
            // Return object structure
            return [
            'category' => $t['category'],
            'requirements' => $req
            ];
        }, $rawTrans);

        // Interactables
        $stmtInt = $pdo->prepare("SELECT interactable_id, requirements FROM room_interactables WHERE room_id = ?");
        $stmtInt->execute([$id]);
        $rawInt = $stmtInt->fetchAll(PDO::FETCH_ASSOC);
        $rooms[$id]['interactables'] = array_map(function ($i) {
            $req = !empty($i['requirements']) ? json_decode($i['requirements'], true) : null;
            return [
            'id' => $i['interactable_id'],
            'requirements' => $req
            ];
        }, $rawInt);

        // Texts
        $stmtTexts = $pdo->prepare("SELECT text, sanity_min, sanity_max, dialogue_id FROM room_texts WHERE room_id = ?");
        $stmtTexts->execute([$id]);
        $rooms[$id]['texts'] = $stmtTexts->fetchAll();
    }

    // 2. Transitions
    $transition_types = [];

    // First, get all category mappings
    $catMap = [];
    $stmtMap = $pdo->query("SELECT transition_id, category FROM transition_category_links");
    while ($m = $stmtMap->fetch()) {
        $catMap[$m['transition_id']][] = $m['category'];
    }

    $stmt = $pdo->query("SELECT * FROM transitions");
    while ($row = $stmt->fetch()) {
        $tId = $row['id'];

        $tData = [
            'id' => $tId,
            'label' => $row['label'],
            'desc' => $row['desc'],
            'tags' => [],
            'texts' => [],
            'categories' => $catMap[$tId] ?? []
        ];

        // Tags
        $stmtTags = $pdo->prepare("SELECT tag FROM transition_tags WHERE transition_id = ?");
        $stmtTags->execute([$tId]);
        $tData['tags'] = $stmtTags->fetchAll(PDO::FETCH_COLUMN);

        // Texts
        $stmtTexts = $pdo->prepare("SELECT text, sanity_min, sanity_max, dialogue_id FROM transition_texts WHERE transition_id = ?");
        $stmtTexts->execute([$tId]);
        $tData['texts'] = $stmtTexts->fetchAll();

        // Add to EACH category it belongs to
        $cats = $catMap[$tId] ?? ['universal'];
        foreach ($cats as $cat) {
            if (!isset($transition_types[$cat]))
                $transition_types[$cat] = [];
            $transition_types[$cat][] = $tData;
        }
    }

    // 3. Interactables
    $interactables = [];
    $stmt = $pdo->query("SELECT * FROM interactables");
    while ($row = $stmt->fetch()) {
        $id = $row['id'];
        $interactables[$id] = [
            'label' => $row['label'],
            'current_state_index' => $row['current_state_index'],
            'states' => []
        ];

        $stmtStates = $pdo->prepare("SELECT * FROM interactable_states WHERE interactable_id = ? ORDER BY sort_order ASC");
        $stmtStates->execute([$id]);
        while ($sRow = $stmtStates->fetch()) {
            $state = [
                'id' => $sRow['state_id'],
                'desc' => $sRow['desc']
            ];
            if ($sRow['image']) {
                $state['image'] = $sRow['image'];
            }
            if (!empty($sRow['effects'])) {
                $state['effects'] = json_decode($sRow['effects'], true);
            }
            $interactables[$id]['states'][] = $state;
        }
    }

    // 4. Image Index (Dynamic from library)
    $image_index = ['rooms' => [], 'transitions' => []];

    $stmt = $pdo->query("SELECT * FROM media_library");
    while ($row = $stmt->fetch()) {
        $type = $row['context_type'];
        $cId = $row['context_id'];
        $path = $row['filepath'];

        if ($type === 'room') {
            if (!isset($image_index['rooms'][$cId]))
                $image_index['rooms'][$cId] = [];
            $image_index['rooms'][$cId][] = $path;
        }
        elseif ($type === 'transition') {
            // Index by specific ID
            if (!isset($image_index['transitions'][$cId]))
                $image_index['transitions'][$cId] = [];
            $image_index['transitions'][$cId][] = $path;

            // Also index by Category for fallback
            if (isset($catMap[$cId])) {
                foreach ($catMap[$cId] as $cat) {
                    if (!isset($image_index['transitions'][$cat]))
                        $image_index['transitions'][$cat] = [];
                    $image_index['transitions'][$cat][] = $path;
                }
            }
        }
    }

    // 5. Taxonomy Definitions
    $definitions = [];
    $stmt = $pdo->query("SELECT type, label FROM taxonomy_definitions");
    while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $definitions[] = $r;
    }

    return [
        'rooms' => $rooms,
        'transition_types' => $transition_types,
        'interactables' => $interactables,
        'image_index' => $image_index,
        'taxonomy' => $definitions
    ];
}

// Note: Core tables, taxonomy, media, and audio table schemas are dynamically created and verified on demand by migrateDatabase().

// ROUTING
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
    if ($action === 'media') {
        // Fetch media library
        $stmt = $pdo->query("SELECT * FROM media_library ORDER BY id DESC");
        echo json_encode($stmt->fetchAll());
    }
    elseif ($action === 'get_taxonomy') {
        // Aggregate existing data + definitions
        $taxonomy = [
            'room_tags' => [],
            'transition_categories' => [],
            'transition_tags' => []
        ];

        // 1. Room Tags
        $stmt = $pdo->query("SELECT tag as label, COUNT(*) as count FROM room_tags GROUP BY tag");
        while ($r = $stmt->fetch())
            $taxonomy['room_tags'][$r['label']] = $r['count'];

        // 2. Transition Categories
        $stmt = $pdo->query("SELECT category as label, COUNT(*) as count FROM transition_category_links GROUP BY category");
        while ($r = $stmt->fetch())
            $taxonomy['transition_categories'][$r['label']] = $r['count'];

        // 3. Transition Tags
        $stmt = $pdo->query("SELECT tag as label, COUNT(*) as count FROM transition_tags GROUP BY tag");
        while ($r = $stmt->fetch())
            $taxonomy['transition_tags'][$r['label']] = $r['count'];

        // Merge with pre-defined taxonomy (to show labels with 0 count)
        $stmt = $pdo->query("SELECT type, label FROM taxonomy_definitions");
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = $r['type'] . 's'; // room_tag -> room_tags
            if ($r['type'] === 'transition_category')
                $key = 'transition_categories';

            if (!isset($taxonomy[$key][$r['label']])) {
                $taxonomy[$key][$r['label']] = 0;
            }
        }

        echo json_encode($taxonomy);
    }
    elseif ($action === 'export_all') {
        echo json_encode(exportAllData($pdo));
    }
    elseif ($action === 'get_audio') {
        $stmt = $pdo->query("SELECT * FROM audio_library ORDER BY id DESC");
        $audio = $stmt->fetchAll();

        $stmtMap = $pdo->query("SELECT * FROM audio_mappings");
        $mappings = $stmtMap->fetchAll();

        echo json_encode(['library' => $audio, 'mappings' => $mappings]);
    }
    elseif ($action === 'export_transitions') {
        $transitions = [];
        $stmt = $pdo->query("SELECT * FROM transitions");
        while ($row = $stmt->fetch()) {
            $id = $row['id'];
            $trans = [
                'id' => $id,
                'label' => $row['label'],
                'desc' => $row['desc'],
                'categories' => [],
                'tags' => [],
                'texts' => []
            ];

            $stmtCats = $pdo->prepare("SELECT category FROM transition_category_links WHERE transition_id = ?");
            $stmtCats->execute([$id]);
            $trans['categories'] = $stmtCats->fetchAll(PDO::FETCH_COLUMN);

            $stmtTags = $pdo->prepare("SELECT tag FROM transition_tags WHERE transition_id = ?");
            $stmtTags->execute([$id]);
            $trans['tags'] = $stmtTags->fetchAll(PDO::FETCH_COLUMN);

            $stmtTexts = $pdo->prepare("SELECT text, sanity_min, sanity_max, dialogue_id FROM transition_texts WHERE transition_id = ?");
            $stmtTexts->execute([$id]);
            $trans['texts'] = $stmtTexts->fetchAll();

            $transitions[] = $trans;
        }

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="transitions.json"');
        echo json_encode($transitions, JSON_PRETTY_PRINT);
        exit;
    }
    elseif ($action === 'get_terminal_dialogue') {
        $filePath = __DIR__ . '/../terminal_dialogue.json';
        if (file_exists($filePath)) {
            echo file_get_contents($filePath);
        } else {
            echo json_encode((object)[]);
        }
        exit;
    }
    else {
        // Default: get whole world
        echo json_encode(getFullWorld($pdo));
    }
}
elseif ($method === 'POST') {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if ($action === 'save_terminal_dialogue') {
        $filePath = __DIR__ . '/../terminal_dialogue.json';
        $dialogueData = $data['dialogue'] ?? null;
        if ($dialogueData === null) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No dialogue data provided']);
            exit;
        }
        $jsonString = json_encode($dialogueData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($filePath, $jsonString) !== false) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to write terminal dialogue file']);
        }
        exit;
    }
    elseif ($action === 'save_taxonomy_item') {
        $stmt = $pdo->prepare("INSERT OR IGNORE INTO taxonomy_definitions (type, label) VALUES (?, ?)");
        $stmt->execute([$data['type'], $data['label']]);
        echo json_encode(['success' => true]);
    }
    elseif ($action === 'delete_taxonomy_item') {
        // Note: This only deletes the definition, doesn't purge from rooms/transitions for safety
        $stmt = $pdo->prepare("DELETE FROM taxonomy_definitions WHERE type = ? AND label = ?");
        $stmt->execute([$data['type'], $data['label']]);
        echo json_encode(['success' => true]);
    }
    elseif ($action === 'preview_import') {
        try {
            echo json_encode(previewImportData($pdo, $data));
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'import_all') {
        try {
            importAllData($pdo, $data);
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'save_room') {
        $id = $data['id'];
        $room = $data['room'];

        $pdo->beginTransaction();
        try {
            // Update/Insert Room
            $stmt = $pdo->prepare("INSERT INTO rooms (id, name, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, desc=excluded.desc");
            $stmt->execute([$id, $room['name'], $room['desc']]);

            // Clear and rewrite relations
            $pdo->prepare("DELETE FROM room_tags WHERE room_id = ?")->execute([$id]);
            foreach (($room['tags'] ?? []) as $tag) {
                $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
            }

            $pdo->prepare("DELETE FROM room_transitions WHERE room_id = ?")->execute([$id]);
            foreach (($room['transitions'] ?? []) as $transItem) {
                if (is_string($transItem)) {
                    $cat = $transItem;
                    $req = null;
                }
                else {
                    $cat = $transItem['category'];
                    $req = !empty($transItem['requirements']) ? json_encode($transItem['requirements']) : null;
                }
                $pdo->prepare("INSERT INTO room_transitions (room_id, category, requirements) VALUES (?, ?, ?)")->execute([$id, $cat, $req]);
            }

            $pdo->prepare("DELETE FROM room_interactables WHERE room_id = ?")->execute([$id]);
            foreach (($room['interactables'] ?? []) as $interItem) {
                if (is_string($interItem)) {
                    $iid = $interItem;
                    $req = null;
                }
                else {
                    $iid = $interItem['id'];
                    $req = !empty($interItem['requirements']) ? json_encode($interItem['requirements']) : null;
                }
                $pdo->prepare("INSERT INTO room_interactables (room_id, interactable_id, requirements) VALUES (?, ?, ?)")->execute([$id, $iid, $req]);
            }

            $pdo->prepare("DELETE FROM room_texts WHERE room_id = ?")->execute([$id]);
            foreach (($room['texts'] ?? []) as $textObj) {
                $content = is_string($textObj) ? $textObj : ($textObj['text'] ?? '');
                $s_min = (int)($textObj['sanity_min'] ?? 0);
                $s_max = (int)($textObj['sanity_max'] ?? 100);
                $d_id = $textObj['dialogue_id'] ?? null;
                $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")->execute([$id, $content, $s_min, $s_max, $d_id]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'import_rooms') {
        $rooms = $data['rooms'];

        $pdo->beginTransaction();
        try {
            foreach ($rooms as $room) {
                if (empty($room['id']))
                    continue;
                $id = $room['id'];

                // Upsert Room
                $stmt = $pdo->prepare("INSERT INTO rooms (id, name, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, desc=excluded.desc");
                $stmt->execute([$id, $room['name'] ?? '', $room['desc'] ?? '']);

                // Tags
                $pdo->prepare("DELETE FROM room_tags WHERE room_id = ?")->execute([$id]);
                foreach (($room['tags'] ?? []) as $tag) {
                    $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
                }

                // Transitions
                $pdo->prepare("DELETE FROM room_transitions WHERE room_id = ?")->execute([$id]);
                foreach (($room['transitions'] ?? []) as $transItem) {
                    if (is_string($transItem)) {
                        $cat = $transItem;
                        $req = null;
                    }
                    else {
                        $cat = $transItem['category'];
                        $req = !empty($transItem['requirements']) ? json_encode($transItem['requirements']) : null;
                    }
                    $pdo->prepare("INSERT INTO room_transitions (room_id, category, requirements) VALUES (?, ?, ?)")->execute([$id, $cat, $req]);
                }

                // Interactables
                $pdo->prepare("DELETE FROM room_interactables WHERE room_id = ?")->execute([$id]);
                foreach (($room['interactables'] ?? []) as $interItem) {
                    if (is_string($interItem)) {
                        $iid = $interItem;
                        $req = null;
                    }
                    else {
                        $iid = $interItem['id'];
                        $req = !empty($interItem['requirements']) ? json_encode($interItem['requirements']) : null;
                    }
                    $pdo->prepare("INSERT INTO room_interactables (room_id, interactable_id, requirements) VALUES (?, ?, ?)")->execute([$id, $iid, $req]);
                }

                // Texts
                $pdo->prepare("DELETE FROM room_texts WHERE room_id = ?")->execute([$id]);
                foreach (($room['texts'] ?? []) as $textObj) {
                    $content = is_string($textObj) ? $textObj : ($textObj['text'] ?? '');
                    $s_min = (int)($textObj['sanity_min'] ?? 0);
                    $s_max = (int)($textObj['sanity_max'] ?? 100);
                    $d_id = $textObj['dialogue_id'] ?? null;
                    $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")->execute([$id, $content, $s_min, $s_max, $d_id]);
                }
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'import_transitions') {
        $transitions = $data['transitions'];

        $pdo->beginTransaction();
        try {
            foreach ($transitions as $trans) {
                if (empty($trans['id']))
                    continue;
                $id = $trans['id'];
                $cat = $trans['category'];

                // Upsert Transition
                $stmt = $pdo->prepare("INSERT INTO transitions (id, label, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, desc=excluded.desc");
                $stmt->execute([$id, $trans['label'] ?? '', $trans['desc'] ?? '']);

                // Categories
                $pdo->prepare("DELETE FROM transition_category_links WHERE transition_id = ?")->execute([$id]);
                $cats = (isset($trans['categories']) ? (array)$trans['categories'] : (isset($trans['category']) ? [$trans['category']] : []));
                foreach ($cats as $cat) {
                    $pdo->prepare("INSERT OR IGNORE INTO transition_category_links (transition_id, category) VALUES (?, ?)")->execute([$id, $cat]);
                }

                // Tags
                $pdo->prepare("DELETE FROM transition_tags WHERE transition_id = ?")->execute([$id]);
                foreach (($trans['tags'] ?? []) as $tag) {
                    $pdo->prepare("INSERT INTO transition_tags (transition_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
                }

                // Texts
                $pdo->prepare("DELETE FROM transition_texts WHERE transition_id = ?")->execute([$id]);
                foreach (($trans['texts'] ?? []) as $textObj) {
                    $content = is_string($textObj) ? $textObj : ($textObj['text'] ?? '');
                    $s_min = (int)($textObj['sanity_min'] ?? 0);
                    $s_max = (int)($textObj['sanity_max'] ?? 100);
                    $d_id = $textObj['dialogue_id'] ?? null;
                    $pdo->prepare("INSERT INTO transition_texts (transition_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")->execute([$id, $content, $s_min, $s_max, $d_id]);
                }
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'save_interactable') {
        $inter = $data['interactable'];
        $id = $data['id']; // Unique ID

        $pdo->beginTransaction();
        try {
            // Upsert Interactable
            $stmt = $pdo->prepare("INSERT INTO interactables (id, label, current_state_index) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET label=excluded.label");
            $stmt->execute([$id, $inter['label'], $inter['current_state_index'] ?? 0]);

            // Rewrite states
            $pdo->prepare("DELETE FROM interactable_states WHERE interactable_id = ?")->execute([$id]);
            foreach (($inter['states'] ?? []) as $idx => $state) {
                $stmtState = $pdo->prepare("INSERT INTO interactable_states (interactable_id, state_id, desc, image, sort_order, effects) VALUES (?, ?, ?, ?, ?, ?)");
                $effects = !empty($state['effects']) ? json_encode($state['effects']) : null;
                $stmtState->execute([$id, $state['id'], $state['desc'], $state['image'] ?? null, $idx, $effects]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'delete_interactable') {
        $id = $data['id'];
        try {
            $pdo->prepare("DELETE FROM interactables WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'delete_room') {
        $id = $data['id'];
        try {
            $pdo->prepare("DELETE FROM rooms WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'save_transition') {
        $trans = $data['transition'];
        $id = $data['id']; // Transition ID (e.g. lift_01)

        $pdo->beginTransaction();
        try {
            // Upsert Transition
            $stmt = $pdo->prepare("INSERT INTO transitions (id, label, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, desc=excluded.desc");
            $stmt->execute([$id, $trans['label'], $trans['desc']]);

            // Rewrite Categories
            $pdo->prepare("DELETE FROM transition_category_links WHERE transition_id = ?")->execute([$id]);
            foreach (($trans['categories'] ?? []) as $cat) {
                $pdo->prepare("INSERT OR IGNORE INTO transition_category_links (transition_id, category) VALUES (?, ?)")->execute([$id, $cat]);
            }

            // Rewrite tags
            $pdo->prepare("DELETE FROM transition_tags WHERE transition_id = ?")->execute([$id]);
            foreach (($trans['tags'] ?? []) as $tag) {
                $pdo->prepare("INSERT INTO transition_tags (transition_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
            }

            // Rewrite texts
            $pdo->prepare("DELETE FROM transition_texts WHERE transition_id = ?")->execute([$id]);
            foreach (($trans['texts'] ?? []) as $textObj) {
                $content = is_string($textObj) ? $textObj : ($textObj['text'] ?? '');
                $s_min = (int)($textObj['sanity_min'] ?? 0);
                $s_max = (int)($textObj['sanity_max'] ?? 100);
                $d_id = $textObj['dialogue_id'] ?? null;
                $pdo->prepare("INSERT INTO transition_texts (transition_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")->execute([$id, $content, $s_min, $s_max, $d_id]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'delete_transition') {
        $id = $data['id'];
        $pdo->beginTransaction();
        try {
            $pdo->prepare("DELETE FROM room_transitions WHERE category = (SELECT category FROM transitions WHERE id = ?)")->execute([$id]);
            $pdo->prepare("DELETE FROM transitions WHERE id = ?")->execute([$id]);
            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'upload_media') {
        try {
            if (isset($_FILES['file'])) {
                $file = $_FILES['file'];
                $pathInfo = pathinfo($file['name']);
                $originalName = $pathInfo['filename'];
                $ext = strtolower($pathInfo['extension'] ?? '');

                $allowedImageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                $allowedAudioExts = ['mp3', 'wav', 'ogg', 'm4a'];
                $isAudio = in_array($ext, $allowedAudioExts);
                $isImage = in_array($ext, $allowedImageExts);

                if (!$isAudio && !$isImage) {
                    throw new Exception("Invalid file extension: $ext. Allowed formats: " . implode(', ', array_merge($allowedImageExts, $allowedAudioExts)));
                }

                // Clean original name (remove non-alphanumeric except underscores/dashes)
                $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $originalName);
                $filename = $cleanName . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;

                $targetSubdir = $isAudio ? 'sound_effects/' : 'uploads/';
                $dest = $mediaDir . '/' . $targetSubdir . $filename;

                if (move_uploaded_file($file['tmp_name'], $dest)) {
                    if (!$isAudio) {
                        // Process versions for images
                        if (!processImage($dest, $filename)) {
                            // Clean up file if processing failed
                            if (file_exists($dest)) {
                                @unlink($dest);
                            }
                            throw new Exception("Image processing failed for $filename. Check GD library and directory permissions.");
                        }

                        $stmt = $pdo->prepare("INSERT INTO media_library (filename, filepath, context_type, context_id, tags) VALUES (?, ?, ?, ?, ?)");
                        $stmt->execute([$filename, 'media/uploads/' . $filename, $_POST['type'] ?? 'none', $_POST['context_id'] ?? 'none', $_POST['tags'] ?? '']);
                    }
                    else {
                        // Audio Library
                        $stmt = $pdo->prepare("INSERT INTO audio_library (filename, filepath, tags, category) VALUES (?, ?, ?, ?)");
                        $stmt->execute([$filename, 'media/sound_effects/' . $filename, $_POST['tags'] ?? '', $_POST['category'] ?? 'sfx']);
                    }
                    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'path' => 'media/' . $targetSubdir . $filename]);
                }
                else {
                    throw new Exception("Failed to move uploaded file to destination: $dest");
                }
            }
            else {
                throw new Exception("No file received in request.");
            }
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'delete_media') {
        $id = $data['id'];
        try {
            $pdo->prepare("DELETE FROM media_library WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'assign_image') {
        // Assign existing media to a context
        $stmt = $pdo->prepare("UPDATE media_library SET context_type = ?, context_id = ?, tags = ? WHERE id = ?");
        $stmt->execute([$data['type'], $data['context_id'], $data['tags'], $data['media_id']]);
        echo json_encode(['success' => true]);
    }
    elseif ($action === 'save_audio_mapping') {
        $pdo->beginTransaction();
        try {
            $m = $data['mapping'];
            // Check if mapping exists for this context
            $stmt = $pdo->prepare("DELETE FROM audio_mappings WHERE mapping_type = ? AND context_id = ?");
            $stmt->execute([$m['mapping_type'], $m['context_id']]);

            if (!empty($m['audio_file_id'])) {
                $stmt = $pdo->prepare("INSERT INTO audio_mappings (mapping_type, context_id, audio_file_id, volume, loop) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$m['mapping_type'], $m['context_id'], $m['audio_file_id'], $m['volume'] ?? 0.5, $m['loop'] ?? 0]);
            }

            $pdo->commit();
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    elseif ($action === 'delete_audio') {
        $id = $data['id'];
        try {
            $pdo->prepare("DELETE FROM audio_library WHERE id = ?")->execute([$id]);
            echo json_encode(['success' => true]);
        }
        catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    else {
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
    }
}

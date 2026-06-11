<?php
session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Strict',
    'cookie_secure' => isset($_SERVER['HTTPS'])
]);

// 1. Session Auth check
if (php_sapi_name() !== 'cli') {
    if (!isset($_SESSION['admin_auth']) || $_SESSION['admin_auth'] !== true) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

header('Content-Type: application/json');

$results = [];
$total = 0;
$passed = 0;
$failed = 0;

function assertTest($name, $callback) {
    global $results, $total, $passed, $failed;
    $total++;
    try {
        $msg = $callback();
        $results[] = [
            'name' => $name,
            'status' => 'passed',
            'message' => $msg ?: 'Assertion passed successfully.'
        ];
        $passed++;
    } catch (Throwable $e) {
        $results[] = [
            'name' => $name,
            'status' => 'failed',
            'message' => $e->getMessage()
        ];
        $failed++;
    }
}

$dbFile = __DIR__ . '/../world_data/database.sqlite';

// Test 1: SQLite Database File Existence
assertTest('SQLite Database File Existence', function() use ($dbFile) {
    if (!file_exists($dbFile)) {
        throw new Exception("Database file not found at " . realpath($dbFile));
    }
    return "Database file is located at: " . basename($dbFile) . " (" . size_format(filesize($dbFile)) . ")";
});

function size_format($bytes) {
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 2) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 2) . ' KB';
    return $bytes . ' B';
}

// Test 2: Database Connection & Configuration
assertTest('Database Connection & Configuration', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check foreign keys
    $pdo->exec("PRAGMA foreign_keys = ON;");
    $fk = $pdo->query("PRAGMA foreign_keys")->fetchColumn();
    if (!$fk) {
        throw new Exception("Foreign keys are disabled in SQLite.");
    }
    
    $version = $pdo->query("SELECT sqlite_version()")->fetchColumn();
    return "Connected successfully. SQLite version: " . $version . " | Foreign Keys: ACTIVE";
});

// Test 3: Database Schema Check
assertTest('Database Schema Integrity', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $tables = [
        'rooms', 'room_tags', 'room_transitions', 'room_interactables', 
        'room_texts', 'interactables', 'interactable_states', 'transitions',
        'transition_tags', 'transition_texts', 'transition_category_links', 
        'audio_library', 'audio_mappings', 'media_library'
    ];
    
    $missing = [];
    foreach ($tables as $t) {
        $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
        $stmt->execute([$t]);
        if (!$stmt->fetchColumn()) {
            $missing[] = $t;
        }
    }
    
    if (!empty($missing)) {
        throw new Exception("Missing tables: " . implode(', ', $missing));
    }
    return "All " . count($tables) . " core tables verified in the database schema.";
});

// Test 4: Relational Cascading Deletes (Transaction rollbacked)
assertTest('Relational Cascading Deletion (ON DELETE CASCADE)', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    $pdo->beginTransaction();
    try {
        $roomId = '__diag_test_room_99__';
        
        // Insert Room
        $pdo->prepare("INSERT OR REPLACE INTO rooms (id, name, desc) VALUES (?, ?, ?)")
            ->execute([$roomId, 'Diag Test Room', 'Unit test temporary room']);
            
        // Insert room dependencies
        $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$roomId, 'diag_tag']);
        $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max) VALUES (?, ?, ?, ?)")
            ->execute([$roomId, 'Diag room text snippet', 0, 100]);
        $pdo->prepare("INSERT INTO room_transitions (room_id, category, requirements) VALUES (?, ?, ?)")
            ->execute([$roomId, 'diag_category', null]);
            
        // Confirm insertion
        $tagCount = $pdo->query("SELECT COUNT(*) FROM room_tags WHERE room_id = '{$roomId}'")->fetchColumn();
        $textCount = $pdo->query("SELECT COUNT(*) FROM room_texts WHERE room_id = '{$roomId}'")->fetchColumn();
        $transCount = $pdo->query("SELECT COUNT(*) FROM room_transitions WHERE room_id = '{$roomId}'")->fetchColumn();
        
        if ($tagCount != 1 || $textCount != 1 || $transCount != 1) {
            throw new Exception("Prerequisite insert of room dependencies failed.");
        }
        
        // Delete Room
        $pdo->prepare("DELETE FROM rooms WHERE id = ?")->execute([$roomId]);
        
        // Verify Cascade
        $tagCountAfter = $pdo->query("SELECT COUNT(*) FROM room_tags WHERE room_id = '{$roomId}'")->fetchColumn();
        $textCountAfter = $pdo->query("SELECT COUNT(*) FROM room_texts WHERE room_id = '{$roomId}'")->fetchColumn();
        $transCountAfter = $pdo->query("SELECT COUNT(*) FROM room_transitions WHERE room_id = '{$roomId}'")->fetchColumn();
        
        if ($tagCountAfter != 0 || $textCountAfter != 0 || $transCountAfter != 0) {
            throw new Exception("Cascade failed! Remaining child records: tags={$tagCountAfter}, texts={$textCountAfter}, transitions={$transCountAfter}");
        }
        
        return "Verified: Deleting a room successfully purges dependent tags, texts, and transitions.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 5: Disk File Cleanup Triggers (AFTER DELETE ON media_library)
assertTest('File System Garbage Collection Trigger', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Register custom function locally
    function test_delete_file_on_disk_runner($path) {
        if (empty($path)) return;
        $absPath = __DIR__ . '/../' . $path;
        if (file_exists($absPath)) {
            @unlink($absPath);
        }
    }
    if (method_exists($pdo, 'createFunction')) {
        $pdo->createFunction('delete_file_on_disk', 'test_delete_file_on_disk_runner', 1);
    } else {
        @$pdo->sqliteCreateFunction('delete_file_on_disk', 'test_delete_file_on_disk_runner', 1);
    }

    $dummyRel = 'media/uploads/__unit_test_dummy_file__.jpg';
    $dummyAbs = __DIR__ . '/../' . $dummyRel;
    
    @mkdir(dirname($dummyAbs), 0777, true);
    file_put_contents($dummyAbs, 'unit test content');
    
    if (!file_exists($dummyAbs)) {
        throw new Exception("Unable to create mock file for trigger test.");
    }
    
    try {
        $pdo->prepare("INSERT INTO media_library (filename, filepath, context_type, context_id) VALUES (?, ?, ?, ?)")
            ->execute(['__unit_test_dummy_file__.jpg', $dummyRel, 'room', 'test_room']);
        
        $mediaId = $pdo->lastInsertId();
        
        // Delete the database row
        $pdo->prepare("DELETE FROM media_library WHERE id = ?")->execute([$mediaId]);
        
        // Verify disk
        if (file_exists($dummyAbs)) {
            throw new Exception("SQLite AFTER DELETE trigger fired, but file was not deleted from disk.");
        }
        
        return "Verified: Deleting media library database record automatically removes physical file from server storage.";
    } finally {
        // Safe fallback cleanup
        if (file_exists($dummyAbs)) {
            @unlink($dummyAbs);
        }
    }
});

// Test 6: World Data Graph Integrity
assertTest('World Data Graph & Reference Integrity', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Fetch all rooms
    $rooms = $pdo->query("SELECT id FROM rooms")->fetchAll(PDO::FETCH_COLUMN);
    if (empty($rooms)) {
        return "No rooms defined in database to validate graph references.";
    }
    
    // Check room transitions reference categories that exist
    $stmt = $pdo->query("SELECT room_id, category FROM room_transitions");
    $orphanTransitions = 0;
    while ($row = $stmt->fetch()) {
        $cat = $row['category'];
        // check if this category exists in links or taxonomy
        $check = $pdo->prepare("SELECT COUNT(*) FROM transition_category_links WHERE category = ?");
        $check->execute([$cat]);
        if ($check->fetchColumn() == 0 && $cat !== 'universal') {
            $orphanTransitions++;
        }
    }
    
    // Check room interactables reference interactables that exist
    $stmt = $pdo->query("SELECT room_id, interactable_id FROM room_interactables");
    $orphanInteractables = 0;
    while ($row = $stmt->fetch()) {
        $check = $pdo->prepare("SELECT COUNT(*) FROM interactables WHERE id = ?");
        $check->execute([$row['interactable_id']]);
        if ($check->fetchColumn() == 0) {
            $orphanInteractables++;
        }
    }
    
    if ($orphanTransitions > 0 || $orphanInteractables > 0) {
        throw new Exception("Graph has inconsistencies: {$orphanTransitions} orphaned transitions, {$orphanInteractables} orphaned interactable links.");
    }
    
    return "Success: " . count($rooms) . " rooms analyzed. References and room-to-object bindings are 100% consistent.";
});

echo json_encode([
    'success' => ($failed === 0),
    'summary' => [
        'total' => $total,
        'passed' => $passed,
        'failed' => $failed
    ],
    'results' => $results
]);

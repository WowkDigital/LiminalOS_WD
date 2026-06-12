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

// Test 7: Room Saving & Modification Operations
assertTest('Room Saving & Modification Operations', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    $pdo->beginTransaction();
    try {
        $roomId = '__test_edit_room_id__';
        
        // 1. Initial Save
        $roomData = [
            'name' => 'Initial Room Name',
            'desc' => 'Initial Room Description',
            'tags' => ['tag1', 'tag2'],
            'transitions' => [
                ['category' => 'hallway', 'requirements' => ['sanity_min' => 20]]
            ],
            'interactables' => [
                ['id' => 'panel_1', 'requirements' => null]
            ],
            'texts' => [
                ['text' => 'Some room text', 'sanity_min' => 10, 'sanity_max' => 90, 'dialogue_id' => 'd_1']
            ]
        ];
        
        // Insert Mock Interactable dependency to satisfy foreign key constraint
        $pdo->prepare("INSERT OR REPLACE INTO interactables (id, label, current_state_index) VALUES ('panel_1', 'Mock Panel', 0)")->execute();

        // Run database upsert
        $pdo->prepare("INSERT INTO rooms (id, name, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, desc=excluded.desc")
            ->execute([$roomId, $roomData['name'], $roomData['desc']]);
            
        foreach ($roomData['tags'] as $tag) {
            $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$roomId, $tag]);
        }
        
        foreach ($roomData['transitions'] as $trans) {
            $pdo->prepare("INSERT INTO room_transitions (room_id, category, requirements) VALUES (?, ?, ?)")
                ->execute([$roomId, $trans['category'], json_encode($trans['requirements'])]);
        }
        
        foreach ($roomData['interactables'] as $inter) {
            $pdo->prepare("INSERT INTO room_interactables (room_id, interactable_id, requirements) VALUES (?, ?, ?)")
                ->execute([$roomId, $inter['id'], null]);
        }
        
        foreach ($roomData['texts'] as $txt) {
            $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")
                ->execute([$roomId, $txt['text'], $txt['sanity_min'], $txt['sanity_max'], $txt['dialogue_id']]);
        }
        
        // 2. Modify values and Save again
        $modifiedData = [
            'name' => 'Modified Room Name',
            'desc' => 'Modified Room Description',
            'tags' => ['tag2', 'tag3'], // tag1 is removed, tag3 is added
            'transitions' => [], // transitions removed
            'interactables' => [], // interactables removed
            'texts' => [
                ['text' => 'New text snippet', 'sanity_min' => 0, 'sanity_max' => 100, 'dialogue_id' => null]
            ]
        ];
        
        // Perform edit operations
        $pdo->prepare("INSERT INTO rooms (id, name, desc) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, desc=excluded.desc")
            ->execute([$roomId, $modifiedData['name'], $modifiedData['desc']]);
            
        $pdo->prepare("DELETE FROM room_tags WHERE room_id = ?")->execute([$roomId]);
        foreach ($modifiedData['tags'] as $tag) {
            $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$roomId, $tag]);
        }
        
        $pdo->prepare("DELETE FROM room_transitions WHERE room_id = ?")->execute([$roomId]);
        $pdo->prepare("DELETE FROM room_interactables WHERE room_id = ?")->execute([$roomId]);
        
        $pdo->prepare("DELETE FROM room_texts WHERE room_id = ?")->execute([$roomId]);
        foreach ($modifiedData['texts'] as $txt) {
            $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")
                ->execute([$roomId, $txt['text'], $txt['sanity_min'], $txt['sanity_max'], $txt['dialogue_id']]);
        }
        
        // 3. Assertions
        $room = $pdo->query("SELECT * FROM rooms WHERE id = '{$roomId}'")->fetch();
        if ($room['name'] !== 'Modified Room Name' || $room['desc'] !== 'Modified Room Description') {
            throw new Exception("Room name/description failed to update.");
        }
        
        $tags = $pdo->query("SELECT tag FROM room_tags WHERE room_id = '{$roomId}'")->fetchAll(PDO::FETCH_COLUMN);
        sort($tags);
        if ($tags !== ['tag2', 'tag3']) {
            throw new Exception("Room tags failed to rewrite correctly: " . json_encode($tags));
        }
        
        $transCount = $pdo->query("SELECT COUNT(*) FROM room_transitions WHERE room_id = '{$roomId}'")->fetchColumn();
        if ($transCount != 0) {
            throw new Exception("Old transitions were not cleared.");
        }
        
        $texts = $pdo->query("SELECT text, dialogue_id FROM room_texts WHERE room_id = '{$roomId}'")->fetchAll();
        if (count($texts) !== 1 || $texts[0]['text'] !== 'New text snippet' || $texts[0]['dialogue_id'] !== null) {
            throw new Exception("Room texts failed to rewrite correctly: " . json_encode($texts));
        }
        
        return "Room creation, data rewrite, and relationship clean-up edits passed validation.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 8: Interactable State Effects Validation
assertTest('Interactable State Effects Compliance', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    $pdo->beginTransaction();
    try {
        $interId = '__test_effect_interactable__';
        
        // Mock payload with standard sanity and state_change effects
        $effectsData = [
            'sanity' => -15,
            'state_change' => [
                'target_id' => 'generator_01',
                'target_state' => 'active'
            ],
            'sound' => 'sparks_sfx'
        ];
        
        // Insert Interactable
        $pdo->prepare("INSERT INTO interactables (id, label, current_state_index) VALUES (?, ?, ?)")
            ->execute([$interId, 'Test Interactable with Effects', 0]);
            
        // Insert State with effects field
        $pdo->prepare("INSERT INTO interactable_states (interactable_id, state_id, desc, sort_order, effects) VALUES (?, ?, ?, ?, ?)")
            ->execute([$interId, 'active_state', 'State description', 0, json_encode($effectsData)]);
            
        // Retrieve and parse effects
        $storedEffectsJson = $pdo->query("SELECT effects FROM interactable_states WHERE interactable_id = '{$interId}' AND state_id = 'active_state'")->fetchColumn();
        if (empty($storedEffectsJson)) {
            throw new Exception("Effects failed to insert or returned empty.");
        }
        
        $parsed = json_decode($storedEffectsJson, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Inserted effects field contains malformed JSON.");
        }
        
        if ($parsed['sanity'] !== -15 || $parsed['state_change']['target_id'] !== 'generator_01' || $parsed['sound'] !== 'sparks_sfx') {
            throw new Exception("Decoded effects data mismatch.");
        }
        
        // Audit existing database effects for JSON compliance
        $stmt = $pdo->query("SELECT interactable_id, state_id, effects FROM interactable_states WHERE effects IS NOT NULL");
        $corruptCount = 0;
        while ($row = $stmt->fetch()) {
            json_decode($row['effects']);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $corruptCount++;
            }
        }
        
        if ($corruptCount > 0) {
            throw new Exception("Database audit failed: Found {$corruptCount} interactable state records with invalid JSON in 'effects' field.");
        }
        
        return "Effects payload inserts, decodes, and database JSON integrity audited successfully.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 9: Audio Mappings & Cascading Deletion
assertTest('Audio Mapping Cascade Deletion (ON DELETE CASCADE)', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    // Register custom function to satisfy delete trigger without doing actual deletes
    $dummy_fn = function($path) {};
    if (method_exists($pdo, 'createFunction')) {
        $pdo->createFunction('delete_file_on_disk', $dummy_fn, 1);
    } else {
        @$pdo->sqliteCreateFunction('delete_file_on_disk', $dummy_fn, 1);
    }
    
    $pdo->beginTransaction();
    try {
        // 1. Insert dummy audio file
        $pdo->prepare("INSERT INTO audio_library (filename, filepath, tags, category) VALUES (?, ?, ?, ?)")
            ->execute(['__unit_test_audio__.mp3', 'media/sound_effects/__unit_test_audio__.mp3', 'test', 'sfx']);
        $audioId = $pdo->lastInsertId();
        
        // 2. Insert mapping referencing that audio
        $pdo->prepare("INSERT INTO audio_mappings (mapping_type, context_id, audio_file_id, volume, loop) VALUES (?, ?, ?, ?, ?)")
            ->execute(['room', 'lobby', $audioId, 0.7, 1]);
        $mappingId = $pdo->lastInsertId();
        
        // Confirm insertion
        $mappingCount = $pdo->query("SELECT COUNT(*) FROM audio_mappings WHERE id = {$mappingId}")->fetchColumn();
        if ($mappingCount != 1) {
            throw new Exception("Prerequisite insert of audio mapping failed.");
        }
        
        // 3. Delete audio library record
        $pdo->prepare("DELETE FROM audio_library WHERE id = ?")->execute([$audioId]);
        
        // 4. Verify cascade
        $mappingCountAfter = $pdo->query("SELECT COUNT(*) FROM audio_mappings WHERE id = {$mappingId}")->fetchColumn();
        if ($mappingCountAfter != 0) {
            throw new Exception("Cascade failed! Audio mapping record still exists after deleting referenced audio file.");
        }
        
        return "Verified: Deleting an audio library record successfully cascades to purge dependent audio mapping constraints.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 10: Transition Saving & Modification Operations
assertTest('Transition Saving & Modification Operations', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("PRAGMA foreign_keys = ON;");
    
    $pdo->beginTransaction();
    try {
        $transId = '__test_edit_trans_id__';
        
        // 1. Initial Save
        $transData = [
            'label' => 'Initial Transition Label',
            'desc' => 'Initial Transition Description',
            'effects' => ['sanity' => -5],
            'categories' => ['hallway', 'vent'],
            'tags' => ['tag_a', 'tag_b'],
            'texts' => [
                ['text' => 'Transition text snippet', 'sanity_min' => 0, 'sanity_max' => 100, 'dialogue_id' => 'd_trans_1']
            ]
        ];
        
        $pdo->prepare("INSERT INTO transitions (id, label, desc, effects) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, desc=excluded.desc, effects=excluded.effects")
            ->execute([$transId, $transData['label'], $transData['desc'], json_encode($transData['effects'])]);
            
        foreach ($transData['categories'] as $cat) {
            $pdo->prepare("INSERT OR IGNORE INTO transition_category_links (transition_id, category) VALUES (?, ?)")->execute([$transId, $cat]);
        }
        
        foreach ($transData['tags'] as $tag) {
            $pdo->prepare("INSERT INTO transition_tags (transition_id, tag) VALUES (?, ?)")->execute([$transId, $tag]);
        }
        
        foreach ($transData['texts'] as $txt) {
            $pdo->prepare("INSERT INTO transition_texts (transition_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")
                ->execute([$transId, $txt['text'], $txt['sanity_min'], $txt['sanity_max'], $txt['dialogue_id']]);
        }
        
        // Verify insert
        $catCount = $pdo->query("SELECT COUNT(*) FROM transition_category_links WHERE transition_id = '{$transId}'")->fetchColumn();
        if ($catCount != 2) {
            throw new Exception("Categories failed to insert.");
        }
        
        // 2. Modify values and save again
        $modifiedData = [
            'label' => 'Modified Transition Label',
            'desc' => 'Modified Transition Description',
            'effects' => null,
            'categories' => ['vent'], // hallway category removed
            'tags' => ['tag_b', 'tag_c'], // tag_a removed, tag_c added
            'texts' => [] // all texts removed
        ];
        
        $pdo->prepare("INSERT INTO transitions (id, label, desc, effects) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, desc=excluded.desc, effects=excluded.effects")
            ->execute([$transId, $modifiedData['label'], $modifiedData['desc'], null]);
            
        $pdo->prepare("DELETE FROM transition_category_links WHERE transition_id = ?")->execute([$transId]);
        foreach ($modifiedData['categories'] as $cat) {
            $pdo->prepare("INSERT OR IGNORE INTO transition_category_links (transition_id, category) VALUES (?, ?)")->execute([$transId, $cat]);
        }
        
        $pdo->prepare("DELETE FROM transition_tags WHERE transition_id = ?")->execute([$transId]);
        foreach ($modifiedData['tags'] as $tag) {
            $pdo->prepare("INSERT INTO transition_tags (transition_id, tag) VALUES (?, ?)")->execute([$transId, $tag]);
        }
        
        $pdo->prepare("DELETE FROM transition_texts WHERE transition_id = ?")->execute([$transId]);
        
        // 3. Assertions
        $trans = $pdo->query("SELECT * FROM transitions WHERE id = '{$transId}'")->fetch();
        if ($trans['label'] !== 'Modified Transition Label' || $trans['desc'] !== 'Modified Transition Description' || $trans['effects'] !== null) {
            throw new Exception("Transition fields failed to update correctly.");
        }
        
        $cats = $pdo->query("SELECT category FROM transition_category_links WHERE transition_id = '{$transId}'")->fetchAll(PDO::FETCH_COLUMN);
        if ($cats !== ['vent']) {
            throw new Exception("Transition categories failed to update: " . json_encode($cats));
        }
        
        $tags = $pdo->query("SELECT tag FROM transition_tags WHERE transition_id = '{$transId}'")->fetchAll(PDO::FETCH_COLUMN);
        sort($tags);
        if ($tags !== ['tag_b', 'tag_c']) {
            throw new Exception("Transition tags failed to update: " . json_encode($tags));
        }
        
        $textCount = $pdo->query("SELECT COUNT(*) FROM transition_texts WHERE transition_id = '{$transId}'")->fetchColumn();
        if ($textCount != 0) {
            throw new Exception("Transition texts failed to clear.");
        }
        
        return "Transition creation, field updates, and child list rewrites passed validation.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 11: Taxonomy Definitions Uniqueness & Operations
assertTest('Taxonomy Definitions Uniqueness & Constraints', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();
    try {
        // 1. Insert a tag definition
        $pdo->prepare("INSERT INTO taxonomy_definitions (type, label) VALUES (?, ?)")
            ->execute(['room_tag', '__diag_temp_tag__']);
            
        // 2. Assert unique constraint
        $uniqueViolated = false;
        try {
            $pdo->prepare("INSERT INTO taxonomy_definitions (type, label) VALUES (?, ?)")
                ->execute(['room_tag', '__diag_temp_tag__']);
        } catch (PDOException $e) {
            $uniqueViolated = true;
        }
        
        if (!$uniqueViolated) {
            throw new Exception("Failed to enforce UNIQUE constraint on taxonomy label.");
        }
        
        // 3. Delete definition
        $pdo->prepare("DELETE FROM taxonomy_definitions WHERE type = ? AND label = ?")
            ->execute(['room_tag', '__diag_temp_tag__']);
            
        $count = $pdo->query("SELECT COUNT(*) FROM taxonomy_definitions WHERE label = '__diag_temp_tag__'")->fetchColumn();
        if ($count != 0) {
            throw new Exception("Taxonomy record deletion failed.");
        }
        
        return "Verified: Taxonomy UNIQUE constraints and basic CRUD operations perform correctly.";
    } finally {
        $pdo->rollBack();
    }
});

// Test 12: Terminal Dialogue Configuration Integrity
assertTest('Terminal Dialogue Configuration Integrity', function() {
    $filePath = __DIR__ . '/../terminal_dialogue.json';
    if (!file_exists($filePath)) {
        throw new Exception("terminal_dialogue.json file does not exist in the root workspace.");
    }
    
    $rawContent = file_get_contents($filePath);
    $dialogue = json_decode($rawContent, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("terminal_dialogue.json is not valid JSON. Error: " . json_last_error_msg());
    }
    
    if (empty($dialogue)) {
        throw new Exception("terminal_dialogue.json is empty.");
    }
    
    // Check key requirements for nodes
    $validKeys = array_keys($dialogue);
    foreach ($dialogue as $key => $node) {
        if (!isset($node['text']) || !is_string($node['text'])) {
            throw new Exception("Dialogue node '{$key}' is missing required 'text' string.");
        }
        
        if (isset($node['options'])) {
            if (!is_array($node['options'])) {
                throw new Exception("Options in node '{$key}' must be an array.");
            }
            foreach ($node['options'] as $idx => $opt) {
                if (!isset($opt['label']) || !is_string($opt['label'])) {
                    throw new Exception("Option index {$idx} in node '{$key}' is missing a 'label' string.");
                }
                if (!isset($opt['next']) || !is_string($opt['next'])) {
                    throw new Exception("Option index {$idx} in node '{$key}' is missing a 'next' state string.");
                }
                
                $nextState = $opt['next'];
                // Check if target state exists in the dialogue, or is a dynamic system keyword
                $allowedSpecialKeywords = ['INITIAL', 'WANDER', 'ROOM_LOBBY'];
                if (!in_array($nextState, $validKeys) && !in_array($nextState, $allowedSpecialKeywords)) {
                    throw new Exception("Option '{$opt['label']}' in node '{$key}' references non-existent state '{$nextState}'.");
                }
            }
        }
    }
    
    return "terminal_dialogue.json format is valid and references are 100% consistent across " . count($validKeys) . " dialogue nodes.";
});

// Test 13: Database Effects Column JSON Compliance Audit
assertTest('Database Effects Columns JSON Integrity', function() use ($dbFile) {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 1. Audit rooms effects
    $stmt = $pdo->query("SELECT id, name, effects FROM rooms WHERE effects IS NOT NULL AND effects != ''");
    $corruptRooms = [];
    while ($row = $stmt->fetch()) {
        json_decode($row['effects']);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $corruptRooms[] = $row['id'] . " ('" . $row['name'] . "')";
        }
    }
    
    // 2. Audit transitions effects
    $stmt = $pdo->query("SELECT id, label, effects FROM transitions WHERE effects IS NOT NULL AND effects != ''");
    $corruptTransitions = [];
    while ($row = $stmt->fetch()) {
        json_decode($row['effects']);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $corruptTransitions[] = $row['id'] . " ('" . $row['label'] . "')";
        }
    }
    
    if (!empty($corruptRooms) || !empty($corruptTransitions)) {
        $msg = "";
        if (!empty($corruptRooms)) {
            $msg .= "Malformed effects JSON in rooms: " . implode(', ', $corruptRooms) . ". ";
        }
        if (!empty($corruptTransitions)) {
            $msg .= "Malformed effects JSON in transitions: " . implode(', ', $corruptTransitions) . ". ";
        }
        throw new Exception($msg);
    }
    
    return "Verified: All stored Room and Transition effect payloads in the database contain valid JSON structures.";
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

<?php
// tools/db_diagnose.php
header('Content-Type: text/plain');
echo "=== LiminalOS System Diagnostics ===\n\n";

// 1. PHP & Environment Check
echo "--- PHP Environment ---\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Loaded php.ini: " . (php_ini_loaded_file() ?: "None") . "\n";
echo "GD extension: " . (extension_loaded('gd') ? "LOADED" : "NOT LOADED") . "\n";
if (extension_loaded('gd')) {
    $info = gd_info();
    echo "JPEG Support: " . ($info['JPEG Support'] ? "YES" : "NO") . "\n";
}
echo "\n";

// 2. Database Connection
$dbFile = __DIR__ . '/../world_data/database.sqlite';
echo "--- Database Connection ---\n";
echo "Database Path: " . realpath($dbFile) . "\n";
if (!file_exists($dbFile)) {
    echo "ERROR: Database file does not exist!\n";
    exit;
}

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connection: SUCCESSFUL\n\n";

    // 3. List Tables
    echo "--- Database Tables ---\n";
    $tables = [];
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $tables[] = $row['name'];
        echo "- " . $row['name'] . "\n";
    }
    echo "\n";

    // 4. Schema Details
    echo "--- Table Schemas ---\n";
    foreach (['rooms', 'room_transitions', 'room_interactables', 'room_texts', 'transition_texts'] as $table) {
        if (in_array($table, $tables)) {
            echo "Table: $table\n";
            $res = $pdo->query("PRAGMA table_info($table)");
            while ($r = $res->fetch(PDO::FETCH_ASSOC)) {
                echo "  - " . $r['name'] . " (" . $r['type'] . ")\n";
            }
        } else {
            echo "Table: $table (DOES NOT EXIST)\n";
        }
    }
    echo "\n";

    // 5. App Data Stats
    echo "--- Database Stats & Categories ---\n";
    if (in_array('room_transitions', $tables)) {
        echo "Distinct categories in room_transitions:\n";
        $stmt = $pdo->query("SELECT DISTINCT category FROM room_transitions");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "  - " . ($row['category'] ?: 'NULL') . "\n";
        }
    }
    if (in_array('transition_category_links', $tables)) {
        echo "Distinct categories in transition_category_links:\n";
        $stmt = $pdo->query("SELECT DISTINCT category FROM transition_category_links");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "  - " . ($row['category'] ?: 'NULL') . "\n";
        }
    }
    
    // Test check for lobby transitions
    if (in_array('room_transitions', $tables)) {
        echo "\nLobby Transitions details:\n";
        $stmt = $pdo->prepare("SELECT category, requirements FROM room_transitions WHERE room_id = 'lobby'");
        $stmt->execute();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "  - Category: " . $row['category'] . " | Req: " . ($row['requirements'] ?: 'None') . "\n";
        }
    }

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

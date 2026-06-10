<?php
// tools/migrate.php
$dbFile = __DIR__ . '/../world_data/database.sqlite';
try {
    $pdo = new PDO('sqlite:' . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Check/Add requirements to room_transitions
    $cols = $pdo->query("PRAGMA table_info(room_transitions)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('requirements', $cols)) {
        echo "Adding requirements column to room_transitions...\n";
        $pdo->exec("ALTER TABLE room_transitions ADD COLUMN requirements TEXT");
    } else {
        echo "requirements column already exists in room_transitions.\n";
    }

    // 2. Check/Add effects to interactable_states
    $cols = $pdo->query("PRAGMA table_info(interactable_states)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('effects', $cols)) {
        echo "Adding effects column to interactable_states...\n";
        $pdo->exec("ALTER TABLE interactable_states ADD COLUMN effects TEXT");
    } else {
        echo "effects column already exists in interactable_states.\n";
    }

    echo "Migration complete.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

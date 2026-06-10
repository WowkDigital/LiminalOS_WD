<?php
try {
    $pdo = new PDO('sqlite:world_data/database.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tables = [
        'room_texts' => ['sanity_min', 'sanity_max', 'dialogue_id'],
        'transition_texts' => ['sanity_min', 'sanity_max', 'dialogue_id']
    ];

    foreach ($tables as $table => $columns) {
        $existingColumns = [];
        $res = $pdo->query("PRAGMA table_info($table)");
        foreach ($res as $r) {
            $existingColumns[] = $r['name'];
        }

        foreach ($columns as $col) {
            if (!in_array($col, $existingColumns)) {
                $type = ($col === 'dialogue_id') ? "TEXT" : "INTEGER DEFAULT 0";
                if ($col === 'sanity_max') $type = "INTEGER DEFAULT 100";
                
                $pdo->exec("ALTER TABLE $table ADD COLUMN $col $type");
                echo "Added $col to $table\n";
            } else {
                echo "$col already exists in $table\n";
            }
        }
    }
    echo "Updates complete.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

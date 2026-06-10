<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
foreach(['room_texts', 'transition_texts'] as $table) {
    echo "Table: $table\n";
    $res = $pdo->query("PRAGMA table_info($table)");
    foreach($res as $r) {
        echo "- " . $r['name'] . "\n";
    }
}

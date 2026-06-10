<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
function checkTable($pdo, $table) {
    echo "Table: $table\n";
    $res = $pdo->query("PRAGMA table_info($table)");
    while($r = $res->fetch(PDO::FETCH_ASSOC)) {
        echo "- " . $r['name'] . " (" . $r['type'] . ")\n";
    }
}
checkTable($pdo, 'room_interactables');
checkTable($pdo, 'room_transitions');

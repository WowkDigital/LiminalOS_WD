<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
foreach ($pdo->query("SELECT name FROM sqlite_master WHERE type='table'") as $r) {
    echo $r['name'] . "\n";
}

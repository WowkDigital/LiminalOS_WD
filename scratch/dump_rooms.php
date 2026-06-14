<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
$rooms = $pdo->query('SELECT id, name FROM rooms')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rooms, JSON_PRETTY_PRINT) . PHP_EOL;

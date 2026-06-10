<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
$stmt = $pdo->query("SELECT category, requirements FROM room_transitions WHERE room_id = 'lobby'");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Category: " . $row['category'] . " | Requirements: " . ($row['requirements'] ?: 'NULL') . "\n";
}

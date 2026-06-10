<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
echo "Categories in room_transitions:\n";
$stmt = $pdo->query("SELECT DISTINCT category FROM room_transitions");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "- " . $row['category'] . "\n";
}
echo "\nTransitions categories in links:\n";
$stmt = $pdo->query("SELECT DISTINCT category FROM transition_category_links");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "- " . $row['category'] . "\n";
}
echo "\nLobby transitions:\n";
$stmt = $pdo->query("SELECT category FROM room_transitions WHERE room_id = 'lobby'");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "- " . $row['category'] . "\n";
}
echo "\nInteractable 'lobby_light' states:\n";
$stmt = $pdo->query("SELECT state_id FROM interactable_states WHERE interactable_id = 'lobby_light'");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "- " . $row['state_id'] . "\n";
}

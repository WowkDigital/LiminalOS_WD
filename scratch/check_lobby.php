<?php
$pdo = new PDO('sqlite:world_data/database.sqlite');
$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

echo "--- ALL NON-DEFAULT SCENES ---\n";
print_r($pdo->query("SELECT id, room_id, requirements FROM room_scenes WHERE is_default = 0")->fetchAll());

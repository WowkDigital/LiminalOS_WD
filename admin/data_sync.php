<?php
// admin/data_sync.php

function exportAllData($pdo) {
    $data = [
        'rooms' => [],
        'transitions' => [],
        'interactables' => [],
        'taxonomy' => []
    ];

    // 1. Rooms
    $stmt = $pdo->query("SELECT * FROM rooms");
    while ($row = $stmt->fetch()) {
        $id = $row['id'];
        $room = [
            'id' => $id,
            'name' => $row['name'],
            'desc' => $row['desc'],
            'tags' => [],
            'transitions' => [],
            'interactables' => [],
            'texts' => []
        ];

        $stmtTags = $pdo->prepare("SELECT tag FROM room_tags WHERE room_id = ?");
        $stmtTags->execute([$id]);
        $room['tags'] = $stmtTags->fetchAll(PDO::FETCH_COLUMN);

        $stmtTrans = $pdo->prepare("SELECT category, requirements, area FROM room_transitions WHERE room_id = ?");
        $stmtTrans->execute([$id]);
        $rawTrans = $stmtTrans->fetchAll(PDO::FETCH_ASSOC);
        $room['transitions'] = array_map(function($t) {
            $req = !empty($t['requirements']) ? json_decode($t['requirements'], true) : null;
            $area = !empty($t['area']) ? json_decode($t['area'], true) : null;
            return ['category' => $t['category'], 'requirements' => $req, 'area' => $area];
        }, $rawTrans);

        $stmtInt = $pdo->prepare("SELECT interactable_id, requirements FROM room_interactables WHERE room_id = ?");
        $stmtInt->execute([$id]);
        $rawInt = $stmtInt->fetchAll(PDO::FETCH_ASSOC);
        $room['interactables'] = array_map(function($i) {
            $req = !empty($i['requirements']) ? json_decode($i['requirements'], true) : null;
            return ['id' => $i['interactable_id'], 'requirements' => $req];
        }, $rawInt);

        $stmtTexts = $pdo->prepare("SELECT text, sanity_min, sanity_max, dialogue_id FROM room_texts WHERE room_id = ?");
        $stmtTexts->execute([$id]);
        $room['texts'] = $stmtTexts->fetchAll();

        $data['rooms'][] = $room;
    }

    // 2. Transitions
    $stmt = $pdo->query("SELECT * FROM transitions");
    while ($row = $stmt->fetch()) {
        $id = $row['id'];
        $trans = [
            'id' => $id,
            'label' => $row['label'],
            'desc' => $row['desc'],
            'categories' => [],
            'tags' => [],
            'texts' => []
        ];

        $stmtCats = $pdo->prepare("SELECT category FROM transition_category_links WHERE transition_id = ?");
        $stmtCats->execute([$id]);
        $trans['categories'] = $stmtCats->fetchAll(PDO::FETCH_COLUMN);

        $stmtTags = $pdo->prepare("SELECT tag FROM transition_tags WHERE transition_id = ?");
        $stmtTags->execute([$id]);
        $trans['tags'] = $stmtTags->fetchAll(PDO::FETCH_COLUMN);

        $stmtTexts = $pdo->prepare("SELECT text, sanity_min, sanity_max, dialogue_id FROM transition_texts WHERE transition_id = ?");
        $stmtTexts->execute([$id]);
        $trans['texts'] = $stmtTexts->fetchAll();

        $data['transitions'][] = $trans;
    }

    // 3. Interactables
    $stmt = $pdo->query("SELECT * FROM interactables");
    while ($row = $stmt->fetch()) {
        $id = $row['id'];
        $inter = [
            'id' => $id,
            'label' => $row['label'],
            'current_state_index' => $row['current_state_index'],
            'states' => []
        ];

        $stmtStates = $pdo->prepare("SELECT state_id, desc, image, sort_order FROM interactable_states WHERE interactable_id = ? ORDER BY sort_order ASC");
        $stmtStates->execute([$id]);
        $inter['states'] = $stmtStates->fetchAll();

        $data['interactables'][] = $inter;
    }

    // 4. Taxonomy
    $stmt = $pdo->query("SELECT type, label FROM taxonomy_definitions");
    $data['taxonomy'] = $stmt->fetchAll();

    return $data;
}

function importAllData($pdo, $data) {
    if (!$data || !is_array($data)) throw new Exception("Invalid data format.");

    $pdo->beginTransaction();
    try {
        // 1. Rooms
        if (isset($data['rooms']) && is_array($data['rooms'])) {
            foreach ($data['rooms'] as $room) {
                if (empty($room['id'])) continue;
                $id = $room['id'];

                $stmt = $pdo->prepare("INSERT INTO rooms (id, name, desc) VALUES (?, ?, ?) 
                                      ON CONFLICT(id) DO UPDATE SET name=excluded.name, desc=excluded.desc");
                $stmt->execute([$id, $room['name'] ?? '', $room['desc'] ?? '']);

                // Reset and rewrite relations (only for the imported room)
                $pdo->prepare("DELETE FROM room_tags WHERE room_id = ?")->execute([$id]);
                foreach (($room['tags'] ?? []) as $tag) {
                    $pdo->prepare("INSERT INTO room_tags (room_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
                }

                $pdo->prepare("DELETE FROM room_transitions WHERE room_id = ?")->execute([$id]);
                foreach (($room['transitions'] ?? []) as $transItem) {
                    if (is_string($transItem)) {
                        $cat = $transItem;
                        $req = null;
                        $area = null;
                    } else {
                        $cat = $transItem['category'];
                        $req = !empty($transItem['requirements']) ? json_encode($transItem['requirements']) : null;
                        $area = !empty($transItem['area']) ? json_encode($transItem['area']) : null;
                    }
                    $pdo->prepare("INSERT INTO room_transitions (room_id, category, requirements, area) VALUES (?, ?, ?, ?)")->execute([$id, $cat, $req, $area]);
                }

                $pdo->prepare("DELETE FROM room_interactables WHERE room_id = ?")->execute([$id]);
                foreach (($room['interactables'] ?? []) as $interItem) {
                    if (is_string($interItem)) {
                        $iid = $interItem;
                        $req = null;
                    } else {
                        $iid = $interItem['id'];
                        $req = !empty($interItem['requirements']) ? json_encode($interItem['requirements']) : null;
                    }
                    $pdo->prepare("INSERT INTO room_interactables (room_id, interactable_id, requirements) VALUES (?, ?, ?)")->execute([$id, $iid, $req]);
                }

                $pdo->prepare("DELETE FROM room_texts WHERE room_id = ?")->execute([$id]);
                foreach (($room['texts'] ?? []) as $textRow) {
                    $content = $textRow['text'] ?? '';
                    $sMin = $textRow['sanity_min'] ?? 0;
                    $sMax = $textRow['sanity_max'] ?? 100;
                    $dId = $textRow['dialogue_id'] ?? null;
                    $pdo->prepare("INSERT INTO room_texts (room_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")
                        ->execute([$id, $content, $sMin, $sMax, $dId]);
                }
            }
        }

        // 2. Transitions
        if (isset($data['transitions']) && is_array($data['transitions'])) {
            foreach ($data['transitions'] as $trans) {
                if (empty($trans['id'])) continue;
                $id = $trans['id'];

                $stmt = $pdo->prepare("INSERT INTO transitions (id, label, desc) VALUES (?, ?, ?) 
                                      ON CONFLICT(id) DO UPDATE SET label=excluded.label, desc=excluded.desc");
                $stmt->execute([$id, $trans['label'] ?? '', $trans['desc'] ?? '']);

                $pdo->prepare("DELETE FROM transition_category_links WHERE transition_id = ?")->execute([$id]);
                foreach (($trans['categories'] ?? []) as $cat) {
                    $pdo->prepare("INSERT OR IGNORE INTO transition_category_links (transition_id, category) VALUES (?, ?)")->execute([$id, $cat]);
                }

                $pdo->prepare("DELETE FROM transition_tags WHERE transition_id = ?")->execute([$id]);
                foreach (($trans['tags'] ?? []) as $tag) {
                    $pdo->prepare("INSERT INTO transition_tags (transition_id, tag) VALUES (?, ?)")->execute([$id, $tag]);
                }

                $pdo->prepare("DELETE FROM transition_texts WHERE transition_id = ?")->execute([$id]);
                foreach (($trans['texts'] ?? []) as $textRow) {
                    $content = $textRow['text'] ?? '';
                    $sMin = $textRow['sanity_min'] ?? 0;
                    $sMax = $textRow['sanity_max'] ?? 100;
                    $dId = $textRow['dialogue_id'] ?? null;
                    $pdo->prepare("INSERT INTO transition_texts (transition_id, text, sanity_min, sanity_max, dialogue_id) VALUES (?, ?, ?, ?, ?)")
                        ->execute([$id, $content, $sMin, $sMax, $dId]);
                }
            }
        }

        // 3. Interactables
        if (isset($data['interactables']) && is_array($data['interactables'])) {
            foreach ($data['interactables'] as $inter) {
                if (empty($inter['id'])) continue;
                $id = $inter['id'];

                $stmt = $pdo->prepare("INSERT INTO interactables (id, label, current_state_index) VALUES (?, ?, ?) 
                                      ON CONFLICT(id) DO UPDATE SET label=excluded.label, current_state_index=excluded.current_state_index");
                $stmt->execute([$id, $inter['label'] ?? '', $inter['current_state_index'] ?? 0]);

                $pdo->prepare("DELETE FROM interactable_states WHERE interactable_id = ?")->execute([$id]);
                foreach (($inter['states'] ?? []) as $state) {
                    $stmtState = $pdo->prepare("INSERT INTO interactable_states (interactable_id, state_id, desc, image, sort_order) VALUES (?, ?, ?, ?, ?)");
                    $stmtState->execute([$id, $state['state_id'] ?? $state['id'], $state['desc'] ?? '', $state['image'] ?? null, $state['sort_order'] ?? 0]);
                }
            }
        }

        // 4. Taxonomy
        if (isset($data['taxonomy']) && is_array($data['taxonomy'])) {
            foreach ($data['taxonomy'] as $tax) {
                if (empty($tax['type']) || empty($tax['label'])) continue;
                $stmt = $pdo->prepare("INSERT OR IGNORE INTO taxonomy_definitions (type, label) VALUES (?, ?)");
                $stmt->execute([$tax['type'], $tax['label']]);
            }
        }

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function previewImportData($pdo, $data) {
    if (!$data || !is_array($data)) throw new Exception("Invalid data format.");

    $summary = [
        'rooms' => ['update' => 0, 'create' => 0, 'details' => []],
        'transitions' => ['update' => 0, 'create' => 0, 'details' => []],
        'interactables' => ['update' => 0, 'create' => 0, 'details' => []],
        'taxonomy' => ['new' => 0, 'details' => []]
    ];

    // 1. Rooms
    if (isset($data['rooms']) && is_array($data['rooms'])) {
        foreach ($data['rooms'] as $room) {
            if (empty($room['id'])) continue;
            $stmt = $pdo->prepare("SELECT id FROM rooms WHERE id = ?");
            $stmt->execute([$room['id']]);
            if ($stmt->fetch()) {
                $summary['rooms']['update']++;
                $summary['rooms']['details'][] = "Update: " . $room['id'];
            } else {
                $summary['rooms']['create']++;
                $summary['rooms']['details'][] = "Create: " . $room['id'];
            }
        }
    }

    // 2. Transitions
    if (isset($data['transitions']) && is_array($data['transitions'])) {
        foreach ($data['transitions'] as $trans) {
            if (empty($trans['id'])) continue;
            $stmt = $pdo->prepare("SELECT id FROM transitions WHERE id = ?");
            $stmt->execute([$trans['id']]);
            if ($stmt->fetch()) {
                $summary['transitions']['update']++;
                $summary['transitions']['details'][] = "Update: " . $trans['id'];
            } else {
                $summary['transitions']['create']++;
                $summary['transitions']['details'][] = "Create: " . $trans['id'];
            }
        }
    }

    // 3. Interactables
    if (isset($data['interactables']) && is_array($data['interactables'])) {
        foreach ($data['interactables'] as $inter) {
            if (empty($inter['id'])) continue;
            $stmt = $pdo->prepare("SELECT id FROM interactables WHERE id = ?");
            $stmt->execute([$inter['id']]);
            if ($stmt->fetch()) {
                $summary['interactables']['update']++;
                $summary['interactables']['details'][] = "Update: " . $inter['id'];
            } else {
                $summary['interactables']['create']++;
                $summary['interactables']['details'][] = "Create: " . $inter['id'];
            }
        }
    }

    // 4. Taxonomy
    if (isset($data['taxonomy']) && is_array($data['taxonomy'])) {
        foreach ($data['taxonomy'] as $tax) {
            if (empty($tax['type']) || empty($tax['label'])) continue;
            $stmt = $pdo->prepare("SELECT id FROM taxonomy_definitions WHERE type = ? AND label = ?");
            $stmt->execute([$tax['type'], $tax['label']]);
            if (!$stmt->fetch()) {
                $summary['taxonomy']['new']++;
                $summary['taxonomy']['details'][] = "New: [" . $tax['type'] . "] " . $tax['label'];
            }
        }
    }

    return $summary;
}


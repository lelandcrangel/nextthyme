<?php

declare(strict_types=1);

/**
 * The recipe box.
 *
 *   GET            all live recipes, in display order. No login: visitors
 *                  read. HEAD is answered too, as GET without the body.
 *   POST           create a recipe                                 (owner)
 *   PUT    ?id=    replace a recipe; 409 if it changed since read  (owner)
 *   DELETE ?id=    hide a recipe; the row stays, deleted_at is set (owner)
 *
 * Every write needs the owner's session, an Origin this site allows, and a
 * JSON body that passes nt_validate_recipe(). Nothing is ever hard-deleted
 * here, so any mistake made through this endpoint can be undone in SQL.
 */

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' || $method === 'HEAD') {
    try {
        $rows = nt_db()->query(
            'SELECT * FROM recipes
              WHERE deleted_at IS NULL
              ORDER BY sort_order, created_at, id'
        )->fetchAll();
    } catch (PDOException $e) {
        nt_fail('recipe query failed: ' . $e->getMessage());
    }

    nt_respond(200, ['recipes' => array_map('nt_recipe_from_row', $rows)]);
}

if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    nt_respond(405, ['error' => 'method'], ['Allow' => 'GET, HEAD, POST, PUT, DELETE']);
}

// Order matters: the cheap, unauthenticated refusals come first, so a
// request from elsewhere learns nothing about sessions or recipes.
nt_require_same_site();
nt_require_owner();

$pdo = nt_db();
$now = nt_now();

try {
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        $hide = $pdo->prepare('UPDATE recipes SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL');
        $hide->execute([$now, $now, is_string($id) ? $id : '']);
        if ($hide->rowCount() === 0) {
            nt_respond(404, ['error' => 'not-found']);
        }
        nt_respond(200, ['deleted' => $id]);
    }

    $body = nt_json_body();
    $row = nt_encode_json_columns(nt_validate_recipe($body));

    if ($method === 'POST') {
        // Deleted recipes keep their id: it may still be named in another
        // recipe's similar ids, and undoing the delete must not collide.
        if (nt_find_recipe($row['id'], true) !== null) {
            nt_respond(409, ['error' => 'exists']);
        }

        $row['sort_order'] = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM recipes')->fetchColumn();
        $row['created_at'] = $now;
        $row['updated_at'] = $now;

        $columns = array_keys($row);
        $insert = $pdo->prepare(
            'INSERT INTO recipes (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')'
        );
        $insert->execute(array_values($row));

        nt_respond(201, ['recipe' => nt_recipe_from_row(nt_find_recipe($row['id']))]);
    }

    // PUT
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || $id !== $row['id']) {
        nt_respond(400, ['error' => 'id-mismatch']);
    }
    $version = $body['version'] ?? null;
    if (!is_int($version) || $version < 1) {
        nt_respond(422, ['error' => 'invalid', 'fields' => ['version']]);
    }

    unset($row['id']);
    $assignments = implode(', ', array_map(fn (string $column): string => "$column = ?", array_keys($row)));
    // The version in the WHERE clause is the whole of the concurrency check:
    // if another tab saved first, no row matches and nothing is written.
    $update = $pdo->prepare(
        "UPDATE recipes SET $assignments, updated_at = ?, version = version + 1
          WHERE id = ? AND version = ? AND deleted_at IS NULL"
    );
    $update->execute([...array_values($row), $now, $id, $version]);

    if ($update->rowCount() === 0) {
        $current = nt_find_recipe($id);
        if ($current === null) {
            nt_respond(404, ['error' => 'not-found']);
        }
        // Hand back what is there now, so the app can show the newer copy.
        nt_respond(409, ['error' => 'conflict', 'recipe' => nt_recipe_from_row($current)]);
    }

    nt_respond(200, ['recipe' => nt_recipe_from_row(nt_find_recipe($id))]);
} catch (PDOException $e) {
    nt_fail("recipe $method failed: " . $e->getMessage());
}

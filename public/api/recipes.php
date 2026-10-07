<?php

declare(strict_types=1);

/**
 * The recipe box.
 *
 *   GET  all live recipes, in display order. No login: visitors read.
 *        HEAD is answered too, as GET without the body, which is what the
 *        HTTP spec asks of any resource that answers GET.
 *
 * Writes (POST / PUT / DELETE, owner only) arrive in phase 3 of
 * docs/db-plan.md. Until then every other method is refused, so there is no
 * code path here that changes the database.
 */

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET' && $method !== 'HEAD') {
    nt_respond(405, ['error' => 'method'], ['Allow' => 'GET, HEAD']);
}

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

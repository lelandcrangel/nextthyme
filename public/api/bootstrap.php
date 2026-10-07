<?php

declare(strict_types=1);

/**
 * Shared by every endpoint in this directory: config, database, responses.
 *
 * Not an endpoint itself. Requested directly it answers 404, and .htaccess
 * refuses it before PHP runs; the check below covers servers that ignore
 * .htaccess, such as `php -S` in development.
 *
 * Written for PHP 8.1, the oldest version Hostinger still offers, so nothing
 * here may need a newer one.
 */

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

// Errors go to the server log, never into a response body: a PDO message
// can carry the database name, the user, and the query.
ini_set('display_errors', '0');
error_reporting(E_ALL);

/**
 * Answer with JSON and stop.
 *
 * no-store on everything: Hostinger's cache sits in front of this directory,
 * and a cached recipe list would hide an edit until it expired.
 */
function nt_respond(int $status, array $body, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $name => $value) {
        header("$name: $value");
    }
    if ($status === 204) {
        exit;
    }
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

/** A 500 that says what is wrong in the log and nothing in the response. */
function nt_fail(string $logMessage): never
{
    error_log('nextthyme: ' . $logMessage);
    nt_respond(500, ['error' => 'server']);
}

/**
 * The config lives in the directory that CONTAINS public_html, three levels
 * above this file on Hostinger:
 *
 *     ~/domains/lelandrangel.com/nextthyme-config.php
 *     ~/domains/lelandrangel.com/public_html/nextthyme/api/bootstrap.php
 *
 * In development the same rule lands beside the repositories, outside them.
 * It is checked where it is loaded, so a half-filled file fails here with a
 * named reason in the log rather than as a puzzling error three calls later.
 */
function nt_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = dirname(__DIR__, 3) . '/nextthyme-config.php';
    if (!is_file($path)) {
        nt_fail("config missing: expected $path");
    }

    $loaded = require $path;
    if (!is_array($loaded)) {
        nt_fail('config did not return an array');
    }

    foreach (['host', 'name', 'user', 'password'] as $key) {
        if (!isset($loaded['db'][$key]) || !is_string($loaded['db'][$key])) {
            nt_fail("config: db.$key is missing or not a string");
        }
    }
    if ($loaded['db']['name'] === '' || $loaded['db']['user'] === '') {
        nt_fail('config: db.name and db.user must be set');
    }

    return $config = $loaded;
}

function nt_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $db = nt_config()['db'];
    try {
        $pdo = new PDO(
            "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
            $db['user'],
            $db['password'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Real prepared statements, and integers come back as
                // integers rather than strings.
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ],
        );
        // Timestamps are written and compared in UTC whatever the server's
        // own zone is.
        $pdo->exec("SET time_zone = '+00:00'");
    } catch (PDOException $e) {
        nt_fail('database connection failed: ' . $e->getMessage());
    }

    return $pdo;
}

/** Decode a JSON column, failing loudly rather than returning null. */
function nt_json_column(string $value, string $column, string $id): mixed
{
    try {
        return json_decode($value, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        nt_fail("recipe $id: column $column is not valid JSON");
    }
}

/**
 * A database row in the shape the app's `Recipe` type expects.
 *
 * Image paths stay relative to the app's base (or null for "no image"); the
 * browser resolves them, because only it knows whether it is under
 * /nextthyme/ or the dev server's /.
 */
function nt_recipe_from_row(array $row): array
{
    $id = $row['id'];
    $recipe = [
        'id' => $id,
        'title' => $row['title'],
        'description' => $row['description'],
        'category' => $row['category'],
        'cuisine' => $row['cuisine'],
        'difficulty' => $row['difficulty'],
        'imageUrl' => $row['image_url'],
        'imageSmallUrl' => $row['image_small_url'],
        'imageAlt' => $row['image_alt'],
        'imageCredit' => $row['image_credit'],
        'imageCreditUrl' => $row['image_credit_url'],
        'history' => $row['history'],
        'servings' => (int) $row['servings'],
        'yieldLabel' => $row['yield_label'],
        'prepTimeMinutes' => (int) $row['prep_time_minutes'],
        'cookTimeMinutes' => (int) $row['cook_time_minutes'],
        'totalTimeMinutes' => (int) $row['total_time_minutes'],
        'tags' => nt_json_column($row['tags'], 'tags', $id),
        'equipment' => nt_json_column($row['equipment'], 'equipment', $id),
        'ingredients' => nt_json_column($row['ingredients'], 'ingredients', $id),
        'directions' => nt_json_column($row['directions'], 'directions', $id),
        'tips' => nt_json_column($row['tips'], 'tips', $id),
        'nutrition' => nt_json_column($row['nutrition'], 'nutrition', $id),
        'similarRecipeIds' => nt_json_column($row['similar_recipe_ids'], 'similar_recipe_ids', $id),
        'nextTimeNotes' => $row['next_time_notes'],
        'leftoverStorage' => $row['leftover_storage'],
        'version' => (int) $row['version'],
    ];

    // Optional in the type, so absent rather than null when unset.
    if ($row['cooking_method'] !== null) {
        $recipe['cookingMethod'] = $row['cooking_method'];
    }
    if ($row['oven_temp_f'] !== null) {
        $recipe['ovenTempF'] = (int) $row['oven_temp_f'];
    }

    return $recipe;
}

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
// Hostinger ships log_errors Off; without this, nt_fail()'s reasons vanish.
ini_set('log_errors', '1');
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

// ── Writing ──────────────────────────────────────────────────────────────
// Everything below exists for the owner's writes: the session, the checks a
// write must pass before it is read, and the validation of what it carries.
// Reads use none of it.

/**
 * Values only the write paths need, checked the first time one is used so a
 * visitor's GET never fails on them.
 */
function nt_write_config(): array
{
    static $checked = null;
    if ($checked !== null) {
        return $checked;
    }

    $config = nt_config();

    $salt = $config['ip_salt'] ?? '';
    if (!is_string($salt) || strlen($salt) < 16) {
        nt_fail('config: ip_salt is missing or shorter than 16 characters; refusing to hash with a weak salt');
    }

    $origins = $config['allowed_origins'] ?? [];
    if (!is_array($origins)) {
        nt_fail('config: allowed_origins must be an array');
    }

    $hash = $config['owner_password_hash'] ?? '';
    if (!is_string($hash)) {
        nt_fail('config: owner_password_hash must be a string');
    }

    $limit = ($config['login_rate_limit'] ?? []) + ['max_failures' => 5, 'window_minutes' => 15];

    return $checked = [
        'ip_salt' => $salt,
        'allowed_origins' => array_values(array_filter($origins, 'is_string')),
        'owner_password_hash' => $hash,
        'max_failures' => max(1, (int) $limit['max_failures']),
        'window_minutes' => max(1, (int) $limit['window_minutes']),
    ];
}

/**
 * A write must come from this site's own pages. Browsers send Origin on
 * every POST, PUT and DELETE, including same-origin ones, and a page on
 * another site cannot forge it. With SameSite=Strict on the cookie this is
 * the second of two independent checks; either alone stops a forged request.
 *
 * An empty allowed_origins refuses everything, which is the right way round
 * for a misconfiguration.
 */
function nt_require_same_site(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '' || !in_array($origin, nt_write_config()['allowed_origins'], true)) {
        nt_respond(403, ['error' => 'origin']);
    }
}

/**
 * The request body as an array. JSON only: a cross-site form cannot send
 * application/json without a preflight, so this is a third obstacle to a
 * forged write as well as the parser.
 */
function nt_json_body(int $maxBytes = 262144): array
{
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') {
        nt_respond(415, ['error' => 'content-type']);
    }

    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        nt_respond(413, ['error' => 'too-large']);
    }

    try {
        $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        nt_respond(400, ['error' => 'json']);
    }
    if (!is_array($body) || array_is_list($body)) {
        nt_respond(400, ['error' => 'json']);
    }

    return $body;
}

/** How long a sign-in lasts, and how long it survives without being used. */
const NT_SESSION_MAX_AGE = 30 * 24 * 3600;
const NT_SESSION_IDLE = 14 * 24 * 3600;

/**
 * Start (or resume) the session.
 *
 * Sessions are kept in a directory of their own beside the config, above the
 * web root. PHP's default directory is shared across the hosting account and
 * swept on a 24-minute timer set elsewhere (session.gc_maxlifetime is 1440
 * on Hostinger), which would sign the owner out mid-edit.
 *
 * The cookie is HttpOnly, SameSite=Strict, scoped to this app's path, and
 * Secure everywhere except plain-http localhost in development.
 */
function nt_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $dir = dirname(__DIR__, 3) . '/nextthyme-sessions';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        nt_fail("could not create the session directory $dir");
    }

    // /nextthyme/api/session.php -> /nextthyme/ ; /api/session.php -> /
    $appPath = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php')), '/') . '/';
    $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
    $isLocalDev = in_array($host, ['localhost', '127.0.0.1'], true);

    ini_set('session.save_path', $dir);
    ini_set('session.gc_maxlifetime', (string) NT_SESSION_IDLE);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cache_limiter', '');
    session_name('nt_session');
    session_set_cookie_params([
        'lifetime' => NT_SESSION_MAX_AGE,
        'path' => $appPath,
        'secure' => !$isLocalDev,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    if (!session_start()) {
        nt_fail('session_start failed');
    }
}

function nt_is_owner(): bool
{
    // No cookie, no session: a visitor's request never creates a session file.
    if (empty($_COOKIE['nt_session'])) {
        return false;
    }
    nt_session_start();

    $now = time();
    $signedInAt = $_SESSION['signed_in_at'] ?? 0;
    $lastSeenAt = $_SESSION['last_seen_at'] ?? 0;
    if (
        ($_SESSION['owner'] ?? false) !== true
        || $now - $signedInAt > NT_SESSION_MAX_AGE
        || $now - $lastSeenAt > NT_SESSION_IDLE
    ) {
        return false;
    }

    $_SESSION['last_seen_at'] = $now;
    return true;
}

function nt_require_owner(): void
{
    if (!nt_is_owner()) {
        nt_respond(401, ['error' => 'signed-out']);
    }
}

function nt_sign_out(): void
{
    if (empty($_COOKIE['nt_session'])) {
        return;
    }
    nt_session_start();
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie('nt_session', '', [
        'expires' => time() - 3600,
        'path' => $params['path'],
        'secure' => $params['secure'],
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_destroy();
}

/** Salted hash of the caller's address. Never the address itself. */
function nt_ip_hash(): string
{
    return hash('sha256', nt_write_config()['ip_salt'] . ($_SERVER['REMOTE_ADDR'] ?? ''));
}

function nt_now(): string
{
    return gmdate('Y-m-d H:i:s');
}

// ── Recipe validation ────────────────────────────────────────────────────

/** Must match COOKING_METHODS in src/types/recipe.ts and the column's ENUM. */
const NT_COOKING_METHODS = ['Oven', 'Stovetop', 'Microwave', 'Slow cooker'];

/**
 * Checks a recipe sent by the app and returns it as column values, or
 * answers 422 naming every field that is wrong.
 *
 * The browser validates too, but it is the owner's browser today and
 * anyone's request tomorrow; the database is only ever given what passes
 * here. Lengths mirror the column widths in db/migrations/001_recipes.sql.
 */
function nt_validate_recipe(array $in): array
{
    $bad = [];

    $text = function (string $key, int $max, bool $required = false) use ($in, &$bad): string {
        $value = $in[$key] ?? null;
        if (!is_string($value) || mb_strlen($value) > $max || ($required && trim($value) === '')) {
            $bad[] = $key;
            return '';
        }
        return $value;
    };
    $whole = function (string $key, int $min, int $max) use ($in, &$bad): int {
        $value = $in[$key] ?? null;
        if (!is_int($value) || $value < $min || $value > $max) {
            $bad[] = $key;
            return 0;
        }
        return $value;
    };
    $strings = function (string $key, int $maxItems, int $maxLength) use ($in, &$bad): array {
        $value = $in[$key] ?? null;
        if (!is_array($value) || !array_is_list($value) || count($value) > $maxItems) {
            $bad[] = $key;
            return [];
        }
        foreach ($value as $item) {
            if (!is_string($item) || mb_strlen($item) > $maxLength) {
                $bad[] = $key;
                return [];
            }
        }
        return $value;
    };
    $isNumber = fn ($v): bool => (is_int($v) || is_float($v)) && is_finite((float) $v);
    $isShort = fn ($v, int $max): bool => is_string($v) && mb_strlen($v) <= $max;

    $id = $in['id'] ?? null;
    if (!is_string($id) || strlen($id) > 128 || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $id)) {
        $bad[] = 'id';
        $id = '';
    }

    // Where an image may point: this app's own files, an uploaded image (phase
    // 4), or an https URL. Never data: — a photo belongs in recipe_images,
    // and the column is 512 wide.
    $image = function (string $key) use ($in, &$bad): ?string {
        $value = $in[$key] ?? null;
        if ($value === null) {
            return null;
        }
        $ok = is_string($value) && strlen($value) <= 512 && (
            preg_match('#^images/recipes/[A-Za-z0-9._-]+$#', $value)
            || preg_match('#^api/image\.php\?id=[a-f0-9]{32}$#', $value)
            || (preg_match('#^https://[^\s<>"\']+$#', $value) && filter_var($value, FILTER_VALIDATE_URL))
        );
        if (!$ok) {
            $bad[] = $key;
            return null;
        }
        return $value;
    };

    $creditUrl = $in['imageCreditUrl'] ?? null;
    if (
        !is_string($creditUrl) || strlen($creditUrl) > 512
        || !($creditUrl === '' || $creditUrl === '#' || (preg_match('#^https?://#', $creditUrl) && filter_var($creditUrl, FILTER_VALIDATE_URL)))
    ) {
        $bad[] = 'imageCreditUrl';
        $creditUrl = '';
    }

    $method = $in['cookingMethod'] ?? null;
    if ($method !== null && !in_array($method, NT_COOKING_METHODS, true)) {
        $bad[] = 'cookingMethod';
        $method = null;
    }
    $ovenTemp = $in['ovenTempF'] ?? null;
    if ($ovenTemp !== null && (!is_int($ovenTemp) || $ovenTemp < 0 || $ovenTemp > 1000)) {
        $bad[] = 'ovenTempF';
        $ovenTemp = null;
    }

    $ingredients = [];
    $rawIngredients = $in['ingredients'] ?? null;
    if (!is_array($rawIngredients) || !array_is_list($rawIngredients) || count($rawIngredients) < 1 || count($rawIngredients) > 200) {
        $bad[] = 'ingredients';
    } else {
        foreach ($rawIngredients as $item) {
            if (
                !is_array($item)
                || !$isShort($item['id'] ?? null, 64) || !$isShort($item['name'] ?? null, 200) || trim($item['name']) === ''
                || !$isNumber($item['quantity'] ?? null) || $item['quantity'] < 0 || $item['quantity'] > 100000
                || !$isShort($item['unit'] ?? null, 40)
                || (isset($item['notes']) && !$isShort($item['notes'], 300))
                || (isset($item['section']) && !$isShort($item['section'], 80))
            ) {
                $bad[] = 'ingredients';
                break;
            }
            // Only the known keys are kept, so nothing rides along into the column.
            $clean = ['id' => $item['id'], 'name' => $item['name'], 'quantity' => $item['quantity'], 'unit' => $item['unit']];
            if (isset($item['notes'])) {
                $clean['notes'] = $item['notes'];
            }
            if (isset($item['section'])) {
                $clean['section'] = $item['section'];
            }
            $ingredients[] = $clean;
        }
    }

    $directions = [];
    $rawDirections = $in['directions'] ?? null;
    if (!is_array($rawDirections) || !array_is_list($rawDirections) || count($rawDirections) < 1 || count($rawDirections) > 200) {
        $bad[] = 'directions';
    } else {
        foreach ($rawDirections as $step) {
            if (
                !is_array($step)
                || !$isShort($step['id'] ?? null, 64)
                || !is_int($step['order'] ?? null) || $step['order'] < 0 || $step['order'] > 1000
                || !$isShort($step['instruction'] ?? null, 5000) || trim($step['instruction']) === ''
            ) {
                $bad[] = 'directions';
                break;
            }
            $directions[] = ['id' => $step['id'], 'order' => $step['order'], 'instruction' => $step['instruction']];
        }
    }

    $nutrition = $in['nutrition'] ?? null;
    if (
        !is_array($nutrition) || !$isNumber($nutrition['calories'] ?? null) || $nutrition['calories'] < 0 || $nutrition['calories'] > 100000
        || !$isShort($nutrition['protein'] ?? null, 40) || !$isShort($nutrition['fat'] ?? null, 40) || !$isShort($nutrition['carbohydrates'] ?? null, 40)
    ) {
        $bad[] = 'nutrition';
        $nutrition = [];
    } else {
        $nutrition = [
            'calories' => $nutrition['calories'],
            'protein' => $nutrition['protein'],
            'fat' => $nutrition['fat'],
            'carbohydrates' => $nutrition['carbohydrates'],
        ];
    }

    $row = [
        'id' => $id,
        'title' => $text('title', 200, true),
        'description' => $text('description', 5000, true),
        'category' => $text('category', 80),
        'cuisine' => $text('cuisine', 80),
        'difficulty' => $text('difficulty', 40),
        'image_url' => $image('imageUrl'),
        'image_small_url' => $image('imageSmallUrl'),
        'image_alt' => $text('imageAlt', 300),
        'image_credit' => $text('imageCredit', 300),
        'image_credit_url' => $creditUrl,
        'history' => $text('history', 5000),
        'servings' => $whole('servings', 1, 1000),
        'yield_label' => $text('yieldLabel', 120),
        'prep_time_minutes' => $whole('prepTimeMinutes', 0, 65535),
        'cook_time_minutes' => $whole('cookTimeMinutes', 0, 65535),
        'total_time_minutes' => $whole('totalTimeMinutes', 0, 65535),
        'cooking_method' => $method,
        'oven_temp_f' => $ovenTemp,
        'tags' => $strings('tags', 50, 80),
        'equipment' => $strings('equipment', 50, 120),
        'ingredients' => $ingredients,
        'directions' => $directions,
        'tips' => $strings('tips', 50, 1000),
        'nutrition' => $nutrition,
        'similar_recipe_ids' => $strings('similarRecipeIds', 50, 128),
        'next_time_notes' => $text('nextTimeNotes', 5000),
        'leftover_storage' => $text('leftoverStorage', 5000),
    ];

    if ($bad !== []) {
        nt_respond(422, ['error' => 'invalid', 'fields' => array_values(array_unique($bad))]);
    }

    return $row;
}

/** JSON columns, encoded for storage. */
const NT_JSON_COLUMNS = ['tags', 'equipment', 'ingredients', 'directions', 'tips', 'nutrition', 'similar_recipe_ids'];

function nt_encode_json_columns(array $row): array
{
    foreach (NT_JSON_COLUMNS as $column) {
        $row[$column] = json_encode($row[$column], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
    return $row;
}

function nt_find_recipe(string $id, bool $includeDeleted = false): ?array
{
    $sql = 'SELECT * FROM recipes WHERE id = ?' . ($includeDeleted ? '' : ' AND deleted_at IS NULL');
    $statement = nt_db()->prepare($sql);
    $statement->execute([$id]);
    $row = $statement->fetch();
    return $row === false ? null : $row;
}

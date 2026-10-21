<?php

declare(strict_types=1);

/**
 * The owner's sign-in. There is exactly one writer and no accounts: the
 * password's hash lives in the server config, above the web root.
 *
 *   GET     { "owner": true|false }   who this browser is
 *   POST    { "password": "…" }       sign in
 *   DELETE                            sign out
 *
 * This endpoint never sends mail and never creates anything but a session:
 * there is no reset, no sign-up, and no way to learn the hash from it.
 */

require __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' || $method === 'HEAD') {
    nt_respond(200, ['owner' => nt_is_owner()]);
}

if ($method === 'DELETE') {
    nt_require_same_site();
    nt_sign_out();
    nt_respond(200, ['owner' => false]);
}

if ($method !== 'POST') {
    nt_respond(405, ['error' => 'method'], ['Allow' => 'GET, HEAD, POST, DELETE']);
}

nt_require_same_site();
$config = nt_write_config();
$body = nt_json_body(4096);

$password = $body['password'] ?? null;
// bcrypt reads 72 bytes; anything far past that is not a password, it is a
// request trying to make the hash function do work.
if (!is_string($password) || $password === '' || strlen($password) > 1024) {
    nt_respond(400, ['error' => 'password']);
}

$pdo = nt_db();
$ipHash = nt_ip_hash();
$windowStart = gmdate('Y-m-d H:i:s', time() - $config['window_minutes'] * 60);

try {
    // Two limits, both counted over failures only, so the owner signing in
    // correctly is never locked out by their own successes:
    //   per address   stops one client guessing
    //   site-wide     stops many addresses sharing the guessing; 10x the
    //                 per-address allowance, since there is only one account
    $count = $pdo->prepare(
        'SELECT COALESCE(SUM(ip_hash = ?), 0) AS mine, COUNT(*) AS everyone
           FROM login_attempts
          WHERE succeeded = 0 AND created_at >= ?'
    );
    $count->execute([$ipHash, $windowStart]);
    $failures = $count->fetch();

    if ((int) $failures['mine'] >= $config['max_failures'] || (int) $failures['everyone'] >= $config['max_failures'] * 10) {
        nt_respond(429, ['error' => 'rate-limited'], ['Retry-After' => (string) ($config['window_minutes'] * 60)]);
    }

    // An empty hash means sign-in is switched off. It answers like a wrong
    // password, and is recorded like one, so the response gives nothing away.
    $ok = $config['owner_password_hash'] !== '' && password_verify($password, $config['owner_password_hash']);
    if ($config['owner_password_hash'] === '') {
        error_log('nextthyme: sign-in attempted but owner_password_hash is empty');
    }

    $pdo->prepare('INSERT INTO login_attempts (ip_hash, succeeded, created_at) VALUES (?, ?, ?)')
        ->execute([$ipHash, $ok ? 1 : 0, nt_now()]);

    // Housekeeping, occasionally: attempts older than a week are of no use.
    if (random_int(1, 50) === 1) {
        $pdo->prepare('DELETE FROM login_attempts WHERE created_at < ?')
            ->execute([gmdate('Y-m-d H:i:s', time() - 7 * 24 * 3600)]);
    }
} catch (PDOException $e) {
    nt_fail('sign-in bookkeeping failed: ' . $e->getMessage());
}

if (!$ok) {
    nt_respond(401, ['error' => 'password']);
}

nt_session_start();
// A fresh id on sign-in, so an id planted before it is worthless after.
session_regenerate_id(true);
$_SESSION['owner'] = true;
$_SESSION['signed_in_at'] = time();
$_SESSION['last_seen_at'] = time();

nt_respond(200, ['owner' => true]);

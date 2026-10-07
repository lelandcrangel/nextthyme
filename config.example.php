<?php

declare(strict_types=1);

/**
 * Template for the recipe API's configuration.
 *
 * COPY THIS ABOVE THE WEB ROOT, not into the repository and not into
 * public_html. The endpoints in public/api/ walk three directories up from
 * their own location, so the file belongs in the directory that CONTAINS
 * public_html. On this account that is not the home directory:
 *
 *     ~/domains/lelandrangel.com/nextthyme-config.php                  <- here
 *     ~/domains/lelandrangel.com/public_html/nextthyme/api/recipes.php
 *
 * Put it in `~` and it is two levels too high; every request 500s with
 * "config missing". A file above public_html is not reachable over HTTP at
 * all, which is a stronger guarantee than a deny rule.
 *
 * Locally the same rule resolves to Development/lelandrangel.com/nextthyme-config.php,
 * beside the repositories rather than inside one. See db/README.md.
 */

return [
    'db' => [
        // PHP on Hostinger reaches MySQL on localhost. Remote MySQL is not
        // needed and should stay off.
        'host' => 'localhost',
        // Its own database and user, separate from the portfolio's, the
        // contact form's and the playtest's. (The name's spelling is what
        // Hostinger has; it was created that way.)
        'name' => 'u334379448_recipies',
        'user' => 'u334379448_recipies',
        'password' => '',
    ],

    /**
     * The one writer. A password_hash() output, never the password:
     *
     *     php -r "echo password_hash(readline('password: '), PASSWORD_DEFAULT), PHP_EOL;"
     *
     * Empty means nobody can log in, and the site is read-only for everyone,
     * which is the right way round for a misconfiguration.
     */
    'owner_password_hash' => '',

    /**
     * Salt for hashing login attempts' IP addresses. Generate once:
     *
     *     openssl rand -hex 32
     *
     * The endpoints refuse to start on a salt shorter than 16 characters.
     * Rotating it only resets the login rate-limit window.
     */
    'ip_salt' => '',

    /**
     * Exact origins allowed to write. No wildcards, no trailing slash; the
     * value is compared against the browser's Origin header as-is. Reads do
     * not check it. An empty list refuses every write.
     */
    'allowed_origins' => [
        'https://lelandrangel.com',
    ],

    /** Failed logins per hashed IP before the endpoint stops listening. */
    'login_rate_limit' => [
        'max_failures' => 5,
        'window_minutes' => 15,
    ],

    /** Largest upload accepted before re-encoding, in bytes. */
    'max_upload_bytes' => 8 * 1024 * 1024,
];

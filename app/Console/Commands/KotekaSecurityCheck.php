<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use PDO;
use Throwable;

class KotekaSecurityCheck extends Command
{
    protected $signature = 'koteka:security-check';

    protected $description = 'Read-only production security checks; never prints credentials or modifies records.';

    public function handle(): int
    {
        $key = (string) config('app.key');
        $decodedKey = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        $database = (string) config('database.connections.sqlite.database');
        $privateRoot = (string) config('filesystems.disks.local.root');
        $checks = [
            'environment' => app()->environment('production'),
            'debug_disabled' => config('app.debug') === false,
            'https_url' => parse_url((string) config('app.url'), PHP_URL_SCHEME) === 'https',
            'application_key' => is_string($decodedKey) && Encrypter::supported($decodedKey, (string) config('app.cipher')),
            'secure_session' => (bool) config('session.secure') && (bool) config('session.http_only') && config('session.same_site') === 'lax',
            'password_algorithm' => in_array('argon2id', password_algos(), true),
            'private_storage' => $this->outsidePublic($privateRoot) && is_dir($privateRoot) && is_writable($privateRoot),
            'persistent_sqlite' => config('database.default') === 'sqlite' && is_file($database) && $this->outsidePublic($database) && is_writable($database) && is_writable(dirname($database)),
            'explicit_proxies' => ! in_array('*', config('koteka.trusted_proxies', []), true),
        ];
        $checks['database_integrity'] = $checks['persistent_sqlite'] && $this->databaseIsHealthy($database);
        foreach ($checks as $name => $passed) {
            $this->line(($passed ? 'PASS ' : 'FAIL ').$name);
        }
        $this->warn('Verify the live public/ document root, TLS certificate, redirects, static-file denials, backups and filesystem permissions on the hosting account.');

        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }

    private function outsidePublic(string $path): bool
    {
        $resolved = realpath($path);
        $public = realpath(public_path());
        if ($resolved === false || $public === false) {
            return false;
        }
        $resolved = str_replace('\\', '/', $resolved);
        $public = str_replace('\\', '/', $public);
        if (PHP_OS_FAMILY === 'Windows') {
            $resolved = strtolower($resolved);
            $public = strtolower($public);
        }

        return $resolved !== $public && ! str_starts_with($resolved, $public.'/');
    }

    private function databaseIsHealthy(string $path): bool
    {
        try {
            $connection = new PDO('sqlite:'.$path, null, null, [PDO::SQLITE_ATTR_OPEN_FLAGS => PDO::SQLITE_OPEN_READONLY]);

            return $connection->query('PRAGMA quick_check')->fetchColumn() === 'ok';
        } catch (Throwable) {
            return false;
        }
    }
}

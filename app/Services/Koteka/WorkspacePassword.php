<?php

namespace App\Services\Koteka;

use Illuminate\Support\Facades\Hash;

final class WorkspacePassword
{
    public static function hash(#[\SensitiveParameter] string $password): string
    {
        if (config('hashing.driver', 'bcrypt') === 'bcrypt' && (strlen($password) > 72 || str_contains($password, "\0"))) {
            return Hash::driver('argon2id')->make($password);
        }

        return Hash::make($password);
    }

    public static function verify(#[\SensitiveParameter] string $password, #[\SensitiveParameter] string $hash): bool
    {
        $driver = match (password_get_info($hash)['algoName']) {
            'bcrypt' => 'bcrypt',
            'argon2i' => 'argon',
            'argon2id' => 'argon2id',
            default => null,
        };

        return $driver !== null && Hash::driver($driver)->check($password, $hash);
    }
}

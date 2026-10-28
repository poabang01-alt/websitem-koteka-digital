<?php

namespace App\Services\Koteka;

/** Server-side public projection of the Workspace JSON snapshot. */
final class PublicContentService
{
    public static function published(array $content): array
    {
        $out = [];
        foreach ($content as $key => $value) {
            // A collection's status is enforced on the server, not only in JS.
            if (is_array($value) && array_is_list($value)) {
                $out[$key] = [];
                foreach ($value as $entry) {
                    if (is_array($entry) && array_key_exists('status', $entry)
                        && $entry['status'] !== 'Publik') continue;
                    $out[$key][] = is_array($entry) ? self::published($entry) : $entry;
                }
            } elseif (is_array($value)) {
                // Nested editorial records can also declare their own status.
                if (array_key_exists('status', $value) && $value['status'] !== 'Publik') continue;
                $out[$key] = self::published($value);
            } else {
                $out[$key] = $value;
            }
        }
        return $out;
    }

    public static function references(array $data, string $url): bool
    {
        foreach ($data as $value) {
            if ($value === $url) return true;
            if (is_array($value) && self::references($value, $url)) return true;
        }
        return false;
    }
}

<?php

namespace App\Services\Koteka;

/** Server-side public projection of the Workspace JSON snapshot. */
final class PublicContentService
{
    public const IMPLICIT_COLLECTIONS = '_koteka_implicit_collections';

    public static function published(array $content, bool $root = true): array
    {
        $out = [];
        $implicit = $root && is_array($content[self::IMPLICIT_COLLECTIONS] ?? null) ? $content[self::IMPLICIT_COLLECTIONS] : [];
        foreach ($content as $key => $value) {
            if ($root && ($key === self::IMPLICIT_COLLECTIONS || (in_array($key, $implicit, true) && self::draftOnly($value)))) {
                continue;
            }
            // A collection's status is enforced on the server, not only in JS.
            if (is_array($value) && array_is_list($value)) {
                $out[$key] = [];
                foreach ($value as $entry) {
                    if (is_array($entry) && array_key_exists('status', $entry)
                        && $entry['status'] !== 'Publik') {
                        continue;
                    }
                    $out[$key][] = is_array($entry) ? self::published($entry, false) : $entry;
                }
            } elseif (is_array($value)) {
                // Nested editorial records can also declare their own status.
                if (array_key_exists('status', $value) && $value['status'] !== 'Publik') {
                    continue;
                }
                $out[$key] = self::published($value, false);
            } else {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    public static function draftOnly(mixed $entries): bool
    {
        if (! is_array($entries) || $entries === [] || ! array_is_list($entries)) {
            return false;
        }
        foreach ($entries as $entry) {
            if (! is_array($entry) || ($entry['status'] ?? null) !== 'Draft') {
                return false;
            }
        }

        return true;
    }

    public static function references(array $data, string $url): bool
    {
        foreach ($data as $value) {
            if ($value === $url) {
                return true;
            }
            if (is_array($value) && self::references($value, $url)) {
                return true;
            }
        }

        return false;
    }
}

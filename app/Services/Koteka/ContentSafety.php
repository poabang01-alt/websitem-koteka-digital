<?php

namespace App\Services\Koteka;

final class ContentSafety
{
    private const URL_FIELDS = ['link', 'href', 'website', 'instagram', 'facebook', 'tiktok', 'download', 'orderLink', 'primaryLink', 'secondaryLink', 'ctaLink', 'mapLink', 'image', 'background'];

    /** @param array<array-key, mixed> $content */
    public static function invalidUrlPath(array $content, string $path = 'content', int $depth = 0): ?string
    {
        if ($depth > 64) {
            return $path;
        }
        foreach ($content as $key => $value) {
            $field = $path.'.'.$key;
            if (is_string($key) && in_array($key, self::URL_FIELDS, true) && $value !== null) {
                if (! is_string($value) || ! self::safeUrl($value, in_array($key, ['image', 'background'], true))) {
                    return $field;
                }
            }
            if (is_array($value) && ($invalid = self::invalidUrlPath($value, $field, $depth + 1)) !== null) {
                return $invalid;
            }
        }

        return null;
    }

    private static function safeUrl(string $value, bool $image): bool
    {
        if (preg_match('/[\x00-\x1f\x7f\\\\]/', $value)) {
            return false;
        }
        $value = trim($value);
        if ($value === '') {
            return true;
        }
        if (str_starts_with($value, '//')) {
            return false;
        }
        if (preg_match('~^(?:/|\.{1,2}/|#)~', $value)) {
            return true;
        }
        if (preg_match('~^https?://~i', $value)) {
            return filter_var($value, FILTER_VALIDATE_URL) !== false;
        }
        if (! $image && preg_match('~^(?:mailto:|tel:)~i', $value)) {
            return true;
        }

        return $image && preg_match('~^data:image/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$~D', $value) === 1;
    }
}

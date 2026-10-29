<?php

namespace App\Services\Koteka;

use App\Http\Controllers\Koteka\AccessController;
use App\Models\Koteka\AdminAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** Atomic publication/restore. Keeps the latest 50 successful server revisions. */
class ContentRevisionService
{
    public function commit(array $content, int $expectedVersion, ?AdminAccount $actor = null, ?int $restoreVersion = null): array
    {
        return DB::transaction(function () use ($content, $expectedVersion, $actor, $restoreVersion) {
            $row = DB::table('koteka_workspace_content')->where('id', 'published')->lockForUpdate()->first();
            $current = (int) ($row->version ?? 0);
            if ($current !== $expectedVersion) {
                return ['status' => 409, 'body' => ['error' => 'Versi konten sudah berubah. Muat ulang sebelum menyimpan.', 'version' => $current]];
            }
            $oldContent = $row ? json_decode($row->content_json, true) : [];
            $oldContent = is_array($oldContent) ? $oldContent : [];
            if ($restoreVersion === null) {
                $content = self::withDraftVisibility($oldContent, $content, $actor?->role);
            }

            // Always enforce permissions on the server, inside the same transaction
            // as the optimistic version check and the subsequent write.
            if ($actor && ! in_array($actor->role, ['super_admin', 'admin', 'operator'], true)) {
                return ['status' => 403, 'body' => ['error' => 'Peran akun tidak memiliki izin mengubah konten.']];
            }
            if ($actor && $restoreVersion !== null && $actor->role !== 'super_admin') {
                return ['status' => 403, 'body' => ['error' => 'Hanya Super Admin dapat memulihkan revisi.']];
            }
            if ($actor && $actor->role === 'operator') {
                // Operator may only change non-public draft content. Every public
                // field and published item must remain byte-value equivalent.
                if (self::publicProjection($oldContent) !== self::publicProjection($content)) {
                    return ['status' => 403, 'body' => [
                        'error' => 'Operator hanya dapat mengubah Draft. Publikasi dan perubahan konten publik memerlukan Admin.',
                    ]];
                }
            }

            if ($restoreVersion !== null) {
                $revision = DB::table('koteka_content_revisions')->where('version', $restoreVersion)->first();
                if (! $revision) {
                    return ['status' => 404, 'body' => ['error' => 'Revisi tidak ditemukan atau sudah melewati batas retensi 50 versi.']];
                }
                $content = json_decode($revision->content_json, true);
                if (! is_array($content) || (array_is_list($content) && count($content) > 0)) {
                    return ['status' => 422, 'body' => ['error' => 'Format snapshot revisi tidak valid.']];
                }
            }

            if (($invalidPath = ContentSafety::invalidUrlPath($content)) !== null) {
                return ['status' => 422, 'body' => ['error' => 'Tautan atau struktur konten tidak aman: '.$invalidPath]];
            }
            $json = json_encode($content, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE);
            if ($json === false || strlen($json) > 3 * 1024 * 1024) {
                return ['status' => 413, 'body' => ['error' => 'Konten terlalu besar (maksimal 3 MB).']];
            }
            $previous = $row ? json_decode($row->content_json, true) : [];
            $previousReferences = is_array($previous) ? self::mediaReferences($previous) : [];
            if (is_array($previous)) {
                foreach (DB::table('koteka_content_revisions')->select(['version', 'content_json'])->orderBy('version')->lazy(1) as $revision) {
                    $snapshot = json_decode($revision->content_json, true);
                    if (! is_array($snapshot)) {
                        continue;
                    }
                    $previousReferences += self::mediaReferences($snapshot);
                    $purged = self::purgeRemovedContent($previous, $content, $snapshot);
                    if ($purged !== $snapshot) {
                        DB::table('koteka_content_revisions')->where('version', $revision->version)->update([
                            'content_json' => json_encode($purged, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE),
                        ]);
                    }
                }
            }
            $next = $current + 1;
            if ($row) {
                DB::table('koteka_workspace_content')->where('id', 'published')->update([
                    'content_json' => $json, 'version' => $next, 'updated_at' => now(),
                ]);
            } else {
                DB::table('koteka_workspace_content')->insert([
                    'id' => 'published', 'content_json' => $json, 'version' => $next, 'updated_at' => now(),
                ]);
            }
            DB::table('koteka_content_revisions')->insert([
                'version' => $next, 'content_json' => $json,
                'actor_id' => $actor?->id, 'action' => $restoreVersion === null ? 'publish' : 'restore',
                'restored_from_version' => $restoreVersion, 'created_at' => now(),
            ]);
            // SQLite requires LIMIT when using OFFSET. Keep the newest 50
            // snapshots using a bounded query that works on SQLite and MySQL.
            $keptVersions = DB::table('koteka_content_revisions')
                ->orderByDesc('version')->limit(50)->pluck('version');
            if ($keptVersions->count() === 50) {
                DB::table('koteka_content_revisions')
                    ->where('version', '<', (int) $keptVersions->last())->delete();
            }
            if (is_array($previous)) {
                $this->removeUnusedMedia($previousReferences, $content);
            }
            if ($actor) {
                AccessController::log($actor, 'CMS', $restoreVersion === null
                    ? 'Mempublikasikan konten Workspace versi '.$next
                    : 'Memulihkan konten dari versi '.$restoreVersion.' sebagai versi '.$next);
            }

            return ['status' => 200, 'body' => ['ok' => true, 'version' => $next, 'content' => $content]];
        }, 3);
    }

    private static function publicProjection(array $content): array
    {
        return self::canonicalContent(PublicContentService::published($content));
    }

    /**
     * Preserve public defaults while Operators create or remove unpublished draft collections.
     * The visibility marker is derived by the server and cannot be supplied by a client.
     *
     * @param  array<array-key, mixed>  $previous
     * @param  array<array-key, mixed>  $content
     * @return array<array-key, mixed>
     */
    private static function withDraftVisibility(array $previous, array $content, ?string $role): array
    {
        $marker = PublicContentService::IMPLICIT_COLLECTIONS;
        $oldImplicit = is_array($previous[$marker] ?? null) ? $previous[$marker] : [];
        unset($content[$marker]);
        $implicit = [];
        foreach ($content as $key => $value) {
            if ($role === 'operator' && $value === [] && in_array($key, $oldImplicit, true)) {
                unset($content[$key]);

                continue;
            }
            if (PublicContentService::draftOnly($value)
                && (in_array($key, $oldImplicit, true) || ($role === 'operator' && ! array_key_exists($key, $previous)))) {
                $implicit[] = $key;
            }
        }
        if ($implicit !== []) {
            $content[$marker] = $implicit;
        }

        return $content;
    }

    /**
     * Remove deleted fields and records from retained snapshots without discarding unrelated history.
     *
     * @param  array<array-key, mixed>  $previous
     * @param  array<array-key, mixed>  $current
     * @param  array<array-key, mixed>  $snapshot
     * @return array<array-key, mixed>
     */
    private static function purgeRemovedContent(array $previous, array $current, array $snapshot, bool $root = true): array
    {
        if (array_is_list($previous) && array_is_list($current) && array_is_list($snapshot)) {
            $oldEntries = [];
            $newEntries = [];
            foreach ($previous as $entry) {
                $oldEntries[self::recordKey($entry)] ??= $entry;
            }
            foreach ($current as $entry) {
                $newEntries[self::recordKey($entry)] ??= $entry;
            }
            $result = [];
            foreach ($snapshot as $entry) {
                $key = self::recordKey($entry);
                $wasPresent = array_key_exists($key, $oldEntries);
                $isPresent = array_key_exists($key, $newEntries);
                if ($wasPresent && ! $isPresent) {
                    continue;
                }
                $oldEntry = $oldEntries[$key] ?? null;
                $newEntry = $newEntries[$key] ?? null;
                $result[] = $wasPresent && $isPresent && is_array($entry) && is_array($oldEntry) && is_array($newEntry)
                    ? self::purgeRemovedContent($oldEntry, $newEntry, $entry, false) : $entry;
            }

            return $result;
        }
        foreach ($previous as $key => $value) {
            if ($root && $key === PublicContentService::IMPLICIT_COLLECTIONS) {
                continue;
            }
            if (! array_key_exists($key, $current)) {
                unset($snapshot[$key]);
            } elseif (is_array($value) && is_array($current[$key]) && isset($snapshot[$key]) && is_array($snapshot[$key])) {
                $snapshot[$key] = self::purgeRemovedContent($value, $current[$key], $snapshot[$key], false);
            }
        }

        return $snapshot;
    }

    private static function recordKey(mixed $entry): string
    {
        return is_array($entry) && isset($entry['_id'])
            ? 'id:'.serialize($entry['_id']) : 'value:'.serialize($entry);
    }

    /**
     * Release uploaded media only after its final content and revision references are removed.
     *
     * @param  array<array-key, mixed>  $previous
     * @param  array<array-key, mixed>  $current
     */
    private function removeUnusedMedia(array $previous, array $current): void
    {
        $retainedReferences = self::mediaReferences($current);
        foreach (DB::table('koteka_content_revisions')->select('version', 'content_json')->orderBy('version')->lazy(1) as $revision) {
            $snapshot = json_decode($revision->content_json, true);
            if (is_array($snapshot)) {
                $retainedReferences += self::mediaReferences($snapshot);
            }
        }
        foreach (DB::table('koteka_media')->select(['id', 'storage_path'])->lazyById(100) as $media) {
            $url = '/api/koteka-media/'.$media->id;
            if (! isset($previous[$url]) || isset($retainedReferences[$url])) {
                continue;
            }
            DB::table('koteka_media')->where('id', $media->id)->delete();
            DB::afterCommit(function () use ($media): void {
                if (! Storage::disk('local')->delete($media->storage_path)) {
                    report(new \RuntimeException('Media tidak dapat dihapus: '.$media->id));
                }
            });
        }
    }

    /**
     * @param  array<array-key, mixed>  $content
     * @return array<string, true>
     */
    private static function mediaReferences(array $content): array
    {
        $references = [];
        foreach ($content as $value) {
            if (is_array($value)) {
                $references += self::mediaReferences($value);
            } elseif (is_string($value) && str_starts_with($value, '/api/koteka-media/')) {
                $references[$value] = true;
            }
        }

        return $references;
    }

    /** Normalize object key order while preserving empty collections, value types and list order. */
    private static function canonicalContent(array $content): array
    {
        $result = [];
        foreach ($content as $key => $value) {
            if (is_array($value)) {
                $value = self::canonicalContent($value);
            }
            $result[$key] = $value;
        }

        if (! array_is_list($result)) {
            ksort($result);
        }

        return $result;
    }
}

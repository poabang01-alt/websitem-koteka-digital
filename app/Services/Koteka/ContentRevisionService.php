<?php

namespace App\Services\Koteka;

use App\Http\Controllers\Koteka\AccessController;
use App\Models\Koteka\AdminAccount;
use Illuminate\Support\Facades\DB;

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

            // Always enforce permissions on the server, inside the same transaction
            // as the optimistic version check and the subsequent write.
            if ($actor && ! in_array($actor->role, ['super_admin', 'admin', 'operator'], true)) {
                return ['status' => 403, 'body' => ['error' => 'Peran akun tidak memiliki izin mengubah konten.']];
            }
            if ($actor && $restoreVersion !== null && $actor->role !== 'super_admin') {
                return ['status' => 403, 'body' => ['error' => 'Hanya Super Admin dapat memulihkan revisi.']];
            }
            if ($actor && $actor->role === 'operator') {
                $oldContent = $row ? json_decode($row->content_json, true) : [];
                $oldContent = is_array($oldContent) ? $oldContent : [];
                // Operator may only change non-public draft content. Every public
                // field and published item must remain byte-value equivalent.
                // Empty collections in the projection are semantically absent.
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

            $json = json_encode($content, JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE);
            if ($json === false || strlen($json) > 3 * 1024 * 1024) {
                return ['status' => 413, 'body' => ['error' => 'Konten terlalu besar (maksimal 3 MB).']];
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
        return self::withoutEmptyCollections(PublicContentService::published($content));
    }

    /** Normalize object key order and empty collections while preserving value types and list order. */
    private static function withoutEmptyCollections(array $content): array
    {
        $result = [];
        foreach ($content as $key => $value) {
            if (is_array($value)) {
                $value = self::withoutEmptyCollections($value);
                if ($value === []) {
                    continue;
                }
            }
            $result[$key] = $value;
        }

        if (! array_is_list($result)) {
            ksort($result);
        }

        return $result;
    }
}

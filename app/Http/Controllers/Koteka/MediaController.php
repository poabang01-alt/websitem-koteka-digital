<?php

namespace App\Http\Controllers\Koteka;

use App\Services\Koteka\PublicContentService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    public function index(Request $request)
    {
        if (! AccessController::actor($request)) {
            return AccessController::jsonError(401, 'Login Admin diperlukan.');
        }
        $items = DB::table('koteka_media')->orderByDesc('created_at')->limit(100)->get()
            ->map(fn ($item) => $this->present($item));

        return response()->json(['items' => $items])->header('Cache-Control', 'no-store');
    }

    public function upload(Request $request)
    {
        $actor = AccessController::actor($request);
        if (! $actor) {
            return AccessController::jsonError(401, 'Login Admin diperlukan.');
        }
        $limitKey = 'koteka:upload:'.$actor->id;
        if (RateLimiter::tooManyAttempts($limitKey, 20)) {
            return AccessController::jsonError(429, 'Terlalu banyak unggahan. Coba kembali sebentar lagi.');
        }
        RateLimiter::hit($limitKey, 60);
        $request->validate(['image' => [
            'required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048',
            'dimensions:max_width=3000,max_height=3000',
        ]]);
        $file = $request->file('image');
        $mime = $file->getMimeType();
        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            return AccessController::jsonError(422, 'Tipe gambar tidak diperbolehkan.');
        }
        // A private disk prevents draft-only uploads from being publicly readable.
        $path = $file->store('koteka-media', 'local');
        if (! is_string($path) || $path === '') {
            return AccessController::jsonError(500, 'File gagal disimpan.');
        }
        $id = (string) Str::uuid();
        try {
            DB::table('koteka_media')->insert([
                'id' => $id, 'storage_path' => $path, 'mime_type' => $mime,
                'byte_size' => (int) $file->getSize(), 'uploaded_by' => $actor->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            AccessController::log($actor, 'Media', 'Mengunggah gambar Workspace '.$id);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
        $record = DB::table('koteka_media')->where('id', $id)->first();

        return response()->json(['ok' => true, 'item' => $this->present($record), 'url' => $this->url($id)], 201)
            ->header('Cache-Control', 'no-store');
    }

    public function show(Request $request, string $id)
    {
        $item = DB::table('koteka_media')->where('id', $id)->first();
        abort_unless($item, 404);
        if (! AccessController::actor($request) && ! $this->isPublished($this->url($id))) {
            abort(404);
        }
        abort_unless(Storage::disk('local')->exists($item->storage_path), 404);

        return Storage::disk('local')->response($item->storage_path, null, [
            'Content-Type' => $item->mime_type,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function delete(Request $request, string $id)
    {
        $actor = AccessController::actor($request);
        if (! $actor) {
            return AccessController::jsonError(401, 'Login Admin diperlukan.');
        }
        if ($actor->role !== 'super_admin') {
            return AccessController::jsonError(403, 'Hanya Super Admin dapat menghapus media.');
        }
        $item = DB::table('koteka_media')->where('id', $id)->first();
        if (! $item) {
            return AccessController::jsonError(404, 'Media tidak ditemukan.');
        }
        $url = $this->url($id);
        $current = DB::table('koteka_workspace_content')->where('id', 'published')->value('content_json');
        if ($this->referencesJson($current, $url)) {
            return AccessController::jsonError(409, 'Media masih digunakan dalam konten.');
        }
        // Read the decoded snapshots: JSON may escape slashes, so LIKE on raw JSON is unsafe.
        foreach (DB::table('koteka_content_revisions')->select('content_json')->orderBy('version')->lazy(5) as $revision) {
            if ($this->referencesJson($revision->content_json, $url)) {
                return AccessController::jsonError(409, 'Media masih digunakan pada riwayat revisi.');
            }
        }
        DB::table('koteka_media')->where('id', $id)->delete();
        Storage::disk('local')->delete($item->storage_path);
        AccessController::log($actor, 'Media', 'Menghapus media yang tidak digunakan '.$id);

        return response()->json(['ok' => true]);
    }

    private function url(string $id): string
    {
        return '/api/koteka-media/'.$id;
    }

    private function present(object $item): array
    {
        return ['id' => $item->id, 'url' => $this->url($item->id),
            'mimeType' => $item->mime_type, 'byteSize' => (int) $item->byte_size,
            'createdAt' => $item->created_at, ];
    }

    private function referencesJson($json, string $url): bool
    {
        $content = is_string($json) ? json_decode($json, true) : [];

        return is_array($content) && PublicContentService::references($content, $url);
    }

    private function isPublished(string $url): bool
    {
        $json = DB::table('koteka_workspace_content')->where('id', 'published')->value('content_json');
        $content = is_string($json) ? json_decode($json, true) : [];

        return is_array($content) && PublicContentService::references(PublicContentService::published($content), $url);
    }
}

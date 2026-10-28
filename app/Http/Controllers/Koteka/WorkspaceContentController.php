<?php

namespace App\Http\Controllers\Koteka;

use App\Services\Koteka\ContentRevisionService;
use App\Services\Koteka\PublicContentService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

class WorkspaceContentController extends Controller
{
    public function index(Request $request)
    {
        $row = DB::table('koteka_workspace_content')->where('id', 'published')->first();
        $data = $row ? json_decode($row->content_json, true) : [];
        $data = is_array($data) ? $data : [];
        // The editor needs the complete snapshot; anonymous readers only receive published entries.
        $editor = $request->header('X-Koteka-Editor') === '1' && (bool) AccessController::actor($request);
        if (!$editor) $data = PublicContentService::published($data);
        return response()->json(['content' => $data,
            'version' => (int) ($row->version ?? 0), 'updatedAt' => $row->updated_at ?? null])
            ->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, ContentRevisionService $revisions)
    {
        $actor = AccessController::actor($request);
        if (!$actor) return AccessController::jsonError(401, 'Login server diperlukan untuk mempublikasikan konten.');
        $content = $request->input('content');
        $version = $request->input('version');
        if (!is_array($content) || (array_is_list($content) && count($content) > 0)
            || !is_int($version) || $version < 0) {
            return AccessController::jsonError(422, 'Konten atau versinya tidak valid.');
        }
        $result = $revisions->commit($content, $version, $actor);
        return response()->json($result['body'], $result['status'])->header('Cache-Control', 'no-store');
    }

    public function history(Request $request)
    {
        $actor = AccessController::actor($request);
        if (!$actor) return AccessController::jsonError(401, 'Login server diperlukan.');
        if ($actor->role !== 'super_admin') return AccessController::jsonError(403, 'Hanya Super Admin yang dapat melihat riwayat revisi.');
        $items = DB::table('koteka_content_revisions')->orderByDesc('version')->limit(50)
            ->get(['version', 'actor_id', 'action', 'restored_from_version', 'created_at']);
        return response()->json(['items' => $items, 'maxRetained' => 50])->header('Cache-Control', 'no-store');
    }

    public function restore(Request $request, ContentRevisionService $revisions)
    {
        $actor = AccessController::actor($request);
        if (!$actor) return AccessController::jsonError(401, 'Login server diperlukan.');
        if ($actor->role !== 'super_admin') return AccessController::jsonError(403, 'Hanya Super Admin yang dapat memulihkan revisi.');
        $input = $request->validate([
            'revision' => ['required', 'integer', 'min:1'],
            'expectedVersion' => ['required', 'integer', 'min:0'],
            'confirmed' => ['required', 'accepted'],
        ]);
        $result = $revisions->commit([], (int) $input['expectedVersion'], $actor, (int) $input['revision']);
        return response()->json($result['body'], $result['status'])->header('Cache-Control', 'no-store');
    }
}

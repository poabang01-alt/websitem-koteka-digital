<?php

namespace App\Http\Controllers\Koteka;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    public function destroy(Request $request): JsonResponse
    {
        $actor = AccessController::actor($request);
        abort_unless($actor, 401, 'Silakan masuk kembali.');
        abort_unless($actor->role === 'super_admin', 403, 'Hanya Super Admin dapat menghapus log.');

        $input = $request->validate([
            'scope' => ['required', Rule::in(['admin', 'visitor', 'all'])],
            'confirmed' => ['required', 'accepted'],
            'all' => ['sometimes', 'boolean'],
            'ids' => [Rule::requiredIf(! $request->boolean('all')), 'prohibited_if:all,true', 'array', 'list', 'min:1', 'max:500'],
            'ids.*' => ['required', 'uuid', 'distinct'],
        ]);
        abort_if($input['scope'] === 'all' && ! $request->boolean('all'), 422, 'Pilih jenis log untuk menghapus per baris.');

        return DB::transaction(function () use ($request, $input, $actor): JsonResponse {
            $deleted = 0;
            $tables = match ($input['scope']) {
                'admin' => ['koteka_admin_activities'],
                'visitor' => ['koteka_visit_events'],
                'all' => ['koteka_admin_activities', 'koteka_visit_events'],
            };
            foreach ($tables as $table) {
                $query = DB::table($table);
                if (! $request->boolean('all')) {
                    $query->whereIn('id', $input['ids']);
                }
                $deleted += $query->delete();
            }
            if ($deleted > 0) {
                AccessController::log($actor, 'Log Aktivitas', 'Menghapus permanen '.$deleted.' log ('.$input['scope'].').');
            }

            return response()->json(['ok' => true, 'deleted' => $deleted])->header('Cache-Control', 'no-store');
        });
    }
}

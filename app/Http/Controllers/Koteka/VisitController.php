<?php

namespace App\Http\Controllers\Koteka;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\{DB, RateLimiter};
use Illuminate\Support\Carbon;

/** Lightweight, first-party page-view counter. No IP or user-agent is persisted. */
class VisitController extends Controller
{
    public function handle(Request $request)
    {
        if ($request->isMethod('get')) {
            if (!AccessController::actor($request)) {
                return AccessController::jsonError(401, 'Login Workspace diperlukan.');
            }
            $items = DB::table('koteka_visit_events')
                ->where('visited_at', '>=', now()->subDays(90))
                ->orderByDesc('visited_at')->limit(5001)
                ->get(['id', 'page', 'channel', 'device', 'session_key', 'visited_at']);
            $truncated = $items->count() > 5000;
            return response()->json([
                'items' => $items->take(5000)->map(fn ($v) => [
                    'id' => $v->id,
                    'date' => Carbon::parse($v->visited_at)->toISOString(),
                    'page' => $v->page, 'channel' => $v->channel,
                    'device' => $v->device, 'session' => $v->session_key,
                    'views' => 1, 'source' => 'server',
                ])->values(),
                'truncated' => $truncated,
                'windowDays' => 90,
            ])->header('Cache-Control', 'no-store');
        }

        $key = 'koteka:visit:'.hash('sha256', (string) $request->ip());
        if (RateLimiter::tooManyAttempts($key, 120)) {
            return AccessController::jsonError(429, 'Batas pencatatan kunjungan tercapai.');
        }
        $input = $request->validate([
            'id' => ['required', 'uuid'],
            'page' => ['required', 'string', 'max:255', 'regex:~^/(?!/)~'],
            'session' => ['required', 'string', 'regex:/^[a-zA-Z0-9_-]{16,80}$/'],
            'channel' => ['required', 'in:Direct,Organic Search,Social Media,Referral'],
            'device' => ['required', 'in:Desktop,Mobile,Tablet'],
        ]);
        // Never persist query strings or fragments (they may contain sensitive data).
        $path = parse_url($input['page'], PHP_URL_PATH);
        if (!is_string($path) || !str_starts_with($path, '/') || str_starts_with($path, '//')) {
            return AccessController::jsonError(422, 'Halaman tidak valid.');
        }
        if (preg_match('~^/admin(?:/|$)~i', $path)) {
            return response()->json(['ok' => true, 'tracked' => false])->header('Cache-Control', 'no-store');
        }
        RateLimiter::hit($key, 3600);
        $inserted = DB::table('koteka_visit_events')->insertOrIgnore([
            'id' => $input['id'],
            'page' => mb_substr($path, 0, 255),
            'session_key' => $input['session'],
            'channel' => $input['channel'], 'device' => $input['device'],
            'visited_at' => now(),
        ]);
        return response()->json(['ok' => true, 'tracked' => (bool) $inserted], $inserted ? 201 : 200)
            ->header('Cache-Control', 'no-store');
    }
}

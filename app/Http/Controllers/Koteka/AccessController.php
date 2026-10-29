<?php

namespace App\Http\Controllers\Koteka;

use App\Models\Koteka\Activity;
use App\Models\Koteka\AdminAccount;
use App\Models\Koteka\Lead;
use App\Services\Koteka\WorkspacePassword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AccessController extends Controller
{
    public static function actor(Request $request): ?AdminAccount
    {
        $id = $request->session()->get('koteka_admin_id');
        $version = $request->session()->get('koteka_admin_version');
        if (! is_string($id) || ! is_numeric($version)) {
            return null;
        }

        return AdminAccount::query()->whereKey($id)->where('active', true)->where('version', (int) $version)->first();
    }

    private function authorized(Request $request, bool $superOnly = false): AdminAccount
    {
        $account = self::actor($request);
        abort_unless($account, 401, 'Login server diperlukan.');
        abort_if($superOnly && $account->role !== 'super_admin', 403, 'Hanya Super Admin yang dapat mengakses bagian ini.');

        return $account;
    }

    public static function jsonError(int $code, string $message): JsonResponse
    {
        return response()->json(['error' => $message], $code)->header('Cache-Control', 'no-store');
    }

    public static function log(AdminAccount $actor, string $module, string $description): Activity
    {
        return Activity::create([
            'user' => $actor->publicData(), 'role' => $actor->role,
            'module' => mb_substr($module, 0, 80),
            'description' => mb_substr($description, 0, 1000), 'date' => now(),
        ]);
    }

    private function activityItems(): Collection
    {
        return Activity::query()->orderByDesc('date')->limit(500)->get()->map->publicData();
    }

    public function session(Request $request): JsonResponse
    {
        if ($request->isMethodSafe()) {
            return response()->json(['authenticated' => (bool) ($user = self::actor($request)),
                'user' => $user?->publicData()])->header('Cache-Control', 'no-store');
        }
        if ($request->isMethod('delete')) {
            if ($user = self::actor($request)) {
                self::log($user, 'Autentikasi', 'Keluar dari Workspace.');
            }
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['authenticated' => false, 'user' => null])->header('X-Koteka-CSRF', csrf_token());
        }
        $input = $request->validate(['email' => 'required|string|max:120', 'password' => 'required|string|max:128']);
        $email = mb_strtolower(trim($input['email']));
        $key = 'koteka:login:'.hash('sha256', $request->ip().'|'.$email);
        $ipKey = 'koteka:login-ip:'.hash('sha256', (string) $request->ip());
        if (RateLimiter::tooManyAttempts($ipKey, 30)) {
            return self::jsonError(429, 'Terlalu banyak percobaan login. Coba lagi nanti.');
        }
        if (RateLimiter::tooManyAttempts($key, 6)) {
            return self::jsonError(429, 'Terlalu banyak percobaan login. Coba lagi nanti.');
        }
        $user = AdminAccount::query()->where('email', $email)->where('active', true)->first();
        if (! $user || ! WorkspacePassword::verify($input['password'], $user->password)) {
            RateLimiter::hit($key, 300);
            RateLimiter::hit($ipKey, 300);

            return self::jsonError(401, 'Email atau kata sandi tidak cocok.');
        }
        RateLimiter::clear($key);
        $request->session()->regenerate();
        $request->session()->put(['koteka_admin_id' => $user->id, 'koteka_admin_version' => $user->version]);
        self::log($user, 'Autentikasi', 'Masuk ke Workspace.');

        // Session regeneration rotates the CSRF token. Send the fresh token
        // so the frontend bridge can update the meta tag before the next POST.
        return response()->json(['authenticated' => true, 'user' => $user->publicData()])
            ->header('Cache-Control', 'no-store')
            ->header('X-Koteka-CSRF', csrf_token());
    }

    public function accounts(Request $request): JsonResponse
    {
        $user = $this->authorized($request, true);
        if ($request->isMethodSafe()) {
            return response()->json([
                'items' => AdminAccount::query()->orderByRaw("CASE WHEN role = 'super_admin' THEN 0 ELSE 1 END")->orderBy('name')->get()->map->publicData(),
            ]);
        }
        $data = $request->all();
        if (array_key_exists('email', $data) && ! is_string($data['email'])) {
            return self::jsonError(422, 'Email akun tidak valid.');
        }
        if (isset($data['email']) && is_string($data['email'])) {
            $data['email'] = mb_strtolower(trim($data['email']));
        }
        if (isset($data['id']) && AdminAccount::whereKey($data['id'])->where('role', 'super_admin')->exists()) {
            return self::jsonError(403, 'Akun Super Admin utama dilindungi.');
        }
        if ($request->isMethod('post')) {
            $v = Validator::make($data, [
                'name' => 'required|string|min:2|max:80', 'email' => 'required|email|max:120|unique:koteka_admin_accounts,email',
                'role' => 'required|in:admin,operator', 'active' => 'required|boolean',
                'password' => 'required|string|min:12|max:128',
            ]);
            if ($v->fails()) {
                return self::jsonError(422, 'Nama, email, peran, status, atau password (12-128 karakter) tidak valid.');
            }
            $account = DB::transaction(function () use ($data, $user) {
                $account = AdminAccount::create([
                    'name' => trim($data['name']), 'email' => mb_strtolower(trim($data['email'])),
                    'role' => $data['role'], 'active' => (bool) $data['active'],
                    'password' => WorkspacePassword::hash($data['password']), 'version' => 1,
                ]);
                self::log($user, 'accounts', 'Membuat akun '.$account->email);

                return $account;
            });

            return response()->json(['ok' => true, 'item' => $account->publicData()], 201);
        }
        if (! isset($data['id']) || ! is_string($data['id']) ||
            ! isset($data['expectedVersion']) || ! is_int($data['expectedVersion']) || $data['expectedVersion'] < 1) {
            return self::jsonError(422, 'ID akun dan versi akun valid diperlukan.');
        }

        return DB::transaction(function () use ($request, $data, $user) {
            $account = AdminAccount::query()->lockForUpdate()->find($data['id']);
            if (! $account) {
                return self::jsonError(404, 'Akun tidak ditemukan.');
            }
            if ($account->role === 'super_admin') {
                return self::jsonError(403, 'Akun Super Admin dilindungi.');
            }
            if ($account->version !== $data['expectedVersion']) {
                return self::jsonError(409, 'Akun telah berubah. Muat ulang sebelum menyimpan.');
            }
            if ($request->isMethod('delete')) {
                $email = $account->email;
                $account->fill(['active' => false, 'version' => $account->version + 1])->save();
                $account->delete();
                self::log($user, 'accounts', 'Menghapus akun '.$email);

                return response()->json(['ok' => true, 'item' => ['id' => $data['id']]]);
            }
            $merged = [
                'name' => $data['name'] ?? $account->name,
                'email' => mb_strtolower(trim((string) ($data['email'] ?? $account->email))),
                'role' => $data['role'] ?? $account->role,
                'active' => $data['active'] ?? $account->active,
            ];
            $v = Validator::make($merged, [
                'name' => 'required|string|min:2|max:80',
                'email' => 'required|email|max:120|unique:koteka_admin_accounts,email,'.$account->id.',id',
                'role' => 'required|in:admin,operator', 'active' => 'required|boolean',
            ]);
            if ($v->fails()) {
                return self::jsonError(422, 'Nama, email, peran, atau status akun tidak valid.');
            }
            if (array_key_exists('password', $data) && $data['password'] !== '') {
                if (! is_string($data['password']) || strlen($data['password']) < 12 || strlen($data['password']) > 128) {
                    return self::jsonError(422, 'Password harus terdiri atas 12-128 karakter.');
                }
                $merged['password'] = WorkspacePassword::hash($data['password']);
            }
            $account->fill([...$merged, 'version' => $account->version + 1])->save();
            self::log($user, 'accounts', 'Memperbarui akun '.$account->email);

            return response()->json(['ok' => true, 'item' => $account->publicData()]);
        });
    }

    public function activity(Request $request): JsonResponse
    {
        $user = $this->authorized($request);
        if ($request->isMethodSafe()) {
            abort_unless($user->role === 'super_admin', 403, 'Hanya Super Admin dapat melihat riwayat aktivitas.');

            return response()->json(['items' => $this->activityItems()]);
        }
        $v = Validator::make($request->all(), ['module' => 'required|string|max:80', 'description' => 'required|string|max:1000']);
        if ($v->fails()) {
            return self::jsonError(422, 'Modul atau deskripsi aktivitas tidak valid.');
        }
        $activity = self::log($user, $request->input('module'), $request->input('description'));

        return response()->json(['ok' => true, 'item' => $activity->publicData()], 201);
    }

    /** Inbox contains names, phone numbers and customer enquiries. Operator has no access. */
    private function inboxActor(Request $request): AdminAccount
    {
        $user = $this->authorized($request);
        abort_unless(in_array($user->role, ['super_admin', 'admin'], true), 403,
            'Inbox hanya tersedia bagi Super Admin dan Admin.');

        return $user;
    }

    public function inbox(Request $request): JsonResponse
    {
        $user = $this->inboxActor($request);
        if ($request->isMethod('delete')) {
            $input = $request->validate([
                'confirmed' => ['required', 'accepted'],
                'all' => ['sometimes', 'boolean'],
                'ids' => [Rule::requiredIf(! $request->boolean('all')), 'prohibited_if:all,true', 'array', 'list', 'min:1', 'max:2000'],
                'ids.*' => ['required', 'uuid', 'distinct'],
            ]);

            return DB::transaction(function () use ($request, $input, $user) {
                $query = Lead::query();
                if (! $request->boolean('all')) {
                    $query->whereIn('id', $input['ids']);
                }
                $ids = $query->lockForUpdate()->pluck('id');
                DB::table('koteka_reply_receipts')->whereIn('lead_id', $ids)->delete();
                $deleted = Lead::query()->whereIn('id', $ids)->delete();
                if ($deleted > 0) {
                    self::log($user, 'Pesan Masuk', 'Menghapus permanen '.$deleted.' pesan konsultasi.');
                }

                return response()->json(['ok' => true, 'deleted' => $deleted])->header('Cache-Control', 'no-store');
            });
        }
        if ($request->isMethodSafe()) {
            $items = Lead::query()->latest()->limit(2000)->get()->map->publicData();

            return response()->json(['items' => $items, 'user' => $user->publicData(),
                'unread' => Lead::query()->where('read', false)->count(),
                'integrations' => [
                    'email' => (bool) (config('koteka.resend_api_key') && config('koteka.notify_email') && config('koteka.from_email')),
                    'whatsapp' => (bool) (config('koteka.meta_wa_token') && config('koteka.meta_wa_phone_id') && config('koteka.meta_wa_to') && config('koteka.meta_wa_template')),
                ]]);
        }
        if (! is_string($request->input('id')) || ! $request->input('id')) {
            return self::jsonError(422, 'ID pesan tidak valid.');
        }
        $lead = Lead::query()->find($request->input('id'));
        if (! $lead) {
            return self::jsonError(404, 'Pesan tidak ditemukan.');
        }
        $lead->read = true;
        $lead->save();

        return response()->json(['ok' => true, 'id' => $lead->id]);
    }

    public function reply(Request $request): JsonResponse
    {
        $user = $this->inboxActor($request);
        $data = $request->all();
        $v = Validator::make($data, [
            'id' => 'required|string|max:200', 'channel' => 'required|in:whatsapp_confirm',
            'confirmed' => 'required|accepted', 'text' => 'required|string|min:3|max:5000',
            'requestId' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{8,128}$/'],
        ]);
        if ($v->fails()) {
            return self::jsonError(422, 'Konfirmasi terkirim, pesan, dan ID permintaan valid diperlukan.');
        }
        $text = trim($data['text']);
        $fingerprint = hash('sha256', json_encode([$data['id'], $data['channel'], $text, $user->id]));

        return DB::transaction(function () use ($user, $data, $text, $fingerprint) {
            $old = DB::table('koteka_reply_receipts')->where('request_id', $data['requestId'])->first();
            if ($old) {
                if ($old->fingerprint !== $fingerprint) {
                    return self::jsonError(409, 'ID permintaan dipakai untuk balasan lain.');
                }

                return response()->json(['ok' => true, 'item' => json_decode($old->item, true)]);
            }
            $lead = Lead::query()->lockForUpdate()->find($data['id']);
            if (! $lead) {
                return self::jsonError(404, 'Pesan tidak ditemukan.');
            }
            $event = self::log($user, 'inbox', 'Mengonfirmasi balasan WhatsApp untuk pesan '.$lead->id);
            $reply = ['id' => $data['requestId'], 'requestId' => $data['requestId'], 'text' => $text,
                'channel' => $data['channel'], 'date' => $event->date?->toISOString(), 'user' => $user->publicData()];
            $lead->read = true;
            $lead->replied = true;
            $lead->replied_at = now();
            $lead->replied_by = $user->publicData();
            $lead->reply_channel = $data['channel'];
            $lead->replies = array_slice([$reply, ...($lead->replies ?? [])], 0, 20);
            $lead->save();
            $item = $lead->publicData();
            DB::table('koteka_reply_receipts')->insert([
                'request_id' => $data['requestId'], 'lead_id' => $lead->id, 'fingerprint' => $fingerprint,
                'item' => json_encode($item), 'created_at' => now(),
            ]);

            return response()->json(['ok' => true, 'item' => $item]);
        });
    }
}

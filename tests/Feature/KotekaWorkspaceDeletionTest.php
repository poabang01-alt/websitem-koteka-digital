<?php

namespace Tests\Feature;

use App\Models\Koteka\Activity;
use App\Models\Koteka\AdminAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class KotekaWorkspaceDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $role = 'super_admin'): AdminAccount
    {
        $account = AdminAccount::create([
            'name' => 'Workspace '.$role, 'email' => $role.'@example.invalid',
            'password' => Hash::make('Workspace-Secure-2026!'),
            'role' => $role, 'active' => true, 'version' => 1,
        ]);
        $this->postJson('/api/admin-session', [
            'email' => $account->email, 'password' => 'Workspace-Secure-2026!',
        ])->assertOk();

        return $account;
    }

    public function test_log_deletion_requires_authentication(): void
    {
        $this->deleteJson('/api/activity-logs', ['scope' => 'all', 'all' => true, 'confirmed' => true])->assertUnauthorized();
    }

    #[TestWith(['admin'])]
    #[TestWith(['operator'])]
    public function test_only_super_admin_can_delete_logs(string $role): void
    {
        $this->login($role);
        $this->deleteJson('/api/activity-logs', ['scope' => 'all', 'all' => true, 'confirmed' => true])->assertForbidden();
        $this->assertDatabaseCount('koteka_admin_activities', 1);
    }

    public function test_log_deletion_is_scoped_and_validates_confirmation_and_ids(): void
    {
        $this->login();
        $activityId = Activity::query()->value('id');
        $visitId = (string) Str::uuid();
        DB::table('koteka_visit_events')->insert([
            'id' => $visitId, 'page' => '/', 'session_key' => 'test_session_123456',
            'device' => 'Desktop', 'channel' => 'Direct', 'visited_at' => now(),
        ]);
        foreach ([
            ['scope' => 'all', 'all' => true],
            ['scope' => 'admin', 'ids' => ['invalid'], 'confirmed' => true],
            ['scope' => 'admin', 'confirmed' => true],
            ['scope' => 'all', 'ids' => [$activityId], 'confirmed' => true],
        ] as $payload) {
            $this->deleteJson('/api/activity-logs', $payload)->assertUnprocessable();
        }
        $this->assertDatabaseHas('koteka_admin_activities', ['id' => $activityId]);
        $this->deleteJson('/api/activity-logs', ['scope' => 'visitor', 'ids' => [$visitId], 'confirmed' => true])
            ->assertOk()->assertJsonPath('deleted', 1);
        $this->assertDatabaseMissing('koteka_visit_events', ['id' => $visitId]);
        $this->assertDatabaseHas('koteka_admin_activities', ['id' => $activityId]);
        $this->deleteJson('/api/activity-logs', ['scope' => 'admin', 'ids' => [$activityId], 'confirmed' => true])
            ->assertOk()->assertJsonPath('deleted', 1);
        $this->assertDatabaseMissing('koteka_admin_activities', ['id' => $activityId]);
    }

    public function test_account_deletion_retains_row_and_revokes_existing_session(): void
    {
        $super = $this->login();
        $account = AdminAccount::create([
            'name' => 'Retained Admin', 'email' => 'retained@example.invalid',
            'password' => Hash::make('Workspace-Secure-2026!'),
            'role' => 'admin', 'active' => true, 'version' => 1,
        ]);
        $this->deleteJson('/api/admin-accounts', ['id' => $super->id, 'expectedVersion' => 1])->assertForbidden();
        $this->deleteJson('/api/admin-accounts', ['id' => $account->id, 'expectedVersion' => 2])->assertConflict();
        $this->deleteJson('/api/admin-accounts', ['id' => $account->id, 'expectedVersion' => 1])->assertOk();
        $this->assertSoftDeleted('koteka_admin_accounts', ['id' => $account->id, 'active' => false]);
        $this->getJson('/api/admin-accounts')->assertJsonCount(1, 'items');
        $this->withSession(['koteka_admin_id' => $account->id, 'koteka_admin_version' => 1])
            ->getJson('/api/inbox')->assertUnauthorized();
        $this->postJson('/api/admin-session', ['email' => $account->email, 'password' => 'Workspace-Secure-2026!'])->assertUnauthorized();
    }

    public function test_user_deletion_retains_database_record(): void
    {
        $user = User::factory()->create();
        $user->delete();
        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertNull(User::find($user->id));
    }

    #[TestWith(['admin'])]
    #[TestWith(['super_admin'])]
    public function test_inbox_deletion_purges_message_and_reply_receipts(string $role): void
    {
        Http::fake();
        $this->login($role);
        $this->postJson('/api/leads', [
            'nama' => 'Pelanggan', 'namaBisnis' => 'Bisnis Papua', 'whatsapp' => '081234567890',
            'jenisWebsite' => 'Company Profile', 'anggaran' => '1-3 juta', 'targetSelesai' => 'Bulan depan',
            'pesan' => 'Saya membutuhkan website perusahaan.', 'kirimVia' => 'whatsapp', 'persetujuan' => true,
        ])->assertCreated();
        $id = DB::table('koteka_leads')->value('id');
        $this->postJson('/api/inbox-reply', [
            'id' => $id, 'channel' => 'whatsapp_confirm', 'confirmed' => true,
            'text' => 'Terima kasih atas pesan Anda.', 'requestId' => 'reply_delete_1234',
        ])->assertOk();
        $this->deleteJson('/api/inbox', ['ids' => [$id]])->assertUnprocessable();
        $this->deleteJson('/api/inbox', ['ids' => [$id], 'confirmed' => true])->assertOk();
        $this->assertDatabaseMissing('koteka_leads', ['id' => $id]);
        $this->assertDatabaseCount('koteka_reply_receipts', 0);
        $this->getJson('/api/inbox')->assertJsonCount(0, 'items');
    }

    public function test_operator_cannot_delete_inbox(): void
    {
        $this->login('operator');
        $this->deleteJson('/api/inbox', ['all' => true, 'confirmed' => true])->assertForbidden();
    }

    public function test_content_deletion_purges_older_snapshots_and_cannot_be_restored(): void
    {
        $this->login();
        $items = [
            ['_id' => 'remove', 'title' => 'Hapus permanen', 'status' => 'Publik'],
            ['_id' => 'keep', 'title' => 'Tetap ada', 'status' => 'Publik'],
        ];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => ['blogPosts' => $items]])->assertOk();
        $items[0]['title'] = 'Versi baru sebelum dihapus';
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => ['blogPosts' => $items]])->assertOk();
        $this->putJson('/api/workspace-content', ['version' => 2, 'content' => ['blogPosts' => [$items[1]]]])->assertOk();
        foreach (DB::table('koteka_content_revisions')->pluck('content_json') as $snapshot) {
            $this->assertStringNotContainsString('Hapus permanen', $snapshot);
            $this->assertStringNotContainsString('Versi baru sebelum dihapus', $snapshot);
        }
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 3, 'confirmed' => true])
            ->assertOk()->assertJsonCount(1, 'content.blogPosts')->assertJsonPath('content.blogPosts.0._id', 'keep');
    }

    public function test_login_limits_attempts_across_email_addresses(): void
    {
        for ($attempt = 0; $attempt < 30; $attempt++) {
            $this->postJson('/api/admin-session', ['email' => 'invalid-'.$attempt.'@example.invalid', 'password' => 'wrong'])->assertUnauthorized();
        }
        $this->postJson('/api/admin-session', ['email' => 'another@example.invalid', 'password' => 'wrong'])->assertTooManyRequests();
    }

    public function test_deletion_rejects_a_request_without_csrf_token(): void
    {
        $this->login();
        $this->app['env'] = 'local';
        $this->deleteJson('/api/activity-logs', ['scope' => 'all', 'all' => true, 'confirmed' => true])->assertStatus(419);
        $this->assertDatabaseCount('koteka_admin_activities', 1);
    }

    public function test_bulk_deletion_clears_both_log_tables_and_retains_only_deletion_receipt(): void
    {
        $this->login();
        $oldId = Activity::query()->value('id');
        $this->deleteJson('/api/activity-logs', ['scope' => 'all', 'all' => true, 'confirmed' => true])->assertOk();
        $this->assertDatabaseMissing('koteka_admin_activities', ['id' => $oldId]);
        $this->assertDatabaseCount('koteka_visit_events', 0);
        $this->assertDatabaseCount('koteka_admin_activities', 1);
        $this->assertDatabaseHas('koteka_admin_activities', ['module' => 'Log Aktivitas']);
    }

    public function test_deleted_content_releases_its_exclusive_media_but_preserves_shared_media(): void
    {
        Storage::fake('local');
        $this->login();
        $removedId = (string) Str::uuid();
        $replacementId = (string) Str::uuid();
        $sharedId = (string) Str::uuid();
        foreach ([$removedId, $replacementId, $sharedId] as $id) {
            Storage::disk('local')->put('koteka-media/'.$id.'.webp', 'image');
            DB::table('koteka_media')->insert([
                'id' => $id, 'storage_path' => 'koteka-media/'.$id.'.webp',
                'mime_type' => 'image/webp', 'byte_size' => 5, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $items = [
            ['_id' => 'delete', 'image' => '/api/koteka-media/'.$removedId, 'cover' => '/api/koteka-media/'.$sharedId],
            ['_id' => 'keep', 'image' => '/api/koteka-media/'.$sharedId],
        ];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => ['portfolioItems' => $items]])->assertOk();
        $items[0]['image'] = '/api/koteka-media/'.$replacementId;
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => ['portfolioItems' => $items]])->assertOk();
        $this->assertDatabaseHas('koteka_media', ['id' => $removedId]);
        $this->putJson('/api/workspace-content', ['version' => 2, 'content' => ['portfolioItems' => [$items[1]]]])->assertOk();
        $this->assertDatabaseMissing('koteka_media', ['id' => $removedId]);
        Storage::disk('local')->assertMissing('koteka-media/'.$removedId.'.webp');
        $this->assertDatabaseMissing('koteka_media', ['id' => $replacementId]);
        Storage::disk('local')->assertMissing('koteka-media/'.$replacementId.'.webp');
        $this->assertDatabaseHas('koteka_media', ['id' => $sharedId]);
        Storage::disk('local')->assertExists('koteka-media/'.$sharedId.'.webp');
    }
}

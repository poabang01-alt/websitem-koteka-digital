<?php

namespace Tests\Feature;

use App\Models\Koteka\AdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Hash};
use Illuminate\Support\Str;
use Tests\TestCase;

class KotekaPhase3Test extends TestCase
{
    use RefreshDatabase;

    private function login(string $role = 'super_admin'): AdminAccount
    {
        $account = AdminAccount::create([
            'name' => 'Koteka Testing',
            'email' => 'koteka-testing-'.$role.'@example.invalid',
            'role' => $role, 'active' => true, 'version' => 1,
            'password' => Hash::make('Testing-Passphrase-2026!'),
        ]);
        $this->postJson('/api/admin-session', [
            'email' => $account->email, 'password' => 'Testing-Passphrase-2026!',
        ])->assertOk()->assertJsonPath('authenticated', true);
        return $account;
    }

    private function visitPayload(string $id): array
    {
        return [
            'id' => $id, 'page' => '/blog/?utm_source=example',
            'session' => 'sess_accountless_2026', 'device' => 'Desktop', 'channel' => 'Direct',
        ];
    }

    public function test_server_analytics_requires_login_and_deduplicates_events(): void
    {
        $this->get('/api/visits')->assertUnauthorized();
        $id = (string) Str::uuid();
        $this->postJson('/api/visits', $this->visitPayload($id))->assertCreated()
            ->assertJsonPath('tracked', true);
        $this->postJson('/api/visits', $this->visitPayload($id))->assertOk()
            ->assertJsonPath('tracked', false);
        $this->assertDatabaseCount('koteka_visit_events', 1);
        $this->assertDatabaseHas('koteka_visit_events', ['id' => $id, 'page' => '/blog/']);
        $this->login('super_admin');
        $this->get('/api/visits')->assertOk()->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.source', 'server');
    }

    public function test_analytics_validation_and_admin_area_exclusion(): void
    {
        $this->postJson('/api/visits', ['page' => 'https://example.com/'])->assertUnprocessable();
        $this->postJson('/api/visits', array_replace($this->visitPayload((string) Str::uuid()), [
            'page' => '/admin/secret',
        ]))->assertOk()->assertJsonPath('tracked', false);
        $this->assertDatabaseCount('koteka_visit_events', 0);
    }

    public function test_non_super_admin_cannot_manage_other_accounts(): void
    {
        $this->login('operator');
        $this->get('/api/admin-accounts')->assertForbidden();
        $this->get('/api/admin-activity')->assertForbidden();
        $this->get('/api/visits')->assertOk();
        $this->postJson('/api/admin-accounts', [
            'name'=>'Hacker', 'email'=>'hacker@example.invalid','role'=>'admin',
            'active'=>true,'password'=>'VeryStrongPassphrase2026!',
        ])->assertForbidden();
    }

    public function test_cms_versioning_and_server_activity(): void
    {
        $this->putJson('/api/workspace-content', ['content'=>['home'=>['title'=>'A']],'version'=>0])
            ->assertUnauthorized();
        $this->login();
        $this->putJson('/api/workspace-content', ['content'=>['home'=>['title'=>'A']],'version'=>0])
            ->assertOk()->assertJsonPath('version', 1);
        $this->putJson('/api/workspace-content', ['content'=>['home'=>['title'=>'B']],'version'=>0])
            ->assertStatus(409);
        $this->get('/api/workspace-content')->assertOk()
            ->assertJsonPath('content.home.title', 'A')->assertJsonPath('version', 1);
        $this->get('/api/admin-activity')->assertOk()->assertJsonStructure(['items']);
    }

    public function test_inbox_stores_leads_and_allows_authorized_read(): void
    {
        $this->postJson('/api/leads', [
            'nama'=>'Test Konsultasi','namaBisnis'=>'Koteka Testing',
            'whatsapp'=>'081234567890','jenisWebsite'=>'Company Profile',
            'anggaran'=>'1-3 juta','targetSelesai'=>'Bulan depan',
            'pesan'=>'Saya membutuhkan website perusahaan.',
            'kirimVia'=>'whatsapp','persetujuan'=>true,
        ])->assertCreated()->assertJsonPath('stored', true);
        $this->assertDatabaseCount('koteka_leads',1);
        $this->get('/api/inbox')->assertUnauthorized();
        $this->login('admin');
        $this->get('/api/inbox')->assertOk()->assertJsonPath('unread',1);
        $leadId=DB::table('koteka_leads')->value('id');
        $this->patchJson('/api/inbox', ['id'=>$leadId])->assertOk();
        $this->get('/api/inbox')->assertJsonPath('unread',0);
    }
}

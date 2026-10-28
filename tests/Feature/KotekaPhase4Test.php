<?php

namespace Tests\Feature;

use App\Models\Koteka\AdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{DB, Hash};
use Tests\TestCase;

class KotekaPhase4Test extends TestCase
{
    use RefreshDatabase;

    private function login(string $role = 'super_admin'): AdminAccount
    {
        $account = AdminAccount::create([
            'name' => 'Test '.$role, 'email' => $role.'@example.invalid',
            'password' => Hash::make('Koteka-Secure-2026!!'), 'active' => true,
            'role' => $role, 'version' => 1,
        ]);
        $this->postJson('/api/admin-session', ['email' => $account->email, 'password' => 'Koteka-Secure-2026!!'])
            ->assertOk()->assertJsonPath('authenticated', true);
        return $account;
    }

    public function test_anonymous_and_operator_cannot_read_history_or_restore(): void
    {
        $this->get('/api/content-history')->assertUnauthorized();
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 0, 'confirmed' => true])
            ->assertUnauthorized();
        $this->login('operator');
        $this->get('/api/content-history')->assertForbidden();
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 0, 'confirmed' => true])
            ->assertForbidden();
        $this->get('/api/admin-accounts')->assertForbidden();
    }

    public function test_content_crud_revision_and_restoration_do_not_lose_newer_edits(): void
    {
        $this->login();
        $this->putJson('/api/workspace-content', ['content' => ['home' => ['title' => 'Versi Pertama']], 'version' => 0])
            ->assertOk()->assertJsonPath('version', 1);
        $this->putJson('/api/workspace-content', ['content' => ['home' => ['title' => 'Versi Kedua']], 'version' => 1])
            ->assertOk()->assertJsonPath('version', 2);
        $this->assertDatabaseCount('koteka_content_revisions', 2);
        $this->get('/api/content-history')->assertOk()->assertJsonPath('items.0.version', 2)
            ->assertJsonPath('items.1.version', 1);
        // Stale browser can neither publish nor restore silently.
        $this->putJson('/api/workspace-content', ['content' => ['home' => ['title' => 'Tertimpa']], 'version' => 1])
            ->assertStatus(409);
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 1, 'confirmed' => true])
            ->assertStatus(409);
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 2, 'confirmed' => true])
            ->assertOk()->assertJsonPath('version', 3)
            ->assertJsonPath('content.home.title', 'Versi Pertama');
        $this->get('/api/workspace-content')->assertOk()->assertJsonPath('version', 3)
            ->assertJsonPath('content.home.title', 'Versi Pertama');
        $this->assertDatabaseHas('koteka_content_revisions', [
            'version' => 3, 'action' => 'restore', 'restored_from_version' => 1,
        ]);
        $this->get('/api/admin-activity')->assertOk()->assertJsonStructure(['items']);
    }

    public function test_validation_and_revision_limit(): void
    {
        $this->login();
        $this->putJson('/api/workspace-content', ['content' => ['home' => 'A'], 'version' => '0'])
            ->assertUnprocessable();
        $this->putJson('/api/workspace-content', ['content' => ['home' => 'A'], 'version' => 0])
            ->assertOk();
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 1, 'confirmed' => false])
            ->assertUnprocessable();
        $this->postJson('/api/content-restore', ['revision' => 999, 'expectedVersion' => 1, 'confirmed' => true])
            ->assertNotFound();
        $this->assertDatabaseCount('koteka_content_revisions', 1);
    }

    public function test_disabled_admin_loses_access_when_session_is_invalidated(): void
    {
        $admin = $this->login('admin');
        $this->get('/api/inbox')->assertOk();
        $admin->update(['active' => false, 'version' => 2]);
        $this->get('/api/inbox')->assertUnauthorized();
        $this->putJson('/api/workspace-content', ['content' => ['home' => ['title' => 'Hacker']], 'version' => 0])
            ->assertUnauthorized();
        $this->assertDatabaseCount('koteka_content_revisions', 0);
    }

    public function test_content_history_stores_50_most_recent_versions(): void
    {
        $this->login();
        for ($v = 0; $v < 52; $v++) {
            $this->putJson('/api/workspace-content', ['content' => ['home' => ['title' => 'Number '.$v]], 'version' => $v])
                ->assertOk();
        }
        $this->assertDatabaseCount('koteka_content_revisions', 50);
        $this->get('/api/content-history')->assertOk()
            ->assertJsonCount(50, 'items')->assertJsonPath('items.0.version', 52);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Koteka\AdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KotekaMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_home_and_admin_have_csrf_bridge(): void
    {
        $this->get('/')->assertOk()->assertSee('koteka-laravel-bridge.js');
        $this->get('/admin/')->assertOk()->assertSee('koteka-laravel-bridge.js');
        $this->get('/admin')->assertOk()->assertSee('koteka-laravel-bridge.js');
    }

    public function test_blog_and_static_pages_have_routes(): void
    {
        $this->get('/layanan/')->assertOk();
        $this->get('/portofolio/')->assertOk();
        $this->get('/blog/')->assertOk();
        $this->get('/blog/jasa-website-jayapura-umkm/')->assertOk();
        $this->get('/blog/slug-tidak-ada/')->assertNotFound();
    }

    public function test_admin_endpoints_require_real_backend_session(): void
    {
        $this->get('/api/admin-accounts')->assertUnauthorized();
        $this->get('/api/inbox')->assertUnauthorized();
        $this->get('/api/workspace-content')->assertOk()->assertJsonPath('version', 0);
    }

    public function test_invalid_lead_is_rejected(): void
    {
        $this->postJson('/api/leads', ['nama' => 'A'])->assertStatus(422);
    }

    public function test_super_admin_can_login_and_logout_using_server_session(): void
    {
        AdminAccount::create([
            'name' => 'Test Administrator',
            'email' => 'administrator-test@example.invalid',
            'password' => Hash::make('Testing-Passphrase-2026!'),
            'role' => 'super_admin',
            'active' => true,
            'version' => 1,
        ]);

        $this->get('/api/admin-session')
            ->assertOk()->assertJsonPath('authenticated', false);

        $this->postJson('/api/admin-session', [
            'email' => 'administrator-test@example.invalid',
            'password' => 'incorrect-password',
        ])->assertUnauthorized();

        $this->postJson('/api/admin-session', [
            'email' => 'administrator-test@example.invalid',
            'password' => 'Testing-Passphrase-2026!',
        ])->assertOk()
          ->assertJsonPath('authenticated', true)
          ->assertJsonPath('user.role', 'super_admin')
          ->assertHeader('X-Koteka-CSRF');

        $this->get('/api/admin-accounts')->assertOk()->assertJsonCount(1, 'items');

        $this->deleteJson('/api/admin-session')->assertOk()
            ->assertJsonPath('authenticated', false);
        $this->get('/api/admin-accounts')->assertUnauthorized();
    }
}

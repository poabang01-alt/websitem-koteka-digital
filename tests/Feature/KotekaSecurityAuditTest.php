<?php

namespace Tests\Feature;

use App\Models\Koteka\Activity;
use App\Models\Koteka\AdminAccount;
use App\Models\Koteka\Lead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class KotekaSecurityAuditTest extends TestCase
{
    use RefreshDatabase;

    private function login(string $role = 'super_admin'): AdminAccount
    {
        $account = AdminAccount::create([
            'name' => 'Security '.$role, 'email' => $role.'@example.invalid',
            'password' => Hash::make('Security-Audit-2026!'), 'role' => $role, 'active' => true, 'version' => 1,
        ]);
        $this->postJson('/api/admin-session', ['email' => $account->email, 'password' => 'Security-Audit-2026!'])->assertOk();

        return $account;
    }

    #[TestWith(['javascript:void(0)'])]
    #[TestWith(['java'."\t".'script:void(0)'])]
    #[TestWith(['/\\example.invalid/file'])]
    #[TestWith(['//example.invalid/file'])]
    #[TestWith(['data:text/html,invalid'])]
    public function test_publication_rejects_unsafe_urls_without_changing_records(string $url): void
    {
        $this->login();
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => [
            'pricingPlans' => [['_id' => 'plan', 'status' => 'Publik', 'download' => $url]],
        ]])->assertUnprocessable();
        $this->assertDatabaseCount('koteka_workspace_content', 0);
        $this->assertDatabaseCount('koteka_content_revisions', 0);
    }

    public function test_safe_existing_url_protocols_and_images_remain_supported(): void
    {
        $this->login();
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => [
            'home' => ['primaryLink' => '#kontak', 'secondaryLink' => '/layanan/'],
            'contact' => ['ctaLink' => 'https://wa.me/6281234567890'],
            'contactChannels' => [['link' => 'mailto:hello@example.invalid'], ['link' => 'tel:+6281234567890']],
            'portfolioItems' => [['image' => 'data:image/png;base64,aGVsbG8=']],
            'pricingPlans' => [['download' => '/downloads/paket-basic.pdf', 'orderLink' => 'https://wa.me/6281234567890']],
        ]])->assertOk();
    }

    public function test_operator_cannot_clear_implicit_public_collections(): void
    {
        $this->login();
        $original = ['home' => ['title' => 'Existing public content']];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => $original])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login('operator');
        foreach (['teamMembers', 'pricingPlans', 'blogPosts', 'faqs'] as $key) {
            $this->putJson('/api/workspace-content', ['version' => 1, 'content' => [...$original, $key => []]])->assertForbidden();
        }
        $this->getJson('/api/workspace-content')->assertJsonPath('version', 1)->assertJsonMissingPath('content.teamMembers');
    }

    public function test_operator_cannot_append_empty_public_records_but_can_manage_drafts(): void
    {
        $this->login();
        $original = ['faqs' => [['_id' => 'public', 'question' => 'Question', 'status' => 'Publik']]];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => $original])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login('operator');
        $invalid = $original;
        $invalid['faqs'][] = [];
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => $invalid])->assertForbidden();
        $draft = [...$original, 'blogPosts' => [['_id' => 'draft', 'title' => 'Private', 'status' => 'Draft']]];
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => $draft])->assertOk();
        $this->getJson('/api/workspace-content')->assertJsonMissingPath('content.blogPosts');
        $draft['blogPosts'] = [];
        $this->putJson('/api/workspace-content', ['version' => 2, 'content' => $draft])->assertOk();
        $this->getJson('/api/workspace-content')->assertJsonMissingPath('content.blogPosts');
    }

    public function test_head_requests_do_not_create_activity_or_visitor_records(): void
    {
        $this->login();
        $count = Activity::count();
        $this->head('/api/admin-activity?'.http_build_query(['module' => 'Audit', 'description' => 'A read must not write']))->assertOk();
        $this->assertDatabaseCount('koteka_admin_activities', $count);
        $this->head('/api/visits?'.http_build_query([
            'id' => (string) Str::uuid(), 'page' => '/', 'session' => 'safe_method_session', 'channel' => 'Direct', 'device' => 'Desktop',
        ]))->assertOk();
        $this->assertDatabaseCount('koteka_visit_events', 0);
    }

    public function test_head_requests_do_not_mark_inbox_messages_as_read(): void
    {
        $this->login('admin');
        $lead = Lead::create([
            'nama' => 'Private Customer', 'nama_bisnis' => 'Business', 'wa' => '6281234567890',
            'jenis_website' => 'Company Profile', 'anggaran' => '1-3 juta', 'target_selesai' => 'Next month',
            'pesan' => 'A private customer message', 'kirim_via' => 'whatsapp', 'read' => false,
        ]);
        $this->head('/api/inbox?id='.$lead->id)->assertOk();
        $this->assertDatabaseHas('koteka_leads', ['id' => $lead->id, 'read' => false]);
    }

    public function test_upload_rate_limit_prevents_repeated_file_processing(): void
    {
        $account = $this->login();
        RateLimiter::hit('koteka:upload:'.$account->id, 60);
        for ($attempt = 0; $attempt < 19; $attempt++) {
            RateLimiter::hit('koteka:upload:'.$account->id, 60);
        }
        $this->postJson('/api/koteka-media')->assertTooManyRequests();
        $this->assertDatabaseCount('koteka_media', 0);
    }

    public function test_large_revision_history_can_save_with_a_128mb_memory_limit(): void
    {
        $previousMemoryLimit = ini_get('memory_limit');
        try {
            ini_set('memory_limit', '128M');
            $this->login('operator');
            $items = [];
            for ($index = 0; $index < 5000; $index++) {
                $items[] = ['_id' => 'draft-'.$index, 'status' => 'Draft', 'body' => str_repeat('A', 400)];
            }
            $content = ['blogPosts' => $items];
            $json = json_encode($content);
            DB::table('koteka_workspace_content')->insert(['id' => 'published', 'content_json' => $json, 'version' => 50, 'updated_at' => now()]);
            for ($version = 1; $version <= 50; $version++) {
                DB::table('koteka_content_revisions')->insert(['version' => $version, 'content_json' => $json, 'action' => 'publish', 'created_at' => now()]);
            }
            $this->putJson('/api/workspace-content', ['version' => 50, 'content' => $content])->assertOk()->assertJsonPath('version', 51);
            $this->assertDatabaseCount('koteka_content_revisions', 50);
        } finally {
            ini_set('memory_limit', $previousMemoryLimit);
        }
    }

    public function test_production_redirect_uses_configured_https_origin_and_rejects_other_hosts(): void
    {
        $this->app['env'] = 'production';
        config(['app.url' => 'https://koteka.example.test']);
        $this->get('http://koteka.example.test/admin')->assertStatus(308)
            ->assertRedirect('https://koteka.example.test/admin');
        $this->get('https://untrusted.example.test/admin/')->assertStatus(400);
    }

    public function test_https_production_responses_set_transport_and_cookie_protection(): void
    {
        $this->app['env'] = 'production';
        config(['app.url' => 'https://koteka.example.test', 'app.debug' => true, 'session.secure' => false]);
        $response = $this->get('https://koteka.example.test/admin/')->assertOk()
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $this->assertFalse(config('app.debug'));
        $sessionCookie = collect($response->headers->getCookies())->first(fn ($cookie): bool => $cookie->getName() === config('session.cookie'));
        $this->assertNotNull($sessionCookie);
        $this->assertTrue($sessionCookie->isSecure());
        $this->assertTrue($sessionCookie->isHttpOnly());
        $this->assertSame('lax', $sessionCookie->getSameSite());
    }

    public function test_untrusted_forwarded_headers_cannot_bypass_production_https(): void
    {
        $this->app['env'] = 'production';
        config(['app.url' => 'https://koteka.example.test']);
        $this->withHeader('X-Forwarded-Proto', 'https')->get('http://koteka.example.test/admin')->assertStatus(308);
    }

    public function test_long_passwords_are_verified_in_full_without_replacing_existing_accounts(): void
    {
        $this->login();
        $password = str_repeat('A', 72).'correct-suffix';
        $created = $this->postJson('/api/admin-accounts', [
            'name' => 'Long Password', 'email' => 'long@example.invalid', 'role' => 'admin', 'active' => true, 'password' => $password,
        ])->assertCreated();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->postJson('/api/admin-session', ['email' => 'long@example.invalid', 'password' => str_repeat('A', 72).'wrong-suffix'])->assertUnauthorized();
        $this->postJson('/api/admin-session', ['email' => 'long@example.invalid', 'password' => $password])->assertOk();
        $this->assertDatabaseHas('koteka_admin_accounts', ['id' => $created->json('item.id'), 'email' => 'long@example.invalid']);
    }

    public function test_malformed_phone_and_account_email_are_validation_errors(): void
    {
        $this->postJson('/api/leads', ['whatsapp' => ['unexpected']])->assertUnprocessable();
        $this->login();
        $created = $this->postJson('/api/admin-accounts', [
            'name' => 'Validation', 'email' => 'validation@example.invalid', 'role' => 'admin', 'active' => true, 'password' => 'Valid-Password-2026!',
        ])->assertCreated();
        $this->patchJson('/api/admin-accounts', ['id' => $created->json('item.id'), 'expectedVersion' => 1, 'email' => ['unexpected']])->assertUnprocessable();
        $this->assertDatabaseHas('koteka_admin_accounts', ['email' => 'validation@example.invalid', 'version' => 1]);
    }

    public function test_workspace_write_abuse_is_limited_without_blocking_reads_or_logout(): void
    {
        $this->login();
        for ($attempt = 0; $attempt < 60; $attempt++) {
            $this->postJson('/api/admin-activity', ['module' => 'Audit', 'description' => 'Recorded action'])->assertCreated();
        }
        $this->postJson('/api/admin-activity', ['module' => 'Audit', 'description' => 'Excess action'])->assertTooManyRequests();
        $this->getJson('/api/admin-activity')->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
    }

    public function test_production_preflight_reads_sqlite_without_modifying_records(): void
    {
        $database = tempnam(sys_get_temp_dir(), 'koteka_security_');
        try {
            $connection = new \PDO('sqlite:'.$database);
            $connection->exec('CREATE TABLE preserved_records (id INTEGER PRIMARY KEY, value TEXT)');
            $connection->exec("INSERT INTO preserved_records (value) VALUES ('preserved')");
            $connection = null;
            $before = hash_file('sha256', $database);
            $this->app['env'] = 'production';
            config(['app.debug' => false, 'app.url' => 'https://koteka.example.test', 'session.secure' => true,
                'app.key' => 'base64:'.base64_encode(str_repeat('a', 32)), 'database.connections.sqlite.database' => $database]);
            $this->artisan('koteka:security-check')->expectsOutputToContain('PASS database_integrity')->assertSuccessful();
            $this->assertSame($before, hash_file('sha256', $database));
        } finally {
            if (is_file($database)) {
                unlink($database);
            }
        }
    }

    public function test_production_preflight_rejects_a_database_in_the_public_directory(): void
    {
        config(['database.connections.sqlite.database' => public_path('index.php')]);
        $this->artisan('koteka:security-check')->expectsOutputToContain('FAIL persistent_sqlite')->assertFailed();
    }

    public function test_login_rotates_the_session_and_svg_uploads_are_rejected(): void
    {
        Storage::fake('local');
        $this->getJson('/api/admin-session')->assertOk();
        $oldSession = session()->getId();
        $this->login();
        $this->assertNotSame($oldSession, session()->getId());
        $this->post('/api/koteka-media', ['image' => UploadedFile::fake()->createWithContent('photo.png', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>')])->assertUnprocessable();
        $this->assertDatabaseCount('koteka_media', 0);
        $this->get('/storage/koteka-media/private.png')->assertForbidden();
    }

    #[TestWith(['Draft'])]
    #[TestWith(['Arsip'])]
    public function test_admin_can_still_unpublish_an_entire_collection(string $status): void
    {
        $this->login('admin');
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => ['blogPosts' => [
            ['_id' => 'managed', 'title' => 'Managed content', 'status' => $status],
        ]]])->assertOk();
        $this->getJson('/api/workspace-content')->assertJsonCount(0, 'content.blogPosts');
    }

    public function test_operator_cannot_forge_server_owned_visibility_metadata(): void
    {
        $this->login();
        $content = ['faqs' => [['_id' => 'public', 'question' => 'Existing question', 'status' => 'Publik']]];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => $content])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login('operator');
        $content['faqs'][0]['status'] = 'Draft';
        $content['_koteka_implicit_collections'] = ['faqs'];
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => $content])->assertForbidden();
        $this->getJson('/api/workspace-content')->assertJsonPath('content.faqs.0.question', 'Existing question');
    }

    public function test_restoring_an_operator_draft_preserves_its_original_public_visibility(): void
    {
        $this->login('operator');
        $content = ['blogPosts' => [['_id' => 'draft', 'title' => 'Draft article', 'status' => 'Draft']]];
        $this->putJson('/api/workspace-content', ['version' => 0, 'content' => $content])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login();
        $content['blogPosts'][0]['status'] = 'Publik';
        $this->putJson('/api/workspace-content', ['version' => 1, 'content' => $content])->assertOk();
        $this->getJson('/api/workspace-content')->assertJsonCount(1, 'content.blogPosts');
        $this->postJson('/api/content-restore', ['revision' => 1, 'expectedVersion' => 2, 'confirmed' => true])->assertOk();
        $this->getJson('/api/workspace-content')->assertJsonMissingPath('content.blogPosts');
    }
}

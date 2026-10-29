<?php

namespace Tests\Feature;

use App\Models\Koteka\AdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class KotekaDeploymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_operator_cannot_change_public_numeric_strings_or_types(): void
    {
        $this->login('super_admin');
        $original = ['home' => ['price' => '01', 'enabled' => true]];
        $this->putJson('/api/workspace-content', ['content' => $original, 'version' => 0])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login('operator');

        foreach ([['price', '1'], ['price', 1], ['enabled', 'true']] as [$field, $value]) {
            $changed = $original;
            $changed['home'][$field] = $value;
            $this->putJson('/api/workspace-content', ['content' => $changed, 'version' => 1])->assertForbidden();
        }

        $this->getJson('/api/workspace-content')->assertJsonPath('content.home.price', '01')
            ->assertJsonPath('content.home.enabled', true)->assertJsonPath('version', 1);
        $this->assertDatabaseCount('koteka_content_revisions', 1);
    }

    public function test_operator_can_edit_drafts_when_public_object_keys_are_reordered(): void
    {
        $this->login('super_admin');
        $original = ['home' => ['title' => 'Public', 'settings' => ['first' => '01', 'second' => true]]];
        $this->putJson('/api/workspace-content', ['content' => $original, 'version' => 0])->assertOk();
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->login('operator');

        $changed = ['home' => ['settings' => ['second' => true, 'first' => '01'], 'title' => 'Public'],
            'blogPosts' => [['title' => 'Private draft', 'status' => 'Draft']]];
        $this->putJson('/api/workspace-content', ['content' => $changed, 'version' => 1])->assertOk();

        $this->getJson('/api/workspace-content')->assertJsonPath('content.home.title', 'Public')
            ->assertJsonPath('content.home.settings.first', '01')->assertJsonMissingPath('content.blogPosts');
        $this->assertDatabaseCount('koteka_content_revisions', 2);
    }

    public function test_slashless_pages_resolve_assets_from_their_page_directory(): void
    {
        foreach (['/admin' => '/admin/', '/blog/jasa-website-jayapura-umkm' => '/blog/jasa-website-jayapura-umkm/'] as $path => $base) {
            $this->get($path)->assertOk()->assertSee('<base href="'.$base.'">', false);
        }
    }

    public function test_media_referenced_in_later_history_batches_is_preserved(): void
    {
        Storage::fake('local');
        $this->login('super_admin');
        $retained = (string) Str::uuid();
        $unused = (string) Str::uuid();
        foreach ([$retained, $unused] as $id) {
            Storage::disk('local')->put('koteka-media/'.$id.'.webp', 'image fixture');
            DB::table('koteka_media')->insert([
                'id' => $id, 'storage_path' => 'koteka-media/'.$id.'.webp',
                'mime_type' => 'image/webp', 'byte_size' => 13,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        for ($version = 1; $version <= 7; $version++) {
            DB::table('koteka_content_revisions')->insert([
                'version' => $version, 'content_json' => json_encode(['image' => $version === 7 ? '/api/koteka-media/'.$retained : '/img/example.webp']),
                'action' => 'publish', 'created_at' => now(),
            ]);
        }

        $this->deleteJson('/api/koteka-media/'.$retained)->assertConflict();
        $this->deleteJson('/api/koteka-media/'.$unused)->assertOk();

        $this->assertDatabaseHas('koteka_media', ['id' => $retained]);
        $this->assertDatabaseMissing('koteka_media', ['id' => $unused]);
        Storage::disk('local')->assertExists('koteka-media/'.$retained.'.webp');
        Storage::disk('local')->assertMissing('koteka-media/'.$unused.'.webp');
    }

    private function login(string $role): void
    {
        AdminAccount::create([
            'name' => 'Deployment '.$role, 'email' => $role.'@example.invalid',
            'password' => Hash::make('Deployment-Passphrase-2026!'),
            'role' => $role, 'active' => true, 'version' => 1,
        ]);

        $this->postJson('/api/admin-session', ['email' => $role.'@example.invalid', 'password' => 'Deployment-Passphrase-2026!'])->assertOk();
    }
}

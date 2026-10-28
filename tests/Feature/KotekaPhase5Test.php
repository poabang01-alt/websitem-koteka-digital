<?php

namespace Tests\Feature;

use App\Models\Koteka\AdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class KotekaPhase5Test extends TestCase
{
    use RefreshDatabase;

    private function login(string $role = 'super_admin'): void
    {
        $account = AdminAccount::create([
            'name' => 'Test '.$role, 'email' => $role.'@example.invalid',
            'password' => Hash::make('Koteka-Secure-2026!!'),
            'role' => $role, 'active' => true, 'version' => 1,
        ]);
        $this->postJson('/api/admin-session', [
            'email' => $account->email, 'password' => 'Koteka-Secure-2026!!',
        ])->assertOk();
    }

    public function test_public_read_excludes_draft_and_archive_but_editor_can_read_them(): void
    {
        $this->login();
        $data = ['blogPosts' => [
            ['_id' => 'a', 'title' => 'Terbit', 'status' => 'Publik'],
            ['_id' => 'b', 'title' => 'Rahasia Draft', 'status' => 'Draft'],
            ['_id' => 'c', 'title' => 'Arsip', 'status' => 'Arsip'],
        ], 'home' => ['title' => 'Test']];
        $this->putJson('/api/workspace-content', ['content' => $data, 'version' => 0])->assertOk();
        // A normal public read stays filtered even with an active Admin cookie.
        $this->getJson('/api/workspace-content')->assertJsonCount(1, 'content.blogPosts');
        $this->withHeader('X-Koteka-Editor', '1')->getJson('/api/workspace-content')->assertJsonCount(3, 'content.blogPosts');
        $this->withHeader('X-Koteka-Editor', '0');
        $this->deleteJson('/api/admin-session')->assertOk();
        $this->getJson('/api/workspace-content')->assertOk()
            ->assertJsonCount(1, 'content.blogPosts')
            ->assertDontSee('Rahasia Draft')->assertDontSee('Arsip');
    }

    public function test_media_upload_requires_auth_and_rejects_invalid_file(): void
    {
        $this->postJson('/api/koteka-media')->assertUnauthorized();
        $this->login();
        $this->post('/api/koteka-media', [
            'image' => UploadedFile::fake()->create('bad.txt', 1, 'text/plain'),
        ])->assertUnprocessable()->assertJsonValidationErrors('image');
    }

    public function test_draft_image_is_private_until_published(): void
    {
        Storage::fake('local');
        $this->login();
        // A 1x1 real PNG avoids needing GD for the fake image fixture.
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==');
        $path = tempnam(sys_get_temp_dir(), 'koteka_img_');
        file_put_contents($path, $png);
        try {
            $file = new UploadedFile($path, 'test.png', 'image/png', null, true);
            $uploaded = $this->post('/api/koteka-media', ['image' => $file])->assertCreated()->json();
            $url = $uploaded['url'];
            $this->get($url)->assertOk();
            $this->putJson('/api/workspace-content', ['version' => 0, 'content' => [
                'portfolioItems' => [['title' => 'Dalam Draft', 'status' => 'Draft', 'image' => $url]],
            ]])->assertOk();
            $this->deleteJson('/api/admin-session')->assertOk();
            $this->get($url)->assertNotFound();
            $this->login('admin');
            $this->putJson('/api/workspace-content', ['version' => 1, 'content' => [
                'portfolioItems' => [['title' => 'Terbit', 'status' => 'Publik', 'image' => $url]],
            ]])->assertOk();
            $this->deleteJson('/api/admin-session')->assertOk();
            $this->get($url)->assertOk();
        } finally {
            @unlink($path);
        }
    }
}

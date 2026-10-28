<?php

use App\Http\Controllers\Koteka\{AccessController, LeadController, SiteController, WorkspaceContentController};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Koteka\MediaController;

// These endpoints are intentionally registered through routes/web.php so that
// browser sessions and Laravel's CSRF protection remain enabled.
Route::match(['GET', 'POST', 'DELETE'], '/api/admin-session', [AccessController::class, 'session']);
Route::match(['GET', 'POST', 'PATCH', 'DELETE'], '/api/admin-accounts', [AccessController::class, 'accounts']);
Route::match(['GET', 'POST'], '/api/admin-activity', [AccessController::class, 'activity']);
Route::match(['GET', 'PATCH'], '/api/inbox', [AccessController::class, 'inbox']);
Route::post('/api/inbox-reply', [AccessController::class, 'reply']);
Route::post('/api/leads', [LeadController::class, 'store']);
Route::match(['GET', 'POST'], '/api/visits', [\App\Http\Controllers\Koteka\VisitController::class, 'handle']);
Route::get('/api/workspace-content', [WorkspaceContentController::class, 'index']);
Route::put('/api/workspace-content', [WorkspaceContentController::class, 'update']);
Route::get('/api/content-history', [WorkspaceContentController::class, 'history']);
Route::post('/api/content-restore', [WorkspaceContentController::class, 'restore']);
// Images are stored privately. Public GET only works after publication.
Route::get('/api/koteka-media', [MediaController::class, 'index']);
Route::post('/api/koteka-media', [MediaController::class, 'upload']);
Route::get('/api/koteka-media/{id}', [MediaController::class, 'show'])->whereUuid('id');
Route::delete('/api/koteka-media/{id}', [MediaController::class, 'delete'])->whereUuid('id');

Route::get('/', fn (Request $request) => (new SiteController)->show($request, 'index.html'));
Route::get('/index.html', fn () => redirect('/', 302));

// IMPORTANT: Route matching may normalize the trailing slash, depending on
// the PHP web server. Testing getPathInfo() and then issuing a 301 could
// therefore redirect /admin/ to itself indefinitely. Both slash variants
// now respond with the same HTML (200), avoiding browser-cached 301 loops.
foreach (['admin', 'layanan', 'portofolio', 'privacy-policy', 'blog'] as $section) {
    Route::get('/'.$section, fn (Request $request) =>
        (new SiteController)->show($request, $section.'/index.html')
    );
}

Route::get('/admin/index.html', fn () => redirect('/admin/', 302));
Route::get('/layanan/index.html', fn () => redirect('/layanan/', 302));
Route::get('/portofolio/index.html', fn () => redirect('/portofolio/', 302));
Route::get('/privacy-policy/index.html', fn () => redirect('/privacy-policy/', 302));
Route::get('/blog/index.html', fn () => redirect('/blog/', 302));
Route::get('/blog/article.html', fn (Request $request) =>
    (new SiteController)->show($request, 'blog/article.html')
);

Route::get('/blog/{slug}', function (Request $request, string $slug) {
    $allowed = [
        'harga-pembuatan-website-jayapura', 'jasa-pembuatan-website-jayapura',
        'jasa-website-jayapura-umkm', 'jasa-website-sekolah-papua',
        'jasa-website-toko-online-jayapura', 'manfaat-seo-bisnis-jayapura',
        'perbedaan-website-murah-dan-profesional', 'studi-kasus-website-umkm-jayapura',
        'tips-digital-marketing-papua', 'tips-memilih-jasa-pembuatan-website',
        'web-developer-jayapura', 'website-company-profile-jayapura',
    ];

    abort_unless(in_array($slug, $allowed, true), 404);

    return (new SiteController)->show($request, 'blog/'.$slug.'/index.html');
})->where('slug', '[A-Za-z0-9-]+');

Route::get('/blog/{slug}/index.html', fn (string $slug) =>
    redirect('/blog/'.$slug.'/', 302)
)->where('slug', '[A-Za-z0-9-]+');

Route::fallback(fn (Request $request) => (new SiteController)->notFound($request));

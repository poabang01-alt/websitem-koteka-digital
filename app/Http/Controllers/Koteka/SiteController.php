<?php

namespace App\Http\Controllers\Koteka;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\File;

class SiteController extends Controller
{
    public function show(Request $request, string $page = 'index.html')
    {
        $base = resource_path('koteka/pages');
        $path = $base.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $page);
        abort_unless(File::isFile($path), 404);
        $html = File::get($path);
        $directory = str_replace('\\', '/', dirname($page));
        $pageBase = $directory === '.' ? '/' : '/'.$directory.'/';
        // Relative assets must resolve identically with and without a trailing slash.
        $injection = '<base href="'.e($pageBase).'">'."\n"
            .'<meta name="csrf-token" content="'.e(csrf_token()).'">'."\n"
            .'<script src="/assets/koteka-laravel-bridge.js"></script>'."\n"
            .'<script src="/assets/koteka-server-analytics.js?v=20261023t3" defer></script>'."\n";
        $html = preg_replace('~<head([^>]*)>~i', '$0'.$injection, $html, 1);

        return response($html, 200)
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'no-store')
            ->header('X-Content-Type-Options', 'nosniff');
    }

    public function notFound(Request $request)
    {
        $path = resource_path('koteka/pages/404.html');
        $html = File::get($path);

        return response($html, 404)->header('Content-Type', 'text/html; charset=UTF-8');
    }
}

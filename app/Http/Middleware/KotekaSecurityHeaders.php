<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Conservative headers for the existing React build + HTML/JS Workspace.
 * Enforced CSP only blocks embedding, <object>, and malicious base URLs.
 * An expanded candidate is report-only until its browser compatibility is validated.
 */
final class KotekaSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $production = app()->environment('production');
        if ($production) {
            config(['app.debug' => false, 'session.secure' => true, 'session.http_only' => true, 'session.same_site' => 'lax']);
            $origin = parse_url((string) config('app.url'));
            if (! is_array($origin) || ($origin['scheme'] ?? '') !== 'https' || empty($origin['host'])) {
                return response('Service unavailable.', 503);
            }
            if (strcasecmp($request->getHost(), $origin['host']) !== 0) {
                return response('Invalid host.', 400);
            }
            if (! $request->isSecure()) {
                $authority = $origin['host'].(isset($origin['port']) ? ':'.$origin['port'] : '');

                return redirect()->away('https://'.$authority.$request->getRequestUri(), 308);
            }
        }
        /** @var Response $response */
        $response = $next($request);

        // All dynamic responses (including redirects/errors) where this middleware runs.
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        if ($production && $request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }
        if ($request->is('api/*')) {
            $response->headers->set('Cache-Control', 'private, no-store');
        }

        $contentType = strtolower((string) $response->headers->get('Content-Type', ''));
        if (str_starts_with($contentType, 'text/html')) {
            // Enforced, deliberately small, compatible with existing inline JS/CSS.
            $response->headers->set(
                'Content-Security-Policy',
                "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
            );

            // Future stricter policy is observational ONLY. Check Chrome CSP
            // console warnings before considering enforcement.
            $response->headers->set(
                'Content-Security-Policy-Report-Only',
                "default-src 'self'; "
                ."script-src 'self' 'unsafe-inline' https:; "
                ."style-src 'self' 'unsafe-inline' https:; "
                ."img-src 'self' https: data: blob:; "
                ."font-src 'self' https: data:; "
                ."connect-src 'self' https: wss:; "
                ."frame-src 'self' https:; "
                ."worker-src 'self' blob:; "
                ."form-action 'self' https:; "
                ."object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
            );
        }

        return $response;
    }
}

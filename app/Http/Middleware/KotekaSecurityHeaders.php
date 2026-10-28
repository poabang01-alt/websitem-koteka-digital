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
        /** @var Response $response */
        $response = $next($request);

        // All dynamic responses (including redirects/errors) where this middleware runs.
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        $contentType = strtolower((string) $response->headers->get('Content-Type', ''));
        if (str_starts_with($contentType, 'text/html')) {
            // Enforced, deliberately small, compatible with existing inline JS/CSS.
            $response->headers->set(
                'Content-Security-Policy',
                "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"
            );

            // Future stricter policy is observational ONLY. Check Chrome CSP
            // console warnings before considering enforcement.
            $response->headers->set(
                'Content-Security-Policy-Report-Only',
                "default-src 'self'; "
                . "script-src 'self' 'unsafe-inline' https:; "
                . "style-src 'self' 'unsafe-inline' https:; "
                . "img-src 'self' https: data: blob:; "
                . "font-src 'self' https: data:; "
                . "connect-src 'self' https: wss:; "
                . "frame-src 'self' https:; "
                . "worker-src 'self' blob:; "
                . "form-action 'self' https:; "
                . "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
            );
        }

        // HSTS intentionally omitted on HTTP localhost. Enable it only after
        // HTTPS, reverse-proxy trust and any subdomain effects are validated.
        return $response;
    }
}

<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        TrustProxies::at(config('koteka.trusted_proxies', []));
        RateLimiter::for('koteka-workspace-write', function (Request $request): Limit {
            if ($request->isMethodSafe()) {
                return Limit::none();
            }
            $accountId = $request->session()->get('koteka_admin_id');

            return Limit::perMinute(60)->by(is_string($accountId) ? 'account:'.$accountId : 'ip:'.$request->ip());
        });
    }
}

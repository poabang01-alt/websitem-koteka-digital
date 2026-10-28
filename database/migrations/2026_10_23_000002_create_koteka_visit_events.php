<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('koteka_visit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('page', 255);
            $table->string('session_key', 80);
            $table->string('channel', 32);
            $table->string('device', 16);
            $table->timestamp('visited_at')->index();
            $table->index(['page', 'visited_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('koteka_visit_events');
    }
};

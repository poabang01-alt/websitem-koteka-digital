<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('koteka_content_revisions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('version')->unique();
            $table->longText('content_json');
            $table->uuid('actor_id')->nullable();
            $table->string('action', 12);
            $table->unsignedBigInteger('restored_from_version')->nullable();
            $table->timestamp('created_at');
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('koteka_content_revisions');
    }
};

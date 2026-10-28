<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('koteka_media', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('storage_path', 255)->unique();
            $table->string('mime_type', 40);
            $table->unsignedInteger('byte_size');
            $table->uuid('uploaded_by')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('koteka_media'); }
};

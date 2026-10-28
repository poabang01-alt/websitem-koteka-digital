<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('koteka_admin_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name',80);
            $table->string('email',120)->unique();
            $table->string('password');
            $table->string('role',24)->index();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });
        Schema::create('koteka_admin_activities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->json('user');
            $table->string('role',24);
            $table->string('module',80);
            $table->text('description');
            $table->timestamp('date')->index();
        });
        Schema::create('koteka_leads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nama',90);
            $table->string('nama_bisnis',120);
            $table->string('wa',24);
            $table->string('email',120)->nullable();
            $table->string('jenis_website',90);
            $table->string('anggaran',90);
            $table->string('target_selesai',90);
            $table->text('pesan');
            $table->string('kirim_via',30);
            $table->boolean('read')->default(false)->index();
            $table->json('delivery')->nullable();
            $table->boolean('replied')->default(false)->index();
            $table->timestamp('replied_at')->nullable();
            $table->json('replied_by')->nullable();
            $table->string('reply_channel',40)->nullable();
            $table->json('replies')->nullable();
            $table->timestamps();
        });
        Schema::create('koteka_reply_receipts', function (Blueprint $table) {
            $table->string('request_id',128)->primary();
            $table->uuid('lead_id');
            $table->string('fingerprint',64);
            $table->json('item');
            $table->timestamp('created_at')->useCurrent();
        });
        Schema::create('koteka_workspace_content', function (Blueprint $table) {
            $table->string('id',20)->primary();
            $table->longText('content_json');
            $table->unsignedBigInteger('version')->default(0);
            $table->timestamp('updated_at')->nullable();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('koteka_workspace_content');
        Schema::dropIfExists('koteka_reply_receipts');
        Schema::dropIfExists('koteka_leads');
        Schema::dropIfExists('koteka_admin_activities');
        Schema::dropIfExists('koteka_admin_accounts');
    }
};

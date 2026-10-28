<?php

namespace App\Models\Koteka;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Activity extends Model
{
    protected $table = 'koteka_admin_activities';
    public $timestamps = false;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected $casts = ['user'=>'array', 'date'=>'datetime'];
    protected static function booted(): void
    {
        static::creating(function (self $log): void { $log->id ??= (string) Str::uuid(); });
    }
    public function publicData(): array
    {
        return ['id'=>$this->id, 'user'=>$this->user, 'role'=>$this->role,
            'module'=>$this->module, 'description'=>$this->description,
            'date'=>$this->date?->toISOString()];
    }
}

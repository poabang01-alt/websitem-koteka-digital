<?php

namespace App\Models\Koteka;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class AdminAccount extends Model
{
    use SoftDeletes;

    protected $table = 'koteka_admin_accounts';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $hidden = ['password'];

    protected $casts = ['active' => 'boolean', 'version' => 'integer'];

    protected static function booted(): void
    {
        static::creating(function (self $account): void {
            $account->id ??= (string) Str::uuid();
        });
    }

    public function publicData(): array
    {
        return [
            'id' => $this->id, 'name' => $this->name, 'email' => $this->email,
            'role' => $this->role, 'active' => (bool) $this->active,
            'version' => (int) $this->version, 'locked' => $this->role === 'super_admin',
        ];
    }
}

<?php

namespace App\Models\Koteka;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Lead extends Model
{
    protected $table = 'koteka_leads';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected $casts = [
        'read'=>'boolean', 'replied'=>'boolean', 'delivery'=>'array',
        'replies'=>'array', 'replied_by'=>'array',
    ];
    protected static function booted(): void
    {
        static::creating(function (self $lead): void { $lead->id ??= (string) Str::uuid(); });
    }
    public function publicData(): array
    {
        return [
            'id'=>$this->id, 'date'=>$this->created_at?->toISOString(),
            'nama'=>$this->nama, 'namaBisnis'=>$this->nama_bisnis, 'wa'=>$this->wa,
            'email'=>$this->email, 'jenisWebsite'=>$this->jenis_website,
            'anggaran'=>$this->anggaran, 'targetSelesai'=>$this->target_selesai,
            'pesan'=>$this->pesan, 'kirimVia'=>$this->kirim_via,
            'read'=>(bool)$this->read, 'delivery'=>$this->delivery ?? [],
            'replied'=>(bool)$this->replied, 'repliedAt'=>$this->replied_at?->toISOString(),
            'repliedBy'=>$this->replied_by, 'replyChannel'=>$this->reply_channel,
            'replies'=>$this->replies ?? [],
        ];
    }
    protected function casts(): array
    {
        return [...$this->casts, 'replied_at'=>'datetime'];
    }
}

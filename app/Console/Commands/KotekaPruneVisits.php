<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class KotekaPruneVisits extends Command
{
    protected $signature = 'koteka:prune-visits {--days=90 : Hapus kunjungan lebih lama dari N hari}';
    protected $description = 'Hapus catatan kunjungan lama sesuai masa retensi';

    public function handle(): int
    {
        $days = filter_var($this->option('days'), FILTER_VALIDATE_INT);
        if ($days === false || $days < 7 || $days > 3650) {
            $this->error('Retensi harus berupa bilangan bulat antara 7 dan 3650 hari.');
            return self::FAILURE;
        }
        $count = DB::table('koteka_visit_events')
            ->where('visited_at', '<', now()->subDays($days))->delete();
        $this->info("{$count} kunjungan lama telah dihapus.");
        return self::SUCCESS;
    }
}

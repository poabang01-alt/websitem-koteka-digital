<?php

namespace App\Console\Commands;

use App\Services\Koteka\ContentRevisionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class KotekaContentRevisions extends Command
{
    protected $signature = 'koteka:content-revisions {--restore= : Versi historis yang akan dipulihkan} {--expected= : Versi konten saat ini untuk optimistic lock}';
    protected $description = 'Daftar dan pemulihan terbatas riwayat konten Koteka Digital (maksimal 50 revisi).';

    public function handle(ContentRevisionService $service): int
    {
        $current = (int) (DB::table('koteka_workspace_content')->where('id', 'published')->value('version') ?? 0);
        $this->line('Versi konten saat ini: '.$current);
        $rows = DB::table('koteka_content_revisions')->orderByDesc('version')->limit(50)
            ->get(['version', 'action', 'restored_from_version', 'created_at']);
        $this->table(['Version', 'Aksi', 'Dipulihkan dari', 'Waktu'], $rows->map(fn ($r) => [
            $r->version, $r->action, $r->restored_from_version ?? '-', $r->created_at,
        ])->all());
        if ($this->option('restore') === null) return self::SUCCESS;
        $target = filter_var($this->option('restore'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $expected = filter_var($this->option('expected'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
        if ($target === false || $expected === false || $this->option('expected') === null) {
            $this->error('Gunakan --restore=N --expected=VERSI_SAAT_INI.');
            return self::FAILURE;
        }
        if ((int) $expected !== $current) {
            $this->error('Versi terbaru sudah berubah. Periksa daftar revisi kembali.');
            return self::FAILURE;
        }
        if (!$this->confirm("Pulihkan seluruh konten dari revisi $target sebagai versi baru?", false)) {
            $this->warn('Dibatalkan. Tidak ada data berubah.');
            return self::SUCCESS;
        }
        $result = $service->commit([], (int) $expected, null, (int) $target);
        if ($result['status'] !== 200) {
            $this->error($result['body']['error']);
            return self::FAILURE;
        }
        $this->info('Berhasil memulihkan snapshot sebagai versi baru '.$result['body']['version'].'.');
        $this->warn('Muat ulang halaman Admin dan publik. Pemulihan via CLI tercatat di tabel revisi, bukan sebagai aktivitas pengguna.');
        return self::SUCCESS;
    }
}

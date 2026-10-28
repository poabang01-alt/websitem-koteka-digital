<?php

namespace App\Console\Commands;

use App\Models\Koteka\AdminAccount;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class KotekaCreateAdmin extends Command
{
    protected $signature = 'koteka:admin';
    protected $description = 'Buat/perbarui akun Super Admin Koteka Digital dengan password aman';

    public function handle(): int
    {
        $name = trim((string) $this->ask('Nama Super Admin', 'Super Admin Koteka Digital'));
        $email = strtolower(trim((string) $this->ask('Alamat email Super Admin')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email)>120 || strlen($name)<2 || strlen($name)>80) {
            $this->error('Nama/email tidak valid.'); return self::FAILURE;
        }
        $password = (string) $this->secret('Password baru (minimal 12 karakter)');
        $repeat = (string) $this->secret('Ulangi password');
        if (strlen($password)<12 || strlen($password)>128 || $password!==$repeat) {
            $this->error('Password harus sama dan terdiri atas 12-128 karakter.'); return self::FAILURE;
        }
        $existing = AdminAccount::query()->where('role','super_admin')->first();
        if (!$existing && AdminAccount::where('email',$email)->exists()) {
            $this->error('Email sudah digunakan akun lain.'); return self::FAILURE;
        }
        if ($existing && $existing->email !== $email && AdminAccount::where('email',$email)->exists()) {
            $this->error('Email sudah digunakan akun lain.'); return self::FAILURE;
        }
        $account = $existing ?: new AdminAccount();
        $account->fill(['name'=>$name, 'email'=>$email, 'password'=>Hash::make($password),
            'role'=>'super_admin', 'active'=>true, 'version'=>(int)($account->version ?? 0)+1]);
        $account->save();
        $this->info('Super Admin telah dibuat/diperbarui. Semua sesi akun lama dicabut.');
        return self::SUCCESS;
    }
}

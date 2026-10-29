# Audit keamanan Koteka Digital

Tanggal: 29 Oktober 2026 (Asia/Jayapura).

## Hasil dan batas kesimpulan

Perbaikan kode untuk temuan terkonfirmasi sudah diterapkan di workspace lokal. Seluruh 63 tes Laravel (518 assertion) dan 19 tes JavaScript lulus. Pemeriksaan advisory Composer dan npm menghasilkan nol kerentanan yang diketahui pada dependency yang tercakup. Tidak ada temuan critical atau high yang diketahui masih terbuka pada kode yang diperiksa; temuan stored XSS dengan tingkat high sudah diperbaiki.

Ini belum merupakan pengesahan keamanan instalasi Hostinger yang berjalan. Sertifikat TLS, document root, izin berkas, konfigurasi Apache/LiteSpeed, akun hosting, GitHub branch protection, dan pengaturan deployment jarak jauh belum dapat diverifikasi dari workspace ini. Tidak ada push, publikasi, atau deployment dilakukan. Audit tidak menjamin ketiadaan seluruh kerentanan.

Lingkungan yang diperiksa: PHP 8.5.5, Laravel 13.38.0, SQLite, PHPUnit 12.5.40, Laravel Pint 1.32.1, endpoint aplikasi, dashboard JavaScript, service worker, konfigurasi penyimpanan, serta ekspor GitHub Pages. Versi dependency diperiksa dari instalasi dan lockfile; API mengikuti versi terpasang.

## Temuan terkonfirmasi dan perbaikan

Severity berikut merupakan penilaian dampak dan prasyarat pada aplikasi ini, bukan skor CVSS baru.

| ID | Severity | Temuan dan dampak | Berkas utama | Perbaikan dan verifikasi |
| --- | --- | --- | --- | --- |
| K-01 | High | Tautan unduhan/pemesanan pricing dari konten tersimpan diteruskan langsung ke `anchor.href` dan `window.open`. URL berbahaya dapat menjalankan kode ketika pengunjung mengaktifkan CTA. | `public/assets/PricingSectionContainer-CyXKa1Eh.js`, `public/assets/koteka-workspace-sync.js`, `app/Services/Koteka/ContentSafety.php`, `app/Services/Koteka/ContentRevisionService.php` | Sanitasi pada sink browser melindungi konten lama tanpa menulis ulang database. Publikasi dan restore memvalidasi field URL secara rekursif di server. Skema script/HTML data, URL protocol-relative, backslash dan control character ditolak. Tautan HTTP(S), relatif, anchor, mailto/tel dan gambar raster yang didukung tetap diterima. Lima kasus backend dan tes JavaScript terhadap fungsi bundle sebenarnya lulus; PDF dan WhatsApp tetap berfungsi. |
| K-02 | Medium | Perbandingan izin Operator sebelumnya membuang koleksi/objek kosong. Operator dapat mengubah proyeksi publik melalui nilai kosong; koleksi Draft baru juga dapat menutupi konten publik bawaan. | `ContentRevisionService.php`, `PublicContentService.php`, `public/assets/koteka-workspace-sync.js` | Perbandingan mempertahankan tipe, list, dan nilai kosong. Metadata visibilitas koleksi Draft diturunkan server dan tidak dapat dipalsukan klien. Operator tetap dapat membuat/menghapus Draft. Admin tetap dapat menyembunyikan seluruh koleksi menggunakan Draft/Arsip atau list kosong. Restore mempertahankan metadata visibilitas historis. Tes larangan perubahan publik, pemalsuan marker, pengurutan key, dan restore lulus. |
| K-03 | Medium | Cabang GET hanya memeriksa metode GET, sedangkan route juga menerima HEAD. HEAD dapat jatuh ke kode perubahan data, sementara CSRF memperlakukan HEAD sebagai metode aman. | `app/Http/Controllers/Koteka/AccessController.php`, `VisitController.php` | Cabang baca menggunakan `isMethodSafe()`. Tes HEAD memastikan tidak membuat aktivitas/kunjungan dan tidak menandai pesan sebagai sudah dibaca. Tes CSRF untuk perubahan data tanpa token tetap lulus. |
| K-04 | Medium | Penyimpanan konten memuat banyak snapshot besar sekaligus dan membandingkan item dengan pencarian berulang. Akun terautentikasi dapat menghabiskan memori proses pada riwayat yang masih dalam batas yang diizinkan. | `app/Services/Koteka/ContentRevisionService.php` | Snapshot diproses bertahap dengan `lazy(1)`, referensi media disimpan sebagai indeks URL, dan pencarian record menggunakan indeks identitas. Retensi 50 revisi serta aturan penghapusan konten/media tetap teruji. Kasus 50 revisi, masing-masing 5.000 Draft dengan isi 400 karakter, berhasil menyimpan pada batas PHP 128 MB. |
| K-05 | Medium | Form menerima password sampai 128 karakter, tetapi bcrypt hanya membedakan 72 byte pertama. Suffix yang berbeda dapat diterima untuk password panjang. | `app/Services/Koteka/WorkspacePassword.php`, `AccessController.php`, `app/Console/Commands/KotekaCreateAdmin.php` | Password baru/perubahan password yang melebihi 72 byte atau mengandung NUL menggunakan Argon2id ketika default bcrypt. Verifikasi memilih driver berdasarkan algoritma hash yang diizinkan sehingga akun bcrypt/Argon lama tetap dapat login. Tes suffix salah ditolak dan password lengkap diterima. Hash akun lama tidak diubah; keterbatasan hash bcrypt lama dijelaskan pada risiko tersisa. |
| K-06 | Medium | Endpoint penulisan Workspace dan pemrosesan upload belum memiliki pembatasan khusus terhadap penyalahgunaan berulang oleh akun terautentikasi. | `app/Providers/AppServiceProvider.php`, `routes/koteka.php`, `MediaController.php` | Batas 60 perubahan/menit per akun dan 20 upload/menit sebelum pemrosesan gambar. Pembacaan dan logout tetap tersedia. Batas login, lead dan analytics yang sudah ada dipertahankan. Tes permintaan berlebih menghasilkan 429 dan tidak membuat record upload. |
| K-07 | Medium | Versi terkunci `symfony/mime` 8.1.7 terkena advisory header injection CVE-2026-45070. Ini temuan dependency; eksploitasi aplikasi melalui input aktual tidak diklaim telah dibuktikan. | `composer.lock` | Pembaruan terbatas ke 8.1.10; tidak mengubah `composer.json` atau dependency PHP lainnya. Composer audit setelah pembaruan menghasilkan advisory kosong dan tidak ada paket abandoned. Rujukan: [advisory resmi Symfony](https://github.com/symfony/symfony/security/advisories/GHSA-vqc8-7275-q272). |
| K-08 | Low | Payload array pada telepon lead/email akun dapat mencapai normalisasi string dan menghasilkan error server, bukan error validasi. | `LeadController.php`, `AccessController.php` | Tipe diperiksa sebelum normalisasi. Tes menghasilkan 422 dan memastikan akun tidak berubah. |

## Penguatan produksi

- `KotekaSecurityHeaders` memaksa debug nonaktif dan cookie sesi Secure/HttpOnly/SameSite=Lax pada lingkungan production. APP_URL wajib HTTPS dengan host valid; host lain ditolak. Redirect HTTP menggunakan origin yang dikonfigurasi, bukan host kiriman pengguna. HTTPS produksi mengirim HSTS satu tahun tanpa preload/includeSubDomains.
- Header `nosniff`, larangan framing, kebijakan referrer dan Permissions-Policy diterapkan pada respons normal yang melewati middleware. API menggunakan cache privat tanpa penyimpanan. CSP yang diterapkan mencakup `base-uri`, `object-src`, `frame-ancestors`, dan `form-action`. Kebijakan CSP yang lebih luas tetap report-only demi kompatibilitas UI; ini belum merupakan proteksi nonce untuk seluruh script.
- `bootstrap/app.php`, `AppServiceProvider.php`, dan `config/koteka.php` hanya mempercayai proxy yang secara eksplisit diatur melalui `KOTEKA_TRUSTED_PROXIES`. Forwarded host tidak digunakan. Header HTTPS palsu dari proxy yang tidak dipercaya tidak menghindari redirect dalam tes.
- `config/session.php` memilih cookie Secure secara default di production. Berkas `.env.production.example` menyediakan contoh tanpa rahasia. Berkas `.env` aktif dan APP_KEY yang ada tidak ditimpa.
- `.htaccess` root menolak direktori internal dan berkas sensitif sebagai pertahanan tambahan. `public/.htaccess` menolak dotfile, database, log, key dan backup serta menonaktifkan directory listing. Aturan ini memerlukan verifikasi di Apache/LiteSpeed aktual; server bawaan PHP tidak mengeksekusinya.
- Perintah baru `php artisan koteka:security-check --no-interaction` memeriksa konfigurasi produksi, kunci enkripsi, Argon2id, lokasi privat, SQLite persisten, proxy dan integritas SQLite. Pemeriksaan integritas memakai koneksi SQLite read-only. Tes database sementara membuktikan hash file tidak berubah setelah perintah.
- `tests/TestCase.php` mencegah HTTP keluar yang tidak di-fake, sehingga tes tidak mengirim notifikasi ke pelanggan atau layanan nyata.

## Area yang ditinjau dan regresi yang dipertahankan

Otentikasi tetap memakai sesi server, rotasi ID sesi setelah login, pembatasan percobaan login, validasi akun aktif dan versi akun. Penonaktifan/penghapusan akun membatalkan akses sesi lama. Pengelolaan akun dan penghapusan log tetap dibatasi Super Admin; Operator tetap dibatasi Draft. Tidak ada login demo sebagai fallback ketika API gagal.

Route API aplikasi tetap berada pada middleware web Laravel sehingga CSRF aktif. Penulisan konten memakai transaksi dan pemeriksaan versi untuk menolak perubahan yang sudah kedaluwarsa. Query yang ditinjau memakai query builder/Eloquent dan parameter terikat; tidak ditemukan SQL injection yang terkonfirmasi pada jalur tersebut. Jalur halaman publik memakai daftar slug yang diizinkan.

Upload tetap dibatasi gambar JPEG/PNG/WebP, MIME aktual, ukuran 2 MB, serta dimensi 3.000 x 3.000. SVG yang menyamar sebagai PNG ditolak. Media disimpan pada disk privat; pengunjung hanya dapat membaca media yang dirujuk konten publik. Riwayat dan Draft tidak dibocorkan melalui API publik. Tes memastikan media bersama dan media yang masih dirujuk revisi tidak ikut terhapus.

Perubahan sebelumnya pada penghapusan log, inbox, konten, retensi akun/User dan penghapusan fallback demo tetap dipertahankan. Tes regresi mencakup konfirmasi dan cakupan penghapusan, otorisasi, CSRF, pencabutan sesi, revisi, media, penyimpanan frontend setelah respons server, dan pembaruan cache. Audit ini tidak menjalankan fitur penghapusan terhadap data aplikasi yang ada.

Pemindaian pola pada 299 berkas tracked dan satu commit yang tersedia tidak menemukan rahasia yang dikenali. `.env` diabaikan Git. Ini tidak memeriksa secret store GitHub, log Actions jarak jauh, backup eksternal, atau riwayat yang tidak tersedia secara lokal.

Ekspor `_site` diperbarui dari sumber dengan perbaikan pricing dan helper yang sama. Validasi 192 berkas ekspor tidak menemukan PHP, database, SQL, log, env, private key atau backup. Halaman admin ekspor menjelaskan kebutuhan Laravel. GitHub Pages menyediakan preview publik; login, API, SQLite, dan dashboard operasional memerlukan hosting Laravel.

## Hasil verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `php artisan test --compact` | PASS: 63 tes, 518 assertion; seluruh suite, termasuk tes keamanan dan regresi |
| Enam berkas tes Node dijalankan langsung | PASS: 19 tes; persistence 5, controls 2, contact-map 4, service-worker 4, pricing-security 2, publication-visibility 2 |
| `node --check` pada JavaScript yang berubah/ditambahkan | PASS: 14 berkas |
| `php vendor/bin/pint --dirty --format agent` | PASS; format PHP diperbaiki |
| `git diff --check` | PASS; hanya pemberitahuan konversi CRLF/LF Git, tanpa error whitespace |
| `composer --no-cache audit --locked --no-interaction --format=json` | PASS: advisory kosong; abandoned kosong |
| `npm audit --json` | PASS: 0 kerentanan pada semua severity di lockfile |
| `composer check-platform-reqs --no-interaction` | PASS untuk PHP dan extension lokal |
| `php artisan route:list --except-vendor --path=api` | 16 route API aplikasi diperiksa |
| Build dan validasi ekspor GitHub Pages | PASS: 192 berkas publik, placeholder admin, pricing tersanitasi |
| SQLite utama, koneksi read-only `PRAGMA quick_check` | `ok`; tidak ada akun tes `@example.invalid` |
| Preflight pada konfigurasi produksi sementara di tes | PASS; hash database sementara tidak berubah |
| Preflight pada konfigurasi lokal aktual | Belum layak produksi: environment, debug, HTTPS URL, dan Secure cookie gagal sesuai konfigurasi lokal; pemeriksaan lainnya lulus |

Composer hanya memperbarui `symfony/mime`. Lockfile npm ditambahkan tanpa mengubah `package.json`, memasang `node_modules`, atau menjalankan lifecycle script. Metadata dependency dikirim ke layanan advisory Packagist/npm setelah izin eksplisit pengguna.

Tes Laravel menggunakan SQLite `:memory:` dan sesi/cache pengujian; tes preflight memakai file sementara yang dibuat sendiri. Tidak ada migrate, migrate:fresh, reset, seeding, pembuatan ulang APP_KEY, atau penghapusan record pada database aplikasi dalam tahap audit ini. Pemeriksaan database utama hanya baca.

Hash keseluruhan file SQLite yang diamati tidak identik dengan nilai awal ketika aplikasi lokal tetap berjalan; tabel sesi menunjukkan aktivitas berjalan. Karena tidak tersedia snapshot awal setiap tabel, laporan ini tidak mengklaim kesamaan byte maupun pembuktian perbandingan setiap record. Pemeriksaan tidak menemukan akun pengujian pada database utama, integritas SQLite baik, dan timestamp perubahan terakhir akun/konten/inbox yang diperiksa mendahului tahap pengujian ini. Tidak dilakukan pemulihan file lama yang berpotensi menimpa aktivitas sah.

## Risiko tersisa dan langkah Hostinger

1. **Deployment belum diverifikasi.** Arahkan document root ke `public/`; simpan SQLite, `.env`, source dan penyimpanan privat di luar area publik. Pastikan sertifikat TLS valid, HTTP beralih ke HTTPS dan alias domain diarahkan ke host APP_URL sebelum mencapai Laravel. Host berbeda memang ditolak oleh kode. Verifikasi akses ke `.env`, `.git`, database/journal SQLite, log, vendor dan backup menghasilkan 403/404 tanpa isi sensitif; pastikan directory listing mati. Aturan server baru belum diuji pada Hostinger/Apache yang aktif.
2. **Pertahankan data dan kunci.** Gabungkan pengaturan contoh dengan `.env` produksi yang sudah ada; jangan menyalinnya secara buta. Pertahankan APP_KEY, lokasi SQLite, kredensial dan konfigurasi notifikasi aktual. Backup konsisten dan uji pemulihan sebelum deployment. Jangan menjalankan reset/fresh/seeder. Enkripsi sesi opsional dalam contoh akan mengakhiri sesi lama jika diaktifkan pada instalasi yang sebelumnya tidak memakainya.
3. **Konfigurasi produksi wajib.** Gunakan `APP_ENV=production`, `APP_DEBUG=false`, APP_URL HTTPS, cookie aman, versi PHP/extension yang kompatibel termasuk Argon2id, serta cache limiter yang persisten. Daftar proxy harus sesuai informasi host; jangan gunakan wildcard untuk menutupi redirect loop. Jalankan `composer install --no-dev --optimize-autoloader` dari lockfile di proses rilis, kemudian periksa platform dan jalankan preflight pada host. Jangan menerapkan contoh konfigurasi ke lingkungan lokal HTTP.
4. **Legacy bcrypt, risiko medium bersyarat.** Jika akun lama memakai password lebih dari 72 byte dan hash bcrypt, suffix aslinya tidak dapat dipulihkan dari hash. Perbaikan melindungi password baru/perubahan password, tetapi hash lama sengaja tidak direset atau ditulis ulang. Akun yang diketahui memakai password panjang tersebut perlu mengganti password melalui pengelolaan akun yang sudah tersedia. Tidak dilakukan rehash otomatis saat login karena itu dapat mengesahkan suffix yang salah.
5. **Cakupan dependency frontend.** Nol advisory npm berlaku pada lockfile build tooling. Semua dependency pada bundle publik yang sudah dikompilasi tidak memiliki SBOM/source manifest lengkap dalam proyek ini; marker React yang diperiksa adalah 19.2.8. Hasil audit npm tidak boleh dianggap pemeriksaan menyeluruh atas seluruh dependency bundle tersebut. Simpan sumber build dan lockfile aslinya untuk pemeliharaan selanjutnya.
6. **Validasi browser dan operasi.** Tes Node menggunakan VM terhadap kode nyata, bukan browser penuh. Tes visual/browser Playwright tidak dijalankan karena modul tidak tersedia. Uji login/logout, upload, Draft/publikasi/restore, PDF/WhatsApp, inbox, log dan service-worker update di staging HTTPS sebelum rilis. Pantau 429/5xx, kapasitas SQLite/storage dan backup. CSP yang lebih ketat perlu pengujian kompatibilitas browser terlebih dahulu.
7. **Pengaturan GitHub dan hosting.** Izin token/Actions, branch protection, deployment secret, SSH/SFTP, backup hosting dan patch OS/web server belum diperiksa. Batasi hak akses dan publikasikan hanya artefak yang diperlukan. Jangan memakai GitHub Pages sebagai deployment backend Laravel.

Rujukan implementasi: [Laravel deployment](https://laravel.com/framework/docs/deployment), [trusted proxies/hosts](https://laravel.com/framework/docs/requests), dan [rate limiting](https://laravel.com/framework/docs/rate-limiting). Kelulusan seluruh pemeriksaan di lingkungan tujuan dan uji staging tetap diperlukan sebelum menyebut instalasi tersebut siap produksi.

# S15: Ketentuan API dan arsip laporan PetaBencana.id

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` sebelum dikirim (surat resmi atau email). Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Perihal: Permohonan informasi ketentuan penggunaan API dan akses arsip laporan banjir DKI Jakarta

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Pengurus Yayasan Peta Bencana
u.p. [Tim data/teknis PetaBencana.id]
di [kota]

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator pengendalian banjir Dinas SDA dan Pusdalops BPBD Provinsi DKI Jakarta. Laporan warga di PetaBencana.id kami pakai sebagai salah satu sumber kejadian banjir untuk memverifikasi prakiraan, di samping data BPBD.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan hingga [Desember 2026]. Keluaran hanya untuk operator instansi; tidak ada peringatan publik.
2. Laporan dipakai pada tingkat lokasi dan waktu (agregat RT/kelurahan), bukan pada tingkat individu pelapor.

**Informasi dan data yang dimohon**
| Butir | Pertanyaan atau spesifikasi |
|---|---|
| Ketentuan | syarat penggunaan dan lisensi data API, serta bentuk atribusi yang diminta |
| Teknis | host API yang berlaku saat ini, batas laju (*rate limit*), dan apakah tersedia filter wilayah DKI Jakarta di sisi server |
| Arsip | laporan banjir DKI Jakarta untuk (a) Januari 2020 dan (b) musim hujan 2024/2025 dan 2025/2026, dengan koordinat, waktu laporan, ketinggian air bila ada, dan status verifikasi |
| Format | GeoJSON atau CSV |
| Frekuensi | arsip sekali kirim; data berjalan melalui API publik dengan pemanggilan santun (paling sering per [N] menit) |

**Perlindungan dan batas penggunaan data**
- Kami tidak meminta identitas, nomor telepon, atau akun media sosial pelapor. Bila arsip memuat data pribadi, mohon dihapus sebelum dikirim. Kami memproses data sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
- Data tidak didistribusikan ulang di luar ketentuan lisensi PetaBencana.id, dan selalu diberi atribusi.
- Data hanya dipakai untuk evaluasi dan pendukung keputusan operator.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

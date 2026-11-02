# S4: Arsip Info Banjir BPBD DKI (termasuk Januari 2020 dan musim hujan 2024 sampai 2026)

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi data
Perihal: Permohonan data arsip genangan/banjir tingkat RT

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Pelaksana Badan Penanggulangan Bencana Daerah Provinsi DKI Jakarta
u.p. Kepala Pusdalops PB / PPID BPBD [unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator Posko Banjir Dinas SDA dan Pusdalops BPBD DKI. Noah mencatat setiap prakiraan banjir dan membandingkannya dengan kejadian nyata. Data Info Banjir BPBD adalah acuan kejadian (*ground truth*) yang paling tepat untuk evaluasi tersebut.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan hingga [Desember 2026]. Prosedur BPBD dan Dinas SDA tidak berubah.
2. Noah tidak menerbitkan peringatan kepada publik. Kewenangan peringatan bencana ada pada BPBD (UU No. 24 Tahun 2007), dan peringatan meteorologis pada BMKG (UU No. 31 Tahun 2009).
3. Noah tidak mengendalikan SCADA, pompa, atau pintu air.

**Spesifikasi data**
| Butir | Spesifikasi |
|---|---|
| Isi | RT/RW/kelurahan tergenang, waktu mulai dan waktu surut, ketinggian genangan (cm), status pintu air bila tercatat |
| Periode | (a) 1 sampai 31 Januari 2020; (b) musim hujan 2024/2025 dan 2025/2026 (November sampai April); (c) bila memungkinkan, seluruh 2020 sampai 2026 |
| Resolusi waktu | per jam atau per laporan |
| Kode wilayah | kode RT yang konsisten dengan kode wilayah BPS atau Dukcapil, beserta penjelasan skemanya |
| Definisi | definisi "tergenang", cara menentukan waktu mulai dan surut, dan perubahan definisi selama periode |
| Format | CSV atau Excel |
| Frekuensi | sekali kirim untuk arsip |
| Pertanyaan pendukung | rata-rata keterlambatan laporan susulan, dan apakah data jumlah pengungsi tersedia secara agregat |

**Perlindungan dan batas penggunaan data**
- Kami **tidak** meminta data pribadi warga atau pelapor. Data dipakai pada tingkat RT, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
- Data digunakan hanya untuk evaluasi akurasi dan kalibrasi model, sesuai PKS atau persetujuan tertulis.
- Data mentah tidak didistribusikan ulang. Publikasi hanya memuat hasil agregat, dengan persetujuan BPBD.
- Akses terbatas pada tim yang ditunjuk. Data dihapus atau dikembalikan pada akhir perjanjian.

Kami juga mohon kesediaan BPBD untuk bersama Dinas SDA menyepakati definisi kejadian banjir (*event definition*) yang dipakai dalam evaluasi. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan:
1. Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
2. [Kepala SCCIC ITB]

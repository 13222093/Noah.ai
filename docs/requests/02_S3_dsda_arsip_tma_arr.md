# S3: Arsip TMA dan curah hujan (ARR) DSDA 2020 sampai 2026, interval 5 menit

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi data
Perihal: Permohonan data arsip tinggi muka air dan curah hujan 2020 sampai 2026

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
u.p. PPID Pembantu Dinas SDA / layanan permohonan data [unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan pengendalian banjir untuk operator Posko Banjir Dinas SDA, operator rumah pompa, dan Pusdalops BPBD DKI. Untuk menentukan ambang banjir per polder dan menguji akurasi prakiraan terhadap kejadian lalu (*backtest*), kami memohon data arsip telemetri Dinas SDA.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan pada 2 sampai 3 polder percontohan ([nama polder]) hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah.
2. Tidak ada peringatan kepada publik (UU No. 31 Tahun 2009; UU No. 24 Tahun 2007). Keluaran hanya untuk operator.
3. Tidak ada perintah ke SCADA, pompa, atau pintu air. Keluaran hanya berupa saran.

**Spesifikasi data**
| Butir | Spesifikasi |
|---|---|
| Isi | (a) TMA seluruh pos telemetri; (b) curah hujan dari sekitar 55 pos ARR |
| Periode | 1 Januari 2020 sampai [tanggal pengiriman] 2026. Prioritas: musim hujan (November sampai April) dan Januari 2020 |
| Interval | 5 menit (asli, tanpa agregasi) |
| Resolusi dan satuan | TMA 1 cm; hujan 0,5 mm atau lebih halus; satuan dinyatakan |
| Metadata | kode dan nama pos, koordinat, datum TMA, zona waktu stempel waktu (WIB atau UTC), batas Siaga per pos dan tanggal berlakunya, riwayat penggantian alat, penanda kualitas atau data kosong |
| Format | CSV atau Excel per pos per bulan (Parquet atau NetCDF juga dapat kami terima) |
| Frekuensi | sekali kirim untuk arsip; bila memungkinkan, pembaruan bulanan selama uji coba |
| Batas minimum yang masih berguna | interval paling lama 10 menit dan datum terdokumentasi |

**Perlindungan dan batas penggunaan data**
- Data digunakan hanya untuk tujuan di atas, sesuai PKS atau persetujuan tertulis.
- Data mentah tidak didistribusikan ulang. Publikasi ilmiah hanya memuat hasil agregat, dan atas persetujuan Dinas SDA.
- Data disimpan dengan akses terbatas pada tim yang ditunjuk, lalu dihapus atau dikembalikan pada akhir perjanjian sesuai ketentuan PKS.
- Data ini tidak memuat data pribadi; jika ada, pemrosesan mengikuti UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.

Permohonan ini kami sampaikan sesuai UU No. 14 Tahun 2008 tentang Keterbukaan Informasi Publik, dan kami siap mengikuti prosedur layanan data Dinas SDA. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan: [Kepala SCCIC ITB]

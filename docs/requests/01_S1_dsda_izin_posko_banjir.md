# S1: Izin resmi penggunaan data Posko Banjir DSDA dan endpoint XML

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi teknis
Perihal: Permohonan izin penggunaan data tinggi muka air Posko Banjir DSDA

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
u.p. [Kepala Bidang/Unit pengelola Posko Banjir DSDA; nama unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan pengendalian banjir untuk operator Posko Banjir Dinas SDA, operator rumah pompa, dan Pusdalops BPBD Provinsi DKI Jakarta. Noah memperkirakan polder dan kelurahan yang berpotensi tergenang dalam 1 sampai 3 jam ke depan, menyarankan penempatan pompa dan Satgas, serta mencatat setiap prakiraan terhadap kejadian nyata agar akurasinya dapat dievaluasi.

Data tinggi muka air (TMA) pada laman publik https://poskobanjir.dsdadki.web.id/ adalah masukan utama sistem ini. Kami memohon izin resmi untuk menggunakannya, beserta akses ke endpoint XML yang tersedia.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan (*shadow mode*) pada 2 sampai 3 polder percontohan ([nama polder]) hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah karena Noah.
2. Keluaran hanya untuk operator yang terautentikasi. Noah tidak menerbitkan peringatan kepada publik; kewenangan itu ada pada BMKG (UU No. 31 Tahun 2009) dan BPBD (UU No. 24 Tahun 2007).
3. Noah tidak mengirim perintah atau *setpoint* ke SCADA, pompa, atau pintu air. Semua keluaran bersifat saran; keputusan tetap di tangan operator.

**Data dan cara akses yang dimohon**
| Butir | Spesifikasi minimum |
|---|---|
| Isi | TMA seluruh pos (saat ini 37 pos) dan status Siaga |
| Interval | paling lama 10 menit (saat ini sekitar 5 menit) |
| Resolusi dan satuan | 1 cm; mohon konfirmasi apakah `tinggi_air` dalam mm atau cm |
| Keterlambatan | kurang dari 15 menit |
| Metadata | koordinat, datum (titik nol) setiap pos, tabel batas Siaga 1/2/3 resmi semua pos, penjelasan nilai negatif (misalnya Pluit, Cideng, Cibalok) |
| Format | URL endpoint XML resmi, atau format lain yang Bapak/Ibu tetapkan |
| Frekuensi akses | satu permintaan per 5 menit dengan *User-Agent* yang mengidentifikasi SCCIC ITB, atau batas lain yang Bapak/Ibu tetapkan |
| Periode | mulai [tanggal persetujuan] hingga akhir PKS |

**Perlindungan dan batas penggunaan data**
- Data digunakan hanya untuk tujuan di atas, sesuai Perjanjian Kerja Sama (PKS) atau izin tertulis yang Bapak/Ibu berikan.
- Data mentah tidak didistribusikan ulang kepada pihak ketiga. Setiap angka yang ditampilkan mencantumkan sumber "Dinas SDA DKI" dan waktu pengamatan.
- Data ini tidak memuat data pribadi; jika ada, pemrosesan mengikuti UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
- Sampai izin terbit, kami mengakses laman publik secara santun (satu permintaan per 5 menit, dengan identitas jelas). Kami siap menghentikannya bila Bapak/Ibu meminta.

Kami mohon arahan mengenai bentuk izin (surat atau PKS) dan unit yang dapat kami hubungi. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan:
1. [Kepala SCCIC ITB]
2. [Kepala Pusat Data dan Informasi Dinas SDA, bila ada]

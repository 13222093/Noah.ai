# S5: Perjanjian riset data nowcasting BMKG dalam format grid

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi data dan ringkasan rencana riset
Perihal: Permohonan kerja sama riset dan akses data nowcasting curah hujan (grid)

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Badan Meteorologi, Klimatologi, dan Geofisika
u.p. [Deputi Bidang Meteorologi / unit pengelola nowcasting; dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator pengendalian banjir Dinas SDA dan Pusdalops BPBD Provinsi DKI Jakarta. Noah menerjemahkan prakiraan hujan BMKG menjadi perkiraan polder yang berpotensi tergenang dalam 1 sampai 3 jam, beserta saran penempatan pompa bagi operator.

**Batasan penggunaan**
1. **Noah tidak menerbitkan informasi atau peringatan meteorologis kepada publik.** Kami menghormati kewenangan BMKG berdasarkan UU No. 31 Tahun 2009. Keluaran hanya untuk operator instansi yang terautentikasi, dan produk BMKG dicantumkan sebagai sumber.
2. Uji coba berjalan dalam mode bayangan hingga [Desember 2026] pada 2 sampai 3 polder percontohan.
3. Tidak ada kendali ke SCADA, pompa, atau pintu air.

**Spesifikasi data**
| Butir | Spesifikasi |
|---|---|
| Produk | nowcast curah hujan 0 sampai 3 jam (hingga 6 jam bila tersedia); bila memungkinkan juga reflektivitas radar komposit |
| Wilayah | Jabodetabek, minimal DKI Jakarta beserta DAS Ciliwung hulu |
| Format | data grid (NetCDF, GeoTIFF, atau HDF5) dengan sistem koordinat, satuan (mm/jam atau dBZ), waktu terbit (*issued*), dan waktu berlaku (*valid*) |
| Interval | 10 menit |
| Keterlambatan | serendah mungkin; mohon informasi tipikalnya |
| Arsip | nowcast dan peringatan dini cuaca dengan stempel waktu untuk musim hujan 2024/2025 dan 2025/2026, untuk *backtest* |
| Saat ini | mohon konfirmasi URL citra nowcast publik yang stabil, kadensinya, dan izin pemakaiannya untuk sistem operator |
| Cara akses | API, FTP, atau mekanisme lain yang ditetapkan BMKG |

**Perlindungan dan batas penggunaan data**
- Data digunakan hanya untuk tujuan riset dan pendukung keputusan operator, sesuai perjanjian kerja sama.
- Data mentah tidak didistribusikan ulang. Hasil evaluasi akurasi yang melibatkan produk BMKG hanya dipublikasikan atas persetujuan BMKG.
- Data ini tidak memuat data pribadi.

Kami juga berminat menyelaraskan Noah dengan uji coba prakiraan berbasis dampak (*impact-based forecasting*) BMKG untuk Jabodetabek, bila memungkinkan. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan:
1. [Kepala Balai Besar MKG Wilayah II; konfirmasi wilayah layanan]
2. [Kepala SCCIC ITB]

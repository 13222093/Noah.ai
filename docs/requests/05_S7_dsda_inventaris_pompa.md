# S7: Inventaris pompa per rumah pompa

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas templat isian
Perihal: Permohonan data inventaris pompa stasioner dan pompa mobile

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
u.p. PPID Pembantu Dinas SDA / [Bidang pemeliharaan pompa; unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator Posko Banjir dan operator rumah pompa Dinas SDA. Saran penempatan pompa mobile dan perhitungan neraca air polder memerlukan kapasitas pompa yang akurat. Kami tidak akan menebak kapasitas; tanpa data resmi, kekosongan tersebut kami catat sebagai keterbatasan.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah.
2. Tidak ada peringatan publik dan tidak ada kendali ke SCADA, pompa, atau pintu air. Keluaran hanya berupa saran kepada operator.

**Spesifikasi data**
| Butir | Spesifikasi |
|---|---|
| Cakupan | minimal rumah pompa di polder percontohan ([nama polder]); bila memungkinkan seluruh lokasi (data publik Desember 2025: 612 pompa stasioner di 211 lokasi, 590 pompa mobile) |
| Per rumah pompa | nama, koordinat, polder yang dilayani, saluran pembuang (outlet) |
| Per unit pompa | jumlah, kapasitas (m3/detik), jenis, tahun pasang, status operasi saat ini, elevasi nyala/mati |
| Pompa mobile | jumlah dan kapasitas per Sudin SDA, titik siaga yang biasa dipakai |
| Pendukung | genset, kapasitas kolam/waduk (m3), ada atau tidaknya SCADA |
| Format | Excel atau CSV (templat terlampir) |
| Frekuensi | sekali kirim, lalu pembaruan bila ada perubahan selama uji coba |

**Perlindungan dan batas penggunaan data**
- Data digunakan hanya untuk tujuan di atas, sesuai PKS atau persetujuan tertulis.
- Data rinci per rumah pompa tidak didistribusikan ulang dan hanya ditampilkan kepada operator yang terautentikasi.
- Data ini tidak memuat data pribadi; jika ada (misalnya nama dan nomor operator), pemrosesan mengikuti UU No. 27 Tahun 2022, dan data tersebut disimpan terenkripsi dengan akses terbatas.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan: [Kepala SCCIC ITB]

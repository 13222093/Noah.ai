# S8: Jaringan drainase dan batas polder (SIGA/MAPID)

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi data geospasial
Perihal: Permohonan data geospasial batas polder dan jaringan drainase

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
u.p. [Unit pengelola data geospasial SIGA/MAPID; nama unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator Posko Banjir dan operator rumah pompa Dinas SDA. Prakiraan per polder dan kelurahan memerlukan batas polder resmi. Tanpa data ini, kami terpaksa mendigitasi batas secara manual dari DEM, yang kurang akurat dan belum tentu sesuai dengan batas operasional Dinas SDA.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah.
2. Tidak ada peringatan publik dan tidak ada kendali ke SCADA, pompa, atau pintu air.

**Spesifikasi data**
| Butir | Spesifikasi |
|---|---|
| Minimum | poligon batas polder untuk polder percontohan ([nama polder]); bila memungkinkan seluruh polder DKI |
| Tambahan | jaringan saluran (garis) dengan hierarki dan arah aliran, lokasi rumah pompa, pintu air, waduk/situ, dan titik outlet |
| Atribut | nama dan kode polder, luas (ha), rumah pompa yang melayani, tanggal pembaruan |
| Format | GeoJSON, Shapefile, atau GeoPackage; sistem koordinat dinyatakan (misalnya EPSG:4326 atau UTM 48S) |
| Cara akses | unduhan berkas, atau layanan WFS/API SIGA/MAPID dengan akun yang ditetapkan |
| Frekuensi | sekali kirim, lalu pembaruan bila batas berubah |
| Kebutuhan waktu | sebelum [tanggal akhir Minggu ke-2] agar batas dapat dimuat ke sistem |

**Perlindungan dan batas penggunaan data**
- Data digunakan hanya untuk tujuan di atas, sesuai PKS atau persetujuan tertulis.
- Data geospasial mentah tidak didistribusikan ulang. Peta hanya ditampilkan kepada operator yang terautentikasi, dengan atribusi "Dinas SDA DKI".
- Data ini tidak memuat data pribadi.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan: [Kepala SCCIC ITB]

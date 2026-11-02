# S12: Cuplikan (snapshot) CCTV pos pantau dan rumah pompa melalui Diskominfotik

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas daftar kamera yang dimohon dan spesifikasi teknis
Perihal: Permohonan akses cuplikan CCTV pos pantau air dan rumah pompa

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Komunikasi, Informatika dan Statistik Provinsi DKI Jakarta
u.p. [Bidang/Unit pengelola CCTV; nama unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator Posko Banjir dan operator rumah pompa Dinas SDA. Cuplikan CCTV di pos pantau dan rumah pompa (sekitar 118 kamera milik Dinas SDA) dapat menjadi bukti pendukung tinggi genangan untuk memverifikasi prakiraan. Kami memohon akses cuplikan untuk kamera di polder percontohan.

**Batasan penggunaan**
1. Uji coba berjalan dalam mode bayangan hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah.
2. Tidak ada peringatan publik (UU No. 31 Tahun 2009; UU No. 24 Tahun 2007). Tidak ada kendali ke SCADA, pompa, atau pintu air.
3. CCTV hanya dipakai untuk membaca tinggi air (papan duga atau acuan tetap), bukan untuk mengenali orang atau kendaraan.

**Spesifikasi data**
| Butir | Spesifikasi minimum |
|---|---|
| Kamera | pos pantau dan rumah pompa di [nama polder] (daftar terlampir; diisi bersama Dinas SDA) |
| Isi | cuplikan gambar diam (*snapshot*), bukan video kontinu |
| Frekuensi | minimal 1 cuplikan per menit saat hujan; lebih jarang saat cuaca kering |
| Kualitas | minimal 720p, posisi kamera tetap, papan duga (*staff gauge*) atau acuan tetap terlihat, ada penerangan malam |
| Metadata | ID kamera, koordinat, arah pandang, stempel waktu dengan zona waktu |
| Cara akses | URL cuplikan dari host tetap yang dapat di-*allowlist*, atau melalui platform yang ditetapkan Diskominfotik/SCCIC (misalnya VIANA) |

**Perlindungan data pribadi (UU No. 27 Tahun 2022)**
- Cuplikan dapat secara tidak sengaja memuat orang. Karena itu: tidak ada pengenalan wajah atau pelat nomor; cuplikan disimpan paling lama [N] hari, lalu dihapus; yang disimpan permanen hanya hasil pembacaan tinggi air.
- Kami mohon arahan apakah cuplikan boleh keluar dari sistem Pemprov DKI. Bila tidak, pemrosesan dapat dilakukan di dalam infrastruktur yang ditetapkan Diskominfotik.
- Cuplikan tidak didistribusikan ulang dan hanya dipakai untuk tujuan di atas, sesuai PKS.
- Akses terbatas pada tim yang ditunjuk dan dicatat.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan:
1. Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
2. [Kepala SCCIC ITB]

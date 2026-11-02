# S6: Kerja sama akses baca (read-only) data SCADA rumah pompa

> **DRAF, BELUM DIKIRIM.** Lengkapi semua `[isian]` dan cetak di kop surat SCCIC ITB sebelum dikirim. Lihat `README.md`.

Nomor: [nomor surat SCCIC ITB]
Lampiran: 1 (satu) berkas spesifikasi teknis dan draf ruang lingkup PKS
Perihal: Permohonan kerja sama akses data SCADA rumah pompa (hanya baca)

[Bandung/Jakarta], [tanggal]

Kepada Yth.
Kepala Dinas Sumber Daya Air Provinsi DKI Jakarta
u.p. [Kepala Bidang/Unit pengelola rumah pompa dan SCADA; nama unit dikonfirmasi]
di Jakarta

Dengan hormat,

Smart City and Community Innovation Center (SCCIC) Institut Teknologi Bandung sedang mengembangkan **Noah AI**, modul pendukung keputusan untuk operator Posko Banjir dan operator rumah pompa Dinas SDA. Salah satu fungsinya adalah memperkirakan kapan kolam/sump akan penuh pada prakiraan hujan, menyarankan kapan pompa sebaiknya dinyalakan lebih awal untuk menurunkan muka air, dan mendeteksi pompa yang kinerjanya menurun. Untuk itu kami memohon kerja sama akses data SCADA, **hanya untuk dibaca**, pada polder percontohan.

**Batasan penggunaan**
1. **Hanya baca.** Noah tidak pernah mengirim perintah, *setpoint*, atau kendali apa pun ke SCADA, pompa, atau pintu air. Kami mengusulkan kredensial yang secara teknis hanya dapat membaca, atau ekspor berkala dari server SCADA Dinas SDA. Keputusan operasi tetap sepenuhnya di tangan operator.
2. Uji coba berjalan dalam mode bayangan pada [nama rumah pompa/polder, contoh: Pulomas 2, Setiabudi Timur, Sunter Selatan, Waduk Bojong Indah] hingga [Desember 2026]. Prosedur Dinas SDA tidak berubah.
3. Tidak ada peringatan kepada publik (UU No. 31 Tahun 2009; UU No. 24 Tahun 2007).

**Spesifikasi data**
| Butir | Spesifikasi minimum |
|---|---|
| Variabel | status pompa (nyala/mati) per unit, muka air sump/kolam (cm), bukaan pintu air; bila ada: arus listrik, frekuensi, debit |
| Interval | paling lama 15 menit (lebih baik 5 menit) |
| Metadata | kapasitas tiap pompa (m3/detik), elevasi muka air nyala/mati, kurva tinggi muka air terhadap volume kolam, datum |
| Riwayat | minimal satu musim hujan (lebih baik 2024/2025 dan 2025/2026) |
| Cara akses | (a) ekspor berkala CSV dari server SCADA; atau (b) API/replika basis data hanya-baca; atau (c) topik MQTT hanya-baca. Mekanisme ditetapkan Dinas SDA |
| Frekuensi | data berjalan selama uji coba; riwayat sekali kirim |
| Zona waktu | dinyatakan (WIB atau UTC) |

**Keamanan dan perlindungan data**
- Kerja sama dituangkan dalam PKS yang mengatur tujuan, jangka waktu, keamanan, dan pengakhiran.
- Kredensial disimpan sebagai rahasia (tidak di kode sumber). Akses dibatasi pada alamat IP atau host yang disepakati. Seluruh akses dicatat.
- Data mentah tidak didistribusikan ulang dan hanya dipakai untuk tujuan dalam PKS.
- Data ini tidak memuat data pribadi; jika ada (misalnya nama operator), pemrosesan mengikuti UU No. 27 Tahun 2022.

Sebelum akses diberikan, Noah memakai simulator berbasis kapasitas pompa yang diberi label "SIMULASI" dan dikecualikan dari evaluasi. Kami siap memaparkan rancangan teknis kepada tim SCADA Dinas SDA. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama penandatangan]
[Jabatan], SCCIC Institut Teknologi Bandung

Narahubung: [Nama lengkap Ari], [jabatan], SCCIC ITB; [email]; [nomor telepon]

Tembusan: [Kepala SCCIC ITB]

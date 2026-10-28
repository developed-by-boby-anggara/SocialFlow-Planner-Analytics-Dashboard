# SOCIALFLOW V3 — REGRESSION CHECKLIST

Setiap ada penambahan atau pengubahan kode, daftar pengujian berikut wajib diverifikasi secara manual untuk memastikan zero-regression pada fitur eksisting:

- [ ] **Viewport Auto-Detection:** Buka di layar lebar (>768px) menampilkan sidebar desktop, buka di layar sempit (<=768px) menampilkan bottom nav mobile.
- [ ] **Dual Clock Selector:** Buka modal "+ Rencana Konten", pastikan kolom jam menampilkan dropdown 00-23 dan 00-59 tanpa embel-embel AM/PM.
- [ ] **Preset Waktu:** Tombol cepat jam 12:00, 17:00, 19:00, 21:00 berfungsi mengubah dropdown jam posting.
- [ ] **Jam Digital Berdetik:** Jam di sidebar bawah berdetik setiap detik dengan zona Asia/Jakarta (WIB).
- [ ] **CRUD Konten:** Tambah konten baru, edit konten, duplikasi konten ke Bank Ide, dan hapus konten berjalan normal.
- [ ] **Editorial Matrix 3-Mode:** Switcher Spreadsheet, Grid Bulanan, dan List Agenda dapat beralih lancar.
- [ ] **WhatsApp Share Engine:** Tombol "Share Agenda ke WA" membuka tautan WhatsApp dengan format teks agenda yang rapi dan benar.
- [ ] **Metrik & Grafik:** Donut chart status alur kerja dan bar chart perbandingan platform ter-render akurat sesuai data di tabel.
- [ ] **Target Matriks Medsos:** Perubahan angka di matriks Instagram, TikTok, dan Facebook otomatis mengakumulasi Grand Total Weekly Target.
- [ ] **Ekspor CSV:** Tombol download CSV menghasilkan file `.csv` yang dapat dibuka di spreadsheet tanpa encoding rusak.
- [ ] **Sinkronisasi Firestore:** Penambahan data baru tersimpan di cloud Firestore project `socialflow-planner-analytics`.

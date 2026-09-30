# Konsep Demo: Pendamping Belajar Matematika untuk Anak dengan Kesulitan Belajar

## Ringkasan dan keputusan

Demo ini adalah web pendamping belajar matematika untuk anak dengan kesulitan belajar spesifik, dengan AI agent di Langflow sebagai otak dan animasi interaktif di browser sebagai visual. Anak mengerjakan soal dengan balok, garis bilangan, dan penjelasan yang dibacakan, bukan dengan teks panjang.

Keputusan yang sudah diambil:

- **Konteks:** hackathon, tim 2 orang. Yang dikumpulkan adalah flow Langflow (JSON); web hanya menampilkan visual dan berjalan di laptop.
- **Kategori:** kesulitan belajar spesifik (diskalkulia sebagai fokus, disleksia sebagai pendukung untuk soal cerita).
- **Mata pelajaran demo:** matematika saja, bilangan 1–20.
- **Model AI (testing):** DeepSeek API.
- **Suara:** Web Speech API di browser untuk membacakan (TTS) dan menerima jawaban lisan (STT). Tidak memakai ElevenLabs.
- **Visual:** animasi interaktif yang digambar langsung di browser, bukan video hasil render (tidak memakai Remotion + ffmpeg).
- **Pola agent:** agent mengeluarkan JSON terstruktur, frontend yang menggambar animasinya dari template yang sudah disiapkan.
- **Prioritas:** fungsional dulu; keamanan dan kepatuhan data ditunda ke tahap berikutnya.

## Target pengguna dan masalah

Pengguna utama demo adalah anak SD kelas 1–3 yang kesulitan memahami angka dan operasi hitung dasar, didampingi guru atau orang tua. Kecerdasan mereka normal; hambatannya ada di cara materi disajikan.

| Masalah anak | Cara demo menjawabnya |
| --- | --- |
| Simbol angka terlalu abstrak | Urutan konkret → gambar → abstrak: balok dulu, lalu garis bilangan, baru angka |
| Soal cerita sulit dibaca (disleksia penyerta) | Soal dipecah per kalimat dan dibacakan |
| Sulit menulis jawaban (disgrafia penyerta) | Jawaban bisa lewat suara atau tombol angka besar |
| Cemas dan mudah menyerah | Tanpa timer, umpan balik netral, petunjuk bertahap |
| Tidak ada GPK yang mendampingi | Agent menjelaskan langkah demi langkah seperti pendamping |

Pengguna kedua adalah guru/orang tua yang melihat ringkasan sesi anak di akhir latihan.

**Kenapa bilangan 1–20:** 20 balok dan garis bilangan 0–20 masih muat dan terbaca di layar HP; di rentang ini ada titik sulit utama anak diskalkulia, yaitu menjumlah melewati 10 (8 + 5 = 8 + 2 + 3); sesuai kurikulum kelas 1–2 SD; dan jawabannya pendek sehingga mudah dikenali lewat suara.

## Fitur inti demo

Demo cukup membuktikan satu alur belajar utuh dengan kualitas tinggi, bukan banyak fitur setengah jadi.

1. **Materi:** penjumlahan dan pengurangan bilangan 1–20 (termasuk soal cerita pendek), dengan fokus pada menjumlah/mengurang melewati 10.
2. **Tiga mode visual:**
   - Balok (representasi konkret, bisa digeser/diketuk anak).
   - Garis bilangan (lompatan maju/mundur beranimasi).
   - Angka dan simbol (tahap abstrak).
3. **Penjelasan langkah demi langkah:** tiap langkah animasi disertai kalimat pendek yang dibacakan otomatis dan bisa diulang dengan satu ketukan.
4. **Jawaban multimodal:** tombol angka besar atau jawaban lisan, dengan transkrip ditampilkan untuk dikonfirmasi anak.
5. **Petunjuk bertingkat:** salah pertama → petunjuk ringan; salah kedua → agent memecah soal jadi langkah lebih kecil; salah ketiga → agent menunjukkan cara dengan balok.
6. **Soal cerita:** agent menyederhanakan kalimat dan menandai angka penting sebelum dibacakan.
7. **Login sederhana:** nama pengguna tanpa verifikasi, profil (level dan mode yang disukai) disimpan di browser.
8. **Ringkasan sesi:** satu layar di akhir sesi berisi jumlah soal, jumlah benar, dan soal yang paling sering salah.

## Di luar cakupan demo

Hal berikut sengaja tidak dikerjakan agar demo selesai dan stabil:

- Mata pelajaran selain matematika (membaca/menulis menyusul).
- Perkalian, pembagian, pecahan, dan bilangan di atas 20.
- Kategori disabilitas lain (tunagrahita, ADHD, tunarungu).
- Fitur diagnosis atau skrining disleksia/diskalkulia.
- Dasbor guru/orang tua dengan peran terpisah (diganti ringkasan sesi).
- Suara premium (ElevenLabs) dan video hasil render.
- Integrasi Google Classroom/Calendar lewat Composio (disiapkan untuk tahap berikutnya).
- Keamanan login, enkripsi, dan kepatuhan UU PDP (ditunda; demo memakai data dummy).
- Deploy ke server, mode offline, dan aplikasi mobile native.

**Tetap dijaga meski keamanan ditunda:**

- API key DeepSeek tidak ikut tersimpan saat flow diekspor ke JSON untuk dikumpulkan.
- API key tidak ditaruh di kode frontend atau di repo; simpan di `.env` atau global variable Langflow.

## Arsitektur dan alur data

Agent tidak pernah menggambar animasi dan tidak pernah menjadi penentu jawaban benar; ia hanya mengisi data ke template visual yang sudah disiapkan.

&#91;embedded content: arsitektur demo · 4 lapisan utama\]

Panah atas adalah permintaan (anak → agent), panah bawah adalah respons (agent → anak). Garis putus-putus berarti belum masuk demo.

Alur satu soal:

1. Anak login dengan nama; frontend membaca profilnya dari localStorage.
2. Frontend memanggil API flow Langflow di laptop dengan level anak.
3. Komponen Python membuat angka soal dan menghitung jawaban benar.
4. Agent (DeepSeek) menyusun kalimat, langkah visual, dan petunjuk dalam JSON.
5. Komponen Python memvalidasi JSON (skema dan kecocokan angka); jika gagal, memakai soal cadangan.
6. Frontend menganimasikan langkah, membacakannya, menilai jawaban dengan kunci dari flow, lalu menyimpan riwayat.

Ilustrasi output agent (skema final ditentukan di PRD):

```json
{
  "type": "math_steps",
  "visual": "blocks",
  "steps": [
    { "show": 13, "say": "Ada 13 balok" },
    { "remove": 5, "say": "Kita ambil 5" },
    { "show": 8, "say": "Sisa 8 balok" }
  ],
  "hints": ["Coba hitung balok yang tersisa satu per satu"]
}
```

## Tool dan stack

Stack dipilih agar sebanyak mungkin gratis dan berjalan di HP Android kelas menengah.

| Lapisan | Tool | Peran | Status |
| --- | --- | --- | --- |
| Frontend | React + Vite | Antarmuka anak, login, ringkasan sesi | Pasti |
| Animasi UI | Motion (dulu Framer Motion) | Balok bergerak, lompatan garis bilangan, highlight | Pasti |
| Visual matematika | SVG buatan sendiri (Mafs opsional) | Balok, garis bilangan, ten-frame | Pasti |
| Maskot | Rive atau Lottie | Karakter yang bereaksi saat benar/salah | Opsional, jika waktu cukup |
| Suara | Web Speech API | Membacakan langkah (TTS) dan jawaban lisan (STT) | Pasti |
| Logika soal | Komponen Python kustom di Langflow | Membuat angka soal, menghitung jawaban benar, validasi JSON | Pasti |
| Agent | Langflow (Agent component) | Menyusun langkah, petunjuk, dan bahasa dalam JSON | Pasti |
| Model AI | DeepSeek API | Otak agent | Untuk testing |
| Penyimpanan | localStorage browser | Akun sederhana dan riwayat jawaban | Pasti untuk demo |
| Menjalankan | Langflow lokal di laptop | Server flow saat demo | Pasti |
| Integrasi | Composio | Google Classroom/Calendar | Tahap berikutnya, tidak di demo |

Semua logika (angka soal, jawaban benar, susunan langkah) ada di flow Langflow yang dikumpulkan; web React hanya meminta soal ke API Langflow lokal, lalu menampilkan dan membacakannya.

## Batasan teknis dan risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| LLM salah hitung | Anak belajar jawaban yang keliru | Jawaban benar dihitung di komponen Python Langflow, bukan oleh LLM; LLM hanya menulis penjelasan |
| JSON dari agent tidak sesuai skema | Animasi gagal tampil | Validasi skema di komponen Python; jika gagal, minta ulang sekali lalu pakai soal cadangan |
| Latensi agent beberapa detik | Anak menunggu dan kehilangan fokus | Siapkan soal berikutnya di latar belakang; animasi "berpikir" dari maskot |
| Pengenalan suara hanya andal di Chrome dan butuh internet | Jawaban lisan tidak jalan di browser lain | Tombol angka selalu tersedia; fitur suara disembunyikan jika tidak didukung |
| Akurasi pengenalan suara anak lebih rendah | Jawaban benar dianggap salah | Tampilkan transkrip + tombol "ulangi" sebelum dinilai |
| Suara TTS berbeda antarperangkat | Kualitas bacaan tidak seragam | Uji di 2–3 HP target; pilih suara bahasa Indonesia yang tersedia |
| Highlight kata saat dibacakan tidak konsisten | Sinkronisasi teks-suara kacau | Cukup highlight per kalimat/langkah di demo |
| HP kelas menengah ke bawah | Animasi patah-patah | Animasi SVG sederhana, tanpa efek berat; uji di perangkat nyata |

Prinsip utama: **angka dan kebenaran jawaban ditentukan kode, bukan AI.** AI hanya mengatur bahasa, urutan langkah, dan pilihan visual.

## Prinsip desain dan etika

**Tampilan**

- Satu soal per layar, tombol besar, sedikit teks.
- Huruf sans-serif besar dengan jarak antarhuruf dan antarbaris lega, rata kiri, latar krem/off-white.
- Warna dipakai secara konsisten (misalnya satu warna untuk "diambil", satu untuk "ditambah").

**Psikologis**

- Tanpa timer atau hitung mundur.
- Umpan balik salah bersifat netral dan menyemangati, tanpa tanda silang merah besar.
- Anak boleh mengulang penjelasan tanpa batas.

**Etika dan data**

- Aplikasi adalah alat bantu belajar, bukan alat diagnosis; tidak ada label "disleksia" atau "diskalkulia" yang dikeluarkan sistem.
- Data anak mengikuti UU PDP: persetujuan orang tua/wali, data seminimal mungkin, rekaman suara tidak disimpan (ditunda untuk hackathon; demo memakai data dummy).
- Guru/orang tua bisa melihat apa yang dijelaskan agent kepada anak.

## Keputusan yang sudah ditetapkan

Semua keputusan untuk tahap ide sudah ditetapkan; detail teknis seperti skema JSON dan pembagian kerja dibahas di PRD.

- [x] **Konteks demo:** hackathon; yang dikumpulkan flow Langflow (JSON), video demo boleh menyusul.
- [x] **Tim:** 2 orang.
- [x] **Rentang materi:** bilangan 1–20 (alasan di bagian target pengguna).
- [x] **Model AI:** DeepSeek API untuk testing.
- [x] **Menjalankan:** Langflow lokal di laptop.
- [x] **Frontend:** React + Vite.
- [x] **Akun:** login sederhana, disimpan di browser.
- [x] **Validasi pengguna:** tidak ada uji coba dengan guru/anak di tahap ini.

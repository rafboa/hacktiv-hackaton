# 🎨 Konsep Demo: Pendamping Belajar Matematika
## Design & Motion System — Inspired by The Future in Black™

> **Hackathon Project** · Tim 2 orang · Diskalkulia & Disleksia Focus
> Dokumen ini menerapkan design language premium + jiggle motion ke konteks edukasi anak SD kelas 1–3.

---

## 1. Design Philosophy

```
┌──────────────────────────────────────────────────────────┐
│  "Serius di fungsi, menyenangkan di rasa."               │
│                                                          │
│  Kami mengambil estetika editorial premium dari TFIB     │
│  lalu mendekonstruksinya untuk konteks anak:             │
│  • Dark luxury  →  Warm cream playground                 │
│  • Corporate spring physics  →  Playful jiggle & bounce  │
│  • Accent neon  →  Accent lembut tapi bold               │
│  • Minimal text  →  Minimal text (sama!)                 │
│  • Corner bar  →  Corner bar + maskot                    │
└──────────────────────────────────────────────────────────┘
```

### Prinsip Utama

| # | Prinsip | Penerapan |
|---|---------|-----------|
| 1 | **Satu hal per layar** | Tidak ada scroll; tiap state = 1 viewport penuh |
| 2 | **Jiggle = hidup** | Semua elemen interaktif punya spring physics — anak merasa UI "bernafas" |
| 3 | **Suara duluan, teks kemudian** | Instruksi dibacakan otomatis; teks hanya pendukung visual |
| 4 | **Warna = makna** | Biru selalu "tambah", oranye selalu "kurang", hijau selalu "benar" |
| 5 | **Tanpa tekanan** | Tidak ada timer, skor merah, atau tanda silang |

---

## 2. Design Tokens

### 2.1 Color Palette

```
BACKGROUNDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --bg-cream       #FDF8F0    Latar utama (warm, tidak menyilaukan)
  --bg-card        #FFFFFF    Kartu/panel konten
  --bg-surface     #F5EFE6    Area sekunder (sidebar, footer)
  --bg-overlay     rgba(0,0,0,0.4)   Overlay modal

PRIMARY (Balok & Interaksi)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --blue-500       #4A90D9    Balok tambah, tombol utama
  --blue-400       #6BA3E0    Hover state
  --blue-100       #E8F1FB    Background ringan

SECONDARY (Kurang & Aksi kedua)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --orange-500     #F0883E    Balok kurang, animasi "diambil"
  --orange-400     #F4A261    Hover state
  --orange-100     #FFF0E0    Background ringan

FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --green-500      #34C759    Benar! (warna utama)
  --green-100      #E6F9ED    Background benar
  --yellow-500     #FFD60A    Hint / petunjuk
  --yellow-100     #FFF9DB    Background hint

TEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --text-primary   #2C2C2C    Teks utama
  --text-secondary #888888    Teks pendukung
  --text-accent    #4A90D9    Angka yang di-highlight

ACCENT (dari TFIB — dipakai untuk dekorasi)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --accent-lime    #C8FF00    Elemen dekoratif, progress bar
  --accent-pink    #FF006E    Blob background dekoratif
```

### 2.2 Typography

```
FONT FAMILY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Primary:    'Inter Tight', sans-serif
  Fallback:   system-ui, -apple-system, sans-serif

SCALE (rem-based, mobile-first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --text-hero      clamp(2.5rem, 8vw, 5rem)    Splash title
  --text-number    clamp(2rem, 6vw, 4rem)      Angka soal besar
  --text-heading   clamp(1.5rem, 4vw, 2.5rem)  Section heading
  --text-body      clamp(1rem, 2.5vw, 1.25rem) Instruksi dibacakan
  --text-caption   0.85rem                      Label, caption
  --text-tiny      0.75rem                      Metadata

PROPERTIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  letter-spacing:  0.02em (body), -0.03em (heading), 0.12em (label uppercase)
  line-height:     1.6 (body), 1.1 (heading)
  text-align:      left (rata kiri — penting untuk disleksia)
  word-spacing:    0.05em (lebih lega untuk keterbacaan)
```

### 2.3 Spacing & Layout

```
SPACING SCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --space-xs    4px     Micro gap
  --space-sm    8px     Antar elemen kecil
  --space-md    16px    Padding kartu
  --space-lg    24px    Antar section
  --space-xl    40px    Hero padding
  --space-2xl   64px    Section gap

LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Max width:         100vw (fullscreen, tidak scroll)
  Page padding:      4vw horizontal
  Card border-radius: 20px (konsisten — dari TFIB)
  Button border-radius: 999px (pill shape — dari TFIB)
  Card border:       1px solid rgba(0,0,0,0.08)
  Card shadow:       0 4px 24px rgba(0,0,0,0.06)
```

### 2.4 Motion Tokens (🎯 Jiggle System)

```
SPRING PRESETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --spring-bouncy     { type: "spring", stiffness: 300, damping: 15 }
    → Balok muncul, tombol ditekan

  --spring-wobbly     { type: "spring", stiffness: 180, damping: 12 }
    → Maskot bereaksi, hint muncul

  --spring-gentle     { type: "spring", stiffness: 120, damping: 20 }
    → Fade-in section, card muncul

  --spring-snappy     { type: "spring", stiffness: 500, damping: 25 }
    → Tombol angka, quick feedback

EASING CURVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  --ease-overshoot    cubic-bezier(0.34, 1.56, 0.64, 1)
    → Hero text reveal, card hover (dari TFIB)

  --ease-smooth       cubic-bezier(0.4, 0, 0.2, 1)
    → Transisi halaman, scroll-like

JIGGLE PHYSICS (diterapkan via JS/Framer Motion)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Per-element spring:
    - stiffness:   0.06 (card), 0.1 (button), 0.08 (block)
    - damping:     0.72 (card), 0.8 (button), 0.75 (block)
    - max rotation: ±12° (card), ±5° (button), ±8° (block)
    - max translate: ±8px
    - squish scale:  scaleX 1.04, scaleY 0.96 on velocity

TIMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Stagger delay:     0.08s per item (reveal children)
  Step animation:    0.6s per langkah soal
  Feedback delay:    0.3s sebelum reaksi benar/salah
  TTS delay:         0.2s setelah animasi selesai
```

---

## 3. Component Library

### 3.1 Corner Bar (adaptasi dari TFIB)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                          [🤖 Budi]  / Soal 3 dari 10  (menu) │
│                                                                │
│  Posisi:   fixed top-right, z-index 9999                      │
│  Elemen:                                                       │
│    - Nama anak + avatar emoji (kiri)                           │
│    - Separator "/" berwarna accent                              │
│    - Progress "Soal X dari Y"                                  │
│    - Menu pill (tombol hamburger → dropdown)                   │
│                                                                │
│  Motion:                                                       │
│    - Pill hover: scale(1.08) rotate(-2deg) — spring bouncy    │
│    - Pill click: squish scale(0.9) → bounce scale(1.08)       │
│    - Menu dropdown: translateY(-8px) → 0, opacity 0 → 1      │
│    - Hamburger → X: rotateZ(45deg) transform per span          │
│                                                                │
│  Style:                                                        │
│    - Pill: bg-[--text-primary] text-white rounded-full         │
│    - Clock/progress: text-[--text-secondary] text-sm           │
│    - Menu list: bg-white rounded-2xl shadow-xl                 │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Block Cube (Balok Matematika)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                 │
│    │  │ │  │ │  │ │  │ │  │ │  │ │  │ │  │   ← 8 balok biru  │
│    └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                 │
│                                                                │
│  Ukuran:    48×48px (desktop), 36×36px (mobile)               │
│  Shape:     rounded-lg (8px radius), slight 3D shadow          │
│  Warna:                                                        │
│    - Aktif/tambah:  --blue-500 dengan shadow inner glow        │
│    - Diambil/kurang: --orange-500, lalu fade out               │
│    - Netral:        --bg-surface dengan border tipis            │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Muncul:  scale(0) → scale(1.15) → scale(1)               │
│               spring bouncy, stagger 0.06s per balok           │
│    - Hover:   translateY(-4px) rotate(random ±3°)              │
│               spring wobbly                                    │
│    - Tap:     scale(0.85) → scale(1.1) → scale(1)             │
│               + slight rotateZ wobble                          │
│    - Diambil: scale(1) → scale(1.2) + opacity(1→0)            │
│               + translateY(-20px) + rotateZ(random ±15°)       │
│               spring bouncy, lalu balok hilang                 │
│    - Idle:    subtle translateY oscillation (±2px, 3s loop)    │
│               membuat balok terlihat "bernafas"                │
│                                                                │
│  Interaction:                                                  │
│    - Draggable (opsional): anak bisa geser balok               │
│    - Tap: membacakan "satu balok" via TTS                      │
│    - Mouse glow: radial gradient mengikuti cursor               │
│                                                                │
│  Layout:                                                       │
│    - Grid: max 10 per baris (ten-frame logic)                  │
│    - Baris kedua dimulai di bawah                              │
│    - Gap: 6px antar balok                                      │
│                                                                │
│  SVG Structure:                                                │
│    <rect rx="8" fill="var(--blue-500)" />                      │
│    <rect rx="6" fill="rgba(255,255,255,0.15)" /> (inner glow) │
│    <text>angka</text> (opsional, di tengah balok)              │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Number Line (Garis Bilangan)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  0   1   2   3   4   5   6   7   8   9  10  11  12  13       │
│  ├───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤       │
│                  └─── +5 ───┘                                  │
│                       ↗                                        │
│                    (lompatan beranimasi)                        │
│                                                                │
│  Visual:                                                       │
│    - Garis horizontal: 2px solid --text-secondary              │
│    - Tick marks: 16px tinggi, setiap angka                     │
│    - Angka: --text-body, rata tengah di bawah tick             │
│    - Angka aktif: --blue-500, font-bold, scale(1.2)           │
│                                                                │
│  🎯 JIGGLE MOTION — Lompatan:                                 │
│    - Arc path: dari tick A ke tick B via kurva parabola         │
│    - Duration: 0.5s per lompatan                               │
│    - Easing: spring bouncy (overshoot di puncak)               │
│    - Indicator: lingkaran 24px --blue-500                      │
│    - Trail: garis putus-putus muncul di belakang               │
│    - Landing: squish scaleY(0.8) → scale(1) + ripple          │
│    - Multi-jump: stagger 0.3s antar lompatan                  │
│                                                                │
│  Responsive:                                                   │
│    - Desktop: 0–20 penuh terlihat                              │
│    - Mobile: horizontal scroll, angka relevan di center        │
└────────────────────────────────────────────────────────────────┘
```

### 3.4 Wobble Button (Tombol Utama)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│           ╭──────────────────────────────╮                     │
│           │    Mulai Belajar  →          │                     │
│           ╰──────────────────────────────╯                     │
│                                                                │
│  Style:                                                        │
│    - bg: --blue-500 (primer) / --green-500 (konfirmasi)       │
│    - text: white, font-semibold, tracking-wide                 │
│    - padding: 16px 36px                                        │
│    - border-radius: 999px (pill)                               │
│    - shadow: 0 4px 16px rgba(74, 144, 217, 0.3)              │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Hover:   scale(1.06) — spring snappy                     │
│    - Arrow:   translateX(+6px) on hover — spring bouncy       │
│    - Tap:     scale(0.88) → scale(1.12) → scale(1)           │
│               rotateZ(-3° → 2° → 0°) — multi-step wobble     │
│    - Focus:   ring-4 ring-blue-200 animate-pulse              │
│    - Disabled: opacity 0.5, no motion                          │
│                                                                │
│  Varian:                                                       │
│    - Primary (biru): aksi utama                                │
│    - Success (hijau): "Lanjut" setelah benar                   │
│    - Ghost (outline): "Ulangi", "Lewati"                       │
│    - Number (grid): tombol angka 0–20 untuk jawaban           │
└────────────────────────────────────────────────────────────────┘
```

### 3.5 Number Pad (Tombol Angka Jawaban)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│    │  1 │ │  2 │ │  3 │ │  4 │ │  5 │                       │
│    └────┘ └────┘ └────┘ └────┘ └────┘                       │
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│    │  6 │ │  7 │ │  8 │ │  9 │ │ 10 │                       │
│    └────┘ └────┘ └────┘ └────┘ └────┘                       │
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│    │ 11 │ │ 12 │ │ 13 │ │ 14 │ │ 15 │                       │
│    └────┘ └────┘ └────┘ └────┘ └────┘                       │
│    ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│    │ 16 │ │ 17 │ │ 18 │ │ 19 │ │ 20 │                       │
│    └────┘ └────┘ └────┘ └────┘ └────┘                       │
│                                                                │
│  Ukuran per tombol:  56×56px (desktop), 44×44px (mobile)      │
│  Font:               --text-number, font-bold                  │
│  Style:              bg-white, border 2px solid --bg-surface   │
│  Border-radius:      16px                                      │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Muncul:     stagger reveal dari bawah, 0.03s per tombol  │
│                  spring gentle + slight random rotateZ (±2°)  │
│    - Hover:      scale(1.1) + bg → --blue-100                 │
│    - Tap:        scale(0.85) → scale(1.15) → scale(1)        │
│                  + border-color → --blue-500                   │
│    - Selected:   bg → --blue-500, text → white, scale(1.05)  │
│                  persist subtle pulse animation                │
│    - Deselect:   spring back to neutral                        │
│                                                                │
│  Alternatif jawaban: tombol mikrofon 🎤 di samping grid       │
│    - Tap → STT mulai merekam                                  │
│    - Animasi pulse ring saat merekam                           │
│    - Transkrip muncul di atas dengan konfirmasi                │
└────────────────────────────────────────────────────────────────┘
```

### 3.6 Mascot Reaction (Opsional — Rive/Lottie)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│         ╭─────╮                                                │
│         │ 🤖  │  ← Maskot di pojok kiri bawah                │
│         │     │     atau kanan bawah (tidak menghalangi soal)  │
│         ╰─────╯                                                │
│                                                                │
│  Ukuran:    80×80px area                                       │
│  Posisi:    fixed bottom-left, 24px dari edge                  │
│                                                                │
│  🎯 JIGGLE STATES:                                            │
│    - Idle:       gentle floating (translateY ±4px, 2.5s loop) │
│                  + slow rotateZ oscillation (±3°)              │
│    - Thinking:   faster bounce + "..." speech bubble           │
│    - Happy:      big scale(1.3) + rotateZ wiggle (±10°)       │
│                  + confetti particles                          │
│    - Encourage:  nod (rotateX oscillation) + 💪 bubble         │
│    - Speaking:   mouth animation sync + subtle scale pulse     │
│                                                                │
│  Fallback (tanpa Rive): emoji besar + CSS animation           │
└────────────────────────────────────────────────────────────────┘
```

### 3.7 Jiggle Card (Panel Konten)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ╭──────────────────────────────────────────────╮              │
│  │  [Label]     Practice 01                     │              │
│  │  [Heading]   Penjumlahan                     │              │
│  │  [Body]      Belajar menjumlah dengan balok  │              │
│  │                                              │              │
│  │  ░░░░░ (radial glow follows mouse)           │              │
│  ╰──────────────────────────────────────────────╯              │
│                                                                │
│  Style:                                                        │
│    - bg: --bg-card, border: 1px solid rgba(0,0,0,0.06)        │
│    - border-radius: 20px                                       │
│    - padding: 2rem                                             │
│    - shadow: 0 4px 24px rgba(0,0,0,0.06)                     │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - 3D tilt mengikuti posisi mouse (perspective 800px)       │
│      rotateX: ±12° berdasarkan Y cursor                       │
│      rotateY: ±12° berdasarkan X cursor                       │
│      rotateZ: ±3° (cross product X×Y)                         │
│    - Spring physics: stiffness 0.06, damping 0.72             │
│    - Squish: scaleX 1.04, scaleY 0.96 on fast movement       │
│    - Translate: ±8px mengikuti cursor                          │
│    - Mouse glow: radial gradient --blue-500 opacity 6%        │
│    - Hover shadow: 0 0 60px rgba(74,144,217,0.1)             │
│    - Leave: spring back ke netral dengan overshoot             │
└────────────────────────────────────────────────────────────────┘
```

### 3.8 Speech Bubble (Kalimat Dibacakan)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│    ╭─────────────────────────────────────────╮                 │
│    │  "Ada 8 balok. Kita tambah 5 lagi."    │                 │
│    │   ^^^^^^^^^^                            │                 │
│    │   (highlighted saat dibacakan)          │                 │
│    ╰──────────────────────┬──────────────────╯                 │
│                           ╰── (tail ke maskot)                 │
│                                                                │
│  Style:                                                        │
│    - bg: white, shadow-lg, rounded-2xl                         │
│    - Text: --text-body, --text-primary                         │
│    - Highlight kata aktif: bg --yellow-100, text --blue-500   │
│    - Tail: CSS triangle pointing ke maskot                     │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Muncul: scale(0.8) opacity(0) → scale(1) opacity(1)     │
│              spring wobbly, origin dari maskot                 │
│    - Per-kata highlight: translateY(-2px) saat dibacakan       │
│    - Selesai: gentle pulse lalu idle                           │
│    - Tombol 🔄 (ulangi): rotateZ(360°) spring bouncy          │
└────────────────────────────────────────────────────────────────┘
```

### 3.9 Hint Card (Petunjuk Bertingkat)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Level 1 (ringan):                                             │
│  ╭─ 💡 ─────────────────────────────────────╮                 │
│  │  Coba hitung balok yang tersisa          │                 │
│  │  satu per satu.                          │                 │
│  ╰──────────────────────────────────────────╯                 │
│                                                                │
│  Level 2 (pecah langkah):                                      │
│  ╭─ 🧩 ─────────────────────────────────────╮                 │
│  │  Langkah 1: Hitung sampai 10 dulu       │                 │
│  │  Langkah 2: Sisanya berapa?              │                 │
│  ╰──────────────────────────────────────────╯                 │
│                                                                │
│  Level 3 (tunjukkan dengan balok):                             │
│  ╭─ 🎯 ─────────────────────────────────────╮                 │
│  │  [Animasi balok otomatis berjalan]       │                 │
│  │  Lihat, 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13│                 │
│  ╰──────────────────────────────────────────╯                 │
│                                                                │
│  Style:                                                        │
│    - bg: --yellow-100, border-left 4px solid --yellow-500     │
│    - border-radius: 16px                                       │
│    - Emoji icon di kiri atas                                   │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Slide in dari bawah: translateY(30px) → 0                │
│    - Spring wobbly dengan slight rotateZ(-1° → 0°)           │
│    - Level 3 auto-play: balok beranimasi otomatis              │
│    - Icon emoji: wobble rotateZ(±15°) saat muncul             │
└────────────────────────────────────────────────────────────────┘
```

### 3.10 Progress Indicator

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ●  ●  ●  ○  ○  ○  ○  ○  ○  ○                              │
│  1  2  3  4  5  6  7  8  9  10                                │
│                                                                │
│  + Scroll progress bar (dari TFIB):                            │
│    Fixed top, height 3px, bg --accent-lime                    │
│    scaleX berdasarkan soal ke-N dari total                    │
│                                                                │
│  🎯 JIGGLE MOTION:                                            │
│    - Dot selesai: scale(0) → scale(1.3) → scale(1)           │
│                   warna --text-secondary → --green-500        │
│    - Progress bar: smooth scaleX transition                    │
│    - Milestone (soal ke-5): semua dot visible bounce           │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen-by-Screen Flow

### 4.1 Splash Screen

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                                                              ║
║                                                              ║
║              ╭─────╮                                         ║
║              │ 🤖  │  (maskot bounce in)                    ║
║              ╰─────╯                                         ║
║                                                              ║
║            B E L A J A R                                     ║
║         M A T E M A T I K A                                  ║
║                                                              ║
║        (per-huruf stagger reveal, bounce overshoot)          ║
║                                                              ║
║                                                              ║
║         ╭────────────────────────╮                            ║
║         │   Mulai Belajar   →   │  (wobble button)           ║
║         ╰────────────────────────╯                            ║
║                                                              ║
║                                                              ║
║  ░░░░░░░░░░░░ (liquid blob background) ░░░░░░░░░░░░░░░     ║
║  ░░░ biru & oranye gradient blobs, mengikuti mouse ░░░░     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI MASUK:
  1. Blob background mulai bergerak (0s)
  2. Maskot bounce in dari bawah (0.3s) — spring bouncy
  3. Title per-huruf reveal (0.5s) — stagger 0.04s, overshoot
  4. Subtitle fade in (1.0s)
  5. Button slide up (1.2s) — spring gentle
  6. Noise overlay aktif (0s) — film grain texture

BACKGROUND:
  - Canvas blobs: 3 radial gradients (biru, oranye, pink)
  - Magnetic pull ke posisi mouse
  - Spring physics (stiffness 0.01, damping 0.92)
  - Filter blur 80px, opacity 0.15
```

### 4.2 Login Screen

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                     Siapa namamu?                             ║
║                                                              ║
║          ╭──────────────────────────────╮                     ║
║          │  Ketik nama...               │  (jiggle on focus) ║
║          ╰──────────────────────────────╯                     ║
║                                                              ║
║          Atau pilih:                                          ║
║                                                              ║
║    ╭────────╮  ╭────────╮  ╭────────╮                        ║
║    │  🦊    │  │  🐼    │  │  🦁    │  (avatar pills)       ║
║    │ Andi   │  │ Budi   │  │ Sari   │  (profil tersimpan)   ║
║    ╰────────╯  ╰────────╯  ╰────────╯                        ║
║                                                              ║
║         ╭────────────────────────╮                            ║
║         │     Ayo Mulai!    →   │                            ║
║         ╰────────────────────────╯                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI:
  - Heading: fadeUp spring gentle (0.2s)
  - Input field: slide in + jiggle on focus (border → --blue-500)
  - Avatar pills: stagger muncul (0.08s), jiggle tilt on hover
  - Button: wobble tap animation
  - Profil tersimpan di localStorage, muncul sebagai pill cards
```

### 4.3 Home / Pilih Mode

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  [🤖 Budi]  / Level 1                              (menu)  ║
║                                                              ║
║       Hai Budi! Mau belajar apa hari ini?                   ║
║       (dibacakan otomatis via TTS)                           ║
║                                                              ║
║    ╭─────────────────╮    ╭─────────────────╮                ║
║    │  Practice 01    │    │  Practice 02    │                ║
║    │                 │    │                 │                ║
║    │  ➕ Penjumlahan │    │  ➖ Pengurangan │                ║
║    │                 │    │                 │                ║
║    │  12 soal selesai│    │  belum mulai    │                ║
║    ╰─────────────────╯    ╰─────────────────╯                ║
║                                                              ║
║    ╭─────────────────╮    ╭─────────────────╮                ║
║    │  Practice 03    │    │  Practice 04    │                ║
║    │                 │    │                 │                ║
║    │  📖 Soal Cerita │    │  🎯 Campuran   │                ║
║    │                 │    │                 │                ║
║    │  3 soal selesai │    │  🔒 Terkunci   │                ║
║    ╰─────────────────╯    ╰─────────────────╯                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI:
  - Cards: Jiggle Card component (3D tilt, mouse glow, spring)
  - Stagger reveal dari bawah (0.1s per card)
  - Locked card: opacity 0.5, grayscale, no jiggle
  - Label "Practice 0X": uppercase, letter-spacing 0.15em, --blue-500
  - Corner bar slide in dari atas
  - Greeting dibacakan saat masuk page
```

### 4.4 Layar Soal (INTI)

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  [🤖 Budi]  / Soal 3 dari 10                       (menu)  ║
║  ████████░░░░░░░░░░░░░░░  (progress bar --accent-lime)     ║
║                                                              ║
║  ╭───────────────────────────────────────────────────────╮   ║
║  │                                                       │   ║
║  │   "Ada 8 balok. Tambah 5 lagi.                       │   ║
║  │    Berapa semuanya?"                                  │   ║
║  │                                     [🔄 Ulangi]      │   ║
║  ╰───────────────────────────────────────────────────────╯   ║
║                                                              ║
║  ┌─ VISUAL AREA ──────────────────────────────────────────┐  ║
║  │                                                        │  ║
║  │  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐  ← 8 balok biru   │  ║
║  │  └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                     │  ║
║  │                                                        │  ║
║  │  ┌──┐┌──┐┌──┐┌──┐┌──┐              ← 5 balok muncul  │  ║
║  │  └──┘└──┘└──┘└──┘└──┘                (stagger jiggle) │  ║
║  │                                                        │  ║
║  │  ── atau ──                                            │  ║
║  │                                                        │  ║
║  │  0─┼─┼─┼─┼─┼─┼─┼─●─┼─┼─┼─┼─●─┼─┼─┼─┼─┼─┼─┼─20     │  ║
║  │                    8  ╰── +5 ──╯ 13                    │  ║
║  │                       (arc jump animation)             │  ║
║  └────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  ╭─ JAWAB ─────────────────────────────────────────╮         ║
║  │                                                  │         ║
║  │  ┌──┐┌──┐┌──┐┌──┐┌──┐  ┌──┐┌──┐┌──┐┌──┐┌──┐  │         ║
║  │  │ 1││ 2││ 3││ 4││ 5│  │ 6││ 7││ 8││ 9││10│  │         ║
║  │  └──┘└──┘└──┘└──┘└──┘  └──┘└──┘└──┘└──┘└──┘  │         ║
║  │  ┌──┐┌──┐┌──┐┌──┐┌──┐  ┌──┐┌──┐┌──┐┌──┐┌──┐  │         ║
║  │  │11││12││13││14││15│  │16││17││18││19││20│  │         ║
║  │  └──┘└──┘└──┘└──┘└──┘  └──┘└──┘└──┘└──┘└──┘  │         ║
║  │                                           🎤   │         ║
║  ╰────────────────────────────────────────────────╯         ║
║                                                              ║
║  ╭─────╮                                                     ║
║  │ 🤖  │  ← maskot (idle floating, reactions on events)    ║
║  ╰─────╯                                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI TIMELINE (orchestrated by agent JSON):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  0.0s  → Speech bubble muncul (spring wobbly)
  0.2s  → TTS mulai membacakan step[0].say
  0.3s  → Balok baris 1 muncul stagger (spring bouncy, 0.06s/balok)
  1.5s  → TTS membacakan step[1].say
  1.7s  → Balok baris 2 muncul stagger (spring bouncy, warna oranye)
  2.8s  → TTS membacakan "Berapa semuanya?"
  3.0s  → Number pad slide up (spring gentle)
  3.0s  → Maskot → thinking state

SETELAH JAWAB:
  Benar:
    - Tombol jawaban: scale bounce + bg → --green-500
    - Semua balok: celebratory jiggle (random rotateZ ±10°)
    - Maskot: happy state + confetti particles
    - Speech bubble: "Betul! 8 + 5 = 13! 🎉"
    - Green flash overlay (0.1s, opacity 0.1)
    - Auto-advance setelah 2s

  Salah (attempt 1):
    - Tombol jawaban: gentle shake (translateX ±4px, 3 cycles)
    - Maskot: encourage state + 💪
    - Hint Level 1 slide in dari bawah
    - Number pad reset

  Salah (attempt 2):
    - Hint Level 2 replace Level 1
    - Langkah dipecah, animasi step-by-step

  Salah (attempt 3):
    - Hint Level 3: auto-play balok demo
    - Jawaban ditunjukkan, anak mengonfirmasi
```

### 4.5 Feedback Overlay

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                                                              ║
║                     🎉                                       ║
║                                                              ║
║                 Hebat, Budi!                                 ║
║              8 + 5 = 13  ✓                                  ║
║                                                              ║
║     ╭────────────────────────╮                               ║
║     │   Soal Berikutnya  →  │                               ║
║     ╰────────────────────────╯                               ║
║                                                              ║
║  ● ● ● ○ ○ ○ ○ ○ ○ ○   (progress dots)                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI:
  - Emoji: scale(0) → scale(1.5) → scale(1) spring bouncy
  - Teks: stagger fadeUp, per-kata
  - Equation: typewriter effect + green highlight
  - Button: delayed muncul (1s), wobble ready
  - Confetti: CSS particles (20 dots, random trajectory)
  - Background: soft green glow pulse
```

### 4.6 Ringkasan Sesi

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  [🤖 Budi]  / Selesai!                              (menu) ║
║                                                              ║
║           Ringkasan Hari Ini                                 ║
║                                                              ║
║    ╭──────────────────────────────────────────────╮           ║
║    │                                              │           ║
║    │   Soal dikerjakan     10                     │           ║
║    │   Jawaban benar       8  (██████████░░) 80%  │           ║
║    │   Pakai petunjuk      3 kali                 │           ║
║    │                                              │           ║
║    │   Soal paling sulit:                         │           ║
║    │   • 7 + 8 = ?   (2x salah)                  │           ║
║    │   • 15 - 7 = ?  (1x salah)                  │           ║
║    │                                              │           ║
║    ╰──────────────────────────────────────────────╯           ║
║                                                              ║
║    ╭────────────────╮  ╭────────────────╮                    ║
║    │  Latihan Lagi  │  │  Selesai  ✓   │                    ║
║    ╰────────────────╯  ╰────────────────╯                    ║
║                                                              ║
║    ╭─────╮                                                   ║
║    │ 🤖  │  "Hebat Budi! Besok kita latihan lagi ya!"       ║
║    ╰─────╯                                                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

ANIMASI:
  - Card: jiggle card dengan reveal stagger per stat
  - Progress bar: animated fill dari 0% → N%
  - Angka: countUp animation (0 → final number)
  - Stars/emoji: bounce in berdasarkan performa
  - Maskot: celebratory jiggle + speech bubble
  - Buttons: wobble ready
```

---

## 5. Animation Architecture

### 5.1 Agent JSON → Animation Timeline

```
Agent mengirim:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "type": "math_steps",
  "visual": "blocks",              // "blocks" | "numberline" | "abstract"
  "question": "8 + 5 = ?",
  "steps": [
    {
      "action": "show",
      "count": 8,
      "color": "blue",
      "say": "Ada delapan balok"
    },
    {
      "action": "add",
      "count": 5,
      "color": "orange",
      "say": "Kita tambah lima balok lagi"
    },
    {
      "action": "prompt",
      "say": "Berapa semuanya?"
    }
  ],
  "answer": 13,
  "hints": [
    "Coba hitung semua balok satu per satu",
    "Hitung sampai 10 dulu: 8 + 2 = 10. Sisa 3 lagi.",
    "Lihat: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13"
  ]
}

Frontend menerjemahkan:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  step[0] → render 8 BlockCubes, color=blue
            trigger TTS("Ada delapan balok")
            spring bouncy stagger 0.06s

  step[1] → render 5 BlockCubes tambahan, color=orange
            trigger TTS("Kita tambah lima balok lagi")
            spring bouncy stagger 0.06s

  step[2] → show NumberPad + mic button
            trigger TTS("Berapa semuanya?")
            maskot → thinking
```

### 5.2 Framer Motion Implementation Pattern

```jsx
// Spring presets (sesuai design tokens)
const springs = {
  bouncy:  { type: "spring", stiffness: 300, damping: 15 },
  wobbly:  { type: "spring", stiffness: 180, damping: 12 },
  gentle:  { type: "spring", stiffness: 120, damping: 20 },
  snappy:  { type: "spring", stiffness: 500, damping: 25 },
};

// Block jiggle on hover (per-element spring physics)
<motion.div
  whileHover={{
    scale: 1.1,
    rotate: Math.random() * 6 - 3,  // ±3°
    y: -4,
    transition: springs.wobbly
  }}
  whileTap={{
    scale: 0.85,
    transition: springs.snappy
  }}
/>

// Stagger children reveal
<motion.div
  variants={{
    show: { transition: { staggerChildren: 0.06 } },
  }}
  initial="hidden"
  animate="show"
>
  {blocks.map(b => (
    <motion.div
      variants={{
        hidden: { scale: 0, opacity: 0, rotate: -10 },
        show:   { scale: 1, opacity: 1, rotate: 0,
                  transition: springs.bouncy }
      }}
    />
  ))}
</motion.div>
```

---

## 6. Responsive Strategy

```
MOBILE (< 640px)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Balok: 36×36px, max 10 per baris
  - Number pad: 44×44px per tombol
  - Corner bar: simplified (nama + progress dot)
  - Maskot: 56×56px
  - Padding: 16px
  - No mouse-follow effects (touch only)
  - Tap → jiggle (whileTap, no whileHover)

TABLET (640–1024px)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Balok: 44×44px
  - Number pad: 52×52px
  - 2-column card grid
  - Maskot: 72×72px

DESKTOP (> 1024px)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Balok: 48×48px
  - Full jiggle physics (mouse-follow, 3D tilt)
  - Custom cursor (dot + spring ring)
  - Liquid blob background canvas
  - Film grain overlay
```

---

## 7. Checklist Implementasi

### Phase 1 — Core (Hari 1)
- [ ] Setup design tokens di `index.css` (warna, font, spacing)
- [ ] Buat `BlockCube` component dengan jiggle spring
- [ ] Buat `NumberPad` component dengan stagger + wobble tap
- [ ] Buat `SpeechBubble` component + TTS integration
- [ ] Implementasi `CornerBar` (dari TFIB, diadaptasi)
- [ ] Layar Soal — render steps dari JSON, animate timeline
- [ ] Scoring logic (jawaban benar dari flow, bukan LLM)

### Phase 2 — Polish (Hari 2)
- [ ] Splash screen dengan hero text reveal + blob background
- [ ] Login screen dengan profil localStorage
- [ ] Home screen dengan jiggle cards
- [ ] Feedback overlay (benar/salah) dengan particles
- [ ] Ringkasan sesi
- [ ] Hint system (3 level, animated)
- [ ] Mascot reactions (CSS fallback atau Lottie)
- [ ] Number line visual mode
- [ ] STT input (mikrofon) dengan transkrip confirm
- [ ] Scroll progress bar
- [ ] Noise/grain overlay
- [ ] Responsive testing (HP Android target)

---

> **Catatan:** Semua motion value di atas sudah dioptimalkan untuk HP kelas menengah. Gunakan `will-change: transform` hanya pada elemen aktif, dan `transform: translateZ(0)` untuk GPU acceleration. Test di device nyata sebelum submit.

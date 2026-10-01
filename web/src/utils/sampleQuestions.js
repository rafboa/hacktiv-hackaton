export const sampleQuestions = [
  {
    type: 'math_steps',
    visual: 'blocks',
    question: '3 + 2 = ?',
    steps: [
      { action: 'show', count: 3, color: 'blue', say: 'Ada tiga balok' },
      { action: 'add', count: 2, color: 'orange', say: 'Kita tambah dua balok lagi' },
      { action: 'prompt', say: 'Berapa semuanya?' }
    ],
    answer: 5,
    hints: ['Coba hitung semua balok satu per satu', 'Tiga ditambah dua', 'Jawabannya adalah 5']
  },
  {
    type: 'math_steps',
    visual: 'numberline',
    question: '4 + 3 = ?',
    steps: [
      { action: 'show', count: 4, color: 'green', say: 'Mulai dari angka empat' },
      { action: 'add', count: 3, color: 'yellow', say: 'Maju tiga langkah' },
      { action: 'prompt', say: 'Sekarang kita ada di angka berapa?' }
    ],
    answer: 7,
    hints: ['Dari 4, loncat 3 kali ke kanan', 'Empat, lima, enam...', 'Jawabannya adalah 7']
  },
  {
    type: 'math_steps',
    visual: 'blocks',
    question: '5 - 2 = ?',
    steps: [
      { action: 'show', count: 5, color: 'orange', say: 'Ada lima balok' },
      { action: 'remove', count: 2, color: 'transparent', say: 'Kita kurangi dua balok' },
      { action: 'prompt', say: 'Sisa berapa balok?' }
    ],
    answer: 3,
    hints: ['Hitung balok yang masih ada', 'Lima diambil dua', 'Jawabannya adalah 3']
  },
  {
    type: 'math_steps',
    visual: 'numberline',
    question: '6 - 4 = ?',
    steps: [
      { action: 'show', count: 6, color: 'blue', say: 'Mulai dari angka enam' },
      { action: 'remove', count: 4, color: 'transparent', say: 'Mundur empat langkah' },
      { action: 'prompt', say: 'Kita berhenti di angka berapa?' }
    ],
    answer: 2,
    hints: ['Dari 6, loncat 4 kali ke kiri', 'Enam mundur empat', 'Jawabannya adalah 2']
  },
  {
    type: 'math_steps',
    visual: 'blocks',
    question: '8 + 4 = ?',
    steps: [
      { action: 'show', count: 8, color: 'green', say: 'Ada delapan balok' },
      { action: 'add', count: 4, color: 'blue', say: 'Kita tambah empat balok lagi' },
      { action: 'prompt', say: 'Berapa jumlah semuanya?' }
    ],
    answer: 12,
    hints: ['Coba hitung dari delapan, sembilan...', 'Hitung perlahan semua baloknya', 'Jawabannya adalah 12']
  },
  {
    type: 'math_steps',
    visual: 'numberline',
    question: '7 + 5 = ?',
    steps: [
      { action: 'show', count: 7, color: 'orange', say: 'Mulai dari angka tujuh' },
      { action: 'add', count: 5, color: 'yellow', say: 'Maju lima langkah ke depan' },
      { action: 'prompt', say: 'Berapa jawabannya?' }
    ],
    answer: 12,
    hints: ['Tujuh maju lima kali', 'Lewati angka sepuluh', 'Jawabannya adalah 12']
  },
  {
    type: 'math_steps',
    visual: 'blocks',
    question: '10 - 3 = ?',
    steps: [
      { action: 'show', count: 10, color: 'blue', say: 'Ada sepuluh balok' },
      { action: 'remove', count: 3, color: 'transparent', say: 'Kita ambil tiga balok' },
      { action: 'prompt', say: 'Tinggal berapa ya?' }
    ],
    answer: 7,
    hints: ['Sepuluh mundur tiga', 'Hitung sisa balok yang ada', 'Jawabannya adalah 7']
  },
  {
    type: 'math_steps',
    visual: 'numberline',
    question: '15 - 6 = ?',
    steps: [
      { action: 'show', count: 15, color: 'green', say: 'Mulai dari angka lima belas' },
      { action: 'remove', count: 6, color: 'transparent', say: 'Mundur enam langkah' },
      { action: 'prompt', say: 'Angka berapa sekarang?' }
    ],
    answer: 9,
    hints: ['Mundur perlahan dari lima belas', 'Mundur sampai melewati sepuluh', 'Jawabannya adalah 9']
  },
  {
    type: 'math_steps',
    visual: 'blocks',
    question: '9 + 6 = ?',
    steps: [
      { action: 'show', count: 9, color: 'yellow', say: 'Ada sembilan balok' },
      { action: 'add', count: 6, color: 'orange', say: 'Ditambah enam balok' },
      { action: 'prompt', say: 'Ada berapa semua baloknya?' }
    ],
    answer: 15,
    hints: ['Coba jadikan sepuluh dulu, sisa berapa yang ditambahkan?', 'Sembilan ditambah enam', 'Jawabannya adalah 15']
  },
  {
    type: 'math_steps',
    visual: 'numberline',
    question: '12 - 7 = ?',
    steps: [
      { action: 'show', count: 12, color: 'blue', say: 'Mulai dari angka dua belas' },
      { action: 'remove', count: 7, color: 'transparent', say: 'Mundur tujuh langkah' },
      { action: 'prompt', say: 'Berhenti di angka berapa?' }
    ],
    answer: 5,
    hints: ['Mundur dari 12', 'Bisa kurangi 2 dulu ke 10, lalu kurangi 5', 'Jawabannya adalah 5']
  }
];

export default sampleQuestions;

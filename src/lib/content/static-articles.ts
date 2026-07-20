import type { Article } from '@prisma/client';

export type PublicArticle = Article;

const publishedAt = new Date('2026-07-20T03:00:00.000Z');

export const STATIC_ARTICLES: PublicArticle[] = [
  {
    id: 'static-artikel-ac-tidak-dingin',
    slug: 'ac-tidak-dingin-angin-kencang',
    title: 'AC Tidak Dingin tapi Angin Kencang',
    metaDescription:
      'Panduan mengecek AC tidak dingin walau angin masih kencang, dari filter, outdoor unit, sampai kapan perlu panggil teknisi.',
    contentMarkdown: `AC yang tidak dingin belum tentu langsung berarti freon habis. Pola yang paling penting justru membedakan apakah masalahnya ada di aliran udara atau proses pendinginannya.

Kalau angin dari indoor masih kencang, filter biasanya bukan tersangka utama. Fokus berikutnya pindah ke outdoor unit, pipa, sensor suhu, atau tekanan refrigeran. Kalau angin ikut melemah, barulah filter kotor, evaporator kotor, atau kipas indoor lebih masuk akal.

## Cek aman sebelum panggil teknisi

1. Pastikan mode remote ada di Cool, bukan Fan atau Dry.
2. Set suhu ke 24 derajat selama 10-15 menit, lalu rasakan perubahan udara.
3. Lihat outdoor unit dari jarak aman: kipasnya berputar atau diam.
4. Cek apakah filter indoor sangat berdebu.
5. Perhatikan apakah ada es di pipa atau unit indoor.

## Tanda masalah perlu teknisi

Panggil teknisi AC jika outdoor tidak menyala, pipa muncul es, AC menyala tapi suhu tidak turun sama sekali, atau MCB turun saat AC dinyalakan. Kondisi seperti ini butuh alat ukur dan pengecekan tekanan, bukan sekadar tambah freon.

## Kesalahan yang sering bikin biaya membengkak

Banyak orang langsung minta isi freon, padahal kebocoran belum dicari. Kalau ada kebocoran, freon baru akan habis lagi dan masalah kembali dalam waktu singkat. Yang lebih aman adalah minta teknisi cek sumber masalah dulu, baru putuskan tindakan.

**Pesan teknisi AC terpercaya di Gegarap** agar pengecekan dilakukan dari gejala yang tepat, bukan tebak-tebakan.`,
    faq: [
      {
        q: 'Apakah AC tidak dingin pasti karena freon habis?',
        a: 'Tidak selalu. Bisa karena outdoor mati, filter sangat kotor, sensor bermasalah, evaporator kotor, atau ada kebocoran refrigeran.',
      },
      {
        q: 'Bolehkah membersihkan filter sendiri?',
        a: 'Boleh jika unit mudah dijangkau dan listrik sudah dimatikan. Jangan bongkar bagian dalam atau menyentuh kabel.',
      },
      {
        q: 'Kapan harus panggil teknisi?',
        a: 'Jika outdoor tidak menyala, ada es, MCB turun, atau AC tetap tidak dingin setelah filter dibersihkan.',
      },
    ],
    internalLinks: [
      { label: 'Cari tukang bangunan di Gegarap', href: '/search?category=Tukang%20Bangunan' },
      { label: 'Tanya AI soal gejala AC', href: '/asisten?q=AC%20saya%20tidak%20dingin' },
    ],
    category: 'Tukang Bangunan',
    location: 'Yogyakarta',
    primaryKeyword: 'AC tidak dingin',
    keywords: ['AC angin kencang tidak dingin', 'servis AC Yogyakarta', 'penyebab AC tidak dingin'],
    intent: 'informational',
    scoreSeo: 9,
    scoreReadability: 9,
    scoreValue: 9,
    scoreTrust: 9,
    scoreConversion: 8,
    scoreTotal: 44,
    similarityScore: 0,
    newAngle: 'Membedakan airflow dan pendinginan sebelum menyimpulkan freon habis.',
    status: 'PUBLISHED',
    generatedBy: 'curated-static',
    authorId: null,
    publishedAt,
    createdAt: publishedAt,
    updatedAt: publishedAt,
  },
  {
    id: 'static-artikel-mcb-jeglek',
    slug: 'mcb-sering-jeglek-saat-alat-dinyalakan',
    title: 'MCB Sering Jeglek Saat Alat Dinyalakan',
    metaDescription:
      'Cara membaca pola MCB turun, tanda bahaya listrik rumah, dan kapan sebaiknya memanggil tukang listrik.',
    contentMarkdown: `MCB yang sering jeglek bukan sekadar listrik "kurang kuat". Pola kapan MCB turun bisa memberi petunjuk apakah masalahnya beban berlebih, alat rusak, atau kebocoran arus.

Insight sederhananya: waktu kejadian lebih penting daripada jumlah alat. Jika MCB turun setiap pompa, AC, atau dispenser menyala, alat itu patut dicurigai. Jika turunnya acak, apalagi saat hujan, instalasi dan area lembap perlu diperiksa lebih hati-hati.

## Cek aman yang bisa dilakukan

1. Matikan alat terakhir yang dinyalakan sebelum MCB turun.
2. Cabut alat tersebut dari stop kontak jika aman dan tangan kering.
3. Nyalakan MCB kembali tanpa alat itu.
4. Perhatikan apakah MCB tetap turun.
5. Cek dari luar apakah ada stop kontak panas, bau gosong, atau percikan.

## Jangan lakukan ini

Jangan membongkar panel MCB, membuka stop kontak, atau menyambung kabel sendiri. Bagian listrik yang terlihat sederhana tetap bisa berbahaya, terutama jika ada panas, air, atau bau gosong.

## Kapan perlu tukang listrik

Panggil tukang listrik jika MCB tetap turun setelah beban dilepas, ada bau gosong, stop kontak panas, lampu berkedip tidak wajar, atau masalah muncul setelah hujan. Teknisi perlu mengukur beban dan mencari titik bocor arus dengan alat yang tepat.

**Hubungi tukang listrik profesional lewat Gegarap** jika gejalanya berulang atau menyangkut keselamatan rumah.`,
    faq: [
      {
        q: 'Apakah MCB jeglek berarti daya rumah kurang?',
        a: 'Belum tentu. Bisa karena beban berlebih, alat rusak, kabel bermasalah, atau kebocoran arus.',
      },
      {
        q: 'Apakah aman menaikkan MCB terus-menerus?',
        a: 'Tidak disarankan. Jika MCB turun berulang, itu tanda proteksi sedang bekerja dan penyebabnya perlu dicari.',
      },
      {
        q: 'Tanda bahaya apa yang harus diwaspadai?',
        a: 'Bau gosong, percikan, stop kontak panas, kabel terbuka, atau area listrik terkena air.',
      },
    ],
    internalLinks: [
      { label: 'Cari tukang listrik terverifikasi', href: '/search?category=Tukang%20Listrik' },
      { label: 'Konsultasi gejala listrik ke AI', href: '/asisten?q=MCB%20sering%20jeglek' },
    ],
    category: 'Tukang Listrik',
    location: 'Yogyakarta',
    primaryKeyword: 'MCB sering jeglek',
    keywords: ['listrik rumah jeglek', 'tukang listrik Yogyakarta', 'MCB turun saat alat menyala'],
    intent: 'informational',
    scoreSeo: 9,
    scoreReadability: 9,
    scoreValue: 9,
    scoreTrust: 9,
    scoreConversion: 8,
    scoreTotal: 44,
    similarityScore: 0,
    newAngle: 'Membaca pola waktu MCB turun sebelum menebak daya kurang.',
    status: 'PUBLISHED',
    generatedBy: 'curated-static',
    authorId: null,
    publishedAt: new Date('2026-07-20T03:05:00.000Z'),
    createdAt: publishedAt,
    updatedAt: publishedAt,
  },
  {
    id: 'static-artikel-saluran-mampet',
    slug: 'saluran-kamar-mandi-mampet-air-balik',
    title: 'Saluran Kamar Mandi Mampet dan Air Balik',
    metaDescription:
      'Kenali beda mampet lokal dan sumbatan jalur utama, langkah aman di rumah, serta kapan perlu tukang ledeng.',
    contentMarkdown: `Saluran kamar mandi mampet terlihat seperti masalah kecil, tapi gejalanya bisa menunjukkan lokasi sumbatan. Satu titik yang lambat biasanya masalah lokal. Beberapa titik yang ikut naik menandakan jalur utama mungkin tertahan.

Yang sering terlewat: air yang balik dari floor drain bukan cuma soal kotoran di permukaan. Bisa ada rambut, lemak sabun, pasir renovasi, atau benda kecil yang tertahan lebih dalam di pipa.

## Cek gejala terlebih dahulu

1. Apakah hanya satu floor drain yang lambat, atau wastafel/WC juga terdampak?
2. Apakah air balik membawa bau menyengat atau kotoran?
3. Apakah masalah muncul setelah renovasi atau setelah membuang banyak air?
4. Apakah sudah dicoba plunger tanpa bahan kimia keras?

## Langkah aman di rumah

Hentikan dulu pemakaian air di titik yang mampet. Bersihkan saringan floor drain jika mudah diangkat. Gunakan plunger secara perlahan jika tidak ada risiko air kotor meluap ke area listrik.

## Hindari campuran cairan kimia

Jangan mencampur pembersih saluran dengan cairan lain. Reaksi kimia bisa menghasilkan uap berbahaya dan merusak pipa tertentu. Jika sumbatan dalam, cairan sering hanya berhenti di atas sumbatan.

## Kapan perlu tukang ledeng

Panggil tukang ledeng jika beberapa titik ikut mampet, air kotor balik, bau makin kuat, atau sumbatan kembali lagi setelah dibersihkan. Tukang ledeng bisa mengecek jalur pipa dan membuka sumbatan dengan alat yang lebih aman.

**Pesan tukang ledeng terpercaya lewat Gegarap** untuk menangani sumbatan tanpa menebak-nebak jalur pipa.`,
    faq: [
      {
        q: 'Apa beda mampet lokal dan jalur utama?',
        a: 'Mampet lokal biasanya hanya satu titik. Jalur utama dicurigai jika beberapa saluran ikut lambat atau air balik bersamaan.',
      },
      {
        q: 'Apakah cairan pembersih saluran selalu aman?',
        a: 'Tidak selalu. Beberapa cairan bisa berbahaya jika bercampur dan dapat merusak pipa tertentu.',
      },
      {
        q: 'Kapan tukang ledeng perlu dipanggil?',
        a: 'Jika air kotor balik, bau kuat, beberapa titik mampet, atau sumbatan sering kambuh.',
      },
    ],
    internalLinks: [
      { label: 'Cari tukang ledeng di Gegarap', href: '/search?category=Tukang%20Ledeng' },
      { label: 'Tanya AI soal saluran mampet', href: '/asisten?q=Saluran%20kamar%20mandi%20mampet' },
    ],
    category: 'Tukang Ledeng',
    location: 'Yogyakarta',
    primaryKeyword: 'saluran kamar mandi mampet',
    keywords: ['air balik kamar mandi', 'tukang ledeng Yogyakarta', 'floor drain mampet'],
    intent: 'informational',
    scoreSeo: 9,
    scoreReadability: 9,
    scoreValue: 9,
    scoreTrust: 9,
    scoreConversion: 8,
    scoreTotal: 44,
    similarityScore: 0,
    newAngle: 'Membedakan satu titik mampet dan sumbatan jalur utama.',
    status: 'PUBLISHED',
    generatedBy: 'curated-static',
    authorId: null,
    publishedAt: new Date('2026-07-20T03:10:00.000Z'),
    createdAt: publishedAt,
    updatedAt: publishedAt,
  },
];

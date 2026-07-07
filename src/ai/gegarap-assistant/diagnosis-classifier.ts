export function detectCategory(query: string, history: { role: string; content: string }[]): string | null {
  const userMessages = history
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content)
    .join(' ');
  const fullContext = `${userMessages} ${query}`.toLowerCase();

  const rules: Array<{ category: string; keywords: RegExp }> = [
    { category: 'AC', keywords: /\b(ac|air conditioner|pendingin|freon)\b/i },
    { category: 'Tukang Listrik', keywords: /\b(listrik|lampu|korslet|kabel|stop kontak|saklar|mcb|meteran|setrum)\b/i },
    { category: 'Tukang Ledeng', keywords: /\b(ledeng|pipa|paralon|kran|keran|wastafel|saluran air|mampet|bocor air|sumur|pompa air|kamar mandi|toilet)\b/i },
    { category: 'Tukang Atap', keywords: /\b(atap|genteng|bocor atas|talang|plafon bocor)\b/i },
    { category: 'Tukang Bangunan', keywords: /\b(bangun|renovasi|tembok|dinding|keramik|semen|cor|kusen|pasang)\b/i },
    { category: 'Tukang Cat', keywords: /\b(cat|pengecatan|warna dinding|mengelupas|berjamur)\b/i },
    { category: 'CCTV', keywords: /\b(cctv|kamera pengintai|dvr|nvr)\b/i },
    { category: 'Internet', keywords: /\b(internet|wifi|router|indihome|biznet|sinyal|jaringan)\b/i },
    { category: 'Pembersih Rumah', keywords: /\b(bersih|cleaning|kebersihan|nyapu|ngepel|cuci|beberes|asisten rumah|kotor)\b/i },
    { category: 'Tukang Kebun', keywords: /\b(kebun|taman|rumput|tanaman|pohon|berkebun|potong rumput|landscap)\b/i },
    { category: 'Furniture', keywords: /\b(furniture|lemari|meja|kursi|rak|engsel)\b/i },
    { category: 'Appliance', keywords: /\b(kulkas|mesin cuci|tv|televisi|oven|microwave|kompor)\b/i },
  ];

  for (const rule of rules) {
    if (rule.keywords.test(query.toLowerCase())) return rule.category;
  }

  for (const rule of rules) {
    if (rule.keywords.test(fullContext)) return rule.category;
  }

  return null;
}

// Mücevher sektörü hakkında ilginç bilgiler - bekleme ekranında gösterilecek
export const jewelryFacts: string[] = [
  "Dünyanın en büyük elması 'Cullinan' 3.106 karattır ve 1905'te Güney Afrika'da bulunmuştur.",
  "Altın o kadar yumuşaktır ki, saf haliyle 1 gram altından 3 kilometrelik tel çekilebilir.",
  "Pırlantaların %80'i endüstriyel amaçlarla kullanılır, sadece %20'si mücevherat için uygundur.",
  "Antik Mısırlılar, altını 'tanrıların eti' olarak adlandırırdı.",
  "Bir pırlantanın oluşması için 1-3 milyar yıl ve 150-200 km derinlikte aşırı basınç gerekir.",
  "Zümrüt, pırlantadan 20 kat daha nadir bulunan bir taştır.",
  "Yakut ve safir aynı mineral ailesinden (korundum) gelir, sadece renkleri farklıdır.",
  "İnci, bir istiridyanın yabancı maddeye karşı savunma mekanizmasıyla oluşur.",
  "Altın, uzayda asteroid madenciliğinin ana hedeflerinden biridir.",
  "Kleopatra, yakutları ölümsüzlük sembolü olarak takardı.",
  "Dünya üzerinde şimdiye kadar çıkarılan tüm altın, Olympic yüzme havuzunun sadece 3,5 tanesini doldurabilir.",
  "Pırlanta, Yunanca 'adamas' kelimesinden gelir ve 'yenilmez' anlamına gelir.",
  "Tanzanit, dünya üzerinde sadece Tanzanya'nın Mererani bölgesinde bulunur.",
  "Antik Roma'da nişan yüzüğü geleneğini başlatan topluluk olarak bilinir.",
  "Mor ametist, antik çağlarda sarhoşluğu önlediğine inanılırdı.",
  "Mavi topaz doğada çok nadirdir, piyasadaki çoğu ısıl işlemle renk kazanmıştır.",
  "Osmanlı padişahlarının taktığı mücevherler, bugünkü değerleriyle milyarlarca dolar eder.",
  "Japon Akoya incileri, mükemmel yuvarlaklıkları ile dünyaca ünlüdür.",
  "Bir karat, 0.2 grama eşittir ve keçiboynuzu tohumundan türetilmiştir.",
  "Opaller %20'ye kadar su içerebilir ve bu onlara eşsiz ışık oyunlarını verir.",
  "Harry Winston'ın 'Hope Diamond' lanetli olduğuna inanılan en ünlü mavi pırlantadır.",
  "Viktorya dönemi mücevherlerinde saç örgüleri kullanılırdı.",
  "Cartier'in panther tasarımı, Windsor Düşesi için 1940'larda yaratılmıştır.",
  "Platin, altından 30 kat daha nadir bulunan bir metaldir.",
  "Alexandrite taşı, gün ışığında yeşil, yapay ışıkta kırmızı görünür.",
  "Türkiye, dünya mücevher üretiminde önemli bir ihracat ülkesidir.",
  "Antik Yunan'da ametist, şarap tanrısı Dionysos ile ilişkilendirilirdi.",
  "İlk pırlanta nişan yüzüğü 1477'de Avusturya Arşidükü Maximilian tarafından verildi.",
  "Güney Afrika'daki Kimberley madeni, dünyanın en büyük insan yapımı çukurudur.",
  "Fabergé yumurtaları, Rus çarları için yapılan en değerli mücevher sanat eserleridir.",
];

export function getRandomFact(): string {
  return jewelryFacts[Math.floor(Math.random() * jewelryFacts.length)];
}

export function getRandomFacts(count: number): string[] {
  const shuffled = [...jewelryFacts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

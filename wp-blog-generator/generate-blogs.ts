/**
 * İstanbul Aslan Hamal - SEO Odaklı Blog Üretim Scripti
 *
 * Kullanım:
 *   npx tsx generate-blogs.ts
 *
 * Ortam değişkenleri (.env dosyasında):
 *   WP_SITE_URL=https://istanbulaslanhamal.com
 *   WP_API_KEY=eklenti-ayarlarindaki-api-key
 */

// ============================================================
// YAPILANDIRMA
// ============================================================

const CONFIG = {
  siteUrl: process.env.WP_SITE_URL || 'https://istanbulaslanhamal.com',
  apiKey: process.env.WP_API_KEY || '',
  publishStatus: 'draft' as 'draft' | 'publish' | 'pending', // Önce draft olarak oluştur
  defaultCategory: 1, // Blog kategorisi
  companyName: 'İstanbul Aslan Hamal',
  companyPhone: '0541 684 85 18',
  companyUrl: 'https://istanbulaslanhamal.com',
};

// ============================================================
// ANAHTAR KELİME VE BLOG YAZILAR
// ============================================================

interface BlogPost {
  title: string;
  slug: string;
  focusKeyword: string;
  metaDescription: string;
  seoTitle: string;
  tags: string[];
  content: string;
  excerpt: string;
}

const blogPosts: BlogPost[] = [
  // ==================== İLÇE BAZLI İÇERİKLER ====================
  {
    title: 'Kadıköy Hamal Hizmeti: Güvenilir ve Ekonomik Taşımacılık',
    slug: 'kadikoy-hamal-hizmeti',
    focusKeyword: 'kadıköy hamal',
    seoTitle: 'Kadıköy Hamal Hizmeti | Profesyonel Taşıma - İstanbul Aslan Hamal',
    metaDescription: 'Kadıköy hamal hizmeti arıyorsanız doğru adrestesiniz. Profesyonel ekip, şeffaf fiyat, güvenli taşıma. Hemen arayın: 0541 684 85 18',
    tags: ['kadıköy hamal', 'kadıköy nakliye', 'kadıköy taşımacılık', 'kadıköy eşya taşıma'],
    excerpt: 'Kadıköy\'de profesyonel hamal hizmeti mi arıyorsunuz? İstanbul Aslan Hamal olarak Kadıköy ve çevresinde güvenli, hızlı ve ekonomik taşımacılık hizmeti sunuyoruz.',
    content: `
<h2>Kadıköy'de Profesyonel Hamal Hizmeti</h2>
<p>Kadıköy, İstanbul'un en hareketli ve en çok tercih edilen ilçelerinden biridir. Yoğun nüfusu ve dar sokakları ile <strong>ev taşıma</strong> ve <strong>eşya taşıma</strong> işlemleri profesyonel bir ekip gerektirir. <strong>İstanbul Aslan Hamal</strong> olarak Kadıköy'ün her noktasında hizmet veriyoruz.</p>

<h3>Kadıköy Hamal Hizmetlerimiz</h3>
<ul>
  <li><strong>Ev taşıma:</strong> Kadıköy'de ev taşımacılığında uzman ekibimizle eşyalarınız güvende</li>
  <li><strong>Ofis taşıma:</strong> İş yerinizi minimum kesinti ile taşıyoruz</li>
  <li><strong>Eşya taşıma:</strong> Tek parça eşya taşıma hizmeti (buzdolabı, çamaşır makinesi, koltuk vb.)</li>
  <li><strong>Yük taşıma:</strong> Ağır yük ve ticari eşya taşımacılığı</li>
  <li><strong>Asansörlü taşıma:</strong> Yüksek katlara asansörlü taşıma çözümleri</li>
</ul>

<h3>Kadıköy'de Taşınırken Dikkat Edilmesi Gerekenler</h3>
<p>Kadıköy'ün dar sokakları ve yoğun trafiği, taşınma sürecini zorlaştırabilir. İşte dikkat etmeniz gereken noktalar:</p>
<ol>
  <li><strong>Taşınma saatini doğru planlayın:</strong> Kadıköy'de trafik yoğunluğu sabah 07:00-09:00 ve akşam 17:00-20:00 arası zirve yapar. Bu saatler dışında taşınmak hem zaman hem maliyet açısından avantajlıdır.</li>
  <li><strong>Park izni alın:</strong> Dar sokaklarda kamyon parkı için belediyeden izin almanız gerekebilir.</li>
  <li><strong>Asansör durumunu kontrol edin:</strong> Bina asansörü taşıma için uygun değilse, dış cephe asansörü gerekebilir.</li>
  <li><strong>Profesyonel ekip tercih edin:</strong> Kadıköy'ün merdivenleri ve dar geçitleri deneyimli hamallar gerektirir.</li>
</ol>

<h3>Kadıköy Hamal Fiyatları 2025</h3>
<p>Kadıköy'de hamal hizmet fiyatlarımız taşınacak eşya miktarına, kat sayısına ve mesafeye göre belirlenir. <strong>Şeffaf fiyat politikamız</strong> ile sürpriz maliyetlerle karşılaşmazsınız.</p>
<table>
  <tr><th>Hizmet</th><th>Fiyat Aralığı</th></tr>
  <tr><td>Tek parça eşya taşıma</td><td>500₺ - 1.500₺</td></tr>
  <tr><td>1+1 ev taşıma</td><td>2.000₺ - 4.000₺</td></tr>
  <tr><td>2+1 ev taşıma</td><td>3.500₺ - 6.000₺</td></tr>
  <tr><td>3+1 ev taşıma</td><td>5.000₺ - 8.000₺</td></tr>
  <tr><td>Ofis taşıma</td><td>Teklif alınız</td></tr>
</table>
<p><em>Fiyatlar tahmini olup, kesin fiyat için <strong><a href="tel:05416848518">0541 684 85 18</a></strong> numarasını arayarak ücretsiz keşif talep edebilirsiniz.</em></p>

<h3>Neden İstanbul Aslan Hamal?</h3>
<p>Kadıköy'de onlarca hamal firması arasından bizi tercih etmeniz için birçok neden var:</p>
<ul>
  <li>✓ 7/24 hizmet</li>
  <li>✓ Deneyimli ve profesyonel ekip</li>
  <li>✓ Sigortalı taşımacılık</li>
  <li>✓ Şeffaf fiyatlandırma, gizli maliyet yok</li>
  <li>✓ Ücretsiz keşif ve fiyat teklifi</li>
  <li>✓ Zamanında teslimat garantisi</li>
</ul>

<h3>Hemen İletişime Geçin</h3>
<p>Kadıköy'de hamal hizmeti için hemen bizi arayın. <strong>Ücretsiz keşif</strong> ve <strong>fiyat teklifi</strong> alın!</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
<p>🌐 <strong><a href="https://istanbulaslanhamal.com">istanbulaslanhamal.com</a></strong></p>
`
  },

  {
    title: 'Beşiktaş Hamal ve Nakliye Hizmeti',
    slug: 'besiktas-hamal-nakliye-hizmeti',
    focusKeyword: 'beşiktaş hamal',
    seoTitle: 'Beşiktaş Hamal ve Nakliye | Profesyonel Taşıma Hizmeti',
    metaDescription: 'Beşiktaş hamal ve nakliye hizmeti. Profesyonel ekip, uygun fiyat, güvenli taşıma. İstanbul Aslan Hamal - 0541 684 85 18',
    tags: ['beşiktaş hamal', 'beşiktaş nakliye', 'beşiktaş eşya taşıma', 'beşiktaş taşımacılık'],
    excerpt: 'Beşiktaş\'ta profesyonel hamal ve nakliye hizmeti. Dar sokaklar, yokuşlar derdi yok! Deneyimli ekibimizle güvenle taşıyoruz.',
    content: `
<h2>Beşiktaş'ta Güvenilir Hamal ve Nakliye</h2>
<p>Beşiktaş, İstanbul'un en eski ve en karakteristik ilçelerinden biridir. Dar sokakları, dik yokuşları ve tarihi binaları ile taşınma süreci özel deneyim gerektirir. <strong>İstanbul Aslan Hamal</strong> olarak Beşiktaş'ın tüm mahallelerinde profesyonel hamal ve nakliye hizmeti sunuyoruz.</p>

<h3>Beşiktaş'ın Taşınma Zorlukları</h3>
<p>Beşiktaş ilçesinde taşınma, İstanbul'un diğer ilçelerine göre bazı ek zorluklar taşır:</p>
<ul>
  <li><strong>Dar ve dik sokaklar:</strong> Özellikle arka sokaklarda büyük araçların geçişi zordur</li>
  <li><strong>Eski binalar:</strong> Asansörsüz, dar merdivenli yapılar yaygındır</li>
  <li><strong>Park sorunu:</strong> Kamyon parkı için yer bulmak güç olabilir</li>
  <li><strong>Trafik yoğunluğu:</strong> Boğaz geçişi ve sahil yolu trafiği</li>
</ul>
<p>Tüm bu zorlukları aşmak için <strong>deneyimli ekibimiz</strong> ve <strong>özel ekipmanlarımız</strong> ile Beşiktaş'ta sorunsuz taşınma deneyimi sunuyoruz.</p>

<h3>Beşiktaş Mahallelerinde Hizmet Veriyoruz</h3>
<p>Abbasağa, Akatlar, Arnavutköy, Balmumcu, Bebek, Cihannüma, Dikilitaş, Etiler, Gayrettepe, Konaklar, Kuruçeşme, Levent, Levazım, Mecidiye, Muradiye, Nisbetiye, Ortaköy, Sinanpaşa, Türkali, Ulus, Vişnezade, Yıldız ve daha birçok mahallede hizmet veriyoruz.</p>

<h3>Beşiktaş Hamal Hizmetlerimiz</h3>
<ul>
  <li>Ev taşıma (1+1'den 4+1'e kadar)</li>
  <li>Ofis ve iş yeri taşıma</li>
  <li>Tek parça eşya taşıma (piyano, kasa, beyaz eşya)</li>
  <li>Asansörlü dış cephe taşıma</li>
  <li>Ambalajlama ve paketleme hizmeti</li>
  <li>Eşya depolama</li>
</ul>

<h3>Beşiktaş Hamal Fiyatları</h3>
<p>Beşiktaş'ta hamal fiyatları; taşınacak eşya miktarı, bulunduğunuz kat, binanın asansör durumu ve gidilecek mesafeye göre değişir. <strong>Sürpriz fiyat yok</strong>, keşif sonrası net fiyat verilir.</p>

<p><strong>Ücretsiz keşif ve fiyat teklifi için:</strong></p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
`
  },

  {
    title: 'Ataşehir Hamal Hizmeti: Hızlı ve Güvenli Taşıma',
    slug: 'atasehir-hamal-hizmeti',
    focusKeyword: 'ataşehir hamal',
    seoTitle: 'Ataşehir Hamal Hizmeti | Hızlı Güvenli Taşıma - Aslan Hamal',
    metaDescription: 'Ataşehir hamal hizmeti için İstanbul Aslan Hamal. Profesyonel ekip, modern araçlar, uygun fiyat. Hemen arayın: 0541 684 85 18',
    tags: ['ataşehir hamal', 'ataşehir nakliye', 'ataşehir taşımacılık', 'ataşehir ev taşıma'],
    excerpt: 'Ataşehir\'de profesyonel hamal hizmeti. Modern rezidanslardan müstakil evlere kadar her türlü taşıma işleminde yanınızdayız.',
    content: `
<h2>Ataşehir'de Profesyonel Hamal Hizmeti</h2>
<p>Ataşehir, son yıllarda hızla büyüyen ve İstanbul'un en modern ilçelerinden biri haline gelen bir bölgedir. Yüksek katlı rezidanslar, yeni siteler ve geniş bulvarları ile taşınma sürecinde profesyonel destek almak büyük önem taşır.</p>

<h3>Ataşehir'de Neden Profesyonel Hamal Seçmelisiniz?</h3>
<p>Ataşehir'in yüksek binalarında taşınma, özel ekipman ve deneyim gerektirir:</p>
<ul>
  <li><strong>Yüksek katlı binalar:</strong> 20-30 katlı rezidanslarda asansör kapasitesi sınırlıdır</li>
  <li><strong>Site yönetimi kuralları:</strong> Taşınma saatleri ve asansör kullanım kuralları vardır</li>
  <li><strong>Geniş daireler:</strong> Büyük mobilyaların taşınması uzmanlık gerektirir</li>
  <li><strong>Otopark alanları:</strong> Kamyon için uygun park alanı bulunması gerekir</li>
</ul>

<h3>Ataşehir Hamal Hizmet Alanlarımız</h3>
<ul>
  <li>Rezidans taşıma</li>
  <li>Site içi taşıma</li>
  <li>Ev taşıma (tüm daire tipleri)</li>
  <li>Ofis taşıma</li>
  <li>Eşya montaj ve demontaj</li>
  <li>Ambalajlama hizmeti</li>
  <li>Asansörlü taşıma</li>
</ul>

<h3>Ataşehir Mahallelerinde Hizmet</h3>
<p>Ataşehir Bulvarı, Barbaros, Esatpaşa, Ferhatpaşa, İçerenköy, Kayışdağı, Küçükbakkalköy, Mevlana, Mustafa Kemal, Yenişehir ve tüm Ataşehir mahallelerinde hamal hizmeti sunuyoruz.</p>

<h3>Hemen Teklif Alın</h3>
<p>Ataşehir'de taşınma planınız mı var? <strong>Ücretsiz keşif</strong> için hemen arayın!</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
<p>🌐 <a href="https://istanbulaslanhamal.com">istanbulaslanhamal.com</a></p>
`
  },

  // ==================== HİZMET BAZLI İÇERİKLER ====================
  {
    title: 'İstanbul Ev Taşıma Rehberi: A\'dan Z\'ye Bilmeniz Gerekenler',
    slug: 'istanbul-ev-tasima-rehberi',
    focusKeyword: 'istanbul ev taşıma',
    seoTitle: 'İstanbul Ev Taşıma Rehberi | Adım Adım Taşınma Kılavuzu',
    metaDescription: 'İstanbul\'da ev taşıma rehberi. Taşınma öncesi yapılacaklar, maliyetler, dikkat edilmesi gerekenler. Profesyonel destek: 0541 684 85 18',
    tags: ['istanbul ev taşıma', 'ev taşıma', 'taşınma rehberi', 'ev nakliye', 'taşınma ipuçları'],
    excerpt: 'İstanbul\'da ev taşıma sürecinde bilmeniz gereken her şey: hazırlık, paketleme, taşıma günü ve yerleşim.',
    content: `
<h2>İstanbul'da Ev Taşıma: Eksiksiz Rehber</h2>
<p>İstanbul'da ev taşımak, şehrin büyüklüğü ve trafiği nedeniyle ciddi bir planlama gerektirir. Bu rehberde, taşınma sürecinizi en verimli şekilde yönetmeniz için ihtiyacınız olan tüm bilgileri bulacaksınız.</p>

<h3>Taşınmadan 2 Hafta Önce Yapılacaklar</h3>
<ol>
  <li><strong>Hamal firması seçin:</strong> En az 2-3 firmadan teklif alın, referansları kontrol edin</li>
  <li><strong>Eşya envanteri çıkarın:</strong> Taşınacak ve elden çıkarılacak eşyaları belirleyin</li>
  <li><strong>Ambalaj malzemesi temin edin:</strong> Koli, balonlu naylon, streç film, koli bandı</li>
  <li><strong>Abonelik ve adres değişikliklerini başlatın:</strong> Elektrik, su, doğalgaz, internet</li>
  <li><strong>Sigorta durumunu kontrol edin:</strong> Taşıma sigortası olup olmadığını sorun</li>
</ol>

<h3>Taşınmadan 1 Hafta Önce</h3>
<ol>
  <li><strong>Paketlemeye başlayın:</strong> Az kullanılan eşyalardan başlayın</li>
  <li><strong>Kolileri etiketleyin:</strong> Her kolinin üzerine içindekiler ve gideceği oda yazılmalı</li>
  <li><strong>Kırılacak eşyaları özenle sarın:</strong> Tabak, bardak, vazo gibi kırılgan eşyalar için bol ambalaj kullanın</li>
  <li><strong>Değerli eşyaları ayırın:</strong> Takılar, belgeler, nakit para gibi değerli eşyaları kendiniz taşıyın</li>
</ol>

<h3>Taşınma Günü Kontrol Listesi</h3>
<ul>
  <li>☐ Tüm koliler hazır ve etiketli mi?</li>
  <li>☐ Buzdolabı bir gece önce boşaltılıp çözündürüldü mü?</li>
  <li>☐ Çamaşır ve bulaşık makinelerinin suyu kesildi mi?</li>
  <li>☐ Doğalgaz ve elektrik sayaçları okundu mu?</li>
  <li>☐ Anahtar teslimi planlandı mı?</li>
  <li>☐ Yeni evde temizlik yapıldı mı?</li>
</ul>

<h3>İstanbul'da Ev Taşıma Maliyetleri</h3>
<p>İstanbul'da ev taşıma maliyetini etkileyen faktörler:</p>
<ul>
  <li><strong>Eşya miktarı:</strong> Daire büyüklüğü ve mobilya sayısı</li>
  <li><strong>Mesafe:</strong> İlçeler arası mesafe</li>
  <li><strong>Kat sayısı:</strong> Asansörsüz binalarda kat başına ek ücret</li>
  <li><strong>Özel eşyalar:</strong> Piyano, antika, akvaryum gibi hassas eşyalar</li>
  <li><strong>Ek hizmetler:</strong> Ambalajlama, demontaj/montaj, temizlik</li>
</ul>

<h3>Profesyonel Destek Alın</h3>
<p>İstanbul'da stressiz bir taşınma deneyimi için <strong>İstanbul Aslan Hamal</strong>'ı tercih edin. Deneyimli ekibimiz eşyalarınızı özenle taşır.</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong> - Ücretsiz keşif ve fiyat teklifi</p>
`
  },

  {
    title: 'İstanbul Ofis Taşıma: İş Yerinizi Sorunsuz Taşıyın',
    slug: 'istanbul-ofis-tasima',
    focusKeyword: 'istanbul ofis taşıma',
    seoTitle: 'İstanbul Ofis Taşıma | Profesyonel İş Yeri Taşımacılığı',
    metaDescription: 'İstanbul\'da ofis taşıma hizmeti. Minimum iş kaybı, profesyonel ekip, sigortalı taşıma. İstanbul Aslan Hamal: 0541 684 85 18',
    tags: ['ofis taşıma', 'istanbul ofis taşıma', 'iş yeri taşıma', 'ofis nakliye'],
    excerpt: 'İstanbul\'da ofis taşıma hizmeti. İş süreçlerinizi minimum kesinti ile yeni ofisinize taşıyoruz.',
    content: `
<h2>İstanbul'da Profesyonel Ofis Taşıma</h2>
<p>Ofis taşıma, ev taşımadan çok daha fazla planlama ve koordinasyon gerektirir. İş süreçlerinin aksamaması, bilgisayar ve sunucu gibi hassas ekipmanların güvenliği ve çalışanların verimliliği göz önünde bulundurulmalıdır.</p>

<h3>Ofis Taşıma Sürecimiz</h3>
<ol>
  <li><strong>Ücretsiz keşif:</strong> Ofisinizi ziyaret eder, eşya envanteri çıkarır ve detaylı plan hazırlarız</li>
  <li><strong>Planlama:</strong> Taşınma takvimi, personel sayısı ve araç ihtiyacı belirlenir</li>
  <li><strong>Ambalajlama:</strong> Tüm ofis eşyaları profesyonelce paketlenir</li>
  <li><strong>Demontaj:</strong> Mobilyalar, bilgisayar masaları, raflar sökülür</li>
  <li><strong>Taşıma:</strong> Eşyalar güvenli araçlarla yeni adrese taşınır</li>
  <li><strong>Montaj ve yerleşim:</strong> Mobilyalar kurulur, eşyalar yerleştirilir</li>
</ol>

<h3>IT Ekipman Taşıma</h3>
<p>Ofis taşımanın en kritik aşamalarından biri bilişim ekipmanlarının güvenli taşınmasıdır:</p>
<ul>
  <li><strong>Bilgisayarlar:</strong> Anti-statik ambalaj ile paketleme</li>
  <li><strong>Sunucular:</strong> Özel kasalarda taşıma</li>
  <li><strong>Yazıcılar ve tarayıcılar:</strong> Orijinal ambalajları yoksa özel paketleme</li>
  <li><strong>Kablolama:</strong> Etiketleme ve düzenli sarma</li>
</ul>

<h3>Ofis Taşıma İpuçları</h3>
<ul>
  <li>Taşınmayı hafta sonu veya mesai saatleri dışında planlayın</li>
  <li>Çalışanlarınızı önceden bilgilendirin</li>
  <li>Tüm verilerin yedeklendiğinden emin olun</li>
  <li>Yeni ofisin altyapısını (elektrik, internet) önceden hazırlayın</li>
  <li>Müşterilerinize adres değişikliğini bildirin</li>
</ul>

<h3>Teklif Alın</h3>
<p>Ofisinizi taşımak mı istiyorsunuz? <strong>Ücretsiz keşif</strong> için hemen arayın!</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
`
  },

  {
    title: 'Asansörlü Eşya Taşıma: Yüksek Katlarda Güvenli Çözüm',
    slug: 'asansorlu-esya-tasima',
    focusKeyword: 'asansörlü eşya taşıma',
    seoTitle: 'Asansörlü Eşya Taşıma İstanbul | Dış Cephe Asansör Hizmeti',
    metaDescription: 'İstanbul\'da asansörlü eşya taşıma hizmeti. Yüksek katlara güvenli taşıma, dış cephe asansörü. Aslan Hamal: 0541 684 85 18',
    tags: ['asansörlü taşıma', 'asansörlü eşya taşıma', 'dış cephe asansörü', 'yüksek kat taşıma'],
    excerpt: 'Yüksek katlarda eşya taşıma sorunu yaşıyorsanız, asansörlü taşıma hizmetimiz tam size göre. Güvenli ve hızlı çözüm.',
    content: `
<h2>Asansörlü Eşya Taşıma Hizmeti</h2>
<p>İstanbul'da birçok bina yüksek katlı olmasına rağmen, bina asansörleri büyük eşyaların taşınması için yeterli değildir. <strong>Dış cephe asansörü</strong> ile eşyalarınızı güvenle ve hızla taşıyoruz.</p>

<h3>Asansörlü Taşıma Ne Zaman Gerekir?</h3>
<ul>
  <li>Bina asansörü olmadığında veya çok küçük olduğunda</li>
  <li>3 kattan yüksek binalarda büyük eşya taşıma</li>
  <li>Merdiven genişliği mobilya geçişine uygun olmadığında</li>
  <li>Koltuk takımı, yatak, buzdolabı gibi büyük parçaların taşınmasında</li>
  <li>Piyano veya kasa gibi ağır eşyaların yukarı/aşağı indirilmesinde</li>
</ul>

<h3>Dış Cephe Asansörü Nasıl Çalışır?</h3>
<p>Dış cephe asansörü, binanın dış cephesine kurulan ve eşyaları pencere veya balkondan içeri/dışarı alan özel bir platform sistemidir:</p>
<ol>
  <li>Binanın dış cephesine portatif asansör kurulur</li>
  <li>Eşyalar zemin kattan platforma yüklenir</li>
  <li>Platform motorlu sistem ile istenen kata çıkarılır</li>
  <li>Eşya pencere veya balkondan içeri alınır</li>
</ol>

<h3>Asansörlü Taşıma Avantajları</h3>
<ul>
  <li><strong>Hız:</strong> Merdivenden taşımaya göre 5-10 kat daha hızlı</li>
  <li><strong>Güvenlik:</strong> Eşyaların zarar görme riski minimum</li>
  <li><strong>Maliyet:</strong> İşçilik süresi kısaldığı için toplam maliyet düşer</li>
  <li><strong>Pratiklik:</strong> Merdivenden geçmeyen eşyalar kolayca taşınır</li>
</ul>

<h3>Hemen Arayın</h3>
<p>Asansörlü eşya taşıma hizmeti için <strong>İstanbul Aslan Hamal</strong>'ı arayın!</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
`
  },

  // ==================== FİYAT VE BİLGİ İÇERİKLERİ ====================
  {
    title: 'İstanbul Hamal Fiyatları 2025: Güncel Ücret Tarifesi',
    slug: 'istanbul-hamal-fiyatlari-2025',
    focusKeyword: 'istanbul hamal fiyatları',
    seoTitle: 'İstanbul Hamal Fiyatları 2025 | Güncel Ücret Tarifesi',
    metaDescription: 'İstanbul hamal fiyatları 2025 güncel tarife. Ev taşıma, eşya taşıma, ofis taşıma fiyatları. Ücretsiz teklif: 0541 684 85 18',
    tags: ['hamal fiyatları', 'istanbul hamal fiyatları', 'nakliye fiyatları', 'taşıma ücretleri', 'hamal ücretleri'],
    excerpt: '2025 yılı İstanbul hamal fiyatları güncel tarife tablosu. Ev taşıma, ofis taşıma ve eşya taşıma hizmetlerinde şeffaf fiyatlandırma.',
    content: `
<h2>İstanbul Hamal Fiyatları 2025</h2>
<p>İstanbul'da <strong>hamal fiyatları</strong>, birçok faktöre bağlı olarak değişiklik gösterir. Bu yazımızda 2025 yılı güncel hamal ücretlerini ve fiyatları etkileyen faktörleri detaylı olarak açıklıyoruz.</p>

<h3>Hamal Fiyatlarını Etkileyen Faktörler</h3>
<ul>
  <li><strong>Eşya miktarı:</strong> Taşınacak eşya ne kadar fazlaysa, gereken işçi sayısı ve araç büyüklüğü artar</li>
  <li><strong>Kat sayısı:</strong> Asansörsüz binalarda her kat ek maliyet oluşturur</li>
  <li><strong>Mesafe:</strong> İlçeler arası mesafe nakliye ücretini doğrudan etkiler</li>
  <li><strong>Mevsim:</strong> Yaz ayları ve ay sonları yoğun dönemlerdir</li>
  <li><strong>Özel eşyalar:</strong> Piyano, antika, büyük akvaryum gibi hassas eşyalar ek ücrete tabidir</li>
  <li><strong>Ek hizmetler:</strong> Ambalajlama, demontaj/montaj, depolama</li>
</ul>

<h3>2025 Güncel Hamal Fiyat Tablosu</h3>
<table>
  <tr><th>Hizmet Türü</th><th>Fiyat Aralığı (₺)</th></tr>
  <tr><td>Tek parça eşya taşıma</td><td>500 - 2.000</td></tr>
  <tr><td>Stüdyo / 1+0 ev taşıma</td><td>1.500 - 3.000</td></tr>
  <tr><td>1+1 ev taşıma</td><td>2.500 - 5.000</td></tr>
  <tr><td>2+1 ev taşıma</td><td>4.000 - 7.000</td></tr>
  <tr><td>3+1 ev taşıma</td><td>5.500 - 9.000</td></tr>
  <tr><td>4+1 ve üzeri ev taşıma</td><td>7.000 - 15.000</td></tr>
  <tr><td>Ofis taşıma (küçük)</td><td>3.000 - 6.000</td></tr>
  <tr><td>Ofis taşıma (büyük)</td><td>8.000 - 20.000</td></tr>
  <tr><td>Asansörlü taşıma (ek)</td><td>1.000 - 3.000</td></tr>
  <tr><td>Ambalajlama hizmeti</td><td>500 - 2.000</td></tr>
</table>

<p><em>* Yukarıdaki fiyatlar ortalama değerlerdir. Kesin fiyat, ücretsiz keşif sonrası belirlenir.</em></p>

<h3>Ucuz Hamal Fiyatı Tuzağına Düşmeyin</h3>
<p>Piyasada çok düşük fiyat veren firmalar olabilir. Ancak dikkat etmeniz gereken noktalar:</p>
<ul>
  <li>Sigortasız taşımacılık riski</li>
  <li>Gizli maliyetler (kat ücreti, mesafe farkı, bekleme ücreti)</li>
  <li>Deneyimsiz personel ve eşya hasarı riski</li>
  <li>Zamanında gelmeme veya yarım bırakma</li>
</ul>

<h3>Şeffaf Fiyat Garantisi</h3>
<p><strong>İstanbul Aslan Hamal</strong> olarak fiyatlarımız nettir. Keşif sonrası verilen fiyat değişmez. Gizli maliyet yoktur.</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong> - Ücretsiz keşif talep edin</p>
`
  },

  {
    title: 'Nakliye Firması Seçerken Dikkat Edilmesi Gereken 10 Kural',
    slug: 'nakliye-firmasi-secerken-dikkat-edilmesi-gerekenler',
    focusKeyword: 'nakliye firması seçimi',
    seoTitle: 'Nakliye Firması Seçerken Dikkat Edilmesi Gereken 10 Kural',
    metaDescription: 'Nakliye firması seçerken dikkat edilmesi gerekenler. Dolandırılmamak için 10 altın kural. İstanbul Aslan Hamal rehberi.',
    tags: ['nakliye firması', 'nakliye firması seçimi', 'güvenilir nakliye', 'nakliye ipuçları'],
    excerpt: 'Nakliye firması seçerken nelere dikkat etmelisiniz? Dolandırılmamak ve eşyalarınızı güvende tutmak için 10 önemli kural.',
    content: `
<h2>Nakliye Firması Seçerken 10 Altın Kural</h2>
<p>İstanbul'da yüzlerce nakliye firması bulunmaktadır. Doğru firmayı seçmek, eşyalarınızın güvenliği ve cüzdanınız için kritik önem taşır. İşte dikkat etmeniz gereken 10 kural:</p>

<h3>1. Firmanın Resmiyetini Kontrol Edin</h3>
<p>Vergi levhası, ticaret sicil kaydı ve K belgesi olan firmaları tercih edin. Kayıt dışı çalışan firmalar sorun yaşandığında hukuki süreç başlatmanızı zorlaştırır.</p>

<h3>2. Referans ve Yorumları İnceleyin</h3>
<p>Google yorumları, sosyal medya hesapları ve çevrenizdeki referansları kontrol edin. Sadece 5 yıldızlı yorumlara değil, olumsuz yorumlara verilen cevaplara da bakın.</p>

<h3>3. Ücretsiz Keşif İsteyin</h3>
<p>Güvenilir firmalar telefon ile fiyat vermek yerine, adresinize gelerek eşya tespiti yapar. <strong>Keşif yapmadan fiyat veren firmalardan uzak durun.</strong></p>

<h3>4. Yazılı Sözleşme Yapın</h3>
<p>Tüm hizmet detayları, fiyat, taşınma tarihi ve sorumluluklar yazılı sözleşmede belirtilmelidir. Sözlü anlaşmalardan kaçının.</p>

<h3>5. Sigorta Durumunu Sorun</h3>
<p>Taşıma sigortası olan firmalar, eşyalarınıza zarar gelmesi durumunda tazminat öder. Sigorta olmayan firmalarla çalışmak risk taşır.</p>

<h3>6. Çok Ucuz Tekliflere Dikkat</h3>
<p>Piyasanın çok altında fiyat veren firmalarda genellikle gizli maliyetler çıkar. Kat ücreti, mesafe farkı, bekleme ücreti gibi ek kalemler eklenebilir.</p>

<h3>7. Araç ve Ekipman Durumunu Sorun</h3>
<p>Temiz, bakımlı araçlar ve yeterli ambalaj malzemesi kullanan firmaları tercih edin.</p>

<h3>8. Deneyim ve Uzmanlık</h3>
<p>Sektörde en az 3-5 yıllık deneyime sahip firmaları tercih edin. Deneyimli firmalar olası sorunlara daha hızlı çözüm üretir.</p>

<h3>9. İletişim Kalitesine Dikkat Edin</h3>
<p>Telefonunuza cevap veren, sorularınızı sabırla yanıtlayan ve şeffaf bilgi paylaşan firmaları seçin.</p>

<h3>10. Ödeme Koşullarını Netleştirin</h3>
<p>Ödemenin ne zaman ve nasıl yapılacağını önceden belirleyin. Tamamını peşin isteyen firmalara dikkat edin - genellikle yarısı başlangıçta, yarısı teslimatta ödenir.</p>

<h3>İstanbul Aslan Hamal Farkı</h3>
<p>Biz <strong>İstanbul Aslan Hamal</strong> olarak yukarıdaki tüm kriterleri karşılıyoruz. Ücretsiz keşif, yazılı sözleşme, sigortalı taşıma ve şeffaf fiyat politikamızla hizmetinizdeyiz.</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
`
  },

  {
    title: 'Eşya Paketleme ve Ambalajlama İpuçları',
    slug: 'esya-paketleme-ambalajlama-ipuclari',
    focusKeyword: 'eşya paketleme',
    seoTitle: 'Eşya Paketleme İpuçları | Taşınırken Ambalajlama Rehberi',
    metaDescription: 'Taşınırken eşya paketleme ve ambalajlama ipuçları. Kırılacak eşyalar, elektronik cihazlar, giysiler için paketleme teknikleri.',
    tags: ['eşya paketleme', 'ambalajlama', 'taşınma ipuçları', 'koli paketleme'],
    excerpt: 'Taşınırken eşyalarınızı doğru paketlemek, hasarsız taşınmanın anahtarıdır. İşte profesyonel paketleme ipuçları.',
    content: `
<h2>Eşya Paketleme ve Ambalajlama Rehberi</h2>
<p>Taşınma sürecinde eşyalarınızın hasarsız ulaşması, doğru paketleme ile başlar. Bu rehberde her eşya türü için profesyonel paketleme tekniklerini paylaşıyoruz.</p>

<h3>Gerekli Ambalaj Malzemeleri</h3>
<ul>
  <li>Farklı boyutlarda koliler</li>
  <li>Balonlu ambalaj (patpat)</li>
  <li>Streç film</li>
  <li>Koli bandı (geniş ve dayanıklı)</li>
  <li>Gazete kağıdı veya ambalaj kağıdı</li>
  <li>Etiket ve marker kalem</li>
  <li>Makas ve maket bıçağı</li>
</ul>

<h3>Kırılacak Eşyaların Paketlenmesi</h3>
<p><strong>Tabak ve kaseler:</strong> Her birini ayrı ayrı gazete kağıdına sarın. Koliye dik olarak (kenarlığı üstte) yerleştirin. Kolinin altına ve üstüne balonlu ambalaj koyun.</p>
<p><strong>Bardaklar:</strong> İçini gazete ile doldurun, dışını sarın. Koli içinde dik konumda olmalı.</p>
<p><strong>Cam eşyalar:</strong> Çift kat balonlu ambalaj kullanın. Kolinin her tarafına "KIRILACAK" yazın.</p>

<h3>Elektronik Cihazların Paketlenmesi</h3>
<p><strong>Televizyon:</strong> Orijinal kutusu varsa ideal. Yoksa balonlu ambalaj ile sarıp, köşeleri köpükle destekleyin.</p>
<p><strong>Bilgisayar:</strong> Hard diskleri mümkünse çıkarıp ayrı taşıyın. Monitörü balonlu ambalaj ile koruyun.</p>
<p><strong>Küçük elektronikler:</strong> Kabloları etiketleyip cihazla birlikte poşetleyin.</p>

<h3>Giysilerin Paketlenmesi</h3>
<ul>
  <li><strong>Askılı giysiler:</strong> Gardrop kutusu kullanın veya askıda bırakıp üzerini çöp poşeti ile örtün</li>
  <li><strong>Katlanabilir giysiler:</strong> Kolilere düzenli şekilde yerleştirin</li>
  <li><strong>Ayakkabılar:</strong> İçlerine kağıt doldurun, çiftler birlikte poşete koyun</li>
</ul>

<h3>Mobilyaların Korunması</h3>
<p>Mobilyalar streç film ile sarılmalıdır. Cam yüzeyler karton ile kaplanmalı, köşeler köşe koruyucu ile desteklenmelidir.</p>

<h3>Profesyonel Ambalajlama Hizmeti</h3>
<p>Paketleme ile uğraşmak istemiyorsanız, <strong>İstanbul Aslan Hamal</strong> profesyonel ambalajlama hizmeti sunmaktadır. Tüm eşyalarınızı uzman ekibimiz paketler.</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
`
  },

  {
    title: 'İstanbul\'da Nakliye ve Taşımacılık Hizmetleri',
    slug: 'istanbul-nakliye-tasimaclik-hizmetleri',
    focusKeyword: 'istanbul nakliye',
    seoTitle: 'İstanbul Nakliye ve Taşımacılık | Profesyonel Hizmet',
    metaDescription: 'İstanbul\'da profesyonel nakliye ve taşımacılık hizmeti. Ev, ofis, eşya taşıma. Sigortalı, güvenli. Aslan Hamal: 0541 684 85 18',
    tags: ['istanbul nakliye', 'istanbul taşımacılık', 'nakliye hizmeti', 'taşımacılık'],
    excerpt: 'İstanbul genelinde nakliye ve taşımacılık hizmetleri. Ev taşıma, ofis taşıma, eşya depolama ve daha fazlası.',
    content: `
<h2>İstanbul'da Nakliye ve Taşımacılık</h2>
<p><strong>İstanbul Aslan Hamal</strong> olarak İstanbul'un tüm ilçelerinde profesyonel nakliye ve taşımacılık hizmeti sunuyoruz. Deneyimli ekibimiz, modern araç filomuz ve müşteri memnuniyeti odaklı hizmet anlayışımızla İstanbul'un güvenilir taşımacılık firmasıyız.</p>

<h3>Hizmetlerimiz</h3>

<h4>Ev Taşıma</h4>
<p>Stüdyo daireden villaya kadar her büyüklükte ev taşıma hizmeti. Eşyalarınız sigortalı olarak, özenle taşınır.</p>

<h4>Ofis Taşıma</h4>
<p>İş yerinizi minimum kesinti ile yeni adresine taşıyoruz. IT ekipmanları dahil tüm ofis eşyalarınız güvende.</p>

<h4>Eşya Taşıma</h4>
<p>Tek parça eşya taşıma hizmeti. Buzdolabı, çamaşır makinesi, koltuk takımı, piyano ve daha fazlası.</p>

<h4>Ambalajlama</h4>
<p>Profesyonel ambalajlama ekibimiz eşyalarınızı özenle paketler. Kırılacak eşyalar özel koruma altına alınır.</p>

<h4>Depolama</h4>
<p>Geçici depolama ihtiyacınız mı var? Güvenli ve kuru depolama alanlarımızda eşyalarınızı saklayabilirsiniz.</p>

<h4>Asansörlü Taşıma</h4>
<p>Yüksek katlı binalarda dış cephe asansörü ile güvenli taşıma. Merdivenlerden geçmeyen eşyalar için ideal çözüm.</p>

<h3>Hizmet Bölgelerimiz</h3>
<p>İstanbul'un <strong>tüm ilçelerinde</strong> hizmet veriyoruz:</p>
<p><strong>Avrupa Yakası:</strong> Arnavutköy, Avcılar, Bağcılar, Bahçelievler, Bakırköy, Başakşehir, Bayrampaşa, Beşiktaş, Beylikdüzü, Beyoğlu, Büyükçekmece, Çatalca, Esenler, Esenyurt, Eyüpsultan, Fatih, Gaziosmanpaşa, Güngören, Kağıthane, Küçükçekmece, Sarıyer, Silivri, Sultangazi, Şişli, Zeytinburnu</p>
<p><strong>Anadolu Yakası:</strong> Adalar, Ataşehir, Beykoz, Çekmeköy, Kadıköy, Kartal, Maltepe, Pendik, Sancaktepe, Sultanbeyli, Şile, Tuzla, Ümraniye, Üsküdar</p>

<h3>7/24 Hizmetinizdeyiz</h3>
<p>Acil taşınma ihtiyacınız mı var? 7 gün 24 saat hizmet veriyoruz.</p>
<p>📞 <strong><a href="tel:05416848518">0541 684 85 18</a></strong></p>
<p>🌐 <a href="https://istanbulaslanhamal.com">istanbulaslanhamal.com</a></p>
`
  },
];

// ============================================================
// WORDPRESS API İSTEMLERİ
// ============================================================

async function apiRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${CONFIG.siteUrl}/wp-json/aslan/v1/${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Aslan-Key': CONFIG.apiKey,
  };

  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Hatası (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function testConnection() {
  console.log('🔄 API bağlantısı test ediliyor...');
  const status = await apiRequest('status');
  console.log('✅ Bağlantı başarılı!');
  console.log(`   Site: ${status.site}`);
  console.log(`   URL: ${status.url}`);
  console.log(`   WP: ${status.wp_version}`);
  console.log(`   Mevcut yazı sayısı: ${status.post_count}`);
  return status;
}

async function ensureCategories() {
  console.log('\n📁 Kategoriler kontrol ediliyor...');

  const categories = [
    { name: 'Nakliye', slug: 'nakliye', description: 'Nakliye ve taşımacılık yazıları' },
    { name: 'Hamal Hizmeti', slug: 'hamal-hizmeti', description: 'Hamal hizmeti ile ilgili yazılar' },
    { name: 'Taşınma Rehberi', slug: 'tasinma-rehberi', description: 'Taşınma ipuçları ve rehber yazıları' },
    { name: 'Fiyat Bilgisi', slug: 'fiyat-bilgisi', description: 'Hamal ve nakliye fiyat bilgileri' },
  ];

  const categoryIds: Record<string, number> = {};

  for (const cat of categories) {
    const result = await apiRequest('create-category', 'POST', cat);
    categoryIds[cat.slug] = result.category_id;
    console.log(`   ${result.already_exists ? '✓' : '+'} ${cat.name} (ID: ${result.category_id})`);
  }

  return categoryIds;
}

async function createPost(post: BlogPost, categoryIds: number[]) {
  const result = await apiRequest('create-post', 'POST', {
    title: post.title,
    content: post.content.trim(),
    slug: post.slug,
    status: CONFIG.publishStatus,
    categories: categoryIds,
    tags: post.tags,
    excerpt: post.excerpt,
    meta_description: post.metaDescription,
    focus_keyword: post.focusKeyword,
    seo_title: post.seoTitle,
  });

  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  İSTANBUL ASLAN HAMAL - Blog Üretim Sistemi');
  console.log('═══════════════════════════════════════════════════\n');

  if (!CONFIG.apiKey) {
    console.error('❌ HATA: WP_API_KEY ortam değişkeni ayarlanmamış!');
    console.error('   Kullanım: WP_API_KEY=xxx npx tsx generate-blogs.ts');
    process.exit(1);
  }

  // 1. Bağlantı testi
  await testConnection();

  // 2. Kategorileri oluştur
  const categoryIds = await ensureCategories();

  // 3. Blog yazılarını gönder
  console.log(`\n📝 ${blogPosts.length} blog yazısı gönderiliyor...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < blogPosts.length; i++) {
    const post = blogPosts[i];

    // Yazıya uygun kategorileri belirle
    const postCategories = [1]; // Blog (default)
    if (post.focusKeyword.includes('hamal')) postCategories.push(categoryIds['hamal-hizmeti']);
    if (post.focusKeyword.includes('nakliye') || post.focusKeyword.includes('taşıma')) postCategories.push(categoryIds['nakliye']);
    if (post.focusKeyword.includes('fiyat')) postCategories.push(categoryIds['fiyat-bilgisi']);
    if (post.slug.includes('rehber') || post.slug.includes('ipuc') || post.slug.includes('dikkat')) postCategories.push(categoryIds['tasinma-rehberi']);

    try {
      const result = await createPost(post, postCategories);
      success++;
      console.log(`  ✅ [${i + 1}/${blogPosts.length}] "${post.title}"`);
      console.log(`     → ${result.url}`);
      console.log(`     → Durum: ${result.status} | ID: ${result.post_id}`);
    } catch (error: any) {
      failed++;
      console.log(`  ❌ [${i + 1}/${blogPosts.length}] "${post.title}"`);
      console.log(`     → Hata: ${error.message}`);
    }

    // Rate limiting - 1 saniye bekle
    if (i < blogPosts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Sonuç özeti
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  SONUÇ: ${success} başarılı, ${failed} başarısız`);
  console.log(`  Durum: ${CONFIG.publishStatus === 'draft' ? 'TASLAK olarak kaydedildi' : 'YAYINLANDI'}`);
  if (CONFIG.publishStatus === 'draft') {
    console.log('  Not: Yazıları yayınlamak için WordPress admin panelini kullanın');
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch(error => {
  console.error('❌ Kritik hata:', error.message);
  process.exit(1);
});

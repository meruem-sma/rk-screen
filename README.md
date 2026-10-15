# RK Screen — Beta 1

Windows x64 için Türkçe ekran paylaşımı ve uzaktan destek. Güncel yapı **20261015.1**;
tek yayın sürümü **1.0.0-beta.1**. MIT lisansıyla açık kaynak. Koyu arayüz ve RK monogramı.

[Güncel durum ve açık işler](GUNCEL-DURUM.md) ·
[Kurulum indirmesi](https://github.com/meruem-sma/rk-screen-downloads/releases/tag/v1.0.0-beta.1) ·
[Site](https://rkscreen.com.tr/) · [Gizlilik](PRIVACY.md) · [Güvenlik bildirimi](SECURITY.md)

## Kullanım

1. İki bilgisayara da güncel Beta 1 setup'ını kurun. Eski Beta 1 yapılarıyla bağlantı kurulmayabilir; yapı numarası iki tarafta **20261015.1** olmalıdır.
2. Karşı bilgisayarın dokuz haneli kimliğini girin. Ekranını paylaşan kişi monitörü ve izinleri seçip isteği kabul eder. Kontrol, pano ve ses ayrı izinlerdir.
3. Her iki taraftaki bağlantı doğrulama kodunu başka bir güvenilir iletişim yoluyla karşılaştırın. Kodlar farklıysa bağlantıyı bitirin. Görünen bilgisayar adı tek başına kimlik kanıtı değildir.
4. Fare/klavye izni verildiyse araç çubuğunda **Fare ve klavye** seçip uzak ekrana tıklayın. **Yalnızca izle** modunda girdi gönderilmez.
5. Başlangıç için **Otomatik**, küçük yazılar için **Net metin** kullanın. **1:1 piksel** fiziksel piksel gösterir; **Ekrana sığdır** en-boy oranını korur. Uzak Windows ekran çözünürlüğü değiştirilmez. FPS hedefi gerçek FPS garantisi değildir.
6. Sohbette Enter gönderir, Shift+Enter satır açar. Teslim edilemeyen mesaj yeniden gönderilebilir. Dosyalar alıcının açık onayıyla İndirilenler'e kaydedilir.
7. Paylaşan kişi ekranı değiştirebilir, kontrol iznini kaldırabilir veya oturumu bitirebilir. Ayarlardan yeni bağlantı istekleri kapatılabilir.

## Bağlantı ve kalite

PeerJS Cloud sinyalleşmesi ve Google/Cloudflare STUN ile doğrudan bağlantı kullanılır.
Çalışan varsayılan TURN yoktur. Bazı ağ çiftleri geçerli relay olmadan bağlanamaz.
Ayarlardaki ağ testi ekran paylaşmadan bağlantı adaylarını kontrol eder; başka bir
cihazla oturum kurulacağını kanıtlamaz. İsteğe bağlı TURN parolası Windows safeStorage
ile şifrelenir; aynı kimlik bilgileriyle dört UDP/TCP/TLS adresi girilebilir.

Otomatik kalite zayıf bağlantıda önce kare hızını, daha sonra kontrollü ölçekte görüntü
boyutunu azaltır. Profil tavanı düşük ağ tahminine tekrar tekrar kırpılmaz. Fare/imleç
paketleri ayrı hızlı kanalda taşınır. Kısa görüntü kesintilerinde ilk yeni kareye kadar
girdi bekletilir. Uzun kesintilerde sınırlı yeniden kurma vardır. Veri oturumu kapanırsa
eski onayla yeni bağlantı açılmaz. Tuş/fare tutmaları karşı taraf etkinliği kesilince bırakılır.

**Rapor kaydet**, son bağlantı/kalite ölçümlerini yerel JSON'a yazar. Ekran, sohbet,
IP adresi, cihaz adı/kimliği, dosya içeriği ve parolalar rapora alınmaz. Otomatik gönderim yoktur.

## Kurulum ve kaldırma

Yayın setup EXE'dir; kullanıcı hesabına kurulur. Kaldırma Windows'un yüklü uygulamalar
listesinden yapılır. Kullanıcı verileri ve alınan dosyalar sürüm temizliğinde silinmez.
Yeni setup'ı kurmak eski uygulama dosyalarını yeniler; kurulu cihazlar kendiliğinden güncellenmez.

Paket **imzasızdır**. Bakım sorumlusu bunu bilerek ücretsiz beta dağıtımına devam edilmesini
istedi. Windows Akıllı Uygulama Denetimi dosyayı engelleyebilir. Setup biçimi bu güven
kontrolünü kaldırmaz. Windows korumalarını kapatan, sertifika yükleyen veya engeli aşan
bir kod eklenmez. Ücretli sertifika/hizmet ve başvuru zorunluluğu getirilmez.

## Geliştirme ve paketleme

Windows x64, Node.js 22.12+:

```powershell
npm ci
npm start
npm run release:beta
```

Son komut birim, arayüz, gerçek yerel WebRTC, açılış, işaretçi ve Windows yakalama
testlerini çalıştırır; ardından imzasız setup üretip paket içeriğini kontrol eder.
Çıktı `review/setup-candidate/1.0.0-beta.1/` içindedir. Doğrulanmış yayın kopyası
`dist/1.0.0-beta.1/` altında saklanır. Kaynak derleme iş akışı aynı ücretsiz beta
paketini GitHub artifact olarak üretir; otomatik herkese açık yayın yapmaz.

İmzalı dağıtım için ayrı `npm run release` ve `npm run dist:setup` hattı korunur;
gerçek imzalama kimliği olmadan bu hat durur. Beta hattı dosyayı imzalı göstermez.

## Sınırlar

Kullanıcının farklı internetlerde yaptığı kalite denemesi iyi değildi; yeni yapı bu
şikâyetleri hedefler fakat aynı fiziksel koşullarda tekrar test edilmelidir. Sabit 60 FPS,
her NAT'ta erişim veya AnyDesk/TeamViewer düzeyi güvenilirlik iddiası yoktur.
Kalıcı cihaz kimliği doğrulaması, bağımsız güvenlik denetimi, kesintiden devam eden dosya
aktarımı, otomatik uygulama güncellemesi ve UAC yardımcı servisi tamamlanmış değildir.
Gözetimsiz erişim yoktur. Önceki planlar tarihsel kayıttır; güncel liste [buradadır](GUNCEL-DURUM.md).

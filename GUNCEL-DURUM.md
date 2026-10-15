# RK Screen — Beta 1

15 Ekim 2026. Tek yayın sürümü `1.0.0-beta.1`; yeni MVP yapısı `20261015.2`.
Beta 2 adıyla hazırlanan geliştirmeler bu Beta 1 güncellemesine alındı. Eski sürüm
notları kaldırıldı; güncel yayın durumu ve açık işler bu belgede tutulur.

## Tamamlanan işler

- Windows x64 için kullanıcı hesabına kurulan, Windows Ayarlar'dan kaldırılabilen NSIS setup.
- RK monogramı; uygulama penceresi, kurulum, kısayol ve site için ortak PNG/ICO.
- Otomatik kalite: 60 FPS üst hedefi; uzun bant genişliği kısıtında önce 30, sonra 15,
  ardından 8 FPS hedefi. İlk kademede tam boyut korunur; sonraki kademelerde izin verilen
  profillerde 1080p kaynak en çok 720p'ye ölçeklenir. Net metin profili tam boyutu korur.
  Beş iyi ölçümle tek kademe toparlanır. WebRTC'nin gerçek bit hızı denetimi korunur;
  düşük kapasite tahmini tekrar tekrar bitrate tavanına çevrilmez.
- Ayrı hızlı fare/imleç kanalı, iki isimli görsel işaretçi ve hareketsiz işaretçinin görünürlüğü.
- AltGr/Türkçe Unicode, kesintide basılı tuş/fare bırakma ve kontrollü medya toparlanması.
- Oturumun iki DTLS sertifika parmak izinden türetilen ortak doğrulama kodu. Kod iki tarafta
  başka bir güvenilir iletişim yoluyla karşılaştırılmalıdır. Cihaz adı doğrulanmış kimlik değildir;
  kodu yalnızca ekranda göstermek otomatik kimlik doğrulaması sayılmaz.
- Ekran paylaşmadan ağ testi: yerel, STUN ve varsa TURN adayları; IP/parola içermeyen rapor.
- Yapılandırılmış TURN için aynı kimlik bilgileriyle en çok dört UDP/TCP/TLS uç noktası.
- Dosya aktarımında ortalama hız ve yaklaşık kalan süre; alıcı onayı ve SHA-256 korunur.
- Her dosya parçasında tam ağ turunu tek tek beklemek yerine en fazla üç adet 32 KiB parça
  birlikte gönderilir. Gönderici belleği ve alıcı iş kuyruğu sınırlıdır; alındı onayları
  bitmeden dosya sonu gönderilmez. İptal/kopma bekleyen parçaları kapatır.
- Dosya adlarında yön gizleyen Unicode/kontrol karakterleri güvenli adlara dönüştürülür.
- Derleme zincirindeki `http-cache-semantics` ve `global-agent` alt bağımlılıkları, API
  uyumluluğu kontrol edilerek sabitlendi. 15 Ekim npm taraması: tüm bağımlılıklarda
  bildirilen açık sayısı 0. Bu, bağımsız güvenlik denetimi veya sıfır risk garantisi değildir.

## Ücretsiz dağıtım kararı

Bakım sorumlusu, imzasız setup'ın Windows tarafından engellenebileceğini bilerek 15 Ekim'de
bu yolla yayına devam edilmesini istedi. Sertifika/ücretli hizmet/başvuru satın alınmaz;
Windows korumaları değiştirilmez. Paket imzalıymış gibi gösterilmez. Kaynak/test/paket ve
GitHub boyut/SHA-256 eşleşmesi doğrulandıktan sonra aynı Beta 1 indirmesi yenilenir.
Kurulu uygulamalar kendiliğinden güncellenmez; iki cihaz da yeni setup'ı kurmalıdır.

## Açık teknik sınırlar

- **Çalışan ücretsiz TURN doğrulanamadı.** 15 Ekim'de resmî OpenRelay static-auth ve
  freeSTUN genel kimlik bilgileriyle relay-only veri yankı testi denendi: ikisinde de
  relay adayı ve veri yankısı yoktu. Eski/çalışmayan genel bilgiler pakete eklenmez.
  Doğrudan bağlantının mümkün olmadığı ağ çiftleri için geçerli bir aktarma hizmeti hâlâ gerekir.
  InfinityFree statik site/GitHub indirme barındırması bu hizmetin yerini almaz.
- Kullanıcının farklı internetlerde yaptığı saha testinde kalite kötüydü. Yeni değişiklikler
  bu şikâyeti hedefler; iki gerçek bilgisayarda yeni yapıyla tekrar ölçülmeden giderildiği söylenmez.
- Sabit 60 FPS, her bağlantıda tam netlik ve kesintisizlik garanti edilmez.
- Bağımsız güvenlik denetimi, özel sinyal altyapısı, kalıcı doğrulanmış cihaz eşleştirmesi,
  dosya aktarımında kesintiden devam, uygulama içi otomatik güncelleme ve UAC yardımcı
  servisi tamamlanmış değildir. Onaysız/gözetimsiz erişim yoktur.

## Test kapsamı

Birim testleri; gerçek yerel PeerJS/WebRTC ile ekran, aynı doğrulama kodu, kalite ayarları,
iki imleç, kesinti, sohbet, dosya, monitör geçişi; Windows arayüz/açılış/gerçek yakalama ve
paket içerik testleri uygulanır. Yerel test ile farklı internetlerde saha testi birbirinin
yerine geçmez. Testler kullanıcının gerçek masaüstüne tuş/fare basmaz.

## İlk fiziksel test

İki cihazda **Beta 1 · 20261015.2** kurun. Aynı doğrulama kodunu gördüğünüzü kontrol edin.
Önce Otomatik, sonra Net metin profilini aynı hareketli içerikle karşılaştırın. Her iki taraftan
Rapor kaydet ile ölçüm alın; doğrudan/aktarma rotası, çözünürlük, gerçek FPS, gecikme/kayıp
ve donma anını birlikte inceleyin. Yalnızca düşük FPS, hareketsiz masaüstünde tek başına hata değildir.

## Ücretsiz MVP çalışma planı — 15 Ekim 2026

Bütçe sıfırdır. Yeni hesap, hizmet başvurusu veya ücretli sertifika gerektiren bir
adım uygulanmaz. Tek sürüm adı **Beta 1 / 1.0.0-beta.1** olarak kalır; güncellemeler
yapı numarasıyla ayrılır. Eski paket ancak yenisi doğrulandıktan sonra kaldırılır.
Kullanıcı dosyaları, kurulu ayarlar ve alınmış dosyalar temizliğe dahil değildir.

### Bu MVP'de uygulananlar

- [x] İnternet yok, cihaz bulunamadı, istek reddi/kapalı/busy, sürüm uyumsuzluğu,
  ekran yakalama, hizmet ve doğrudan bağlantı hataları için neden/çözüm açıklamaları.
- [x] İki görsel imleç: ekran sahibinin son yerel konumu uzaktan hareketten ayrı
  korunur; kontrol sırasında paylaşan masaüstünde de yerel konum işaretçisi gösterilir.
  Windows tek gerçek sistem imleci kullanır; bunlar iki bağımsız görsel işaretçidir.
- [x] Yerel fare hareketi algılanınca uzak fare **ve klavye** 1,2 saniyelik sessizlik
  süresine kadar bekletilir. Ekran sahibi kontrolü ayrıca elle duraklatabilir.
  Bu, tüm uygulamalardaki fiziksel klavyeyi izleyen bir genel klavye kancası değildir.
- [x] Yalnızca işaretle modu ve tıklama üretmeyen geçici konum vurgusu. Serbest çizim
  bu ilk MVP'ye dahil değildir. İşaretçi iznini ekran sahibi yönetir.
- [x] Süren kayıp/gecikme birlikte görüldüğünde FPS hedefinin azaltılması; bitrate
  tavanının önceki düzeltmesi korunur. Sadece yüksek gecikme kaliteyi düşürmez.
- [x] Dosya gönderiminde görüntüye öncelik: tahmini kapasitenin dörtte biri,
  64 kbit/sn–2 Mbit/sn arasında dosya gönderim bütçesi. Kullanıcı arayüzü gerçek
  aktarım hızını gösterir. Ağ tahmini bağımsız hız testi değildir.
- [x] Donma sayısı/süresi destekleniyorsa rapora eklenir. Rapor yapı numarası taşır.
- [x] En fazla 20 dosyalık gönderim kuyruğu; dosya başına en çok 512 MB, her dosyada
  ayrı alıcı onayı. Kuyruk dosya içeriğini belleğe yüklemez. Dosya değişirse durur.
- [x] Sohbette arama, mesaj kopyalama, kullanıcı isteğiyle yerel metin dışa aktarma.
- [x] Cihaz favorileri, yerel adlandırma, tek tek silme; geçmiş temizliğinde favorileri
  koruma ve ayrıca tüm cihazları temizleme. Favori olmak onayı atlatmaz.
- [x] Ayarlar'dan GitHub yapı güncelliği kontrolü. Yalnızca sabit güvenilir depo adresi
  kabul edilir; süre/boyut sınırı vardır. Kullanıcı isteğiyle indirme açılır;
  otomatik kurulum veya imzalıymış gibi gösterme yoktur.
- [x] Oturum mesaj hız sınırları; aşırı fare/sohbet trafiği sınırlanır. Girdi bırakma
  komutu sınır dolduğunda da çalışır. Dosya parça onayları sayısal olarak doğrulanır.

### Yayın kabulü

1. Birim, arayüz, yerel gerçek WebRTC, işaretçi, Windows ana süreç/ekran yakalama ve
   açılış testleri. Çoklu dosyada her alıcı onayı, dosya özeti ve ters yönde boş dosya.
2. Aday setup oluşturma ve paket içeriğini kaynakla karşılaştırma. Doğrulanmış yeni
   setup ile SHA-256 birlikte yayımlanır; sonra eski yerel çıktı kaldırılır.
3. **Ayrı temiz Windows 10/11 kurulumu, gerçek eski sürüm üzerine yükseltme ve kaldırma
   henüz tamamlanmış kabul edilmez.** Bu bilgisayarda kaynak testleri bunların yerine geçmez.
4. Yarın iki fiziksel cihazda aynı yeni yapıyı kurup Otomatik/Net metin karşılaştırın.
   Her profilde 2 dakika küçük yazı, kaydırma ve hareketli içerik; ayrıca dosya gönderirken
   görüntü, iki imleç, kontrolü duraklatma, Türkçe yazı ve bağlantıyı bitirme.
   İki taraftan Rapor kaydet çıktısı alın. Aynı koşullardaki önceki yapıyla kıyaslayın.

### Altyapı ve sonraki aşama

- [ ] **Farklı internetlerde her ağ için bağlantı:** çalışan varsayılan TURN hâlâ
  yoktur. Ücretsiz Coturn yazılımı vardır; internetten erişilebilen bir makine ve
  trafik gerekir. OpenRelay'in normal ücretsiz hizmeti hesap ister; bu kısıtla
  başvuru yapılmaz. Çalışmayan genel kimlik bilgileri varsayılan pakete eklenmez.
  Doğrudan bağlantı mümkünse mevcut sinyal/STUN yolu kullanılır. Uygulama veya
  statik InfinityFree/GitHub sitesi tek başına aktarma sunucusu sağlamaz.
- [ ] Kopan dosyayı güvenli biçimde devam ettirme, serbest çizim, kalıcı cihaz
  eşleştirme/anahtar iptali ve bağımsız güvenlik incelemesi sonraki aşamadadır.
- [ ] Uyku/uyanma, Wi-Fi değişimi, Türkçe Q/F ve karma DPI/çoklu monitörde fiziksel test.
- [ ] Canlı site: 15 Ekim erişim denemesinde HTTPS bağlantısı kapanıyor ve HTTP boş
  yanıt döndürüyor. Geçerli sertifika, CSS ve yönlendirme bu denemede doğrulanamadı.
  Hosting hesabına erişim olmadan sunucu ayarı değiştirilemez; yerel ZIP ayrı test edilir.

Kaynaklar: [WebRTC TURN](https://webrtc.org/getting-started/turn-server),
[OpenRelay](https://www.metered.ca/tools/openrelay/), [freeSTUN](https://freestun.net/),
[WebRTC](https://www.w3.org/TR/webrtc/).

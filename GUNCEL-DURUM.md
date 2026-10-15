# RK Screen — Beta 1

15 Ekim 2026. Tek yayın sürümü `1.0.0-beta.1`; güncel yapı `20261015.1`.
Beta 2 adıyla hazırlanan geliştirmeler bu Beta 1 güncellemesine alındı. Önceki
belgelerdeki sürüm adları tarihsel kayıttır; güncel yayın durumu bu belgedir.

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
  dosya aktarımında kesintiden devam/kuyruk, uygulama içi otomatik güncelleme ve UAC yardımcı
  servisi tamamlanmış değildir. Onaysız/gözetimsiz erişim yoktur.

## Test kapsamı

Birim testleri; gerçek yerel PeerJS/WebRTC ile ekran, aynı doğrulama kodu, kalite ayarları,
iki imleç, kesinti, sohbet, dosya, monitör geçişi; Windows arayüz/açılış/gerçek yakalama ve
paket içerik testleri uygulanır. Yerel test ile farklı internetlerde saha testi birbirinin
yerine geçmez. Testler kullanıcının gerçek masaüstüne tuş/fare basmaz.

## İlk fiziksel test

İki cihazda **Beta 1 · 20261015.1** kurun. Aynı doğrulama kodunu gördüğünüzü kontrol edin.
Önce Otomatik, sonra Net metin profilini aynı hareketli içerikle karşılaştırın. Her iki taraftan
Rapor kaydet ile ölçüm alın; doğrudan/aktarma rotası, çözünürlük, gerçek FPS, gecikme/kayıp
ve donma anını birlikte inceleyin. Yalnızca düşük FPS, hareketsiz masaüstünde tek başına hata değildir.

Kaynaklar: [WebRTC TURN](https://webrtc.org/getting-started/turn-server),
[OpenRelay](https://www.metered.ca/tools/openrelay/), [freeSTUN](https://freestun.net/),
[WebRTC](https://www.w3.org/TR/webrtc/).

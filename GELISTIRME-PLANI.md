# RK Screen — güvenilir bağlantı ve kullanım planı

Tarih: 16 Ekim 2026. Durum: ilk uygulama adımı yerel kaynakta hazır; A0/A1/A2 kısmen uygulandı, saha kabulü ve diğer aşamalar sürüyor.

Başlangıç: `1.0.0-beta.1`, yerel yapı `20261016.2`. Son yerel durum belgesine göre genel indirme `20261016.1`; bu plan hazırlanırken canlı indirme tekrar denetlenmedi veya değiştirilmedi.

## 1. Ürün hedefi ve kapsam

Kullanıcı onayıyla iki Windows bilgisayarı arasında ekran paylaşımı, anlaşılır fare/klavye kontrolü, iki isimli işaretçi, sohbet ve dosya aktarımı. Öncelik mevcut özelliklerin güvenilir olmasıdır. Görsel düzen koyu ve sade kalır.

İlk destek kapsamı Windows 10/11 x64. Bu kapsam içindeki farklı donanımlar da ayrı ayrı doğrulanmalıdır. Windows 7/8, 32 bit, ARM64 yerel sürüm, macOS ve Linux bu çalışma ile desteklenmiş sayılmaz.

Geliştirme ücretsiz araçlarla yapılır. Yeni ücretli hizmet, hesap başvurusu veya abonelik bu planın bağımlılığı değildir. Buna karşılık ücretsiz yazılım, ücretsiz ve sınırsız sunucu kapasitesi anlamına gelmez. Çalışan bir aktarma altyapısı bulunmadan farklı bütün ağlarda bağlantı sözü verilmez.

60 FPS, uygun cihaz ve ağda hareketli içerik için ölçülecek hedeftir. Durağan masaüstünde gereksiz kare göndermek başarı ölçütü değildir. Zayıf bağlantıda kontrolün yanıt vermesi ve metnin okunabilmesi, sayı olarak 60 FPS göstermenin önündedir.

Bu belge uygulama kodunu, bağımlılıkları veya yayın dosyalarını değiştirmez. İlerleme tek bu plandan izlenir; her aşama için ayrı eski plan kopyaları oluşturulmaz.

## 2. İncelenen yapı ve mevcut kanıt

| Alan | Kaynaklar | Mevcut durum |
| --- | --- | --- |
| Ana süreç ve Windows girdisi | `src/main.js`, `src/preload.js`, `src/input/injector.js`, `src/input/packets.js` | IPC/rol/izin kontrolleri ve Windows SendInput var. Bazı reddedilen girdiler yalnızca `false` döndürüyor. |
| Oturum ve ağ | `src/renderer.js`, `src/core/session.js`, `src/core/ice.js`, `src/core/network-check.js`, `src/core/transport.js` | PeerJS, WebRTC, genel STUN, isteğe bağlı TURN, canlı konum ve güvenilir girdi kanalları var. Çalışan varsayılan TURN yok. |
| İmleçler | `src/core/pointer.js`, `src/cursor-overlay.js`, `src/cursor-view.js`, `src/renderer.js` | İki görsel işaretçi ve ekran sahibine öncelik var. Görünürlük/öncelik koşulları gerçek kullanımda ayrıca doğrulanmalı. |
| Görüntü | `src/core/video.js`, `src/core/transport.js`, `src/renderer.js` | Profil, bitrate tavanı, çözünürlük/FPS uyarlaması ve alıcı FPS/kayıp ölçümü var. Kodlama/çözme süresiyle uçtan uca neden ayrımı eksik. |
| Dosya | `src/core/file-sender.js`, `src/core/file-store.js`, `src/core/transfer.js`, `src/renderer.js` | 32 KiB ham parçalar, Base64 taşıma, sekiz parçalık pencere, onay, SHA-256 ve geçici dosya var. Kopmadan devam yok. |
| Tanılama ve güncelleme | `src/core/diagnostics.js`, `src/core/errors.js`, `src/core/updates.js` | Sınırlı rapor, açıklamalı bazı hatalar ve sürüm/yapı kontrolü var. Güncelleme denetimi kurulumun doğrulandığı anlamına gelmez. |
| Paketleme | `scripts/`, `package.json`, `.github/workflows/` | x64 NSIS setup adayı üretimi, paket denetimi ve ayrı imza politikası var. İmzasız beta yolu mevcut. |
| Web | Çalışma alanındaki iki site ZIP'i | Hazır hosting paketi ile geliştirme kaynak arşivi ayrı. Web kaynakları açık klasör halinde değil. |

Önceki turda gözlenen sayısal davranışlar:

- Yerel fare hareketi uzak girdiyi 1.200 ms bekletiyor; yeni hareket süreyi yeniliyor. Bu tasarlanmış öncelik davranışı, tek başına bir hata kanıtı değil. Kullanıcıya anlatımı ve geçişleri sorun yaratabilir.
- Süren ağ darboğazı bildirimlerinde Akıcı profil hedefi 60 → 30 → 15 → 8 FPS olabiliyor. Bu sayıların görülmesi gerçek ağda aynı performansın ölçüldüğü anlamına gelmez.
- Görüntüye boş upload kalmadığında dosya bütçesi 64 kbit/s'ye düşebiliyor. Önceki ekrandaki yaklaşık 9 KB/s ile aynı büyüklükte; o olayın kesin nedeni henüz bilinmiyor.
- Dosya hızı üst sınırı 16 Mbit/s; ham uçuş penceresi 256 KiB. Base64 ham veriyi yaklaşık üçte bir büyütüyor.
- Tam ekran düğmesi/F11 var; giriş/çıkış olaylarıyla ayrı durum senkronizasyonu yok. ResizeObserver ve pencere boyutu dinleyicisi zaten var; sıfırdan eklenmiş gibi ele alınmayacak.
- Pencere/viewport odağı kaybolunca girdiyi bırakma kodu zaten var. Bunun tüm Windows geçişlerinde doğru çalıştığı henüz kanıtlanmış değil.

Önceki temizlikten önce geçen kontroller tarihsel kanıttır. Kullanıcının isteğiyle otomatik işlev testi kaynakları silindi. Mevcut `check:source` yalnızca sözdizimini kontrol eder. Bu plan bunları sessizce geri eklemeyi öngörmez; kabul senaryoları elle uygulanır, sonuçlar yapı numarasıyla bu belgeye kısa kayıt olarak eklenir. Geçici ölçüm dosyaları dağıtıma konmaz.

## 3. Araştırmadan çıkan kararlar

| İncelenen kaynak | Gözlem | RK Screen için karar |
| --- | --- | --- |
| AnyDesk ekran ayarları [K1] | Kalite, görüntüye sığdırma ve uzak imleç görünürlüğü ayrı tercihler. | İzleme, işaretleme ve kontrol açıkça ayrılacak; imleç görünürlüğü kontrol iznine bağlanmayacak. |
| RustDesk odak şikâyeti [K2] | Kullanıcılar başka pencereye geçtikten sonra uzak girdinin sürmesini bildiriyor. Bu bizim Windows hatamızın kanıtı değil. | Sohbet, dosya seçici, Alt+Tab ve odak kaybında girdinin durması kabul senaryosu olacak. |
| RustDesk DPI/pencere çalışması [K3] | Tam ekran ve ekran ölçülerinin güncellenmesi birlikte ele alınıyor. | Tam ekran sonrası güncel görüntü alanı hesaplanacak; eski koordinatla tıklama gönderilmeyecek. |
| RustDesk dosya hızı tartışması [K4] | Kullanıcılar hız sınırları ve yerel/uzak bağlantılardaki farklı sonuçlardan şikâyetçi. | Sabit üst sınırı körlemesine yükseltmek yerine görüntü ve dosya birlikte ölçülecek. |
| WebRTC istatistik standardı [K5] | Kodlama, çözme, donma ve kuyrukla ilgili ölçümler tanımlı; her alan her cihazda bulunmayabilir. | Eksik ölçüm sıfır sayılmayacak; CPU, alıcı ve ağ darboğazları ayrılacak. |
| WebRTC dosya örneği [K6] | DataChannel üzerinden dosya taşıma için başvuru örneği. | İkili veri ve gönderim tamponuna göre akış kontrolü, mevcut güvenlik sınırları korunarak değerlendirilecek. |
| WebRTC TURN ve coturn [K7–K8] | Doğrudan bağlantının mümkün olmadığı ağlarda aktarma gerekir. | STUN, TURN yerine sayılmayacak; bağlantı rotası gerçek relay adayıyla doğrulanacak. |
| Microsoft SendInput [K9] | Windows bütünlük düzeyi, girdi enjeksiyonunu sınırlar. | İzin sorunu, yerel öncelik ve Windows yetki engeli ayrı açıklanacak. |

Bu kaynaklar tasarım girdisidir. Başka ürünün hata kaydı bizdeki kök nedeni kanıtlamaz; başka ürünün pazarlama değeri bizim performans ölçümümüz değildir.

## 4. Uygulama sırası

P0: güvenilir kontrol ve yayın öncesi engeller. P1: performans ve kullanım. P2: temel davranışlar doğrulandıktan sonraki özellikler.

| Sıra | İş | Öncelik | Bağımlılık | Bitmiş sayılması için |
| --- | --- | --- | --- | --- |
| A0 | Tekrarlanabilir başlangıç ölçümü | P0 | Yok | Aynı yapıda iki cihaz raporu ve sorunun tekrarı |
| A1 | Kontrol durumları ve iki imleç | P0 | A0 | İzin/öncelik/odak geçişlerinde doğru kontrol ve görünürlük |
| A2 | Tam ekran ve DPI | P0 | A1 | Tekrarlı geçişlerde doğru odak ve tıklama konumu |
| A3 | Farklı ağlar ve toparlanma | P0 | A0; altyapı bulunması | Doğrudan ve zorunlu aktarma senaryolarının ayrı geçmesi |
| A4 | Görüntü/FPS uyarlaması | P1 | A0, A1 | Hareketli içerikte ölçülmüş akıcılık ve okunabilirlik |
| A5 | Dosya aktarımı | P1 | A0, A4 | Sağlam bütünlük, belirgin hız kazanımı, kontrolü bozmama |
| A6 | Güvenlik, hata ve kullanım bütünlüğü | P0/P1 | A1–A5 boyunca | İzin sınırlarının korunması ve açıklanabilir başarısızlık |
| A7 | Kurulum, indirme ve site paketi | P0 | Zorunlu kabul senaryoları | Doğrulanmış setup, tutarlı yapı/hash ve hazır web ZIP'i |

A3 için altyapı yoksa diğer yerel işler sürer; aktarma işi tamamlandı diye işaretlenmez. Süre ve hız tahminleri ilk ölçümden önce gerçek sonuç gibi yazılmaz.

## 5. A0 — başlangıç ölçümü ve rapor

- [ ] İki cihazda sürüm, yapı, Windows sürümü, CPU/GPU, ekran çözünürlüğü/DPI, uyumluluk modu ve seçilen profil kaydedilsin.
- [ ] Görüntü, dosya ve girdi bağlantıları ayrı olduğundan her birinin rotası/RTT'si ayrı ölçülsün. Veri kanalının gecikmesi medya gecikmesi gibi sunulmasın.
- [ ] Gönderilen/çözülen/gösterilen FPS, kodlama/çözme süresi, kare kaybı, donma süresi, bitrate ve gönderim kuyruğu ölçümleri desteklendiği ölçüde eklensin. Yerel `20261016.3`: gönderilen FPS, kare başına kodlama/çözme süresi, jitter tampon beklemesi ve atılan kare sayısı eklendi; gösterilen FPS ve tüm oturum özeti henüz yok.
- [ ] Hedef FPS ile gerçek FPS arayüzde ayrı kalsın. `requestVideoFrameCallback` ile gösterim ölçümü, RTP ölçümüyle aynı şey sayılmasın.
- [ ] Girdi için gönderildi/alındı/Windows'a uygulandı/reddedildi ayrımı tasarlansın. Girdi onay süresi, fiziksel ekranda görülen yanıt süresi diye sunulmasın.
- [ ] Rapor süre, örnek sayısı ve yüzde 95 gecikme değerini içersin; mevcut 120 olaylık tampon uzun oturum özetini kaybetmesin.
- [ ] Rapor varsayılan olarak ekran görüntüsü, dosya içeriği, sohbet, tuş metni, parola, tam SDP veya TURN sırrı içermesin. Dışarı gönderim kullanıcı eylemiyle olsun.

Çıktı: aynı senaryonun önce/sonra karşılaştırmasına yetecek küçük, kişisel içerik içermeyen tanılama özeti.

## 6. A1 — kontrol ve iki isimli imleç

Beklenen davranış: ekranda iki farklı kişinin konumu görünür, işletim sisteminin etkin fare/klavye kontrolü ise tek ve anlaşılır durumdadır. İki işaretçi iki bağımsız Windows masaüstü odağı oluşturmaz.

Durumlar: `izleme`, `işaretleme`, `kontrole hazır`, `uzak kontrol`, `yerel kullanıcı önceliği`, `elle duraklatıldı`, `yeni görüntü bekleniyor`, `Windows girdiyi reddetti`, `bağlantı kesildi`.

- [x] Ana süreç yetkili karar noktası olmaya devam etsin; arayüz yazısı yetki vermesin. Yerel izin/görüntü/bozuk paket kapıları doğrulandı; bağımsız güvenlik denetimi değildir.
- [x] `api.input()` sonucu türlenmiş neden koduyla işlensin. Kalıcı kontrol durumu ayrı güvenilir kanala taşındı; eski imleç paketi daha yeni kontrol durumunu geri alamıyor. Rapor girdi nedenini ve yerel IPC uygulama süresini içeriyor; bu ağ/uçtan uca gecikme ölçümü değil.
- [ ] Mevcut 1.200 ms yerel öncelik, cihaz ölçümüyle değerlendirilsin. Hareket gürültüsü/touchpad titreşimi yüzünden süresiz bekleme oluşmaması incelensin. Koruma sırf kontrol çalışsın diye kaldırılmasın.
- [ ] İleride yerel girdi ayrımı için Windows kaynak işaretleri/hook yaklaşımı gerekirse önce küçük teknik deneme ve temiz kapanış doğrulansın. GetCursorPos karşılaştırmasının yerel klavyeyi tek başına tanımadığı dikkate alınsın.
- [ ] Yerel kullanıcı kontrolü aldığında uzak tuş/düğmeler bırakılsın. Beklemede kalan tıklamalar sonradan topluca uygulanmasın; devam için yeni kullanıcı eylemi gereksin.
- [ ] Sürükleme, tuş basılı tutma, hareket ve tıklamanın farklı kanallardan gelmesi için sıra/oturum anahtarı tutarlılığı korunsun. Yoğun girdi kanalı sessizce tuş kaybetmesin; kontrollü bırakma ve görünür hata uygulasın.
- [ ] İki tarafta ekran sahibi ve katılımcı için isimli/renkli görsel işaretçiler bulunsun. İsim tek başına kimlik kanıtı gibi gösterilmesin.
- [ ] Ekran sahibi fareyi oynatırken uzak katılımcı işaretlemeye devam edebilsin; Windows girdisi üretmesin. İşaretçi izni kapatıldığında ilgili ikinci işaretçi gerçekten kapansın.
- [ ] Native overlay ve akışta yakalanan işletim sistemi imleci üçüncü/hayalet imleç oluşturmamalı. Ekran sahibi/katılımcı konumları ayrı kayıtlardan çizilsin; önceki konumsa bu davranış açık olsun.
- [ ] Overlay tıklamayı yakalamasın, odak çalmasın; dosya seçici ve tam ekran üzerinde ayrıca kontrol edilsin. Yerel Electron kontrolünde iki native overlay ve iki arayüz işaretçisi görünür/ayrı konumda; işaretçi izni kapanınca gizleniyor. Gerçek uzak iki cihazda yerel ve uzak hareket hâlâ doğrulanmalı.
- [ ] Türkçe Q/F, AltGr, Ctrl/Shift kombinasyonları, tekrarlı tuş, tekerlek ve orta tuş doğrulansın. Yönetici/UAC sınırı ayrı ve doğru anlatılsın.

Kabul: normal yetkili masaüstünde 100 hedef tıklama ve 50 klavye eyleminde kayıp/çift işlem/yanlış hedef 0; 20 yerel/uzak öncelik geçişinde takılı tuş 0. İki işaretçi, izin verilen ekranda her iki taraftan gözle doğrulanmalı. Bu sayılar yapılmış test sonucu değil, hedef senaryodur.

## 7. A2 — tam ekran, ölçek ve çoklu monitör

- [x] Tam ekran düğmesi gerçek `enter-full-screen` / `leave-full-screen` durumunu izlesin [K10]; geçiş sırasında düğme beklesin ve istenen sonraki durum sırayla uygulansın. Yerel Electron geçişleri doğrulandı.
- [x] Görünür çıkış düğmesi ve yerel F11 korunsun. Ctrl+Alt+Shift+Boşluk yerel bırakma/çıkış kısayolu eklendi; izleme moduna geçiriyor. Bu kısayollar DOM'dan önce ana süreçte yakalanıyor; normal Escape uzaktan kullanılabiliyor.
- [ ] Geçişlerde basılı girdiler bırakılsın; sohbet/dosya seçici odağı çalınmasın. Uzak görüntüye tıklayınca kontrol odağı güvenilir biçimde geri gelsin.
- [ ] Sığdır, doldur ve 1:1 görünümde aynı geometri hesabı görüntü, iki işaretçi ve tıklama için kullanılsın. Siyah kenarlara tıklama uzak sisteme gitmesin.
- [ ] %100/%125/%150/%200 DPI, negatif monitör koordinatı ve monitör çıkarma senaryoları doğrulansın. DPI değişiminde eski ölçüyle girdi engellensin.
- [ ] Tam ekran için karşı bilgisayarın gerçek çözünürlüğü kendiliğinden değiştirilmesin.

Kabul: 20 giriş/çıkış ve 10 Alt+Tab/sohbet/dosya seçici döngüsünde sıkışma yok; test ızgarasındaki noktalarda hedef sapması en fazla 2 kaynak piksel; oturum bitince pencere normal durumuna döner.

## 8. A3 — farklı ağlarda bağlantı ve toparlanma

- [ ] ICE durumları ve veri/medya kopmaları ayrı hata nedenleriyle raporlansın. STUN yanıtı gelmesi bağlantı kurulmuş veya TURN çalışıyor diye gösterilmesin.
- [ ] Kullanıcının ek hesap/ödeme yapmasını gerektirmeyen, elde mevcut erişilebilir altyapı olup olmadığı araştırılsın. Yoksa engel dürüstçe kaydedilsin; rastgele açık TURN adresleri dağıtıma konmasın.
- [ ] Altyapı bulunduğunda coturn, TLS, kimlik doğrulama, süreli yetki, kapasite ve bant genişliği sınırlarıyla değerlendirilsin. Sunucu yönetim sırrı istemciye gömülmesin.
- [ ] UDP engelinde TCP/TLS aktarma yapılandırması ve gerçekten seçilen relay adayı ölçülsün. Aynı ağdaki başarılı bağlantı bu kabulün yerine geçmesin.
- [ ] Wi-Fi kopması, ağ değişimi, uyku/uyanma ve sinyal sunucusu kesintisinde sınırlı yeniden deneme olsun. PeerJS'nin desteklediği yeniden başlatma/yeniden bağlantı yolu doğrulanmadan rastgele `restartIce()` eklenmesin.
- [ ] Eski oturumun tuşları bırakılsın; yeni bağlantı/görüntü anahtarıyla eski paketler uygulanmasın. Yeniden bağlantı izinleri genişletmesin veya yeni kişiyi kendiliğinden onaylamasın.

Kabul: farklı iki internet, mobil hotspot ve UDP kısıtlı senaryo ayrı kaydedilir. Zorunlu aktarmada hem medya hem veri yolu doğrulanır. Kurtarılabilir kesintide önerilen hedef 15 saniye içinde toparlanma; mümkün değilse en geç 30 saniyede açık neden ve yeniden deneme seçeneği. Bunlar ağ garantisi değildir.

## 9. A4 — okunabilir görüntü ve akıcı hareket

- [ ] Bitrate değeri bir tavan olarak açıklansın; yüksek tavanın otomatik olarak yüksek kalite/60 FPS getirmediği arayüzde anlaşılır olsun.
- [ ] Otomatik, Net metin, Dengeli, Akıcı ve Düşük veri profilleri ölçümle ayarlansın. Profil adı ile gerçek düşürülmüş hedef ayrı gösterilsin.
- [ ] Yakalama, kodlama, ağ, çözme ve görüntüleme darboğazları ayrılarak müdahale edilsin. Sırf bir ölçüm geldi diye her 2 saniyede ayar değiştirilmesin.
- [ ] Kötüleşme/iyileşme için ayrı eşikler ve bekleme süreleri olsun; bitrate/çözünürlük/FPS ileri geri zıplamasın. Toparlanma başlangıç profiline dönebilsin.
- [ ] 4K görüntüyü sonradan küçültmek yakalama yükünün tamamını kaldırmaz. Gerekirse yakalama çözünürlüğü de güvenli yeniden kurulumla azaltılsın; kaynak koordinatları doğru kalsın.
- [ ] Alıcıdaki yavaş çözme ve kare gösterme de geri bildirim versin. Donanım kodlama desteği cihazda doğrulansın; tüm cihazlara tek codec zorlanmasın.
- [ ] Uyumluluk modundaki 30 FPS sınırı korunup açıkça gösterilsin. Düşük cihazda 60 FPS zorlanmasın; okunabilir 720p/30 veya 15 FPS geri dönüşü ölçülsün.

Kabul hedefi: yeterli CPU/GPU ve boş upload bulunan referans iki cihazda 1080p hareketli içerikte 5 dakikalık ölçümde 1 saniyelik pencerelerin en az %95'i 55 FPS veya üstü; 1 saniyeyi aşan beklenmedik donma 0. Hedef tutmazsa sonuç yazılır, 60 FPS kararlı ilan edilmez. Durağan ekran bu FPS kabulüne dahil edilmez.

Kısıtlı ağda ayrı hedef: seçilen profilin uyarlaması görünür, metin örnekleri okunabilir, kontrol kuyruğu birikmez; ağ iyileşince hedef geri yükselir. A0 ile ölçülmeden rastgele Mbps tabanı ürün gereksinimi yapılmaz.

## 10. A5 — dosya aktarımı

- [ ] JSON kontrol mesajları ile dosya verisi ayrılarak ikili DataChannel çerçevesi tasarlansın. Dosya kimliği, parça sırası, boyut ve oturum bağı açık olsun.
- [ ] Protokol değişirse iki tarafın sürüm uyumluluğu doğrulansın; eski istemci yanlış veri yazmak yerine açık mesajla reddedilsin.
- [ ] Pencere boyutu/byte bütçesi ölçülen RTT ve kapasiteye göre sınırlı değişsin; gönderim tamponu doluyken yeni veri üretilmesin. Bellek dosya boyutuyla büyümesin.
- [ ] Sabit 16 Mbit/s tavanı ölçümle değerlendirilsin. Kullanıcıya otomatik öncelik veya aktarımı duraklatma sunulsun; yüksek hız uğruna kontrol gecikmesi artırılmasın.
- [ ] Görüntü ve dosyanın farklı bağlantılarda aynı upload'u kullandığı dikkate alınsın. Medya kapasite tahmini bütün ağın kesin hızı sayılmasın; dosya ACK/kuyruk doluluğu da ölçülsün.
- [ ] Mevcut onay, 512 MB sınırı, 20 dosyalık kuyruk, ad temizleme, disk hatası yönetimi, SHA-256 ve geçici dosya güvenliği korunsun.
- [ ] İptal ve bağlantı kesilmesi yarım dosyayı tamamlandı göstermesin. Sonraki aşamada devam özelliği: alıcının yeniden onayı, dosya kimliği/özeti/uzunluğu ve güvenli geçici kayıt eşleşmesiyle tasarlansın.

Kabul: 0 bayt, 2 MB, 100 MB ve 512 MB dosya; Türkçe/uzun ad, aynı ad, dolu disk, reddetme, iptal, kopma ve bozuk parça senaryoları. Tamamlanan her dosyada SHA-256 eşitliği zorunlu. Hız için aynı cihaz/ağda mevcut sürüme göre önce/sonra sonuç; eşzamanlı aktarımda girdi onay gecikmesi yüzde 95 değerindeki artış hedefi en fazla 50 ms. Bu ölçüm kullanıcıda görülen uçtan uca gecikme değildir.

## 11. A6 — güvenlik ve kullanışlılık

- [ ] Onay öncesi veya izin kaldırıldıktan sonra kontrol/pano/dosya işlemi uygulanmasın. Eski oturum ve video anahtarı reddi korunsun.
- [ ] Mesaj türü/boyutu/hız sınırları ikili dosya protokolüne de uygulansın. Bozuk veri uygulamayı kapatmasın veya sınırsız kuyruk oluşturmasın.
- [ ] Güncelleme adresi izin listesi ve yapı karşılaştırması korunsun. SHA-256 bütünlük sağlar; aynı kaynaktaki hash tek başına yayıncı kimliği sağlamaz.
- [ ] Veri bağlantısına dayalı doğrulama kodunun ayrı medya bağlantısını bağlamadığı sınır görünür kalsın. Üretim için denetlenmiş kimlik/eşleştirme tasarımı ayrı çalışma olsun; özel kripto uydurulmasın.
- [ ] Windows normal/yönetici yetki farkı açık anlatılsın. UAC, Smart App Control veya antivirüs korumasını kapatmak çözüm olarak uygulanmasın; setup yayıncı imzası sağlamaz.
- [ ] Hatalar neden/etki/yapılabilecek adım içersin: izleme modu, izin yok, yerel kullanıcı önceliği, Windows yetki sınırı, görüntü bekleniyor, aktarma yok, dosya/disk sorunu.
- [ ] Sohbet/dosya penceresine geçerken uzak klavye dursun. Okunmamış mesaj, gönderim durumu ve aktarım kuyruğu oturumun durumuyla tutarlı olsun.

Sonraki özellikler (P2): güvenli aktarım devamı, kısa süreli çizim/işaretleme, cihaz başına görüntü tercihi ve daha iyi tanılama özeti. Favoriler ve sohbet zaten var; yeniden yapılmayacak. Gözetimsiz erişim, sessiz kontrol, sanal ekran sürücüsü, oyun fare kilidi ve büyük arayüz yeniden yazımı ilk kapsamın dışında.

## 12. Kütüphane ve mimari kararı

Başlangıç kararı: mevcut Electron/WebRTC/Koffi yapısında ölçülebilir düzeltme. Yeni dile geçiş kontrol odağı, NAT, Windows izinleri ve bant genişliği sorunlarını kendiliğinden çözmez.

| Seçenek | Karar |
| --- | --- |
| WebRTC'nin yerleşik DataChannel/istatistikleri | Önce mevcut olanaklar kullanılacak; ek paket zorunlu değil. |
| coturn [K8] | Altyapı adayı; masaüstüne npm paketi eklemekle aktarma hizmeti kurulmuş olmaz. |
| Deskreen [K11] | Ekran paylaşımı/arayüz yaklaşımı için başvuru; RK Screen'in kontrol motorunun yerine hazır çözüm sayılmaz. |
| RustDesk kaynakları [K2–K4, K12] | Mimari ve hata senaryoları incelenir. Kod alınacaksa AGPL lisansının mevcut MIT projeye etkisi değerlendirilmeden kopyalanmaz. |
| Yeni native yakalama/kodlama bileşeni | A4 ölçümü mevcut motoru gerçekten sınır olarak gösterirse küçük prototiple değerlendirilir. Şimdi tam yeniden yazım yok. |

Yeni bağımlılık için bakım durumu, lisans, Windows x64 paketi, güvenlik geçmişi, kurulum boyutu ve ölçülmüş yarar kontrol edilir. Kütüphane eklemek tek başına tamamlanma ölçütü değildir.

## 13. Kabul matrisi ve kayıt yöntemi

| Eksen | En az uygulanacak senaryolar |
| --- | --- |
| Cihaz | Düşük güçlü/entegre GPU ve güçlü cihaz; gönderen/alıcı rolleri ters çevrilmiş |
| Windows | Desteklenen Windows 10/11 x64; normal hesap ve yönetici pencere sınırı |
| Ekran | 1366×768, 1080p, mümkünse 4K; karma DPI, çift monitör, negatif koordinat |
| Ağ | Aynı LAN, farklı iki internet, hotspot, zorunlu TURN; kontrollü gecikme/kayıp/kısıt |
| İçerik | Durağan küçük metin, kaydırma, pencere sürükleme ve hareketli içerik |
| Geçiş | Tam ekran, Alt+Tab, sohbet, dosya seçici, monitör geçişi, uyku/uyanma |
| Süre | Başlangıç için 30 dakika; bellek/kuyruk sınırsız büyümemeli |
| Dosya | Küçük/büyük/boş dosya, ret, iptal, kopma, bozuk veri ve disk hatası |

Kontrollü ağ bozulması yalnızca ayrılmış denemede uygulanır; kullanıcının normal ağı/korumaları değiştirilmez. Sanal veya aynı cihazdaki iki istemci, gerçek farklı ağ kabulünün yerine geçmez.

Her kayıt: tarih, yapı, senaryo, cihaz/ağ özeti, süre, hedef, ölçülen sonuç, geçti/kaldı/uygulanamadı ve açık hata. Uygulanamayan senaryo başarılı sayılmaz. Uzun ham log yerine özet korunur; yeniden yakalanması gereken hata bilgisi temizlikte silinmez.

## 14. A7 — setup, GitHub ve site ZIP'i

Bu bölüm geliştirmelerden sonra uygulanır; plan dosyasının hazırlanması yayın yapıldığı anlamına gelmez.

1. Zorunlu kontrol/izin/tam ekran/dosya bütünlüğü senaryolarını tamamla. TURN yoksa farklı ağlarda garantili ürün gibi yayımlama. Kararlı 1.0 kararı ayrıca kabul sonuçlarına bağlıdır.
2. Kullanıcının isteğine uygun olarak Beta 1 etiketi korunabilir; her yeni içerikte yapı numarası artırılır. Şimdiden yeni yapı ayrılmaz. Aynı etiket altında farklı binary için hash, boyut, tarih ve yapı mutlaka yenilenir.
3. Mevcut araçlarla setup adayı üret; normal kullanıcı kurulumu, eski kuruluma yükseltme, çalıştırma, kaldırma ve yeniden kurmayı doğrula. Gerçek Windows imzası yoksa imzalı veya uyarısız diye sunma.
4. Yeni aday doğrulanmadan çalışan son dosyayı silme. Yayın geçişinde kısa süreli geri dönüş kopyasını koru; doğrulanmış yeni indirme aktif olduktan sonra yalnızca açıkça eski RK Screen çıktıları temizlenir. Git geçmişi ve kullanıcı dosyaları silinmez.
5. GitHub setup dosyası, `release.json`, SHA-256 ve boyut birbiriyle eşleşsin. Aynı sürümde yapı değişikliği uygulama içi denetimde görülsün. Güncelleme denetimi otomatik kurulum diye anlatılmasın.
6. Site kaynak ZIP'ini geliştirme için aç; hazır `RK-Screen-Site.zip` yalnızca htdocs dosyaları içersin. Kaynak/test/araç/anahtar/kurulum EXE'si hosting ZIP'ine girmesin.
7. Site düğmesi doğrulanmış GitHub setup adresini kullansın; kurulum dosyası InfinityFree'ye konmasın. CSS/görsel yolları, mobil görünüm, HTTPS ve indirilen gerçek dosyanın hash'i kontrol edilsin. SSL özel anahtarı hiçbir arşive girmez.
8. Aynı URL'deki eski önbellek riskine karşı yapı/hash içeren indirme adresi ve site varlık sürümlemesi uygulansın. ZIP'i hazırlamak canlı siteyi güncellemez; yükleme sonrası canlı kontrol ayrı kaydedilir.

Yayın engelleri: izinsiz/yanlış hedefli girdi, takılı tuş, bozuk dosyanın tamamlandı görünmesi, kaçışı olmayan tam ekran, karışmış yapı/hash ve çözülemeyen kritik güvenlik hatası. Altyapı/ölçüm eksikleri saklanarak tamamlandı denmez.

## 15. İlerleme kaydı

| Tarih | İş | Sonuç | Sonraki adım |
| --- | --- | --- | --- |
| 16 Ekim 2026 | Mevcut kaynaklar ve birincil internet kaynaklarıyla plan | Plan hazır; uygulama/paket/site değişmedi | A0 başlangıç ölçümü ve A1 kontrol/iki imleç |
| 16 Ekim 2026 | Yerel yapı `20261016.3` — ilk uygulama | Türlenmiş girdi sonucu, güvenilir kontrol durumu, titreşim filtresi, iki işaretçi görünürlüğü, tam ekran olayları/acil çıkış ve temel kodlama/çözme ölçümleri | Gerçek iki cihaz kabulü; A3 altyapı ve A4/A5 ölçüme dayalı geliştirmeler |
| 16 Ekim 2026 | Kullanıcının isteğiyle aynı Beta 1'in dağıtımını yenileme | `20261016.3` setup ve genel SHA-256 doğrulandı; GitHub güncelleme kaydı/sürüm notları yenilendi, eski setup kaldırıldı; 14 dosyalık site ZIP'i hazır | Kullanıcının InfinityFree yüklemesi ve saha/kurulum kabulü; A3/A4/A5 tamamlandı sayılmaz |

Bu adımın doğrulaması: Electron 44.8.0 normal ve yazılım çizimli uyumluluk modunda; ana süreç izin/görüntü/eski paket kapıları, sanal Windows reddi ve yeniden deneme, 100 tıklama çifti, 50 tuş çifti, iki native/arayüz işaretçisi, eski kontrol revizyonunun reddi, 20 tam ekran giriş/çıkışı, hızlı ters yön isteği, F11, düğme, modal odak ve acil bırakma geçti. Windows'a gerçek fare/tuş gönderilmedi; protokol/aralık ölçümleri ayrıca bellekte doğrulandı. Kalıcı test kaynakları geri eklenmedi. Normal modun kapanışlarında GPU günlük mesajı tekrarlandı; uyumluluk modunda görülmedi. Kök neden doğrulanmadı; bütün sürücülerde giderildiği sonucu çıkarılmaz. Geçici deneme kaynakları/profilleri doğrulama sonrasında kaldırılır; geliştirme bağımlılıkları npm ile yeniden kuruldu.

## Kaynaklar

Araştırma tarihi 16 Ekim 2026. Proje belgeleri mevcut davranışı; resmî API belgeleri teknik sınırları; GitHub şikâyetleri kullanıcı deneyimlerini destekler. Şikâyetler bağımsız performans kıyaslaması değildir.

- **K1:** [AnyDesk — Display settings](https://support.anydesk.com/display)
- **K2:** [RustDesk — odak kaybından sonra girdinin sürmesi, #13398](https://github.com/rustdesk/rustdesk/discussions/13398)
- **K3:** [RustDesk — Adjust Window/DPI çalışması, #15853](https://github.com/rustdesk/rustdesk/pull/15853)
- **K4:** [RustDesk — dosya aktarım hızı tartışması, #1607](https://github.com/rustdesk/rustdesk/discussions/1607)
- **K5:** [W3C — WebRTC Statistics API](https://w3c.github.io/webrtc-stats/)
- **K6:** [WebRTC — dosya aktarımı örneği](https://webrtc.github.io/samples/src/content/datachannel/filetransfer/)
- **K7:** [WebRTC — TURN server](https://webrtc.org/getting-started/turn-server)
- **K8:** [coturn — resmî kaynak deposu](https://github.com/coturn/coturn)
- **K9:** [Microsoft — SendInput ve UIPI sınırı](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
- **K10:** [Electron — BrowserWindow olayları ve tam ekran](https://www.electronjs.org/docs/latest/api/browser-window)
- **K11:** [Deskreen — resmî kaynak deposu](https://github.com/pavlobu/deskreen)
- **K12:** [RustDesk — lisans](https://github.com/rustdesk/rustdesk/blob/master/LICENCE)

Yerel başvuru: [güncel durum](GUNCEL-DURUM.md), [güvenlik modeli](GUVENLIK-MODELI.md), [Windows imzalama](WINDOWS-IMZALAMA.md), [README](README.md).

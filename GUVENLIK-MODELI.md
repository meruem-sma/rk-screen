# RK Screen 0.7 — güvenlik modeli ve üretim öncesi işler

Güncelleme: 2 Ekim 2026. Bu belge mevcut kodun sınırlarını ve sonraki doğrulama işlerini tanımlar; bağımsız güvenlik denetimi veya ürün sertifikası değildir.

## Korunan veriler ve yetkiler

Ekran ve isteğe bağlı sistem sesi, fare/klavye kontrolü, pano metni ve kullanıcı tarafından kabul edilen dosyalar korunmalıdır. Oturumun görünür olması, iznin geri alınabilmesi ve bitirildiğinde yakalama/girdi işlemlerinin durması temel gereksinimlerdir.

## Güven sınırları

1. **Uzak istemci → uygulama:** İleti içeriği güvenilmezdir. Seçili ve onaylanmış veri bağlantısı dışındaki bağlantılar oturum işletemez. Mesaj türü, alanlar ve boyut sınırları kontrol edilir. Cihaz adı kimlik kanıtı değildir.
2. **Arayüz → Windows işlemleri:** Renderer ayrı ve sandbox içindedir. Preload sınırlı işlemler sunar. Ana süreç, çağıran pencere/ana çerçeve, dosya URL'si, rastgele yerel oturum belirteci, rol ve izinleri yeniden denetler. Yerel oturum belirteci uzak cihaza gönderilmez.
3. **Veri bağlantısı → video bağlantısı:** Video çağrısı onaylı karşı cihaz, protokol sürümü ve mevcut görüntü anahtarıyla eşleşmelidir. Her yenilemede rastgele UUIDv4 anahtarı değişir; eski anahtarla gelen çağrı ve kontrol girdileri kabul edilmez.
4. **Uygulama → bağlantı hizmetleri:** PeerJS Cloud ve herkese açık STUN/TURN kullanılmaktadır. Sunucuların erişilebilirliği ve güvenliği uygulamanın kontrolünde değildir. WebRTC taşıma şifrelemesi, kullanıcıya gösterilen cihaz kimliğinin doğrulandığı anlamına gelmez.

Görüntü anahtarı, veri kanalına erişebilen onaylı karşı tarafa gönderilir ve video çağrısı metadata'sında kullanılır. Bu bir cihaz parolası, kimlik doğrulama protokolü veya sinyalleşme sunucusu ele geçirilmesine karşı kanıt değildir. Yeni kare bildirimi, normal istemcinin görüntüyü çözdüğünü bildirir; kötü niyetli onaylı bir istemcinin dürüst davrandığını kanıtlamaz.

## 0.6 ile güçlenen ekran geçişi

Paylaşan taraftaki arayüz bağlı ekranları önizler ve kullanıcının seçimini alır. Uzak protokol, başka monitör seçen bir komut sunmaz. Yeni yakalama başarısızsa mevcut akış korunur. Yakalama beklerken iptal edilen veya oturumu kapanan bir iş sonradan tamamlanırsa ürettiği akış kapatılır.

Ana süreç koordinat hedefini değiştirmeden önce girdiyi durdurur ve uygulamanın bastığı tuş/düğmeleri bırakır. Yeni görüntü anahtarı ile yeni ekran birlikte kaydedilir. Yeni kare bildirimi doğru anahtarla gelene kadar girdi kapalıdır. Ana süreç yeniden açıldıktan sonra da eski anahtarlı girdi kabul edilmez. Süre aşımı paylaşımı sonlandırır. Kontrol izni bu işlemle kendiliğinden verilmez.

Bu düzen, yanlış ekrana gecikmiş tıklamayı önler. Uzaktan kontrol izni verilmiş kişinin işletim sistemi arayüzüyle yapabileceği işlemleri ayrı bir uygulama erişim listesiyle sınırlandırmaz.

## Doğrulama matrisi

| Senaryo                                           | Mevcut kontrol / kanıt                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Onay öncesi tuş ve pano mesajı                    | Arayüz testi: işlem yapılmıyor                                            |
| İkinci cihazın açık oturumu değiştirmesi          | Oturum sahipliği ve ikinci bağlantı reddi testleri                        |
| Başka cihazın veya yanlış anahtarlı video çağrısı | Arayüz testi: çağrı kapatılıyor                                           |
| Ekran geçişinde eski konuma tıklama/tuş           | Gerçek yerel WebRTC testi ve gerçek ana süreçte eski anahtarın reddi      |
| Görüntü gelmeden kontrol                          | Ana süreç girdi kapısı; yerel testte kare bildirimi bilerek bekletiliyor  |
| İzleyen rolünün ekran değiştirmesi                | Gerçek ana süreçte rol reddi                                              |
| Bağlı olmayan ekran                               | Gerçek ana süreçte ekran kimliği reddi                                    |
| İptal/kopma sırasında geç tamamlanan yakalama     | Yerel testte akışın kapatıldığı doğrulanıyor                              |
| Sohbette HTML çalıştırma                          | Metin olarak gösterim ve arayüz testi                                     |
| İzinsiz/eksik/bozuk dosya yazımı                  | Kullanıcı onayı, sınır, sıra, SHA-256, geçici dosya ve dosya adı testleri |
| Seri bağlantı istekleri                           | Yerel zaman penceresi; sunucu kaynak tüketimini tek başına önlemez        |
| Arayüz çökmesi / ikinci açılış                    | Gerçek Electron yaşam döngüsü testi                                       |

Dosya bütünlüğü özeti, dosyanın zararlı yazılım içermediğinin kanıtı değildir. Testler kullanıcı masaüstüne gerçek tuş/fare enjekte etmez; bu alanda saha testi gereklidir.

## Üretim dağıtımı öncesi P0

- Özel sinyalleşme ve TURN hizmeti: TLS, kapasite sınırları, oturum/istek hız sınırları ve kısa ömürlü TURN yetkileri. Dağıtım paketine sunucu yönetim sırrı konulmamalı.
- Doğrulanmış cihaz eşleştirme: seçilecek denetlenmiş kimlik/eşleştirme tasarımı veri ve medya bağlantısını birlikte bağlamalı; cihaz kimliği çakışması, anahtar değişimi ve iptal akışı açık olmalı.
- Sunucu ve istemci tehdit testleri: kimlik taklidi, tekrar oynatma, büyük/seri ileti, onay yarışı, servis kesintisi, anahtar yenileme ve iznin geri alınması.
- Geçerli Windows imzası; temiz Windows 10/11 makinelerinde kurulum, yükseltme, kaldırma ve bozulmuş güncellemeden toparlanma.
- Farklı fiziksel bilgisayarlarda klavye düzeni, karma DPI/çoklu monitör, ağ kaybı ve ses testi; bağımsız güvenlik incelemesi.

Bu sürüm sunucu kurmaz, özel altyapıya bağlanmaz ve kimlik doğrulanmış gözetimsiz erişim eklemez. Windows UAC güvenli masaüstü korumalarını aşmaz. Üretim P0 işleri tamamlanmış sayılmaz.

## Teknik kaynaklar

- [Electron DesktopCapturerSource](https://www.electronjs.org/docs/latest/api/structures/desktop-capturer-source): ekran kaynağı ile Windows/Electron ekran kimliği eşleştirmesi.
- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer/): ekran yakalama API'si.
- [MediaStreamTrack.stop](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop): açık yakalamaların sonlandırılması; `stop()` çağrısı `ended` olayını kendiliğinden üretmez.

Kod: `src/main.js`, `src/core/session.js`, `src/renderer.js`, `src/core/file-store.js`. Sonuçlar: `SISTEM-DENETIMI.md`, `review/e2e-results.json`, `review/native-results.json`.

## 0.7 isimli işaretçi sınırı

İşaretçi, onaylı oturum ve güncel görüntü anahtarı gerektirir; Windows kontrol girdisi üretmez. Paylaşan taraf işaretçiyi kapatabilir. Ad, oturum başlangıcındaki bilgisayar adından alınır; her konum mesajıyla değiştirilemez ve doğrulanmış kimlik değildir. Etiket metin olarak gösterilir, kontrol/bidi karakterleri temizlenir. Pencere sandbox içindedir; yalnızca konum/etiket alan bir köprüsü vardır, ana süreç işlem yetkilerine erişimi yoktur. Oturum sonunda pencere kapatılır.

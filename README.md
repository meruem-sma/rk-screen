# RK Screen 1.0.0-beta.1

Windows 64 bit için Türkçe ekran paylaşımı ve uzaktan destek uygulaması. Electron, PeerJS, WebRTC ve Koffi kullanır. Koyu, sade arayüzde marka logosu bulunmaz.

Kaynak kodu MIT lisansıyla açıktır. [İndirme deposu](https://github.com/meruem-sma/rk-screen-downloads) ve [ürün sitesi](https://rkscreen.com.tr/) ayrı tutulur. Mevcut Beta 1 EXE **imzasızdır** ve Windows tarafından engellenebilir. Açık kaynak geçişi dosyayı otomatik imzalamaz.

## Code signing policy

[İmzalama politikası](CODE-SIGNING-POLICY.md), [gizlilik](PRIVACY.md), [güvenlik bildirimi](SECURITY.md) ve [SignPath başvuru hazırlığı](SIGNPATH-BASVURU.md). Ücretsiz imzalama için henüz kabul alınmadı.

## Kullanım

1. **İki bilgisayarda da 1.0.0-beta.1 sürümünü açın.** Yeni toparlanma davranışı iki güncel uçla test edilmiştir. 0.6.0 ve önceki sürümlerle oturum kurulmaz.
2. Karşı bilgisayarın dokuz haneli kimliğini girin. Ekranını paylaşan kişi isteği ve paylaşılacak ekranı onaylasın. Görünen cihaz adı karşı tarafın bildirdiği addır; doğrulanmış kimlik değildir.
3. Fare/klavye, pano ve sistem sesi ayrı izinlerdir; başlangıçta kapalıdır.
4. Kontrol izni verildiyse araç çubuğunda **Fare ve klavye** seçin ve uzak ekrana tıklayın. **Yalnızca izle** seçiliyken girdi gönderilmez. Üst durum yazısı etkin modu gösterir.
5. Daha net yazılar için **Net metin**, ölçeği bozmamak için **Ekrana sığdır**, birebir fiziksel piksel görüntüsü için **1:1 piksel** seçin. Alanı doldurma görüntüyü kırpar; esnetmez. Uzak bilgisayarın Windows çözünürlüğü değiştirilmez.
6. Görüntü takılırsa **Görüntüyü yenile** ile onaylanmış veri oturumunu kapatmadan video bağlantısını yeniden kurun.
7. Sohbette Enter mesajı gönderir; Shift+Enter yeni satır açar. Teslim onayı gelmeyen mesaj yeniden gönderilebilir. Teslim onayı, karşı tarafın mesajı okuduğu anlamına gelmez.
8. Paylaşan bilgisayarda **Ekran değiştir** ile başka monitörü önizleyip **Bu ekranı paylaş** seçin. Sohbet ve dosya aktarımı aynı oturumda devam eder.
9. Her iki taraf bağlantıyı bitirebilir. Paylaşan taraf kontrol ve pano iznini sonradan kaldırabilir. Ayarlardan gelen yeni istekler kapatılabilir.

## 1.0.0-beta.1 değişiklikleri

- Görüntü bağlantısı kesildiğinde, veri oturumu açıksa kontrol güvenle bekletilir ve dört saniye sonra görüntü yeniden kurulur. Bir dakikada en fazla iki otomatik deneme yapılır. Yeni görüntü gelmeden kontrol açılmaz. Veri kanalı da kapanırsa yeniden onaylı bağlantı gerekir.
- Ağ kapasitesi iki ardışık ölçümde düşükse bit hızı tavanı düşer; beş iyi ölçümden sonra %15 adımlarla yükselir. Chromium'un kendi ağ kontrolü çalışmaya devam eder.
- Sürekli işlemci baskısında FPS hedefi 60→30→15 basamaklarıyla düşer; beş temiz ölçümden sonra kademeli yükselir. Statik ekranın düşük FPS'si tek başına arıza sayılmaz.
- Gerçek FPS ve aktarım hızı, kaynak/iletilen çözünürlük, hedef FPS/bit hızı, doğrudan/aktarma rotası ve aralıklı paket kaybı ayrılır. Rota üzerine gelince medya gecikmesi görünür. Üstteki ping veri kanalının gidiş-dönüş süresidir.
- Eksik sayaçlar ve akış değişimi yanlış hız üretmez; ölçüm işleri üst üste binmez. Desteklenmeyen kalite ayarları sessizce saklanmaz.
- Beta sürüm adları ve önceki doğrulanmış dağıtımların temizliği desteklenir. rkscreen.com.tr sitesi ayrı bir web projesidir ve InfinityFree'de barındırılır.

Çalışma sırası, kabul koşulları ve fiziksel saha matrisi: [OPTIMIZASYON-PLANI.md](OPTIMIZASYON-PLANI.md).

## 0.7.0 ile gelenler

- **İsimli imleç:** İzleyen kişi, paylaşan bilgisayarın imlecini bilgisayar adıyla görür. Konum 50 ms aralıkla sorgulanır; değişmeyen konumlar süzülür.
- **Karşı tarafın işaretçisi:** Paylaşan masaüstünde karşı bilgisayarın adı görünür. Enes, RK ekranına bağlandıysa RK masaüstünde “Enes” görünür. Yalnızca izleme modunda da kullanılabilir; kontrol izni vermez. Paylaşan kişi **İsimli işaretçi** kutusunu kapatabilir.
- İşaretçi tıklamaları engellemez, odağı almaz; hareket kesilince 1,5 saniye sonra kaybolur. Windows'ta yakalamadan hariç tutulması istenir. Monitör geçişi/oturum sonunda kapatılır.
- **Net metin** metin öncelikli kodlama ipucu kullanır. **Akıcı hareket** 60 FPS hedefi ve hareket önceliği ekler. Gerçek FPS üstte ölçülür; donanım/ağ koşulları hedefi sınırlayabilir.
- Alt alanda kaynak ve iletilen çözünürlük, varsa işlemci/ağ sınırlaması gösterilir. Üstte alınan çözünürlük kalır.
- Kalite değişiklikleri sırayla uygulanır; önceki video bağlantısına geç kalmış ayar gönderilmez.

Özellikler ve eksiklerin sırası [ANYDESK-KARSILASTIRMA.md](ANYDESK-KARSILASTIRMA.md) içindedir.

## 0.6.0 ile gelenler

- Paylaşan kişi oturumdaki **Ekran değiştir** düğmesiyle bağlı monitörleri önizleyip yeni ekranı onaylayabilir. Uzak protokol başka monitör seçen bir komut sunmaz.
- Yeni ekran yakalanamazsa mevcut paylaşım devam eder. Yakalama beklerken seçim iptal edilebilir. Bağlantı kesilirse sonradan açılan yakalama da kapatılır.
- Geçişte basılı girdiler bırakılır; yeni görüntü ulaşana kadar Windows tarafında kontrol durdurulur. Eski görüntüye ait sonradan ulaşan girdiler reddedilir.
- Video çağrısı, onaylı veri bağlantısına ve her görüntü yenilemede değişen rastgele anahtara bağlanır. Bu denetim cihaz kimliği doğrulaması değildir.
- Paylaşım araçları sayfadan bağımsız üst alanda görünür; ayarlarda da paylaşım bitirilebilir.
- Meşgul, istekleri kapalı, sürümü uyumsuz ve çok sık istek alan cihazlar için farklı açıklamalar gösterilir.

## 0.5.0 ile gelen temel

- Ürün adı RK Screen oldu; eski marka görselleri kaldırıldı. Windows paketleri kurulum ve taşınabilir seçenekleriyle yeniden adlandırıldı.
- 1:1 görüntü, Windows/DPI ölçeğini hesaba katıyor. Akış çözünürlüğü ve pencere boyutu değiştiğinde görüntü ve işaretçi yerleşimi güncelleniyor.
- Sohbete teslim onayı, başarısız teslimi yeniden deneme, aynı mesajın tekrarını önleme, çok satırlı yazım, karakter sayacı ve okunmamış mesaj göstergesi eklendi. Eski mesajları okurken gelen mesajlar ekranı zorla aşağı kaydırmıyor.
- Gelen istekleri kapatma ayarı ve cihaz başına/genel zaman pencereli istek sınırı eklendi. Bu yerel sınır, sunucu tarafı kötüye kullanım korumasının yerine geçmez.
- Ekran/medya izni, onaylı paylaşan oturuma ve uygulamanın ana çerçevesine sınırlandı.
- Yeni paket kontrol edilip hazırlandıktan sonra bu ürüne ait olduğu doğrulanan eski sürüm klasörleri otomatik kaldırılıyor. Sağlama toplamları ve sürüm kaydı oluşturuluyor.

Önceki sürümdeki Windows SendInput, Türkçe karakter/kısayol desteği, basılı tuşları bırakma, yerel fare önceliği, görüntü yenileme ve açılış toparlanması korunur. Araştırma, kod değerlendirmesi ve sonraki aşamalar [RK-SCREEN-PLAN.md](RK-SCREEN-PLAN.md) içindedir.

## Görüntü profilleri

| Profil        | 1080p için üst sınır | Öncelik                                     |
| ------------- | -------------------- | ------------------------------------------- |
| Dengeli       | 12 Mbps / 30 FPS     | Metin netliği ve ağ kullanımı               |
| Net metin     | 20 Mbps / 30 FPS     | Çözünürlük ve yazı okunabilirliği           |
| Akıcı hareket | 24 Mbps / 60 FPS     | Hareket akıcılığı; çözünürlük azaltılabilir |
| Düşük veri    | 2,5 Mbps / 24 FPS    | Daha az veri; görüntü küçültülebilir        |

Daha büyük ekranlarda veri sınırı en fazla iki katına çıkar. Bunlar hedef sınırlarıdır; ağ, işlemci, kodlayıcı ve TURN kapasitesi gerçek sonucu belirler. Görüntü sıkıştırmalıdır; kayıpsız aktarım garantisi verilmez.

## Windows sorun giderme

- Kontrol çalışmıyorsa paylaşan bilgisayarın kontrol iznini, araç çubuğundaki modu ve uzak ekranın odağını kontrol edin.
- Yönetici olarak çalışan uygulamalar ve UAC güvenli masaüstü Windows tarafından sınırlandırılır. Uygulama bu korumaları aşmaz.
- Siyah ekran/açılış sorunu için Ayarlar → **Windows uyumluluk modu** seçeneğini açıp uygulamayı kapatıp açın. Donanım hızlandırması kapanır; performans düşebilir.
- Pencere hiç açılmıyorsa terminalden `RK-Screen-Portable-1.0.0-beta.1.exe --safe-mode` ile deneyin.
- Açılış ve işlem hataları kullanıcı veri klasöründeki `logs/startup.log` dosyasına yazılır. Ekran, pano, sohbet ve tuş içerikleri bu günlüğe yazılmaz.
- Uygulamayı tekrar açmak mevcut pencereyi öne getirir.

## Geliştirme, test ve sürüm hazırlama

Node.js 22.12 veya üzeri ve Windows x64 gerekir.

```powershell
npm ci
npm start
npm test
npm run test:ui
npm run test:e2e
npm run test:startup
npm run test:native
npm run test:overlay
npm run release
```

`release`, birim/arayüz/yerel bağlantı/açılış/işaretçi penceresi testlerini çalıştırır; ardından iki Windows paketini üretir, paket içeriğini kontrol eder, güvenilir imzalama kimliğiyle imzalar ve eski sürümleri temizler. Yeni sürüm hazırlanırken `package.json` sürümü, kilit dosyası ve çıktı klasörü birlikte güncellenmelidir. `npm run dist` yalnızca paketleme hattını çalıştırır; testleri ayrıca çalıştırmak gerekir.

Çıktılar `dist/1.0.0-beta.1/` içindedir: kurulum EXE, taşınabilir EXE, `SHA256SUMS.txt` ve `release.json`. Temizlik sadece bu ürüne ait olduğu doğrulanan daha eski dağıtım klasörlerine uygulanır; kaynak ve kullanıcı verilerine uygulanmaz. Bu işlem kullanıcının bilgisayarında kurulu uygulamayı uzaktan güncellemez. İmzalı otomatik güncelleme ayrı bir geliştirme aşamasıdır.

`test:native` gerçek ekran yakalamayı açıp kapatır; görüntüyü dışarı göndermez. Fare/klavye testleri gerçek kullanıcı masaüstüne olay göndermez. `test:e2e` gerçek WebRTC, yapay ekran/pano ve gerçek dosya alıcı koduyla yerel iki oturumu sınar. `test:startup` izole bir test penceresinde arayüz çökmesi ve ikinci açılışı sınar. Sonuçlar [SISTEM-DENETIMI.md](SISTEM-DENETIMI.md) içindedir.

## Dosya yapısı

- `src/main.js`: pencere, Windows işlemleri, IPC yetkilendirmesi, dosyalar ve yaşam döngüsü.
- `src/preload.js`: sınırlı masaüstü erişim köprüsü.
- `src/renderer.js`: bağlantı, izinler, sohbet, medya ve aktarım akışları.
- `src/core/session.js`: oturum sahipliği, istek sınırı ve ileti doğrulama.
- `src/core/video.js`: kalite profilleri ve görüntü/işaretçi koordinatları.
- `src/core/transport.js`: ağ ölçümleri, kalite uyarlaması ve toparlanma sınırı.
- `src/core/file-store.js`: dosya parçaları, SHA-256 kontrolü, geçici dosya temizliği, mevcut dosyayı koruma.
- `src/input/injector.js`, `src/input/packets.js`: Windows girdi erişimi, Unicode/tuş kodları ve girdi paketleri.
- `src/peerjs.min.js`: paket bağımlılığıyla eşleşen yerel PeerJS dağıtımı.
- `index.html`, `src/styles.css`: koyu arayüz ve yerleşim.
- `tests/`, `scripts/`, `.github/`: doğrulama ve dağıtım araçları; uygulamaya paketlenmez.

## Bağlantı, güvenlik ve sınırlar

Bağlantı buluşması PeerJS Cloud; ağ geçişi Google/Cloudflare STUN ve OpenRelay TURN üzerinden yürür. Her ağda bağlantı garantisi yoktur. Üretim dağıtımından önce özel PeerServer/TURN, güvenli cihaz eşleştirme ve farklı internet bağlantılarında saha testi gerekir. WebRTC taşıma şifrelemesi, karşı tarafın kimliğinin bağımsız doğrulandığı anlamına gelmez. Görüntü anahtarı da kimlik doğrulamanın yerine geçmez. Tehdit modeli ve kalan işler [GUVENLIK-MODELI.md](GUVENLIK-MODELI.md) içindedir.

Dosya sınırı 512 MB'dır. Alıcı onayı, 32 KB parçalar, SHA-256 kontrolü ve aynı adlı dosyayı koruma bulunur. Sohbet oturumla sınırlıdır; son 200 mesaj arayüzde tutulur. Sohbet ve paylaşılan pano içeriği kalıcı olarak kaydedilmez. Oturum öncesindeki pano metni otomatik gönderilmez.

Gerçek iki fiziksel bilgisayarda klavye düzenleri, karma DPI/çoklu monitör, sistem sesi, yönetici uygulamaları ve farklı ağ türleri için kapsamlı test tamamlanmamıştır. Yerel testlerin geçmesi bu koşullar için garanti değildir.

## İmzalama, yükseltme ve lisans

Mevcut Beta 1 imzasızdır ve Windows Akıllı Uygulama Denetimi tarafından engellenebilir. Yeni yayın derlemeleri artık imzalama kimliği yoksa durur. İç uygulama ve dış paket birlikte imzalanmalıdır. Sertifika kurulumu, doğrulama ve aynı Beta 1 yayınını güncelleme adımları: [WINDOWS-IMZALAMA.md](WINDOWS-IMZALAMA.md).

Eski kurulumu güncelleyebilmek için dahili uygulama kimliği `com.rksoftworks.menzil` korunmuştur. Paketli uygulama varsa eski Menzil kullanıcı veri klasörünü ve mevcut tercih anahtarlarını kullanır. Bunlar görünür ürün adı değildir. Gerçek kurulumdan yükseltme döngüsü temiz Windows makinesinde ayrıca doğrulanmalıdır.

Kaynak kodu [MIT lisansıyla](LICENSE) yayımlanır. Üçüncü taraf bileşenlerin lisansları [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) içinde korunur. Mevcut eski Beta 1 EXE bu açık kaynak geçişinden önce oluşturulmuştur; güncel kaynakla aynı hash'e sahip yeni bir imzalı paket henüz üretilmemiştir.

RK Softworks · rksoftworks@gmail.com

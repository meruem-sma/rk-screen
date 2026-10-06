# RK Screen — ürün araştırması ve geliştirme planı

Araştırma: 1 Ekim 2026. Ürün adı **RK Screen**. Büyük RK, boşluk, büyük S ile Screen. Ayrı marka logosu kullanılmayacak; koyu ve sade arayüz korunacak. Açık kaynak kararı verilmediği için mevcut lisans şimdilik korunacak; bu bir lisans tavsiyesi veya marka uygunluk araştırması değildir.

## Araştırmadan çıkan ihtiyaçlar

Forumlar temsilî örneklerdir; şikâyetlerin yaygınlığına ilişkin istatistik olarak değerlendirilmemelidir. Eski başlıklar tarihleriyle birlikte davranış örneği olarak kullanılmıştır. Ürün davranışları için resmî belgeler ayrıca kontrol edilmiştir.

| Gözlem ve kaynak                                                                                                                                                                                                                                                                                             | RK Screen için çıkarım                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TeamViewer topluluğunda yeni menüler, ek adımlar ve sohbetin bulunabilirliği eleştiriliyor. [Resmî topluluk](https://community.teamviewer.com/English/discussion/129409/feedback-on-the-new-ui), [Nisan 2026 kullanıcı başlığı](https://www.reddit.com/r/teamviewer/comments/1stemkg/new_ui_of_teamviewer/). | Bağlan/paylaş ekranı, görünür oturum araçları ve hesap gerektirmeyen oturum sohbeti korunmalı.                                                          |
| AnyDesk kullanıcıları tuş eşleme, belirli tuşların ulaşmaması ve takılı Ctrl/Alt davranışlarını bildiriyor. [2025 tuş bildirimi](https://www.reddit.com/r/AnyDesk/comments/1m7lb72), [takılı değiştiriciler](https://www.reddit.com/r/AnyDesk/comments/d62fpl/ctrl_and_alt_keys_stuck_after_pressing_them/). | Türkçe/İngilizce, AltGr, Ctrl/Shift sürükleme, odak değişimi ve ağ kopması ayrı test matrisi olmalı.                                                    |
| Eylül 2025 sistem yöneticisi başlığında kolay bağlantı ve güvenilir dosya aktarımı isteniyor; AnyDesk'in gecikmesi ve dosya aktarım hızı eleştiriliyor. [Kullanıcı başlığı](https://www.reddit.com/r/sysadmin/comments/1n97197).                                                                             | Aktarım, görüntüyü ve kontrolü tıkamamalı; hız, ilerleme, hata ve iptal anlaşılır olmalı.                                                               |
| Kullanıcılar TeamViewer'ın kullanım sınıflandırması ve kesilmelerinden şikâyet ediyor. [Mayıs 2025 başlığı](https://www.reddit.com/r/teamviewer/comments/1kofzn0).                                                                                                                                           | Ücret/lisans kararı verilirse koşullar açık olmalı; belirsiz sınıflandırmalarla oturum kesilmemeli. Bu sürüm bir ücretlendirme sistemi eklemiyor.       |
| Bazı kullanıcılar AnyDesk'in kurulum gerektirmeyen kullanımını; TeamViewer'ın alışıldık bağlantı akışını değerli buluyor. [Taşınabilir kullanım](https://www.reddit.com/r/sysadmin/comments/eyq1os), [alışılmış kullanım kolaylığı](https://www.reddit.com/r/sysadmin/comments/u24wss).                      | Taşınabilir ve kurulumlu seçenekler, az adımlı kullanıcı onayı ve görünür bağlantı durumu korunmalı.                                                    |
| AnyDesk resmî belgelerinde kalite/hız dengesi, gerçek boyut, sığdırma, monitör değiştirme ve farklı hızlandırma yolları ayrılıyor. [Görüntü ayarları](https://support.anydesk.com/display).                                                                                                                  | Kalite, çözünürlük, pencereye yerleşim ve Windows çizimi aynı ayar gibi sunulmamalı. Kaynak çözünürlük ile ekranda görünen ölçek ayrı ele alınmalı.     |
| AnyDesk belgeleri taşınabilir uygulamanın UAC/yönetici ekranı sınırlarını açıkça anlatıyor. [Yetki belgesi](https://support.anydesk.com/administrative-privileges-and-elevation-uac).                                                                                                                        | Siyah ekran/girdi reddi durumunda gerekçe görünmeli. Windows korumalarını aşmaya çalışmak yerine ileride onaylı ve imzalı yardımcı servis tasarlanmalı. |
| TeamViewer güvenlik belgeleri oturum şifrelemesinin yanında kimlik, izin ve hesap korumalarını da ele alıyor. [Güvenlik açıklaması](https://www.teamviewer.com/en-au/global/support/knowledge-base/teamviewer-remote/security/security-statement/).                                                          | WebRTC şifrelemesi tek başına kimlik doğrulaması veya bağımsız güvenlik denetimi anlamına gelmez.                                                       |

## İnceleme başlangıcındaki kodun değerlendirmesi

Temel: Electron 44.4.5, PeerJS/WebRTC, Windows SendInput ve parçalı dosya alıcısı. Çalışan onay/izin kapıları, pencere yalıtımı, metin tabanlı sohbet, doğal çözünürlük yakalama, kalite profilleri ve yerel testler var. Bunlar korunmalı.

0.4.0 tabanında saptanan eksikler (2–4 numaralı maddeler 0.5.0'da giderildi):

1. Cihaz adı karşı tarafın bildirdiği bir metin; doğrulanmış kimlik değil. PeerJS Cloud ve sabit herkese açık TURN ayarları üretim altyapısı değil.
2. Yeni bağlantı isteklerinde zaman pencereli hız sınırı yok. Kullanıcı gelen istekleri ayrı bir ayarla kapatamıyor.
3. Sohbet gönderildi/teslim edildi ayrımı, yeniden deneme ve çok satırlı yazım sunmuyor. Yeni mesaj geldiğinde eski mesaj okuyan kullanıcıyı aşağı kaydırıyor.
4. Gerçek boyut modu CSS pikseliyle hesaplanıyor; yüzde 125/150/200 Windows ölçeğinde birebir fiziksel piksel göstermiyor. Akış çözünürlüğü değişirse yerleşim yenilemesi eksik.
5. Paylaşan kişi başlangıçta monitör seçebiliyor; oturum içinde onaylı monitör değiştirme yoktu. Bu iş 0.6.0 ile tamamlandı.
6. Dosyalar tek tek, her parçayı bekleyerek aktarılıyor. Kesintiden devam, kuyruk ve kontrollü paralel aktarım yok.
7. Kod modülleri arasında izin ayrımı var ancak büyük renderer dosyası daha küçük oturum/sohbet/medya modüllerine ayrılmalı.
8. Testler yerel. Gerçek iki bilgisayarda farklı ağ, DPI, klavye, ses ve Windows yetki seviyeleri yeterince doğrulanmadı. Paketler imzasız.

## Öncelikli yol haritası

| Aşama                  | İş                                                                                                                                                               | Tamamlanma ölçütü                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0.5 — ürün temeli      | RK Screen adı, logosuz arayüz; DPI doğru görüntü; teslim onaylı sohbet; gelen istekleri kapatma ve hız sınırlama; doğrulanmış paket sonrası eski sürüm temizliği | Birim, arayüz, gerçek yerel WebRTC ve paket denetimleri geçer; yeni paket hazır olmadan eski paket kaldırılmaz.             |
| P0 — üretim güvenliği  | Özel sinyalleşme/TURN; kısa ömürlü TURN yetkileri; güvenli eşleştirme/cihaz kimliği; sunucu tarafında istek sınırı; tehdit modeli ve bağımsız inceleme           | İzinsiz/tekrarlanan bağlantı, kimlik taklidi, kayıt/veri sızıntısı senaryoları test edilir; servis kesintisi açıklanır.     |
| P1 — görüntü ve erişim | Kaynak/iletilen/alınan çözünürlük ve ağ darboğazı ölçümü; kodek/donanım kıyaslaması; onaylı monitör değiştirme; pencereye uygun kalite; yeniden bağlanma         | 1080p/1440p/4K ve yüzde 100/125/150/200 DPI matrisi; okunabilir metin, doğru köşe koordinatları, p50/p95 gecikme ölçümleri. |
| P1 — sohbet ve dosya   | Mesaj arama ve açık kullanıcı isteğiyle dışa aktarma; dosya kuyruğu/hız göstergesi/kesintiden devam; veri kanalında girdi önceliği                               | İptal, çift gönderim, aynı adlı dosya, düşük bant genişliği ve ağ kopması testleri. Sohbet otomatik kalıcı kaydedilmez.     |
| P2 — Windows dağıtımı  | Geçerli imza, temiz sanal makinede kur/kaldır/güncelle, log dışa aktarma; gerekirse onaylı yetki yardımcısı                                                      | Standart/yönetici hesapları ve Windows 10/11 üzerinde test; güncelleme başarısızsa çalışan sürüm korunur.                   |
| P2 — genişletme        | Adres defteri, cihaz başına tercihler, erişilebilirlik, klavye gezinmesi; hesap/gözetimsiz erişim ancak ayrı güvenlik tasarımıyla                                | İhtiyaç ve tehdit modeli netleşmeden arka planda kalıcı erişim eklenmez.                                                    |

## 0.5.0 uygulama sonucu

İlk aşama tamamlandı: RK Screen adı ve logosuz arayüz, fiziksel 1:1 görüntü, teslim onaylı sohbet, gelen istek ayarı ve hız sınırı uygulandı. 16 birim testi, arayüz, gerçek yerel WebRTC, açılış/toparlanma ve Windows ekran yakalama kontrolleri geçti. Kurulum ve taşınabilir paketler üretildi; içerik doğrulamasından sonra eski 0.4.0 dağıtımı kaldırıldı. Ayrıntılı sonuçlar ve testlerin sınırları [SISTEM-DENETIMI.md](SISTEM-DENETIMI.md) içindedir.

## 0.6.0 uygulama sonucu — 2 Ekim 2026

Paylaşan kişinin önizleyerek onayladığı monitör değiştirme, başarısız yakalamada mevcut ekranı koruma ve geçişte kontrolü durdurma eklendi. Her video yenileme için yeni bir anahtar kullanılıyor; video çağrısı onaylı veri oturumu ile eşleştiriliyor. Eski anahtarlı girdiler Windows tarafında reddediliyor. Paylaşım araçları ayarlarda da görünür kalıyor. Meşgul/kapalı/uyumsuz/hız sınırı açıklamaları ayrıldı.

17 birim testi, arayüz, gerçek yerel WebRTC, açılış ve Windows ekran yakalama kontrolleri geçti. Yerel testte 640 × 360 görüntüden 800 × 600 görüntüye geçildi; bekleyen dosya aktarımı korundu. Güven sınırları ve kalan P0 işleri [GUVENLIK-MODELI.md](GUVENLIK-MODELI.md) içinde belgelendi.

P1'in monitör değiştirme bölümü tamamlandı; farklı fiziksel bilgisayarlarda kabul matrisi henüz tamamlanmadı. P0 ve P2 aşamaları da devam ediyor. Bu sürümün test sonuçları, AnyDesk/TeamViewer ile aynı güvenilirlik veya üretim altyapısına ulaşıldığı anlamına gelmez.

## 0.7.0 — isimli imleç ve kalite

AnyDesk'in kamuya açık özellik grupları ve güncel forum deneyimleri [ANYDESK-KARSILASTIRMA.md](ANYDESK-KARSILASTIRMA.md) içinde mevcut kodla karşılaştırıldı. İsimli uzak imleç, paylaşan masaüstünde karşı tarafın işaretçisi, metin/hareket kodlama ayrımı, 60 FPS hedefli profil ve kaynak/iletilen çözünürlük göstergesi eklendi. 20 birim testi, isim/izin/kaliteyi sınayan gerçek yerel WebRTC ve Windows işaretçi testiyle doğrulandı.

Özel altyapı ve doğrulanmış cihaz eşleştirme P0 olarak kalır. Gerçek iki bilgisayarda AnyDesk ile aynı koşullarda performans karşılaştırması yapılmadı.

## Görüntü kalitesi için kabul ölçütleri

- Uzak masaüstünün en-boy oranı korunur. Sığdırma görüntüyü pencereye yerleştirir; 1:1 modu bir video pikselini bir fiziksel ekran pikseline eşler. Kırpma ayrı ve açık bir seçenektir.
- Pencere/DPI/akış çözünürlüğü değiştiğinde video ve fare koordinatları birlikte güncellenir.
- Bit hızını yükseltmek tek başına netlik garantisi değildir. Testte küçük metin, ince çizgiler, kaydırma, video, paket kaybı ve CPU/GPU yükü birlikte ölçülür.
- Uzak bilgisayarın Windows ekran çözünürlüğü habersiz değiştirilmez. Böyle bir özellik eklenirse paylaşan kişinin onayı ve oturum sonunda geri yükleme gerekir.

## Yayın ve lisans kararı

Her sürüm kendi çıktı klasöründe hazırlanır. Test, paket içerik kontrolü, varsa imza ve SHA-256 üretimi tamamlandıktan sonra yalnızca bu projeye ait olduğu doğrulanan eski dağıtım klasörleri kaldırılır. Kaynak kodu ve kullanıcı verileri sürüm temizliğine dahil değildir.

Açık kaynak/kapalı kaynak seçimi ayrı bir ürün kararıdır. Şimdilik kaynak yayımlanmaz, lisans değiştirilmez. RK Screen adının tescil veya marka uygunluğu bu araştırmanın kapsamına dahil değildir.


## 1.0.0-beta.1 — bağlantı ve kalite optimizasyonu

Ayrıntılı çalışma planı, kabul koşulları ve bekleyen fiziksel saha matrisi [OPTIMIZASYON-PLANI.md](OPTIMIZASYON-PLANI.md) içindedir. Sınırlı otomatik görüntü toparlanması, güvenli girdi bekletme, ağ/CPU tabanlı kalite hedefleri ve doğru sayaç ölçümleri uygulandı. Ayrı web sitesi temeli ../rk-screen-web klasöründe; site henüz yapılmadı.

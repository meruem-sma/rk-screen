# AnyDesk özellik incelemesi ve RK Screen karşılaştırması

Araştırma: 2 Ekim 2026. Karşılaştırılan RK Screen sürümü: 0.7.0.

Kapsam: AnyDesk'in kamuya açık ürün kataloğu, yardım belgeleri ve seçilmiş kullanıcı geri bildirimleri. Özellikler platforma, lisansa ve sürüme göre değişebilir. Bu, kapalı kaynak iç yapının çözümlendiği veya her sürümün tüm davranışlarının yeniden üretildiği anlamına gelmez. RK Screen'in adı, logosuz koyu arayüzü ve kodu korunur.

## Özellik envanteri

“Var” mevcut kod ve yerel testlerde bulunan işlevi; “kısmi” daha dar kapsamı; “sonra” henüz uygulanmamış işi belirtir. AnyDesk ile eşdeğer performans veya güvenlik sonucu ifade etmez.

### Erişim ve yönetim

Kaynak: [AnyDesk özellik kataloğu](https://anydesk.com/en/features). Aşağıdaki başlıklar kataloğun erişim, yönetim ve işbirliği gruplarından alınmıştır; RK Screen değerlendirmesi kendi kodumuzun incelemesidir.

| Özellik                           | RK Screen durumu                                 | Yapılacak iş                                      |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Masaüstü paylaşımı                | Var                                              | Farklı gerçek ağlarda kalite matrisi              |
| Etkileşimli kontrol               | Var                                              | Klavye düzeni/AltGr/yetki düzeyi saha testi       |
| Oturum istekleri ve sıra          | Kısmi: tek istek/oturum, zaman aşımı, hız sınırı | Destek kuyruğu ve görevlendirme                   |
| Tek adımlı destek talebi / Assist | Sonra                                            | Güvenli davet akışı                               |
| Dosya yöneticisi                  | Kısmi: onaylı tek dosya gönderimi                | Kuyruk, hız, devam etme, klasör gezinmesi         |
| Wake-on-LAN                       | Sonra                                            | Açık ağ/cihaz yetkisi ve donanım testi            |
| Uzaktan yazdırma                  | Sonra                                            | İmzalı Windows yazıcı bileşeni                    |
| Gözetimsiz erişim                 | Sonra                                            | Önce cihaz eşleştirme ve kimlik doğrulama         |
| Adres defteri                     | Kısmi: son beş bağlantı                          | Etiket, arama, cihaz başına ayar                  |
| Yönetim konsolu                   | Sonra                                            | Kimliği doğrulanmış hesap ve sunucu               |
| REST API                          | Sonra                                            | Yetki modeli, kapsam ve denetim kaydı             |
| Ad alanı / özel cihaz takma adı   | Kısmi: cihaz kimliği ve bilgisayar adı           | Doğrulanmış cihaz adları                          |
| Özel istemci                      | Kısmi: kendi arayüzümüz var                      | Yönetilen kurumsal yapılandırma                   |
| Grup ilkeleri / MDM               | Sonra                                            | İmzalı dağıtım ve yönetim politikaları            |
| İzin profilleri                   | Kısmi: ayrı girdi/pano/ses izinleri              | İsimli profiller ve cihaz bazlı seçim             |
| Kullanıcı hesabı                  | Sonra                                            | Hesap güvenliği ve kurtarma                       |
| Metin sohbeti                     | Var: oturum içinde teslim onayı/yeniden deneme   | Arama ve kullanıcı isteğiyle dışa aktarma         |
| Beyaz tahta                       | Sonra                                            | Onaylı çizim katmanı                              |
| Oturum daveti                     | Sonra                                            | Süreli, tek kullanımlık davet                     |
| Ekran kaydı                       | Sonra                                            | Açık onay, görünür kayıt durumu ve saklama seçimi |

### Görüntü, imleç ve oturum araçları

AnyDesk'te bunlar **Ayarlar → Görüntü** ve oturum araç çubuğundadır. Kalite/hız profilleri, uzak imlecin gizli/sürekli/harekette görünmesi, imleci veya pencere odağını izleme, özgün boyut/sığdırma/esnetme, tam ekran ve çizim seçenekleri belgelenmiştir. Windows oturum menüsünde ekranlar, çalışma modu ve çözünürlük uyarlama da yer alır. Kaynak: [Görüntü ayarları](https://support.anydesk.com/display).

| Özellik                                       | RK Screen durumu                                                        | Karar                                              |
| --------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| Kalite/hız seçimi                             | Var: Dengeli, Net metin, Düşük veri; 0.7 ile Akıcı hareket              | Metin ve hareket için ayrı kodlama öncelikleri     |
| Özgün boyut ve sığdırma                       | Var: fiziksel 1:1, sığdırma, oranlı kırpma                              | Görüntüyü oransız esnetmiyoruz                     |
| Monitör değiştirme                            | Var: paylaşan tarafın önizleyip onayladığı geçiş                        | Habersiz ekran değiştirme komutu eklenmedi         |
| İmleç gösterimi                               | 0.7: bilgisayar adıyla; ana bilgisayar konumu 50 ms aralıkla sorgulanır | İsimli işaretçi yerel ayarla kapatılabilir         |
| Karşı tarafı işaretçiyle yönlendirme          | 0.7: izleme modunda da ayrı işaretçi                                    | İşaret etmek, kontrol izni vermez                  |
| İmleci/aktif pencereyi izleyerek ekran atlama | Sonra                                                                   | Paylaşan tarafın izin kapsamıyla sınırlandırılmalı |
| Monitörleri ayrı pencerelerde açma            | Sonra                                                                   | Çoklu akış ve kaynak bütçesi gerekir               |
| Çözünürlüğü uzakta değiştirme                 | Sonra                                                                   | Açık onay ve eski çözünürlüğü geri yükleme gerekir |
| Tam ekran                                     | Var                                                                     | Windows görev çubuğu/çoklu monitör testi           |
| Gece modu ve cihaz başına görüntü tercihi     | Sonra                                                                   | Önce temel kalite ve okunabilirlik                 |
| Donanım uyumluluğu                            | Kısmi: hızlandırmayı kapatan uyumluluk modu                             | GPU/kodek karşılaştırması gerekir                  |
| Video/oyun fare yakalama                      | Kısmi: 60 FPS hedefli hareket profili; göreli fare yok                  | Oyun performansı iddiası yok                       |

RK Screen'deki **isimli çift işaretçi**, kullanıcının talebine göre tasarlandı. AnyDesk'in tüm sürümlerinde aynı isim etiketinin bulunduğu doğrulanmış sayılmamalı. Windows'un sistem imleci tektir: ikinci şekil uygulamanın çizdiği işaretçidir; iki kişinin aynı anda iki ayrı Windows fare aygıtını bağımsız yönetmesi değildir.

[Oturum ayarları](https://support.anydesk.com/docs/session-settings) ayrıca bağlantı bilgisi, sohbet, izinler ve eylem menüsünü tarif eder. Rol değiştirme, yetki yükseltme, Ctrl+Alt+Del, kilitleme, kullanıcı değiştirme, çıkış, ekran görüntüsü ve uzaktan yeniden başlatma RK Screen'de henüz yoktur. Windows yetki gerektiren işler için imzalı yardımcı hizmet ve açık izin tasarımı gerekir. [Yeniden başlatma](https://support.anydesk.com/remote-restart) ve [TCP tüneli](https://support.anydesk.com/TCP-Tunneling) ayrı özelliklerdir; mevcut veri kanalının bulunması bunların hazır olduğu anlamına gelmez.

### Güvenlik, dağıtım ve platformlar

| AnyDesk'teki başlık                                              | RK Screen durumu ve sıra                                                    | Kaynak                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| İzin yönetimi, erişim listesi, oturum çerçevesi, gizlilik ekranı | Ayrı izinler ve görünür paylaşım bandı var; izin listesi/ekran karartma yok | [Özellik kataloğu](https://anydesk.com/en/features)                                                                            |
| Gözetimsiz erişimde 2FA                                          | Yok; güvenilir cihaz kimliğinden sonra tasarlanmalı                         | [Gözetimsiz erişim](https://support.anydesk.com/unattended-access)                                                             |
| Güvenlik yapılandırması ve erişimi kaldırma                      | Yerel oturum kapıları var; bağımsız denetim yok                             | [Güvenlik önerileri](https://support.anydesk.com/security-tips)                                                                |
| Kurum içi sunucu                                                 | Yok; mevcut herkese açık bağlantı hizmetlerinin yerine öncelikli iş         | [On-Premises](https://support.anydesk.com/v1/docs/on-premises)                                                                 |
| Windows/macOS/Linux/mobil/diğer cihazlar                         | Yalnızca Windows x64                                                        | [Platformlar](https://anydesk.com/en/all-platforms), [OS desteği](https://support.anydesk.com/supported-operating-systems)     |
| Kayıt ve dosya araçları                                          | Oturum kaydı yok; dosya alıcı onayı, bütünlük ve isim çakışma koruması var  | [Dosyalar](https://support.anydesk.com/file-manager-and-file-transfer), [Kayıt](https://support.anydesk.com/session-recording) |

## Kullanıcı geri bildirimleri

Bunlar tekil deneyimlerdir; ürün genelinde oran veya doğrulanmış hata nedeni değildir.

- **29 Ağustos 2026:** Akışta kare atlama ve hareketli görüntüde takılma şikâyeti. RK Screen için çıkarım: tek bir yüksek bit hızı ayarı yeterli değil; metin ve hareket profilleri ayrı ölçülmeli. [Başlık](https://www.reddit.com/r/AnyDesk/comments/1w1t3hh/why_is_it_so_choppy/)
- **18 Eylül 2026:** Yavaş bağlantı şikâyetinin yanında taşınabilir kullanım ve günlük işlerde yeterli performans olumlu anılıyor. Bilerek yavaşlatıldığı iddiası doğrulanmış değil. Çıkarım: kurulum gerektirmeyen seçenek korunmalı; kaynak/ağ darboğazı görünür olmalı. [Başlık](https://www.reddit.com/r/AnyDesk/comments/1wjiy4h/is_anydesk_messing_up_again_with_free_users_by/)
- **6 Mayıs 2024:** Uzak imleci kapatamama ve performans şikâyeti. Çıkarım: işaretçi görünürlüğü, kontrol izninden ayrı olmalı. [Başlık](https://www.reddit.com/r/AnyDesk/comments/1cl6iwa/)
- Önceki TeamViewer arayüz/sohbet bulunabilirliği ve AnyDesk tuş/dosya araştırması [RK-SCREEN-PLAN.md](RK-SCREEN-PLAN.md) içinde korunuyor.

## Kodda bulunan ve 0.7'de ele alınan sorunlar

- İmleç bilgisi 2 saniyelik bağlantı denetimine bağlıydı. Ayrı 50 ms sorgulama, değişiklik süzme ve kanal doluysa eski konumları biriktirmeme eklendi. Bu bir ağ gecikmesi garantisi değildir.
- İmleç isimsizdi. İzleyenin ekranında paylaşan bilgisayarın adı; paylaşanın masaüstünde karşı tarafın adı gösteriliyor. Yerel işletim sistemi imleci karşıdan yönetilirken izleyende yanlış adla ikinci kopyası gösterilmiyor.
- Metin/hareket kodlama ipucu ayrılmıyordu. Metinde `text`, harekette `motion`; kalite isteklerinde sıralı uygulama ve eski akışa işlem yapmama eklendi. Bu tercihler kodlayıcıya ipucudur. [W3C içerik ipuçları](https://www.w3.org/TR/mst-content-hint/)
- Kaynak ve iletilen çözünürlük ayrımı yoktu. Şimdi kaynak/iletilen/alınan boyutlar ve mevcutsa ağ/işlemci sınırlaması gösterilir. Seçilen FPS ile gerçekleşen FPS aynı şey değildir.
- Sistem işaretçisi penceresi tıklamaları geçirmeli, odağı almamalı, oturum bitince kapanmalı. Bu özellikler ayrı Windows pencere testiyle denetlenir. Yakalamadan hariç tutma Windows içerik koruması üzerinden istenir; farklı Windows/GPU sistemlerinde saha kontrolü gerekir. [Electron pencere API'si](https://www.electronjs.org/docs/latest/api/browser-window)

## Sonraki sıra ve kabul ölçütleri

1. **P0: üretim güvenliği.** Özel sinyalleşme/TURN, doğrulanmış cihaz eşleştirme, kısa ömürlü yetkiler, bağımsız denetim; [GUVENLIK-MODELI.md](GUVENLIK-MODELI.md).
2. **P1: gerçek kalite kıyaslaması.** İki fiziksel Windows cihazı; 1080p/1440p/4K, DPI 100/125/150/200; küçük metin, çizgi, kaydırma ve video. Aynı ağ koşullarında okunabilirlik, p50/p95 etkileşim gecikmesi, gerçek FPS, CPU/GPU ve veri kullanımı ölçülmeli. Sentetik yerel test sonucu bu karşılaştırmanın yerine geçmez.
3. **P1: günlük işler.** Dosya kuyruğu/ilerleme/hız/devam etme; sohbet arama; cihaz başına görüntü ayarı; bağlantı tanılama çıktısı.
4. **P2: dağıtım ve gelişmiş destek.** Geçerli Windows imzası, güvenli güncelleme, temiz kurulum testi; sonra rol değiştirme, izinli kayıt ve çizim. Gözetimsiz erişim, tünel ve yönetim işlemleri ayrı güvenlik değerlendirmesinden sonra.

Her yeni sürüm doğrulandıktan sonra eski dağıtım kaldırılır. Kullanıcı verileri silinmez. Açık kaynak kararı verilmediği için mevcut lisans değiştirilmez.

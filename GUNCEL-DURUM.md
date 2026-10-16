# RK Screen — yerel geliştirme ve araştırma

16 Ekim 2026. Yerel yapı 20261016.3; sürüm adı 1.0.0-beta.1.
Genel GitHub indirmesi de 20261016.3'e güncellendi. Kararlı 1.0 ilan edilmedi.
InfinityFree için site ZIP'i hazırlandı; hosting'e yükleme ve gerçek Windows kurulumu yapılmadı.

## Beta 1 dağıtımı — 20261016.3

Yeni Windows x64 NSIS setup üretildi; arşivdeki 34 uygulama dosyasının güncel
kaynaklarla aynı olduğu, sürüm/yapı ve geliştirme/özel anahtar dosyalarının
pakete girmediği denetlendi. Boyut 112.828.231 bayt, SHA-256:

`c8dd674dec3fac7a44b8ccaf1eaeb4a8190e5deddf29b26e85bc8ecb9bb9da89`

GitHub'a önce ayrı aday yüklendi; mevcut indirme ancak yeni dosya hazırken değişti.
Genel URL'den setup tekrar indirilip tam SHA-256 ve boyut doğrulandı. `release.json`,
dosya özeti ve sürüm notları yenilendi; önceki setup yeni indirme/kayıt doğrulandıktan
sonra kaldırıldı. Tek yayın Beta 1 olarak kaldı. `signed:false`, `installVerified:false`;
paketleme kontrolü temiz Windows kurulumu veya saha kabulü değildir.

Site HTTP ve çift tıklama önizlemesinde masaüstü/mobil CSS, menü, yapı ve doğru
setup/hash bağlantısıyla doğrulandı. Yükleme ZIP'i 14 dosya içerir; dosyalar ZIP'e
yazıldıktan sonra kaynaklarıyla tek tek SHA-256 karşılaştırıldı. `.htaccess` dahildir;
EXE, kaynak kod ve özel anahtar ZIP'e girmez. Hosting'in SSL/Apache ayarları bu yerel
kontrolle doğrulanmış sayılmaz. Canlı InfinityFree dosyaları değiştirilmedi.

## 20261016.3 — kontrol, iki işaretçi ve tam ekran

- Ana süreç girdi sonucu artık kabul/ret ve neden kodu içeriyor. Kontrol durumu,
  revizyonu ve işaretçi izni ayrı güvenilir kanaldan bildiriliyor; geç gelen imleç
  konumu daha yeni kontrol durumunu değiştirmiyor. Yerel kullanıcı, izin, görüntü
  bekleme ve Windows reddi arayüzde ayrı açıklanıyor.
- İzin kapansa veya görüntü beklese bile uygulamanın basılı girdileri bırakılabiliyor.
  Yerel fare önceliği korunuyor; iki piksele kadar küçük titreşim süreyi sürekli
  yenilemiyor. Yavaş gerçek hareket birikerek algılanıyor. Yerel klavye için native
  kaynak ayrımı henüz eklenmedi.
- Ekran sahibinin isimli işaretçisi artık yalnız uzak fare Windows imlecini taşırken
  değil, izin verilen görünür paylaşımda da çiziliyor. İşaretçi izni kapanınca iki
  native katman ve karşı taraftaki iki çizim gizleniyor.
- Tam ekran giriş/çıkış olayları düğme durumunu senkronize ediyor. Geçiş sırasında
  girdi bırakılıyor; diyalog/sohbet odağı zorla alınmıyor. F11 ana süreçte yakalanıyor;
  Ctrl+Alt+Shift+Boşluk kontrolü bırakıp izlemeye ve pencere moduna dönüyor.
- Raporlara desteklenen cihazlarda kare başına kodlama/çözme süresi, gönderilen FPS,
  jitter tampon beklemesi, atılan kare sayısı ve yerel IPC girdi süresi eklendi.
  Sonuncusu ağ gecikmesi değildir. Veri kanalı ping'i raporda ayrı olaydır; medya
  RTT'si ile karıştırılmaz. Rapora tuş metni/sohbet/parola eklenmez.

Doğrulama: gerçek Electron 44.8.0 ana süreci/arayüzünde normal ve uyumluluk modunda
izin/görüntü/eski paket kapıları, sanal Windows reddi/yeniden deneme, 100 tıklama
çifti, 50 tuş çifti, iki native ve arayüz işaretçisi, eski durum revizyonu reddi,
20 tam ekran giriş/çıkışı, F11, düğme, modal odak ve acil bırakma geçti. Gerçek
Windows masaüstüne fare/klavye enjekte edilmedi; WAN, Türkçe fiziksel klavye,
karma DPI ve yeni setup kabulü yapılmadı. Normal modun kapanışlarında GPU günlük
mesajı tekrarlandı; uyumluluk modunda görülmedi. Kök neden doğrulanmadı.
Sanal doğrulama saha testi değildir. Geliştirme bağımlılıkları yeniden kuruldu;
geçici deneme kaynakları/profilleri tutulmaz, kalıcı test kaynakları geri eklenmedi.
Tam plan: [GELISTIRME-PLANI.md](GELISTIRME-PLANI.md). Bu kaynaklar ardından yukarıdaki
beta dağıtımına alındı. Dosya aktarım protokolü ve çalışan varsayılan TURN değiştirilmedi.

## Uygulanan iyileştirmeler

- Electron 44.4.5 yerine resmî kararlı 44.8.0 sabitlendi. Resmî notlarda Windows yerel
  pencere imleci, ağ hizmeti yeniden başladığında net.fetch/session.fetch ve tam ekran
  durumuna ilişkin düzeltmeler var; Chromium/V8 ve Node güncellemeleri de içeriyor.
  Bu, kullanıcının her sorununun aynı kökten geldiğini veya tümünün giderildiğini kanıtlamaz.
- Pencere ilk açılışta ekranın kullanılabilir DIP alanına sığar. Küçük ekran veya yüksek
  ölçeklendirmede minimum boyut ekranı aşmaz. Ekran alanı değişince/kaldırılınca mevcut
  pencere görünür alana alınır; tam ekran oturumuna müdahale edilmez.
- Süren işlemci darboğazında Otomatik/Akıcı/Düşük veri önce FPS hedefini azaltır;
  yük sürerse kodlanan görüntü 4K kaynakta önce 1080p, sonra en çok 720p'ye indirilebilir.
  Küçük kaynak büyütülmez; Net metin çözünürlüğünü korur. İyi ölçümlerle kademeli döner.
  Eksik ölçüm iyileşme sayılmaz; profilin bitrate tavanı tekrar tekrar kırpılmaz.
- GPU'nun kapatıldığı Windows uyumluluk modunda yakalama ve kodlama hedefi en çok
  30 FPS olur. Normal moddaki 60 FPS üst hedefi korunur. Yazılım çizimi ücretsizdir
  fakat işlemci yükünü artırabilir; bu yüzden herkese zorunlu varsayılan yapılmaz.
- Önceki yapının ayrı güvenilir klavye/tıklama kanalı, 256 KiB dosya penceresi,
  alındı onayına göre dosya bütçesi, ilerlemeyi izleyen zaman aşımı, iki görsel imleç,
  gerçek yerel fare önceliği, izinler ve SHA-256 bütünlük kontrolü korunur.

## Son kontroller ve kapsamları

Temizlikten önce 64 birim testi; arayüz, gerçek yerel WebRTC, 2 MB üzeri rastgele
veri aktarımı, sohbet, monitör geçişi, kontrol izni, işaretçi, açılış ve gerçek Windows
ekran yakalama kontrolleri uygulandı. Normal ve uyumluluk modu ayrıca denendi.
Testler kullanıcının gerçek faresine/klavyesine girdi göndermez.
44.8.0'de ilk gizli pencere görüntüsü denemesi UnknownVizError verdi; temiz test
profilindeki tekrar geçti. Eski profilden yükseltmenin bütün cihazlarda kabul
edildiği sonucu çıkarılamaz. Son npm taramasında bildirilen açık sayısı 0;
bu bağımsız güvenlik denetimi değildir.
Kullanıcının açık cevabı: “Test kaynaklarını da kaldır.” Bu nedenle bu testler,
sonuçları ve testlere bağlı npm/CI adımları silindi. Sonraki değişiklikler aynı
otomatik işlev kontrolleriyle korunmuyor. Kalan check:source yalnızca sözdizimidir.
Yerel kontrol gerçek iki uzak cihazda kalite ölçümü veya temiz kurulum kabulü değildir.

## Araştırma ve alınan kararlar

| Sıkıntı | Bu proje için sonuç |
| --- | --- |
| İşlemci/GPU kodlama yükü | Tek FPS değerini bütün cihazlara dayatmak yerine gerçek darboğaz ölçümüyle azaltma. Net metinde çözünürlük tercihi ayrı tutulur. |
| Ana süreçte ağır iş ve fazla bileşen | Dosyalar sınırlı parçalarla/asenkron işlenir; ek UI kütüphanesi veya arka plan hizmeti eklenmedi. Electron'un taban bellek maliyeti sürer. |
| Yüksek DPI ve küçük ekran | Fiziksel piksel ile DIP karıştırılmaz; pencere alanı çalışma alanına göre sınırlanır. Çoklu monitörde gerçek saha kabulü yine gerekir. |
| NAT/CGNAT ve kapalı UDP | STUN her koşulda yeterli değildir. Çalışan TURN gerekir; statik site ve GitHub dosya barındırma bu işi yapmaz. Dil değiştirmek NAT sınırını kaldırmaz. |
| Windows yetki sınırları | SendInput yalnızca izin verilen bütünlük düzeylerinde çalışır; yönetici ve UAC güvenli masaüstü normal kullanıcı uygulamasından yönetilemeyebilir. |
| Windows 7/8 ve 32 bit | Güncel Electron bu eski Windows sürümlerini desteklemez. Bu proje yalnızca Windows 10/11 x64 hedefler; eski motorla güvenliği düşürme kararı alınmadı. |
| İmzasız paket | Setup'a çevirmek yayıncı imzası sağlamaz. Bu tur sertifika, hizmet veya hesap alınmadı; Windows korumaları kapatılmadı. |

Yararları: ortak Chromium/WebRTC altyapısı, şifreli taşıma, donanım destekli kodlama
imkânı, akış sırasında ölçüm ve kendimize ait arayüz. Sınırları: Electron taban
bellek/disk maliyeti, sürücü bağımlılığı, mevcut genel sinyal hizmeti ve eksik TURN.
Bu yüzden AnyDesk/TeamViewer ile eşdeğer güvenilirlik veya her cihazda kesintisizlik
iddiası yoktur. Yeni bir dile tam geçiş bu sorunları tek başına çözmez.

Kaynaklar:

- [Electron performans](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron 44.8.0 resmî notları](https://github.com/electron/electron/releases/tag/v44.8.0)
- [Electron ekran/DIP API'si](https://www.electronjs.org/docs/latest/api/screen)
- [Electron eski Windows desteğinin sonu](https://releases.electronjs.org/release/v23.0.0)
- [WebRTC TURN](https://webrtc.org/getting-started/turn-server)
- [WebRTC ölçümleri](https://www.w3.org/TR/webrtc-stats/)
- [W3C görüntü tercihleri](https://www.w3.org/TR/mst-content-hint/)
- [Microsoft SendInput/UIPI](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)
- [Electron güvenlik](https://www.electronjs.org/docs/latest/tutorial/security)

## Kalan kabul işleri

Yeni kaynakla iki gerçek bilgisayarda zayıf/iyi ağ, Türkçe Q/F, karma DPI/çoklu
monitör, uyku/uyanma ve ağ değişimi sınanmalı. Çalışan varsayılan TURN, bağımsız
güvenlik denetimi, kalıcı doğrulanmış cihaz kimliği ve temiz Windows kurulum/
yükseltme/kaldırma kabulü tamamlanmadı. Oturum kodu veri bağlantısına dayanır;
ayrı medya sertifikalarını kapsamaz. Gerçek cihaz raporu olmadan bütün sorunların
çözüldüğü söylenmez. Bir sonraki paketleme sonrasında iki cihaz da aynı yapıyı kullanmalı.

## Temiz çalışma alanı

Kurulu uygulamanın klasörü ve kaldırıcı zaten yoktu; gerideki RK Screen kaldırma
kaydı ve iki eski Menzil/rk-screen ayar/önbellek klasörü temizlendi. Kullanıcının
İndirilenler dosyaları silinmedi. Test kaynakları/çıktıları, derlenmiş uygulama,
indirilebilir bağımlılık kopyaları, eski karşılaştırma notu, editör önerileri,
yerel GitHub CLI kopyası ve açık site kopyaları kaldırıldı. Site kaynakları önce
ZIP içinde dosya dosya doğrulandı; hazır hosting ZIP'i değiştirilmedi.

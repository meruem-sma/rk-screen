# RK Screen — Beta 1

16 Ekim 2026 · 1.0.0-beta.1 · yapı 20261016.1 · Windows x64 setup.

## Bu güncellemenin nedeni

Kullanıcının 16 Ekim görüntülerinde doğrudan bağlantı 17 ms, kayıp %0 ve görüntü
1080p / 30–44 FPS iken 2 MB dosya yaklaşık 9 KB/sn ilerliyor; sonra parça zaman aşımı
veriyor. Kontrol bazı anlarda ekran sahibinin faresi etkin sanılarak bekliyor.
Bunlar saha bulgusudur; fotoğraftaki 17 ms bütün internetlerin gecikmesi değildir.

## Uygulanan düzeltmeler

- Dosya yüklemesi, izlenen videonun ters yöndeki RTP tahminiyle kısıtlanmaz.
  Alındı onaylarının gecikmesine göre 4 Mbit/sn başlangıç bütçesi artırılır/azaltılır;
  üst bütçe 16 Mbit/sn, alt sınır 64 kbit/sn. Bu değerler gerçek hız garantisi değildir.
  Base64 ve mesaj ek yükü de gönderim bütçesine dahildir.
- Ekranı paylaşan bilgisayarda, güncel gönderilen video hızı hesaba katılarak görüntüye
  kapasite ayrılır. Eski medya tahmini 6 saniye sonra geçersiz olur.
- En fazla sekiz adet 32 KiB parça aynı anda bekler: ham içerik penceresi 256 KiB.
  Alıcının işlem kuyruğu da sınırlıdır. Geçerli onay geldikçe bekleme süresi yenilenir;
  hiç ilerleme yoksa 45 saniyede bütün bekleyen işler kapatılır. Otomatik tekrar
  gönderme/kesintiden devam yoktur. Alıcı onayı, SHA-256 ve dosya ezmeme korunur.
- Hızlı dosya parçası ve onay trafiği ayrı sınıra alınır. Sınır aşımı artık güvenilir
  parçayı sessizce düşürüp zaman aşımı bekletmez; aktarım açıkça durdurulur.
- Klavye, tıklama, tekerlek, girdi bırakma ve bağlantı yoklaması için dosya kanalından
  ayrı, sıralı ve güvenilir veri kanalı vardır. Hareket/işaretçi kanalı ayrı kalır.
  Her iki yol da aynı oturum, izin, biçim ve hız kontrollerinden geçer.
- Windows imleç gözlemi ve girdi sonrası gözlem aynı yerel koordinat okuyucusunu
  kullanır. Electron DIP dönüşümüyle Windows konumunun karışmasının uygulamanın
  kendi hareketini yerel kullanıcı hareketi sayması testte üretildi ve düzeltildi.
  Gerçek yerel fare önceliği ve elle duraklatma korunur.
- Yerel imleç bileşeni yüklenemezse yalnızca izleme paylaşımı da bozulmaz; bu,
  Windows'un engellediği DLL'yi çalıştırmaz veya uzaktan kontrol engelini aşmaz.
- Windows'ta işaretçi penceresi taşınırken üstte kalma durumu kaybolursa tekrar
  uygulanır. Tıklamaları geçirme, odak almama ve yakalama koruması korunur.
- Raporda dosya bütçesi, parça onay süresi, bekleyen veri miktarı ve kontrolün
  bekleme nedeni bulunur. Rapor IP, parola, cihaz adı/kimliği, dosya adı/içeriği,
  ekran veya sohbet içermez; yalnızca kullanıcı kaydettiğinde yerel dosyaya yazılır.
- Bağlantı biçimi v9 oldu. İki bilgisayarda da bu yapı kurulmalıdır; eski yapıyla
  karışık kullanım desteklenmez. Uygulama sürüm adı yine yalnızca Beta 1'dir.

## Doğrulama kapsamı

61 birim testi; Windows arayüzü, yerel gerçek PeerJS/WebRTC, iki imleç, kesinti,
Türkçe klavye, denetim izni, ekran değişimi, sohbet, çoklu dosya ve açılış testleri.
Windows ana süreç testi gerçek ekran yakalar, fakat kullanıcının faresine/klavyesine
basmaz. Tutarsız iki konum okuyucusu test ortamında bilerek oluşturulur.
WebRTC dosya denemesi 2 MB'tan büyük rastgele veri, SHA-256 ve iki yönde aktarım içerir.
Bu, gerçek iki uzak bilgisayarda performans ölçümü değildir.
16 Ekim npm resmî bağımlılık taramasında bildirilen açık sayısı 0; bu bağımsız
güvenlik denetimi veya sıfır risk garantisi değildir.

## 1.0 öncesinde hâlâ gerekenler

- Çalışan varsayılan TURN yok. Doğrudan bağlantı kurulamayan ağ çiftleri için
  geçerli aktarma altyapısı gerekir. InfinityFree/GitHub statik barındırma TURN değildir.
  Hesap/başvuru/ücretli hizmet alınmadı; çalışmayan genel relay bilgileri pakete eklenmez.
- Bu yeni yapıyla iki fiziksel bilgisayarda, farklı internetlerde tekrar test:
  Otomatik ve Net metin; küçük yazı, kaydırma, hareketli içerik ve eş zamanlı dosya.
  Gerçek FPS, gecikme, kayıp, donma ve dosya hızını iki taraftaki raporlarla karşılaştırın.
- Karma DPI/çoklu monitör, Türkçe Q/F, gerçek yerel fare devralma, uyku/uyanma ve ağ değişimi.
- Ayrı temiz Windows 10/11 kurulum, eski kurulum üzerine yükseltme ve kaldırma.
  installVerified hâlâ false. Kaynak testi bu kabulün yerine geçmez.
- Kurulum imzasız. Windows Akıllı Uygulama Denetimi engeli çözülmüş değildir.
  Setup'a çevirmek yayıncı imzası sağlamaz. Koruma kapatma veya sahte imza eklenmez.
- Kalıcı doğrulanmış cihaz kimliği ve bağımsız güvenlik denetimi tamamlanmadı.
  Elle karşılaştırılan oturum kodu veri bağlantısına dayanır; ayrı medya sertifikaları
  bu koda dahil değildir. Cihaz adı tek başına kimlik kanıtı değildir.

Karar: kararlı 1.0 ilan edilmez. Sabit 60 FPS, bütün cihazlar/ağlarda çalışma ve
AnyDesk/TeamViewer düzeyi güvenilirlik sözü verilmez. Serbest çizim, kesilen dosyaya
devam ve otomatik kurulum mevcut temel işlevler doğrulanana kadar sonraya kalabilir.

## Yayın ve temizlik

Yeni aday bütün kaynak/paket kontrollerinden geçmeden mevcut indirme silinmez.
Doğrulanan setup aynı v1.0.0-beta.1 yayınına, yeni yapı ve SHA-256 ile alınır.
GitHub dosyası, genel sürüm kaydı ve site paketi eşleştikten sonra eski yerel çıktı
silinir. Kullanıcı ayarları, alınmış dosyalar, kaynak, test ve lisans belgeleri korunur.
Kurulu uygulamalar kendiliğinden güncellenmez; iki bilgisayar da yeni setup'ı kurar.

Canlı site 15 Ekim tarayıcı kontrolünde HTTPS, CSS ve GitHub indirmesiyle açıldı.
Bu güncellemenin hosting dosyaları ayrıca yüklenmelidir; indirme düğmesi GitHub'daki
geçerli sürüm kaydını okur. Yüklenecek çıktı çalışma alanındaki RK-Screen-Site.zip'tir.

Kaynaklar: [WebRTC istatistikleri](https://www.w3.org/TR/webrtc-stats/),
[TURN](https://webrtc.org/getting-started/turn-server),
[Windows Akıllı Uygulama Denetimi](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions).

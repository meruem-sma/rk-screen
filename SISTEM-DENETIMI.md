# RK Screen 1.0.0-beta.1 — geliştirme ve doğrulama

Tarih: 2 Ekim 2026. Araştırma ve plan: [ANYDESK-KARSILASTIRMA.md](ANYDESK-KARSILASTIRMA.md), [RK-SCREEN-PLAN.md](RK-SCREEN-PLAN.md). Güvenlik sınırları: [GUVENLIK-MODELI.md](GUVENLIK-MODELI.md).

## Bu beta sürümü

- Görüntü kanalı kesintisinde veri oturumu korunarak kontrollü yeniden kurma; yerel girdiler bekletilir, yeni görüntü anahtarı ve ilk çözülen kare onayı olmadan açılmaz.
- Alıcı PeerJS bağlantı dinleyicilerinin oluşturulma sırası düzeltildi. En fazla iki otomatik toparlanma/60 saniye; görüntü yenilemenin ayrı zaman aşımı var.
- Ağ kapasitesine göre kademeli bitrate tavanı; sürekli CPU baskısında FPS hedefini düşürme ve gecikmeli geri yükseltme.
- Seçili ICE rotası, medya RTT, aralıklı paket kaybı; sayaç/akış değişimine dayanıklı gerçek FPS ve hız ölçümü. Eşzamanlı istatistik sorguları önlendi.
- Beta sürüm sıralaması ve yalnızca eski doğrulanmış ürün paketlerinin temizliği test edildi.
- Web sitesi ../rk-screen-web/dist içinde oluşturuldu; canlı hosting ve DNS henüz bağlanmadı. Plan: [OPTIMIZASYON-PLANI.md](OPTIMIZASYON-PLANI.md).

## Korunan önceki özellikler

- Paylaşan bilgisayarın adıyla uzak imleç; konum sorgusu 2 saniyelik bağlantı denetiminden ayrılarak 50 ms aralığa alındı.
- Paylaşan masaüstünde karşı bilgisayarın adıyla ikinci işaretçi. Konumlar 40 ms aralıkla birleştirilir; kanal doluysa biriktirilmez. İzleme modunda işaret etmek kontrol izni vermez.
- İşaretçi görünürlüğü paylaşan taraftan kapatılabilir. Pencere tıklamaları geçirir, odağı almaz; hareketsizlik, ekran geçişi ve oturum sonunda gizlenir/kapanır.
- Net metin için text kodlama ipucu; Akıcı hareket için motion ve 60 FPS/24 Mbps (1080p) hedefi. 4K'da bit hızı üst sınırı iki katına çıkar.
- Kaynak/iletilen/alınan çözünürlük ayrımı ve mevcutsa CPU/ağ sınırlaması. Kalite ayarları sıralı uygulanır; eski video oturumuna gecikmiş ayar gitmez.

## Sonuçlar

| Denetim                        | Sonuç                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Birim testleri                 | 28/28 geçti: izin, dosya, girdi, DPI, işaretçi geometrisi/iletileri, kalite, sürüm temizliği                                       |
| Arayüz                         | Onay, izinsiz girdi reddi, ikinci bağlantı, video anahtarı, ad güvenliği, koyu yerleşim ve ekran seçimi geçti                      |
| Otomatik görüntü toparlanması | Taklit edilen kesinti olayından sonra gerçek WebRTC yeniden kuruldu; girdi bekletildi, sohbet ve oturum onayı korundu |
| Uyarlanan gerçek kodlayıcı | Taklit edilen 2 Mbps ağ/CPU ölçümü ile gerçek göndericide 1,7 Mbps / 30 FPS tavanı doğrulandı; gerçek WAN testi değildir |
| Gerçek yerel PeerJS/WebRTC     | 640 × 360 → 800 × 600 ekran geçişi geçti                                                                                           |
| İsimli uzak imleç              | RK adı ve değişen konum 2 saniyelik denetimi beklemeden ulaştı                                                                     |
| İzleme modunda ikinci işaretçi | Enes adı oturumda korundu; işaretçi fare/klavye girdisi üretmedi                                                                   |
| Kodlayıcı hedefi               | Gerçek göndericide 60 FPS/24 Mbps ve motion; metin profilinde text doğrulandı                                                      |
| Çözünürlük göstergesi          | Kaynak ve iletilen boyutlar arayüze ulaştı                                                                                         |
| Windows işaretçi penceresi     | Etiket HTML olarak çalışmadı; tıklama geçirgenliği, odak almama, üstte kalma, içerik koruması ayarı, süre dolması ve kapanma geçti |
| Windows ekran yakalama         | Normal modda gerçek 1920 × 1080 yakalama geçti                                                                                     |
| Windows izin kapısı            | Eski/yanlış anahtar, duraklatılmış geçiş ve kapatılmış işaretçi reddedildi; kontrol izni olmayan işaretçi kabul edildi             |
| Önceki oturum işlevleri        | Metin sohbeti, teslim/yeniden deneme, pano, 100.123 bayt dosya ve ters yönde boş dosya geçti                                       |
| Ekran geçişi sınırları         | Yakalama hatası, iptal, geç tamamlanan yakalama, eski girdinin reddi ve bekleyen dosyanın korunması geçti                          |
| Açılış/toparlanma              | İkinci açılış ve renderer çökmesinden toparlanma geçti                                                                             |
| Bağımlılıklar                  | 2 Ekim son taramasında 293 kayıt ve 0 bilinen açık; bağımlılık sürümleri değişmedi                                          |

Sentetik küçük yazı/ince çizgi örneğinin 220 × 72 bölgesi kaynak ve çözülen video arasında karşılaştırıldı. Bu betanın son yerel ölçümü **39,8 dB PSNR** çıktı; son tekrar değeri `review/e2e-results.json` içindedir. Bu yalnızca kontrollü, yerel 640 × 360 akış ölçümüdür. Gerçek internet kalitesini veya AnyDesk'e üstünlüğü kanıtlamaz. 60 FPS hedefinin kodlayıcıya uygulandığı doğrulandı; iki fiziksel cihazda 60 FPS elde edildiği iddia edilmez.

Fare/klavye testleri kullanıcının gerçek masaüstüne olay enjekte etmez. Yerel WebRTC testindeki ekran/pano/girdi alıcısı yapaydır; dosya alıcısı ve video bağlantısı gerçektir. Gerçek Windows ekran yakalama ve pencere özellikleri ayrı testtir. Native günlüklerindeki geçersiz oturum/ekran hataları bilerek reddedilen isteklerdir.

## Paket ve temizlik

Kurulum: `dist/1.0.0-beta.1/RK-Screen-Setup-1.0.0-beta.1.exe`. Taşınabilir: `dist/1.0.0-beta.1/RK-Screen-Portable-1.0.0-beta.1.exe`.

Kurulum ve taşınabilir paket üretildi. 19 uygulama/varlık dosyası güncel kaynakla eşleşti; sertifika/anahtar/test dosyaları pakette bulunmadı. İki EXE için SHA-256 yeniden hesaplanıp listeyle eşleştirildi. release.json oluşturuldu; önceki 0.7.0 dağıtımı kaldırıldı. Kaynaklar ve kullanıcı verileri korundu. İki tarafta da 1.0.0-beta.1 kullanılması önerilir. Paketler kod imzasızdır.

## Kalan sınırlar

- Özel sinyalleşme/TURN ve doğrulanmış cihaz eşleştirme henüz yok; isim etiketi kimlik doğrulaması değildir.
- Windows paketleri imzasızdır. Gerçek kurulum/yükseltme döngüsü ve temiz Windows 10/11 matrisi tamamlanmadı.
- Gerçek iki cihazda karma DPI, çoklu monitör, Türkçe/İngilizce klavye, sistem sesi, düşük bant genişliği ve GPU çeşitleriyle saha testi gerekir.
- Windows içerik koruması, işaretçi penceresinin yakalanmasını önlemek için ayarlanır. Her Windows/GPU yakalama yolundaki görsel etkisi ayrıca sınanmalıdır.
- UAC güvenli masaüstü ve yönetici uygulamaları Windows tarafından sınırlandırılabilir. Uygulama bu korumaları aşmaz.
- İşaretçiler iki bağımsız Windows fare aygıtı değildir; işletim sistemi imleci tektir.


## Beta 1 son yayın kontrolü — 2 Ekim 2026

Tüm release zinciri yeniden geçti: 28 birim testi, arayüz, gerçek yerel WebRTC, Windows ikinci açılış/çökmeden toparlanma, işaretçi ve native ekran/izin testi. Uyumluluk modu ayrıca gerçek 1920×1080 yakalamayla doğrulandı. Ağ tavanının toparlanmada eski seviyesine ulaşamaması, kalıcı CPU baskısında 15 FPS hedefine inememesi ve görüntü yenileme sonrası ses düğmesi etiketi düzeltildi. Paketler 1.0.0-beta.1 olarak yeniden oluşturuldu. Son kapsam ve yayın kapıları BETA1-SON-KONTROL.md içindedir.

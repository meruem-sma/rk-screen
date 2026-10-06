# RK Screen Beta 1 — son kontrol

2 Ekim 2026 · Sürüm: **1.0.0-beta.1** · Windows x64

## Sonuç

Otomatik kontrollerde yayın paketinin oluşmasını engelleyen hata kalmadı.
Bu sonuç her internet, bilgisayar ve Windows kurulumunda hatasızlık garantisi
değildir. Paketler yeniden üretildi; gerçek fiziksel saha matrisi hâlâ açıktır.

## İncelemede düzeltilenler

1. Ağ düzeldikten sonra kalite tavanı son yükselme eşiğine takılıp eski sınırına
   ulaşamayabiliyordu. Toparlanma eşiği düzeltildi ve tam dönüş testi eklendi.
2. Sürekli CPU baskısında 60 FPS profili 30'da kalabiliyordu. Artık 15'e kadar
   kademeli düşer; temiz ölçümlerde 30 üzerinden 60'a döner.
3. Görüntü yenilemesinde ses açık olsa da düğme “Sesi aç” yazabiliyordu.
   Düğme metni ve erişilebilirlik durumu gerçek ses durumunu izler.
4. Gerçek Windows ekran/izin kontrolü ana release zincirine ve CI'ya eklendi.

## Geçen kontroller

| Alan | Kanıt ve sınırı |
| --- | --- |
| Birim testleri | 28/28; izinler, girdi, dosya, DPI, kalite, sayaçlar, sürüm sıralama |
| Arayüz | Onay, izinsiz girdi, ikinci bağlantı, sohbet güvenliği, kompakt görünüm |
| Yerel gerçek PeerJS/WebRTC | 640×360→800×600, otomatik toparlanma, eski görüntü anahtarının reddi, sohbet/pano/dosya |
| Uyarlama | Taklit edilen düşük ağ/CPU ölçümleri gerçek göndericide 1,7 Mbps/30 FPS tavanına dönüştü |
| Metin örneği | Son test 39,8 dB PSNR; yalnızca sentetik yerel örnek |
| Windows | İkinci açılış, renderer çökmesinden dönüş, işaretçi odak/tıklama/süre sınırları |
| Gerçek ekran | Normal ve --safe-mode yollarında 1920×1080 yakalama; gerçek masaüstüne girdi enjekte edilmedi |
| Bağımlılık taraması | Resmî npm, 293 kayıt, 0 bilinen açık; bağımsız kod güvenliği denetimi değildir |
| Paket | 19 güncel uygulama dosyası kaynakla eşleşti; test/sertifika/anahtar yok |
| Web sitesi | 1440/390/320 genişlik, %200 zoom, profil klavyesi, mobil menü, dosya/bağlantı ve 404 kontrolleri |

## Çalışmama veya düşük kalite nedeni olabilecek açık sınırlar

- Windows x64 gerekir. Yönetici uygulamaları, UAC güvenli masaüstü ve güvenlik
  ürünleri normal kullanıcı yetkisindeki kontrolü sınırlayabilir.
- İmzasız EXE, Windows yayıncı uyarısı oluşturabilir. Kod imzalama sertifikası yok.
- PeerJS Cloud ve genel STUN/TURN hizmetleri, NAT/firewall veya internet kesintisi
  bağlantıyı engelleyebilir. Özel sunucular ve doğrulanmış cihaz eşleştirme yok.
- CPU/GPU, Wi-Fi, düşük bant genişliği ve yüksek çözünürlük gerçek FPS'yi sınırlar.
  Statik ekranda düşük FPS tek başına bozukluk değildir.
- İki fiziksel cihazla farklı ağlarda uzun süreli kullanım, karma DPI/çoklu
  monitör, sistem sesi ve temiz Windows kurulum/yükseltme matrisi tamamlanmadı.

## İlk beta yayın adımları

1. Yeniden üretilen iki EXE ve SHA256SUMS.txt birlikte kullanılmalı. Önceki Beta 1
   dosyalarıyla karıştırılmamalı; aynı sürüm etiketi kullanıcı isteğiyle korundu.
2. İki bilgisayara güncel paket konup gerçek ağda onay, görüntü, klavye/fare,
   sohbet, dosya, yeniden bağlanma ve oturumu bitirme denenmeli.
3. Site dosyaları hazırdır; DNS/hosting ve iki gerçek indirme URL'si eksiktir.
   ../rk-screen-web/HOSTING-KURULUM.md uygulanır. Gizlilik sayfasının iletişim ve
   hosting bilgileri canlı yayın öncesi tamamlanır.
4. Beta olarak paylaşılabilir; “her sistemde hatasız”, “sabit 60 FPS” veya
   bağımsız güvenlik denetiminden geçti iddiası kullanılmaz.

Bu çalışma kamuya yükleme veya DNS değişikliği yapmadı.

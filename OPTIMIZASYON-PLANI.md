# RK Screen — 1.0.0-beta.1 çalışma planı

Tarih: 2 Ekim 2026. Kapsam: mevcut Electron/PeerJS uygulaması, Windows x64,
bağlantı devamlılığı, görüntü ve ölçümler, beta dağıtımı. Web sitesi ayrı bir
temel klasörüdür; bu aşamada sayfa, sunucu veya yayın yapılmaz.

## İnceleme ve öncelikler

| Alan | Mevcut durum / sorun | Bu betanın işi |
| --- | --- | --- |
| Görüntü bağlantısı | Medya hatası veri oturumunu da kapatıyor | Onaylı veri kanalı açıkken sınırlı otomatik görüntü yenileme |
| Güvenli kontrol | Görüntü anahtarı ve ilk kare onayı var | Kesintide girdiyi hemen beklet; yeni kare gelmeden açma |
| Çözünürlük | Kaynak çözünürlüğü ve 1:1 görünüm var | Dengeli/netlik profilinde çözünürlüğü koru; ağ tavanını ölçülü ayarla |
| FPS | 24/30/60 hedefleri, gerçek hız donanım/ağa bağlı | Sürekli işlemci baskısında hedefi azalt; düzelince gecikmeli yükselt |
| Ölçüm | Sayaç değişimi ve eksik FPS sorunlu | Akış kimliği/sayaç sıfırlama kontrolü; gerçek çözülen karelerden FPS |
| Ağ | Ping var; seçili rota ve medya RTT bilgisi yok | Seçili ICE rotası, medya RTT ve aralıklı paket kaybını göster |
| İstatistik işi | Asenkron ölçümler üst üste binebilir | Tek ölçüm işi; oturum/akış değişince eski sonucu at |
| Dağıtım | Eski sürüm temizliği yalnızca x.y.z destekliyor | Beta sıralamasını test et; başarılı paketten sonra eski doğrulanmış çıktıyı kaldır |
| Site | Henüz kurulmadı | Tema/font, doğrulanabilir ürün bilgisi, içerik ve SEO planı |

## Uygulama sırası ve kabul koşulları

1. Bağlantı: kesintide host girdisini durdur. Dört saniyelik bekleme ardından
   yeni görüntü anahtarıyla mevcut onay içinde yeniden bağlan. Bir dakikada en
   fazla iki otomatik deneme; yeni görüntü 20 saniyede ulaşmazsa oturumu kapat.
   Veri kanalı koparsa eski onayla yeni oturum açma. Sohbet ve dosya aktarımı
   yalnızca veri kanalı sağlıklı kaldığı sürece korunur.
2. Kalite: Chromium'un tıkanıklık kontrolünü kullanmaya devam et. İki ardışık
   düşük kapasite ölçümünde bitrate tavanını indir; beş iyi ölçümden sonra küçük
   adımlarla toparla. Eksik ölçümü sıfır kapasite sayma. Statik ekrandaki düşük
   FPS'yi arıza sayma. İşlemci baskısında 60→30, 30/24→15 hedefe geç; beş temiz
   ölçümden sonra eski hedefi dene. Kaynak ekran çözünürlüğünü değiştirme.
3. Ölçümler: gerçek FPS ile hedef FPS'yi ayır. Bilinmeyeni “—” göster. Başka
   akışın sayaçlarını birbirinden çıkarma. Seçili ICE aday çiftini kullan.
4. Doğrulama: deterministik kötü/iyi/eksik ağ ölçümleri; gerçek yerel WebRTC ile
   kesinti sonrası yeni görüntü ve kontrol kilidi; mevcut sohbet, dosya, ekran
   değişimi ve Windows açılış kontrolleri. Paket içeriği ve SHA-256 doğrulaması.
5. Beta: 1.0.0-beta.1 kurulum ve taşınabilir çıktısı. Yeni çıktı doğrulanmadan
   eski çıktı silinmez. Kaynaklar ve kullanıcı ayarları korunur.

## Beta sonrası fiziksel saha matrisi

Bu kontroller iki gerçek bilgisayar ve ağ koşulları gerektirir; yerel test
sonuçları bu sütunun tamamlandığı anlamına gelmez.

| Senaryo | Ölçüm / hedef | Durum |
| --- | --- | --- |
| 1080p kablolu LAN, hareketli ekran, 30 dk | Gerçek FPS, p95 RTT, donma süresi; artan bellek olmaması | Bekliyor |
| 1440p/4K ve %125/%150/%200 DPI | Okunabilir metin, doğru fare koordinatı, gönderilen çözünürlük | Bekliyor |
| Wi-Fi, 2/5/10 Mbps ve %1/%5 kayıp | Tavanın düşmesi, toparlanmada salınım olmaması | Bekliyor |
| 3–10 saniye ağ kesintisi | Veri bağlantısı kalırsa kontrollü görüntü dönüşü | Bekliyor |
| Farklı NAT ve TURN üzerinden 60 dk | Rota, relay maliyeti, tekrar bağlanma | Bekliyor |
| Düşük güçlü CPU, 60 FPS profili | Aşırı CPU yükünde daha düşük sürdürülebilir hedef | Bekliyor |

## Yayın öncesi kalan sınırlar

Sabit 60 FPS, her internette kesintisizlik veya AnyDesk'ten üstün performans
iddiası yapılmaz. Kod imzası, özel sinyal/TURN altyapısı, bağımsız güvenlik
denetimi ve doğrulanmış cihaz kimliği henüz tamamlanmış değildir.
UAC/güvenli masaüstü ve gözetimsiz erişim mevcut izin modelinin kapsamı dışındadır.

Teknik dayanaklar:
- [W3C WebRTC ölçümleri](https://www.w3.org/TR/webrtc-stats/)
- [MDN bağlantı durumları](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState)
- [MDN ICE yeniden başlatma ve müzakere](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce)

## Bu betada tamamlananlar

- Planlanan sınırlı medya toparlanması, güvenli kontrol bekletme, ağ/CPU uyarlaması ve yeni ölçüm göstergeleri uygulandı.
- 27 birim testi geçti. Gerçek yerel PeerJS/WebRTC testi: otomatik toparlanma, korunan sohbet/onay, yenilenen görüntü anahtarı, gerçek kodlayıcıya uygulanan uyarlama, ekran geçişi ve dosya aktarımı geçti.
- Kesinti olayı ve düşük ağ/CPU ölçümleri test tarafından taklit edildi; sonraki görüntü aktarımı ve gönderici ayarları gerçek WebRTC üzerindeydi. Bu, fiziksel WAN saha testinin yerine geçmez.
- Yerel sentetik metin örneği: 39 dB PSNR. Test akışı 10 FPS üretir; 60 FPS hedefinin uygulanması doğrulandı, gerçek 60 FPS performansı ölçülmüş sayılmaz.
- Arayüz, Windows ikinci açılış/çökmeden toparlanma, işaretçi penceresi ve gerçek 1920×1080 ekran yakalama kontrolleri geçti. Testler gerçek masaüstüne klavye/fare olayı enjekte etmez.
- Kurulum ve taşınabilir 1.0.0-beta.1 paketleri hazır; 19 paketlenmiş dosya kaynakla eşleşti, iki SHA-256 doğrulandı. Eski 0.7.0 dağıtımı temizlendi.
- Web temeli ayrı ../rk-screen-web klasöründe: tema/font, ürün gerçekleri, içerik ve SEO planı. Web sayfası oluşturulmadı.

Tam sonuçlar: [SISTEM-DENETIMI.md](SISTEM-DENETIMI.md). Fiziksel saha matrisi ve yayın öncesi sınırlar yukarıda açık kalır.


## Son kontrol güncellemesi

Beta 1 yeniden paketlendi. 28 birim testi ve tüm release zinciri geçti; uyumluluk modunda gerçek ekran yakalama ayrıca geçti. Süren CPU baskısı 60→30→15, toparlanma 15→30→60 basamaklarını kullanır. Bitrate toparlanmasının profil tavanına ulaşabilmesi düzeltildi. rkscreen.com.tr için web sayfaları da artık hazır; canlı yayın ve indirme URL bağlantıları henüz yapılmadı. Ayrıntı: BETA1-SON-KONTROL.md ve ../rk-screen-web/HOSTING-KURULUM.md.

# Beta 2 bağlantı ve görüntü düzeltmeleri

13 Ekim 2026. 1.png ve 2.png ekran görüntülerinde 60 FPS profiliyle 640×360 / 3 FPS ve 1080p / 14 FPS, yaklaşık 370 ms gecikme ve %2–4 kayıp görüldü. Ekran görüntüleri nedenin tamamını göstermez; farklı internetlerde ve VPN olmadan yaşandığı belirtildi.

## Değişiklikler

- Taşıma katmanının tahmini bit hızını tekrar %85'e indirip üst sınırı aşağı çeken ikinci denetleyici kaldırıldı. WebRTC'nin kendi tıkanıklık denetimi korunur; seçilen profil maksimum bütçeyi belirler. Ağ tahmini fiziksel hat kapasitesi ölçümü gibi kullanılmaz.
- Görüntü profilleri çözünürlüğü koruma tercihi kullanır. Akıcılık profilinde uzun süren ağ kısıtında FPS hedefi 30 olur ve kaynak yeterince büyükse en çok 1.5 ölçek uygulanır; 1080p için 720p. Küçük kaynaklar daha da küçültülmez. Net metin profili tam boyutu korur. Hedef FPS, sabit FPS garantisi değildir; hareketsiz masaüstü az kare üretebilir.
- Fare hareketi ve iki yönlü imleç telemetrisi aynı onaylı WebRTC veri bağlantısında ayrı, sırasız ve yeniden iletim yapmayan kanala taşındı. Sohbet/dosya kanalının kuyruğu fare hareketini bekletmez. Eski hareketler biriktirilmez; klavye ve basma/bırakma olayları güvenilir kanalda kalır.
- Paylaşan kişinin son yerel imleç konumu, uzaktan enjekte edilen hareketlerden ayrı tutulur. İzleyen kendi fare imlecini ve karşı bilgisayar adıyla gösterilen ayrı işaretçiyi görür. Paylaşan tarafta isimli uzak işaretçi hareket durduğunda kalp atışıyla görünür kalır. Gerçek Windows masaüstünde tek sistem imleci vardır; ikinci işaretçi görsel katmandır. Yerel kullanıcının hareketine öncelik korunur.
- Kısa medya kesintisi, yeni çözülen kare doğrulanınca mevcut görüntü oturumunda devam edebilir. Uzun kesintilerde sınırlı yeniden kurma, yeni video anahtarı ve ilk kare ulaşana kadar girdi engeli korunur. İlk medya bağlantısı başarısızlığı da toparlama kapsamındadır.
- PeerJS bağlantı hizmeti kaybında sınırlı artan aralıklarla yeniden bağlanılır. Mevcut onaylı veri oturumu sırf hizmet bağlantısı kesildi diye yok edilmez.
- Hard-link desteklemeyen Windows/dosya sistemlerinde dosya kaydetme, mevcut dosyayı ezmeyen özel kopyalama yöntemine döner.
- Rapor kaydet düğmesi son 120 kalite/bağlantı ölçümünü yerel JSON'a kaydeder. IP, cihaz kimliği/adı, sohbet, ekran, dosya içeriği ve TURN parolaları filtrelenir; hiçbir rapor otomatik gönderilmez.

## Sürüm ve kabul

Beta 2, protokol 8 kullanır. Her iki bilgisayar da Beta 2'ye güncellenmelidir; Beta 1 ile oturum kurulmaz. Aynı cihaz kimliği ve yerel tercihler korunur.

40 birim testi; gerçek yerel WebRTC ile veri kuyruğu doluyken hareket, hareketsiz işaretçi kalp atışı, kısa/uzun kesinti, sohbet/dosya ve Türkçe klavye akışları doğrulandı. Arayüz, ayrı imleç penceresi, açılış ve gerçek Windows ekran yakalama kontrolleri de uygulanır. Yerel başarılı test, kullanıcının iki farklı internetindeki gecikme/FPS sorununu tamamen doğrulamaz.

## Dış ağ sınırı

Eski openrelay.metered.ca adresi bu makinenin DNS yanıtında 192.0.2.1 örnek adresine dönüyor; eski genel kullanıcı/parola ile geçerli relay adayı elde edilemedi. Sağlayıcının güncel belgesi TURN kimlik bilgilerinin hesap/API ile alınmasını tarif ediyor ve ayrıca staticauth örneği veriyor. Bu örnek için de 35 saniyelik denemede relay adayı çıkmadı (701). Geçersiz varsayılan kaldırıldı; STUN ile doğrudan bağlantı korunur. Ayarlara açıkça seçilen TURN sunucusu girilebilir; parola Windows güvenli saklama hizmetiyle şifrelenir. Kullanıcıya hiçbir ücret veya hesap açma işlemi uygulanmadı. Bazı NAT/firewall çiftleri geçerli relay olmadan bağlanamaz; bu engelin giderildiği iddia edilmez.

- [WebRTC istatistikleri](https://www.w3.org/TR/webrtc-stats/)
- [WebRTC kodlayıcı tercihleri](https://www.w3.org/TR/webrtc/)
- [OpenRelay güncel kullanım](https://www.metered.ca/tools/openrelay/)

Yeni setup imzasız beta olarak hazırlanır. Windows yayıncı güveni ve gerçek iki fiziksel cihazda farklı ağ testi ayrı kabul koşullarıdır. Yeni GitHub dosyası ve güncel sürüm kaydı doğrulanmadan eski yayın silinmez.

13 Ekim 2026 kurulum denemesi: Windows “Uygulama Denetimi ilkesi bu dosyayı engelledi” hatası verdi; installer başlayamadı. Beta 2 canlı indirmenin yerine geçirilmez ve Beta 1 silinmez. GitHub'a yalnızca taslak aday hazırlanır. Setup olarak paketleme bu güven engelini ortadan kaldırmamıştır.

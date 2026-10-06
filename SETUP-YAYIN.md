# Beta 1 kurulum yayını

6 Ekim 2026. Bakım sorumlusu taşınabilir dağıtımı kaldırıp setup sunulmasını istedi. Sürüm numarası 1.0.0-beta.1 olarak korundu. Yeni paket güncel kaynakları, MIT lisansını ve üçüncü taraf bildirimlerini içerir.

- Dosya: RK-Screen-Setup-1.0.0-beta.1.exe
- Boyut: 112538420 bayt
- SHA-256: 2bf6c99815c54e6293f74a065579c71e0810e503d33acda931d639790e167e25
- İmza: NotSigned; site ve yayın kaydı signed:false gösterir.
- 34 birim testi geçti. Paket içeriği güncel 21 kaynak/varlık/lisans dosyasıyla karşılaştırıldı; özel anahtarlar ve geliştirme dosyaları pakete girmedi.
- Yeni setup ayrı klasöre kuruldu; kurulan app.asar adayla eşleşti, kaldırıcı oluştu ve kurulu RK Screen penceresi yanıt verdi.
- Site setup bağlantısı, gelecekteki sürüm kaydı, hatalı URL/erişilemeyen kayıt, masaüstü/mobil boyutlar ve yerel HTML açılışı test edildi.

Bu doğrulama yalnızca mevcut bilgisayardaki kurulum/açılışı gösterir. İki farklı fiziksel cihazla saha testi veya Windows Smart App Control bulunan tüm cihazlarda çalışabilirlik garantisi değildir. Kurulum biçimi Windows güven kontrolünü kaldırmaz.

Yayın sırası: yeni setup yüklenir, GitHub boyutu/digest ve gerçek indirme kontrol edilir, checksum ve güncel sürüm kaydı güncellenir, sonra eski taşınabilir asset ve yerel eski paket çıktısı kaldırılır. Güncel site ZIP'i hosting'e yüklenmelidir; eski site dosyaları taşınabilir kayıt bekler.

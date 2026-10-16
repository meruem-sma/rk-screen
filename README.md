# RK Screen

Windows x64 için kullanıcı onayıyla ekran paylaşımı ve uzaktan destek. Koyu Türkçe
arayüz, iki isimli görsel işaretçi, fare/klavye kontrolü, sohbet ve onaylı dosya aktarımı.
MIT lisansıyla açık kaynak.

**Güncel sürüm: Beta 1 / 20261016.3.** GitHub setup ve güncelleme kaydı yenilendi.
Yeni setup indirildikten sonra boyut/SHA-256 karşılaştırıldı; eski setup kaldırıldı.
InfinityFree'ye yüklenecek site ZIP'i hazır; hosting'e yükleme henüz yapılmadı.

## Kaynaktan çalıştırma

Windows 10/11 x64 ve Node.js 22.12+ gerekir. İndirilen bağımlılıklar temizlikte
kaldırıldığı için ilk açılıştan önce yeniden hazırlanır:

```powershell
npm ci
npm run check:source
npm start
```

check:source yalnızca sözdizimini kontrol eder. Kullanıcının açık isteğiyle test
kaynakları kaldırıldı; bu komut işlev veya cihaz uyumluluğu testi değildir.

Gelecekte imzasız beta adayı oluşturmak için npm run release:beta kullanılır.
Bu komut yeni adayı review/setup-candidate/ altında üretir; otomatik yayın yapmaz.
Adaya gerçek iki cihazda bağlantı ve temiz Windows kurulumu kabulü ayrıca gerekir.
İmzalı dağıtım hattı gerçek imzalama kimliği ister. Mevcut ücretsiz setup imzasızdır;
Windows güven kontrollerini kaldırmaz veya korumaları devre dışı bırakmaz.

## Kullanım

İki cihazda da aynı güncel yapıyı kullanın. Karşı kimliği girin; ekran sahibi
monitör ve izinleri seçerek isteği kabul eder. Ortak doğrulama kodunu başka güvenilir
iletişim yoluyla karşılaştırın. Ekran sahibi kontrolü duraklatabilir veya oturumu bitirebilir.
Otomatik profil genel kullanım, Net metin küçük yazılar, Düşük veri kısıtlı ağlar içindir.
Hedef FPS gerçek FPS garantisi değildir. Son cihazlar ve favoriler onayı atlatmaz.
F11 tam ekranı değiştirir. Ctrl+Alt+Shift+Boşluk uzak girdiyi bırakır, izlemeye ve
pencere moduna döner. Kontrolün bekleme nedeni oturum başlığında gösterilir.
Dosya başına 512 MB, kuyrukta en fazla 20 dosya ve her dosyada ayrı alıcı onayı vardır.

## Bu klasörde ne var?

src uygulama kodu; assets logo kaynakları; scripts kaynak/paket/imza araçları;
package.json ve package-lock.json tekrar kurulabilir bağımlılıklar; .github gelecekteki
kaynak/derleme iş akışlarıdır. Güvenlik, gizlilik ve lisans belgeleri korunur.
Güncel setup ve paket içeriği dist/1.0.0-beta.1 altındadır; kaynak deposuna girmez.
Kalıcı test kaynakları, eski karşılaştırma notu ve editör önerileri yoktur.
Geliştirme için yeniden kurulan node_modules sürüm kontrolüne veya site paketine girmez.

Çalışma alanında yalnızca bu proje klasörü ve iki site arşivi bırakıldı:

- ../RK-Screen-Site.zip: mevcut, doğrudan htdocs'a yüklenebilecek site paketi.
- ../RK-Screen-Web-Kaynak.zip: site kaynakları ve yayın araçları; doğrudan hosting'e yüklenmez.
  Çalışma alanına açıldığında rk-screen-web/ klasörünü geri oluşturur. GitHub yayın
  araçları için resmî GitHub CLI kurulu olmalıdır; çalışma alanındaki eski CLI kopyası silindi.

## Açık sınırlar

Çalışan varsayılan TURN yoktur; bazı ağ çiftleri doğrudan bağlanamaz. Bu paketin
Windows 7/8, 32 bit Windows, ARM64 yerel sürümü, macOS veya Linux desteği yoktur.
Eski sürücüler, yönetici pencereleri ve güvenli masaüstü kontrolü sınırlayabilir.
Kalıcı cihaz kimliği, bağımsız güvenlik denetimi ve kesilen dosyaya devam tamamlanmadı.

Araştırma, yapılan değişiklikler ve kalan kabul işleri: [GUNCEL-DURUM.md](GUNCEL-DURUM.md).
Kontrol, iki imleç, tam ekran, bağlantı, görüntü ve dosya aktarımı için sıralı çalışma ve kabul planı: [GELISTIRME-PLANI.md](GELISTIRME-PLANI.md).
[Güvenlik modeli](GUVENLIK-MODELI.md) · [Gizlilik](PRIVACY.md) · [Güvenlik bildirimi](SECURITY.md)

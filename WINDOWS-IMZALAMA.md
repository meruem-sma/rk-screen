# RK Screen Beta 1 — Windows kod imzalama

6 Ekim 2026. Sürüm **1.0.0-beta.1** olarak korunmuştur.

## Doğrulanan sorun

Kullanıcının ekranında Windows Akıllı Uygulama Denetimi yayıncıyı doğrulayamadığı için taşınabilir EXE'yi engelliyor. Hem dış taşınabilir EXE hem `win-unpacked/RK Screen.exe` için Authenticode sonucu `NotSigned`. Yerel kullanıcı ve makine sertifika depolarında kod imzalama sertifikası bulunamadı; kullanıcı da imzalama hesabı/sertifikası olmadığını doğruladı.

Yayındaki dosya değişmedi:

- `RK-Screen-Portable-1.0.0-beta.1.exe`
- 116737442 bayt
- SHA-256: `de1e5bf961153e61955004cda8d358fce17ab14a91aa296f7d7658ca605c5356`

Bu ekran uygulamanın çalışırken çökmesini değil, Windows'un çalıştırmaya izin vermemesini gösterir. Uygulama içi kod değişikliği, güvenli mod, EXE adını değiştirmek veya aynı imzasız dosyayı yeniden yüklemek güvenilir yayıncı imzası sağlamaz. Web sitesinin TLS/SSL sertifikası kod imzalama için kullanılamaz. Kendi imzaladığımız sertifikayı kullanıcıların güvenilir kök deposuna ekletmek kamuya dağıtım çözümü olarak kullanılmaz.

## Paketleme düzeltmesi

- Eski işlem yalnızca dış EXE'yi sonradan imzalıyor ve sertifika yoksa başarılı çıkıyordu. Yeni yayın derlemesi imzalama kimliği olmadan çıktıları değiştirmeden durur.
- electron-builder, uygulama EXE'sini, DLL'leri ve yerel `.node` modüllerini paketlemeden önce imzalar; dış taşınabilir/kurulum EXE'leri de imzalanır. Windows x64 paketine diğer işletim sistemi Koffi ikilileri alınmaz.
- `scripts/sign.ps1` artık son doğrulamayı yapar: iç/dış çalıştırılabilir dosyaların imzaları geçerli ve zaman damgalı değilse yayın zincirini durdurur. Özel anahtarları dışarı çıkarmaz.
- Yerel Windows sertifika deposundaki kimlik için `RKSCREEN_SIGN_THUMBPRINT`; uygun sertifika dosyası tabanlı altyapı için `CSC_LINK` ve `CSC_KEY_PASSWORD` kullanılabilir. Eski `RKSCREEN_SIGN_CERT` / `RKSCREEN_SIGN_PASSWORD` isimleri de builder'a aktarılır. Anahtar/parola sohbete veya Git'e konmaz.
- CI imzalama kimliğini GitHub Secrets üzerinden bekler; kimlik verilmeden imzasız yayın üretmez. Bulut/HSM hizmeti seçilirse sağlayıcının imzalama entegrasyonu ayrıca ayarlanmalıdır.

Bu hazırlık, imzalı paket üretildiği veya Smart App Control testinin geçtiği anlamına gelmez. Gerçek sertifika olmadığından başarılı imzalama yolu henüz çalıştırılamadı.

## Sertifika edinme

Güncel hizmet adayı, fiyat ayrımı ve Windows bağlantı adımları [IMZA-BASVURU.md](IMZA-BASVURU.md) dosyasında hazırlanmıştır. Sertifika deposundaki kimlik seçildiğinde paketleme başlamadan önce erişim, tarih, özel anahtar bağlantısı ve kod imzalama amacı da denetlenir.

Taşınabilir EXE dağıtımını korumak için Windows'un güvendiği sağlayıcıdan kod imzalama kimliği gerekir. Sağlayıcı kimlik doğrulaması, uygunluk ve genellikle ücret ister. Satın alma/hesap açma bu çalışma kapsamında yapılmadı.

Microsoft'un Artifact Signing hizmetinin ülke/başvuru türü kısıtları vardır; Türkiye'deki bireysel geliştirici için kullanılabileceği varsayılmamalıdır. Diğer sağlayıcıların başvuru koşulları ayrıca kontrol edilmelidir.

Alternatif olarak Microsoft Store'a **MSIX** dağıtımında Microsoft paketi imzalar. Bu, mevcut doğrudan taşınabilir EXE indirme akışından farklıdır ve ayrı paketleme/mağaza kabul süreci gerektirir. Açık kaynak projeler için uygunluk denetimi olan SignPath Foundation seçeneği de vardır; RK Screen'in açık kaynak lisans kararı henüz verilmemiştir.

## Aynı Beta 1'i yeniden yayımlama

1. İmzalama kimliği güvenli biçimde yapılandırılır; tüm testler ve `npm run dist:portable` çalıştırılır.
2. İç/dış imzalar ve zaman damgaları doğrulanır. Akıllı Uygulama Denetimi açık Windows 11 cihazında gerçek indirilmiş paket sınanır; imza başka güvenlik/itibar kararlarını tamamen ortadan kaldırma garantisi değildir.
3. Yeni EXE ve SHA-256 değerleri üretilir. **Eski hash yeni dosyayla kullanılamaz.**
4. GitHub `v1.0.0-beta.1` yayınının taşınabilir EXE ve checksum varlıkları birlikte değiştirilir; yayın notuna yeniden paketleme tarihi ve imza durumu yazılır. Yayın değişmezliği açıksa aynı etikette değişim yapılamayabilir; önce GitHub durumu kontrol edilir.
5. Web `release.json` boyut/hash/URL alanları güncellenir, yerel önizleme kaydı ve RK-Screen-Site ZIP'i yeniden üretilir. İmzalı dosya doğrulanmadan sitedeki uyarı kaldırılmaz.
6. InfinityFree'de güncel site içeriği yüklenir; halka açık indirme ve hash eşleşmesi yeniden kontrol edilir.

## Resmî kaynaklar

- https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control
- https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/overview
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options

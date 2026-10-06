# Yayın imzasını tamamlama

Güncel seçim açık kaynak/GitHub EXE yoludur. Ücretsiz başvuru hazırlığı [SIGNPATH-BASVURU.md](SIGNPATH-BASVURU.md) içindedir. Aşağıdaki ücretli hizmet bilgileri alternatif olarak korunmuştur; ücretli başvuru yapılmadı.

6 Ekim 2026. Yerel Windows sertifika depolarında kullanılabilir kod imzalama kimliği bulunamadı. Mevcut Beta 1 imzasızdır; bu belge sorunun çözüldüğü anlamına gelmez.

Taşınabilir EXE akışı için bir aday **Certum Standard Code Signing in the Cloud** hizmetidir. Ürün sayfasında başlangıç fiyatı **209 EUR** gösteriliyor; dönem, vergi, stok ve Türkiye'den kimlik doğrulama uygunluğu sipariş öncesinde sağlayıcıdan teyit edilmelidir. Ana sayfadaki 139 EUR başlangıç fiyatı, kendi kartı/okuyucusu olanlar için ayrı ürüne aittir. Satın alma veya ücretli hesap açma yapılmadı.

Standart sertifika bireysel geliştirici veya şirket için düzenlenebilir. Bireysel başvuruda kimlik doğrulamasına ek olarak başvuru sahibi adına adres belgesi istenir. Belgeleri sağlayıcının hesabında kendiniz yükleyin; sohbete kimlik, şifre veya özel anahtar göndermeyin. Açık kaynak ürününe uygunluk sağlayıcının güncel şartlarına göre ayrıca değerlendirilir.

## Kimlik onaylandıktan sonra

1. Sağlayıcının resmî SimplySign mobil ve masaüstü uygulamalarını kurup hesabınıza bağlanın. Hizmetin Windows sertifika listesinde gösterdiği kod imzalama sertifikasının parmak izini alın. Özel anahtar dışarı çıkarılmaz.
2. `menzil` klasöründeki PowerShell oturumunda aşağıdaki değişkene yalnızca 40 haneli sertifika parmak izini yazın; bu bir parola değildir:

```powershell
$env:RKSCREEN_SIGN_THUMBPRINT = 'BURAYA_40_HANELI_SERTIFIKA_PARMAK_IZI'
npm run check:signing
npm run release
```

3. Paketleme öncesi kontrol sertifikanın erişilebilir, tarihinin geçerli, kod imzalama amaçlı ve özel anahtarla bağlantılı olmasını denetler. Paketleme iç/dış yürütülebilirleri imzalar; son denetim geçerli imza ve zaman damgası ister. Sağlayıcının bağlantısının imzalama boyunca açık kalması gerekir. Bu yol gerçek sertifika olmadığı için henüz başarıyla denenmedi.
4. Akıllı Uygulama Denetimi açık ayrı Windows bilgisayarda gerçekten indirilen paketi sınayın. Ardından EXE, dosya özeti ve GitHub güncel sürüm kaydı birlikte yayımlanır. İmza tek başına bütün Windows uyarılarının kaybolacağını garanti etmez.

Yerel test için çalışma alanındaki `RK-Screen-Test.cmd` kaynak dosyalarını kullanır. Halka dağıtılan EXE'nin yerine yayımlanmaz.

## Resmî kaynaklar

- [Standart bulut ürünü ve güncel fiyat](https://shop.certum.eu/standard-code-signing-in-the-cloud.html)
- [Başvuru belgeleri](https://support.certum.eu/en/code-signing-required-documents/)
- [SimplySign ve SignTool bağlantı kılavuzu](https://files.certum.eu/documents/manual_en/CS-Code_Signing_in_the_Cloud_Signtool_jarsigner_signing.pdf)
- [Microsoft Smart App Control imzalama koşulları](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control)

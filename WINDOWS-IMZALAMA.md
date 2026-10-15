# RK Screen Beta 1 — Windows kod imzalama

15 Ekim 2026. Tek dağıtım `1.0.0-beta.1`, yapı `20261015.2`, Windows x64 NSIS setup.
Güncel dosya özeti `dist/1.0.0-beta.1/SHA256SUMS.txt` içindedir.

## Mevcut karar

Paket imzasızdır. Bakım sorumlusu Windows'un engelleyebileceğini bilerek ücretsiz,
başvuru gerektirmeyen setup dağıtımını seçti. Ücretli hizmet satın alınmaz, hesap
başvurusu yapılmaz. Eski taşınabilir paket ve başvuru taslakları kaldırıldı.
Güncel özellikler ve sınırlar [GUNCEL-DURUM.md](GUNCEL-DURUM.md) içindedir.

Setup biçimi Windows Akıllı Uygulama Denetimi kararını kaldırmaz. Web sitesinin
TLS sertifikası uygulamaya yayıncı imzası sağlamaz. Windows korumaları değiştirilmez;
yerel geliştirme çalıştırıcısı dağıtılan setup'ın imzalandığı anlamına gelmez.

## Korunan derleme yolları

- `npm run release:beta`: testleri çalıştırır ve açıkça imzasız beta adayı üretir.
  Çıktı `review/setup-candidate/1.0.0-beta.1/` altındadır. Güncel yayını doğrudan ezmez.
- `npm run release` ve `npm run dist:setup`: güvenilir kod imzalama kimliği ister;
  kimlik yoksa durur. Bu yol gelecekte gerçek kimlik sağlanırsa kullanılabilir.
- `scripts/signing-config.cjs` ve `scripts/signing-preflight.cjs` yapılandırmayı,
  `scripts/check-signing-store.ps1` sertifika deposunu denetler.
- `scripts/sign.ps1` iç/dış çalıştırılabilir dosyaların geçerli, zaman damgalı
  imzalarını doğrular. İmza anahtarları kaynak koduna veya siteye konmaz.
- Desteklenen ayarlar `RKSCREEN_SIGN_THUMBPRINT` veya `CSC_LINK` /
  `CSC_KEY_PASSWORD`; eski `RKSCREEN_SIGN_CERT` / `RKSCREEN_SIGN_PASSWORD`
  eşlemesi de korunur. Parola ve özel anahtar sohbete gönderilmez.

Gerçek imzalama kimliği olmadığı için başarılı imzalama yolu doğrulanmış değildir.
İmzalı bir paket üretilmeden sitedeki imza açıklaması kaldırılmaz.

## Yayını yenileme

Aday test edilir, paket içeriği doğrulanır, güncel setup ve SHA-256 birlikte GitHub'a
alınır. Yayın kaydı doğrulanmadan eski dosya silinmez. Site sürüm kaydı ve ZIP'i
`../rk-screen-web/scripts/` içindeki yayın araçlarıyla güncellenir; ayrıntılı sıra
[web yayın rehberindedir](../rk-screen-web/release-publication/GUNCEL-SURUM.md).
Kurulu uygulamalar kendiliğinden güncellenmez; iki bilgisayar da güncel setup'ı kurar.

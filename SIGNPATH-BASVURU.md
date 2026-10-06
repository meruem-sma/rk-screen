# Ücretsiz kod imzalama başvurusu

6 Ekim 2026. Kaynakların MIT lisansıyla yayımlanması için hazırlık yapıldı. SignPath kabulü, hesap kurulumu veya üretim imzası henüz yoktur. Foundation, projeleri kendi değerlendirmesiyle kabul eder; yeni bir projenin kabulü garanti değildir.

## Başvuruda kullanılacak bilgiler

- Proje: RK Screen
- Kaynak deposu: https://github.com/meruem-sma/rk-screen
- İndirme sayfası: https://github.com/meruem-sma/rk-screen-downloads
- Ürün sitesi: https://rkscreen.com.tr/
- Lisans: MIT
- Bakım sorumlusu: GitHub meruem-sma
- İmzalama politikası: CODE-SIGNING-POLICY.md
- Gizlilik: PRIVACY.md
- Mevcut dağıtım: Windows x64, taşınabilir NSIS EXE, 1.0.0-beta.1, imzasız.

## Başvuru açıklaması

RK Screen is a new open-source Windows remote support application using Electron, WebRTC/PeerJS and Koffi. It supports user-approved screen sharing, permission-based mouse and keyboard control, session chat, accepted file transfer and optional clipboard/audio sharing. There is no unattended access or Windows security bypass. The current portable Beta 1 is unsigned and can be blocked by Smart App Control. We seek Foundation review for free signing of verifiable builds from our GitHub source repository. This is a new project; we do not claim an established user base, independent security audit or prior approval. Please confirm whether the Electron portable NSIS format and upstream native/runtime components can be supported, and advise the permitted signing scope and build/artifact policy.

## Onaydan önce tamamlanacaklar

1. Bakım sorumlusu GitHub ve SignPath hesabında MFA kullanmalı; hesap ayarı doğrulanmadan sağlandığı iddia edilmez.
2. Başvuru https://signpath.org/apply.html üzerinden yapılır. Hesap sahibinin iletişim bilgileri ve koşul kabulleri kendisi tarafından doğrulanmalıdır. Hazır metin başvurunun gönderildiği anlamına gelmez.
3. Foundation proje itibarı ve kaynak/paket bağlantısını inceler. Onay olursa GitHub bağlantısı, başvuru yetkisi, proje/politika kimlikleri ve manuel yayın onayı ayarlanır.
4. Electron/Koffi üçüncü taraf dosyalarıdır. Foundation kuralları, bu dosyaları proje sertifikasıyla gelişigüzel imzalamaya izin vermez. Mevcut sıkı iç/dış imza kontrolü onay almak için kapatılmaz. Sağlayıcıyla uyumlu paketleme kapsamı belirlenmeden otomatik EXE yayını etkinleştirilmez. NSIS'in içindeki uygulamayı da kapsayan tek aşamalı imza desteği varsayılmaz.
5. GitHub-hosted kaynak derlemesi, izin verilen dosyaların imzası, zaman damgası ve gerçek indirilen paketin Smart App Control testi tamamlandıktan sonra yeni EXE ve checksum birlikte yayımlanır. Güncel sürüm kaydı ancak doğrulanmış paket için değiştirilir.

## Kaynaklar

- [Foundation koşulları](https://signpath.org/terms)
- [Başvuru](https://signpath.org/apply.html)
- [GitHub kaynak doğrulaması](https://docs.signpath.io/trusted-build-systems/github)
- [Desteklenen imzalama formatları](https://docs.signpath.io/artifact-configuration/reference)

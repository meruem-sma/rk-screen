(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.RKScreenErrors = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const messages = {
    offline: 'İnternet bağlantısı yok. Wi-Fi veya kablo bağlantısını kontrol edip yeniden deneyin.',
    'peer-unavailable':
      'Karşı bilgisayar bulunamadı. RK Screen iki cihazda da açık olmalı; kimliği ve Beta 1 yapı numarasını kontrol edin.',
    network:
      'Bağlantı hizmetine ulaşılamıyor. İnterneti kontrol edin; hizmete erişim otomatik yeniden denenecek.',
    'socket-error':
      'Bağlantı hizmetiyle iletişim kesildi. Ağ veya güvenlik duvarı erişimi sınırlıyor olabilir.',
    'socket-closed':
      'Bağlantı hizmeti kapandı. Mevcut ekran oturumu açıksa korunur; hizmet yeniden denenir.',
    'server-error': 'Bağlantı hizmeti yanıt vermiyor. Bir süre sonra yeniden deneyin.',
    webrtc:
      'Cihazlar arasında doğrudan bağlantı kurulamadı. Ayarlar’dan ağ testini çalıştırın; bazı ağlar çalışan bir aktarma sunucusu gerektirir.',
    timeout:
      'Bağlantı zamanında kurulamadı. Karşı uygulamanın açık olduğunu kontrol edin. Farklı ağlarda doğrudan erişim engelleniyorsa aktarma sunucusu gerekir.',
    busy: 'Karşı bilgisayarda başka bir oturum açık. Oturum bittikten sonra yeniden deneyin.',
    version: 'İki cihazın bağlantı biçimi farklı. İkisinde de güncel Beta 1 setup’ını kurun.',
    disabled:
      'Karşı bilgisayarda gelen bağlantı istekleri kapalı. Ekran sahibi Ayarlar’dan açabilir.',
    rate: 'Çok sık bağlantı isteği gönderildi. Bir dakika bekleyip yeniden deneyin.',
    rejected: 'Ekran sahibi bağlantı isteğini reddetti. İzni olmadan oturum açılamaz.',
    capture:
      'Ekran yakalanamadı. Ekranın bağlı olduğunu kontrol edin; siyah ekranda Windows uyumluluk modunu deneyin.',
    NotAllowedError:
      'Windows ekran paylaşımına izin vermedi. Ekran sahibinin paylaşım seçimini ve izinlerini kontrol edin.',
    NotReadableError:
      'Windows ekranı okuyamadı. Ekranı yeniden seçin; gerekirse Ayarlar’dan uyumluluk modunu açıp uygulamayı yeniden başlatın.',
    disconnected:
      'Veri bağlantısı koptu; kontrol güvenli biçimde bırakıldı. İnternet geri geldikten sonra yeniden bağlanın. Yeni bağlantı tekrar onay ister.',
  };
  function explain(error, online = true) {
    if (!online) return messages.offline;
    const code = typeof error === 'string' ? error : error?.type || error?.name;
    return (
      messages[code] ||
      'İşlem tamamlanamadı. Yeniden deneyin; sürerse Ayarlar’dan bağlantı raporunu kaydedin.'
    );
  }
  return { explain };
});

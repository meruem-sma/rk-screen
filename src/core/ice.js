const directServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
function validateRelay(value) {
  if (
    !value ||
    typeof value.url !== 'string' ||
    typeof value.username !== 'string' ||
    typeof value.password !== 'string'
  )
    throw Error('Geçersiz aktarma sunucusu bilgisi.');
  const url = value.url.trim(),
    username = value.username.trim();
  if (!url) return null;
  if (
    !/^turns?:[a-z0-9.-]+:\d{1,5}(?:\?transport=(?:udp|tcp))?$/i.test(url) ||
    Number(/:(\d+)(?:\?|$)/.exec(url)?.[1]) < 1 ||
    Number(/:(\d+)(?:\?|$)/.exec(url)?.[1]) > 65535 ||
    username.length < 1 ||
    username.length > 256 ||
    value.password.length < 1 ||
    value.password.length > 2048
  )
    throw Error(
      'Sunucu adresini turn:adres:port veya turns:adres:port biçiminde, kullanıcı adı ve parolasıyla girin.',
    );
  return { urls: [url], username, credential: value.password };
}
module.exports = { directServers, validateRelay };

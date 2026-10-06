// Public packages must have a configured signing identity before any build output changes.
function signingConfig(env) {
  if (env.RKSCREEN_SIGN_CERT && env.CSC_LINK && env.RKSCREEN_SIGN_CERT !== env.CSC_LINK)
    throw Error('Conflicting code signing certificate settings.');
  const cert = env.RKSCREEN_SIGN_CERT || env.CSC_LINK || env.WIN_CSC_LINK;
  const thumbprint = env.RKSCREEN_SIGN_THUMBPRINT;
  if (cert && thumbprint) throw Error('Choose either a certificate file or a Windows certificate-store identity.');
  if (!cert && !thumbprint)
    throw Error('Public release blocked: configure a trusted code signing certificate. No EXE was rebuilt. See WINDOWS-IMZALAMA.md.');
  if (thumbprint && !/^[a-f0-9]{40}$/i.test(thumbprint))
    throw Error('RKSCREEN_SIGN_THUMBPRINT must be a 40-character certificate thumbprint.');
  if (env.RKSCREEN_SIGN_CERT) {
    env.CSC_LINK = env.RKSCREEN_SIGN_CERT;
    if (env.RKSCREEN_SIGN_PASSWORD !== undefined) env.CSC_KEY_PASSWORD = env.RKSCREEN_SIGN_PASSWORD;
  }
  return {
    forceCodeSigning: true,
    win: {
      signExecutable: true,
      signExts: ['.dll', '.node'],
      signtoolOptions: {
        // Use the verified identity on the certificate, not a display-name guess.
        publisherName: null,
        ...(thumbprint ? { certificateSha1: thumbprint } : {}),
        signingHashAlgorithms: ['sha256'],
        rfc3161TimeStampServer: 'http://timestamp.digicert.com',
      },
    },
  };
}
if (require.main === module) {
  try { signingConfig(process.env); require('./signing-preflight.cjs').signingPreflight(); console.log('Signing configuration present; certificate trust is checked during build and verification.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { signingConfig };

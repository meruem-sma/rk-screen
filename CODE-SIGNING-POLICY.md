# Code signing policy

RK Screen is maintained by [meruem-sma](https://github.com/meruem-sma) under the MIT license. The current Beta 1 setup is unsigned. The maintainer chose free unsigned distribution without service applications; no signing approval or production certificate is claimed.

Authors, reviewers and release approvers: [meruem-sma](https://github.com/meruem-sma). External contributions must be reviewed before merging. Each signed release must be manually approved by the maintainer. Multi-factor authentication is required for the maintainer's GitHub and any future signing-provider accounts before signing is enabled; its configuration must be confirmed by the account owner.

Only artifacts traceable to this public repository and built by GitHub-hosted workflows may be submitted for project signing. Existing third-party signatures must be preserved. Electron, Chromium, Koffi and other upstream binaries must follow the signing provider's approved scope. Packaging and timestamp/signature checks must cover the actual distribution format. An unsigned build artifact is not a signed public release.

On October 6, 2026, the maintainer explicitly requested unsigned Beta 1 setup distribution and reaffirmed this on October 15. This exception is restricted to beta versions, carries `signed: false` in the public feed, and does not bypass Windows security checks. Signed builds remain the default release path.

Provider approval, artifact configuration and treatment of the NSIS installer's embedded payload must be agreed before enabling production signing. Any required provider acknowledgment will be added only when a service is actually approved and used.

See [PRIVACY.md](PRIVACY.md) for data handling and third-party connections, and [SECURITY.md](SECURITY.md) for vulnerability reporting.

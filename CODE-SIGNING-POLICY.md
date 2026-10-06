# Code signing policy

RK Screen is maintained by [meruem-sma](https://github.com/meruem-sma) under the MIT license. The current public Beta 1 EXE is unsigned. Free SignPath Foundation signing is being investigated; no application approval or production certificate is claimed.

Authors, reviewers and release approvers: [meruem-sma](https://github.com/meruem-sma). External contributions must be reviewed before merging. Each signed release must be manually approved by the maintainer. Multi-factor authentication is required for the maintainer's GitHub and SignPath accounts before signing is enabled; its configuration must be confirmed by the account owner.

Only artifacts traceable to this public repository and built by GitHub-hosted workflows may be submitted for project signing. Existing third-party signatures must be preserved. Electron, Chromium, Koffi and other upstream binaries cannot be signed with the project's Foundation certificate without an approved provider policy. Packaging and timestamp/signature checks must cover the actual distribution format. An unsigned build artifact is not a signed public release.

Approval, artifact configuration and treatment of the portable launcher's embedded payload must be agreed with SignPath before enabling production signing. The acknowledgment required by the provider will be added when the service is actually approved and used.

See [PRIVACY.md](PRIVACY.md) for data handling and third-party connections, and [SECURITY.md](SECURITY.md) for vulnerability reporting.

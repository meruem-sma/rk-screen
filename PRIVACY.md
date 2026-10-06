# Privacy

RK Screen is a Windows remote support beta. A person sharing their screen must approve each incoming session and choose a monitor. Mouse/keyboard control, clipboard and system audio require separate permissions. Either participant can end a session. Device names are self-reported and are not verified identities.

Opening the application registers a device identifier with PeerJS Cloud so that another device can request a session. PeerJS Cloud signaling and Google/Cloudflare STUN and OpenRelay TURN are used for connection establishment. Those services process network addresses and connection metadata. If direct communication is unavailable, the encrypted WebRTC traffic may pass through a TURN relay. No independently verified end-to-end identity authentication is claimed.

Screen contents, optional system audio, chat, accepted files and explicitly shared clipboard text are transmitted to the connected participant. There is no application screen recording or cloud chat archive. Chat keeps up to 200 messages in memory. Received files are stored in the recipient's Downloads folder after acceptance. Device settings/recent connections and limited startup/error logs are stored locally. Screen, chat, clipboard and keystroke contents are not intentionally written to those logs.

Website/download provider infrastructure is separate from the application. See the [website privacy page](https://rkscreen.com.tr/gizlilik/) and provider policies: [PeerJS Cloud](https://peerjs.com/), [Google](https://policies.google.com/privacy), [Cloudflare](https://www.cloudflare.com/privacypolicy/), [OpenRelay](https://openrelayproject.org/).

Do not disclose passwords, session contents or personal data in public GitHub issues. For security reports see [SECURITY.md](SECURITY.md). The beta has not completed independent security auditing or multi-PC testing across all network environments.

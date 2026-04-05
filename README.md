# SPXP Viewer

A lightweight browser-based viewer for [SPXP](https://spxp.org) (Social Profile Exchange Protocol) profiles.

Try it: **https://spxp.org/viewer**

## What it does

- Load and render any SPXP profile (name, photo, bio)
- Browse posts with pagination
- Navigate through the friends network
- Back/history navigation

## Files

```
spxp-viewer/
├── index.html    # UI
├── app.js        # Client logic
├── proxy.php     # CORS proxy (PHP, required for servers without CORS headers)
├── server.js     # Local dev server (Node.js)
└── README.md
```

## Local development

```bash
node server.js
# Open http://localhost:8080
```

## Example profiles

- `https://spxp.org/spxp` — Official SPXP profile
- `http://testbed.spxp.org/0.3/heavyfrog799` — Testbed profile
- `https://bridge.spxp.org/ap/@spaceflight@techhub.social` — ActivityPub bridge profile

## Roadmap

- [ ] Ed25519 signature validation
- [ ] Encrypted content support
- [ ] Comments & reactions display
- [ ] Deep-link via URL parameter

## License

Apache 2.0

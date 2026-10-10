# QS Studio

QS Studio is a browser-based question-paper authoring workspace with structured text and mathematics composition, high-DPI canvas rendering, circuit and SVG tools, reusable custom symbols, and paper/key export workflows.

## Test the browser build

Open `qs_studio.html` directly, or serve this directory with any static web server. The GitHub Pages entry at `index.html` opens the current modular studio automatically.

Live website: [suvsha1029-debug.github.io/qs-studio](https://suvsha1029-debug.github.io/qs-studio/)

The workspace adapts to Android phones, iPhones, tablets, and desktop browsers. On supported mobile browsers, use **Add to Home Screen** to open QS Studio like a standalone web app.

## Publication boundary

This repository contains only the browser QS Studio. Exam-platform backend services, candidate data, admin systems, desktop clients, generated question banks, answer keys, PDFs, local configuration, and credentials are excluded from publication.

## Verification

Run the local regression suite with:

```powershell
node tools/stability-regression.js
```

## Rights

Copyright (c) 2026 **suvsha1029-debug**. QS Studio, QS Gen and SVG Maker are publicly
viewable, but are **not open source**. See [LICENSE](LICENSE) and [copyright notice](NOTICE.md).

Request written permission for reuse, modification, redistribution, commercial
licensing or independent deployment at [suvsha1029@gmail.com](mailto:suvsha1029@gmail.com).
Normal use of the author's hosted application is permitted. No ownership is
claimed over users' original papers, diagrams or other content.

GitHub's permitted viewing and forking rights, applicable legal exceptions,
third-party licenses and previously granted permissions remain unaffected.

# QS Studio

QS Studio is a browser-based question-paper authoring workspace with structured text and mathematics composition, high-DPI canvas rendering, circuit and SVG tools, reusable custom symbols, and paper/key export workflows.

## Test the browser build

Open `qs_studio.html` directly, or serve this directory with any static web server. The GitHub Pages entry at `index.html` opens the current modular studio automatically.

## Publication boundary

This repository contains only the browser QS Studio. Exam-platform backend services, candidate data, admin systems, desktop clients, generated question banks, answer keys, PDFs, local configuration, and credentials are excluded from publication.

## Verification

Run the local regression suite with:

```powershell
node tools/stability-regression.js
```

## Rights

Copyright (c) 2026. No license is granted for redistribution, modification, or commercial use unless a separate license is added by the owner.

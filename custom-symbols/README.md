# QS Studio Custom Symbols

This folder is the optional shared library for symbols made in `svg_symbol_maker.html`.

Use **Save to Library** in the SVG Maker and choose the `QSGEN_PERFECT_PRE_GIT` folder when prompted. The maker creates or updates each symbol JSON here and adds it to `library.json`.

In the Circuit Editor, open the **Custom** palette and select **Load Local Library**. Imported symbols remain available in the browser library, include their wire ports, and retain editable text.

Browser downloads cannot be silently redirected to this folder. That restriction protects local files, so the folder picker is intentionally user-confirmed.

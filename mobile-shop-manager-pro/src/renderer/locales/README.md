# Translations

The English text is the key. `en.json` is generated (`npm run strings`) and lists every string in the interface.

To add or complete a language:

1. Copy `en.json` to `xx.json` (ISO 639-1 code) and translate the **values**.
2. Keep placeholders such as `{n}` or `{name}` unchanged.
3. Register a new language in `LANGUAGES` in `src/shared/constants.js` (`rtl: true` for right-to-left scripts).

Missing strings fall back to English, so partial files are safe.

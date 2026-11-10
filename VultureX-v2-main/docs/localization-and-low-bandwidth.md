# Localization and low-bandwidth mode

## Languages

`founder_profiles.preferred_language` is the source of truth for a signed-in
founder. `features/i18n/messages.ts` contains complete English, Hindi and
Punjabi dictionaries for the translated interface surface. Missing future keys
fall back to English; raw dictionary keys are never rendered.

The locale is resolved once per request in `features/i18n/server.ts` and passed
to the shell through `LanguageProvider`. The shell navigation, Knowledge Hub
home (including quick-access and start-here labels), section-page chrome, For
You workspace panels and founder quick navigation consume the dictionary. The
founder profile form and the sidebar/mobile quick switcher both persist the
choice through `PATCH /api/preferences/language`; a refresh or new login reads
the same saved value.

Static long-form Knowledge Hub article bodies and founder guidance sentences
remain English content. Their page shell, navigation, panel headings, labels
and action buttons localize, which is the intended fallback until editorial
translations are authored. No raw message keys are rendered.

## Low-bandwidth mode

The root layout applies `data-saver` before paint when either:

- the browser exposes `navigator.connection.saveData`, or
- the user has chosen low-bandwidth mode in the sidebar/mobile menu.

The mode is persisted in `localStorage` as `vx-lite`, removes non-essential
animations/transitions and decorative surfaces, disables card shadows, and
lazy-loads recommendation logos. Core navigation, forms, records and actions are
unchanged. The CSS also honours `prefers-reduced-data` and reduced motion.

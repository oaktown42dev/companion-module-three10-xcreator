# companion-module-three10-xcreator

Bitfocus Companion v5+ Modul & fertige 8x4 Stream Deck XL Konfigurationen für **three10 X-Creator** (`REST API v1`, Standard-Port `9696`).

## Features

- **Live Auto-Sync (Polling)**: Fragt automatisch `/api/v1/alive`, `/api/v1/experiences`, `/api/v1/experiences/current`, `/api/v1/slides` und `/api/v1/slides/current` ab.
- **24 Dynamische Slide-Slots**: Buttons aktualisieren automatisch ihren Slide-Namen (`$(xcreator:slide_1_name)` bis `$(xcreator:slide_24_name)`) und triggern die jeweilige Slide-ID, sobald Slides in X-Creator umbenannt, umsortiert oder neu angelegt werden.
- **Live-Tally Feedback**: Der Button der aktuell im X-Creator aktiven Slide leuchtet automatisch **Grün** (`slide_slot_active` / `slide_active`).
- **Direkte Aktionen**:
  - `Next Slide` / `Previous Slide`
  - `Load Slide by Slot (1–24)` / `Load Slide by ID`
  - `Load Experience by Slot (1–8)` / `Load Experience by ID`
  - `Exit Current Experience`
  - `Refresh Experiences & Slides Now`

---

## Enthaltene Dateien

| Datei / Ordner | Beschreibung |
|---|---|
| `three10-xcreator-1.0.0.tgz` | Fertig gepacktes Companion-Modul zum direkten Import über **Modules → Import module package** |
| `x-creator-autosync.companionconfig` | Fertiges **8x4 Stream Deck XL Layout** mit 24 dynamischen Auto-Sync Slide-Slots, Tally-Feedback & Steuerzeile |
| `x-creator-8x4.companionconfig` | Statisches 8x4 Fallback-Layout auf Basis von `generic-http` (ohne Custom-Modul) |
| `install-xcreator-module.bat` | 1-Klick-Installer für Windows (kopiert das Modul direkt nach `%APPDATA%\companion\modules\three10-xcreator-1.0.0`) |
| `main.js`, `package.json`, `companion/` | Modul-Quellcode (Node 22 ESM, Companion IPC API v2.0.4) |

---

## Schnellstart (Companion 5.1+)

1. **Modul installieren**:
   - In der Companion Web-GUI (`http://localhost:8000`) links auf **Modules** → oben rechts auf **Import module package** klicken.
   - Die Datei **`three10-xcreator-1.0.0.tgz`** auswählen.
   - *(Alternativ unter Windows `install-xcreator-module.bat` ausführen und Companion neu starten).*

2. **8x4 Stream Deck Konfiguration importieren**:
   - In Companion links auf **Import / Export** → **Import** klicken.
   - **`x-creator-autosync.companionconfig`** auswählen und importieren.
   - Unter **Connections** bei `xcreator` ggf. die IP-Adresse des X-Creator anpassen (Standard: `10.10.10.122`, Port `9696`).

---

## Unterstützte X-Creator REST API Endpunkte (`/api/v1`)

- `GET /api/v1/alive` – Verbindungsstatus prüfen (`204 No Content`)
- `GET /api/v1/experiences` – Verfügbare Experiences abrufen
- `GET /api/v1/experiences/current` – Aktuell geladene Experience abrufen
- `PUT /api/v1/experiences/current` – Experience wechseln (`{"id": "<experienceId>"}`)
- `DELETE /api/v1/experiences/current` – Aktuelle Experience beenden
- `GET /api/v1/slides` – Alle Slides der aktuellen Experience abrufen
- `GET /api/v1/slides/current` – Aktive Slide abrufen
- `PUT /api/v1/slides/current` – Bestimmte Slide aktivieren (`{"id": "<slideId>"}`)
- `POST /api/v1/slides/next` – Nächste Slide
- `POST /api/v1/slides/previous` – Vorherige Slide

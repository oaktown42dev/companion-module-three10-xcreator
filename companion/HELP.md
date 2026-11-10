# three10 X-Creator Module

Controls **three10 X-Creator** via its built-in HTTP REST API (`/api/v1`) and automatically syncs all Experiences, Slides, and active states onto your Stream Deck buttons.

### Features
- **Live Auto-Sync**: Automatically fetches available Experiences, Slides of the active Experience, and the currently active Slide at a configurable poll interval (default: 1500 ms).
- **Dynamic Slide Slots (1–24)**: Buttons assigned to Slide Slots 1–24 automatically show the current Slide Name from X-Creator, trigger that Slide when pressed, and light up **Green** when active in X-Creator.
- **Direct Actions**: Next Slide, Previous Slide, Load Slide by Slot (1–24), Load Slide by ID, Load Experience by Slot (1–8) or ID, Exit Experience, Refresh Now.

# 🧱 Sprite Sheet Helper

> Generate sprite sheets and export renders from 3D scenes — fast and simple.

Built with **Vite + React + Tauri** for a lightweight, native desktop experience.

---

## 📦 Download

Prebuilt desktop binaries are available on the [Releases page](https://github.com/Kyonru/sprite-sheet-helper/releases).

| Platform | File                  |
| -------- | --------------------- |
| macOS    | `.dmg`                |
| Windows  | `.msi` or `.exe`      |
| Linux    | `.AppImage` or `.deb` |

Download the appropriate file for your OS and run it directly — no setup required.

---

## 🚀 Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust toolchain](https://www.rust-lang.org/tools/install)
- Tauri platform dependencies → [Official guide](https://tauri.app/start/prerequisites/)

### 1. Clone the Repository

```bash
git clone https://github.com/Kyonru/sprite-sheet-helper.git
cd sprite-sheet-helper
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode

```bash
npm run tauri dev
```

This starts Vite and launches the Tauri desktop app with hot reload.

---

## 🛠 Build

### Debug build

```bash
npm run tauri build -- --debug
```

### Production build

```bash
npm run tauri build
```

The compiled application will be output to `src-tauri/target/`.

---

## 📜 Scripts

| Command                          | Description                      |
| -------------------------------- | -------------------------------- |
| `npm install`                    | Install all dependencies         |
| `npm run tauri dev`              | Run the app in development mode  |
| `npm run tauri build`            | Build the production desktop app |
| `npm run tauri build -- --debug` | Build a debug desktop app        |
| `npm run build`                  | Build the web frontend only      |

---

## 🏗 Architecture

Sprite Sheet Helper is **pwa + web-first**. The app runs as a standard web app by default and is also packaged as a native desktop app via Tauri.

### Platform-specific Code

When a feature requires different implementations between web and native (Tauri), the following file naming convention is used:

| File               | Used when                                         |
| ------------------ | ------------------------------------------------- |
| `feature.web.ts`   | Default — runs in the browser / web build         |
| `feature.tauri.ts` | Native override — runs in the Tauri desktop build |

At build time, a Vite plugin (`WebTauriSwapPlugin`) automatically swaps `.web.*` imports for their `.tauri.*` counterpart when building for desktop. If no `.tauri.*` file exists, the `.web.*` version is used as the fallback.

**Example:**

```bash
src/components/reload-prompt/
├── prompt.web.ts     ← used in web builds (PWA service worker)
└── prompt.tauri.ts   ← used in Tauri builds (no-op or native equivalent)
```

When adding a feature that behaves differently on each platform:

1. Implement the web version in `feature.web.ts`
2. Implement the native version in `feature.tauri.ts`
3. Import using the `.web` suffix — the build system handles the rest:

```ts
import useMyFeature from "./feature.web";
```

> ℹ️ Never import `.tauri.*` files directly. Always import the `.web.*` version and let the plugin swap it at build time.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# 1. Fork and clone the repo, then:
git checkout -b feature/your-feature-name

# 2. Install dependencies
npm install

# 3. Make your changes, then commit
git commit -m "feat: describe your change"

# 4. Push and open a Pull Request
git push origin feature/your-feature-name
```

Please keep commits clear and scoped. Bug fixes, performance improvements, and new features are all appreciated.

---

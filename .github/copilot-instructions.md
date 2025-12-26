## Purpose

Quick reference for AI coding agents working on the relapse-prevention-app (Expo + Expo Router + TypeScript).
Keep guidance focused: architecture, developer workflows, project-specific conventions, and concrete file examples.

## Big picture

- Type: Expo-managed React Native app using TypeScript and file-based routing via `expo-router`.
- Entry: `app/_layout.tsx` defines the main navigation stack and provides theme provider (see `ThemeProvider` import).
- Tabs: `app/(tabs)` contains the primary tab screens; add new screens by creating files under `app/` (file-based routes).

## Key technologies and integration points

- Routing: `expo-router` + `expo-router/entry` (see `package.json` main). Routes are created from files in `app/`.
- Theming: `use-color-scheme` hooks (in `hooks/`) + themed components in `components/` (e.g. `themed-view.tsx`, `themed-text.tsx`). Colors are centralized in `constants/theme.ts`.
- Native libs: `react-native-reanimated` is imported for side-effects in `app/_layout.tsx`. Keep this import at the app root when working with Reanimated.
- Storage: `expo-sqlite` is used for local persistence (example in `app/(tabs)/index.tsx` — a simple `logs` table with `type` and `timestamp`).
- Icons: app uses `components/ui/icon-symbol` and `@expo/vector-icons`.

## Project conventions (do not change without reason)

- Path alias: imports use `@/` to root — defined in `tsconfig.json` ("@/*" -> "./*"). Use this for new imports.
- Themed primitives: prefer `ThemedView` / `ThemedText` instead of raw `View`/`Text` when background/text color matters. See `components/themed-view.tsx` and `components/themed-text.tsx`.
- Keep layout-level side-effect imports (like `import 'react-native-reanimated'`) in `app/_layout.tsx`.
- File-based routing rules: creating `app/foo.tsx` => route `/foo`; nested directories map to nested routes. Modal route exists at `app/modal.tsx`.

## Build / run / debug

- Install: `npm install` (project uses npm and Expo).
- Start Metro / Expo: `npm start` or `npx expo start`.
- Platform shortcuts: `npm run android`, `npm run ios`, `npm run web`.
- Reset starter content: `npm run reset-project` (runs `scripts/reset-project.js`).
- Lint: `npm run lint` (uses Expo lint config).

## What to inspect for common tasks (examples)

- Add a screen: create `app/my-new-screen.tsx`. Use `useThemeColor` and `ThemedView` for consistent colors.
- Add a shared component: place under `components/` and export with a named export; follow `Collapsible` and `IconSymbol` patterns.
- Work with DB: mirror the pattern in `app/(tabs)/index.tsx` — open `expo-sqlite`, create the table if needed, and use async helpers.

## Testing and CI

- There are no test or CI configs in the repo by default. Add tests only if you also add a matching CI step; keep changes small and documented.

## Safety and quick pitfalls

- Don't remove or move `app/_layout.tsx` or the `react-native-reanimated` import — doing so can break navigation and Reanimated behavior.
- When touching theme colors, update `constants/theme.ts` and prefer using `useThemeColor` helpers.
- Keep SQL schema changes backward-compatible; user data may exist in local `expo-sqlite` DB.

## Where to look first (top files)

- `app/_layout.tsx` — app entry and navigation stack
- `app/(tabs)/index.tsx` — home screen with `expo-sqlite` example
- `components/themed-view.tsx`, `components/themed-text.tsx` — themed primitives
- `constants/theme.ts` — color and font tokens
- `tsconfig.json` — alias `@/*`

If anything here looks incomplete or you want examples expanded (scripts, testing, or specific file patterns), mention which area and I'll expand the guidance.

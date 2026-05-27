# Web App Source Layout

`src/main.jsx` is the Vite entry point. It should stay small and only mount the React app.

`src/app/` contains app-level composition:

- `App.jsx` wires together providers and routing.
- `AppProviders.jsx` owns global provider order.
- `AppRouter.jsx` owns route definitions and route guards.

`src/context/` is grouped by domain. Each context folder owns its provider, hook, context object, and any domain utilities.

`src/pages/` contains route-level screens. Page-specific CSS stays next to the page.

`src/components/` contains reusable UI grouped by product area or role. `components/common/` is reserved for cross-feature components that are shared by multiple pages or product areas.

`src/hooks/`, `src/lib/`, and `src/constants/` contain shared logic, integration code, and static app data.

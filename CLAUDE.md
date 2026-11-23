# NEW ERA booking page (newera-booking.vercel.app) — Vercel project `new-era-booking`

- Source: `_src/booking.jsx`; build: `node _src/build.js` (esbuild + precompiled Tailwind via `_src/tw-play-3.js` + `_src/tailwind.config.js`). Bump `BOOKING_VERSION` on every change. `_src/` is not deployed.
- Dental / Dermatology: any specialty whose name matches جلد/بشرة/Derma/Skin (or has `dept: 'derma'`) is dermatology; its services, doctors and branches show under the "جلدية وتجميل" toggle. `?dept=derma` opens it directly. With no derma data the toggle is hidden.
- Reply to the owner in Egyptian Arabic; tell her exactly which files changed.

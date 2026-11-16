# FocusPulse

**A student-first academic workspace for planning, focusing, and making steady progress.**

[Open the live site](https://bavly-creator.github.io/Agile-wep/)

FocusPulse brings courses, assignments, study planning, focus sessions, notes, and progress tracking into one calm workspace. It is built with semantic HTML, CSS, and vanilla JavaScript, with an Express and Node.js server for account and AI services.

## What’s included

- Student dashboard with real activity, upcoming work, and quick actions.
- Course management, tasks and assignments, and a calendar planner with generated study suggestions.
- Editorial digital focus timer with course and objective links, breaks, session history, and browser-refresh recovery.
- Notes, study journal, progress and achievements, and locally stored study groups.
- Light and dark themes, responsive layouts, and reduced-motion-aware transitions and background animation.
- Optional Pulse AI backed by the existing Gemini integration.
- Guest access and server-backed registration, email verification, sign-in, and password recovery when configured.

## Run locally

See [FocusPulse/README.md](FocusPulse/README.md) for setup, environment configuration, and the current service limitations.

For guest mode only, serve the `FocusPulse` folder with a static web server and open `index.html`. For account and AI features, run the Node server from the repository root and configure the required server environment variables.

## Deployment note

GitHub Pages serves the static frontend. The account and AI APIs require the Node server to be deployed separately and configured with the required email and AI provider settings. Do not put server credentials in frontend files.

## Project

- Frontend: HTML5, CSS3, vanilla JavaScript ES6+.
- Backend: Node.js and Express.
- Guest and academic feature data: browser `localStorage` on the current device.
- Account data: local JSON development store; see the app README before production use.

This is an evolving student project. The app README lists features that still need production infrastructure or additional document-processing services.

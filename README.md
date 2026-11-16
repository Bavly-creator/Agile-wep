# FocusPulse — Study Streak & Pomodoro Tracker
**Agile Software Engineering (SET 312) — Team 7**

> A client-side student productivity platform combining the **Focus Reactor**, course management, study streaks, collaborative study circles, and productivity analytics. Built strictly with **HTML5, CSS3, and Vanilla JavaScript (ES6+)** — zero external frameworks, libraries, or backend dependencies.

---

## ⚛️ Signature Feature: FOCUS REACTOR

The centerpiece of FocusPulse is the **Focus Reactor** (`timer.html`), an extraordinary futuristic Pomodoro timer engineered with SVG circular physics, CSS3 keyframe mechanics, and Web Audio API synthesis:

1. **Central Glowing Energy Core**: Pulsing radial energy disc with live session course labels.
2. **Concentric Orbital Rings**: 3 mechanical orbital layers rotating at different speeds and axes.
3. **Circular SVG Progress Ring**: Precise `stroke-dashoffset` interpolation calculated from real time.
4. **Accurate `Date.now()` Timestamp Engine**: Survives browser tab switches and page refreshes.
5. **6 Animation States**:
   - `IDLE`: Breathing energy core, gentle rotation, "REACTOR READY".
   - `ACTIVATION`: Expanding shockwave, core brightens, ignition sound.
   - `DEEP FOCUS`: Smooth orbital rotation, minimal visual distraction.
   - `FINAL MINUTE`: (< 60s remaining) Warm golden gradient transition.
   - `COMPLETION`: Energy celebration burst, triumphant harmonic chime, auto-transitions to 5-minute break.
   - `RECOVERY`: Gentle cyan and mint soothing glow, break countdown.
6. **Deep Focus Mode**: Immersive distraction-free fullscreen view with dedicated exit control (`Esc`).
7. **Synthesized Sound Design**: Built-in Web Audio API oscillators for activation, completion, and break chimes (no external `.mp3` assets required).

---

## 📋 Implementation Checklist: 5 Epics & All 19 User Stories

| Epic | Story ID | Title | Points | Status | Implementation Details |
|---|---|---|---|:---:|---|
| **E1** | **S01** | Register and log in | 3 | ✅ Complete | Full validation, duplicate email check, one-click demo login, session persistence (`auth.js`, `login.html`, `register.html`). |
| **E2** | **S02** | Add my courses | 2 | ✅ Complete | Course CRUD with custom color picker, unique name/code checks, focus time tracking (`courses.js`, `courses.html`). |
| **E2** | **S03** | Start 25-min focus session | 5 | ✅ Complete | Focus Reactor timestamp delta countdown, refresh survival, auto-stats increment (`timer.js`, `timer.html`). |
| **E2** | **S04** | Interrupted session does not count | 3 | ✅ Complete | Cancellation modal; logged as interrupted with **0 minutes credited**, streak unaffected (`timer.js`). |
| **E1** | **S05** | Set a daily goal | 2 | ✅ Complete | Range between 1 and 12 sessions (25m - 300m), real-time progress radial widget (`goals.js`, `settings.html`). |
| **E3** | **S06** | See current streak | 5 | ✅ Complete | Computes consecutive qualifying calendar days where daily goal was met (`streaks.js`, `streaks.html`). |
| **E2** | **S07** | Automatic 5-minute break | 3 | ✅ Complete | Synthesized relaxation chime, auto-starts recovery mode after 25m, skip option (`timer.js`). |
| **E3** | **S08** | Daily log of minutes per course | 5 | ✅ Complete | Filterable session table, date groupings, completed vs. interrupted badges (`history.js`, `history.html`). |
| **E3** | **S09** | Streak resets after missed day | 3 | ✅ Complete | Calendar day gap detection resets active streak to 0 while keeping historical records (`streaks.js`). |
| **E1** | **S10** | Log out | 2 | ✅ Complete | Clears current user authentication and active timers, redirects to login (`auth.js`). |
| **E4** | **S11** | Create a study group | 5 | ✅ Complete | Generates unique 6-character code (`FP-XXXX`), assigns creator role (`groups.js`, `groups.html`). |
| **E4** | **S12** | Join group with code | 3 | ✅ Complete | Code validation, duplicate membership prevention, joins study circle (`groups.js`, `groups.html`). |
| **E4** | **S13** | Group weekly total | 5 | ✅ Complete | Computes team total minutes and real-time member leaderboard ranking (`groups.js`, `group-details.html`). |
| **E4** | **S14** | Weekly group challenge | 5 | ✅ Complete | Collective team focus target, visual progress bar, celebration state when target reached (`challenges.js`, `challenges.html`). |
| **E1** | **S15** | Reset password | 3 | ✅ Complete | Password reset demonstration with email verification and password update (`auth.js`, `reset-password.html`). |
| **E3** | **S16** | Local timezone and midnight | 5 | ✅ Complete | Uses local system calendar dates (`YYYY-MM-DD`), preventing UTC date drift bugs (`utils.js`, `streaks.js`). |
| **E5** | **S17** | Weekly statistics chart | 5 | ✅ Complete | Pure HTML5 Canvas rendering for weekly focus bar chart and course donut chart without external libraries (`insights.js`, `insights.html`). |
| **E5** | **S18** | Streak milestone badges | 5 | ✅ Complete | Unlocks 3-day, 7-day, 30-day streak milestones and 100-min badges with toast celebrations (`badges.js`, `badges.html`). |
| **E5** | **S19** | Distraction notes | 3 | ✅ Complete | In-session quick note modal, category filters (Social media, Noise, Daydreaming) (`distractions.js`, `distractions.html`). |

**Total Backlog Points:** **72 Points** (MVP: S01–S14 = 51 Points, Stretch: S15–S19 = 21 Points)

---

## 🚀 How to Run Locally

Because this project is built exclusively with standard Web standards (**HTML5, CSS3, Vanilla JavaScript**), it requires no installation, no build steps, and no backend database.

### Option 1: VS Code Live Server (Recommended)
1. Open this repository folder in **VS Code**.
2. Right-click on `index.html` (or `FocusPulse/index.html`) and select **"Open with Live Server"**.
3. Your browser will open `http://127.0.0.1:5500/` or `http://127.0.0.1:5500/FocusPulse/index.html`.

### Option 2: Direct Browser Launch
- Double-click `FocusPulse/index.html` to open it in Chrome, Edge, Safari, or Firefox directly.

---

## 🔒 Storage & Architecture Notice
This application uses **Browser LocalStorage** for structured local data persistence. It includes pre-seeded demonstration data for:
- Pre-registered Student Account: `bavly@focuspulse.io` (password: `password123`)
- 4 University Academic Courses
- 3-day consecutive study streak with qualifying sessions
- Study Group: `ECU Team 7 - FocusPulse` (Code: `FP-7712`)
- Pre-unlocked and pending milestone achievement badges

> **Academic Note:** LocalStorage is ideal for local evaluation, demonstrations, and offline single-user experiences. For production multi-user sharing across separate physical devices, a server-side database and secure authentication service would be integrated.

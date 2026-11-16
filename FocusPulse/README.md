# FocusPulse

FocusPulse is a student-first workspace for managing courses, assignments, study plans, focus sessions, notes, and academic progress. The frontend uses HTML, CSS, and vanilla JavaScript. Pulse AI is an optional tool.

**Live frontend:** [https://bavly-creator.github.io/Agile-wep/](https://bavly-creator.github.io/Agile-wep/)

> GitHub Pages serves the static frontend only. Account and AI features need the Node.js server and its external services deployed separately; they are not provided by the Pages site itself.

## Features

- Dashboard with schedule, tasks, deadlines, course overview, study activity, and meaningful empty states.
- Course creation and management, course details, task editing and completion, and a daily, weekly, and monthly planner.
- Availability-based study suggestions using open tasks, deadlines, and exam topics. Suggested sessions can be reviewed and edited before study; replacing suggestions requires confirmation.
- Editorial digital focus timer with course and objective association, short and long breaks, reset, session history, timestamp-based countdown, and refresh recovery.
- Notes with search, course organization, tags, pinning, and a study journal that can link to courses and completed sessions.
- Progress, achievements, study groups, sound preferences, and a local data export.
- Forest, Sage, and Cream light and dark themes, responsive layouts, gentle background motion, and reduced-motion support.
- Optional Pulse AI using the existing Gemini server integration.

## Run locally

### Guest workspace

1. Serve the `FocusPulse` folder using a local static server, such as the VS Code Live Server extension.
2. Open `index.html` from that server and choose **Continue as Guest**.

Guest academic data is stored in this browser only. It does not sync automatically and may be lost if browser data is cleared.

### Account and AI services

1. Install the existing Node dependencies from the repository root with `npm install`.
2. Copy `.env.example` to `.env` and set the server values described below. Keep `.env` private and out of version control.
3. Set `APP_BASE_URL=http://localhost:3000` for local development.
4. For account registration and password recovery, set `RESEND_API_KEY` and `EMAIL_FROM` to a Resend API key and verified sender.
5. For Pulse AI, set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
6. Run `npm start` from the repository root and open `http://localhost:3000`.

Without the Resend configuration, the server reports that email delivery is unavailable. It does not pretend to send verification or password recovery email. Without `GEMINI_API_KEY`, AI requests return a service error rather than simulated answers.

## Account service and data

The Express account service currently stores account records in `data/focuspulse-auth.json`, which is ignored by Git. Passwords use Node’s scrypt hashing. Verification and reset tokens are stored as hashes and expire after 30 minutes. Sessions use HttpOnly, SameSite cookies and in-memory session state; restarting the server revokes sessions.

This is a single-instance development implementation, not a production database or shared session store. Production deployment needs a managed database, shared session storage, HTTPS, a verified email domain, backups, monitoring, and a security review.

Academic records remain in browser `localStorage`, including for registered users. Guest-to-account sign-in preserves local records on the same device, but the application does not sync academic data to the account server. Study groups are also local records and do not support cross-device collaboration.

Existing local records are retained. A new workspace starts without fabricated student activity so progress and statistics reflect actual use.

## Pulse AI and document support

Pulse AI calls the existing Gemini integration from the server. Keep provider credentials in server environment variables, never in frontend code. Current document extraction supports TXT, Markdown, JSON, and CSV. PDF, DOCX, PPTX, and image extraction are not configured and are reported as unsupported. Uploaded text is held in server memory and is cleared when the server restarts.

## Deployment

The repository’s GitHub Pages workflow publishes the static frontend. GitHub Pages cannot run this project’s Node APIs. To enable registration, email verification, password recovery, or Pulse AI on a public deployment, deploy the Node server separately and configure its URL, environment variables, HTTPS, and appropriate frontend API routing.

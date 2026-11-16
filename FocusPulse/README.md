# FocusPulse

FocusPulse is a student-first academic workspace for courses, assignments, study planning, focus sessions, notes, and progress. The frontend uses HTML, CSS, and vanilla JavaScript. Pulse AI remains a separate optional tool.

## Run the application

Guest mode works locally without an account service:

1. Open `FocusPulse/index.html` with a local static server such as VS Code Live Server.
2. Choose **Continue as Guest**. Guest data remains on this browser and does not sync.

Account creation, sign-in, verification, and password recovery require the Node server:

1. From the repository root, install the existing dependencies with `npm install`.
2. Copy the account settings from `.env.example` into `.env` and configure the values below.
3. Set `APP_BASE_URL=http://localhost:3000` for local development.
4. Set `RESEND_API_KEY` and `EMAIL_FROM` to a Resend API key and a verified sender address.
5. Run `npm start` and open `http://localhost:3000`.

Without Resend configuration, registration and recovery return a clear configuration error; they do not simulate email delivery or mark addresses verified.

## Account service status

The Express server stores account records in a local JSON development store at `data/focuspulse-auth.json` (ignored by Git). Passwords use Node's scrypt hash; verification and password-reset tokens are stored as hashes and expire after 30 minutes. Login sessions use HttpOnly, SameSite cookies, CSRF checks for logout, and in-memory session state. Restarting the server revokes active sessions.

This is a single-instance development setup, not a production database or multi-server session store. Before production use, connect a managed database and shared session store, configure HTTPS and a verified mail domain, and review operational backups, monitoring, and deployment security.

Academic feature data is still stored locally in browser localStorage, including for a signed-in account. Guest-to-account sign-in keeps the existing workspace on the same device; the application does not currently synchronize academic records to the server. Clearing browser data can remove those records.

## Existing data

Existing localStorage records are retained. New installations start with empty courses and activity so dashboards and statistics reflect real student actions instead of sample sessions. The former demo account and plaintext browser password are no longer used.

The welcome, sign-in, registration, verification, and recovery screens share the split-screen FocusPulse brand layout. The planner stores weekly study availability, timed commitments, exam topics, and confidence levels locally. Its deterministic plan suggestions use open tasks, exam topics, deadlines, and saved time windows; suggestions are added as separate calendar entries, and replacing previous suggestions requires confirmation. Study groups are currently local records and do not support cross-device collaboration. Study journals are saved in the local notebook and can link to a course and a completed focus session.

## Optional AI service

Pulse AI uses the existing Gemini server integration. Set `GEMINI_API_KEY` on the server; never add provider credentials to frontend JavaScript. Upload and generation require a configured AI provider. Current document extraction supports TXT, Markdown, JSON, and CSV only. PDF, DOCX, PPTX, and image extraction need a document-processing service before those formats can be enabled. Uploaded source files are removed after text extraction; extracted text is held in server memory and is cleared when the server restarts.

Email verification and password recovery require a Resend account, a verified sender, and the `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` values. These flows are not considered live until delivery is verified with the configured provider.

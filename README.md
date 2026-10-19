Brain is a family organizer that uses Google Sheets (via Google Apps Script) to store and synchronize data. The React web app is hosted statically on GitHub Pages. Google accounts are authorized by an email whitelist in the Apps Script backend; Firebase is not used.

### Features

#### Data

Brain collects structured data from your family and organizes it into various linked views.

Each entry can have different attributes associated with it in various combinations.

**Name**
Each entry requires a name. Names may repeat; entries and their references use unique IDs.

**Note**
An optional text enhancement for descriptions, phone numbers, or other details. It becomes the body of a sticky note or the description beneath a polaroid. Add or remove it using the Note section in the entry form.

**Who**
This attribute indicates that an entry is associated with one or more persons.

**Task**
This attribute indicates that an entry is a task that has a binary completion status(Done, or Not Done).

**Requires**
This attribute indicates a one-way dependency between entries. For example, if task `A` requires task `B`, then task `B` must be completed before task `A` can be completed. _Requirements do no have to be tasks_

**Begins On**
This attribute indicates that an entry starts on a certain date.

**Begins At**
This attribute indicates that an entry starts at a certain time. _An entry can only begin at a certain time if it has a beginning date._

**Ends On**
This attribute indicates that an entry ends or is due on a certain date.

**Ends At**
This attribute indicates that an entry ends or is due at a certain time. _An entry can only end at a certain time if it has an ending date._

**Repeats**
This attribute indicates that an entry must be repeated at a certain interval. _An entry can only repeat if it has a beginning or ending date._

| Interval      | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| Daily         | Repeats at the same time every day.                                         |
| Weekly        | Repeats at the same time, on the same day of the week, every week.          |
| Monthly       | Repeats at the same time, on the same day of the month, every month.        |
| Quarterly     | Repeats at the same time, on the same day of the month, every three months. |
| Semi-annually | Repeats at the same time, on the same day of the month, every six months.   |
| Annually      | Repeats at the same time, on the same day of the month, every year.         |

When an entry repeats on the 29th, 30th, or 31st, but a month does not have enough days then the entry will repeat on the last day of the month instead.

**Budget**
This attribute indicates that an entry is a budget item. A budget item is a financial obligation that must be met. It can be an income or an expense of a certain amount.

**Income**
This attribute indicates that an entry is a tracked income item (an actual transaction). A tracked income item can correspond to a specific budget item, or it can be one-off.

**Expense**
This attribute indicates that an entry is a tracked expense item (an actual transaction). A tracked expense item can correspond to a specific budget item, or it can be one-off.

#### Inbox

The Inbox tab embeds a simple entry form directly in the page. Note is immediately visible. Buttons at the bottom add **Task**, **Who**, **Begins**, **Ends/Due**, **Repeats**, **Requires**, or **Money** as expandable sections, appended in the order selected. Repeats is available only while Begins or Ends/Due is attached; saving a repeating entry still requires an actual date. Removing the final time section also removes Repeats and clears its repetition/completion history. Each section can be collapsed without clearing its values. **Remove** clears the section's form values and returns its button to the bottom, even when the section is collapsed. Existing sections are shown when editing an entry; removals affect the saved entry only after saving. Saving creates an entry and resets the form; Clear resets it without saving. Drafts remain when switching tabs. The other views use the same form in a popup through **Add entry**.

#### Todo

The Todo list is a list of entries that have been marked as tasks (or have a beginning/end date). The todo list automatically sorts entries by their due dates (sorting required entries before their dependent task).

#### Calendar

The calendar is a view of entries that have any combination of beginning, ending, and repeating dates/times.

#### Budget

The budget is a list of entries that have been marked as budget items. The budget view can track income and expenses.

### Run locally

Use Node.js 24 or newer:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local`. Fill in the two values below before signing in, or use **Settings & connections** in the app. An unconfigured app offers a local workspace for trying the features without accessing a Sheet.

```dotenv
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/your-deployment-id/exec
```

These are public configuration values. OAuth access tokens stay in memory and are never saved in the repository or browser storage. Reloading the page or expiration of the Google token requires signing in again.

### Configure Google sign-in

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding and audience. For a family app in testing, add both spouses as test users. Request only `openid`, `email`, and `profile` scopes.
3. Create an OAuth client of type **Web application**.
4. Add the app's origins to **Authorized JavaScript origins**: `http://localhost:5173` for local development and `https://YOUR-USERNAME.github.io` for Pages. Origins do not include the repository path. Add a custom domain origin too if you use one. Open the local app at the exact configured origin.
5. Set `VITE_GOOGLE_CLIENT_ID` to the resulting client ID. No client secret is needed in the static app.

The frontend uses the [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model). The backend sends the access token to [Google's user-info endpoint](https://developers.google.com/identity/openid-connect/reference), requires a verified email, and checks that email against `ALLOWED_EMAILS` before accessing the spreadsheet. It never trusts an email supplied by the browser. Any Google account may reach Google's consent screen, but only whitelisted accounts can read or write family data.

### Deploy the Google Apps Script backend

1. Create a Google spreadsheet for Brain. Keep it private; your spouse accesses it through the backend and does not need direct spreadsheet permission.
2. Open **Extensions → Apps Script**. Paste [apps-script/Code.gs](apps-script/Code.gs) into `Code.gs`.
3. In Apps Script project settings, enable the manifest file and copy [apps-script/appsscript.json](apps-script/appsscript.json) into it.
4. Under **Project Settings → Script Properties**, add:

   | Property         | Value                                                         |
   | ---------------- | ------------------------------------------------------------- |
   | `SPREADSHEET_ID` | The ID between `/d/` and `/edit` in the Sheet URL             |
   | `ALLOWED_EMAILS` | Your two complete Google account emails, separated by a comma |

   The whitelist lives only in GAS, not in the public frontend. Do not set `REVISION` manually; the backend manages it.

5. Choose **Deploy → New deployment → Web app**. Execute as **Me** (the spreadsheet owner), and set access to **Anyone**. Authorize the spreadsheet and external-request scopes. The HTTP endpoint must accept requests from the static app; the code enforces the Google-account whitelist for every request. If a Workspace administrator prohibits this deployment setting, this backend cannot be deployed under that account without an administrator change.
6. Copy the deployment URL ending in `/exec` into `VITE_APPS_SCRIPT_URL` or the app's Settings. Do not use the `/dev` URL.
7. Sign in from the frontend using an allowed account and add an entry. After a one-second pause it syncs automatically. Sign in from the other spouse's browser to retrieve it; subsequent remote changes refresh every 30 seconds. **Sync now** is available for an immediate refresh. Also check that an account outside the whitelist is denied.

After backend code changes, update the deployment to a **new version**, keeping its existing URL. `Entries` is created automatically on the first authorized request. The script stores one structured entry per row, with JSON-encoded cells to preserve types and prevent formula execution. Treat this sheet as app-managed storage; direct edits bypass revision tracking and may produce invalid data. Use the app's editor and JSON import/export instead.

If sign-in reports **Another sync is in progress**, update `Code.gs` and choose **Deploy → Manage deployments → Edit → New version → Deploy**. The backend now returns a retryable `BUSY` response after a short lock wait, and the frontend retries that response automatically (including the older text-only error). Small committed snapshots are cached by spreadsheet and revision for two minutes, so authenticated readers usually do not wait for a writer; cache failures fall back to a locked Sheet read. Whitelist checks still run before accessing the cache. Persistently busy requests can indicate a long-running execution; inspect the Apps Script **Executions** page.

The sign-in button distinguishes **Waiting for Google** from **Connecting to Sheet** and offers **Cancel sign-in**. Missing Google callbacks time out after 90 seconds; Sheet requests time out after 30 seconds each, with a 60-second overall limit across busy retries. Network failures and authentication errors are not blindly retried as writes. Empty cached connection fields fall back to the configured build values, without clearing local entries.

See Google's [web app deployment documentation](https://developers.google.com/apps-script/guides/web) and [Content Service redirect behavior](https://developers.google.com/apps-script/reference/content/content-service). Requests use a plain-text JSON POST to avoid a CORS preflight, then follow Google's JSON response redirect. Live cross-origin sync must be verified against your actual deployment; incorrect deployment permissions commonly return a Google sign-in page instead of JSON.

### Publish on GitHub Pages

1. Push this folder to a GitHub repository with a `main` branch.
2. Under **Settings → Secrets and variables → Actions → Variables**, create `VITE_GOOGLE_CLIENT_ID` and `VITE_APPS_SCRIPT_URL`. These are public identifiers embedded in the build, not secrets.
3. Under **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main`, or run **Deploy Brain to GitHub Pages** manually from Actions. The [workflow](.github/workflows/pages.yml) installs from the lockfile, runs tests, builds, and deploys `dist/` using the standard GitHub Pages actions.

Vite uses relative asset URLs, so the same build works at `https://YOUR-USERNAME.github.io/brain/` or a custom domain. Navigation is state-based and does not require server route rewrites. The frontend is static; all shared data requests go to GAS.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### Data and synchronization behavior

- Entries are saved locally after each edit and sync automatically one second after the last edit while signed in. Clean workspaces pull remote changes every 30 seconds. **Sync now** starts an immediate sync, and reconnecting to the network triggers another attempt. Access tokens still expire normally; sign in again when prompted.
- Both accounts share the same family dataset. A script lock and shared revision reject stale writes instead of silently overwriting another browser's changes.
- On a revision conflict, the app downloads the latest snapshot, performs a three-way merge against its saved last-synced snapshot, and retries up to five writes per sync attempt. Independent entry and field changes combine; list fields combine additions and removals. A deletion removes an unchanged entry, but a concurrent edit survives a deletion. Concurrent changes to the same scalar field retain the local version and preserve the remote version as a separate entry labeled **Version preserved during automatic merge**. Invalid combined dates or financial types also preserve both versions. Dangling links are detached, and dependency edges that would create a cycle are removed with a merge notice.
- Local edits made during a sync are rebased onto the acknowledged snapshot and queued for another upload. Network failures leave unsynced local changes intact and retry with exponential backoff, capped at 30 seconds. If the browser closes, changes remain cached for the next sign-in; this is not a background service worker.
- A local workspace with unsynced entries automatically merges with an existing Sheet after signing in. Older browser caches without a baseline merge conservatively by keeping entries from both sides, rather than inferring deletions. Settings still offers **Load Sheet version** to explicitly discard the current local changes. Importing an older backup replaces matching IDs locally, so review it before automatic upload.
- Sign-out hides the workspace but keeps its local cache for the next family sign-in. Local data is not encrypted; use a trusted browser profile. The app is not an offline-installed PWA.
- Time fields require their corresponding dates. Repetition requires a date and clamps missing month days to that month's last day without drifting the original anchor.
- Todo includes tasks plus upcoming or ongoing entries with a start or end date. Dated entries receive highlights such as **Starts today**, **Ends today**, **In progress**, and **Coming up**. **everything** includes undated and overdue tasks, plus the next upcoming occurrence of each dated non-task entry.
- Todo and Calendar use an inline **View** filter. Select **everything**, **this**, **last**, or **next**. Choosing this/last/next expands a second dropdown for **day**, **week**, or **month**, defaulting to week. Selecting day collapses the filter to **today**, **yesterday**, or **tomorrow**; the single dropdown also lets you return to this/last/next or everything. Changing this/last/next while viewing a month keeps the month unit. Date filters include entries that overlap the period, including ongoing entries. Weeks run Sunday through Saturday, using local calendar dates. Undated tasks appear only under Todo's **everything** filter; overdue tasks appear in a date filter when their dates overlap it. Calendar's **everything** view lists all dated entries once using their original dates, including repeating entries.
- Calendar offers a day agenda, a seven-day grid with a daily agenda for the whole week, and the month grid with a selected-day agenda. Previous/next buttons move by the selected period; **Back to now** returns to the current period. Choosing a period tab also returns to the current day/week/month.
- A recurring task tracks completion separately for each occurrence. Todo's **everything** normally shows its earliest unfinished occurrence, including overdue occurrences. Enabling **Show completed** also displays its previously checked occurrences so they can be unchecked directly, without changing the date filter or editing the schedule. Date filters show each occurrence within the selected period and reveal checked occurrences when **Show completed** is enabled. They can also be reopened from Calendar.
- Required tasks must be complete before their dependent task can be completed. Non-task requirements are references. A repeating prerequisite is checked at its latest occurrence on or before the dependent occurrence's date.
- Budget shows all-time USD totals, counting each stored item once. Plans and actual transactions are separate entries; actual transactions may link to matching plans. Recurrence displays dates in Calendar and does not automatically create or count transactions.

### Cork board and files

Open **Board** to use the shared cork board. It starts empty: entries appear only after you add them. The two floating buttons open view controls (magnifying glass: zoom percentage, fit, recenter) and add controls (plus emoji: card, polaroid, calendar, or an existing entry). Adding a card or polaroid creates an entry; adding a calendar creates an independent view without an entry. An entry can have several cards.

Cards have a drag handle, the entry name, a color swatch with eight choices, a position pin, and an archive action. Pinning locks the position until unpinned. Archiving hides the card while retaining the entry and its data; restore it from **Add → Archived items**. Drag the corner to resize. Footer tags reflect the entry's people, task status, dates and times, repetition, budget or transaction details, prerequisites, and attachments. Clicking the name or body opens the entry editor.

Cards automatically become polaroids when the entry has supported image attachments and return to notes when the last image is removed. Photos start with white paper and show the first image; previous/next buttons browse additional images, fetching them lazily. Notes start yellow; calendars start blue. Custom colors are preserved.

Drag the background or scroll to pan. Ctrl/Command + scroll zooms around the pointer; the zoom percentage control zooms around the viewport center. **Fit items** brings the board contents into view; **Recenter** centers the items without changing the zoom. Focus the canvas, move handle, or resize handle and use arrow keys for keyboard operation. Card positions, sizes, pins, archives, and colors synchronize between accounts; each browser remembers its own viewport.

Calendar views support day, week, and month, plus a selected-day agenda. **Current** follows the local date automatically, including after midnight; **Fixed date** stays on a chosen date. Navigating previous/next switches to a fixed date. Calendar titles, settings, and layouts synchronize independently of entries. Older entry-backed calendar cards remain supported without deleting their original entries.

Add the **Files** section in any entry's editor to attach multiple files (up to 20 per entry, 2 MB per file). Images can be previewed; all files can be downloaded. Pending uploads and downloaded files are cached in IndexedDB, separate from entry JSON and localStorage. Files upload before their metadata is synchronized. Image previews load when visible; downloads fetch the selected file on demand. PNG, JPEG, GIF, WebP, and AVIF receive inline previews; other formats download as files.

**Update the Apps Script deployment before using this frontend.** Replace `Code.gs`, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. No additional Script Properties or scopes are needed. The backend automatically adds the missing `boardItems`, `attachments`, and `name` columns to older `Entries` sheets and creates `BoardViews` for independent calendar views. Older note-only entries migrate their first line into the name and retain the remaining lines as the optional note; IDs, references, files, and card layouts are preserved. The same migration applies to local caches and old JSON backups. The frontend requires sync API version 4 to prevent a stale backend from dropping the new fields.

`Attachments` (file metadata/index) and `AttachmentData` (data URL chunks) are created on the first file request. Each data URL is split into 40,000-character chunks to stay within Sheets' per-cell limit. Ordinary reads, writes, and cached snapshots contain metadata only; a separate authenticated file request reads the selected file's chunks. Both whitelisted accounts can retrieve shared attachments.

Removing an attachment or deleting its entry removes its reference; stored file chunks are retained, with no automatic garbage collection yet. JSON export/import includes board layout and file metadata, **not file bytes**. Keep the backing spreadsheet for a complete backup. Unsynced local files exist only in the originating browser until upload succeeds.

### Verification

The interface uses system sans-serif text at an 18px default, supporting text at approximately 16px, high-contrast colors, and controls with at least 44px-high interactive targets. Spacing is compact, navigation labels stay visible on small screens, and forms stack rather than shrinking their text. Calendar grids scroll horizontally on narrow screens; the full day/week agenda remains below the grid. Browser text-size preferences and zoom remain supported.

Successful task completion triggers a brief checkmark and randomized particles matched to the task text or financial attributes. Reopening tasks, blocked completions, and failed local saves do not celebrate. Hovering or focusing Delete adds a small tremble and sweat effect without moving the button. The sign-in page includes a waving brain emoji. Navigation and decorative icons use emoji alongside readable labels where applicable. All decorative effects are hidden from assistive technology, completion is announced separately, and animated effects are disabled by `prefers-reduced-motion`.

```sh
npm test
npm run build
npm run preview
```

Tests cover recurrence and leap-year clamping, overlapping calendar spans, dependency cycles and ordering, per-occurrence task completion, data validation, backend whitelist enforcement, stale-write protection, and safe Sheet serialization. Backend tests use local Apps Script mocks; live Google consent, deployed GAS permissions, and cross-origin redirects need the setup smoke test above.

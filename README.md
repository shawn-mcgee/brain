Brain is a family organizer that uses Google Sheets (via Google Apps Script) to store and synchronize data. The React web app is hosted statically on GitHub Pages. Google accounts are authorized by an email whitelist in the Apps Script backend; Firebase is not used.

### Features

#### Data

Brain collects structured data from your family and organizes it into various linked views.

Each entry can have different attributes associated with it in various combinations.

**Note**
This attribute is simply arbitrary text. It could be a name, a phone number, a description, or anything else.

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

The inbox is a single entry point for new data. The inbox has a gui that lets you compose an entry from various attributes. Once you are done, you can save the entry to the database.

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
- A recurring task tracks completion separately for each occurrence. Todo's **everything** shows its earliest unfinished occurrence, including overdue occurrences. Date filters show each occurrence within the selected period. **Show completed** reveals completed occurrences in date filters; they can also be reopened from Calendar.
- Required tasks must be complete before their dependent task can be completed. Non-task requirements are references. A repeating prerequisite is checked at its latest occurrence on or before the dependent occurrence's date.
- Budget shows all-time USD totals, counting each stored item once. Plans and actual transactions are separate entries; actual transactions may link to matching plans. Recurrence displays dates in Calendar and does not automatically create or count transactions.

### Verification

```sh
npm test
npm run build
npm run preview
```

Tests cover recurrence and leap-year clamping, overlapping calendar spans, dependency cycles and ordering, per-occurrence task completion, data validation, backend whitelist enforcement, stale-write protection, and safe Sheet serialization. Backend tests use local Apps Script mocks; live Google consent, deployed GAS permissions, and cross-origin redirects need the setup smoke test above.

#### Rules

The rules view allows you to view, copy, and modify existing entries.

#### Board

The board view is a virtual infinite cork board that can be used to visualize entries.

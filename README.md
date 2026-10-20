Brain is a family organizer that uses Google Sheets (via Google Apps Script) to store and synchronize data. The React web app is hosted statically on GitHub Pages. Google accounts are authorized by an email whitelist in the Apps Script backend; Firebase is not used.

### Features

#### Data

Brain collects structured data from your family and organizes it into various linked views.

Each thought can have different attributes associated with it in various combinations.

**Name**
Each thought requires a name. Names may repeat; thoughts and their references use unique IDs.

**Note**
An optional text enhancement for descriptions, phone numbers, or other details. It becomes the body of a sticky note or the description beneath a polaroid. Add or remove it using the Note section in the thought form.

**Who**
This attribute indicates that a thought is associated with one or more persons.

**Task**
This attribute indicates that a thought is a task that has a binary completion status(Done, or Not Done).

**Waiting on**
This attribute indicates a one-way dependency between thoughts. For example, if task `A` requires task `B`, then task `B` must be completed before task `A` can be completed. _Requirements do no have to be tasks_

**When**
One date or a date/time range. Adding When selects today's date; time is optional. Turn on **Range** to reveal the end date/time, initially matching the start. Turning Range off links both endpoints. Tasks are due at the end, and filtered views show them whenever the range overlaps. Older single-ended dates migrate to matching endpoints.

**Repeats**
This attribute indicates that a thought must be repeated at a certain interval. _A thought can only repeat if it has a When date._ **Until** can be **Forever** or a specific date, inclusive of occurrence start dates. The last occurrence can extend past Until when it is a range. Copying a repeating thought offers a separate copy or **Change future occurrences**. The latter opens a replacement draft from a chosen date and ends the original the preceding day only when you save. Earlier history stays with the original; replacement progress starts unchecked. The replacement date must be after the original start and within its Until limit, if set. Canceling leaves the original untouched.

| Interval      | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| Daily         | Repeats at the same time every day.                                         |
| Weekly        | Repeats at the same time, on the same day of the week, every week.          |
| Monthly       | Repeats at the same time, on the same day of the month, every month.        |
| Quarterly     | Repeats at the same time, on the same day of the month, every three months. |
| Semi-annually | Repeats at the same time, on the same day of the month, every six months.   |
| Annually      | Repeats at the same time, on the same day of the month, every year.         |

When a thought repeats on the 29th, 30th, or 31st, but a month does not have enough days then the thought will repeat on the last day of the month instead.

**Budget**
This attribute indicates that a thought is a budget thought. A budget thought is a financial obligation that must be met. It can be an income or an expense of a certain amount.

**Income**
This attribute indicates that a thought is a tracked income thought (an actual transaction). A tracked income thought can correspond to a specific budget thought, or it can be one-off.

**Expense**
This attribute indicates that a thought is a tracked expense thought (an actual transaction). A tracked expense thought can correspond to a specific budget thought, or it can be one-off.

#### Inbox

The Inbox embeds the thought form. Sections appear in the order you add them. Attribute buttons follow this order: Note, Task, Waiting on (available with Task), List, Who, When, Repeats (available with When), Where, Money, Files, Color, Group, Tags. Removing When also removes repetition and its history. Sections collapse without clearing values; **Remove** clears their values. Saving creates the thought and resets the form; Clear resets without saving. Drafts remain when switching tabs. Other views open the same form in an **Add thought** popup.

#### Todo

The Todo list is a list of thoughts that have been marked as tasks (or have a beginning/end date). The todo list automatically sorts thoughts by their due dates (sorting required thoughts before their dependent task).

#### Calendar

The calendar is a view of thoughts that have any combination of beginning, ending, and repeating dates/times.

#### Budget

The budget is a list of thoughts that have been marked as budget thoughts. The budget view can track income and expenses. Money uses a **Planned / Tracked** toggle. Enter positive amounts for income and negative amounts for expenses; the form updates its label as the sign changes. Existing unsigned storage and totals remain compatible.

**Track income / Track expense** opens an unsaved, linked transaction draft with a note, today's When date, and an empty amount. Completing a budget task offers to open the same form with its amount filled in. Completing a non-repeating task offers Keep (the default) or Delete; budget tasks also offer tracking in that dialog. Deleting a thought requires an in-app confirmation.

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
7. Sign in from the frontend using an allowed account and add a thought. After a one-second pause it syncs automatically. Sign in from the other spouse's browser to retrieve it; subsequent remote changes refresh every 30 seconds. **Sync now** in Settings is available for an immediate refresh. Also check that an account outside the whitelist is denied.

After backend code changes, update the deployment to a **new version**, keeping its existing URL. `Entries` is created automatically on the first authorized request. The script stores one structured thought per row, with JSON-encoded cells to preserve types and prevent formula execution. Treat this sheet as app-managed storage; direct edits bypass revision tracking and may produce invalid data. Use the app's editor and JSON import/export instead.

If sign-in reports **Another sync is in progress**, update `Code.gs` and choose **Deploy → Manage deployments → Edit → New version → Deploy**. The backend now returns a retryable `BUSY` response after a short lock wait, and the frontend retries that response automatically (including the older text-only error). Small committed snapshots are cached by spreadsheet and revision for two minutes, so authenticated readers usually do not wait for a writer; cache failures fall back to a locked Sheet read. Whitelist checks still run before accessing the cache. Persistently busy requests can indicate a long-running execution; inspect the Apps Script **Executions** page.

The sign-in button distinguishes **Waiting for Google** from **Connecting to Sheet** and offers **Cancel sign-in**. Missing Google callbacks time out after 90 seconds; Sheet requests time out after 30 seconds each, with a 60-second overall limit across busy retries. Network failures and authentication errors are not blindly retried as writes. Empty cached connection fields fall back to the configured build values, without clearing local thoughts.

See Google's [web app deployment documentation](https://developers.google.com/apps-script/guides/web) and [Content Service redirect behavior](https://developers.google.com/apps-script/reference/content/content-service). Requests use a plain-text JSON POST to avoid a CORS preflight, then follow Google's JSON response redirect. Live cross-origin sync must be verified against your actual deployment; incorrect deployment permissions commonly return a Google sign-in page instead of JSON.

### Publish on GitHub Pages

1. Push this folder to a GitHub repository with a `main` branch.
2. Under **Settings → Secrets and variables → Actions → Variables**, create `VITE_GOOGLE_CLIENT_ID` and `VITE_APPS_SCRIPT_URL`. These are public identifiers embedded in the build, not secrets.
3. Under **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main`, or run **Deploy Brain to GitHub Pages** manually from Actions. The [workflow](.github/workflows/pages.yml) installs from the lockfile, runs tests, builds, and deploys `dist/` using the standard GitHub Pages actions.

Vite uses relative asset URLs, so the same build works at `https://YOUR-USERNAME.github.io/brain/` or a custom domain. Navigation is state-based and does not require server route rewrites. The frontend is static; all shared data requests go to GAS.

See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### Data and synchronization behavior

- Thoughts are saved locally after each edit and sync automatically one second after the last edit while signed in. Clean workspaces pull remote changes every 30 seconds. **Sync now** in Settings starts an immediate sync, and reconnecting to the network triggers another attempt. Access tokens still expire normally; sign in again when prompted.
- Both accounts share the same family dataset. A script lock and shared revision reject stale writes instead of silently overwriting another browser's changes.
- On a revision conflict, the app downloads the latest snapshot, performs a three-way merge against its saved last-synced snapshot, and retries up to five writes per sync attempt. Independent thought and field changes combine; list fields combine additions and removals. A deletion removes an unchanged thought, but a concurrent edit survives a deletion. Concurrent changes to the same scalar field retain the local version and preserve the remote version as a separate thought labeled **Version preserved during automatic merge**. Invalid combined dates or financial types also preserve both versions. Dangling links are detached, and dependency edges that would create a cycle are removed with a merge notice.
- Local edits made during a sync are rebased onto the acknowledged snapshot and queued for another upload. Network failures leave unsynced local changes intact and retry with exponential backoff, capped at 30 seconds. If the browser closes, changes remain cached for the next sign-in; this is not a background service worker.
- A local workspace with unsynced thoughts automatically merges with an existing Sheet after signing in. Older browser caches without a baseline merge conservatively by keeping thoughts from both sides, rather than inferring deletions. Settings still offers **Load Sheet version** to explicitly discard the current local changes. Importing an older backup replaces matching IDs locally, so review it before automatic upload.
- Sign-out hides the workspace but keeps its local cache for the next family sign-in. Local data is not encrypted; use a trusted browser profile. The app is not an offline-installed PWA.
- Time fields require their corresponding dates. Repetition requires a date and clamps missing month days to that month's last day without drifting the original anchor.
- Todo includes tasks plus upcoming or ongoing thoughts with a start or end date. Dated thoughts receive highlights such as **Starts today**, **Ends today**, **In progress**, and **Coming up**. **All** includes undated and overdue tasks, plus the next upcoming occurrence of each dated non-task thought.
- Todo and Calendar offer **All**, **Day**, **Week**, and **Month**. Arrow buttons step one selected period at a time, and a small title names the relative period (for example, **Last Week of October 11**). Todo starts on the current week; Calendar starts on the current month. Undated tasks appear once in an **Any time** section at the bottom of the current agenda, including All. Weeks start on Sunday.
- Calendar offers a day agenda, a seven-day grid with a daily agenda for the week, and a month grid with a selected-day agenda. All lists dated thoughts once using their original dates. Changing the period selector returns to the current date.
- A recurring task tracks completion separately for each occurrence. Todo's **All** normally shows its earliest unfinished occurrence, including overdue occurrences. Enabling **Show completed** also displays its previously checked occurrences so they can be unchecked directly, without changing the date filter or editing the schedule. Date filters show each occurrence within the selected period and reveal checked occurrences when **Show completed** is enabled. They can also be reopened from Calendar.
- Required tasks must be complete before their dependent task can be completed. Non-task requirements are references. A repeating prerequisite is checked at its latest occurrence on or before the dependent occurrence's date.
- Budget shows all-time USD totals, counting each stored thought once. Plans and actual transactions are separate thoughts; actual transactions may link to matching plans. Recurrence displays dates in Calendar and does not automatically create or count transactions.

Sync status floats next to the theme toggle on every tab, including Board. Its circle expands into a description pill on mouse hover or keyboard focus; tap it on touch screens. Manual **Sync now** remains in Settings.

The moon/sun button in the top-right corner switches between a soft pink light theme and a muted purple dark theme on every view. It follows the system theme until you choose a mode, then remembers that choice on this browser. The preference is separate from your shared workspace and also applies to dialogs and board cards.

### Thought attributes and editing

**Thoughts** shows every thought, including thoughts without cards, dates, tasks, or financial details. Its search checks names, notes, people, locations, tags, groups, and colors. Thoughts can be edited or deleted there.

Who, Where, Tags, and Group autocomplete from existing thoughts while allowing new values. Separate multiple people or tags with commas. A thought belongs to one Group; Color uses the board's eight-color palette and applies to all its cards. Attribute descriptions explain the fields. Context-specific new forms start with Money in Budget, Note/Task/When in Todo, and Note/When/Where in Calendar. Name placeholders have 400 literary combinations.

The popup scrolls its fields while keeping **Copy**, **Cancel**, and **Save** available in the bottom action row. Copy creates an unsaved draft with a new ID and a **Copy of** name; it does not create a thought until Save. For repeating thoughts, a dialog offers a separate copy or a replacement for future occurrences. A replacement retains the thought name and shows the original cutoff in the editor. Its When start date determines the cutoff on Save. If the original was deleted or its schedule changed while the draft was open, saving is blocked so you can copy the current version. Thought field values and attachment references are copied, while board placements are cleared. All success notifications have a six-second countdown ring around the dismiss control; hovering or focusing a toast pauses its timer.

### Cork board and files

Open **Board** to use the shared board. Its neutral background follows light/dark mode, with repeating medium-tone circles that move and scale with the canvas. It starts empty: thoughts appear only after you add them. The two floating buttons open view controls (magnifying glass: zoom percentage, fit, recenter) and add controls (plus emoji: card, polaroid, calendar, or an existing thought). Adding a card or polaroid creates a thought; adding a calendar creates an independent view without a thought. A thought can have several cards.

Cards have a draggable header, the thought name, a color swatch with eight choices, a position pin, and a ✖️ remove button. Pinning locks the position until unpinned. Removing a card from the board retains its thought and data in **Thoughts**; add it back using **Add → Pin existing thought**. Drag the corner to resize. Footer tags reflect the thought's people, task status, dates and times, repetition, budget or transaction details, prerequisites, and attachments. The pencil opens the full thought editor. Click a card name, note, caption, or checklist line to edit it inline; leaving the field saves and Escape cancels. Enter saves a name or list line; Ctrl/Command+Enter saves multiline notes and captions. Task checkboxes and checklist controls work directly on the card, including adding and removing lines. Images have floating 🔍 preview, ⬇️ download, and 🗑️ remove buttons. Clicking the image itself does not open the preview. Removing the last image turns the card back into a note. Notes appear before task and checklist controls, with content aligned to the top. Checklist cards default to a cool mint green unless a color is explicitly selected. Calendar names can also be edited by clicking them.

Cards automatically become polaroids when the thought has supported image attachments and return to notes when the last image is removed. Photos start with white paper and show the first image; previous/next buttons browse additional images, fetching them lazily. Notes start yellow; calendars start blue. Custom colors are preserved.

Drag the background to pan. Scroll zooms around the pointer without a modifier key; scrolling inside an overflowing card body still scrolls its content; the zoom percentage control zooms around the viewport center. **Fit thoughts** brings the board contents into view; **Recenter** centers the thoughts without changing the zoom. Focus the canvas, move handle, or resize handle and use arrow keys for keyboard operation. Card positions, sizes, pins, and thought colors synchronize between accounts; each browser remembers its own viewport.

Board search dims nonmatching cards without hiding or removing them. Groups appear automatically around visible cards sharing a Group value. A group's handle moves all its members, including individually pinned cards; the group pin locks its own handle. Hide collapses the cards and dotted boundary while leaving group controls available. Pack arranges members into a compact, roughly square layout. Calendar cards start at 840 by 850 board pixels and preserve their aspect ratio while resizing.

Calendar views support day, week, and month, plus a selected-day agenda. **Current** follows the local date automatically, including after midnight; **Fixed date** stays on a chosen date. Navigating previous/next switches to a fixed date. Calendar titles, settings, and layouts synchronize independently of thoughts. Older entry-backed calendar cards remain supported without deleting their original thoughts.

Add the **Files** section in any thought's editor to attach multiple files (up to 20 per thought, 2 MB per file). Image thumbnails appear automatically below the upload field; the floating 🔍 button opens the same image popup used on the board. Floating ⬇️ and 🗑️ buttons download or remove the image. All files can be downloaded. Pending uploads and downloaded files are cached in IndexedDB, separate from thought JSON and localStorage. Files upload before their metadata is synchronized. Image previews load when visible; downloads fetch the selected file on demand. PNG, JPEG, GIF, WebP, and AVIF receive inline previews; other formats download as files.

**Update the Apps Script deployment before using this frontend.** Replace `Code.gs`, then choose **Deploy → Manage deployments → Edit → New version → Deploy**. No additional Script Properties or scopes are needed. The backend automatically adds the missing `boardItems`, `attachments`, `name`, `where`, `color`, `tags`, `group`, `list`, `repeatUntil`, `budgetOrder`, and `budgetGroupOrder` columns to older `Entries` sheets and creates `BoardViews` for independent calendar views and group pin/collapse settings. Older note-only thoughts migrate their first line into the name and retain the remaining lines as the optional note; IDs, references, files, and card layouts are preserved. The same migration applies to local caches and old JSON backups. The frontend requires sync API version 9 to prevent a stale backend from dropping the new fields.

The Budget view organizes plans by their **Group** field, initially alphabetically with **Ungrouped** last. Drag the handle beside a group heading to reorder groups, or the handle beside a thought to reorder it within its group. Focus a handle and press ↑ / ↓ for keyboard reordering. Orders save locally and sync to Google Sheets; filtering does not remove hidden thoughts from the saved order.

`Attachments` (file metadata/index) and `AttachmentData` (data URL chunks) are created on the first file request. Each data URL is split into 40,000-character chunks to stay within Sheets' per-cell limit. Ordinary reads, writes, and cached snapshots contain metadata only; a separate authenticated file request reads the selected file's chunks. Both whitelisted accounts can retrieve shared attachments.

Removing an attachment or deleting its thought removes its reference; stored file chunks are retained, with no automatic garbage collection yet. JSON export/import includes board layout and file metadata, **not file bytes**. Keep the backing spreadsheet for a complete backup. Unsynced local files exist only in the originating browser until upload succeeds.

### Verification

The interface uses system sans-serif text at an 18px default, supporting text at approximately 16px, high-contrast colors, and readable controls and compact 28px task checkboxes. Spacing is compact, navigation labels stay visible on small screens, and forms stack rather than shrinking their text. Calendar grids scroll horizontally on narrow screens; the full day/week agenda remains below the grid. Browser text-size preferences and zoom remain supported.

Successful task completion triggers a brief checkmark and randomized particles matched to the task text or financial attributes. Reopening tasks, blocked completions, and failed local saves do not celebrate. Incomplete-task checkboxes anticipate completion with eyes and exclamation marks; completed tasks show concern before reopening. Editable thoughts show pencil/question cues. Delete becomes nervous, then briefly shows the face-exhaling emoji when hover or focus leaves. Attribute headers use a sleeping/hiding monkey while collapsed and an awake monkey/eyes while expanded. The sign-in page includes a waving brain emoji. Navigation and decorative icons use emoji alongside readable labels where applicable. All decorative effects are hidden from assistive technology, completion is announced separately, and animated effects are disabled by `prefers-reduced-motion`.

```sh
npm test
npm run build
npm run preview
```

Tests cover recurrence and leap-year clamping, overlapping calendar spans, dependency cycles and ordering, per-occurrence task completion, data validation, backend whitelist enforcement, stale-write protection, and safe Sheet serialization. Backend tests use local Apps Script mocks; live Google consent, deployed GAS permissions, and cross-origin redirects need the setup smoke test above.


### Lists and Waiting on

**Waiting on** selects multiple existing thoughts. Tasks in that selection must be completed before this task can be completed; other thoughts remain references. Existing links are preserved.

Add **List** in the thought form to create a checklist. Lines can be added, edited, removed, and checked. Lists also appear on thought rows and board cards. On a task, checking the final line completes the task; unchecking any line reopens it. Checking or unchecking the task checks or unchecks the entire list. Waiting on tasks still block completion. A list without the Task attribute works as an independent checklist. Repeating tasks track checklist progress separately for each occurrence.

List metadata is stored in the new JSON `list` column on `Entries`. Existing Sheets, browser caches, and backups gain an empty list automatically. Sync API version 8 prevents older clients or deployments from silently discarding checklist data. Deploy the updated Apps Script as a new web-app version before syncing this frontend.

**Add list** in the board?s plus menu creates a green card with Note and List sections ready to use. Task is off by default. An empty list remains available on that card after reopening the board.

**Pin existing thought** in the board?s plus menu opens a searchable thoughts popup. Filter by person, group, type, and board status. Thoughts already placed on the board are dimmed and disabled, including thoughts in collapsed groups. The popup stays open so multiple thoughts can be pinned.

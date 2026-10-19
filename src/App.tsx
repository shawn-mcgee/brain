import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  blankEntry,
  dateKey,
  parseDate,
  addDays,
  daysBetween,
  intervals,
  occurrences,
  isDone,
  requirementDone,
  periodRange,
  periodKind,
  shiftPeriod,
  todoOccurrences,
  occurrenceHighlight,
  validateEntry,
  decodeEntries,
} from "./domain";
import type { Entry } from "./domain";
import type { Period } from "./domain";
import type { TimeWindow } from "./time-window";
import TimeWindowFilter from "./TimeWindowFilter";
import {
  loadStore,
  saveStore,
  emptyStore,
  request,
  validEndpoint,
} from "./storage";
import type { Store } from "./storage";
import type { Connection } from './storage';
import Attachments from './Attachments';
import Board from './Board';
import type { BoardItem } from './board-model';
import { mergeItems, decodeBoardViews } from './board-model';
import { uploadPendingFiles } from './files';
import { login, logout } from "./auth";
import type { Session } from "./auth";
import { mergeEntries, synchronize } from "./sync";
import { taskParticles } from "./personality";
import TaskCelebration from "./TaskCelebration";
import type { Celebration } from "./TaskCelebration";
import SignInCharacter from "./SignInCharacter";
import Curiosity from "./Curiosity";
import AttributeInput from './AttributeInput';
import Toast from './Toast';
import PersonalitySurface from './PersonalitySurface';
import {boardColors} from './board-model';
import {entrySearchText,copyEntry,defaultSections,fancyName} from './entry-attributes';
import { toggleDisclosure } from "./disclosure";
import {
  sectionNames,
  sectionEmoji,
  sectionDescriptions,
  initialEntrySections,
  availableEntrySections,
  removeEntrySection,
  initializeEntrySection,
} from "./entry-sections";
import type { EntrySection as Section } from "./entry-sections";
import "./App.css";

type View = "Inbox" | "Todo" | "Calendar" | "Budget" | "Board" | "Inventory";
const icons: Record<string, string> = {
  Inventory: "\u{1F5C3}\uFE0F",
  Board: "📌",
  Inbox: "📥",
  Todo: "✅",
  Calendar: "📅",
  Budget: "💰",
};
const money = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
const formatDate = (s: string, weekday = false) =>
  s
    ? parseDate(s).toLocaleDateString(undefined, {
        weekday: weekday ? "short" : undefined,
        month: "short",
        day: "numeric",
      })
    : "";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";

function Modal({
  title,
  children,
  close,
  actions,
  entryModal=false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  actions?: ReactNode;
  entryModal?:boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={entryModal?"entry-modal":undefined}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        {!entryModal&&<div className="modal-head-actions">
        {actions}
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          Close
        </button>
        </div>}
      </div>
      {children}
    </dialog>
  );
}

function Editor({
  entry,
  entries,
  save,
  close,
  embedded = false,
  connection,
  token,
  presetSections=[],
  onCopy,
}: {
  entry: Entry;
  entries: Entry[];
  save: (e: Entry) => void;
  close: () => void;
  embedded?: boolean;
  connection: Connection;
  token?: string;
  presetSections?:Section[];
  onCopy?:(entry:Entry)=>void;
}) {
  const formId=useId();
  const [namePlaceholder]=useState(fancyName);
  const [draft, setDraft] = useState(()=>({...entry,...(presetSections.includes('task')?{task:true}:{})})),
    [error, setError] = useState("");
  const [filesBusy,setFilesBusy]=useState(false);
  const [sections, setSections] = useState<Section[]>(() =>
    [...new Set([...initialEntrySections(entry),...presetSections])],
  );
  const availableSections = availableEntrySections(sections);
  const sectionRefs = useRef<
    Partial<Record<Section, HTMLDetailsElement | null>>
  >({});
  const sectionButtonRefs = useRef<
    Partial<Record<Section, HTMLButtonElement | null>>
  >({});
  const [sectionStatus, setSectionStatus] = useState("");
  function removeSection(section: Section) {
    if (section === "attachments" && filesBusy) return;
    const removed = removeEntrySection(draft, sections, section);
    const removedRepeat =
      sections.includes("repeat") &&
      !removed.sections.includes("repeat") &&
      section !== "repeat";
    setDraft(removed.entry);
    setSections(removed.sections);
    setError("");
    setSectionStatus(
      `${sectionNames[section]} removed. Its form values were cleared.${removedRepeat ? " Repeats was also removed because no time sections remain." : ""}`,
    );
    requestAnimationFrame(() => sectionButtonRefs.current[section]?.focus());
  }
  function addSection(section: Section) {
    if (!availableSections.includes(section)) return;
    setSections((current) =>
      current.includes(section) ? current : [...current, section],
    );
    setDraft(current=>initializeEntrySection(current,section));
    requestAnimationFrame(() => {
      const element = sectionRefs.current[section];
      if (element) {
        element.open = true;
        element.querySelector<HTMLElement>("input, select, textarea")?.focus();
      }
    });
  }
  const update = (values: Partial<Entry>) =>
    setDraft((d) => ({ ...d, ...values }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if(filesBusy){setError('Wait for the files to finish saving.');return;}
    const cleaned = {
      ...draft,
      name: draft.name.trim(),
      note: draft.note.trim(),
      where:draft.where.trim(),
      group:draft.group.trim(),
      updatedAt: new Date().toISOString(),
    };
    const issue =
      sections.includes("money") &&
      !cleaned.budgetType &&
      !cleaned.transactionType
        ? "Choose an item type for Money, or remove the Money section."
        : validateEntry(cleaned, entries);
    if (issue) {
      setError(issue);
      Object.values(sectionRefs.current).forEach((section) => {
        if (section) section.open = true;
      });
    } else save(cleaned);
  }
  const fields = {
    attachments: <Attachments value={draft.attachments} entryId={draft.id} connection={connection} token={token} onChange={attachments=>update({attachments})} onBusyChange={setFilesBusy}/>,
    note: (
      <>
        <label>
          <span className="screen-reader-only">Note</span>
          <textarea
            rows={3}
            placeholder="Add a note"
            value={draft.note}
            onChange={(e) => update({ note: e.target.value })}
          />
        </label>
      </>
    ),
    who: <AttributeInput label="Who" multiple value={draft.who} options={[...new Set(entries.flatMap(e=>e.who))].sort()} onChange={value=>update({who:[...new Set(value.split(',').map(v=>v.trim()).filter(Boolean))]})}/>,
    where: <AttributeInput label="Where" value={draft.where} options={[...new Set(entries.map(e=>e.where).filter(Boolean))].sort()} onChange={where=>update({where})}/>,
    group: <AttributeInput label="Group" value={draft.group} options={[...new Set(entries.map(e=>e.group).filter(Boolean))].sort()} onChange={group=>update({group})}/>,
    tags: <AttributeInput label="Tags" multiple value={draft.tags} options={[...new Set(entries.flatMap(e=>e.tags))].sort()} onChange={value=>update({tags:[...new Set(value.split(',').map(v=>v.trim()).filter(Boolean))]})}/>,
    color: <select aria-label="Thought color" value={draft.color} onChange={event=>update({color:event.target.value})}><option value="">Automatic</option>{boardColors.map(color=><option key={color}>{color}</option>)}</select>,
    task: null,
    begins: (
      <>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={draft.beginsOn}
              onChange={(e) =>
                update({
                  beginsOn: e.target.value,
                  beginsAt: e.target.value ? draft.beginsAt : "",
                })
              }
            />
          </label>
          <label>
            Time
            <input
              type="time"
              disabled={!draft.beginsOn}
              value={draft.beginsAt}
              onChange={(e) => update({ beginsAt: e.target.value })}
            />
          </label>
        </div>
      </>
    ),
    ends: (
      <>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              min="1900-01-01"
              max="2200-12-31"
              value={draft.endsOn}
              onChange={(e) =>
                update({
                  endsOn: e.target.value,
                  endsAt: e.target.value ? draft.endsAt : "",
                })
              }
            />
          </label>
          <label>
            Time
            <input
              type="time"
              disabled={!draft.endsOn}
              value={draft.endsAt}
              onChange={(e) => update({ endsAt: e.target.value })}
            />
          </label>
        </div>
      </>
    ),
    repeat: (
      <>
        <label>
          <span className="screen-reader-only">Repeats</span>
          <select
            value={draft.repeat}
            onChange={(e) =>
              update({ repeat: e.target.value as Entry["repeat"] })
            }
          >
            <option value="">Does not repeat</option>
            {intervals.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
      </>
    ),
    requires: (
      <>
        <p className="hint">
          Required tasks must be done first. Other items act as reference
          information.
        </p>
        {entries.filter((e) => e.id !== draft.id).length ? (
          <div className="dependency-options">
            {entries
              .filter((e) => e.id !== draft.id)
              .map((e) => (
                <label key={e.id} className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.requires.includes(e.id)}
                    onChange={(event) =>
                      update({
                        requires: event.target.checked
                          ? [...draft.requires, e.id]
                          : draft.requires.filter((id) => id !== e.id),
                      })
                    }
                  />
                  {e.name}
                </label>
              ))}
          </div>
        ) : (
          <p className="muted">Add another item to link a requirement.</p>
        )}
      </>
    ),
    money: (
      <>
        <div className="form-grid">
          <label>
            Type (required)
            <select
              required
              value={
                draft.budgetType
                  ? `budget-${draft.budgetType}`
                  : draft.transactionType
              }
              onChange={(e) => {
                const v = e.target.value;
                update({
                  budgetType: v.startsWith("budget-")
                    ? (v.slice(7) as Entry["budgetType"])
                    : "",
                  transactionType:
                    v && !v.startsWith("budget-")
                      ? (v as Entry["transactionType"])
                      : "",
                  budgetId: "",
                });
              }}
            >
              <option value="" disabled hidden />
              <option value="budget-income">Planned income</option>
              <option value="budget-expense">Planned expense</option>
              <option value="income">Actual income</option>
              <option value="expense">Actual expense</option>
            </select>
          </label>
          <label>
            Amount (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!draft.budgetType && !draft.transactionType}
              value={draft.amount}
              onChange={(e) => update({ amount: Number(e.target.value) })}
            />
          </label>
        </div>
        {draft.transactionType && (
          <label>
            Budget item
            <select
              value={draft.budgetId}
              onChange={(e) => update({ budgetId: e.target.value })}
            >
              <option value="">One-off transaction</option>
              {entries
                .filter(
                  (e) =>
                    e.id !== draft.id && e.budgetType === draft.transactionType,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </>
    ),
  };
  const form = (
    <form id={formId} onSubmit={submit} onInvalidCapture={event=>{const details=(event.target as HTMLElement).closest('details');if(details)details.open=true;}} className="editor">
      <div className="editor-fields">
      <label className="entry-name">Name<small className="attribute-description">A name for this item. Names can be shared by different items.</small><input autoFocus required maxLength={10000} value={draft.name} placeholder={namePlaceholder} onChange={event=>update({name:event.target.value})}/></label>
      {sections.map((section) => (
        <div className="entry-section" key={section}>
          <details
            className="entry-field-section"
            open
            ref={(element) => {
              sectionRefs.current[section] = element;
            }}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                toggleDisclosure(
                  event.currentTarget.parentElement as HTMLDetailsElement,
                );
              }}
            >
              <span className="entry-section-heading">
                <span aria-hidden="true">{sectionEmoji[section]}</span>{" "}
                {sectionNames[section]} <Curiosity attribute />
              </span>
              <button
                type="button"
                className="remove-section"
                aria-label={`Remove ${sectionNames[section]} section`}
                onClick={(event) => {
                  event.stopPropagation();
                  removeSection(section);
                }}
              >
                <span aria-hidden="true">✖️</span> Remove
              </button>
            </summary>
            <div className="entry-section-fields"><p className="attribute-description">{sectionDescriptions[section]}</p>{fields[section]}</div>
          </details>
        </div>
      ))}
      {availableSections.length > 0 && (
        <div
          className="entry-section-buttons"
          role="group"
          aria-label="Add fields"
        >
          {availableSections.map((section) => (
            <button
              key={section}
              type="button"
              className="secondary"
              ref={(button) => {
                sectionButtonRefs.current[section] = button;
              }}
              onClick={() => addSection(section)}
            >
              <span aria-hidden="true">{sectionEmoji[section]}</span>{" "}
              {sectionNames[section]}
            </button>
          ))}
        </div>
      )}
      <span className="screen-reader-only" role="status">
        {sectionStatus}
      </span>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      </div>
      <div className="modal-actions">
        {onCopy&&entries.some(saved=>saved.id===entry.id)&&<button type="button" className="secondary" disabled={filesBusy} onClick={()=>onCopy(draft)}>Copy</button>}
        <button type="button" className="secondary" onClick={close}>
          {embedded ? "Clear" : "Cancel"}
        </button>
        <button className="primary" type="submit" disabled={filesBusy}>
          Save <span aria-hidden="true">💾</span>
        </button>
      </div>
    </form>
  );
  return embedded ? (
    <section className="inbox-form" aria-label="New item">
      {form}
    </section>
  ) : (
    <Modal
      title={
        entries.some((e) => e.id === entry.id) ? "Edit item" : "New item"
      }
      close={close}
      entryModal
    >
      {form}
    </Modal>
  );
}

function App() {
  const [initial] = useState(() => {
    try {
      return { store: loadStore(), error: "" };
    } catch {
      return {
        store: emptyStore,
        error:
          "Saved browser data could not be read. It has been left untouched. Export or recover it before making changes.",
      };
    }
  });
  const [store, setStore] = useState<Store>(initial.store),
    [storageError, setStorageError] = useState(initial.error);
  const [session, setSession] = useState<Session | null>(null),
    [localMode, setLocalMode] = useState(false);
  const [view, setView] = useState<View>("Inbox"),
    [editor, setEditor] = useState<Entry | null>(null),
    [settings, setSettings] = useState(false);
  const [copyDraftId,setCopyDraftId]=useState('');
  const [inboxEntry, setInboxEntry] = useState(blankEntry);
  const [search, setSearch] = useState(""),
    [person, setPerson] = useState(""),
    [showDone, setShowDone] = useState(false);
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [syncFailures, setSyncFailures] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [signInStage, setSignInStage] = useState<"google" | "sheet" | null>(
    null,
  );
  const signInAttempt = useRef<AbortController | null>(null);
  useEffect(() => () => signInAttempt.current?.abort(), []);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [taskFeedback, setTaskFeedback] = useState("");
  const [calendarAnchor, setCalendarAnchor] = useState(() =>
    dateKey(new Date()),
  );
  const [calendarPeriod, setCalendarPeriod] = useState<TimeWindow>("This Month");
  const [todoPeriod, setTodoPeriod] = useState<Period | "All">("This Week");
  const [todoAnchor,setTodoAnchor]=useState(()=>dateKey(new Date()));
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [connection, setConnection] = useState(store.connection);
  const stateRef = useRef(store),
    busyRef = useRef(false);
  stateRef.current = store;
  const [today, setToday] = useState(() => dateKey(new Date()));
  const unlocked = !!session || localMode;
  useEffect(() => {
    const refreshDate = () => setToday(dateKey(new Date()));
    const timer = window.setInterval(refreshDate, 60000);
    window.addEventListener("focus", refreshDate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => {
        setSession(null);
        setError("Your Google session expired. Sign in again to continue.");
        setNotice("");
      },
      Math.max(0, session.expiresAt - Date.now() - 10000),
    );
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    if (!session || !store.dirty || busy || syncing || storageError) return;
    const timer = window.setTimeout(
      () => {
        void sync(false, true);
      },
      syncFailures
        ? Math.min(30000, 1000 * 2 ** Math.min(syncFailures, 5))
        : 1000,
    );
    return () => clearTimeout(timer);
  }, [
    session,
    store.entries,
    store.dirty,
    busy,
    syncing,
    storageError,
    syncFailures,
  ]);
  useEffect(() => {
    if (!session || storageError) return;
    const refresh = () => {
      if (!busyRef.current && !stateRef.current.dirty) void sync(false, true);
    };
    const reconnect = () => {
      if (!busyRef.current) void sync(false, true);
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("online", reconnect);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", reconnect);
    };
  }, [session, storageError]);
  function commit(next: Store): boolean {
    if (storageError) {
      setError(storageError);
      return false;
    }
    try {
      saveStore(next);
      stateRef.current = next;
      setStore(next);
      return true;
    } catch {
      setError(
        "Browser storage is full or unavailable. Your change was not saved. Export a backup before continuing.",
      );
      return false;
    }
  }
  function change(entries: Entry[]) {
    return commit({ ...stateRef.current, entries, dirty: true });
  }
  function updateBoard(entryId: string, update: (items: BoardItem[]) => BoardItem[]) {
    change(stateRef.current.entries.map(entry => entry.id === entryId ? {...entry, boardItems: update(entry.boardItems), updatedAt: new Date().toISOString()} : entry));
  }
  function changeBoardViews(boardViews:BoardItem[]) {
    try { decodeBoardViews(boardViews); return commit({...stateRef.current,boardViews,dirty:true}); }
    catch(error) { setError(message(error)); return false; }
  }
  async function signIn() {
    if (busyRef.current) return;
    setError("");
    setNotice("");
    if (!validEndpoint(store.connection.url)) {
      setError(
        "Add your Apps Script URL and Google client ID in Settings first.",
      );
      setSettings(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    const attempt = new AbortController();
    signInAttempt.current = attempt;
    setSignInStage("google");
    try {
      const auth = await login(store.connection.clientId, {
        signal: attempt.signal,
      });
      setSignInStage("sheet");
      const data = await request(
        store.connection,
        auth.token,
        "read",
        undefined,
        undefined,
        attempt.signal,
      );
      if (attempt.signal.aborted) return;
      setSession({ ...auth, ...data.user });
      setLocalMode(false);
      const current = stateRef.current;
      const merged = current.dirty
        ? mergeEntries(current.baseEntries, current.entries, data.entries)
        : { entries: data.entries, conflicts: 0 };
      const boardViews=current.dirty ? mergeItems(current.baseBoardViews||[],current.boardViews,data.boardViews) : data.boardViews;
      commit({
        ...current,
        entries: merged.entries,
        baseEntries: data.entries,
        boardViews,
        baseBoardViews: data.boardViews,
        revision: data.revision,
        lastSync: new Date().toISOString(),
      });
      setSyncFailures(0);
      if (merged.conflicts)
        setNotice(
          "Concurrent versions were preserved as separate items during automatic merge.",
        );
    } catch (e) {
      setError(
        attempt.signal.aborted
          ? "Sign-in canceled."
          : e instanceof Error &&
              (e.name === "TimeoutError" || e.name === "AbortError")
            ? "The Sheet connection timed out. Check your Apps Script deployment and try again."
            : message(e),
      );
    } finally {
      signInAttempt.current = null;
      setSignInStage(null);
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function sync(reload = false, automatic = false) {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setSyncing(true);
    if (!automatic) {
      setError("");
      setNotice("");
    }
    try {
      const current = stateRef.current;
      const read = () => request(current.connection, session.token, "read");
      if(current.dirty && !reload) await uploadPendingFiles(current.entries,current.connection,session.token);
      const data = reload
        ? { ...(await read()), conflicts: 0 }
        : await synchronize(current, read, (revision, entries, boardViews) =>
            request(
              current.connection,
              session.token,
              "write",
              revision,
              entries,
              undefined,
              boardViews,
            ),
          );
      const latest = stateRef.current;
      // An editor can save while the network request is in flight. Rebase those
      // new edits on the acknowledged snapshot and schedule another upload.
      const changedDuringSync =
        JSON.stringify([latest.entries,latest.boardViews]) !== JSON.stringify([current.entries,current.boardViews]);
      const rebased = changedDuringSync
        ? mergeEntries(current.entries, latest.entries, data.entries)
        : { entries: data.entries, conflicts: 0 };
      if (
        commit({
          ...latest,
          entries: rebased.entries,
          baseEntries: data.entries,
          boardViews: changedDuringSync ? mergeItems(current.boardViews,latest.boardViews,data.boardViews||[]) : data.boardViews||[],
          baseBoardViews: data.boardViews||[],
          revision: data.revision,
          dirty: changedDuringSync,
          lastSync: new Date().toISOString(),
        })
      ) {
        setSyncFailures(0);
        setError("");
        if (data.conflicts + rebased.conflicts)
          setNotice(
            "Changes merged automatically. Concurrent versions were preserved as separate items; dependency cycles were removed if needed.",
          );
        else if (!automatic) setNotice("Everything is up to date.");
        else if (current.dirty)
          setNotice(
            changedDuringSync
              ? "Changes saved. Syncing newer edits…"
              : "Changes saved to Google Sheets.",
          );
      } else setSyncFailures((n) => n + 1);
    } catch (e) {
      setError(message(e));
      setSyncFailures((n) => n + 1);
    } finally {
      busyRef.current = false;
      setSyncing(false);
    }
  }
  function saveEntry(entry: Entry, source: "popup" | "inbox" = "popup") {
    const current = stateRef.current.entries;
    // Preserve remote changes received while this editor was open.
    const base =
      source === "popup" && editor?.name.trim()
        ? [...current.filter((e) => e.id !== entry.id), editor]
        : current;
    const merged = mergeEntries(
      base,
      [...current.filter((e) => e.id !== entry.id), entry],
      current,
    );
    if (change(merged.entries)) {
      if (source === "inbox") setInboxEntry(blankEntry());
      else setEditor(null);
      setNotice(
        merged.conflicts
          ? "Concurrent versions were preserved as separate items."
          : session
            ? "Thought saved. Syncing automatically…"
            : "Thought saved on this device.",
      );
      setError("");
    }
  }
  function remove(entry: Entry) {
    if (
      !confirm(
        `Delete “${entry.name.slice(0, 80)}”? Links to this item will also be removed.`,
      )
    )
      return;
    change(
      store.entries
        .filter((e) => e.id !== entry.id)
        .map((e) => ({
          ...e,
          requires: e.requires.filter((id) => id !== entry.id),
          budgetId: e.budgetId === entry.id ? "" : e.budgetId,
        })),
    );
  }
  function toggle(entry: Entry, date?: string, origin?: HTMLElement) {
    const done = isDone(entry, date);
    if (!done) {
      const blocked = entry.requires
        .map((id) => store.entries.find((e) => e.id === id))
        .find((e) => e && !requirementDone(e, date || today));
      if (blocked) {
        setError(`Complete “${blocked.name}” first.`);
        return;
      }
    }
    const updated = {
      ...entry,
      updatedAt: new Date().toISOString(),
      ...(entry.repeat && date
        ? {
            completedDates: done
              ? entry.completedDates.filter((d) => d !== date)
              : [...entry.completedDates, date],
          }
        : { completed: !done }),
    };
    if (change(store.entries.map((e) => (e.id === entry.id ? updated : e)))) {
      setError("");
      setTaskFeedback(`${done ? "Reopened" : "Completed"}: ${entry.name}`);
      if (
        !done &&
        origin &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const box = origin.getBoundingClientRect();
        const celebration: Celebration = {
          id: crypto.randomUUID(),
          entryId: entry.id,
          date,
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
          particles: taskParticles(entry),
        };
        setCelebrations((current) => [...current.slice(-3), celebration]);
      }
    }
  }
  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ version: 2, entries: store.entries, boardViews:store.boardViews }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `brain-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()),
        incoming = decodeEntries(Array.isArray(data) ? data : data.entries);
      if (
        !confirm(
          `Merge ${incoming.length} items into this device? Imported items replace existing items with the same ID. Sync will upload the result.`,
        )
      )
        return;
      const merged = [
        ...stateRef.current.entries.filter(
          (e) => !incoming.some((x) => x.id === e.id),
        ),
        ...incoming,
      ];
      decodeEntries(merged);
      const incomingViews=decodeBoardViews(data.boardViews??[]);
      const boardViews=[...stateRef.current.boardViews.filter(item=>!incomingViews.some(other=>other.id===item.id)),...incomingViews];
      decodeBoardViews(boardViews);
      if (commit({...stateRef.current,entries:merged,boardViews,dirty:true})) setNotice("Backup imported on this device.");
    } catch (e) {
      setError(message(e));
    }
  }
  const people = [...new Set(store.entries.flatMap((e) => e.who))].sort();
  const filtered = store.entries.filter(
    (e) =>
      (!search || entrySearchText(e).includes(search.toLowerCase())) &&
      (!person || e.who.includes(person)),
  );
  const todoItems = todoOccurrences(filtered, todoAnchor, todoPeriod, showDone);
  const calendarRange = periodRange(
    calendarPeriod === "All" ? "This Month" : calendarPeriod,
    calendarAnchor,
  );
  const allCalendarEntries = filtered
    .filter((e) => e.beginsOn || e.endsOn)
    .sort((a, b) =>
      (a.beginsOn || a.endsOn).localeCompare(b.beginsOn || b.endsOn),
    );
  const calendarLayout = periodKind(
    calendarPeriod === "All" ? "This Month" : calendarPeriod,
  );
  const calendarStart =
    calendarLayout === "This Month"
      ? addDays(calendarRange.from, -parseDate(calendarRange.from).getDay())
      : calendarRange.from;
  const calendarDays =
    calendarLayout === "This Month"
      ? 42
      : calendarLayout === "This Week"
        ? 7
        : 1;
  const calendarItems = filtered
    .flatMap((e) =>
      occurrences(e, calendarStart, addDays(calendarStart, calendarDays - 1)),
    )
    .sort(
      (a, b) =>
        (a.entry.beginsAt || a.entry.endsAt).localeCompare(
          b.entry.beginsAt || b.entry.endsAt,
        ) || a.entry.name.localeCompare(b.entry.name),
    );
  function selectCalendarPeriod(period: TimeWindow) {
    setCalendarPeriod(period);
    setCalendarAnchor(today);
    const range = periodRange(period === "All" ? "This Month" : period, today);
    setSelectedDay(
      today >= range.from && today <= range.to ? today : range.from,
    );
  }
  function moveCalendar(direction: number) {
    if (calendarPeriod === "All") return;
    const anchor = shiftPeriod(calendarPeriod, calendarAnchor, direction);
    setCalendarAnchor(anchor);
    setSelectedDay(periodRange(calendarPeriod, anchor).from);
  }
  const planned = filtered.filter((e) => e.budgetType),
    transactions = filtered.filter((e) => e.transactionType);
  const total = (entries: Entry[], type: string, planned = false) =>
    entries
      .filter((e) => (planned ? e.budgetType : e.transactionType) === type)
      .reduce((n, e) => n + e.amount, 0);
  function row(e: Entry, date?: string, end?: string, highlight?: string) {
    const due =
        end ??
        (e.repeat && date
          ? addDays(
              date,
              e.beginsOn && e.endsOn ? daysBetween(e.beginsOn, e.endsOn) : 0,
            )
          : e.endsOn || e.beginsOn),
      done = isDone(e, date),
      parent = store.entries.find((x) => x.id === e.budgetId);
    return (
      <PersonalitySurface
        className={`entry-row ${done ? "done" : ""} ${celebrations.some((c) => c.entryId === e.id && c.date === date) ? "celebrating" : ""}`}
        key={`${e.id}:${date || ""}`}
      >
        {e.task ? (
          <button
            className={`task-check ${done ? "checked" : ""}`}
            aria-label={`${done ? "Reopen" : "Complete"} ${e.name}`}
            aria-pressed={done}
            disabled={busy}
            onClick={(event) => toggle(e, date, event.currentTarget)}
          >
            {done ? "✅" : ""}
          </button>
        ) : (
          <span
            aria-hidden="true"
            className={`entry-icon ${e.budgetType || e.transactionType ? "financial" : ""}`}
          >
            {e.budgetType || e.transactionType
              ? "💰"
              : e.beginsOn || e.endsOn
                ? "📅"
                : "📝"}
          </span>
        )}
        <button
          className="entry-content"
          onClick={() => setEditor(e)}
          disabled={busy}
        >
          <strong>{e.name}</strong>
          <span className="entry-meta">
            {highlight && <span className="upcoming-pill">{highlight}</span>}
            {e.who.map((p) => (
              <span key={p} className="person-pill">
                {p}
              </span>
            ))}
            {e.repeat && <span>🔁 {e.repeat}</span>}
            {e.attachments.length>0&&<span>📎 {e.attachments.length} files</span>}
            {e.requires.length > 0 && (
              <span>🔗 {e.requires.length} required</span>
            )}
            {parent && <span>🔗 {parent.name}</span>}
            {!e.task &&
              !e.beginsOn &&
              !e.endsOn &&
              !e.repeat &&
              !e.who.length &&
              !e.budgetType &&
              !e.transactionType && <span>Note</span>}
            <Curiosity />
          </span>
        </button>
        {(e.budgetType || e.transactionType) && (
          <span
            className={`amount ${(e.budgetType || e.transactionType) === "income" ? "positive" : ""}`}
          >
            {money(e.amount)}
          </span>
        )}
        {due && (
          <span
            className={`due ${e.task && due < today && !done ? "overdue" : ""}`}
          >
            <span>{e.endsOn ? (e.task ? "Due" : "Ends") : "Starts"} </span>
            <time dateTime={due}>
              {view === "Todo"
                ? formatDate(due, true)
                : due === today
                  ? "Today"
                  : formatDate(due)}
            </time>
            {view === "Todo" && due === today && <small>Today</small>}
            {(e.endsAt || e.beginsAt) && (
              <small>{e.endsAt || e.beginsAt}</small>
            )}
          </span>
        )}
        {e.task&&<span className="task-anticipation" aria-hidden="true">{done?"\u{1F440} \u{2049}\uFE0F":"\u{1F440} \u{203C}\uFE0F"}</span>}
        <span className="entry-sweat" aria-hidden="true">
          <span>💧</span>
          <span>💧</span>
        </span>
        <button
          className="delete-button"
          aria-label={`Delete ${e.name}`}
          disabled={busy}
          onClick={() => remove(e)}
        >
          🗑️ Delete
        </button>
      </PersonalitySurface>
    );
  }
  function empty(title: string, description: string) {
    return (
      <div className="empty">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    );
  }

  return (
    <div className={`app-shell${view === "Board" && unlocked ? " board-workspace" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setView("Inbox")}>
          Brain
        </a>
        <nav aria-label="Main navigation">
          {(["Inbox", "Todo", "Calendar", "Budget", "Board", "Inventory"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              aria-current={view === v ? "page" : undefined}
              onClick={() => setView(v)}
            >
              <span className="nav-icon" aria-hidden="true">
                {icons[v]}
              </span>
              {v}
              {view === v && <span className="active-dot">●</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {session && (
            <div className="account">
              <span className="avatar">{session.name.charAt(0)}</span>
              <div>
                <strong>{session.name}</strong>
                <small title={session.email}>{session.email}</small>
              </div>

            </div>
          )}
          <button
            onClick={() => {
              setConnection(store.connection);
              setSettings(true);
            }}
          >
            <span>⚙️ Settings</span>
          </button>
          {session&&(              <button
                aria-label="Sign out"
                disabled={busy || syncing}
                onClick={() => {
                  logout(session.token);
                  setSession(null);
                  setLocalMode(false);
                  setNotice("");
                  setError("");
                }}
              >
                Sign out
              </button>)}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="today-context">
            <span>Today</span>
            <time dateTime={today}>
              {parseDate(today).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          </div>
          <div className="topbar-actions">
            <span className="status-dot" />
            {session
              ? store.dirty
                ? "Waiting to sync"
                : "Connected to Google"
              : localMode
                ? "Local workspace"
                : "Not signed in"}
            {session && (
              <button
                className="sync-button"
                onClick={() => sync()}
                disabled={busy || syncing}
              >
                {busy || syncing ? "Syncing…" : "🔄 Sync now"}
              </button>
            )}
          </div>
        </header>
        <div className="main-content">
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice&&<Toast key={notice} message={notice} onClose={()=>setNotice('')}/>}
          {!unlocked ? (
            <section className="welcome">
              <SignInCharacter />
              <h1>Sign in</h1>
              <p>Use your Google account to access shared items.</p>
              <button
                className="google-button"
                onClick={signIn}
                disabled={busy}
              >
                <b>G</b>
                {signInStage === "google"
                  ? "Waiting for Google…"
                  : signInStage === "sheet"
                    ? "Connecting to Sheet…"
                    : "Continue with Google"}
              </button>
              {signInStage && (
                <button
                  className="text-button"
                  onClick={() => signInAttempt.current?.abort()}
                >
                  Cancel sign-in
                </button>
              )}
              <small>
                Only accounts on your family’s whitelist can connect.
              </small>
              <button
                className="text-button"
                onClick={() => {
                  setConnection(store.connection);
                  setSettings(true);
                }}
              >
                Set up your connection →
              </button>
              {!store.connection.url && (
                <button
                  className="text-button muted"
                  onClick={() => setLocalMode(true)}
                >
                  Use local workspace
                </button>
              )}
            </section>
          ) : (
            <>
              <section className={view === "Board" ? "screen-reader-only" : "page-heading"}>
                <div>
                  <h1>{view}</h1>
                </div>
                {view !== "Inbox" && view !== "Board" && (
                  <>
                    <button
                      className="floating-add-entry"
                      type="button"
                      aria-label="Add item"
                      title="Add item"
                      disabled={busy}
                      onClick={() =>
                        setEditor({
                          ...blankEntry(),
                          task: view === "Todo",
                          ...(view === "Calendar"
                            ? { beginsOn: selectedDay }
                            : {}),
                        })
                      }
                    >
                      <span aria-hidden="true">{'\u{2795}'}</span>
                    </button>
                  </>
                )}
              </section>
              {localMode && (
                <div className="local-banner">
                  <span>
                    ◉ Local workspace · Your items stay in this browser until
                    you connect.
                  </span>
                  <button onClick={signIn} disabled={busy}>
                    Connect Google →
                  </button>
                </div>
              )}
              <div hidden={view !== "Inbox"}>
                <Editor
                  key={inboxEntry.id}
                  entry={inboxEntry}
                  entries={store.entries}
                  embedded
                  connection={store.connection}
                  token={session?.token}
                  save={(entry) => saveEntry(entry, "inbox")}
                  close={() => setInboxEntry(blankEntry())}
                />
              </div>
              {view !== "Inbox" && view !== "Board" && (
                <>
                  <div className="workspace-toolbar">
                    <div className="view-label">
                      <span aria-hidden="true">{icons[view]}</span>
                      <h2>
                        {view === "Todo"
                          ? "Tasks & coming up"
                          : view === "Calendar"
                            ? calendarPeriod === "All"
                              ? "All dated items"
                              : parseDate(
                                  calendarRange.from,
                                ).toLocaleDateString(undefined, {
                                  month: "long",
                                  year: "numeric",
                                })
                            : view === "Inventory" ? "All items" : "All-time overview"}
                      </h2>
                    </div>
                    <div className="filters">
                      <label className="search">
                        <span aria-hidden="true">🔎</span>
                        <input
                          aria-label="Search items"
                          placeholder="Find an item…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filter by person"
                        value={person}
                        onChange={(e) => setPerson(e.target.value)}
                      >
                        <option value="">Everyone</option>
                        {people.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              {view === "Board" && <Board entries={store.entries} boardViews={store.boardViews} onViewsChange={changeBoardViews} connection={store.connection} token={session?.token}
                onCreate={entry => {if(change([...stateRef.current.entries, entry])) setEditor(entry);}}
                onPin={(entry,item) => updateBoard(entry.id, items => [...items,item])}
                onUpdate={(entryId,itemId,patch) => updateBoard(entryId,items => items.map(item => item.id===itemId ? {...item,...patch} : item))}
                onRemoveCard={(entryId,itemId)=>updateBoard(entryId,items=>items.filter(item=>item.id!==itemId))}
                onEntryChange={(entry,patch)=>change(stateRef.current.entries.map(current=>current.id===entry.id?{...current,...patch,updatedAt:new Date().toISOString()}:current))}
                onLayout={moves=>change(stateRef.current.entries.map(entry=>({...entry,boardItems:entry.boardItems.map(item=>{const move=moves.find(move=>move.entryId===entry.id&&move.itemId===item.id);return move?{...item,...move.patch}:item}),...(moves.some(move=>move.entryId===entry.id)?{updatedAt:new Date().toISOString()}:{} )})))}
                onEdit={setEditor}/>} 
              {view === "Todo" && (
                <>
                  <div className="range-toolbar"><TimeWindowFilter label="Todo" value={todoPeriod} anchor={todoAnchor} today={today} onChange={period=>{setTodoPeriod(period);setTodoAnchor(today)}} onMove={direction=>{if(todoPeriod!=='All')setTodoAnchor(shiftPeriod(todoPeriod,todoAnchor,direction))}}/></div>
                  <div className="list-subheader">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={showDone}
                        onChange={(e) => setShowDone(e.target.checked)}
                      />{" "}
                      Show completed
                    </label>
                  </div>
                  <section className="entry-list">
                    {todoItems.some(o=>o.entry.beginsOn||o.entry.endsOn)
                      ? todoItems.filter(o=>o.entry.beginsOn||o.entry.endsOn).map((o) =>
                          row(
                            o.entry,
                            o.date,
                            o.end || o.start,
                            occurrenceHighlight(o, today),
                          ),
                        )
                      : todoItems.length ? null : empty(
                          "No matching items",
                          "No tasks or upcoming dates match this view.",
                        )}
                  </section>
                  {todoItems.some(o=>!o.entry.beginsOn&&!o.entry.endsOn)&&<section aria-label="Tasks for any time"><h3>Any time</h3><div className="entry-list">{todoItems.filter(o=>!o.entry.beginsOn&&!o.entry.endsOn).map(o=>row(o.entry))}</div></section>}
                </>
              )}
              {view === "Calendar" && (
                <>
                  <div className="range-toolbar"><TimeWindowFilter label="Calendar" value={calendarPeriod} anchor={calendarAnchor} today={today} onChange={selectCalendarPeriod} onMove={moveCalendar}/></div>
                  {calendarPeriod === "All" ? (
                    <>
                      <p className="hint calendar-all-hint">
                        All dated items. Repeating items are listed once
                        using their original dates.
                      </p>
                      <section className="entry-list">
                        {allCalendarEntries.length ? (
                          allCalendarEntries.map((e) =>
                            row(e, e.beginsOn || e.endsOn),
                          )
                        ) : (
                          <div className="quiet-empty">No dated items.</div>
                        )}
                      </section>
                    </>
                  ) : (
                    <>
                      {calendarLayout !== "Today" && (
                        <section
                          tabIndex={0}
                          aria-label="Calendar grid. Scroll horizontally to view all days on smaller screens."
                          className={`calendar ${calendarLayout === "This Week" ? "week-calendar" : ""}`}
                        >
                          <div className="weekdays">
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((d) => (
                              <span key={d}>{d}</span>
                            ))}
                          </div>
                          <div className="calendar-grid">
                            {Array.from({ length: calendarDays }, (_, i) => {
                              const day = addDays(calendarStart, i),
                                items = calendarItems.filter(
                                  (o) => o.start <= day && o.end >= day,
                                );
                              return (
                                <button
                                  key={day}
                                  aria-label={`${day}, ${items.length} items`}
                                  aria-pressed={day === selectedDay}
                                  className={`calendar-day ${day < calendarRange.from || day > calendarRange.to ? "outside" : ""} ${day === selectedDay ? "selected" : ""}`}
                                  onClick={() => setSelectedDay(day)}
                                >
                                  <span
                                    className={day === today ? "today" : ""}
                                  >
                                    {parseDate(day).getDate()}
                                  </span>
                                  {items
                                    .slice(
                                      0,
                                      calendarLayout === "This Week" ? 4 : 2,
                                    )
                                    .map((o) => (
                                      <small
                                        key={o.key}
                                        className={
                                          isDone(o.entry, o.date)
                                            ? "completed-event"
                                            : ""
                                        }
                                      >
                                        {o.entry.name}
                                      </small>
                                    ))}
                                  {items.length >
                                    (calendarLayout === "This Week"
                                      ? 4
                                      : 2) && (
                                    <em>
                                      +
                                      {items.length -
                                        (calendarLayout === "This Week"
                                          ? 4
                                          : 2)}{" "}
                                      more
                                    </em>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      )}
                      {calendarLayout === "This Week" ? (
                        <section
                          className="week-agenda"
                          aria-label="Week agenda"
                        >
                          {Array.from({ length: 7 }, (_, i) => {
                            const day = addDays(calendarRange.from, i),
                              items = calendarItems.filter(
                                (o) => o.start <= day && o.end >= day,
                              );
                            return (
                              <div
                                key={day}
                                className={`agenda-day ${day === today ? "agenda-today" : ""}`}
                              >
                                <h3 className="day-title">
                                  {parseDate(day).toLocaleDateString(
                                    undefined,
                                    {
                                      weekday: "long",
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                  {day === today && (
                                    <span className="upcoming-pill">Today</span>
                                  )}
                                  <span className="count">{items.length}</span>
                                </h3>
                                <div className="entry-list">
                                  {items.length ? (
                                    items.map((o) =>
                                      row(
                                        o.entry,
                                        o.date,
                                        o.end,
                                        occurrenceHighlight(o, today),
                                      ),
                                    )
                                  ) : (
                                    <div className="quiet-empty">
                                      Nothing planned.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </section>
                      ) : (
                        <>
                          <h3 className="day-title">
                            {parseDate(
                              calendarLayout === "Today"
                                ? calendarRange.from
                                : selectedDay,
                            ).toLocaleDateString(undefined, {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                            })}
                          </h3>
                          <section className="entry-list">
                            {calendarItems.filter(
                              (o) =>
                                o.start <=
                                  (calendarLayout === "Today"
                                    ? calendarRange.from
                                    : selectedDay) &&
                                o.end >=
                                  (calendarLayout === "Today"
                                    ? calendarRange.from
                                    : selectedDay),
                            ).length ? (
                              calendarItems
                                .filter(
                                  (o) =>
                                    o.start <=
                                      (calendarLayout === "Today"
                                        ? calendarRange.from
                                        : selectedDay) &&
                                    o.end >=
                                      (calendarLayout === "Today"
                                        ? calendarRange.from
                                        : selectedDay),
                                )
                                .map((o) =>
                                  row(
                                    o.entry,
                                    o.date,
                                    o.end,
                                    occurrenceHighlight(o, today),
                                  ),
                                )
                            ) : (
                              <div className="quiet-empty">
                                No items for this date.
                              </div>
                            )}
                          </section>
                        </>
                      )}
                    </>
                  )}
                  {filtered.some(entry=>entry.task&&!entry.beginsOn&&!entry.endsOn)&&<section aria-label="Tasks for any time"><h3>Any time</h3><div className="entry-list">{filtered.filter(entry=>entry.task&&!entry.beginsOn&&!entry.endsOn).map(entry=>row(entry))}</div></section>}
                </>
              )}
              {view === "Inventory"&&<section className="entry-list" aria-label="All items">{filtered.length?filtered.map(entry=>row(entry)):empty('No matching items','Search your items or add an item.')}</section>}
              {view === "Budget" && (
                <>
                  <div className="money-summary">
                    <div>
                      <span>Planned income</span>
                      <strong>{money(total(planned, "income", true))}</strong>
                    </div>
                    <div>
                      <span>Planned expenses</span>
                      <strong>{money(total(planned, "expense", true))}</strong>
                    </div>
                    <div>
                      <span>Actual balance</span>
                      <strong>
                        {money(
                          total(transactions, "income") -
                            total(transactions, "expense"),
                        )}
                      </strong>
                    </div>
                  </div>
                  <p className="budget-note">
                    All-time totals in USD. Each stored plan or transaction is
                    counted once; repeating dates do not create financial
                    transactions.
                  </p>
                  <h3 className="day-title">
                    The plan{" "}
                    <span className="muted">· {planned.length} items</span>
                  </h3>
                  <section className="entry-list">
                    {planned.length
                      ? planned.map((e) => (
                          <div key={e.id}>
                            {row(e)}
                            <div className="budget-progress">
                              <span>
                                Actual linked {e.budgetType}:{" "}
                                {money(
                                  transactions
                                    .filter((t) => t.budgetId === e.id)
                                    .reduce((n, t) => n + t.amount, 0),
                                )}
                              </span>
                              <span>Planned: {money(e.amount)}</span>
                            </div>
                          </div>
                        ))
                      : empty(
                          "No budget items",
                          "Add planned income and expenses, then link actual transactions.",
                        )}
                  </section>
                  <h3 className="day-title">
                    Actual transactions{" "}
                    <span className="muted">· {transactions.length} items</span>
                  </h3>
                  <section className="entry-list">
                    {transactions.length ? (
                      transactions.map((e) => row(e))
                    ) : (
                      <div className="quiet-empty">
                        Actual income and expenses will appear here.
                      </div>
                    )}
                  </section>
                </>
              )}
              <footer>
                <span>
                  {store.lastSync
                    ? `Last synced ${new Date(store.lastSync).toLocaleString()}`
                    : "Not synced yet"}
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
      <span className="screen-reader-only" role="status">
        {taskFeedback}
      </span>
      <div className="completion-effects" aria-hidden="true">
        {celebrations.map((celebration) => (
          <TaskCelebration
            key={celebration.id}
            celebration={celebration}
            onFinish={() =>
              setCelebrations((current) =>
                current.filter((c) => c.id !== celebration.id),
              )
            }
          />
        ))}
      </div>
      {editor && (
        <Editor
          entry={editor}
          connection={store.connection}
          token={session?.token}
          entries={store.entries}
          presetSections={store.entries.some(e=>e.id===editor.id)||editor.id===copyDraftId?[]:defaultSections(view)}
          onCopy={entry=>{const copy=copyEntry(entry);setCopyDraftId(copy.id);setEditor(copy)}}
          save={saveEntry}
          close={() => setEditor(null)}
        />
      )}
      {settings && (
        <Modal title="Settings" close={() => setSettings(false)}>
          <div className="settings">
            <p>
              Connect your family’s Google Sheet. Apps Script verifies your
              Google account and checks the backend whitelist on every request.
            </p>
            <label>
              Google OAuth client ID
              <input
                value={connection.clientId}
                onChange={(e) =>
                  setConnection((c) => ({
                    ...c,
                    clientId: e.target.value.trim(),
                  }))
                }
                placeholder="….apps.googleusercontent.com"
              />
            </label>
            <label>
              Apps Script web app URL
              <input
                type="url"
                value={connection.url}
                onChange={(e) =>
                  setConnection((c) => ({ ...c, url: e.target.value.trim() }))
                }
                placeholder="https://script.google.com/macros/s/…/exec"
              />
            </label>
            <p className="hint">
              See README.md for Google OAuth, whitelist, and deployment setup.
              These two configuration values are public identifiers.
            </p>
            <button
              className="primary"
              disabled={busy || syncing}
              onClick={() => {
                if (connection.url && !validEndpoint(connection.url)) {
                  setError("Use a valid Apps Script /exec deployment URL.");
                  return;
                }
                const changed = connection.url !== store.connection.url;
                if (
                  changed &&
                  store.dirty &&
                  !confirm(
                    "Changing the backend will reset the shared revision. Export unsynced local items before continuing. Continue?",
                  )
                )
                  return;
                if (
                  commit({
                    ...store,
                    connection,
                    revision: changed ? null : store.revision,
                    baseEntries: changed ? null : store.baseEntries,
                    baseBoardViews: changed ? null : store.baseBoardViews,
                  })
                ) {
                  if (session) logout(session.token);
                  setSession(null);
                  setSettings(false);
                  setNotice(
                    "Connection saved. Continue with Google to sign in.",
                  );
                }
              }}
            >
              Save connection
            </button>
            {session && (
              <button
                className="secondary"
                disabled={busy || syncing}
                onClick={() => {
                  if (
                    !store.dirty ||
                    confirm(
                      "Replace local items with the Sheet version? Export a backup first if you want to keep local changes.",
                    )
                  ) {
                    void sync(true);
                    setSettings(false);
                  }
                }}
              >
                Load Sheet version
              </button>
            )}
            {unlocked && (
              <>
                <hr />
                <h3>Your data</h3>
                <button className="secondary" onClick={exportData}>
                  📤 Export JSON backup
                </button>
                <label className="file-label">
                  📥 Import JSON backup
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={busy}
                    onChange={(e) => {
                      void importData(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </>
            )}
            {storageError && (
              <div className="error">
                <p>{storageError}</p>
                <button
                  onClick={() => {
                    const raw = localStorage.getItem("brain-family-v1");
                    const a = document.createElement("a");
                    const url = URL.createObjectURL(
                      new Blob([raw || ""], { type: "application/json" }),
                    );
                    a.href = url;
                    a.download = "brain-recovery.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download raw recovery data
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Reset the unreadable browser data? Download the recovery file first.",
                      )
                    ) {
                      localStorage.removeItem("brain-family-v1");
                      setStorageError("");
                      setStore(emptyStore);
                    }
                  }}
                >
                  Reset browser data
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
export default App;

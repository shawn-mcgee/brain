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
import {signedAmount,moneyAmountFields,trackingDraft} from './money-model';
import BudgetList from './BudgetList';
import {reorderBudgets} from './budget-order';
import {renameThoughtGroup} from './thought-groups';
import Checklist from './Checklist';
import {setTaskDone} from './checklist-model';
import {actualEntryChanges,sameValue} from './entry-changes';
import Board from './Board';
import type { BoardItem } from './board-model';
import { mergeItems, decodeBoardViews } from './board-model';
import { uploadPendingFiles } from './files';
import { login, logout } from "./auth";
import type { Session } from "./auth";
import { mergeEntries, synchronize } from "./sync";
import { taskParticles, taskTheme } from "./personality";
import TaskCelebration from "./TaskCelebration";
import type { Celebration } from "./TaskCelebration";
import SignInCharacter from "./SignInCharacter";
import Curiosity from "./Curiosity";
import AttributeInput from './AttributeInput';
import Toast from './Toast';
import PersonalitySurface from './PersonalitySurface';
import ResponsiveSidebar from './ResponsiveSidebar';
import SyncStatusButton from './SyncStatusButton';
import ThemeToggle from './ThemeToggle';
import {boardColors} from './board-model';
import {entrySearchText,defaultSections,fancyName} from './entry-attributes';
import {freshCopy,futureCopy,replaceFuture} from './repeating-copy';
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

type View = "Inbox" | "Todo" | "Calendar" | "Budget" | "Board" | "Thoughts";
const icons: Record<string, string> = {
  Thoughts: "\u{1F4AD}",
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
  className,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  actions?: ReactNode;
  entryModal?:boolean;
  className?:string;
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
      className={[entryModal?"entry-modal":"",className].filter(Boolean).join(" ")||undefined}
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

function RepeatingCopyDialog({draft,source,today,close,openDraft}:{draft:Entry;source:Entry;today:string;close:()=>void;openDraft:(entry:Entry,replace:boolean)=>void}) {
  const anchor=source.beginsOn||source.endsOn;
  const minimum=anchor?addDays(anchor,1):today;
  const maximum=source.repeatUntil||'2200-12-31';
  const canReplace=!!source.repeat&&!!anchor&&minimum<=maximum;
  const [mode,setMode]=useState<'separate'|'future'>('separate');
  const [from,setFrom]=useState(()=>{const preferred=minimum>today?minimum:today;return preferred>maximum?maximum:preferred;});
  const [error,setError]=useState('');
  return <Modal title="Copy repeating thought" className="completion-dialog copy-dialog" close={close}>
    <form onSubmit={event=>{
      event.preventDefault();
      try {openDraft(mode==='future'?futureCopy(draft,source,from):freshCopy(draft),mode==='future');}
      catch(cause){setError(message(cause));}
    }}>
      <div className="completion-body">
        <strong className="copy-item-name">{draft.name}</strong>
        <label className={`copy-choice${mode==='separate'?' is-selected':''}`}>
          <input type="radio" name="copy-mode" value="separate" checked={mode==='separate'} onChange={()=>{setMode('separate');setError('');}}/>
          <span><strong>Make a separate copy</strong><small>Keep the original schedule and start a new, unchecked copy.</small></span>
        </label>
        <label className={`copy-choice${mode==='future'?' is-selected':''}`}>
          <input type="radio" name="copy-mode" value="future" disabled={!canReplace} checked={mode==='future'} onChange={()=>{setMode('future');setError('');}}/>
          <span><strong>Change future occurrences</strong><small>{canReplace?'Keep the earlier occurrences and edit a replacement from a date.':'This series has no later dates to replace.'}</small></span>
        </label>
        {mode==='future'&&<div className="copy-date">
          <label>Replacement starts<input type="date" required min={minimum} max={maximum} value={from} onChange={event=>{setFrom(event.target.value);setError('');}}/></label>
          {from&&<p>The original will repeat through {formatDate(addDays(from,-1))}. Its earlier history stays with it.</p>}
        </div>}
        <p className="completion-description">Nothing changes until you save the new draft.</p>
        {error&&<p className="error" role="alert">{error}</p>}
      </div>
      <div className="completion-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button type="submit" className="primary">Open draft</button></div>
    </form>
  </Modal>;
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
  initialAmount,
  replacingFuture=false,
}: {
  entry: Entry;
  entries: Entry[];
  save: (e: Entry) => string | void;
  close: () => void;
  embedded?: boolean;
  connection: Connection;
  token?: string;
  presetSections?:Section[];
  onCopy?:(entry:Entry)=>void;
  initialAmount?:string;
  replacingFuture?:boolean;
}) {
  const formId=useId();
  const [namePlaceholder]=useState(fancyName);
  const [draft, setDraft] = useState(()=>presetSections.reduce((draft,section)=>initializeEntrySection(draft,section),entry)),
    [error, setError] = useState("");
  const [filesBusy,setFilesBusy]=useState(false);
  const [sections, setSections] = useState<Section[]>(() =>
    [...new Set([...initialEntrySections(entry),...presetSections])],
  );
  const [isRange,setIsRange]=useState(!!entry.beginsOn&&!!entry.endsOn&&(entry.beginsOn!==entry.endsOn||entry.beginsAt!==entry.endsAt));
  const [amountText,setAmountText]=useState(()=>initialAmount??(entry.amount||entries.some(saved=>saved.id===entry.id)?String(signedAmount(entry)):''));
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
    if(section==='when')setIsRange(false);
    if(section==='money')setAmountText('');
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
  const editorTheme = draft.color ? `thought-editor-colored board-${draft.color}` : '';
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
        ? "Choose a thought type for Money, or remove the Money section."
        : validateEntry(cleaned, entries);
    if (issue) {
      setError(issue);
      Object.values(sectionRefs.current).forEach((section) => {
        if (section) section.open = true;
      });
    } else {const issue=save(cleaned);if(issue)setError(issue);}
  }
  const fields = {
    list: <Checklist entry={draft} entries={entries} editable onChange={setDraft}/>,
    attachments: <Attachments itemName={draft.name} note={draft.note} value={draft.attachments} entryId={draft.id} connection={connection} token={token} onChange={attachments=>update({attachments})} onBusyChange={setFilesBusy}/>,
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
    color: <div className="item-color-options" role="group" aria-label="Thought color"><button type="button" className="item-color-automatic" aria-pressed={!draft.color} onClick={()=>update({color:''})}>Automatic</button>{boardColors.map(color=><button key={color} type="button" className={`item-color-swatch board-${color}`} aria-label={color} title={color} aria-pressed={draft.color===color} onClick={()=>update({color})}>{draft.color===color&&<span aria-hidden="true">✓</span>}</button>)}</div>,
    task: null,
    when: (
      <div className="when-control">
        <label className="range-switch">
          <span className="range-switch-copy">
            <span>Date range</span>
            <small>{isRange ? 'Choose when it starts and ends.' : 'One date, with an optional time.'}</small>
          </span>
          <input
            className="screen-reader-only"
            type="checkbox"
            role="switch"
            aria-label="Date range"
            checked={isRange}
            onChange={event => {
              setIsRange(event.target.checked);
              update({endsOn: draft.beginsOn, endsAt: draft.beginsAt});
            }}
          />
          <span className="range-switch-track" aria-hidden="true" />
        </label>
        <div className="when-dates">
          <div className="when-endpoint">
            <label>
              {isRange ? 'Start date' : 'Date'}
              <input type="date" required min="1900-01-01" max="2200-12-31" value={draft.beginsOn}
                onChange={event => update({beginsOn: event.target.value, ...(!isRange ? {endsOn: event.target.value} : {})})} />
            </label>
            <label>
              <span className="field-label">{isRange ? 'Start time' : 'Time'} <span className="field-optional">Optional</span></span>
              <input type="time" value={draft.beginsAt}
                onChange={event => update({beginsAt: event.target.value, ...(!isRange ? {endsAt: event.target.value} : {})})} />
            </label>
          </div>
          {isRange && <div className="when-endpoint when-endpoint-end">
            <label>
              {draft.task ? 'Due date' : 'End date'}
              <input type="date" required min={draft.beginsOn || '1900-01-01'} max="2200-12-31" value={draft.endsOn}
                onChange={event => update({endsOn: event.target.value})} />
            </label>
            <label>
              <span className="field-label">{draft.task ? 'Due time' : 'End time'} <span className="field-optional">Optional</span></span>
              <input type="time" value={draft.endsAt} onChange={event => update({endsAt: event.target.value})} />
            </label>
          </div>}
        </div>
      </div>
    ),
    repeat: (
      <>
        <label>
          <span className="screen-reader-only">Repeats</span>
          <select
            value={draft.repeat}
            onChange={(e) =>
              update({ repeat: e.target.value as Entry["repeat"],...(!e.target.value?{repeatUntil:""}:{}) })
            }
          >
            <option value="">Does not repeat</option>
            {intervals.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label>Until<select disabled={!draft.repeat} value={draft.repeatUntil?'date':'forever'} onChange={event=>update({repeatUntil:event.target.value==='date'?draft.beginsOn||dateKey(new Date()):''})}><option value="forever">Forever</option><option value="date">Specific date</option></select></label>
        {draft.repeatUntil&&<label>Last repeat date<input required type="date" min={draft.beginsOn||'1900-01-01'} max="2200-12-31" value={draft.repeatUntil} onChange={event=>update({repeatUntil:event.target.value})}/></label>}
      </>
    ),
    requires: (
      <>
        <p className="hint">
          Select any thoughts this thought is waiting on. Tasks must be done first; other thoughts act as reference
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
          <p className="muted">Add another thought to wait on.</p>
        )}
      </>
    ),
    money: (
      <>
        <div className="money-control">
          <div className="money-mode" role="group" aria-label="Money mode">
            {(['Planned', 'Tracked'] as const).map(mode => {
              const selected = mode === 'Planned' ? !!draft.budgetType : !!draft.transactionType;
              return <button key={mode} type="button" aria-pressed={selected} onClick={() => {
                if (selected) return;
                const type = draft.budgetType || draft.transactionType || 'income';
                update({budgetType: mode === 'Planned' ? type : '', transactionType: mode === 'Tracked' ? type : '', budgetId: ''});
              }}>
                <span aria-hidden="true">{mode === 'Planned' ? '◷' : '✓'}</span> {mode}
              </button>;
            })}
          </div>
          <p className="money-mode-description">{draft.budgetType ? 'An amount you expect to earn or spend.' : 'Money you have received or spent.'}</p>
          <div className="money-amount-card">
            <div className="money-amount-heading">
              <label htmlFor={`${formId}-amount`}>Amount</label>
              <span className={`money-direction ${(draft.budgetType || draft.transactionType) === 'expense' ? 'is-expense' : 'is-income'}`} role="status">
                <span aria-hidden="true">{(draft.budgetType || draft.transactionType) === 'expense' ? '↗' : '↙'}</span>
                {(draft.budgetType || draft.transactionType) === 'expense' ? 'Expense' : 'Income'}
              </span>
            </div>
            <div className="money-amount-input">
              <span aria-hidden="true">$</span>
              <input id={`${formId}-amount`} aria-label="Amount in US dollars" aria-describedby={`${formId}-amount-hint`} type="number" required step="0.01"
                placeholder={(draft.budgetType || draft.transactionType) === 'expense' ? '-0.00' : '0.00'} value={amountText}
                onChange={event => {
                  const value = event.target.value;
                  setAmountText(value);
                  update(value === '' ? {amount: 0} : moneyAmountFields(draft, Number(value)));
                }} />
              <span className="money-currency">USD</span>
            </div>
            <p id={`${formId}-amount-hint`} className="money-amount-hint"><span>+ income</span><span>− expense</span></p>
          </div>
        </div>
        {draft.transactionType && (
          <label>
            Link to a budget thought
            <select
              value={draft.budgetId}
              onChange={event => {
                const budgetId = event.target.value;
                const plan = entries.find(item => item.id === budgetId && item.budgetType);
                update({budgetId, ...(plan ? {transactionType: plan.budgetType} : {})});
                if (plan && amountText !== '') {
                  setAmountText(String(draft.amount * (plan.budgetType === 'expense' ? -1 : 1)));
                }
              }}
            >
              <option value="">One-off transaction</option>
              {entries
                .filter(
                  (e) =>
                    e.id !== draft.id && !!e.budgetType,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.budgetType === 'income' ? 'Income' : 'Expense'}
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
      {replacingFuture&&<p className="replacement-notice">{draft.beginsOn?`Saving starts this replacement on ${formatDate(draft.beginsOn)} and ends the original on ${formatDate(addDays(draft.beginsOn,-1))}.`:'Choose a When date for the replacement.'} Cancel leaves the original unchanged.</p>}
      <label className="entry-name">Name<small className="attribute-description">A name for this thought. Names can be shared by different thoughts.</small><input autoFocus required maxLength={10000} value={draft.name} placeholder={namePlaceholder} onChange={event=>update({name:event.target.value})}/></label>
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
    <section className={`inbox-form ${editorTheme}`} aria-label="New thought">
      {form}
    </section>
  ) : (
    <Modal
      title={
        entries.some((e) => e.id === entry.id) ? "Edit thought" : "New thought"
      }
      close={close}
      entryModal
      className={editorTheme}
    >
      {form}
    </Modal>
  );
}

function App() {
  const [trackingAmount,setTrackingAmount]=useState<{id:string;value:string}|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<Entry|null>(null);
  const [completedTarget,setCompletedTarget]=useState<Entry|null>(null);

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
  const [copyChoice,setCopyChoice]=useState<{draft:Entry;source:Entry}|null>(null);
  const [futureReplacement,setFutureReplacement]=useState<{draftId:string;source:Entry}|null>(null);
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
    const current=stateRef.current;
    entries=actualEntryChanges(current.entries,entries);
    if(entries===current.entries)return true;
    const saved=commit({ ...current, entries, dirty: true });
    if(saved){
      const completed=entries.find(entry=>{const before=current.entries.find(old=>old.id===entry.id);return entry.task&&before&&(!entry.repeat?!before.completed&&entry.completed:!!entry.budgetType&&entry.completedDates.some(date=>!before.completedDates.includes(date)));});
      if(completed&&(!completed.repeat||completed.budgetType))setCompletedTarget(completed);
    }
    return saved;
  }
  function updateBoard(entryId: string, update: (items: BoardItem[]) => BoardItem[]) {
    change(stateRef.current.entries.map(entry => entry.id === entryId ? {...entry, boardItems: update(entry.boardItems), updatedAt: new Date().toISOString()} : entry));
  }
  function changeBoardViews(boardViews:BoardItem[]) {
    if(sameValue(stateRef.current.boardViews,boardViews))return true;
    try { decodeBoardViews(boardViews); return commit({...stateRef.current,boardViews,dirty:true}); }
    catch(error) { setError(message(error)); return false; }
  }
  function renameGroup(source:string,name:string) {
    const current=stateRef.current;
    const next=renameThoughtGroup(current.entries,current.boardViews,source,name);
    if(next.entries===current.entries&&next.boardViews===current.boardViews)return;
    commit({...current,...next,dirty:true});
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
          "Concurrent versions were preserved as separate thoughts during automatic merge.",
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
            "Changes merged automatically. Concurrent versions were preserved as separate thoughts; dependency cycles were removed if needed.",
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
  function beginCopy(draft:Entry) {
    const source=stateRef.current.entries.find(entry=>entry.id===draft.id);
    if(draft.repeat&&source){setCopyChoice({draft,source});return;}
    const copy=freshCopy(draft);
    setFutureReplacement(null);setCopyDraftId(copy.id);setEditor(copy);
  }
  function saveEntry(entry: Entry, source: "popup" | "inbox" = "popup") {
    const current = stateRef.current.entries;
    if(source==='popup'&&futureReplacement?.draftId===entry.id){
      try {
        const next=replaceFuture(current,futureReplacement.source,entry);
        if(!change(next))return 'The replacement could not be saved. Your original schedule has been kept.';
        setEditor(null);setFutureReplacement(null);setError('');
        setNotice('Future occurrences updated. Earlier history was kept with the original.');
      } catch(cause){return message(cause);}
      return;
    }
    // Preserve remote changes received while this editor was open.
    const base =
      source === "popup" && editor?.name.trim() && current.some(saved=>saved.id===entry.id)
        ? [...current.filter((e) => e.id !== entry.id), editor]
        : current;
    const merged = mergeEntries(
      base,
      [...current.filter((e) => e.id !== entry.id), entry],
      current,
    );
    const changes=actualEntryChanges(current,merged.entries);
    if(changes===current){if(source==='popup')setEditor(null);setError('');return;}
    if (change(changes)) {
      if (source === "inbox") setInboxEntry(blankEntry());
      else setEditor(null);
      setNotice(
        merged.conflicts
          ? "Concurrent versions were preserved as separate thoughts."
          : session
            ? "Thought saved. Syncing automatically…"
            : "Thought saved on this device.",
      );
      setError("");
    }
  }
  function trackBudget(entry:Entry,includeAmount=false) {
    const draft=trackingDraft(entry,includeAmount);
    setCopyDraftId(draft.id);
    setTrackingAmount({id:draft.id,value:includeAmount?String(signedAmount(draft)):''});
    setEditor(draft);
  }
  function remove(entry:Entry){setDeleteTarget(entry);}
  function removeConfirmed(entry:Entry) {
    change(
      stateRef.current.entries
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
    const updated = setTaskDone(entry,!done,date);
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
          money: taskTheme(entry) === "money",
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
          `Merge ${incoming.length} thoughts into this device? Imported thoughts replace existing thoughts with the same ID. Sync will upload the result.`,
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
    if(e.repeat&&!date)date=e.beginsOn||e.endsOn||undefined;
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
        className={`entry-row ${e.color?`item-colored board-${e.color}`:''} ${done ? "done" : ""} ${celebrations.some((c) => c.entryId === e.id && c.date === date) ? "celebrating" : ""}`}
        key={`${e.id}:${date || ""}`}
      >
        <span className="entry-leading">
        {e.task ? (
          <button
            className={`task-check ${done ? "checked" : ""}`}
            aria-label={`${done ? "Reopen" : "Complete"} ${e.name}`}
            aria-pressed={done}
            disabled={busy}
            onClick={(event) => toggle(e, date, event.currentTarget)}
          >
            {done ? (e.budgetType || e.transactionType ? "💰" : "✅") : ""}
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
        </span>
        <div className="entry-main">
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
            {e.repeat && <span>🔁 {e.repeat}{e.repeatUntil&&` until ${formatDate(e.repeatUntil)}`}</span>}
            {e.attachments.length>0&&<span>📎 {e.attachments.length} files</span>}
            {e.requires.length > 0 && (
              <span>🔗 Waiting on {e.requires.length}</span>
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
        {e.list.length>0&&<Checklist entry={e} entries={store.entries} date={date} disabled={busy} onChange={updated=>change(store.entries.map(item=>item.id===updated.id?updated:item))}/>}
        </div>
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
        {e.budgetType&&<button type="button" className="secondary budget-track-button" disabled={busy} onClick={()=>trackBudget(e)}>Track {e.budgetType}</button>}
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
      <div className="app-utilities" role="group" aria-label="App status and appearance">
        <SyncStatusButton state={session?busy||syncing?'is-syncing':store.dirty?syncFailures>0?'is-error':'is-pending':'is-connected':'is-offline'} status={session?busy||syncing?'Syncing…':store.dirty?syncFailures>0?'Sync failed · retrying':'Waiting to sync':'Connected to Google':localMode?'Local workspace':'Not signed in'}/>
        <ThemeToggle />
      </div>
      <ResponsiveSidebar mobileHeader={<>
        <div className="mobile-header-context"><span className="mobile-current-tab">{view}</span><span aria-hidden="true">·</span><time className="mobile-today" dateTime={today} title={parseDate(today).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'})}>{parseDate(today).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</time></div>

      </>}>
        <a className="brand" href="#" onClick={() => setView("Inbox")}>
          brain
        </a>
        <nav aria-label="Main navigation">
          {(["Inbox", "Todo", "Calendar", "Budget", "Board", "Thoughts"] as const).map((v) => (
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
      </ResponsiveSidebar>
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
              <p>Use your Google account to access shared thoughts.</p>
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
                      aria-label="Add thought"
                      title="Add thought"
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
                    ◉ Local workspace · Your thoughts stay in this browser until
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
                              ? "All dated thoughts"
                              : parseDate(
                                  calendarRange.from,
                                ).toLocaleDateString(undefined, {
                                  month: "long",
                                  year: "numeric",
                                })
                            : view === "Thoughts" ? "All thoughts" : "All-time overview"}
                      </h2>
                    </div>
                    <div className="filters">
                      <label className="search">
                        <span aria-hidden="true">🔎</span>
                        <input
                          aria-label="Search thoughts"
                          placeholder="Find a thought…"
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
              {view === "Board" && <Board entries={store.entries} boardViews={store.boardViews} onViewsChange={changeBoardViews} onRenameGroup={renameGroup} connection={store.connection} token={session?.token}
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
                          "No matching thoughts",
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
                        All dated thoughts. Repeating thoughts are listed once
                        using their original dates.
                      </p>
                      <section className="entry-list">
                        {allCalendarEntries.length ? (
                          allCalendarEntries.map((e) =>
                            row(e, e.beginsOn || e.endsOn),
                          )
                        ) : (
                          <div className="quiet-empty">No dated thoughts.</div>
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
                                  aria-label={`${day}, ${items.length} thoughts`}
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
                                        className={`${o.entry.color?`item-colored board-${o.entry.color}`:''} ${
                                          isDone(o.entry, o.date)
                                            ? "completed-event"
                                            : ""
                                        }`}
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
                                No thoughts for this date.
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
              {view === "Thoughts"&&<section className="entry-list" aria-label="All thoughts">{filtered.length?filtered.map(entry=>row(entry)):empty('No matching thoughts','Search your thoughts or add a thought.')}</section>}
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
                    Budget{" "}
                    <span className="muted">· {planned.length} thoughts</span>
                  </h3>
                  <section>
                    {planned.length
                      ? <BudgetList entries={planned} transactions={transactions} row={row} onMove={move=>change(reorderBudgets(stateRef.current.entries,move))} onRenameGroup={renameGroup}/>
                      : empty(
                          "No budget thoughts",
                          "Add planned income and expenses, then link actual transactions.",
                        )}
                  </section>
                  <h3 className="day-title">
                    Transactions{" "}
                    <span className="muted">· {transactions.length} thoughts</span>
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
          key={editor.id}
          entry={editor}
          initialAmount={trackingAmount?.id===editor.id?trackingAmount.value:undefined}
          connection={store.connection}
          token={session?.token}
          entries={store.entries}
          presetSections={editor.boardItems.some(item=>item.showList)?['note','list']:store.entries.some(e=>e.id===editor.id)||editor.id===copyDraftId?[]:defaultSections(view)}
          onCopy={beginCopy}
          replacingFuture={futureReplacement?.draftId===editor.id}
          save={saveEntry}
          close={() => {setEditor(null);setFutureReplacement(null);}}
        />
      )}
      {copyChoice&&<RepeatingCopyDialog draft={copyChoice.draft} source={copyChoice.source} today={today} close={()=>setCopyChoice(null)} openDraft={(entry,replace)=>{
        setFutureReplacement(replace?{draftId:entry.id,source:copyChoice.source}:null);
        setCopyDraftId(entry.id);setEditor(entry);setCopyChoice(null);
      }}/>}
      {deleteTarget && <Modal title="Delete thought?" className="completion-dialog deletion-dialog" close={() => setDeleteTarget(null)}>
        <div className="completion-body">
          <div className="completion-task">
            <span className="completion-check deletion-check" aria-hidden="true">🗑️</span>
            <strong>{deleteTarget.name}</strong>
          </div>
          <p className="completion-description">This thought and links to it will be removed. This cannot be undone.</p>
        </div>
        <div className="completion-actions">
          <button type="button" className="completion-delete" onClick={() => {
            removeConfirmed(deleteTarget);
            setDeleteTarget(null);
          }}>Delete thought</button>
          <button type="button" autoFocus className="primary" onClick={() => setDeleteTarget(null)}>Cancel</button>
        </div>
      </Modal>}
      {completedTarget && <Modal title="Task completed" className="completion-dialog" close={() => setCompletedTarget(null)}>
        <div className="completion-body">
          <div className="completion-task">
            <span className="completion-check" aria-hidden="true">✓</span>
            <strong>{completedTarget.name}</strong>
          </div>
          <p className="completion-description">{completedTarget.repeat
            ? 'This occurrence is complete.'
            : completedTarget.budgetType ? 'This budget task is complete.' : 'Keep it in your completed tasks, or delete it.'}</p>
          {completedTarget.budgetType && <div className="completion-tracking">
            <div>
              <strong>Track this {completedTarget.budgetType}?</strong>
              <p>Create a linked transaction with the planned amount. Review it before saving.</p>
            </div>
          </div>}
        </div>
        <div className="completion-actions">
          {!completedTarget.repeat && <button type="button" className="completion-delete" onClick={() => {
            removeConfirmed(completedTarget);
            setCompletedTarget(null);
          }}>Delete task</button>}
          <button type="button" autoFocus className={completedTarget.budgetType ? 'secondary' : 'primary'} onClick={() => setCompletedTarget(null)}>{completedTarget.budgetType ? 'Ignore transaction' : 'Keep task'}</button>
          {completedTarget.budgetType && <button type="button" className={`primary budget-track-button${completedTarget.color?` item-colored board-${completedTarget.color}`:''}`} onClick={() => {
            trackBudget(completedTarget, true);
            setCompletedTarget(null);
          }}>Track {completedTarget.budgetType}</button>}
        </div>
      </Modal>}
      {settings && (
        <Modal title="Settings" close={() => setSettings(false)}>
          <div className="settings">
            <section className="settings-sync" aria-label="Synchronization">
              <h3>Sync</h3>
              <p className="hint">{store.lastSync
                ? `Last synced ${new Date(store.lastSync).toLocaleString()}`
                : "Not synced yet"}</p>
              {session && <>
              <p className="hint" role="status">{busy || syncing ? 'Syncing…' : store.dirty ? 'Local changes are waiting to sync.' : 'Connected to Google. Changes sync automatically.'}</p>
              <button type="button" className="secondary" disabled={busy || syncing} onClick={() => sync()}>
                {busy || syncing ? 'Syncing…' : '🔄 Sync now'}
              </button>
              {error && <p className="error" role="alert">{error}</p>}
              </>}
            </section>

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
                    "Changing the backend will reset the shared revision. Export unsynced local thoughts before continuing. Continue?",
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
                      "Replace local thoughts with the Sheet version? Export a backup first if you want to keep local changes.",
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

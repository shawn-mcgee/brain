import { decodeEntries } from "./domain";
import type { Entry } from "./domain";
import { SyncConflict } from "./sync";
import { BackendBusy, retryBusy } from "./request-retry";
import { decodeBoardViews } from './board-model';
import type { BoardItem } from './board-model';
export type Connection = { url: string; clientId: string };
export type Store = {
  entries: Entry[];
  baseEntries: Entry[] | null;
  boardViews: BoardItem[];
  baseBoardViews: BoardItem[] | null;
  revision: number | null;
  dirty: boolean;
  connection: Connection;
  lastSync: string;
};
export const emptyStore: Store = {
  entries: [],
  baseEntries: null,
  boardViews: [],
  baseBoardViews: null,
  revision: null,
  dirty: false,
  connection: {
    url: import.meta.env.VITE_APPS_SCRIPT_URL || "",
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  },
  lastSync: "",
};
const KEY = "brain-family-v1";
export function loadStore(): Store {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyStore;
  const parsed = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed.dirty !== "boolean" ||
    !(
      parsed.revision === null ||
      (Number.isInteger(parsed.revision) && parsed.revision >= 0)
    ) ||
    typeof parsed.lastSync !== "string"
  )
    throw new Error("Invalid saved workspace.");
  return {
    ...emptyStore,
    ...parsed,
    connection: {
      url:
        typeof parsed.connection?.url === "string"
          ? parsed.connection.url.trim() || emptyStore.connection.url
          : emptyStore.connection.url,
      clientId:
        typeof parsed.connection?.clientId === "string"
          ? parsed.connection.clientId.trim() || emptyStore.connection.clientId
          : emptyStore.connection.clientId,
    },
    entries: decodeEntries(parsed.entries),
    boardViews: decodeBoardViews(parsed.boardViews ?? []),
    baseBoardViews: parsed.baseBoardViews ? decodeBoardViews(parsed.baseBoardViews) : parsed.dirty ? null : decodeBoardViews(parsed.boardViews ?? []),
    baseEntries: parsed.baseEntries
      ? decodeEntries(parsed.baseEntries)
      : parsed.dirty
        ? null
        : decodeEntries(parsed.entries),
  };
}
export function saveStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}
export function validEndpoint(url: string) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url);
}
export async function request(
  connection: Connection,
  token: string,
  action: "read" | "write",
  revision?: number,
  entries?: Entry[],
  signal?: AbortSignal,
  boardViews?: BoardItem[],
): Promise<{
  entries: Entry[];
  boardViews: BoardItem[];
  revision: number;
  user: { name: string; email: string };
}> {
  if (!validEndpoint(connection.url))
    throw new Error("Use the Apps Script deployment URL ending in /exec.");
  const deadline = AbortSignal.timeout(60000);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  return retryBusy(async () => {
    const response = await fetch(connection.url, {
      method: "POST",
      redirect: "follow",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, revision, entries, boardViews, apiVersion:4 }),
      signal: AbortSignal.any([requestSignal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok)
      throw new Error(
        `Google returned ${response.status}. Check the deployment access settings.`,
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Google did not return JSON. Deploy as a web app accessible to Anyone, then use its /exec URL.",
      );
    }
    if (!data.ok) {
      if (
        data.code === "BUSY" ||
        /another sync is in progress/i.test(data.error || "")
      )
        throw new BackendBusy(data.error);
      if (
        data.code === "CONFLICT" ||
        /Sheet changed in another browser/.test(data.error || "")
      )
        throw new SyncConflict(data.error);
      throw new Error(data.error || "Sync failed.");
    }
    if (data.apiVersion !== 4) throw new Error('Update the Apps Script deployment to the latest board version in Code.gs, then try again.');
    if (!Number.isInteger(data.revision) || data.revision < 0)
      throw new Error("Invalid sync revision.");
    if (
      !data.user ||
      typeof data.user.name !== "string" ||
      typeof data.user.email !== "string"
    )
      throw new Error("The backend did not return a verified user.");
    return {
      entries: decodeEntries(data.entries),
      boardViews: decodeBoardViews(data.boardViews ?? []),
      revision: data.revision,
      user: data.user,
    };
  }, requestSignal);
}
export async function fileRequest(connection: Connection, token: string, action: 'file.get' | 'file.put', payload: Record<string,unknown>): Promise<{dataUrl?:string}> {
  if (!validEndpoint(connection.url)) throw new Error('Configure the Apps Script URL first.');
  const signal=AbortSignal.timeout(60000);
  return retryBusy(async()=>{
    const response=await fetch(connection.url,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token,...payload}),signal});
    if(!response.ok)throw new Error(`File request failed (${response.status}).`);
    let data;try{data=await response.json();}catch{throw new Error('The file backend did not return JSON. Check the GAS deployment.');}
    if(!data.ok){if(data.code==='BUSY'||/another sync is in progress/i.test(data.error||''))throw new BackendBusy(data.error);throw new Error(data.error||'File request failed.');}
    if(data.apiVersion!==2)throw new Error('Update the Apps Script deployment to enable attachments.');
    return data;
  },signal);
}

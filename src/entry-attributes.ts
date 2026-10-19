import type {Entry} from './domain.ts';
import type {EntrySection} from './entry-sections.ts';
export function entrySearchText(entry:Entry) {return [entry.name,entry.note,...entry.who,entry.where,entry.group,...entry.tags,entry.color,entry.beginsOn,entry.endsOn,entry.budgetType,entry.transactionType].join(' ').toLowerCase();}
export function copyEntry(entry:Entry):Entry {const now=new Date().toISOString();return {...structuredClone(entry),id:crypto.randomUUID(),name:`Copy of ${entry.name}`.slice(0,10000),boardItems:[],createdAt:now,updatedAt:now};}
export function defaultSections(view:string):EntrySection[] {return view==='Budget'?['money']:view==='Todo'?['note','task','ends']:view==='Calendar'?['note','begins','where']:[];}
export function fancyName(random:()=>number=Math.random) {
  const beginnings=['The Beckoning','The Smoke','The Time','The Shadow','The Secret','The Promise','The Whisper','The Journey','The Return','The Garden','The Dream','The Portrait','The Song','The Tale','The Voyage','The Light','The Last Letter','The Midnight Watch','The Lost Chapter','The Echo'];
  const endings=['of the Beast','of Deceit','until Dawn','of the Ancient Mariner','of a Summer Night','beyond the Looking Glass','of the Scarlet Letter','beneath the Raven','of the Secret Garden','of Great Expectations','across the Wine-Dark Sea','of the Wandering Knight','of a Winter Tale','of the Hidden Treasure','under the Northern Stars','of the Distant Shore','of the Silent Library','at the Edge of the World','of the Forgotten Kingdom','of the Unfinished Story'];
  return `${beginnings[Math.floor(random()*beginnings.length)]} ${endings[Math.floor(random()*endings.length)]}…`;
}

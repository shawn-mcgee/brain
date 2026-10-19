import type {Entry} from './domain.ts';
import type {EntrySection} from './entry-sections.ts';
export function entrySearchText(entry:Entry) {return [entry.name,entry.note,...entry.list.map(line=>line.text),...entry.who,entry.where,entry.group,...entry.tags,entry.color,entry.beginsOn,entry.endsOn,entry.budgetType,entry.transactionType].join(' ').toLowerCase();}
export function copyEntry(entry:Entry):Entry {const now=new Date().toISOString();return {...structuredClone(entry),id:crypto.randomUUID(),name:`Copy of ${entry.name}`.slice(0,10000),boardItems:[],createdAt:now,updatedAt:now};}
export function defaultSections(view:string):EntrySection[] {return view==='Budget'?['money']:view==='Todo'?['note','task','ends']:view==='Calendar'?['note','begins','where']:[];}
export const mediaPlaceholderReferences = {
  Labyrinth: {
    beginnings:["The Goblin King's Errand","Ludo's Invitation","Hoggle's Shortcut","The Labyrinth Runner"],
    endings:['beyond the Goblin City','at the Goblin Ball','through the Oubliette','above the Bog of Eternal Stench'],
  },
  'Over the Garden Wall': {
    beginnings:["The Woodsman's Lantern",'The Rock Fact','The Pottsfield Harvest','The Map of the Unknown'],
    endings:['with Wirt and Greg','aboard the Frog Ferry','beneath the Edelwood Trees','on the Road to Pottsfield'],
  },
  'Back to the Future': {
    beginnings:['The Flux Capacitor','The Clock Tower Appointment','The Hoverboard Delivery','The DeLorean Detour'],
    endings:['at Eighty-Eight Miles per Hour','in Hill Valley','behind Twin Pines Mall','before the Clock Strikes Ten'],
  },
  'Age of Empires': {
    beginnings:['The Idle Villager','The Wandering Monk','The Town Center To-Do List','The Missing Sheep'],
    endings:['before the Castle Age','beneath the Trebuchet','beside the New Wonder','after One More Farm'],
  },
  StarCraft: {
    beginnings:['The Additional Pylon','The Vespene Delivery','The Siege Tank Picnic','The Unexpected Zerg Rush'],
    endings:['somewhere in the Koprulu Sector','on the Way to Aiur','beneath the Skies of Mar Sara','before the Creep Spreads'],
  },
  'Fantastic Mr. Fox': {
    beginnings:['The Bandit Hat','The Apple Cider Heist','The Whack-Bat Match',"Mr. Fox's Master Plan"],
    endings:['under Boggis, Bunce, and Bean','beside the Electric Fence','after the Wolf Sighting','inside the Supermarket'],
  },
  'The Grand Budapest Hotel': {
    beginnings:["The Lobby Boy's Errand",'The Concierge Conspiracy',"The Mendl's Pastry Delivery",'The Society of the Crossed Keys'],
    endings:['at the Grand Budapest','aboard the Zubrowka Express','with Monsieur Gustave','beneath the Alpine Funicular'],
  },
  'The Phoenician Scheme': {
    beginnings:["Korda's Ledger","The Tycoon's Inheritance","Sister Liesl's Journey","Bjorn's Lesson"],
    endings:['of the Phoenician Scheme',"under Korda's Signature",'with Tutor Bjorn','before the Next Business Deal'],
  },
  'Hocus Pocus': {
    beginnings:['The Black Flame Candle',"The Sanderson Sisters' Shopping List","Billy Butcherson's Errand","Thackery Binx's Midnight Watch"],
    endings:['before Sunrise in Salem','inside the Sanderson Cottage','beside the Spellbook','after Three Hundred Years'],
  },
} as const;
export function fancyName(random:()=>number=Math.random) {
  const beginnings=['The Beckoning','The Smoke','The Time','The Shadow','The Secret','The Promise','The Whisper','The Journey','The Return','The Garden','The Dream','The Portrait','The Song','The Tale','The Voyage','The Light','The Last Letter','The Midnight Watch','The Lost Chapter','The Echo'];
  const endings=['of the Beast','of Deceit','until Dawn','of the Ancient Mariner','of a Summer Night','beyond the Looking Glass','of the Scarlet Letter','beneath the Raven','of the Secret Garden','of Great Expectations','across the Wine-Dark Sea','of the Wandering Knight','of a Winter Tale','of the Hidden Treasure','under the Northern Stars','of the Distant Shore','of the Silent Library','at the Edge of the World','of the Forgotten Kingdom','of the Unfinished Story'];
  beginnings.push(
    'The Lantern','The Map','The Clockwork Heart','The Silver Key','The Borrowed Hour',
    'The Velvet Curtain','The Paper Moon','The Unlikely Hero','The Invisible Guest','The Autumn Crown',
    'The Glass Mountain','The Golden Compass','The Blue Notebook','The Wandering Star','The Sleeping Giant',
    'The Little Thunderstorm','The Accidental Adventure','The Curious Case','The Hidden Door','The Broken Spell',
    'The Extraordinary Tuesday','The Missing Teacup','The Patient Fox','The Restless Ocean','The Quiet Rebellion',
    'The Lighthouse Keeper','The Moonlit Staircase','The Emerald City','The Forgotten Melody','The Painted Sky',
    'The Feathered Messenger','The Midnight Picnic','The Clockmaker','The Runaway Comet','The Secret Society',
    'The Impossible Invitation','The Grand Expedition','The Traveling Circus','The Dusty Atlas','The Dragon’s Diary',
    'The Unopened Envelope','The Crooked Tower','The Starlit Orchard','The Winter Carnival','The Philosopher’s Cat',
    'The Remarkable Umbrella','The Clockwork Sparrow','The Queen’s Errand','The Unexpected Visitor','The Stolen Sunrise',
    'The Library Ghost','The Orchard Gate','The Ninth Bell','The Smallest Miracle','The Last Cup of Tea',
    'The Dandelion King','The Astronomer’s Apprentice','The Pocket-Sized Universe','The Velvet Rabbit','The Nameless Island',
  );
  endings.push(
    'beneath a Paper Sky','at the End of the Lane','of the Moonlit Market','between the Pages','before the First Snow',
    'of a Thousand Small Wonders','in the Attic','beyond the Blue Horizon','of the Clockwork City','beside the Sleeping River',
    'of the Seventh Season','under a Borrowed Moon','at the Midnight Station','of the Amber Forest','across the Rooftops',
    'of the Disappearing Village','among the Wildflowers','behind the Velvet Curtain','of the Last Lighthouse','inside the Music Box',
    'at the Bottom of the Garden','of the Unwritten Book','beyond the Orchard Wall','of a Very Peculiar Tuesday','under the Kitchen Table',
    'of the Wandering Clouds','between Two Sunrises','of the Indigo Mountains','at the Fox’s Wedding','through the Secret Passage',
    'of the Marshmallow Kingdom','in the Company of Cats','beside the Old Canal','of the Sleeping Volcano','beyond the Ninth Gate',
    'of the Impossible Machine','under the Apple Tree','of the Absent-Minded Wizard','on the Last Train Home','of the Stardust Collector',
    'in the House of Clocks','of the Wildwood','across the Frozen Lake','of the Paper Dragon','after the Carnival',
    'of the Sunken Palace','at the Sparrow’s Feast','of the Endless Afternoon','in the Land of Lost Socks','of the Unfinished Symphony',
    'beneath the Copper Moon','of the Quiet Constellation','on the Other Side of Sunday','of the River’s Daughter','at the Door of Tomorrow',
    'among the Fireflies','of the Velvet Winter','beyond the Last Streetlight','of the Rain-Soaked City','before the Kettle Boils',
  );
  for(const references of Object.values(mediaPlaceholderReferences)){
    beginnings.push(...references.beginnings);
    endings.push(...references.endings);
  }
  return `${beginnings[Math.floor(random()*beginnings.length)]} ${endings[Math.floor(random()*endings.length)]}…`;
}

import type {Entry} from './domain';
import {initialEntrySections,sectionEmoji,sectionNames} from './entry-sections';

export default function ThoughtAttributeTags({entry}:{entry:Entry}) {
  const sections=initialEntrySections(entry).filter(section=>section!=='attachments'||entry.attachments.length>0);
  if(!sections.length)return null;
  const counts:Partial<Record<typeof sections[number],number>>={list:entry.list.length,links:entry.links.length,attachments:entry.attachments.length,who:entry.who.length,tags:entry.tags.length,requires:entry.requires.length};
  return <span className="thought-attribute-tags" role="group" aria-label="Attached attributes">
    {sections.map(section=><span className="thought-attribute-tag" key={section}><span aria-hidden="true">{sectionEmoji[section]}</span> {sectionNames[section]}{counts[section]?` · ${counts[section]}`:''}</span>)}
  </span>;
}

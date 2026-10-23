import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHttpLink,validateLinks,youtubeEmbedUrl} from '../src/links-model.ts';
import {blankEntry,decodeEntries,validateEntry} from '../src/domain.ts';
import {availableEntrySections,initialEntrySections,removeEntrySection,sectionOrder} from '../src/entry-sections.ts';
import {copyEntry,entrySearchText} from '../src/entry-attributes.ts';
import {mergeEntries} from '../src/sync.ts';

test('Links follows Files, restores from saved thoughts, and can be removed independently',()=>{
  assert.equal(sectionOrder[sectionOrder.indexOf('attachments')+1],'links');
  assert.ok(availableEntrySections([]).includes('links'));
  const entry={...blankEntry(),name:'Reference',links:['https://example.com/docs']};
  assert.deepEqual(initialEntrySections(entry),['links']);
  assert.deepEqual(removeEntrySection(entry,['links'],'links').entry.links,[]);
  assert.deepEqual(entry.links,['https://example.com/docs']);
  assert.ok(entrySearchText(entry).includes('https://example.com/docs'));
  const copy=copyEntry(entry);copy.links.push('https://example.com/other');
  assert.equal(entry.links.length,1);
});

test('links migrate from old data and survive JSON import and export',()=>{
  const entry={...blankEntry(),name:'Reference'};delete entry.links;
  assert.deepEqual(decodeEntries([entry])[0].links,[]);
  const linked={...entry,links:['https://example.com/a?x=1&y=2','https://youtu.be/M7lc1UVf-VE']};
  assert.deepEqual(decodeEntries(JSON.parse(JSON.stringify([linked]))),[linked]);
});

test('links accept web URLs and reject unsafe or oversized input',()=>{
  for(const url of ['https://example.com','http://localhost:5173/path','https://example.com/?q=test#section','https://[::1]/'])assert.equal(isHttpLink(url),true,url);
  for(const value of ['javascript:alert(1)','data:text/html,test','file:///tmp/test','//example.com','https://user@example.com','https://example.com\\@evil.test','https://example.com/a b',42,null]){
    assert.equal(isHttpLink(value),false,String(value));
    assert.ok(validateLinks([value]));
  }
  for(const links of [{},'https://example.com',Array(21).fill('https://example.com'),['https://example.com/'+ 'a'.repeat(2000)]])assert.ok(validateLinks(links));
  const invalid={...blankEntry(),name:'Bad link',links:['javascript:alert(1)']};
  assert.match(validateEntry(invalid,[invalid]),/HTTP or HTTPS/);
  assert.throws(()=>decodeEntries([invalid]),/HTTP or HTTPS/);
});

test('YouTube video formats embed on a fixed trusted host and preserve timestamps',()=>{
  const id='M7lc1UVf-VE',embed=`https://www.youtube-nocookie.com/embed/${id}`;
  for(const url of [`https://www.youtube.com/watch?v=${id}&list=playlist`,`https://youtu.be/${id}?si=share`,`https://m.youtube.com/watch?v=${id}`,`https://youtube.com/shorts/${id}`,`https://youtube.com/live/${id}`,embed])assert.equal(youtubeEmbedUrl(url),embed);
  assert.equal(youtubeEmbedUrl(`https://youtu.be/${id}?t=1h2m3s`),embed+'?start=3723');
  assert.equal(youtubeEmbedUrl(`https://youtube.com/watch?v=${id}#t=90`),embed+'?start=90');
  assert.equal(youtubeEmbedUrl(embed+'?start=45&autoplay=1'),embed+'?start=45');
  for(const url of [`https://youtube.com.evil.test/watch?v=${id}`,`https://evil.test/?v=${id}`,`https://youtube.com@evil.test/watch?v=${id}`,`https://youtube.com:1234/watch?v=${id}`,'https://youtube.com/watch?v=bad','https://youtube.com/playlist?list=PL123','https://youtu.be/bad/extra','not a URL'])assert.equal(youtubeEmbedUrl(url),null,url);
});

test('sync combines concurrent link additions and respects removal of an existing link',()=>{
  const base={...blankEntry(),name:'Reference',links:['https://example.com/original']};
  const local={...base,links:['https://example.com/local']};
  const remote={...base,links:[...base.links,'https://example.com/remote']};
  const result=mergeEntries([base],[local],[remote]);
  assert.equal(result.conflicts,0);
  assert.deepEqual(result.entries[0].links,['https://example.com/local','https://example.com/remote']);
});

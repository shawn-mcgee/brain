import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blankEntry,todoSections} from '../src/domain.ts';

const today='2026-10-23';
const task=(id,date,patch={})=>({...blankEntry(),id,name:id,task:true,beginsOn:date,endsOn:date,...patch});

test('unfinished older tasks appear in Past Due regardless of the selected time window',()=>{
  const entries=[task('old','2026-09-01'),task('yesterday','2026-10-22'),task('today',today),task('tomorrow','2026-10-24'),task('any','')];
  for(const period of ['Today','This Week','This Month','All']){
    const groups=todoSections(entries,today,period);
    assert.deepEqual(groups.pastDue.map(o=>o.entry.id),['old','yesterday']);
    assert.equal(groups.scheduled.some(o=>['old','yesterday'].includes(o.entry.id)),false);
    assert.deepEqual(groups.anyTime.map(o=>o.entry.id),['any']);
  }
  assert.deepEqual(todoSections(entries,today,'Today',false,'2026-11-01').pastDue.map(o=>o.entry.id),['old','yesterday']);
});

test('Past Due excludes completed tasks, events, transactions, and ranges that have not ended',()=>{
  const groups=todoSections([
    task('done','2026-10-22',{completed:true}),task('event','2026-10-22',{task:false}),
    task('transaction','2026-10-22',{transactionType:'expense'}),
    task('ongoing','2026-10-01',{endsOn:today}),task('past-range','2026-10-01',{endsOn:'2026-10-22'}),
  ],today,'This Month',true);
  assert.deepEqual(groups.pastDue.map(o=>o.entry.id),['past-range']);
  assert.ok(groups.scheduled.some(o=>o.entry.id==='done'));
  assert.ok(groups.scheduled.some(o=>o.entry.id==='ongoing'));
});

test('repeating tasks include every overdue unchecked occurrence, including ended series',()=>{
  const entry=task('daily','2026-10-19',{repeat:'Daily',repeatUntil:'2026-10-22',completedDates:['2026-10-20']});
  const groups=todoSections([entry],today,'Today');
  assert.deepEqual(groups.pastDue.map(o=>o.date),['2026-10-19','2026-10-21','2026-10-22']);
  assert.equal(new Set(groups.pastDue.map(o=>o.key)).size,3);
  assert.deepEqual(groups.scheduled,[]);
  const completed={...entry,completedDates:[...entry.completedDates,'2026-10-19']};
  assert.deepEqual(todoSections([completed],today,'Today').pastDue.map(o=>o.date),['2026-10-21','2026-10-22']);
});

test('repeating task ranges become overdue only after their end date',()=>{
  const entry=task('range','2026-10-19',{endsOn:'2026-10-21',repeat:'Daily'});
  const groups=todoSections([entry],today,'Today');
  assert.deepEqual(groups.pastDue.map(o=>o.date),['2026-10-19','2026-10-20']);
  assert.ok(groups.scheduled.every(o=>o.end>=today));
});

test('Past Due preserves dependency order and never reintroduces filtered-out thoughts',()=>{
  const first=task('prerequisite','2026-10-22'),second=task('dependent','2026-10-01',{requires:[first.id]});
  assert.deepEqual(todoSections([second,first],today,'Today').pastDue.map(o=>o.entry.id),['prerequisite','dependent']);
  assert.deepEqual(todoSections([second],today,'Today').pastDue.map(o=>o.entry.id),['dependent']);
});

test('Soon excludes past non-task calendar occurrences while retaining current and ongoing events',()=>{
  const entries=[
    task('past-event','2026-10-22',{task:false}),
    task('ended-range','2026-10-01',{task:false,endsOn:'2026-10-22'}),
    task('today-event',today,{task:false}),
    task('future-event','2026-10-24',{task:false}),
    task('ongoing-event','2026-10-01',{task:false,endsOn:'2026-10-24'}),
    task('daily-event','2026-10-20',{task:false,repeat:'Daily'}),
    task('completed-task','2026-10-22',{completed:true}),
  ];
  const groups=todoSections(entries,today,'This Month',true);
  assert.equal(groups.scheduled.some(o=>['past-event','ended-range'].includes(o.entry.id)),false);
  for(const id of ['today-event','future-event','ongoing-event','completed-task'])assert.ok(groups.scheduled.some(o=>o.entry.id===id));
  assert.ok(groups.scheduled.filter(o=>o.entry.id==='daily-event').every(o=>o.end>=today));
  assert.ok(todoSections(entries,today,'Today',true,'2026-10-22').scheduled.filter(o=>!o.entry.task).every(o=>o.end>=today));
});

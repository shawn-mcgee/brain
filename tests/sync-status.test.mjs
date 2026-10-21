import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncStatus} from '../src/sync-status.ts';

const base={signedIn:true,localMode:false,syncing:false,signInStage:null,dirty:false,failures:0,storageProblem:false};
test('sync status follows edits, upload, subsequent edits, and acknowledgement',()=>{
  assert.deepEqual(syncStatus({...base,dirty:true}),{state:'is-pending',status:'Saved on this device · waiting to sync'});
  assert.deepEqual(syncStatus({...base,dirty:true,syncing:true}),{state:'is-syncing',status:'Saving changes to Google…'});
  assert.equal(syncStatus({...base,dirty:true}).state,'is-pending');
  assert.deepEqual(syncStatus(base),{state:'is-connected',status:'All changes saved to Google'});
});
test('reads, failed refreshes, and failed writes have different accurate statuses',()=>{
  assert.equal(syncStatus({...base,syncing:true}).status,'Checking for updates…');
  assert.deepEqual(syncStatus({...base,failures:1}),{state:'is-error',status:'Could not check for updates · will retry'});
  assert.equal(syncStatus({...base,dirty:true,failures:1}).status,'Saved on this device · sync failed, retrying');
  assert.equal(syncStatus({...base,syncing:true,failures:1}).state,'is-syncing');
});
test('local work, sign-in, and storage failures never claim a successful cloud save',()=>{
  assert.equal(syncStatus({...base,signedIn:false,localMode:true,dirty:true}).status,'Saved on this device · sign in to sync');
  assert.equal(syncStatus({...base,signedIn:false}).status,'Not signed in');
  assert.equal(syncStatus({...base,signedIn:false,signInStage:'google'}).status,'Waiting for Google sign-in…');
  assert.equal(syncStatus({...base,signedIn:false,signInStage:'sheet'}).status,'Connecting to Google Sheets…');
  assert.equal(syncStatus({...base,storageProblem:true}).state,'is-error');
});

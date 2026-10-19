import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkSyncProtocol,SYNC_API_VERSION} from '../src/backend-protocol.ts';
test('old calendar-only backend errors explain the deployment mismatch and preserve local changes',()=>{
  assert.throws(()=>checkSyncProtocol({ok:false,error:'Invalid calendar views.'}),error=>/Deploy the current.*Code.gs/.test(error.message)&&/local changes have been kept/.test(error.message));
  assert.throws(()=>checkSyncProtocol({ok:true,apiVersion:5}),/Deploy/);
  assert.throws(()=>checkSyncProtocol({ok:false,code:'UPGRADE_REQUIRED'}),/reload/i);
});
test('current group-capable replies and normal retryable errors retain their usual handling',()=>{
  assert.doesNotThrow(()=>checkSyncProtocol({ok:true,apiVersion:SYNC_API_VERSION}));
  assert.doesNotThrow(()=>checkSyncProtocol({ok:false,code:'BUSY',error:'Another sync is in progress.'}));
  assert.doesNotThrow(()=>checkSyncProtocol({ok:false,code:'CONFLICT'}));
  assert.doesNotThrow(()=>checkSyncProtocol({ok:false,error:'Invalid board views: expected calendar or group.'}));
});

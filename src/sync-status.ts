type SyncStatusInput={signedIn:boolean;localMode:boolean;syncing:boolean;signInStage:'google'|'sheet'|null;dirty:boolean;failures:number;storageProblem:boolean};
export function syncStatus(input:SyncStatusInput):{state:string;status:string} {
  if(input.storageProblem)return {state:'is-error',status:'Changes could not be saved on this device'};
  if(input.signInStage)return {state:'is-syncing',status:input.signInStage==='google'?'Waiting for Google sign-in…':'Connecting to Google Sheets…'};
  if(!input.signedIn)return {state:'is-offline',status:input.localMode?input.dirty?'Saved on this device · sign in to sync':'Local workspace · sync is off':'Not signed in'};
  if(input.syncing)return {state:'is-syncing',status:input.dirty?'Saving changes to Google…':'Checking for updates…'};
  if(input.failures)return {state:'is-error',status:input.dirty?'Saved on this device · sync failed, retrying':'Could not check for updates · will retry'};
  if(input.dirty)return {state:'is-pending',status:'Saved on this device · waiting to sync'};
  return {state:'is-connected',status:'All changes saved to Google'};
}

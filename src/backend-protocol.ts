export const SYNC_API_VERSION=6;
const upgradeMessage='The app and deployed Apps Script versions do not match. Deploy the current apps-script/Code.gs as a new web-app version, then reload this app. Your local changes have been kept.';
export function checkSyncProtocol(response:{ok?:boolean;apiVersion?:number;code?:string;error?:string}):void {
  // Older deployments called every BoardViews item a calendar, rejecting groups.
  // Detect this before presenting a misleading data-validation error to the user.
  if(response.ok&&response.apiVersion!==SYNC_API_VERSION || response.code==='UPGRADE_REQUIRED' || !response.ok&&/^Invalid calendar views\.?$/i.test(response.error||''))throw new Error(upgradeMessage);
}

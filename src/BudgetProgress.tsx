import type {Entry} from './domain';
import {budgetProgress} from './money-model';

const money=(amount:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);

export default function BudgetProgress({plan,transactions}:{plan:Entry;transactions:Entry[]}) {
  const {tracked,opposing,percent,fill,exceeded}=budgetProgress(plan,transactions);
  const percentage=percent===null?'':`${new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(percent)}%`;
  const warnings=[opposing>0?`${money(opposing)} tracked in the opposite direction`:'',exceeded?`${money(tracked-plan.amount)} over planned amount`:''].filter(Boolean);
  const description=`${money(tracked)} tracked of ${money(plan.amount)} planned${percentage?`, ${percentage}`:''}${warnings.length?`. ${warnings.join('. ')}`:''}`;
  return <div className={`budget-progress${opposing>0?' is-reversed':''}${exceeded?' is-exceeded':''}`}>
    <div className="budget-progress-caption">
      <span>{money(tracked)} <span className="muted">/ {money(plan.amount)} tracked</span></span>
      <span className="budget-progress-status">
        {opposing>0&&<span className="budget-progress-warning" role="img" aria-label={warnings[0]} title={warnings[0]}>↶</span>}
        {exceeded&&<span className="budget-progress-warning" role="img" aria-label={`${money(tracked-plan.amount)} over planned amount`} title={`${money(tracked-plan.amount)} over planned amount`}>⚠</span>}
        {percentage&&<span>{percentage}</span>}
      </span>
    </div>
    <div className="budget-progress-track" role="progressbar" aria-label={`Tracking for ${plan.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill} aria-valuetext={description} title={description}>
      <span className="budget-progress-fill" style={{width:`${fill}%`}}/>
    </div>
  </div>;
}

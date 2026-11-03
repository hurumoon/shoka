// 実額と、Standard API単価によるテキスト使用量の推計を区別する。
export function usageCost(u) {
  const value = Number(u?.costUSD) || 0;
  const amount = value > 0 && value < 0.01 ? '$' + value.toFixed(4) : '$' + value.toFixed(2);
  const label = u?.costEstimated ? 'API換算（推計）' : 'API換算';
  if (u?.costKnown === false) return value > 0 ? `${label} ${amount}（取得分のみ・未取得あり）` : '料金換算は未取得';
  return `${label} ${amount}`;
}

export const USAGE_COST_NOTE = '推計はStandard単価によるテキストtoken分の目安です（速度・長文割増、画像・外部ツール料金は含みません）。';

export function productionCostHtml(n) {
  const cost = n.productionCost;
  const label = cost?.count ? usageCost(cost) : '料金換算は未取得（記録なし）';
  return `<p class="production-cost">制作費用（目安）：<b>${label}</b><br><small class="muted">この作品にひもづく使用量の累計です（改稿・相談など、未公開分も含む）。記録のない作業は含みません。${USAGE_COST_NOTE}</small></p>`;
}

// 상점 기본 품목은 판매가의 2배, 별도 정가 품목은 게임에 기록된 정가를 사용한다.
export function defaultEnhancementMaterialPrice(gameData, code) {
  const sellPrice = gameData?.sell_price?.[code];
  // 다이아 상자는 기본 매입/판매 목록이 아니라 구매 목록에 정가로 별도 추가된다.
  if (code?.startsWith("dia_box_")) return gameData?.item_values?.[code] ?? sellPrice ?? 0;
  if ((gameData?.shop_items || []).includes(code) && Number.isFinite(sellPrice)) return sellPrice * 2;
  return gameData?.item_values?.[code] ?? sellPrice ?? 0;
}

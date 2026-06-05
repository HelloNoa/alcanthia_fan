// exp -> level (게임 공식: ra(i)=2^floor(i/5) 만큼 누적 차감)
export function expToLevel(exp) {
  let i = 1, s = Number(exp) || 0;
  while (s > 0) {
    const need = 2 ** Math.floor(i / 5);
    if (s < need) break;
    s -= need;
    i++;
  }
  return i;
}

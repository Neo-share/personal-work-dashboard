/** 周报默认周期：上周五 00:00 至本周四 23:59:59（本地时区） */
export function getReportWeekRange(referenceDate?: Date): { start: string; end: string } {
  const ref = referenceDate ?? new Date();
  const day = ref.getDay();
  const end = new Date(ref);

  if (day >= 1 && day <= 4) {
    // 周一至周四：本周四为周期结束日
    end.setDate(ref.getDate() + (4 - day));
  } else {
    // 周五至周日：已过去的最近周四为周期结束日
    const daysSinceThursday = (day - 4 + 7) % 7;
    end.setDate(ref.getDate() - daysSinceThursday);
  }
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return { start: start.toISOString(), end: end.toISOString() };
}

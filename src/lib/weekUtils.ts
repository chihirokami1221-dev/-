export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  return result;
}

export function getWeekLabel(date: Date): string {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const format = (value: Date) => `${value.getMonth() + 1}/${value.getDate()}`;
  return `${format(start)}〜${format(end)}`;
}

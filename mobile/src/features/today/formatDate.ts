// Date courte du bandeau : « LUN, 5 OCT » (libellés fournis par l'i18n)
export function formatShortDate(date: Date, daysShort: string[], monthsShort: string[]): string {
  return `${daysShort[date.getDay()]}, ${date.getDate()} ${monthsShort[date.getMonth()]}`.toUpperCase();
}

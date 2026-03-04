export const HOURS_12 = Array.from({ length: 12 }, (_, i) => String((i + 1))).map((v) => ({ value: v.padStart(2, '0'), label: v }));
export const MINUTES_COMMON = ['00', '15', '30', '45'].map((m) => ({ value: m, label: m }));
export const MERIDIEMS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' }
];

export function to24hTime(hour12, minute, meridiem) {
  const h = parseInt(hour12, 10);
  const m = parseInt(minute, 10) || 0;
  const mer = String(meridiem || 'AM').toUpperCase();
  let h24 = h % 12;
  if (mer === 'PM') h24 += 12;
  const hh = String(h24).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function from24hTime(time) {
  if (!time) return { hour: '12', minute: '00', meridiem: 'AM' };
  const [hhStr, mmStr] = String(time).split(':');
  let hh = parseInt(hhStr, 10);
  const mm = (mmStr || '00').slice(0, 2);
  const meridiem = hh >= 12 ? 'PM' : 'AM';
  if (hh === 0) hh = 12; else if (hh > 12) hh -= 12;
  const hour = String(hh).padStart(2, '0');
  return { hour, minute: mm, meridiem };
}

export function compareTimes24(startHHMM, endHHMM) {
  const [sh, sm] = startHHMM.split(':').map((x) => parseInt(x, 10));
  const [eh, em] = endHHMM.split(':').map((x) => parseInt(x, 10));
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return e - s; // positive if end after start, 0 if equal, negative if before
}

/**
 * Scrolls a row that scrolls sideways (on phones) so an item is in view,
 * centred, without moving the page. `edge` is how much of each end is
 * faded out, and so does not count as in view.
 */
export function scrollIntoRow(
  row: HTMLElement,
  item: HTMLElement,
  edge = 0,
): void {
  if (row.scrollWidth <= row.clientWidth) return;
  const r = row.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  if (i.left >= r.left + edge && i.right <= r.right - edge) return;
  const left = i.left - r.left + row.scrollLeft;
  row.scrollLeft = left - (row.clientWidth - i.width) / 2;
}

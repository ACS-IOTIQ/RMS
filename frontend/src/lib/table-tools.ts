export type SortDir = 'asc' | 'desc';

export function readPath(row: any, path: string) {
  return path.split('.').reduce((value, key) => value?.[key], row);
}

export function valueText(value: any) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).toLowerCase();
}

export function compareRows(a: any, b: any, key: string, dir: SortDir = 'asc') {
  const left = readPath(a, key);
  const right = readPath(b, key);
  const leftNum = Number(left);
  const rightNum = Number(right);
  const bothNumeric = left !== '' && right !== '' && Number.isFinite(leftNum) && Number.isFinite(rightNum);
  const result = bothNumeric
    ? leftNum - rightNum
    : valueText(left).localeCompare(valueText(right), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? result : -result;
}

export function sortRows<T>(rows: T[], key: string, dir: SortDir = 'asc') {
  return [...rows].sort((a, b) => compareRows(a, b, key, dir));
}

export function filterByQuery<T>(rows: T[], query: string, paths: string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => paths.some((path) => valueText(readPath(row, path)).includes(needle)));
}

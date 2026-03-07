/**
 * Reusable table skeleton loading rows.
 * Usage:
 *   {loading ? <TableSkeleton cols={6} rows={5} /> : <tbody>...real rows...</tbody>}
 */
export default function TableSkeleton({
  cols = 5,
  rows = 6,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-border">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="px-4 py-3">
              <div
                className="h-4 rounded-md bg-muted animate-pulse"
                style={{ width: `${55 + ((rowIdx * 3 + colIdx * 7) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

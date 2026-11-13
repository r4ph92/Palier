// The header row of a data table, one column header per label.
export function ColumnHeads({ labels }: { readonly labels: readonly string[] }) {
  return (
    <thead>
      <tr>
        {labels.map((label) => (
          <th key={label} scope="col">
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

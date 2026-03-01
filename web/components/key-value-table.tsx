interface Props {
  data: Record<string, unknown> | null;
}

export function KeyValueTable({ data }: Props) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-muted-foreground">No output data.</p>;
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-2 text-left font-medium">Key</th>
            <th className="px-4 py-2 text-left font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key} className="border-b last:border-0">
              <td className="px-4 py-2 font-mono text-xs">{key}</td>
              <td className="px-4 py-2 font-mono text-xs">
                {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

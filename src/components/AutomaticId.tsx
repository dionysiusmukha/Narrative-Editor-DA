export function AutomaticId({ value }: { value: string }) {
  return <span className="automatic-id"><small>ID · автоматически</small><code>{value}</code></span>;
}

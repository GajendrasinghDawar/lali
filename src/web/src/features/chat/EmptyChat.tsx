const suggestions = ["Plan my day", "Summarize what matters", "Help me think through a decision"];

export function EmptyChat({ onSelect }: { onSelect: (text: string) => void }) {
  return <section className="mx-auto w-full max-w-3xl px-3 pb-12 pt-[max(4vh,2rem)]"><h1 className="text-3xl font-bold tracking-tight text-slate12 sm:text-4xl">What can I help with?</h1><p className="mt-2 text-sm text-slate10">Choose a prompt or write your own message below.</p><div className="mt-7 grid gap-3 sm:grid-cols-2 md:grid-cols-3">{suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => onSelect(suggestion)} className="rounded-md border border-slate4 bg-slate3 px-4 py-3 text-left text-sm font-medium text-slate11 transition-colors hover:border-slate6 hover:text-slate12 focus-visible:ring-2 focus-visible:ring-amber8">{suggestion}</button>)}</div></section>;
}

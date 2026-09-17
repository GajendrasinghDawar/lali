export function UserMessage({ content }: { content: string }) {
  return <article className="flex w-full justify-end" data-role="user"><div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-slate5 bg-slate4 px-4 py-2.5 text-sm leading-relaxed text-slate12 shadow-1 sm:max-w-[80%]">{content}</div></article>;
}

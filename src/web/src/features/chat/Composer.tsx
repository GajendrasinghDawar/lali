import { useEffect, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Paperclip, Send, Square, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";

export type StagedFile = { file: File; id?: string; error?: string; uploading: boolean };

type ComposerProps = {
  draft: string;
  setDraft: (value: string) => void;
  stagedFiles: StagedFile[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (file: File) => void;
  onSubmit: (event: FormEvent) => void;
  onStop: () => void;
  isStreaming: boolean;
};

export function Composer({ draft, setDraft, stagedFiles, fileInputRef, onFiles, onRemoveFile, onSubmit, onStop, isStreaming }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploading = stagedFiles.some(file => file.uploading);
  const hasUploadError = stagedFiles.some(file => file.error);
  const canSend = (draft.trim().length > 0 || stagedFiles.some(file => file.id)) && !uploading && !hasUploadError && !isStreaming;
  useEffect(() => { const textarea = textareaRef.current; if (textarea) { textarea.style.height = "0px"; textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; } }, [draft]);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } };

  return <div className="w-full bg-linear-to-t from-slate2 via-slate2 to-transparent px-4 pb-2.5 pt-2 md:px-2 lg:px-0"><form onSubmit={onSubmit} className="mx-auto w-full md:max-w-2xl lg:max-w-3xl"><div className="relative rounded-md border border-slate7/40 bg-slate3 shadow-2 backdrop-blur-[2px] transition-all duration-200 focus-within:border-slate6 focus-within:shadow-3 after:pointer-events-none after:absolute after:inset-[3px] after:rounded-[10px] after:border after:border-dashed after:border-slate6/30"><div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-md bg-radial-[at_12%_0%] from-whiteA3 via-whiteA1 to-transparent" /><div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-slate6 to-transparent" />{stagedFiles.length > 0 && <div className="relative z-10 flex flex-wrap gap-2 px-4 pt-4">{stagedFiles.map(file => <div key={`${file.file.name}-${file.file.lastModified}`} className={`flex max-w-52 items-center gap-2 rounded-md border bg-slate4 px-2 py-1 text-xs ${file.error ? "border-red8 text-red11" : "border-slate6 text-slate11"}`}><span className="truncate">{file.file.name}</span><span>{file.uploading ? "Uploading" : file.error ?? ""}</span><button type="button" onClick={() => onRemoveFile(file.file)} aria-label={`Remove ${file.file.name}`}><X size={13} /></button></div>)}</div>}<div className="relative z-10 px-4 pb-2 pt-4"><Textarea ref={textareaRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="Message Lali..." rows={1} className="max-h-[120px] min-h-6 overflow-y-auto" aria-label="Message" /></div><div className="relative z-10 flex items-center justify-between px-4 pb-3 pt-1"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-slate10"><span className={`size-1.5 rounded-full ${isStreaming || uploading ? "animate-pulse bg-jade9" : "bg-slate8"}`} />{uploading ? "Uploading" : isStreaming ? "Generating response" : "Ready"}</div><div className="flex gap-2"><Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} aria-label="Attach file"><Paperclip size={15} /></Button><input ref={fileInputRef} className="hidden" type="file" multiple onChange={onFiles} />{isStreaming ? <Button size="icon" variant="secondary" onClick={onStop} aria-label="Stop generation"><Square size={12} className="text-crimson11" /></Button> : <Button size="icon" variant="secondary" type="submit" disabled={!canSend} aria-label="Send message"><Send size={14} /></Button>}</div></div></div></form></div>;
}

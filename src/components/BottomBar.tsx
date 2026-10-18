// The primary actions, in the thumb zone: get a Photo, undo a tap, skip the Card, start over.
import * as React from "react"
import { Camera, ImageIcon, Undo2, RotateCcw, ScanLine } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  onFile: (file: File) => void
  onUndo: () => void
  onNoCard: () => void
  onRestart: () => void
  canUndo: boolean
  hasPhoto: boolean
  noCard: boolean
}

function BarButton({
  icon: Icon,
  label,
  primary,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.ComponentType<{ className?: string }>
  label: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-xs font-medium",
        "disabled:opacity-40",
        primary ? "bg-primary text-primary-foreground" : "text-foreground active:bg-muted",
        className,
      )}
      {...props}
    >
      <Icon className="size-5" />
      {label}
    </button>
  )
}

export function BottomBar({ onFile, onUndo, onNoCard, onRestart, canUndo, hasPhoto, noCard }: Props) {
  const takeRef = React.useRef<HTMLInputElement>(null)
  const chooseRef = React.useRef<HTMLInputElement>(null)
  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    e.target.value = "" // so choosing the same file again still fires
  }
  return (
    <div className="flex gap-1 border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Take opens the camera directly; Choose opens the library. */}
      <input ref={takeRef} type="file" accept="image/*" capture="environment" hidden onChange={picked} data-testid="take-input" />
      <input ref={chooseRef} type="file" accept="image/*" hidden onChange={picked} data-testid="choose-input" />
      <BarButton icon={Camera} label="Take Photo" primary onClick={() => takeRef.current?.click()} />
      <BarButton icon={ImageIcon} label="Choose" onClick={() => chooseRef.current?.click()} />
      <BarButton icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
      <BarButton icon={ScanLine} label="No Card" onClick={onNoCard} disabled={!hasPhoto || noCard} />
      <BarButton icon={RotateCcw} label="Start over" onClick={onRestart} disabled={!hasPhoto} />
    </div>
  )
}

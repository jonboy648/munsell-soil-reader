import { Button } from "@/components/ui/button"

/** Asks "Delete this?" in the page, in place of the button that started it. */
export function Confirm({
  verb,
  what,
  onYes,
  onNo,
}: {
  verb: "Delete" | "Remove"
  what: string
  onYes: () => void
  onNo: () => void
}) {
  const lower = verb.toLowerCase()
  return (
    <div
      role="group"
      aria-label={`Confirm: ${lower} ${what}`}
      className="grid gap-2 rounded-md border-2 border-foreground p-3"
    >
      <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
        {verb} {what}? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 text-base" onClick={onNo}>
          Keep
        </Button>
        <Button className="h-11 flex-1 text-base" onClick={onYes}>
          Yes, {lower}
        </Button>
      </div>
    </div>
  )
}

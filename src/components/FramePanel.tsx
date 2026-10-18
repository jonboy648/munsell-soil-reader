// The frame as the Card: the batch code from the frame, then the outline the app found, which
// the user confirms (or moves a corner of) before any Spot is read.
import { Button } from "@/components/ui/button"
import type { FrameSession } from "@/lib/session"

interface Props {
  frame: FrameSession
  onBatchCode: (code: string) => void
  onConfirm: () => void
}

const NOT_FOUND =
  "No frame found in this Photo. All four corner markers need to be in view, uncovered and in focus, with the frame turned no more than about 45 degrees from facing the camera. Take the Photo again, or choose another Card."
const FAILED = "The frame finder did not load. Check your connection, reload the page and try again."

function BatchField({ frame, onBatchCode }: Pick<Props, "frame" | "onBatchCode">) {
  const { batch } = frame
  return (
    <div className="grid gap-1.5">
      <label htmlFor="batch-code" className="text-sm font-semibold">
        Frame batch code
      </label>
      <input
        id="batch-code"
        data-testid="batch-code"
        type="text"
        value={batch.code}
        onChange={(e) => onBatchCode(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="Printed on the frame"
        className="min-h-11 rounded-lg border border-input bg-card px-3 font-mono text-base uppercase"
      />
      <p className="text-sm text-muted-foreground" data-testid="batch-status" data-state={batch.state} role="status">
        {batch.state === "none" && "Type the batch code printed on the frame. Its patch colors are measured once per batch."}
        {batch.state === "loading" && "Looking up the batch."}
        {batch.state === "ready" && (
          <>
            <b className="font-semibold text-foreground">Batch {batch.batch.code} is measured.</b> Its{" "}
            {batch.batch.patches.length} patch colors are known.
          </>
        )}
        {batch.state === "refused" && <b className="font-semibold text-foreground">{batch.message}</b>}
      </p>
    </div>
  )
}

export function FramePanel({ frame, onBatchCode, onConfirm }: Props) {
  const status = !frame.searched
    ? "Looking for the frame in the Photo."
    : frame.outline === null
      ? frame.failed
        ? FAILED
        : NOT_FOUND
      : frame.confirmed
        ? "Frame outline confirmed. Its 18 patches and the window are outlined on the Photo."
        : "Found the frame. Its outline is drawn on the Photo, with the corners numbered. If a corner is off, press it and drag it onto the outer corner of its marker, then lift."
  return (
    <div className="grid gap-3">
      <BatchField frame={frame} onBatchCode={onBatchCode} />
      <div className="grid gap-2">
        <p className="text-base" data-testid="frame-status" data-state={!frame.searched ? "looking" : frame.outline ? (frame.confirmed ? "confirmed" : "found") : "missing"} role="status">
          {status}
        </p>
        {frame.outline && !frame.confirmed && (
          <Button type="button" onClick={onConfirm} data-testid="confirm-outline" className="min-h-12">
            Confirm outline
          </Button>
        )}
      </div>
    </div>
  )
}

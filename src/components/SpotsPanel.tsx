// The Spots: what to tap on the soil, and how many are down.
interface Props {
  spotCount: number
  /** The Card is the frame: the soil to read is in its window. */
  inWindow?: boolean
}

export function SpotsPanel({ spotCount, inWindow = false }: Props) {
  return (
    <p className="text-base" data-testid="spot-prompt">
      {spotCount === 0 ? (
        <>
          Tap the middle of the{" "}
          <b className="font-semibold underline decoration-2 underline-offset-4">soil</b>
          {inWindow ? " in the frame's window" : ""}.
        </>
      ) : (
        <>
          {spotCount === 1 ? "1 Spot" : `${spotCount} Spots`} read. Tap the soil again to read
          another Spot, such as a mottle.
        </>
      )}
    </p>
  )
}

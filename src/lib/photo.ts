// Getting a Photo into the app: an example from the simulated camera, or the user's own file.
import { simulatePhoto, type ExamplePhoto } from "@/engine/simulate"
import type { LoadedPhoto } from "@/lib/session"

/** Longest side of a Photo we keep. Bigger Photos are scaled down; phones shoot 4000+ px. */
export const MAX_SIDE = 1600

export function examplePhoto(example: ExamplePhoto): LoadedPhoto {
  const { pixels, frame } = simulatePhoto(example.scene)
  return {
    name: `Example: ${example.name.toLowerCase()} (simulated camera)`,
    exampleId: example.id,
    pixels: new ImageData(pixels.data, pixels.width, pixels.height),
    ...(frame ? { batch: frame.batch } : {}),
  }
}

export async function filePhoto(file: File): Promise<LoadedPhoto> {
  const bitmap = await createImageBitmap(file) // honours the Photo's EXIF rotation
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("No 2D canvas available")
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return {
      name: `Your Photo: ${file.name}`,
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
    }
  } finally {
    bitmap.close()
  }
}

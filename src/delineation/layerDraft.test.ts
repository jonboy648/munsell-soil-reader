import { describe, expect, test } from "vitest"
import { draftOfLayer, emptyLayerDraft, layerOfDraft, type LayerDraft } from "./layerDraft"
import { JF1_POINT } from "./fixtures/jf1"

const draft = (extra: Partial<LayerDraft>): LayerDraft => ({ ...emptyLayerDraft, ...extra })

const value = (d: LayerDraft) => {
  const parsed = layerOfDraft(d)
  if ("problem" in parsed) throw new Error(parsed.problem)
  return parsed.value
}
const problem = (d: LayerDraft) => {
  const parsed = layerOfDraft(d)
  return "problem" in parsed ? parsed.problem : null
}

describe("a Layer typed into the form", () => {
  test("the third JF-1 layer, as typed", () => {
    const layer = value(
      draft({ top: "25", bottom: "29", matrix: "10yr 4/2", matrixPercent: "97", redox: [{ color: "7.5YR 4/6", percent: "3" }] }),
    )
    expect(layer).toMatchObject({
      top: 25,
      bottom: 29,
      matrix: { notation: "10YR 4/2", percent: 97 },
      redox: [{ notation: "7.5YR 4/6", percent: 3 }],
      remarks: "",
    })
  })

  test("a layer with no matrix color is allowed (the form warns about it), and a blank redox row is dropped", () => {
    const layer = value(draft({ top: "0", bottom: "6", redox: [{ color: "", percent: "" }], remarks: " roots " }))
    expect(layer.matrix).toBeNull()
    expect(layer.redox).toEqual([])
    expect(layer.remarks).toBe("roots")
  })

  test("what is wrong is said in plain words", () => {
    expect(problem(draft({ top: "", bottom: "6" }))).toContain("top and the bottom")
    expect(problem(draft({ top: "6", bottom: "6" }))).toContain("deeper")
    expect(problem(draft({ top: "-1", bottom: "6" }))).toContain("zero or more")
    expect(problem(draft({ top: "0", bottom: "6", matrix: "brown" }))).toContain("Matrix: type a soil-book color")
    expect(problem(draft({ top: "0", bottom: "6", matrix: "10YR 4/2", matrixPercent: "0" }))).toContain("Matrix: A percent")
    expect(problem(draft({ top: "0", bottom: "6", redox: [{ color: "7.5YR 4/6", percent: "" }] }))).toContain("Redox 1")
    expect(problem(draft({ top: "0", bottom: "6", redox: [{ color: "", percent: "5" }] }))).toContain("Redox 1")
  })

  test("editing a Layer keeps its id and the Reading its colors came from, while the notation is unchanged", () => {
    const reading = { id: "r1" } as never
    const before = { ...JF1_POINT.layers[2], matrix: { notation: "10YR 4/2", percent: 97, reading } }
    const same = layerOfDraft(draftOfLayer(before), before)
    expect(same).toMatchObject({ value: { id: before.id, matrix: { reading } } })
    const changed = layerOfDraft({ ...draftOfLayer(before), matrix: "10YR 4/3" }, before)
    expect(changed).toMatchObject({ value: { id: before.id, matrix: { notation: "10YR 4/3" } } })
    expect("value" in changed && changed.value.matrix?.reading).toBeUndefined()
  })
})

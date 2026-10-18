// Prints a Markdown summary of a Playwright JSON report (e2e-results.json): how many browser
// tests passed, were skipped (with the reason each gave), were flaky or failed. CI appends it
// to the job summary, one per engine.
import { existsSync, readFileSync } from "node:fs"

const file = process.argv[2] ?? "e2e-results.json"
const engine = process.argv[3] ?? "browser"
if (!existsSync(file)) {
  console.log(`### Browser tests: ${engine}\n\nNo report at ${file}; the run stopped before it could write one.`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(file, "utf8"))
const tests = []
const walk = (suite) => {
  for (const spec of suite.specs ?? []) for (const t of spec.tests) tests.push({ title: spec.title, file: spec.file, ...t })
  for (const child of suite.suites ?? []) walk(child)
}
report.suites.forEach(walk)

const count = (status) => tests.filter((t) => t.status === status).length
const skipped = tests.filter((t) => t.status === "skipped")
const lines = [
  `### Browser tests: ${engine}`,
  "",
  `${count("expected")} passed, ${skipped.length} skipped, ${count("flaky")} flaky, ${count("unexpected")} failed ` +
    `in ${(report.stats.duration / 1000).toFixed(0)} s`,
]
const byReason = Map.groupBy(skipped, (t) => t.annotations.find((a) => a.type === "skip")?.description || "no reason given")
for (const [reason, group] of byReason) {
  lines.push("", `<details><summary>${group.length} skipped: ${reason}</summary>`, "")
  for (const t of group) lines.push(`- ${t.file}: ${t.title}`)
  lines.push("", "</details>")
}
for (const t of tests.filter((t) => t.status === "flaky")) lines.push(`- flaky: ${t.file} - ${t.title}`)
console.log(lines.join("\n"))

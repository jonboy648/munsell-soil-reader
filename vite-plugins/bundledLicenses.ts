// Writes licenses.json next to the app: every package whose code or files are in the build, with
// its version, license and the full license (and notice) text from the package itself. The method
// page shows it, and the service worker caches it with everything else, so the credits for the
// code the app ships are generated from what it ships and cannot drift from it.
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import type { Plugin } from "vite"

export interface BundledLicense {
  name: string
  version: string
  /** The license named in the package, as an SPDX id or expression. */
  license: string
  homepage: string | null
  /** The package's own license and notice files, as shipped; null when it has none. */
  text: string | null
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i

/** The package folder a file of the build comes from, or null for the app's own files. */
function packageRootOf(id: string): string | null {
  const path = id.split("?")[0].replaceAll("\\", "/")
  const marker = "/node_modules/"
  const at = path.lastIndexOf(marker)
  if (at < 0) return null
  const parts = path.slice(at + marker.length).split("/")
  const name = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]
  return `${path.slice(0, at + marker.length)}${name}`
}

/**
 * A few packages name the MIT license in package.json and ship no license file. Say so, and give
 * the standard MIT text with the author as the copyright holder, which is all the notice has.
 */
function withoutLicenseFile(license: string, author: unknown): string | null {
  const holder = typeof author === "string" ? author : (author as { name?: string } | undefined)?.name
  if (license !== "MIT" || !holder) return null
  return `This package ships no license file. Its package.json names the MIT license and its author, ${holder}. The standard MIT license text, with the author as the copyright holder:

MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`
}

function describe(root: string): BundledLicense | null {
  const manifest = join(root, "package.json")
  if (!existsSync(manifest)) return null
  const pkg = JSON.parse(readFileSync(manifest, "utf8"))
  const license =
    typeof pkg.license === "string"
      ? pkg.license
      : pkg.license?.type ?? pkg.licenses?.map((l: { type: string }) => l.type).join(" OR ") ?? "unknown"
  const files = readdirSync(root)
    .filter((file) => LICENSE_FILE.test(file))
    .sort()
  const shipped = files.length
    ? files
        .map((file) => {
          const body = readFileSync(join(root, file), "utf8").replaceAll("\r\n", "\n").trim()
          return files.length > 1 ? `${file}\n\n${body}` : body
        })
        .join("\n\n----------\n\n")
    : null
  const text = shipped ?? withoutLicenseFile(license, pkg.author)
  const homepage =
    pkg.homepage ?? (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url) ?? null
  return { name: pkg.name, version: pkg.version, license, homepage, text }
}

/**
 * @param alsoShipped packages whose files reach the app by a route the module graph does not
 * show (stylesheets and the service worker, which is built in a second pass), by name.
 */
export function bundledLicenses(alsoShipped: string[]): Plugin {
  return {
    name: "bundled-licenses",
    apply: "build",
    generateBundle(_options, bundle) {
      const roots = new Set<string>()
      for (const output of Object.values(bundle)) {
        const ids =
          output.type === "chunk"
            ? (output.moduleIds ?? Object.keys(output.modules ?? {}))
            : (output.originalFileNames ?? [])
        for (const id of ids) {
          const root = packageRootOf(id)
          if (root) roots.add(root)
        }
      }
      for (const name of alsoShipped) roots.add(resolve("node_modules", name).replaceAll("\\", "/"))

      const found = new Map<string, BundledLicense>()
      for (const root of roots) {
        const entry = describe(root)
        if (entry) found.set(`${entry.name}@${entry.version}`, entry)
      }
      const packages = [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
      // A shipped package whose license cannot be shown is a build error, not a quiet gap.
      for (const pkg of packages) {
        if (!pkg.text) this.error(`${pkg.name}@${pkg.version} (${pkg.license}) has no license file to show`)
      }
      this.emitFile({
        type: "asset",
        fileName: "licenses.json",
        source: JSON.stringify({ packages }),
      })
    },
  }
}

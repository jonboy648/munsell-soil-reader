// Projects on disk, beside the Samples, in the same database (see logStore.ts). A Project is one
// document with its Sampling points and Layers inside it, and every change is one read-modify-write
// in a single transaction, so a second tab cannot overwrite it with an older copy.
import type { Project } from "@/delineation/model"
import { PROJECTS, run } from "@/lib/logStore"

export const listProjects = (): Promise<Project[]> =>
  run(PROJECTS, "readonly", (store) => {
    const request = store.getAll()
    return () => request.result as Project[]
  }).catch((error) => {
    // A Log that could not be updated has no projects store: there are none to show.
    if (error instanceof DOMException && error.name === "NotFoundError") return []
    throw error
  })

export const addProject = (project: Project): Promise<void> =>
  run(PROJECTS, "readwrite", (store) => {
    store.put(project)
    return () => undefined
  })

export const deleteProject = (id: string): Promise<void> =>
  run(PROJECTS, "readwrite", (store) => {
    store.delete(id)
    return () => undefined
  })

/** Reads a Project, changes it, and writes it back in one transaction. Resolves undefined when it is gone. */
export const changeProject = (id: string, change: (project: Project) => Project): Promise<Project | undefined> =>
  run(PROJECTS, "readwrite", (store) => {
    let updated: Project | undefined
    const get = store.get(id)
    get.onsuccess = () => {
      if (get.result) store.put((updated = change(get.result as Project)))
    }
    return () => updated
  })

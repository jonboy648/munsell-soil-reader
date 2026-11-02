import * as React from "react"
import type { Project } from "@/delineation/model"
import { logIsReadOnly, watchLog } from "@/lib/logStore"
import { addProject, changeProject, deleteProject, listProjects } from "@/lib/projectStore"

/**
 * The Projects on the device, newest first, read again after every write here and whenever another
 * tab changes them. Each write rejects when the Log could not be written.
 */
export function useProjects() {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [problem, setProblem] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      setProjects((await listProjects()).sort((a, b) => b.createdAt - a.createdAt))
      setProblem(logIsReadOnly() ? "The update of the Log could not finish, so projects cannot be added or changed yet. Reload to try again." : null)
    } catch {
      setProblem("The projects can't be opened on this device.")
    }
  }, [])
  React.useEffect(() => {
    void refresh()
    return watchLog(() => void refresh())
  }, [refresh])

  const write = async (work: () => Promise<unknown>) => {
    await work()
    await refresh()
  }
  return {
    projects,
    problem,
    add: (project: Project) => write(() => addProject(project)),
    change: (id: string, change: (project: Project) => Project) => write(() => changeProject(id, change)),
    remove: (id: string) => write(() => deleteProject(id)),
  }
}

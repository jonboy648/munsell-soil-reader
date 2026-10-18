import * as React from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") return stored
  } catch {
    // Storage can be blocked (private windows); fall through to the system setting.
  }
  return "system"
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle("dark", dark)
}

const ThemeContext = React.createContext<{
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = React.useState(() => window.matchMedia(DARK_QUERY).matches)

  React.useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  React.useEffect(() => applyTheme(theme), [theme, systemDark])

  const setTheme = React.useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not saved; the choice still applies for this visit.
    }
    setThemeState(next)
  }, [])

  const isDark = theme === "dark" || (theme === "system" && systemDark)
  const value = React.useMemo(() => ({ theme, isDark, setTheme }), [theme, isDark, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}

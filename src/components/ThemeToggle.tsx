import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { isDark, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="lg" className="h-11" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun /> : <Moon />}
      {isDark ? "Switch to light mode" : "Switch to dark mode"}
    </Button>
  )
}

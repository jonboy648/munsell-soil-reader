import { StrictMode, Suspense, lazy } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

// Measurement mode is a maker tool at /?measure. Its code is a separate chunk, so the reader
// never downloads it.
const MeasureApp = lazy(() => import("./MeasureApp.tsx"))
const measuring = new URLSearchParams(location.search).has("measure")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {measuring ? (
        <Suspense fallback={null}>
          <MeasureApp />
        </Suspense>
      ) : (
        <App />
      )}
    </ThemeProvider>
  </StrictMode>
)

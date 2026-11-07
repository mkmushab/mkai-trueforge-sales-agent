import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("mkai-theme");
      return saved === null ? true : saved === "dark";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("mkai-theme", isDark ? "dark" : "light");
      document.body.className = isDark ? "theme-dark" : "theme-light";
    } catch {}
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return { isDark, toggleTheme };
}
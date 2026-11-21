"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "theme";

/** Inline script (runs before paint) so the saved theme applies without a flash. */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
  };
  return (
    <button className="btn btn-ghost btn-icon" onClick={toggle} aria-label={dark ? "โหมดสว่าง" : "โหมดมืด"} title={dark ? "โหมดสว่าง" : "โหมดมืด"}>
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

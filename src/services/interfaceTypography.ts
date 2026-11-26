import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { reportFontCSS } from "./systemFonts";

interface DesktopFont { family?: string | null; size?: string | null }

/** Resolve the host's control font without changing the report's chosen family. */
export function applyDesktopFont(native: DesktopFont = {}) {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;visibility:hidden;font:menu';
  document.body.append(probe);
  const menu = getComputedStyle(probe);
  const menuFamily = menu.fontFamily;
  const menuSize = menu.fontSize;
  probe.remove();
  const style = document.documentElement.style;
  style.setProperty('--ui-font-family', native.family ? reportFontCSS(native.family) : menuFamily || 'system-ui');
  const size = native.size && /^\d+(\.\d+)?(px|pt)$/.test(native.size) ? native.size : menuSize;
  style.setProperty('--ui-font-size', parseFloat(size) > 0 ? size : '13px');
}

/** Subscribe before reading so startup and GTK setting changes share one policy. */
export async function initializeInterfaceTypography(): Promise<() => void> {
  applyDesktopFont();
  if (!isTauri()) return () => {};
  const unlisten = await listen<DesktopFont>('desktop-font', event => applyDesktopFont(event.payload));
  try { applyDesktopFont(await invoke<DesktopFont>('desktop_font')); }
  catch (error) { console.warn('Desktop font metrics unavailable; using the WebView menu font.', error); }
  return unlisten;
}

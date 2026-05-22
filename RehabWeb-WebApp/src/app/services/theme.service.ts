import { Injectable, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'rehabweb-theme-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  init(): void {
    const nextValue = this.readStoredPreference() ?? this.systemPrefersDark();
    this.setDark(nextValue, false);
  }

  setDark(isDark: boolean, persist = true): void {
    this.isDark.set(isDark);
    this.applyThemeClass(isDark);

    if (persist && this.hasLocalStorage()) {
      window.localStorage.setItem(THEME_STORAGE_KEY, String(isDark));
    }
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  private readStoredPreference(): boolean | null {
    if (!this.hasLocalStorage()) return null;

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
  }

  private systemPrefersDark(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private applyThemeClass(isDark: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-dark', isDark);
  }

  private hasLocalStorage(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }
}

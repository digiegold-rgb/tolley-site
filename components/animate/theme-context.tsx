'use client';

/* Theme + Route contexts for the v2 shell.
 * Ported from vater-core.jsx lines 51-65.
 *
 * Two contexts so consumers can re-render independently:
 *   - useTheme()  : dark mode flag, toggle, and the active token slice (`t`).
 *   - useRoute()  : current route key + editor step plus their setters.
 */

import * as React from 'react';
import { JELLY_TOKENS, type VaterTheme } from './tokens';

export interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
  t: VaterTheme;
}

/* Default = dark. The public surfaces (landing, legal, demo) render without a
 * Shell and must come out in the cinema dark palette. */
const defaultThemeValue: ThemeContextValue = {
  dark: true,
  toggle: () => {},
  t: JELLY_TOKENS.dark,
};

export const ThemeContext = React.createContext<ThemeContextValue>(defaultThemeValue);

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  dark: boolean;
  toggle: () => void;
}

export function ThemeProvider({ children, dark, toggle }: ThemeProviderProps): React.ReactElement {
  const t: VaterTheme = dark ? JELLY_TOKENS.dark : JELLY_TOKENS.light;
  const value = React.useMemo<ThemeContextValue>(() => ({ dark, toggle, t }), [dark, toggle, t]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export interface RouteContextValue {
  route: string;
  setRoute: (next: string) => void;
  editorStep: number;
  setEditorStep: (next: number) => void;
  /** Currently-selected project for editor / video-editor routes. */
  selectedProjectId: string | null;
  setSelectedProjectId: (next: string | null) => void;
  /** Currently-selected style for styles-edit route. */
  selectedStyleId: string | null;
  setSelectedStyleId: (next: string | null) => void;
  /** Convenience: jump to the timeline editor for a specific project. */
  openProjectInVideoEditor: (projectId: string) => void;
  /** Convenience: jump to the 7-step pipeline editor for a specific project. */
  openProjectInEditor: (projectId: string, step?: number) => void;
  /** Convenience: open the in-v2 style editor for a specific style. */
  openStyleEditor: (styleId: string) => void;
  /** Legacy (pre 2026-08-28): bumped when "+ Create Video" was a dashboard
   *  modal. The stepped flow routes to `create` instead; nothing bumps this. */
  newVideoRequest: number;
  /** "+ Create Video" from anywhere: opens the stepped Create flow fresh
   *  (route `create`, no project selected). */
  requestNewVideo: () => void;
  /** Dashboard calls this once it has handled the request. */
  consumeNewVideoRequest: () => void;
  /** Opens the shell-level Help drawer (FAB + Dashboard tutorial card). */
  openHelp: () => void;
}

const defaultRouteValue: RouteContextValue = {
  route: 'dashboard',
  setRoute: () => {},
  editorStep: 0,
  setEditorStep: () => {},
  selectedProjectId: null,
  setSelectedProjectId: () => {},
  selectedStyleId: null,
  setSelectedStyleId: () => {},
  openProjectInVideoEditor: () => {},
  openProjectInEditor: () => {},
  openStyleEditor: () => {},
  newVideoRequest: 0,
  requestNewVideo: () => {},
  consumeNewVideoRequest: () => {},
  openHelp: () => {},
};

export const RouteContext = React.createContext<RouteContextValue>(defaultRouteValue);

export function useRoute(): RouteContextValue {
  return React.useContext(RouteContext);
}

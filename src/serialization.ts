export interface GameConfig {
  debugMovement: boolean;
}

export interface GameState {
  config: GameConfig;
}

const STORAGE_KEY = "gameState";

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.config) {
      return {
        config: {
          debugMovement: Boolean(parsed.config.debugMovement),
        },
      } as GameState;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Ignore storage errors (quota, privacy mode, etc.)
  }
}

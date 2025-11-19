export interface GameConfig {
  debugMovement: boolean;
}

export interface PlayerState {
  lat: number;
  lng: number;
}

export interface GameState {
  config: GameConfig;
  player: PlayerState;
}

const STORAGE_KEY = "gameState";

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const state: GameState = {
        config: {
          debugMovement: Boolean(parsed.config.debugMovement),
        },
        player: parsed.player,
      };
      return state;
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

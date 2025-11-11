// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Import world generation
import { CellInstance, World } from "./world.ts";

// Import our luck function
import luck from "./_luck.ts";
import { PlayerRadius } from "./player.ts";

export interface Coin {
  id: string;
  value: number;
  position: leaflet.LatLng;
  cell: CellInstance;
  history: string[];
  sprite?: string; // Placeholder for procedural sprite
}

export type CoinHoveredEventDetail = {
  coin: Coin;
};

export class CoinGenerator {
  private coins: Map<string, Coin> = new Map();

  constructor(
    private world: World,
    public coinEventBus: EventTarget,
    private spawnProbability: number = 0.1,
  ) {}

  generateCoins(): void {
    for (const cell of this.world.getAllCells()) {
      if (luck(cell.id) < this.spawnProbability) {
        this.spawnCoin(cell);
      }
    }
  }

  private spawnCoin(cell: CellInstance): void {
    const value = Math.floor(luck([cell.q, cell.r, "value"].toString()) * 10) +
      1; // Values 1-10 for D3.a
    const coin: Coin = {
      id: `coin-${cell.id}`,
      value,
      position: cell.center,
      cell,
      history: [`Spawned in cell ${cell.id}`],
    };
    this.coins.set(coin.id, coin);
  }

  getCoins(): Coin[] {
    return Array.from(this.coins.values());
  }

  getCoin(id: string): Coin | undefined {
    return this.coins.get(id);
  }
}

export function renderCoins(
  generator: CoinGenerator,
  map: leaflet.Map,
  radius: PlayerRadius,
): void {
  for (const coin of generator.getCoins()) {
    const withinReach =
      radius.position.distanceTo(coin.position) <= radius.reach;
    // For now, use a circle marker; later replace with sprite
    const marker = leaflet.circleMarker(coin.position, {
      color: withinReach ? "gold" : "gray",
      fillColor: withinReach ? "yellow" : "white",
      fillOpacity: withinReach ? 0.8 : 0.4,
      opacity: withinReach ? 0.8 : 0.4,
      radius: 5,
    });
    marker.addTo(map);

    if (!withinReach) {
      marker.clearAllEventListeners();
      continue;
    }
    marker.addEventListener(
      "mouseover",
      () =>
        generator.coinEventBus.dispatchEvent(
          new CustomEvent("coin-hovered", { detail: { coin } }),
        ),
    );
    marker.addEventListener(
      "mouseout",
      () =>
        generator.coinEventBus.dispatchEvent(
          new CustomEvent("coin-unhovered", { detail: { coin } }),
        ),
    );
  }
}

// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Import world generation
import { CellInstance, World } from "./world.ts";

// Import our luck function
import luck from "./_luck.ts";

export interface Coin {
  id: string;
  value: number;
  position: leaflet.LatLng;
  cell: CellInstance;
  history: string[];
  sprite?: string; // Placeholder for procedural sprite
}

export class CoinGenerator {
  private coins: Map<string, Coin> = new Map();

  constructor(private world: World, private spawnProbability: number = 0.1) {}

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

export function renderCoins(generator: CoinGenerator, map: leaflet.Map): void {
  for (const coin of generator.getCoins()) {
    // For now, use a circle marker; later replace with sprite
    const marker = leaflet.circleMarker(coin.position, {
      color: "gold",
      fillColor: "yellow",
      fillOpacity: 0.8,
      radius: 5,
    });
    marker.addTo(map);

    marker.bindPopup(() => {
      const popupDiv = document.createElement("div");
      popupDiv.innerHTML = `
        <div>Coin at ${coin.cell.id}. Value: <span id="value">${coin.value}</span>.</div>
        <button id="pickup">Pick Up</button>
      `;
      // TODO: Add pickup logic
      return popupDiv;
    });
  }
}

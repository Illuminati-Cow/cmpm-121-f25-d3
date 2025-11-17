// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import { PlayerRadius } from "./player.ts";
import { createMovementButtons } from "./ui.ts";
import { World } from "./world.ts";

export type Direction =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest"
  | "none";

const directionDeltas: Record<Direction, { dq: number; dr: number }> = {
  north: { dq: 0, dr: 1 },
  northeast: { dq: 1, dr: 0 },
  east: { dq: 1, dr: 0 },
  southeast: { dq: 1, dr: -1 },
  south: { dq: 0, dr: -1 },
  southwest: { dq: -1, dr: 0 },
  west: { dq: -1, dr: 0 },
  northwest: { dq: -1, dr: 1 },
  none: { dq: 0, dr: 0 },
};

export class Positioning {
  constructor(
    private world: World,
    private playerRadius: PlayerRadius,
    map: leaflet.Map,
    eventBus: EventTarget,
  ) {
    const playerMarker = leaflet.marker(this.playerRadius.position);
    playerMarker.bindTooltip("That's you!");
    playerMarker.addTo(map);

    playerMarker.bindPopup(createMovementButtons(eventBus));
    playerMarker.openPopup();
    map.setView(this.playerRadius.position);
    eventBus.addEventListener("move-player", (event) => {
      const detail = (event as CustomEvent).detail;
      const direction = detail.direction as Direction;
      this.move(direction);
      playerMarker.setLatLng(this.position);
      // map.panTo(this.position);
      const coord = world.latLngToHex(
        this.position.lat,
        this.position.lng,
      );
      world.updateCellsAround(coord, 10, map, playerRadius, eventBus);
      world.renderHexes(map, playerRadius);
    });
    eventBus.dispatchEvent(
      new CustomEvent("move-player", { detail: { direction: "none" } }),
    );
    navigator.geolocation.watchPosition((pos) => {
      this.updateFromGPS(pos.coords.latitude, pos.coords.longitude);
      playerMarker.setLatLng(this.position);
      const coord = world.latLngToHex(
        this.position.lat,
        this.position.lng,
      );
      world.updateCellsAround(coord, 10, map, playerRadius, eventBus);
      world.renderHexes(map, playerRadius);
    });
  }

  get position(): leaflet.LatLng {
    return this.playerRadius.position;
  }

  get reach(): number {
    return this.playerRadius.reach;
  }

  // Move to adjacent cell in the specified direction
  move(direction: Direction): void {
    const currentCell = this.world.getCellAtLatLng(this.playerRadius.position);
    const delta = directionDeltas[direction];
    const newCell = this.world.getCell(
      currentCell.q + delta.dq,
      currentCell.r + delta.dr,
    );
    this.playerRadius.position = newCell.center;
  }

  // Stub for GPS update
  updateFromGPS(lat: number, lng: number): void {
    // TODO: Implement GPS this
    // For now, snap to the cell at the given lat/lng
    const cell = this.world.getCellAtLatLng(leaflet.latLng(lat, lng));
    this.playerRadius.position = cell.center;
  }
}

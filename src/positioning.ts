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
  private mode: "gps" | "ui" = "gps";
  private watchId: number | null = null;
  public playerMarker: leaflet.Marker;

  constructor(
    private world: World,
    public playerRadius: PlayerRadius,
    map: leaflet.Map,
    eventBus: EventTarget,
    initialMode: "gps" | "ui" = "gps",
  ) {
    this.setMode(initialMode, map, eventBus);
    this.playerMarker = leaflet.marker(this.playerRadius.position);
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(map);
    map.setView(this.playerRadius.position);

    eventBus.addEventListener("move-player", (event) => {
      if (this.mode !== "ui") return;
      const detail = (event as CustomEvent).detail;
      const direction = detail.direction as Direction;
      this.move(direction);
      this.playerMarker.setLatLng(this.position);
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

  setMode(mode: "gps" | "ui", map: leaflet.Map, eventBus: EventTarget): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === "ui") {
      this.stopGPS();
      this.playerMarker.bindPopup(createMovementButtons(eventBus));
      this.playerMarker.openPopup();
    } else {
      this.playerMarker.closePopup();
      this.playerMarker.unbindPopup();
      this.startGPS(map, eventBus);
    }
  }

  private startGPS(map: leaflet.Map, eventBus: EventTarget): void {
    if (this.watchId) return;
    this.watchId = navigator.geolocation.watchPosition((pos) => {
      this.updateFromGPS(pos.coords.latitude, pos.coords.longitude);
      this.playerMarker.setLatLng(this.position);
      const coord = this.world.latLngToHex(
        this.position.lat,
        this.position.lng,
      );
      this.world.updateCellsAround(coord, 10, map, this.playerRadius, eventBus);
      this.world.renderHexes(map, this.playerRadius);
    });
  }

  private stopGPS(): void {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  resetTo(position: leaflet.LatLng): void {
    this.playerRadius.position = position;
    this.playerMarker.setLatLng(position);
  }
}

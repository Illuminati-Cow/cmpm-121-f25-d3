// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import { addCoinEventListeners, Coin, createCoinMarker } from "./generation.ts";
import { PlayerRadius } from "./player.ts";

export interface Cell {
  id: string;
  q: number;
  r: number;
  center: leaflet.LatLng;
  bounds: leaflet.LatLngBounds;
}

export class SharedCellData {
  constructor(
    public origin: leaflet.LatLng,
    public size: number = 0.00005, // Approximate radius for hex cells, ~0.0001 degrees bounding box
  ) {}

  getCenter(q: number, r: number): leaflet.LatLng {
    // Using flat-top hex coordinates for lat/lng approximation
    // x (lng) = size * (3/2 * q)
    // y (lat) = size * (√3/2 * q + √3 * r)
    const sqrt3 = Math.sqrt(3);
    const lng = this.origin.lng + this.size * (3 / 2 * q);
    const lat = this.origin.lat + this.size * ((sqrt3 / 2) * q + sqrt3 * r);
    return leaflet.latLng(lat, lng);
  }

  getCorners(q: number, r: number): leaflet.LatLng[] {
    const center = this.getCenter(q, r);
    const corners: leaflet.LatLng[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const cornerLng = center.lng + this.size * Math.cos(angle);
      const cornerLat = center.lat + this.size * Math.sin(angle);
      corners.push(leaflet.latLng(cornerLat, cornerLng));
    }
    return corners;
  }

  getBounds(q: number, r: number): leaflet.LatLngBounds {
    const corners = this.getCorners(q, r);
    return leaflet.latLngBounds(corners);
  }
}

export class CellInstance {
  constructor(
    public q: number,
    public r: number,
    private shared: SharedCellData,
  ) {}

  get id(): string {
    return `${this.q},${this.r}`;
  }

  get center(): leaflet.LatLng {
    return this.shared.getCenter(this.q, this.r);
  }

  get bounds(): leaflet.LatLngBounds {
    return this.shared.getBounds(this.q, this.r);
  }

  get corners(): leaflet.LatLng[] {
    return this.shared.getCorners(this.q, this.r);
  }
}

export class World {
  private cells: Map<string, CellInstance> = new Map();
  private sharedData: SharedCellData;
  private activeCoins: Map<
    string,
    { coin: Coin; marker: leaflet.CircleMarker }
  > = new Map();
  private coinsByCell: Map<string, Coin> = new Map();
  private overlays: leaflet.ImageOverlay[] = [];

  constructor(origin: leaflet.LatLng) {
    this.sharedData = new SharedCellData(origin);
  }

  private drawHexPath(
    ctx: CanvasRenderingContext2D,
    qr: { q: number; r: number },
    map: leaflet.Map,
    nw: leaflet.Point,
  ): void {
    ctx.beginPath();
    const corners = this.sharedData.getCorners(qr.q, qr.r);
    const firstPoint = map.latLngToContainerPoint(corners[0]);
    ctx.moveTo(firstPoint.x - nw.x, firstPoint.y - nw.y);
    for (let i = 1; i < corners.length; i++) {
      const point = map.latLngToContainerPoint(corners[i]);
      ctx.lineTo(point.x - nw.x, point.y - nw.y);
    }
    ctx.closePath();
  }

  private createHexOverlay(
    map: leaflet.Map,
    qrs: { q: number; r: number }[],
    drawCell: (
      ctx: CanvasRenderingContext2D,
      qr: { q: number; r: number },
      nw: leaflet.Point,
    ) => void,
  ): void {
    if (qrs.length === 0) return;

    const allCorners = qrs.flatMap((qr) =>
      this.sharedData.getCorners(qr.q, qr.r)
    );
    const bounds = leaflet.latLngBounds(allCorners);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nw = map.latLngToContainerPoint(bounds.getNorthWest());
    const se = map.latLngToContainerPoint(bounds.getSouthEast());
    const width = Math.abs(se.x - nw.x);
    const height = Math.abs(se.y - nw.y);

    canvas.width = width;
    canvas.height = height;

    for (const qr of qrs) {
      drawCell(ctx, qr, nw);
    }

    const imgUrl = canvas.toDataURL();
    const imageOverlay = leaflet.imageOverlay(imgUrl, bounds);
    imageOverlay.addTo(map);
    this.overlays.push(imageOverlay);
  }

  clearOverlays(map: leaflet.Map): void {
    this.overlays.forEach((overlay) => map.removeLayer(overlay));
    this.overlays = [];
  }

  updateCellsAround(
    centerQ: number,
    centerR: number,
    range: number,
    map: leaflet.Map,
  ): CellInstance[] {
    const newCells = new Map<string, CellInstance>();
    // Generate new cells within range
    for (let q = centerQ - range; q <= centerQ + range; q++) {
      for (let r = centerR - range; r <= centerR + range; r++) {
        const distance = (Math.abs(q - centerQ) + Math.abs(r - centerR) +
          Math.abs((q - centerQ) + (r - centerR))) / 2;
        if (distance <= range) {
          const cell = new CellInstance(q, r, this.sharedData);
          newCells.set(cell.id, cell);
        }
      }
    }

    // Remove cells that are no longer in range
    for (const [id, _cell] of this.cells) {
      if (!newCells.has(id)) {
        // Remove coin if exists
        const coin = this.coinsByCell.get(id);
        if (coin) {
          this.removeCoin(coin.id, map);
        }
        this.cells.delete(id);
      }
    }

    // Add new cells and collect them
    const addedCells: CellInstance[] = [];
    for (const [id, cell] of newCells) {
      if (!this.cells.has(id)) {
        this.cells.set(id, cell);
        addedCells.push(cell);
      }
    }
    return addedCells;
  }

  getCell(q: number, r: number): CellInstance | undefined {
    return this.cells.get(`${q},${r}`);
  }

  getAllCells(): CellInstance[] {
    return Array.from(this.cells.values());
  }

  getCellAtLatLng(latlng: leaflet.LatLng): CellInstance | undefined {
    const { q, r } = this.latLngToHex(latlng.lat, latlng.lng);
    return this.getCell(q, r);
  }

  latLngToHex(lat: number, lng: number): { q: number; r: number } {
    const size = this.sharedData.size;
    const origin = this.sharedData.origin;
    const x = lng - origin.lng;
    const y = lat - origin.lat;
    const sqrt3 = Math.sqrt(3);
    const q = (2 / 3) * x / size;
    const r = (-1 / 3 * x + (sqrt3 / 3) * y) / size;
    return { q: Math.round(q), r: Math.round(r) };
  }

  getNearbyCells(
    playerPos: leaflet.LatLng,
    reachDistance: number,
  ): CellInstance[] {
    return this.getAllCells().filter((cell) =>
      playerPos.distanceTo(cell.center) < reachDistance
    );
  }

  renderNearbyCells(
    map: leaflet.Map,
    playerRadius: PlayerRadius,
  ): void {
    const nearbyCells = this.getNearbyCells(
      playerRadius.position,
      playerRadius.reach,
    );

    const opacityFunction = (
      distance: number,
      minDistance: number,
      maxDistance: number,
      minWeight: number,
      maxWeight: number,
    ) => {
      const clamped = Math.min(Math.max(distance, minDistance), maxDistance);
      const range = maxDistance - minDistance;
      if (range === 0) return minWeight;
      const t = 1 - (clamped - minDistance) / range;
      return minWeight + t * (maxWeight - minWeight);
    };

    const nearbyQRs = nearbyCells.map((cell) => ({ q: cell.q, r: cell.r }));
    this.createHexOverlay(map, nearbyQRs, (ctx, qr, nw) => {
      const distance = playerRadius.position.distanceTo(
        this.sharedData.getCenter(qr.q, qr.r),
      );
      const weight = opacityFunction(distance, 10, 60, 0.1, 0.4);
      ctx.lineWidth = weight;
      ctx.fillStyle = "rgba(128, 128, 128, 0.1)";
      ctx.strokeStyle = "grey";

      this.drawHexPath(ctx, qr, map, nw);
      ctx.fill();
      ctx.stroke();
    });
  }

  renderHexGrid(
    map: leaflet.Map,
    playerRadius: PlayerRadius,
  ): void {
    const { q: centerQ, r: centerR } = this.latLngToHex(
      playerRadius.position.lat,
      playerRadius.position.lng,
    );
    const renderRange = 30;
    const allVisibleQRs: { q: number; r: number }[] = [];
    for (let q = centerQ - renderRange; q <= centerQ + renderRange; q++) {
      for (let r = centerR - renderRange; r <= centerR + renderRange; r++) {
        const distance = (Math.abs(q - centerQ) + Math.abs(r - centerR) +
          Math.abs((q - centerQ) + (r - centerR))) / 2;
        if (distance <= renderRange) {
          allVisibleQRs.push({ q, r });
        }
      }
    }
    const nearbyCells = this.getNearbyCells(
      playerRadius.position,
      playerRadius.reach,
    );
    const nearbyQRs = nearbyCells.map((cell) => ({ q: cell.q, r: cell.r }));
    const distantQRs = allVisibleQRs.filter((qr) =>
      !nearbyQRs.some((nqr) => nqr.q === qr.q && nqr.r === qr.r)
    );

    this.createHexOverlay(map, distantQRs, (ctx, qr, nw) => {
      ctx.strokeStyle = "lightgrey";
      ctx.lineWidth = 1;

      this.drawHexPath(ctx, qr, map, nw);
      ctx.stroke();
    });
  }

  addCoin(
    coin: Coin,
    withinReach: boolean,
    eventBus: EventTarget,
    map: leaflet.Map,
  ): void {
    const marker = createCoinMarker(coin, withinReach);
    marker.addTo(map);
    if (withinReach) {
      addCoinEventListeners(marker, coin, eventBus);
    }
    this.activeCoins.set(coin.id, { coin, marker });
    this.coinsByCell.set(coin.cell.id, coin);
  }

  removeCoin(id: string, map: leaflet.Map): void {
    const entry = this.activeCoins.get(id);
    if (entry) {
      map.removeLayer(entry.marker);
      this.coinsByCell.delete(entry.coin.cell.id);
      this.activeCoins.delete(id);
    }
  }

  updateCoinPosition(id: string, newPosition: leaflet.LatLng): void {
    const entry = this.activeCoins.get(id);
    if (entry) {
      const oldCellId = entry.coin.cell.id;
      entry.coin.position = newPosition;
      entry.marker.setLatLng(newPosition);

      // Update cell if position changed to a different cell
      const newCell = this.getCellAtLatLng(newPosition);
      if (newCell && newCell.id !== oldCellId) {
        entry.coin.cell = newCell;
        this.coinsByCell.delete(oldCellId);
        this.coinsByCell.set(newCell.id, entry.coin);
      }
    }
  }

  getActiveCoins(): Coin[] {
    return Array.from(this.activeCoins.values()).map((entry) => entry.coin);
  }

  getCoinMarker(id: string): leaflet.CircleMarker | undefined {
    return this.activeCoins.get(id)?.marker;
  }

  getCoinInCell(cell: CellInstance): Coin | undefined {
    return this.coinsByCell.get(cell.id);
  }

  updateCoinReaches(playerRadius: PlayerRadius): void {
    for (const [_id, entry] of this.activeCoins) {
      const withinReach =
        playerRadius.position.distanceTo(entry.coin.position) <=
          playerRadius.reach;
      entry.marker.setStyle({
        color: withinReach ? "gold" : "gray",
        fillColor: withinReach ? "yellow" : "white",
        fillOpacity: withinReach ? 0.8 : 0.4,
        opacity: withinReach ? 0.8 : 0.4,
      });
    }
  }
}

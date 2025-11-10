// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

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

  constructor(origin: leaflet.LatLng, private range: number = 10) {
    this.sharedData = new SharedCellData(origin);
  }

  generateCellsAround(centerQ: number, centerR: number): void {
    // Generate hex cells within the range using axial coordinates
    for (let q = centerQ - this.range; q <= centerQ + this.range; q++) {
      const r1 = Math.max(centerR - this.range, -q - centerR - this.range);
      const r2 = Math.min(centerR + this.range, -q - centerR + this.range);
      for (let r = r1; r <= r2; r++) {
        const cell = new CellInstance(q, r, this.sharedData);
        this.cells.set(cell.id, cell);
      }
    }
  }

  getCell(q: number, r: number): CellInstance | undefined {
    return this.cells.get(`${q},${r}`);
  }

  getAllCells(): CellInstance[] {
    return Array.from(this.cells.values());
  }

  // Convert lat/lng to nearest hex coordinates (approximate)
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
}

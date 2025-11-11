// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./_leafletWorkaround.ts";

import { World } from "./world.ts";

// Import coin generation
import { CoinGenerator, craftCoin } from "./generation.ts";
import { Inventory, PlayerRadius } from "./player.ts";
import { createCoinPopup } from "./ui.ts";

const inventory = new Inventory();

// Create basic UI elements

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const inventoryDiv = document.createElement("div");
inventoryDiv.id = "inventory";
document.body.append(inventoryDiv);

function updateInventoryUI() {
  if (inventory.hasItem()) {
    inventoryDiv.innerHTML = `<div>${inventory.coin!.value}</div>`;
  } else {
    inventoryDiv.innerHTML = `<div>Empty</div>`;
  }
}

updateInventoryUI();

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const PLAYER_REACH_DISTANCE = 60; // meters

const eventBus = new EventTarget();

const playerRadius: PlayerRadius = {
  position: CLASSROOM_LATLNG,
  reach: PLAYER_REACH_DISTANCE,
};

eventBus.addEventListener("coin-hovered", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;
  createCoinPopup(map, coin);
});

eventBus.addEventListener("coin-clicked", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;

  if (inventory.hasItem() && inventory.coin!.value === coin.value) {
    const oldCoin = inventory.coin;
    inventory.swapItem(craftCoin(oldCoin!, coin));
    if ((inventory.coin?.value ?? 0) >= 256) {
      alert("You have crafted a 256 coin and won the game!");
    }
  } else {
    const oldCoin = inventory.swapItem(coin);
    if (oldCoin) {
      oldCoin.position = coin.position;
      oldCoin.cell = coin.cell;
      oldCoin.history.push(`Placed in cell ${coin.cell.id}`);
      world.addCoin(
        oldCoin,
        playerRadius.position.distanceTo(oldCoin.position) <=
          playerRadius.reach,
        eventBus,
        map,
      );
    }
  }
  updateInventoryUI();
  world.removeCoin(coin.id, map);
  eventBus.dispatchEvent(new CustomEvent("coin-unhovered"));
});

eventBus.addEventListener("coin-unhovered", () => {
  map.closePopup();
});

const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

map.addEventListener("click", (event) => {
  const latlng = event.latlng;
  const cell = world.getCellAtLatLng(latlng);
  if (!cell) return;

  const distance = cell.center.distanceTo(playerRadius.position);
  if (distance > PLAYER_REACH_DISTANCE) return;

  const coinInCell = world.getCoinInCell(cell);
  if (coinInCell) {
    eventBus.dispatchEvent(
      new CustomEvent("coin-clicked", { detail: { coin: coinInCell } }),
    );
  } else if (inventory.hasItem()) {
    inventory.coin!.position = cell.center;
    inventory.coin!.cell = cell;
    inventory.coin!.history.push(`Placed in cell ${cell.id}`);
    world.addCoin(
      inventory.removeItem()!,
      true,
      eventBus,
      map,
    );
    updateInventoryUI();
  }
});

const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const world = new World(CLASSROOM_LATLNG, 25);

world.generateCellsAround(0, 0);
world.renderNearbyCells(map, playerRadius);
world.renderHexGrid(map, playerRadius);

const coinGenerator = new CoinGenerator(world);
coinGenerator.generateCoins();

for (const coin of coinGenerator.getCoins()) {
  const withinReach =
    playerRadius.position.distanceTo(coin.position) <= playerRadius.reach;
  world.addCoin(coin, withinReach, eventBus, map);
}

import { Map } from "leaflet";
import { Coin } from "./generation.ts";

export function createCoinPopup(map: Map, coin: Coin): HTMLElement {
  const container = document.createElement("div");
  container.className = "coin-popup";
  container.innerHTML = `
    <h3>Coin</h3>
    <p>Value: ${coin.value}</p>
    <p>Position: (${coin.position.lat.toFixed(5)}, ${
    coin.position.lng.toFixed(5)
  })</p>
  `;
  map.openPopup(container, coin.position, {
    closeButton: false,
    autoClose: false,
    closeOnClick: true,
  });
  return container;
}

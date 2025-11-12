# Requirements

Assignment specific details trump game design. Whenever an assignment section specifies a requirement, it should be used instead of the original game design. If possible, a feature flag should be used to allow the original game design to still be implemented, but disabled until the assignment is completed.

## Game Design

This is a location-based geocoin collection game, where players pick up and craft unique geocoins all while traveling in the real world. While this game design is multiplayer, the project will be a **singleplayer demo**.

### Geocoins

- These geocoins have unique, procedurally generated textures that are similar in style to GitHub's random, pixelated profile pictures
- The coin sprite should be 64x64 and use bright colors
- Coins spawn deterministically throughout the world
- One coin can be carried by a player at a time
- Each coin should have a history of where it was interacted with, such as where it was picked up and where it was put down

#### Crafting

- Coins can be combined by picking one up and placing it down on top of another coin
- Combination results in the two coin sprites combining in an interesting way
- Their history of past combinations and interactions should be merged together

### Inventory

- The player can hold ONE coin at a time, and can carry it with them wherever they travel
- There should be a minimal UI element that shows the player's one slot inventory, and any item contained within it
- The inventory UI should always be displayed as an on screen GUI, whether or not they are carrying an item, which should be displayed
- The player can pick up coins by walking within a set distance to one and then clicking (or tapping) on it to create a pop-up with more information, and then clicking a "Pick Up Coin" button
- If the player is already holding an item and attempts to pick up another one, they should be able to see more information about the new item, but should be instead given the option to swap or craft it with the item currently in their inventory

### Game World

- The game world uses a Leaflet map of the real world
- The content of the map, such as the position of the geocoins, is created deterministically such that it produces the same world across page loads
- The map is divided up into cells based on real-world distances, with each cell being a hexagon with an area roughly the size of a house (its rectangle bounding box should be roughly 0.0001 degrees per side)
- Geocoins and any other objects should be visible on the game map without needing to click on a cell, every game object should have a visual (it may be shared or unique)
- The game map is scrollable, but should center around the player by default
- Cells should cover the entire map, but do not need to be generated (or stored) away from the player

## Technologies

- TypeScript for most game code, explicit HTML should only be used for static page UI, and CSS gathered into one style.css file
- Leaflet is used for the map game space
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignment Details

This assignment is known as Demo 3, or D3, with each step split into a lettered section. So, the first step would be D3.a.

### D3.a

- The coins must have a numeric value associated with them, which should serve as the coins sprite
- The coins can only be crafted with another coin of the same values, producing a coin with a value of their sum
- The game has an end condition, which is when they craft a token with a value of 256

### D3.b

- The interface offers some buttons to simulate local player movement (e.g. to move north/south/east/west by one grid step).
- As the player moves, cells continue to be visible all the way out to the edge of the map (i.e. they spawn/despawn as necessary to keep the screen full).
- The representation of grid cells uses an earth-spanning coordinate system anchored at Null Island (zero latitude, zero longitude).

- Map:
  - The player can move their character about the map or simply scroll the map without moving their character, seeing cells wherever they go.
  - As the character moves, only the cells near to their current location are available for interaction.
  - Cells should appear to be memoryless in the sense that they forget their state when they are no longer visible on the screen. As a result, the player should be able to farm tokens by moving into and out of the visibility range of a cell. (This behavior will be robustly fixed in the next assignment.)

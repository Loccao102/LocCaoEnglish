/** Optional field notes are exploration souvenirs, separate from quest currency. */
export const discoveries = [
  { id: "hello", word: "hello", meaning: "A friendly word when you meet someone.", x: 339, y: 596 },
  { id: "garden", word: "garden", meaning: "A place where flowers and plants grow.", x: 321, y: 396 },
  { id: "journey", word: "journey", meaning: "Travelling from one place to another.", x: 453, y: 446 },
  { id: "kind", word: "kind", meaning: "Caring about other people and helping them.", x: 570, y: 622 },
  { id: "curious", word: "curious", meaning: "Wanting to learn and discover new things.", x: 728, y: 281 },
  { id: "together", word: "together", meaning: "With someone, sharing the same moment.", x: 789, y: 555 },
  { id: "bright", word: "bright", meaning: "Full of light, colour, or good ideas.", x: 946, y: 401 },
  { id: "wonder", word: "wonder", meaning: "The happy surprise of finding something special.", x: 781, y: 220 },
] as const;
export type Discovery = typeof discoveries[number];
export const fieldChests = [
  { id: "welcome-chest", x: 380, y: 590, title: "The explorer’s note", text: "Little words make big journeys. Follow the floating word seeds, walk close to collect them, then read your field notes in the bag." },
  { id: "lake-chest", x: 741, y: 408, title: "A note by the lagoon", text: "A mistake is a sign that you tried. Every village quest can be played again. Two correct answers bring you a little closer to the missing Sun Pages." },
  { id: "lighthouse-chest", x: 823, y: 259, title: "A letter to a future friend", text: "One day you will look back at this journey and see how much you learned. Keep being curious. The lighthouse is waiting for your final Sun Page." },
] as const;
export type FieldChest = typeof fieldChests[number];

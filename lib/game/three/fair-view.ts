import { OrthographicCamera, Vector3 } from "three";
import { FestivalSession } from "../festival-session";
import type { FestivalGame } from "../festival";

export function fairLabelHeight(shape: string) {
  return shape === "bubble" ? 2.05 : shape === "house" ? 2.1 : shape === "ring" ? 1.95 : shape === "tile" ? .5 : 1.5;
}

/** Fit the playable objects, not the much larger decorative island. */
export function frameFairCamera(camera: OrthographicCamera, game: FestivalGame, width: number, height: number, session?:FestivalSession) {
  camera.position.set(0, 14, 12); camera.lookAt(0, .5, .25); camera.updateMatrixWorld();
  const objects = (session||new FestivalSession(game, () => {})).objects();
  const points: Vector3[] = [];
  for (const object of objects) {
    for (const side of [-1, 1]) points.push(new Vector3(object.x + side * .95, 0, object.z + side * .7));
    points.push(new Vector3(object.x, fairLabelHeight(object.shape) + .25+(session?.course?.high.includes(object.id)?.6:0), object.z));
  }
  const playerX = game.kind === "hop" ? -3 : 0, playerZ = game.kind === "hop" ? 3.7 : 3.5;
  points.push(new Vector3(playerX - .7, 0, playerZ + .5), new Vector3(playerX + .7, 2, playerZ));
  if (game.kind === "bridge") points.push(new Vector3(-4, .5, -1.65), new Vector3(4, .5, 1.65));
  const projected = points.map(point => point.applyMatrix4(camera.matrixWorldInverse));
  const minX = Math.min(...projected.map(point => point.x)), maxX = Math.max(...projected.map(point => point.x));
  const minY = Math.min(...projected.map(point => point.y)), maxY = Math.max(...projected.map(point => point.y));
  const unitsPerPixel = Math.max((maxX - minX) / Math.max(1, width - 40), (maxY - minY) / Math.max(1, height - 64));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2 + unitsPerPixel * 16;
  camera.left = centerX - width * unitsPerPixel / 2; camera.right = centerX + width * unitsPerPixel / 2;
  camera.top = centerY + height * unitsPerPixel / 2; camera.bottom = centerY - height * unitsPerPixel / 2;
  camera.updateProjectionMatrix();
  return { centerX, centerY, unitsPerPixel };
}

import { expose } from "comlink";
import "./workerShim";

let log = console.log;

const renderHorizontal = (
  y: number,
  imgData: Uint8Array,
  sliceLen: number,
  halfHeight: number,
  posZ: number,
  rayDirX0: number,
  rayDirX1: number,
  rayDirY0: number,
  rayDirY1: number,
  width: number,
  floorTextureWidth: number,
  floorTextureHeight: number,
  flooredWidthSpacing: number,
  flooredHeightSpacing: number,
  playerPositionX: number,
  playerPositionY: number,
  textureImgData: Uint8Array
): void => {
  // Current y position compared to the center of the screen (the horizon)
  let p = y - halfHeight;

  // Horizontal distance from the camera to the floor for the current row.
  // 0.5 is the z position exactly in the middle between floor and ceiling.
  let rowDistance = posZ / p;

  // calculate the real world step vector we have to add for each x (parallel to camera plane)
  // adding step by step avoids multiplications with a weight in the inner loop
  let floorStepX = (rowDistance * (rayDirX1 - rayDirX0)) / width;
  let floorStepY = (rowDistance * (rayDirY1 - rayDirY0)) / width;
  let floorStepXWithSpacing = floorStepX * flooredWidthSpacing;
  let floorStepYWithSpacing = floorStepY * flooredWidthSpacing;

  // real world coordinates of the leftmost column. This will be updated as we step to the right.
  let floorX = playerPositionX + rowDistance * rayDirX0;
  let floorY = playerPositionY + rowDistance * rayDirY0;

  for (let x = 0; x < width; x += flooredWidthSpacing) {
    // the cell coord is simply got from the integer parts of floorX and floorY
    let cellX = Math.floor(floorX);
    let cellY = Math.floor(floorY);
    // get the texture coordinate from the fractional part
    let tx = Math.floor(floorTextureWidth * (floorX - cellX));
    // &
    // (map.floorTexture.width - 1);
    let ty = Math.floor(floorTextureHeight * (floorY - cellY));
    // &
    // (map.floorTexture.height - 1);

    floorX += floorStepXWithSpacing;
    floorY += floorStepYWithSpacing;

    const fullImgIdx = ty * floorTextureWidth * 4 + tx * 4;
    for (let j = 0; j < flooredHeightSpacing; j++) {
      for (let i = 0; i < flooredWidthSpacing; i++) {
        const floorImgIdx = j * width * 4 + (x + i) * 4;
        imgData[floorImgIdx] = textureImgData[fullImgIdx];
        imgData[floorImgIdx + 1] = textureImgData[fullImgIdx + 1];
        imgData[floorImgIdx + 2] = textureImgData[fullImgIdx + 2];
        imgData[floorImgIdx + 3] = textureImgData[fullImgIdx + 3];
      }
    }
    log("OVERR");
  }
};

const onProgress = (cb: typeof console.log) => {
  log = cb;
};

expose({ renderHorizontal: renderHorizontal, onProgress });

export type WorkerType = {
  renderHorizontal: typeof renderHorizontal;
  onProgress: typeof onProgress;
};

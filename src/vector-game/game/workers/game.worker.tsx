import { expose } from "comlink";
import "./workerShim";

let log = console.log;

const renderHorizontal = (
  y: number,
  imgData: Uint8ClampedArray<ArrayBufferLike>
): void => {
  log("RCV" + y);
  log(imgData.length);
};

const onProgress = (cb: typeof console.log) => {
  log = cb;
};

expose({ renderHorizontal: renderHorizontal, onProgress });

export type WorkerType = {
  renderHorizontal: typeof renderHorizontal;
  onProgress: typeof onProgress;
};

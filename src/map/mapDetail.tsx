import { Position } from "../game";

interface MapDetailProps {
  map: Uint8Array;
  size: number;
  playerPosition: Position;
}

const MapDetail = (props: MapDetailProps) => {
  return (
    <div className="flex flex-row flex-wrap" style={{ width: props.size * 4 }}>
      {
        [...props.map].map((pix, idx) => {
          const x = idx % props.size;
          const y = Math.floor(idx / props.size);
          console.log(x, y, props.playerPosition.x, props.playerPosition, y);
          return (
            <div
              className={`w-[4px] h-[4px] ${
                pix == 1 ? "bg-green-500" : "bg-black"
              }`}
            />
          );
        }) as any
      }
    </div>
  );
};

export default MapDetail;

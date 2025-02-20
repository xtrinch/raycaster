import { observer } from "mobx-react-lite";
import { Position } from "../game";

interface MapPersonProps {
  playerPosition: Position;
}

const MapPerson = (props: MapPersonProps) => {
  return (
    <div
      className="relative bg-red-500 w-[4px] h-[4px]"
      style={{
        top: `${Math.round(props.playerPosition.y) * 4}px`,
        left: `${Math.round(props.playerPosition.x) * 4}px`,
      }}
    ></div>
  );
};

export default observer(MapPerson);

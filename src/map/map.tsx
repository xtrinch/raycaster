import { observer } from "mobx-react-lite";
import { useContext, useEffect } from "react";
import { Position } from "../game";
import { GameContext } from "../state/gameContext";
import MapDetail from "./mapDetail";
import MapPerson from "./mapPerson";

interface MapProps {
  map: Uint8Array;
  size: number;
  playerPosition: Position;
}

const Map = (props: {}) => {
  const gameContext = useContext(GameContext);

  useEffect(() => {}, []);

  const map = gameContext.gameLoop?.map?.wallGrid;
  const size = gameContext.gameLoop?.map?.size;
  const playerPosition = gameContext.gameLoop?.player?.position;

  if (!map || !playerPosition || !size) {
    return <></>;
  }
  return (
    <div className="absolute bottom-0 left-0" style={{ width: size * 4 }}>
      <MapPerson playerPosition={playerPosition} />
      <MapDetail playerPosition={playerPosition} map={map} size={size} />
    </div>
  );
};

export default observer(Map);

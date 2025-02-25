import { observer } from "mobx-react";
import { createRoot } from "react-dom/client";
import "./style.css";
import Map from "./vector-game/map/map";
import { GameContextProvider } from "./vector-game/state/gameContext";

const App = observer(() => {
  return (
    <GameContextProvider>
      <div>
        <canvas
          id="display"
          width="1"
          height="1"
          style={{ width: "100%", height: "100%" }}
        ></canvas>
        <canvas id="display1" width="100" height="100"></canvas>
        <Map />
      </div>
    </GameContextProvider>
  );
});

const root = createRoot(document.getElementById("root"));
root.render(<App />);

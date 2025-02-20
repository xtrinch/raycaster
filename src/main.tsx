import { observer } from "mobx-react";
import { createRoot } from "react-dom/client";
import Map from "./map/map";
import { GameContextProvider } from "./state/gameContext";
import "./style.css";

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
        {/* <Game /> */}
        <Map />
      </div>
    </GameContextProvider>
  );
});

const root = createRoot(document.getElementById("root"));
root.render(<App />);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Webcam from "./Webcam";
import Ripple from "./Ripple";
import "./index.css";

// One HTML entry serves all three windows, switched by ?window=.
const which = new URLSearchParams(window.location.search).get("window");
if (which === "webcam" || which === "ripple") document.body.classList.add("transparent-window");

const view = which === "webcam" ? <Webcam /> : which === "ripple" ? <Ripple /> : <App />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{view}</React.StrictMode>,
);

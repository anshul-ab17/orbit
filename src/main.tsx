import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Webcam from "./Webcam";
import "./index.css";

// One HTML entry serves both windows. The webcam bubble is opened with
// `?window=webcam`; everything else is the main dashboard.
const isWebcam = new URLSearchParams(window.location.search).get("window") === "webcam";
if (isWebcam) document.body.classList.add("webcam-bubble");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isWebcam ? <Webcam /> : <App />}</React.StrictMode>,
);

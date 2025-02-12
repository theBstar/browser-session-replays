import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import replayController from "./controllers/replayController.js";
import sessionController from "./controllers/sessionController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("data")); // For serving recorded videos

// Serve SDK files
app.use("/dist", express.static(path.join(__dirname, "../../sdk/dist")));

// API Routes
app.post("/api/sessions", sessionController.saveSession);
app.get("/api/replays", replayController.listReplays);
app.get("/api/replays/:id", replayController.getReplay);

// HTML Routes
app.get("/replays", replayController.getListHtml);
app.get("/replays/:id", replayController.getReplayHtml);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

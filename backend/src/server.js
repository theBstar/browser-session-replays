import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import replayController from "./controllers/replayController.js";
import sessionController, {
  createSession,
  updateSession,
} from "./controllers/sessionController.js";
import sessionService from "./services/sessionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(
  "/static/videos",
  express.static(path.join(__dirname, "../data/videos"))
);
app.use(
  "/static/thumbnails",
  express.static(path.join(__dirname, "../data/thumbnails"))
);

// Serve SDK files
app.use("/dist", express.static(path.join(__dirname, "../../sdk/dist")));

// API Routes
app.post("/api/sessions", sessionController.saveSession);
app.post("/api/sessions/new", createSession);
app.post("/api/sessions/:sessionId", updateSession);

// Video APIs - for video playback
app.get("/api/videos", async (req, res) => {
  try {
    const videos = await sessionService.listVideos();
    res.json(videos);
  } catch (error) {
    console.error("[API] Error listing videos:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/videos/:id", async (req, res) => {
  try {
    const details = await sessionService.getVideoDetails(req.params.id);
    res.json(details);
  } catch (error) {
    console.error("[API] Error getting video:", error);

    // More specific error handling
    if (
      error.message.includes("Session closed") ||
      error.message.includes("Target closed") ||
      error.message.includes("Protocol error")
    ) {
      res.status(503).json({
        error:
          "Video generation in progress, please try again in a few moments",
        retryAfter: 5, // Suggest retry after 5 seconds
      });
    } else if (error.message.includes("after 3 attempts")) {
      res.status(500).json({
        error: "Video generation failed, please contact support",
        details: error.message,
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Replay APIs - for raw events
app.get("/api/replays", replayController.listReplays);
app.get("/api/replays/:id", replayController.getReplay);

// Video file serving
app.get("/api/sessions/:id/video", async (req, res) => {
  try {
    const videoPath = await sessionService.getRecordingVideo(req.params.id);
    res.sendFile(videoPath);
  } catch (error) {
    console.error("[API] Error serving video:", error);
    res.status(500).json({ error: error.message });
  }
});

// HTML Routes
app.get("/replays", replayController.getListHtml);
app.get("/replays/:id", replayController.getReplayHtml);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import videoGenerator from "../utils/videoGenerator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, "../../data/sessions");
const VIDEOS_DIR = path.join(__dirname, "../../data/videos");

const replayService = {
  async listReplays() {
    console.log("[Service] Listing all replays from:", SESSIONS_DIR);
    const files = await fs.readdir(SESSIONS_DIR);
    console.log("[Service] Found", files.length, "replay files");
    const replays = await Promise.all(
      files.map(async (file) => {
        const data = await fs.readFile(path.join(SESSIONS_DIR, file), "utf-8");
        const session = JSON.parse(data);
        return {
          sessionId: session.sessionId,
          timestamp: session.metadata.timestamp,
          url: session.metadata.url,
        };
      })
    );
    return replays;
  },

  async getReplay(sessionId) {
    console.log("[Service] Getting replay for session:", sessionId);
    const data = await fs.readFile(
      path.join(SESSIONS_DIR, `${sessionId}.json`),
      "utf-8"
    );
    const session = JSON.parse(data);
    console.log("[Service] Number of events in replay:", session.events.length);
    console.log(
      "[Service] Event types:",
      session.events.map((e) => e.type)
    );

    // Check if recording exists
    const recordingPath = path.join(
      __dirname,
      "../../data/recordings",
      `${sessionId}.webm`
    );
    session.hasRecording = await fs
      .access(recordingPath)
      .then(() => true)
      .catch(() => false);

    console.log("[Service] Replay data loaded successfully");
    return session;
  },

  async getReplayVideo(sessionId) {
    console.log("[Service] Generating video for session:", sessionId);
    const videoPath = path.join(VIDEOS_DIR, `${sessionId}.mp4`);

    // Generate video if it doesn't exist
    if (!(await fs.access(videoPath).catch(() => false))) {
      console.log("[Service] Video not found, generating new video");
      const session = await this.getReplay(sessionId);
      await videoGenerator.generateVideo(session, videoPath);
      console.log("[Service] Video generated successfully:", videoPath);
    } else {
      console.log("[Service] Using existing video:", videoPath);
    }

    return `/videos/${sessionId}.mp4`;
  },

  async getRecording(sessionId) {
    const recordingPath = path.join(
      __dirname,
      "../../data/recordings",
      `${sessionId}.webm`
    );
    if (await fs.access(recordingPath).catch(() => false)) {
      return `/recordings/${sessionId}.webm`;
    }
    throw new Error("Recording not found");
  },
};

export default replayService;

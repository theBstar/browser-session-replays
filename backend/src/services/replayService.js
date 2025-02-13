import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import videoService from "./videoService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReplayService {
  constructor() {
    this.sessionsDir = path.join(__dirname, "../../data/sessions");
    this.videoDir = path.join(__dirname, "../../data/videos");
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.videoDir, { recursive: true });
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getReplay(sessionId) {
    // Try both .json and .bak files
    const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
    const backupPath = path.join(this.sessionsDir, `${sessionId}.json.bak`);

    try {
      // Try main file first
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      try {
        // Try backup file if main file fails
        const backupData = await fs.readFile(backupPath, "utf8");
        const data = JSON.parse(backupData);

        // Restore from backup if valid
        await fs.writeFile(filePath, backupData);
        console.log("[Replay] Restored session from backup");

        return data;
      } catch (backupError) {
        console.error("[Replay] Error reading session file:", error);
        console.error("[Replay] Backup also failed:", backupError);
        throw new Error("Session not found");
      }
    }
  }

  async listReplays() {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const replays = await Promise.all(
        files
          .filter(
            (file) =>
              file.endsWith(".json") &&
              !file.endsWith(".tmp") &&
              !file.endsWith(".bak")
          )
          .map(async (file) => {
            try {
              const data = await fs.readFile(
                path.join(this.sessionsDir, file),
                "utf8"
              );
              const session = JSON.parse(data);
              return {
                id: session.sessionId,
                url: session.metadata?.url,
                timestamp: session.metadata?.timestamp,
                userAgent: session.metadata?.userAgent,
                status: session.metadata?.status || "unknown",
                lastUpdated: session.metadata?.lastUpdated,
                recordedAt: session.metadata?.recordedAt,
                eventCount: session.events?.length || 0,
              };
            } catch (error) {
              console.error(`[Replay] Error processing file ${file}:`, error);
              return null;
            }
          })
      );

      return replays.filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("[Replay] Error listing replays:", error);
      return [];
    }
  }

  async getReplayVideo(sessionId) {
    console.log("[Service] Generating video for session:", sessionId);
    const videoPath = path.join(this.videoDir, `${sessionId}.mp4`);

    // Generate video if it doesn't exist
    if (!(await this.fileExists(videoPath))) {
      console.log("[Service] Video not found, generating new video");
      const session = await this.getReplay(sessionId);
      await videoService.generateVideo(session, videoPath);
      console.log("[Service] Video generated successfully:", videoPath);
    } else {
      console.log("[Service] Using existing video:", videoPath);
    }

    return `/videos/${sessionId}.mp4`;
  }

  async getRecording(sessionId) {
    const recordingPath = path.join(
      __dirname,
      "../../data/recordings",
      `${sessionId}.webm`
    );
    if (await this.fileExists(recordingPath)) {
      return `/recordings/${sessionId}.webm`;
    }
    throw new Error("Recording not found");
  }
}

export default new ReplayService();

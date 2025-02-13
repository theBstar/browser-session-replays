import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import videoService from "./videoService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, "../../data/sessions");
const BASE_URL = process.env.BASE_URL || "http://localhost:3100";

class SessionService {
  constructor() {
    this.videoDir = path.join(__dirname, "../../data/videos");
    this.thumbnailDir = path.join(__dirname, "../../data/thumbnails");
    this.videoService = videoService;
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    await fs.mkdir(this.videoDir, { recursive: true });
    await fs.mkdir(this.thumbnailDir, { recursive: true });

    // Set proper permissions for video directory
    try {
      await fs.chmod(this.videoDir, 0o755);
    } catch (error) {
      console.warn(
        "[Service] Could not set video directory permissions:",
        error
      );
    }
  }

  generateSessionId(metadata) {
    // Enterprise-grade session ID generation
    const hash = crypto.createHash("sha256");
    hash.update(
      JSON.stringify({
        timestamp: metadata.timestamp,
        userAgent: metadata.userAgent,
        random: crypto.randomBytes(16),
      })
    );
    return hash.digest("hex").substring(0, 32);
  }

  async saveSession(sessionId, events, metadata) {
    console.log("[Service] Saving session to:", SESSIONS_DIR);

    // Validate session data
    if (!this.#validateSessionData(events, metadata)) {
      throw new Error("Invalid session data");
    }

    let existingData;
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);

    try {
      // Try to read existing session data
      const existingContent = await fs.readFile(filePath, "utf-8");
      existingData = JSON.parse(existingContent);
    } catch (error) {
      // If file doesn't exist, create new session data
      existingData = {
        sessionId,
        events: [],
        metadata: {
          ...metadata,
          recordedAt: Date.now(),
          version: "1.0.0",
          status: "recording",
        },
      };
    }

    // Append new events to existing events
    existingData.events.push(...events);

    // Update metadata with latest values
    existingData.metadata = {
      ...existingData.metadata,
      ...metadata,
      lastUpdated: Date.now(),
      status: metadata.isComplete ? "complete" : "recording",
    };

    await this.#writeSessionFile(filePath, existingData);
    return sessionId;
  }

  #validateSessionData(events, metadata) {
    // Enterprise-grade validation
    if (!Array.isArray(events)) return false;
    if (!metadata) return false;
    return true;
  }

  async #writeSessionFile(filePath, data) {
    // Atomic write with backup
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    try {
      // Write to temp file first
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));

      // Backup existing file if it exists
      try {
        await fs.rename(filePath, backupPath);
      } catch (e) {
        // No existing file to backup
      }

      // Move temp file to actual file
      await fs.rename(tempPath, filePath);

      // Remove backup file on successful write
      try {
        await fs.unlink(backupPath);
      } catch (e) {
        // No backup to remove
      }
    } catch (error) {
      // On error, try to restore from backup
      try {
        if (await this.fileExists(backupPath)) {
          await fs.rename(backupPath, filePath);
        }
      } catch (e) {
        console.error("[Service] Failed to restore from backup:", e);
      }
      // Cleanup temp file
      try {
        await fs.unlink(tempPath);
      } catch (e) {}
      throw error;
    }
  }

  async listRecordings() {
    const sessionDir = path.join(__dirname, "../../data/sessions");
    const files = await fs.readdir(sessionDir);

    const recordings = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const sessionId = file.replace(".json", "");
          const filePath = path.join(sessionDir, file);
          const sessionData = JSON.parse(await fs.readFile(filePath, "utf8"));

          return {
            id: sessionId,
            startTime: sessionData.startTime,
            duration: sessionData.duration,
            url: sessionData.url,
            thumbnailUrl: `${BASE_URL}/api/sessions/${sessionId}/thumbnail`,
            videoUrl: `${BASE_URL}/api/sessions/${sessionId}/video`,
          };
        })
    );

    return recordings.sort((a, b) => b.startTime - a.startTime);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getReplayDetails(sessionId) {
    console.log("[Service] Getting replay details for session:", sessionId);

    const sessionFile = path.join(
      __dirname,
      `../../data/sessions/${sessionId}.json`
    );

    if (!(await this.fileExists(sessionFile))) {
      throw new Error("Session not found");
    }

    console.log("[Service] Reading session file:", sessionFile);
    const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf8"));
    console.log("[Service] Session data:", sessionData);

    // Generate video if it doesn't exist
    const videoPath = path.join(this.videoDir, `${sessionId}.mp4`);
    console.log("[Service] Checking video path:", videoPath);

    if (!(await this.fileExists(videoPath))) {
      console.log("[Service] Video doesn't exist, generating...");
      await this.videoService.generateVideo(sessionData, videoPath);
    }

    // Return only the required fields
    const response = {
      sessionId,
      metadata: {
        url: sessionData.metadata?.url,
        userAgent: sessionData.metadata?.userAgent,
        timestamp: sessionData.metadata?.timestamp,
        recordedAt: sessionData.metadata?.recordedAt,
        lastUpdated: sessionData.metadata?.lastUpdated,
      },
      video_url: `${BASE_URL}/api/sessions/${sessionId}/video`,
    };

    console.log("[Service] Returning response:", response);
    return response;
  }

  async getRecordingVideo(sessionId) {
    const sessionFile = path.join(
      __dirname,
      `../../data/sessions/${sessionId}.json`
    );

    if (!(await this.fileExists(sessionFile))) {
      throw new Error("Session not found");
    }

    const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf8"));
    const videoPath = path.join(this.videoDir, `${sessionId}.mp4`);

    // Generate video if it doesn't exist
    if (!(await this.fileExists(videoPath))) {
      await this.videoService.generateVideo(sessionData, videoPath);
    }

    return videoPath;
  }

  async getThumbnail(sessionId) {
    const sessionFile = path.join(
      __dirname,
      `../../data/sessions/${sessionId}.json`
    );

    if (!(await this.fileExists(sessionFile))) {
      throw new Error("Session not found");
    }

    const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf8"));
    const thumbnailPath = await this.videoService.generateThumbnail(
      sessionData.events[0]
    );

    return thumbnailPath;
  }

  async listVideos() {
    const sessionDir = path.join(__dirname, "../../data/sessions");
    const files = await fs.readdir(sessionDir);

    const videos = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const sessionId = file.replace(".json", "");
          const filePath = path.join(sessionDir, file);
          const sessionData = JSON.parse(await fs.readFile(filePath, "utf8"));
          const videoPath = path.join(this.videoDir, `${sessionId}.mp4`);
          const hasVideo = await this.fileExists(videoPath);

          if (!hasVideo) {
            return null; // Skip sessions without videos
          }

          return {
            sessionId,
            metadata: {
              url: sessionData.metadata?.url,
              userAgent: sessionData.metadata?.userAgent,
              timestamp: sessionData.metadata?.timestamp,
              recordedAt: sessionData.metadata?.recordedAt,
              lastUpdated: sessionData.metadata?.lastUpdated,
            },
            video_url: `${BASE_URL}/static/videos/${sessionId}.mp4`,
          };
        })
    );

    return videos
      .filter(Boolean)
      .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  async getVideoDetails(sessionId) {
    const sessionFile = path.join(
      __dirname,
      `../../data/sessions/${sessionId}.json`
    );

    if (!(await this.fileExists(sessionFile))) {
      throw new Error("Session not found");
    }

    const sessionData = JSON.parse(await fs.readFile(sessionFile, "utf8"));

    // Validate session data
    if (!sessionData.events || !Array.isArray(sessionData.events)) {
      console.error("[Service] Invalid session data:", sessionData);
      throw new Error("Invalid session data: events array missing or invalid");
    }

    if (sessionData.events.length === 0) {
      throw new Error("No events found in session");
    }

    console.log("[Service] Number of events:", sessionData.events.length);
    console.log(
      "[Service] First event:",
      JSON.stringify(sessionData.events[0], null, 2)
    );

    // Generate video if it doesn't exist
    const videoPath = path.join(this.videoDir, `${sessionId}.mp4`);
    if (!(await this.fileExists(videoPath))) {
      await this.videoService.generateVideo(sessionData, videoPath);
    }

    return {
      sessionId,
      metadata: {
        url: sessionData.metadata?.url,
        userAgent: sessionData.metadata?.userAgent,
        timestamp: sessionData.metadata?.timestamp,
        recordedAt: sessionData.metadata?.recordedAt,
        lastUpdated: sessionData.metadata?.lastUpdated,
      },
      video_url: `${BASE_URL}/static/videos/${sessionId}.mp4`,
    };
  }
}

export default new SessionService();

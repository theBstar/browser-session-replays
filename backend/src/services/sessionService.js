import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSIONS_DIR = path.join(__dirname, "../../data/sessions");

class SessionService {
  constructor() {
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
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
    };

    await this.#writeSessionFile(filePath, existingData);
  }

  #validateSessionData(events, metadata) {
    // Enterprise-grade validation
    if (!Array.isArray(events)) return false;
    if (!metadata?.timestamp) return false;
    if (!metadata?.userAgent) return false;
    if (!metadata?.url) return false;
    return true;
  }

  async #writeSessionFile(filePath, data) {
    // Atomic write with backup
    const tempPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;

    try {
      // Write to temp file first
      await fs.writeFile(tempPath, JSON.stringify(data));

      // Backup existing file if it exists
      try {
        await fs.rename(filePath, backupPath);
      } catch (e) {
        // No existing file to backup
      }

      // Move temp file to actual file
      await fs.rename(tempPath, filePath);

      // Remove backup file
      try {
        await fs.unlink(backupPath);
      } catch (e) {
        // No backup to remove
      }
    } catch (error) {
      // Cleanup on error
      try {
        await fs.unlink(tempPath);
      } catch (e) {}
      throw error;
    }
  }
}

export default new SessionService();

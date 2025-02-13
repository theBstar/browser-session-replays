import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/chromium";

export class VideoService {
  constructor() {
    this.videoDir = path.join(__dirname, "../../data/videos");
    this.thumbnailDir = path.join(__dirname, "../../data/thumbnails");
    this.tempDir = path.join(this.videoDir, "temp");
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.promises.mkdir(this.videoDir, { recursive: true });
    await fs.promises.mkdir(this.thumbnailDir, { recursive: true });
    await fs.promises.mkdir(this.tempDir, { recursive: true });
  }

  async cleanupTempFiles() {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      await Promise.all(
        files.map((file) =>
          fs.promises.unlink(path.join(this.tempDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      console.warn("[Video] Error cleaning temp files:", error);
    }
  }

  async generateVideo(sessionData, outputPath) {
    console.log("[Video] Starting video generation");

    try {
      await this.cleanupTempFiles();

      // Create a temporary events file
      const eventsFile = path.join(this.tempDir, `${Date.now()}.json`);
      await fs.promises.writeFile(
        eventsFile,
        JSON.stringify(sessionData.events)
      );

      // Use rrvideo CLI with explicit chrome path and environment variables
      const command = [
        "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium",
        "CHROME_BIN=/usr/bin/chromium",
        "CHROME_PATH=/usr/bin/chromium",
        `rrvideo`,
        `--input ${eventsFile}`,
        `--output ${outputPath}`,
        `--width 1920`,
        `--height 1080`,
        `--no-optimize`,
        `--browser-executable-path /usr/bin/chromium`,
      ].join(" ");

      console.log("[Video] Running command:", command);

      const { stdout, stderr } = await execAsync(command);
      console.log("[Video] stdout:", stdout);
      if (stderr) console.error("[Video] stderr:", stderr);

      // Cleanup events file
      await fs.promises.unlink(eventsFile);

      // Verify video was created
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error("Generated video file is empty");
      }

      console.log("[Video] Video generation completed:", outputPath);
      return outputPath;
    } catch (error) {
      console.error("[Video] Error generating video:", error);
      throw error;
    }
  }

  async generateThumbnail(firstEvent) {
    const thumbnailPath = path.join(this.thumbnailDir, `${Date.now()}.png`);

    try {
      await this.cleanupTempFiles();

      // Create a temporary events file with just the first event
      const eventsFile = path.join(this.tempDir, `${Date.now()}-thumb.json`);
      await fs.promises.writeFile(eventsFile, JSON.stringify([firstEvent]));

      // Use rrvideo to generate a single frame with explicit chrome path
      const tempVideoPath = path.join(this.tempDir, `${Date.now()}-thumb.webm`);

      // Generate a very short video
      const command = [
        "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium",
        "CHROME_BIN=/usr/bin/chromium",
        "CHROME_PATH=/usr/bin/chromium",
        `rrvideo`,
        `--input ${eventsFile}`,
        `--output ${tempVideoPath}`,
        `--width 1920`,
        `--height 1080`,
        `--no-optimize`,
        `--duration 1`,
        `--browser-executable-path /usr/bin/chromium`,
      ].join(" ");

      await execAsync(command);

      // Extract first frame using ffmpeg
      await execAsync(`ffmpeg -i ${tempVideoPath} -vframes 1 ${thumbnailPath}`);

      // Cleanup temporary files
      await fs.promises.unlink(eventsFile);
      await fs.promises.unlink(tempVideoPath);

      return thumbnailPath;
    } catch (error) {
      console.error("[Video] Error generating thumbnail:", error);
      throw error;
    }
  }
}

export default new VideoService();

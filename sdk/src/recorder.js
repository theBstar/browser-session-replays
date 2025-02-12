import EventCollector from "./events.js";

class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 10 },
        audio: false,
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
        videoBitsPerSecond: 1000000, // 1 Mbps
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(2000); // Capture every second
    } catch (error) {
      console.error("[SessionReplay] Screen recording failed:", error);
    }
  }

  stop() {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
      const tracks = this.mediaRecorder.stream.getTracks();
      tracks.forEach((track) => track.stop());
    }
  }

  getRecording() {
    return new Blob(this.recordedChunks, { type: "video/webm" });
  }
}

class SessionRecorder {
  constructor(config) {
    console.log("[SessionReplay] Initializing recorder...");
    this.config = {
      apiEndpoint: config.apiEndpoint,
      sessionId: Math.random().toString(36).substring(7),
      ...config,
    };
    console.log("[SessionReplay] Session ID:", this.config.sessionId);
    this.eventCollector = new EventCollector();
    this.screenRecorder = new ScreenRecorder();
  }

  async start() {
    console.log("[SessionReplay] Starting recording...");
    this.eventCollector.setupListeners();
    await this.screenRecorder.start();
    this.startUploadInterval();
  }

  stop() {
    console.log("[SessionReplay] Stopping recording...");
    clearInterval(this.uploadInterval);
    this.eventCollector.stop();
    this.screenRecorder.stop();
    this.uploadEvents();
    this.uploadRecording();
  }

  startUploadInterval() {
    // Upload events every 5 seconds
    this.uploadInterval = setInterval(() => {
      this.uploadEvents();
    }, 5000);
  }

  async uploadEvents() {
    if (this.eventCollector.events.length === 0) return;

    console.log(
      "[SessionReplay] Uploading events:",
      this.eventCollector.events.length
    );
    const events = [...this.eventCollector.events];
    this.eventCollector.events = [];

    try {
      await fetch(`${this.config.apiEndpoint}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          events,
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
            url: window.location.href,
          },
        }),
      });
      console.log("[SessionReplay] Events uploaded successfully");
    } catch (error) {
      console.error("[SessionReplay] Failed to upload session events:", error);
    }
  }

  async uploadRecording() {
    const recording = this.screenRecorder.getRecording();
    if (recording.size === 0) return;

    const formData = new FormData();
    formData.append("recording", recording, `${this.config.sessionId}.webm`);

    try {
      await fetch(
        `${this.config.apiEndpoint}/sessions/${this.config.sessionId}/recording`,
        {
          method: "POST",
          body: formData,
        }
      );
      console.log("[SessionReplay] Recording uploaded successfully");
    } catch (error) {
      console.error("[SessionReplay] Failed to upload recording:", error);
    }
  }
}

export default SessionRecorder;

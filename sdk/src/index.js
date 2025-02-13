import * as rrweb from "rrweb";

class SessionReplay {
  constructor(options = {}) {
    this.options = {
      endpoint: options.endpoint || "http://localhost:3100",
      batchSize: options.batchSize || 50,
      flushInterval: options.flushInterval || 5000,
      ...options,
    };

    this.events = [];
    this.isRecording = false;
    this.sessionId = null;
    this.lastFlush = Date.now();
    this.stopFn = null;

    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);

    // Setup event listeners
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  start() {
    if (this.isRecording) return;

    const metadata = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    // Generate session ID from server
    fetch(`${this.options.endpoint}/api/sessions/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        this.sessionId = data.sessionId;
        this.startRecording();
      })
      .catch((error) => {
        console.error("[SessionReplay] Failed to start session:", error);
        setTimeout(() => this.start(), 5000);
      });
  }

  startRecording() {
    this.isRecording = true;
    this.stopFn = rrweb.record({
      emit: (event) => {
        this.events.push(event);
        if (this.events.length >= this.options.batchSize) {
          this.flush();
        }
      },
      recordCanvas: true,
      collectFonts: true,
    });

    // Start flush interval
    this.flushInterval = setInterval(() => {
      if (Date.now() - this.lastFlush >= this.options.flushInterval) {
        this.flush();
      }
    }, this.options.flushInterval);
  }

  async flush(isComplete = false) {
    if (!this.events.length || !this.sessionId) return;

    const eventsToSend = [...this.events];
    this.events = [];
    this.lastFlush = Date.now();

    const metadata = {
      url: window.location.href,
      timestamp: Date.now(),
      isComplete,
    };

    try {
      await fetch(`${this.options.endpoint}/api/sessions/${this.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: eventsToSend,
          metadata,
        }),
      });
    } catch (error) {
      console.error("[SessionReplay] Failed to send events:", error);
      // Put events back in queue
      this.events.unshift(...eventsToSend);
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      // Tab is hidden, pause recording and save intermediate state
      if (this.stopFn) {
        this.stopFn();
        this.stopFn = null;
      }
      this.flush(false);
    } else {
      // Tab is visible again, resume recording
      if (this.isRecording) {
        this.startRecording();
      }
    }
  }

  async handleBeforeUnload() {
    // Stop recording
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }

    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Send remaining events with isComplete flag
    await this.flush(true);
  }

  stop() {
    this.isRecording = false;
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(true);

    // Remove event listeners
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }
}

// Export as global and module
if (typeof window !== "undefined") {
  window.SessionReplay = SessionReplay;
}

export default SessionReplay;

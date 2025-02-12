import { record } from "rrweb";

const SessionReplay = {
  init: (config) => {
    console.log("[SessionReplay] Initializing enterprise recorder...");
    if (typeof window === "undefined") return;

    // Enterprise-grade session ID generation
    const sessionId = crypto.randomUUID();
    console.log("[SessionReplay] Session ID:", sessionId);

    let events = [];
    let isRecording = true;
    let lastFlush = Date.now();

    // Enterprise-grade event buffering and batching
    const sendEvents = async () => {
      if (events.length === 0) return;

      const eventsToSend = [...events];
      console.log(
        "[SessionReplay] Event types:",
        eventsToSend.map((e) => e.type)
      );
      console.log("[SessionReplay] First event:", eventsToSend[0]);
      events = []; // Clear buffer after copying

      try {
        console.log(
          `[SessionReplay] Sending batch of ${eventsToSend.length} events`
        );
        const response = await fetch(`${config.apiEndpoint}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": sessionId,
          },
          body: JSON.stringify({
            sessionId,
            events: eventsToSend,
            metadata: {
              userAgent: navigator.userAgent,
              timestamp: Date.now(),
              url: window.location.href,
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth,
              screenHeight: window.screen.height,
              screenWidth: window.screen.width,
              devicePixelRatio: window.devicePixelRatio,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        lastFlush = Date.now();
        console.log("[SessionReplay] Events sent successfully");
      } catch (error) {
        console.error("[SessionReplay] Error sending events:", error);
        // Re-add events to buffer if send fails
        events.unshift(...eventsToSend);
      }
    };

    // Enterprise-grade recording configuration
    const stopFn = record({
      emit(event) {
        if (!isRecording) return;
        events.push(event);
      },
      sampling: {
        mousemove: 20, // Capture more mouse movements
        scroll: 50, // Capture more scrolls
        input: 100, // Capture more inputs
      },
      // Take snapshots even during idle time
      checkoutEveryNth: 1,
      checkoutEveryNms: 1000, // Capture a frame every second regardless of activity
      inlineStylesheet: true,
      recordCanvas: true,
      recordCrossOriginIframes: true,
      // Ensure we capture the full page state
      ignoreCSSAttributes: [], // Don't ignore any CSS
      collectFonts: true, // Capture all fonts
    });

    // Regular intervals for sending events, even during idle time
    const flushInterval = setInterval(() => {
      if (isRecording) {
        // Force a new snapshot before sending
        events.push({
          type: "snapshot",
          timestamp: Date.now(),
          data: {
            // This will trigger a full page snapshot
            has_dom: true,
            timestamp: Date.now(),
          },
        });
        sendEvents();
      }
    }, 1000); // Send events every second

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        sendEvents(); // Flush events when page is hidden
      }
    });

    // Handle page unload
    window.addEventListener("beforeunload", () => {
      if (isRecording) {
        sendEvents(); // Final flush
      }
    });

    // Error handling
    window.addEventListener("error", (error) => {
      console.error("[SessionReplay] Runtime error:", error);
      // Attempt to save events on error
      if (events.length > 0) {
        sendEvents();
      }
    });

    return {
      stop() {
        isRecording = false;
        clearInterval(flushInterval);
        stopFn();
        return sendEvents(); // Final flush
      },

      pause() {
        isRecording = false;
      },

      resume() {
        isRecording = true;
      },

      flush() {
        return sendEvents();
      },

      getSessionId() {
        return sessionId;
      },

      getStatus() {
        return {
          isRecording,
          bufferedEvents: events.length,
          lastFlushTime: lastFlush,
          sessionId,
        };
      },

      // Enterprise features
      setCustomData(key, value) {
        events.push({
          type: "custom",
          data: { key, value },
          timestamp: Date.now(),
        });
      },

      addPrivacyRule(selector) {
        if (typeof selector === "string") {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => el.classList.add("mask-text"));
        }
      },
    };
  },
};

if (typeof window !== "undefined") {
  window.SessionReplay = SessionReplay;
}

export default SessionReplay;

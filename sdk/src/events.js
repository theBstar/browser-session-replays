const EVENT_TYPES = {
  MOUSE_MOVE: "mousemove",
  MOUSE_CLICK: "click",
  SCROLL: "scroll",
  INPUT: "input",
  VIEWPORT_RESIZE: "resize",
  DOM_MUTATION: "mutation",
  NETWORK: "network",
  CONSOLE: "console",
  ERROR: "error",
};

class EventCollector {
  constructor() {
    this.events = [];
    this.startTime = Date.now();
    this.mutationObserver = null;
  }

  captureEvent(type, data) {
    this.events.push({
      type,
      timestamp: Date.now() - this.startTime,
      data,
    });
  }

  setupListeners() {
    // Mouse movements
    document.addEventListener(EVENT_TYPES.MOUSE_MOVE, (e) => {
      this.captureEvent(EVENT_TYPES.MOUSE_MOVE, {
        x: e.clientX,
        y: e.clientY,
      });
    });

    // Clicks
    document.addEventListener(EVENT_TYPES.MOUSE_CLICK, (e) => {
      this.captureEvent(EVENT_TYPES.MOUSE_CLICK, {
        x: e.clientX,
        y: e.clientY,
        target: e.target.tagName,
      });
    });

    // Scrolls
    document.addEventListener(EVENT_TYPES.SCROLL, (e) => {
      this.captureEvent(EVENT_TYPES.SCROLL, {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
    });

    // Input changes
    document.addEventListener(EVENT_TYPES.INPUT, (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        this.captureEvent(EVENT_TYPES.INPUT, {
          value: e.target.value,
          id: e.target.id,
        });
      }
    });

    // Viewport changes
    window.addEventListener(EVENT_TYPES.VIEWPORT_RESIZE, () => {
      this.captureEvent(EVENT_TYPES.VIEWPORT_RESIZE, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });

    // Console logs
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    ["log", "error", "warn"].forEach((method) => {
      console[method] = (...args) => {
        this.captureEvent(EVENT_TYPES.CONSOLE, {
          type: method,
          message: args.map((arg) => String(arg)).join(" "),
        });
        originalConsole[method].apply(console, args);
      };
    });

    // JS Errors
    window.addEventListener("error", (e) => {
      this.captureEvent(EVENT_TYPES.ERROR, {
        message: e.message,
        stack: e.error?.stack,
        source: e.filename,
        line: e.lineno,
        column: e.colno,
      });
    });

    // Network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch.apply(window, args);
        this.captureEvent(EVENT_TYPES.NETWORK, {
          url: args[0],
          method: args[1]?.method || "GET",
          status: response.status,
          duration: performance.now() - startTime,
        });
        return response;
      } catch (error) {
        this.captureEvent(EVENT_TYPES.NETWORK, {
          url: args[0],
          method: args[1]?.method || "GET",
          error: error.message,
          duration: performance.now() - startTime,
        });
        throw error;
      }
    };

    // DOM mutations
    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "childList" ||
          mutation.type === "characterData"
        ) {
          this.captureEvent(EVENT_TYPES.DOM_MUTATION, {
            type: mutation.type,
            target: mutation.target.nodeName,
            addedNodes: Array.from(mutation.addedNodes).map((n) => n.nodeName),
            removedNodes: Array.from(mutation.removedNodes).map(
              (n) => n.nodeName
            ),
          });
        }
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  stop() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }
}

export default EventCollector;

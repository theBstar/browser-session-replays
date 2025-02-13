import replayService from "../services/replayService.js";

export default {
  async listReplays(req, res) {
    try {
      const replays = await replayService.listReplays();
      res.json(replays);
    } catch (error) {
      console.error("[API] Error listing replays:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getReplay(req, res) {
    try {
      const replay = await replayService.getReplay(req.params.id);
      res.json(replay);
    } catch (error) {
      console.error("[API] Error getting replay:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getReplayHtml(req, res) {
    const sessionId = req.params.id;
    const html = /* html */ `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Session Replay</title>
          <link 
            rel="stylesheet" 
            href="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/style.css"
          />
          <script src="https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js"></script>
          <style>
            body { margin: 0; }
            #player {
              width: 100vw;
              height: 100vh;
            }
          </style>
        </head>
        <body>
          <div id="player"></div>
          <script>
            async function loadReplay() {
              const response = await fetch('/api/replays/${sessionId}');
              const data = await response.json();
              
              if (!data.events || data.events.length < 2) {
                document.getElementById('player').innerHTML = 
                  '<div style="padding: 20px; text-align: center;">' +
                  '<h2>Not enough events recorded</h2>' +
                  '<p>This session has ' + (data.events?.length || 0) + ' events. ' +
                  'At least 2 events are needed for replay.</p>' +
                  '</div>';
                return;
              }

              const replayer = new rrwebPlayer({
                target: document.getElementById('player'),
                props: {
                  events: data.events,
                  autoPlay: true,
                  showController: true,
                  skipInactive: true,
                  triggerFocus: false,
                  showDebug: true,
                  speedOption: [0.5, 1, 2, 4, 8],
                  showTimeline: true,
                  loop: false,
                  mouseTail: {
                    duration: 500,
                    lineCap: "round",
                    lineWidth: 2,
                    strokeStyle: "red",
                  },
                  bufferLength: 50,
                  useVirtualDom: true,
                }
              });
              
              // Responsive replay
              window.addEventListener('resize', () => {
                replayer.updateSize(window.innerWidth, window.innerHeight);
              });
            }
            loadReplay();
          </script>
        </body>
      </html>
    `;
    res.send(html);
  },

  async getListHtml(req, res) {
    try {
      const replays = await replayService.listReplays();
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Session Replays</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 2em; }
              .replay-list { list-style: none; padding: 0; }
              .replay-item { 
                border: 1px solid #ddd; 
                margin: 1em 0; 
                padding: 1em;
                border-radius: 4px;
              }
              .replay-item:hover { background: #f5f5f5; }
              .replay-meta { color: #666; font-size: 0.9em; }
              .status-recording { color: #2196F3; }
              .status-complete { color: #4CAF50; }
            </style>
          </head>
          <body>
            <h1>Session Replays</h1>
            <ul class="replay-list">
              ${replays
                .map(
                  (replay) => `
                <li class="replay-item">
                  <h3>
                    <a href="/replays/${replay.id}">
                      Session: ${replay.id}
                    </a>
                    <span class="status-${replay.status}">[${
                    replay.status
                  }]</span>
                  </h3>
                  <div class="replay-meta">
                    <div>URL: ${replay.url}</div>
                    <div>Started: ${new Date(
                      replay.recordedAt
                    ).toLocaleString()}</div>
                    <div>Last Updated: ${new Date(
                      replay.lastUpdated
                    ).toLocaleString()}</div>
                    <div>Events: ${replay.eventCount}</div>
                  </div>
                </li>
              `
                )
                .join("")}
            </ul>
          </body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      console.error("[API] Error getting replay list:", error);
      res.status(500).send("Error loading replays");
    }
  },
};

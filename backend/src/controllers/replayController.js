import replayService from "../services/replayService.js";

const replayController = {
  async listReplays(req, res) {
    try {
      const replays = await replayService.listReplays();
      res.json(replays);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getReplay(req, res) {
    try {
      const replay = await replayService.getReplay(req.params.id);
      res.json(replay);
    } catch (error) {
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
                  skipInactive: false,
                  showDebug: true,
                  speedOption: [0.5, 1, 2, 4, 8],
                  showTimeline: true,
                  loop: false,
                  mouseTail: {
                    duration: 1000,
                    lineCap: "round",
                    lineWidth: 3,
                    strokeStyle: "red",
                  },
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
    const html = /* html */ `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Session Replays</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .session-list { max-width: 800px; margin: 0 auto; }
            .session-item {
              padding: 15px;
              border: 1px solid #ddd;
              margin: 10px 0;
              border-radius: 4px;
              cursor: pointer;
            }
            .session-item:hover {
              background-color: #f5f5f5;
            }
          </style>
        </head>
        <body>
          <div class="session-list" id="sessions"></div>
          <script>
            async function loadSessions() {
              const response = await fetch('/api/replays');
              const sessions = await response.json();
              
              const sessionsDiv = document.getElementById('sessions');
              sessions.forEach(session => {
                const div = document.createElement('div');
                div.className = 'session-item';
                div.innerHTML = 
                  '<strong>Session:</strong> ' + session.sessionId + '<br>' +
                  '<strong>URL:</strong> ' + session.url + '<br>' +
                  '<strong>Time:</strong> ' + new Date(session.timestamp).toLocaleString();
                div.onclick = () => window.location.href = '/replays/' + session.sessionId;
                sessionsDiv.appendChild(div);
              });
            }
            loadSessions();
          </script>
        </body>
      </html>
    `;
    res.send(html);
  },
};

export default replayController;

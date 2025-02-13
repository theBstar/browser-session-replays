import sessionService from "../services/sessionService.js";

const sessionController = {
  async saveSession(req, res) {
    try {
      const { sessionId, events, metadata } = req.body;
      await sessionService.saveSession(sessionId, events, metadata);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export async function createSession(req, res) {
  try {
    const metadata = req.body;
    const sessionId = sessionService.generateSessionId(metadata);

    // Initialize empty session
    await sessionService.saveSession(sessionId, [], metadata);

    res.json({ sessionId });
  } catch (error) {
    console.error("[API] Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
}

export async function updateSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { events, metadata } = req.body;

    await sessionService.saveSession(sessionId, events, metadata);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating session:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
}

export default sessionController;

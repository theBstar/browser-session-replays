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

export default sessionController;

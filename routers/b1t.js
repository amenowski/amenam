const express = require("express");
const router = express.Router();

router.get("/battle-modal", async (req, res) => {
  try {
    const mode = req.query.mode || "2v2";
    const LobbyManager = require("../modules/LobbyManager");

    // Create a new lobby or get existing one
    let lobbyId = req.query.lobbyId;
    let lobby;

    if (lobbyId) {
      lobby = LobbyManager.getLobby(lobbyId);
    }

    if (!lobby) {
      lobbyId = LobbyManager.createLobby(mode, req.user);
      lobby = LobbyManager.getLobby(lobbyId);
    }

    const settings = {
      mode: req.query.mode || "2v2",
      region: "Europe",
      queue: "~1 minute",
      status: "Finding a game",
      reward: "1.5 pt",
      if_defeated: "-0.7 pt",
      lobbyId: lobbyId,
    };

    res.render("battle-modal", {
      settings,
      user: req.user,
      lobby: lobby,
      loadingState: false, // Add loading state flag
      gameMode: mode,
    });

    console.log(req.user);
  } catch (error) {
    console.error("Błąd podczas generowania modalu battle:", error);
    res.status(500).send("Wystąpił błąd podczas ładowania modalu");
  }
});

module.exports = router;

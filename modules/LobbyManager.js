class LobbyManager {
  constructor() {
    this.lobbies = new Map(); // Store active lobbies
    this.queue1vs1 = new Map(); // kolejka dla trybu 1vs1
    this.queue2vs2 = new Map(); // kolejka dla trybu 2vs2

    // Clean inactive lobbies every 5 minutes
    setInterval(() => this.logActiveLobbies(), 3000);
  }

  /**
   * Create a new lobby
   * @param {string} mode - Game mode (1v1, 2v2, etc.)
   * @param {Object} creator - User who created the lobby
   * @returns {string} - Lobby ID
   */
  createLobby(mode, creator) {
    const lobbyId = this.generateLobbyId();
    const now = Date.now();

    const lobby = {
      id: lobbyId,
      mode: mode,
      createdAt: now,
      lastActivity: now,
      status: "waiting", // waiting, matchmaking, in_game, completed
      players: [creator],
      maxPlayers: mode === "1v1" ? 1 : 2,
      messages: [],
      settings: {
        region: "Europe",
        queue: "~1 minute",
        reward: "1.5 pt",
        if_defeated: "-0.7 pt",
      },
    };

    this.lobbies.set(lobbyId, lobby);

    return lobbyId;
  }

  removeLobbyById(lobbyId) {
    if (this.lobbies.has(lobbyId)) {
      // Usuń lobby z mapy
      this.lobbies.delete(lobbyId);
      console.log(`Lobby ${lobbyId} zostało usunięte.`);
      return true; // Zwróć true, jeśli lobby zostało usunięte
    }
    console.log(`Lobby ${lobbyId} nie istnieje.`);
    return false; // Zwróć false, jeśli lobby nie istnieje
  }
  getLobby(lobbyId) {
    // Sprawdź, czy lobby istnieje w mapie
    if (this.lobbies.has(lobbyId)) {
      return this.lobbies.get(lobbyId); // Zwróć dane lobby
    }
    return null; // Zwróć null, jeśli lobby nie istnieje
  }
  generateLobbyId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let id;

    do {
      id = "";
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.lobbies.has(id));

    return id;
  }

  logActiveLobbies() {
    console.log("\n=== ACTIVE LOBBIES ===");
    console.log(`Total lobbies: ${this.lobbies.size}`);

    if (this.lobbies.size === 0) {
      console.log("No active lobbies");
      console.log("=====================\n");
      return;
    }

    for (const [lobbyId, lobby] of this.lobbies.entries()) {
      const playerCount = lobby.players.length;
      const playerNames = lobby.players.map((p) => p.nick).join(", ");
      const timeSinceCreation = Math.floor(
        (Date.now() - lobby.createdAt) / 1000 / 60
      );
      const timeSinceActivity = Math.floor(
        (Date.now() - lobby.lastActivity) / 1000 / 60
      );

      console.log(`\nLobby ID: ${lobbyId}`);
      console.log(`Mode: ${lobby.mode}`);
      console.log(`Status: ${lobby.status}`);
      console.log(
        `Players (${playerCount}/${lobby.maxPlayers}): ${playerNames}`
      );
      console.log(`Created: ${timeSinceCreation} minutes ago`);
      console.log(`Last activity: ${timeSinceActivity} minutes ago`);
      console.log(`Messages: ${lobby.messages.length}`);
    }

    console.log("=====================\n");
  }
}

module.exports = new LobbyManager();

const LobbyManager = require("./modules/LobbyManager");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function BubbleHandler(gameServer, socket) {
  this.gameServer = gameServer;
  this.socket = socket;
}

module.exports = BubbleHandler;

BubbleHandler.prototype.handleMessage = function (message) {
  function stobuf(buf) {
    var length = buf.length;
    var arrayBuf = new ArrayBuffer(length);
    var view = new Uint8Array(arrayBuf);
    for (var i = 0; i < length; i++) {
      view[i] = buf[i];
    }
    return view.buffer;
  }

  // Discard empty messages
  if (message.length == 0) {
    return;
  }

  var buffer = stobuf(message);
  var view = new DataView(buffer);
  var packetId = view.getUint8(0, true);
  console.log("Packet ID: " + packetId);
  switch (packetId) {
    case 1:
            console.log("Otrzymano pakiet testowy");
            const testData = view.getUint32(1, true);
            console.log("Dane testowe:", testData);
            
            // Odeślij odpowiedź
            const response = new ArrayBuffer(5);
            const responseView = new DataView(response);
            responseView.setUint8(0, 1);
            responseView.setUint32(1, testData + 1, true);
            this.socket.send(Buffer.from(response)); // Konwertuj ArrayBuffer na Buffer
            break;
    case 2: // Packet ID dla zamknięcia lobby
      console.log("Lobby closed");
      const lobbyIdLength = view.getUint32(2, true); // Odczytaj długość ID lobby
      if (view.byteLength < 6 + lobbyIdLength) {
        // Sprawdź, czy bufor ma wystarczającą długość dla ID lobby
        console.error("Otrzymano nieprawidłowy pakiet do zamknięcia lobby.");
        return; // Zakończ, jeśli pakiet jest za krótki
      }

      let lobbyId = "";
      for (let i = 0; i < lobbyIdLength; i++) {
        lobbyId += String.fromCharCode(view.getUint8(6 + i)); // Odczytaj bajty ID lobby
      }

      LobbyManager.removeLobbyById(lobbyId);

      view.setUint8(0, 2);
      this.socket.send(buffer);
      break;
      // case 3:
      //   console.log("Invite to lobby");
      //   const lobbyIdLengthh = view.getUint32(2, true); // Odczytaj długość ID lobby
      //   let lobbyIdd = "";
      //   for (let i = 0; i < lobbyIdLengthh; i++) {
      //     lobbyIdd += String.fromCharCode(view.getUint8(6 + i)); // Odczytaj bajty ID lobby
      //   }

      //   const friendId = view.getUint32(6 + lobbyIdLengthh, true);

      //   console.log(lobbyIdd, friendId);
      //   // wyslij ten pakiet do tego gracza ktory dostal zaproszneie
      //   const friendSocket = this.gameServer.getPlayerByUserId(friendId);
      //   if (friendSocket) {
      //     view.setUint8(0, 3);
      //     friendSocket.send(buffer);
      //   }

      break;
    default:
      break;
  }
};

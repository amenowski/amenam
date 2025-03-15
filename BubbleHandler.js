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
    // Pobierz i wyślij listę znajomych
    const userId = this.socket.playerTracker?.userInfo?.id;
    if (userId) {
        supabase
            .from('friends')
            .select(`
                *,
                users!friends_user_id_fkey(nick),
                friend:users!friends_friend_id_fkey(nick)
            `)
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
            .not('status', 'eq', 'rejected')
            .then(({ data: friends, error }) => {
                if (error) {
                    console.error('Błąd pobierania znajomych:', error);
                    return;
                }

                if (friends) {
                    const mappedFriends = friends.map(friend => {
                        const friendNick = friend.user_id === userId ? 
                            friend.friend.nick : friend.users.nick;

                        // Sprawdź status w gameServer
                        const clientInfo = this.gameServer.clients.find(c => 
                            c.playerTracker?.name === friendNick
                        );

                        return {
                            i: friend.id,
                            n: friendNick,
                            o: !!clientInfo,
                            s: clientInfo?.playerTracker?.cells?.length > 0 ? 1 : 0,
                            c: JSON.stringify({
                                r: Math.floor(Math.random() * 255),
                                g: Math.floor(Math.random() * 255),
                                b: Math.floor(Math.random() * 255)
                            }),
                            p: 0
                        };
                    });

                    this.socket.send(JSON.stringify({
                        friends: mappedFriends
                    }));
                }
            });
    }
    break;
          // ... existing code ...
case 2: // Packet ID dla zamknięcia lobby
console.log("Lobby closed");
const lobbyIdLengthClose = view.getUint32(2, true);
if (view.byteLength < 6 + lobbyIdLengthClose) {
  console.error("Otrzymano nieprawidłowy pakiet do zamknięcia lobby.");
  return;
}

let lobbyId = "";
for (let i = 0; i < lobbyIdLengthClose; i++) {
  lobbyId += String.fromCharCode(view.getUint8(6 + i));
}

LobbyManager.removeLobbyById(lobbyId);

// Konwertuj ArrayBuffer na Buffer przed wysłaniem
const response = Buffer.from(buffer);
view.setUint8(0, 2);
this.socket.send(response);
break;

case 3:
  console.log("Invite to lobby");
  const lobbyIdLengthInvite = view.getUint32(2, true);
  let lobbyIdInvite = "";
  for (let i = 0; i < lobbyIdLengthInvite; i++) {
    lobbyIdInvite += String.fromCharCode(view.getUint8(6 + i));
  }

  const friendId = view.getUint32(6 + lobbyIdLengthInvite, true);

  console.log("Zaproszenie do lobby:", {lobbyIdInvite, friendId});
  
  // Debug logs
  console.log("GameServer clients count:", this.gameServer.clients.length);
  
  // Znajdź socket zaproszonego gracza
  const friendSocket = this.gameServer.clients.find(client => {
    const userId = client?.playerTracker?.userInfo?.id;
    console.log("Sprawdzam klienta:", {
      userId,
      szukaneId: friendId,
      match: userId === friendId
    });
    
    return userId === friendId;
  });

  if (friendSocket) {
    // Konwertuj ArrayBuffer na Buffer przed wysłaniem
    const response = Buffer.from(buffer);
    view.setUint8(0, 3);
    friendSocket.send(response);
    console.log("Wysłano zaproszenie do:", friendSocket.playerTracker.name);
    
    // Wyślij potwierdzenie do zapraszającego
    const confirmationMsg = new DataView(new ArrayBuffer(2));
    confirmationMsg.setUint8(0, 3); // Ten sam packet ID
    confirmationMsg.setUint8(1, 1); // 1 = zaproszenie wysłane
    this.socket.send(Buffer.from(confirmationMsg.buffer));
  } else {
    console.log("Nie znaleziono gracza o ID:", friendId);
    // Wyślij informację o offline do zapraszającego
    const offlineMsg = new DataView(new ArrayBuffer(2));
    offlineMsg.setUint8(0, 3); // Ten sam packet ID
    offlineMsg.setUint8(1, 0); // 0 = gracz offline
    this.socket.send(Buffer.from(offlineMsg.buffer));
  }
  break;
    default:
      break;
  }
};

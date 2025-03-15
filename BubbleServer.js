const WebSocket = require('ws');
const BubbleHandler = require('./BubbleHandler');
const PlayerTracker = require('./PlayerTracker');


function BubbleServer() {
    this.clients = [];
    this.run = true;
    this.config = {
        serverPort: 81,
        serverMaxConnections: 0, 
        serverMaxConnPerIp: 3
    };
}

BubbleServer.prototype.start = function() {
    this.socketServer = new WebSocket.Server({
        port: this.config.serverPort
    }, function() {
        console.log("[BubbleServer] Uruchomiono na porcie " + this.config.serverPort);
    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    this.socketServer.on('error', function(err) {
        switch (err.code) {
            case "EADDRINUSE":
                console.log("[Error] Port " + this.config.serverPort + " jest już zajęty!");
                break;
            default:
                console.log("[Error] Nieobsługiwany błąd: " + err.code);
                break;
        }
        process.exit(1);
    });
};

function connectionEstablished(ws) {
    if (this.config.serverMaxConnections > 0 && 
        this.clients.length >= this.config.serverMaxConnections) {
        ws.close();
        return;
    }

    if (this.config.serverMaxConnPerIp > 0) {
        var connections = 0;
        for (var i = 0; i < this.clients.length; i++) {
            if (this.clients[i]._socket.remoteAddress == ws._socket.remoteAddress) {
                connections++;
            }
        }
        if (connections >= this.config.serverMaxConnPerIp) {
            ws.close();
            return;
        }
    }

    this.clients.push(ws);
    ws.playerTracker = new PlayerTracker(this, ws);
    ws.bubbleHandler = new BubbleHandler(this, ws);

    ws.on('message', function(message) {
        ws.bubbleHandler.handleMessage(message);
    });

    ws.on('close', function() {
        var index = this.clients.indexOf(ws);
        if (index != -1) {
            this.clients.splice(index, 1);
        }
    }.bind(this));
}

module.exports = BubbleServer;
// Imports
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

var GameMode = require('../gamemodes');
var Packet = require('../packet');
var Entity = require('../entity');
const SessionManager = require('./SessionManager');

function Commands() {
    this.list = { }; // Empty
}

module.exports = Commands;

// Utils
var fillChar = function (data, char, fieldLength, rTL) {
    var result = data.toString();
    if (rTL === true) {
        for (var i = result.length; i < fieldLength; i++)
            result = char.concat(result);
    }
    else {
        for (var i = result.length; i < fieldLength; i++)
            result = result.concat(char);
    }
    return result;
};

var seconds2time = function(seconds) {
    var hours   = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds - (hours * 3600)) / 60);
    var seconds = seconds - (hours * 3600) - (minutes * 60);
    var time = "";

    if (hours != 0) {
      time = hours+":";
    }
    if (minutes != 0 || time !== "") {
      minutes = (minutes < 10 && time !== "") ? "0"+minutes : String(minutes);
      time += minutes+":";
    }
    if (time === "") {
      time = seconds+" seconds";
    }
    else {
      time += (seconds < 10) ? "0"+seconds : String(seconds);
    }
    return time;
};

function extractNickname(split) {
    const fullCommand = split.slice(1).join(" ");
  
    const matches = fullCommand.match(/"([^"]+)"/);
  
    if (matches && matches[1]) {
      return {
        nickname: matches[1],
        remainingArgs: fullCommand
          .substring(matches[0].length)
          .trim()
          .split(" ")
          .filter((arg) => arg !== ""),
      };
    } else {
      return {
        nickname: split[1],
        remainingArgs: split.slice(2),
      };
    }
}

// Helper function to find player by nickname
function findPlayerByNick(gameServer, nickname) {
    for (var i in gameServer.clients) {
        if (gameServer.clients[i].playerTracker.name == nickname) {
            return gameServer.clients[i].playerTracker;
        }
    }
    return null;
}

async function savePlayerColorToDatabase(nick, newColor) {
    try {
        const { data: users, error: queryError } = await supabase
            .from("users")
            .select()
            .eq("nick", nick)
            .single();

        if (queryError) {
            console.error("Error fetching user data:", queryError.message);
            return;
        }

        if (!users) {
            console.error("User not found with nickname:", nick);
            return;
        }

        const { data, error } = await supabase
            .from("users")
            .update({ color: newColor })
            .eq("nick", nick);

        if (error) {
            console.error("\u001B[36mServer: \u001B[31mBłąd aktualizacji koloru:", error.message, "\u001B[0m");
            return;
        }

    } catch (error) {
        console.error("\u001B[36mServer: \u001B[31mBłąd zapisu koloru:", error.message, "\u001B[0m");
    }
}


// Commands
// Commands
Commands.list = {
    help: function(gameServer,split) {
        console.log("========================== HELP ============================");
        console.log("\u001B[36maddbot     \u001B[0m: add one or more bot to the server");
        console.log("\u001B[36mban        \u001B[0m: ban a player with nickname");
        console.log("\u001B[36mbanlist    \u001B[0m: show current ban list");
        console.log("\u001B[36mboard      \u001B[0m: set scoreboard text");
        console.log("\u001B[36mboardreset \u001B[0m: reset scoreboard text");
        console.log("\u001B[36mchange     \u001B[0m: change specified settings");
        console.log("\u001B[36mclear      \u001B[0m: clear console output");
        console.log("\u001B[36mcolor      \u001B[0m: set cell(s) color by nickname");
        console.log("\u001B[36mexit       \u001B[0m: stop the server");
        console.log("\u001B[36mfood       \u001B[0m: spawn food at specified Location");
        console.log("\u001B[36mgamemode   \u001B[0m: change server gamemode");
        console.log("\u001B[36mkick       \u001B[0m: kick player or bot by nickname");
        console.log("\u001B[36mkill       \u001B[0m: kill cell(s) by nickname");
        console.log("\u001B[36mkillall    \u001B[0m: kill everyone");
        console.log("\u001B[36mmass       \u001B[0m: set cell(s) mass by nickname");
        console.log("\u001B[36mmerge      \u001B[0m: force a player to merge");
        console.log("\u001B[36mname       \u001B[0m: change cell(s) name");
        console.log("\u001B[36mplayerlist \u001B[0m: get list of players and bots");
        console.log("\u001B[36mpause      \u001B[0m: pause game , freeze all cells");
        console.log("\u001B[36mreload     \u001B[0m: reload config");
        console.log("\u001B[36msay        \u001B[0m: chat from console");
        console.log("\u001B[36msplit      \u001B[0m: force a player to split");
        console.log("\u001B[36mstatus     \u001B[0m: get server status");
        console.log("\u001B[36mtp         \u001B[0m: teleport player to specified location");
        console.log("\u001B[36munban      \u001B[0m: unban a player with IP");
        console.log("\u001B[36mvirus      \u001B[0m: spawn virus at a specified Location");
        console.log("============================================================");
    },
    
    addbot: function(gameServer,split) {
        var add = parseInt(split[1]);
        if (isNaN(add)) {
            add = 1; // Adds 1 bot if user doesnt specify a number
        }

        for (var i = 0; i < add; i++) {
            gameServer.bots.addBot();
        }
        console.log("\u001B[36mServer: \u001B[0mDodano "+add+" botów");
    },

    ban: function(gameServer,split) {
        const { nickname } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        // Znajdź gracza i jego IP
        let playerIP = null;
        for (var i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker.name == nickname) {
                playerIP = gameServer.clients[i].remoteAddress;
                break;
            }
        }

        if (!playerIP) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        if (gameServer.banned.indexOf(playerIP) == -1) {
            gameServer.banned.push(playerIP);
            console.log("\u001B[36mServer: \u001B[0mZbanowano gracza " + nickname + " (IP: " + playerIP + ")");

            // Wyrzuć gracza
            for (var i in gameServer.clients) {
                var c = gameServer.clients[i];
                if (!c.remoteAddress) continue;
                if (c.remoteAddress == playerIP) {
                    c.sendPacket(new Packet.ServerMsg(91));
                    c.close();
                }
            }
        } else {
            console.log("\u001B[36mServer: \u001B[0mTen IP jest już zbanowany");
        }
    },

    banlist: function(gameServer,split) {
        if ((typeof split[1] != 'undefined') && (split[1].toLowerCase() == "clear")) {
            gameServer.banned = [];
            console.log("\u001B[36mServer: \u001B[0mWyczyszczono listę banów");
            return;
        }

        console.log("\u001B[36mServer: \u001B[0mAktualna lista zbanowanych IP ("+gameServer.banned.length+")");
        for (var i in gameServer.banned) {
            console.log(gameServer.banned[i]);
        }
    },

    board: function(gameServer,split) {
        var newLB = [];
        for (var i = 1; i < split.length; i++) {
            newLB[i - 1] = split[i];
        }

        // Clears the update leaderboard function and replaces it with our own
        gameServer.gameMode.packetLB = 48;
        gameServer.gameMode.specByLeaderboard = false;
        gameServer.gameMode.updateLB = function(gameServer) {gameServer.leaderboard = newLB}; 
        console.log("\u001B[36mServer: \u001B[0mZmieniono tekst tablicy wyników");
    },

    boardreset: function(gameServer) {
        // Gets the current gamemode
        var gm = GameMode.get(gameServer.gameMode.ID);

        // Replace functions
        gameServer.gameMode.packetLB = gm.packetLB;
        gameServer.gameMode.updateLB = gm.updateLB; 
        console.log("\u001B[36mServer: \u001B[0mZresetowano tablicę wyników");
    },
    change: function(gameServer,split) {
        var key = split[1];
        var value = split[2];

        // Check if int/float
        if (value.indexOf('.') != -1) {
            value = parseFloat(value);
        } else {
            value = parseInt(value);
        }

        if (typeof gameServer.config[key] != 'undefined') {
            gameServer.config[key] = value;
            console.log("\u001B[36mServer: \u001B[0mZmieniono " + key + " na " + value);
        } else {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowa wartość konfiguracji");
        }
    },

    clear: function() {
        process.stdout.write("\u001b[2J\u001b[0;0H");
    },

    color: function(gameServer, split) {
        const { nickname, remainingArgs } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        const color = {
            r: parseInt(remainingArgs[0]),
            g: parseInt(remainingArgs[1]),
            b: parseInt(remainingArgs[2])
        };

        if (isNaN(color.r) || isNaN(color.g) || isNaN(color.b)) {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowe wartości koloru RGB!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        player.setColor(color);
        savePlayerColorToDatabase(nickname, [color.r, color.g, color.b]);

        for (var j = 0; j < player.cells.length; j++) {
            player.cells[j].setColor(color);
        }
        console.log("\u001B[36mServer: \u001B[0mZmieniono kolor gracza " + nickname);
    },

    food: function(gameServer,split) {
        var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
        var mass = parseInt(split[3]);

        // Make sure the input values are numbers
        if (isNaN(pos.x) || isNaN(pos.y)) {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowe współrzędne");
            return;
        }

        if (isNaN(mass)) {
            mass = gameServer.config.foodStartMass;
        }

        // Spawn
        var f = new Entity.Food(gameServer.getNextNodeId(), null, pos, mass);
        f.setColor(gameServer.getRandomColor());
        gameServer.addNode(f);
        gameServer.currentFood++; 
        console.log("\u001B[36mServer: \u001B[0mStworzono jedzenie na pozycji ("+pos.x+" , "+pos.y+")");
    },

    gamemode: function(gameServer,split) {
        try {
            var n = parseInt(split[1]);
            var gm = GameMode.get(n); // If there is an invalid gamemode, the function will exit
            gameServer.gameMode.onChange(gameServer); // Reverts the changes of the old gamemode
            gameServer.gameMode = gm; // Apply new gamemode
            gameServer.gameMode.onServerInit(gameServer); // Resets the server
            console.log("\u001B[36mServer: \u001B[0mZmieniono tryb gry na " + gameServer.gameMode.name);
        } catch (e) {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowy tryb gry");
        }
    },

    kick: function(gameServer, split) {
        const { nickname } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        for (var i in gameServer.clients) {
            if (gameServer.clients[i].playerTracker == player) {
                gameServer.clients[i].close();
                console.log("\u001B[36mServer: \u001B[0mWyrzucono gracza " + nickname);
                break;
            }
        }
    },

    kill: function(gameServer, split) {
        const { nickname } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        var count = 0;
        var len = player.cells.length;
        for (var j = 0; j < len; j++) {
            gameServer.removeNode(player.cells[0]);
            count++;
        }

        console.log("\u001B[36mServer: \u001B[0mUsunięto " + count + " komórek gracza " + nickname);
    },
    killall: function(gameServer,split) {
        var count = 0;
        var len = gameServer.nodesPlayer.length;
        for (var i = 0; i < len; i++) {
            gameServer.removeNode(gameServer.nodesPlayer[0]);
            count++;
        }
        console.log("\u001B[36mServer: \u001B[0mUsunięto " + count + " komórek");
    },

    mass: function(gameServer, split) {
        const { nickname, remainingArgs } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        var amount = Math.max(parseInt(remainingArgs[0]), 9);
        if (isNaN(amount)) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłową wartość masy!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        for (var j in player.cells) {
            player.cells[j].mass = amount;
        }

        console.log("\u001B[36mServer: \u001B[0mUstawiono masę gracza " + nickname + " na " + amount);
    },

    merge: function(gameServer, split) {
        const { nickname } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        for (var j in player.cells) {
            player.cells[j].calcMergeTime(-10000);
        }
        console.log("\u001B[36mServer: \u001B[0mWymuszono połączenie komórek gracza " + nickname);
    },

    name: function(gameServer, split) {
        const { nickname, remainingArgs } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        const newName = remainingArgs[0];
        if (!newName) {
            console.log("\u001B[36mServer: \u001B[0mPodaj nowy nick!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        console.log("\u001B[36mServer: \u001B[0mZmieniono nick z " + player.name + " na " + newName);
        player.name = newName;
    },

    playerlist: function(gameServer,split) {
        console.log("Pokazuję " + gameServer.clients.length + " graczy: ");
        console.log(" ID         | IP              | "+fillChar('NICK', ' ', ( gameServer.config.playerMaxNickLength + 2 ) )+" | CELLS | SCORE  | POSITION    "); 
        console.log(fillChar('', '-', ' ID         | IP              |  | CELLS | SCORE  | POSITION    '.length + ( gameServer.config.playerMaxNickLength + 2 )));
        for (var i = 0; i < gameServer.clients.length; i++) {
            var client = gameServer.clients[i].playerTracker;

            // ID with 3 digits length
            var id = fillChar((client.pID), ' ', 10, true);

            // Get ip (15 digits length)
            var ip = "BOT";
            if (typeof gameServer.clients[i].remoteAddress != 'undefined' ) {
                ip = gameServer.clients[i].remoteAddress;
            }
            ip = fillChar(ip, ' ', 15);

            // Get name and data
            var nick = '', cells = '', score = '', position = '', data = '';
            if (client.disconnect >= 0) {
                var tmp = "(" + client.disconnect + "s) ROZŁĄCZONY";
                data = fillChar(tmp, '-', ' | CELLS | SCORE  | POSITION    '.length + ( gameServer.config.playerMaxNickLength + 2 ), true);
                console.log(" " + id + " | " + ip + " | " + data);
            }
            else if (client.spectate) {
                try { 
                    if (gameServer.getMode().specByLeaderboard) {
                        nick = gameServer.leaderboard[client.spectatedPlayer].name;
                    } else {
                        nick = gameServer.clients[client.spectatedPlayer].playerTracker.name;
                    }
                } catch (e) { 
                    nick = "";
                }
                nick = (nick == "") ? "Nie wybrano gracza" : nick;
                data = fillChar("OBSERWUJE: " + nick, '-', ' | CELLS | SCORE  | POSITION    '.length + ( gameServer.config.playerMaxNickLength + 2 ), true);
                console.log(" " + id + " | " + ip + " | " + data);
            }
            else if (client.cells.length > 0) {
                nick = fillChar((client.name == "") ? "Nie wybrano gracza" : client.name, ' ', ( gameServer.config.playerMaxNickLength + 2 ) );
                cells = fillChar(client.cells.length, ' ', 5, true);
                score = fillChar(client.getScore(true), ' ', 6, true);
                position = fillChar(client.centerPos.x.toFixed(0), ' ', 5, true) + ', ' + fillChar(client.centerPos.y.toFixed(0), ' ', 5, true);
                console.log(" "+id+" | "+ip+" | "+nick+" | "+cells+" | "+score+" | "+position);
            }
            else { 
                data = fillChar('MARTWY LUB NIE GRA', '-', ' | CELLS | SCORE  | POSITION    '.length + ( gameServer.config.playerMaxNickLength + 2 ), true);
                console.log(" " + id + " | " + ip + " | " + data);
            }
        }
    },
    pause: function(gameServer,split) {
        gameServer.run = !gameServer.run; // Switches the pause state
        var s = gameServer.run ? "Wznowiono" : "Zapauzowano";
        console.log("\u001B[36mServer: \u001B[0m" + s + " grę.");
    },

    reload: function(gameServer) {
        gameServer.loadConfig();
        console.log("\u001B[36mServer: \u001B[0mPrzeładowano plik konfiguracyjny");
    },

    status: function(gameServer,split) {
        // Get amount of humans/bots
        var humans = 0, bots = 0, players = 0, client;
        for (var i = 0; i < gameServer.clients.length; i++) {
            client = gameServer.clients[i].playerTracker;
            if (client.disconnect == -1) {
                if ('_socket' in gameServer.clients[i]) {
                    humans++;
                } else {
                    bots++;
                }
                players++;
            }
        }
        console.log("\u001B[36mServer: \u001B[0mPołączeni gracze: "+players+"/"+gameServer.config.serverMaxConnections);
        console.log("\u001B[36mServer: \u001B[0mGracze: " + humans + " Boty: " + bots);
        console.log("\u001B[36mServer: \u001B[0mSerwer działa od " + seconds2time(process.uptime()));

        var used = (process.memoryUsage().heapUsed / 1024).toFixed(0);
        var total = (process.memoryUsage().heapTotal / 1024).toFixed(0);
        console.log("\u001B[36mServer: \u001B[0mAktualne zużycie pamięci: " + used + "/" + total + " Kb");
        console.log("\u001B[36mServer: \u001B[0mAktualny tryb gry: " + gameServer.gameMode.name);
    },

    tp: function(gameServer, split) {
        const { nickname, remainingArgs } = extractNickname(split);
        if (!nickname) {
            console.log("\u001B[36mServer: \u001B[0mPodaj prawidłowy nick gracza!");
            return;
        }

        var pos = {
            x: parseInt(remainingArgs[0]),
            y: parseInt(remainingArgs[1])
        };

        if (isNaN(pos.x) || isNaN(pos.y)) {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowe współrzędne!");
            return;
        }

        const player = findPlayerByNick(gameServer, nickname);
        if (!player) {
            console.log("\u001B[36mServer: \u001B[0mNie znaleziono gracza o nicku: " + nickname);
            return;
        }

        for (var j in player.cells) {
            player.cells[j].position.x = pos.x;
            player.cells[j].position.y = pos.y;
        }

        console.log("\u001B[36mServer: \u001B[0mPrzeteleportowano gracza " + nickname + " na pozycję (" + pos.x + " , " + pos.y + ")");
    },

    unban: function(gameServer,split) {
        var ip = split[1]; // Get ip
        var index = gameServer.banned.indexOf(ip);
        if (index > -1) {
            gameServer.banned.splice(index,1);
            console.log("\u001B[36mServer: \u001B[0mOdbanowano "+ip);
        } else {
            console.log("\u001B[36mServer: \u001B[0mTen IP nie jest zbanowany");
        }
    },

    virus: function(gameServer,split) {
        var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
        var mass = parseInt(split[3]);

        // Make sure the input values are numbers
        if (isNaN(pos.x) || isNaN(pos.y)) {
            console.log("\u001B[36mServer: \u001B[0mNieprawidłowe współrzędne");
            return;
        }
        if (isNaN(mass)) {
            mass = gameServer.config.virusStartMass;
        }

        // Spawn
        var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, mass);
        gameServer.addNode(v);
        console.log("\u001B[36mServer: \u001B[0mStworzono wirusa na pozycji ("+pos.x+" , "+pos.y+")");
    },

    exit: function(gameServer,split) {
        gameServer.exitserver();
    },

    say: function(gameServer,split) {
        var message = "";
        for (var i = 1; i < split.length; i++) {
            message += split[i] + " ";
        }
        var packet = new Packet.BroadCast(message);
        for (var i = 0; i < gameServer.clients.length; i++) {
            gameServer.clients[i].sendPacket(packet);
        }
        console.log("\u001B[36mServer: \u001B[0m" + message);
    }
};
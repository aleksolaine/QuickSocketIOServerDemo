const socketio = require('socket.io')(8000,{
    pingInterval: 30005,		//An interval how often a ping is sent
    pingTimeout: 10000,		//The time a client has to respont to a ping before it is desired dead
    upgradeTimeout: 3000,		//The time a client has to fullfill the upgrade
    allowUpgrades: true,		//Allows upgrading Long-Polling to websockets. This is strongly recommended for connecting for WebGL builds or other browserbased stuff and true is the default.
    cookie: false,			//We do not need a persistence cookie for the demo - If you are using a load balöance, you might need it.
    serveClient: true,		//This is not required for communication with our asset but we enable it for a web based testing tool. You can leave it enabled for example to connect your webbased service to the same server (this hosts a js file).
    allowEIO3: false,			//This is only for testing purpose. We do make sure, that we do not accidentially work with compat mode.
    cors: {
      origin: "*"				//Allow connection from any referrer (most likely this is what you will want for game clients - for WebGL the domain of your sebsite MIGHT also work)
    }
});

var game = {};
var games =[];
var rollingProjectileID = 0;
var projectile = {};
var projectiles = [];
//var players = []; //Taulukko kaikista yhdistäneistä pelaajista. Identifioiva tieto on SocketID
var player = {}; //Objekti yksittäisestä pelaajasta. Player taulukko on täynnä näitä.

console.log('Starting Socket.IO server.');

async function updatePositions(){
    while (true){
        games.forEach(game => {
            var playerPosition = {};
            var playerPositions = [];
            game.players.forEach(player => {
                playerPosition = {
                    x: player.x,
                    y: player.y,
                    z: player.z,
                    r: player.r
                }
                playerPositions.push(playerPosition);
            });
            socketio.in(game.instanceName).emit('POSITIONUPDATE', playerPositions);
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

function getPositionUpdate(player, position, rotation){
    if (player == null) return;
    player.x = position[0];
    player.y = position[1];
    player.z = position[2];
    player.r = rotation;
};

// connection on event, joka emittoidaan Unitysta
socketio.on('connection', (socket)=>{

    console.log('[' + (new Date()).toUTCString() + '] unity connecting with SocketID ' + socket.id);

    socket.emit('CONNECTED');

    socket.on('createGame', (data)=>{
        for (var i = 0; i < games.length; i++){
            if (games[i].instanceName === data.instanceName){
                socket.emit('GAMEEXISTS');
                return;
            }
        }
        newPlayers = [];
        newPlayer = {
            socketId: socket.id,
            index: 0,
            name: data.playerName,
            hp: 100,
            x: Math.random() * 20.0 - 10.0,
            y: 0.0,
            z: Math.random() * 20.0 - 10.0,
            r: 0.0
        };
        newPlayers.push(newPlayer);
        game = {
            instanceName: data.instanceName,
            index: games.length,
            players: newPlayers
        };
        socket.join(data.instanceName);
        games.push(game);
        socket.emit('GAMECREATEDSUCCESFULLY', JSON.stringify(game));
    });

    socket.on('joinGame', (data)=>{
        console.log("Trying to join game " + data.gameIndex);
        newPlayer = {
            socketId: socket.id,
            index: games[data.gameIndex].players.length,
            name: data.playerName,
            hp: 100,
            x: Math.random() * 20.0 - 10.0,
            y: 0.0,
            z: Math.random() * 20.0 - 10.0,
            r: 0.0
        };
        games[data.gameIndex].players.push(newPlayer);
        // var returnObject = {};
        // Object.assign(returnObject, games[data.gameIndex], newPlayer);
        socket.join(games[data.gameIndex].instanceName);
        socket.emit('GAMEJOINED', JSON.stringify([games[data.gameIndex] , newPlayer]));
        socket.to(games[data.gameIndex].instanceName).emit('REMOTEPLAYERCONNECTED', newPlayer);
    });

    socket.on('findGames', ()=>{
        socket.emit('GAMESLOADED', JSON.stringify(games));
    });

    socket.on('loadPlayers', (data)=>{
        var playersToLoad = [];
        playersToLoad = Object.assign(playersToLoad, games[data.gameIndex].players);
        Object.assign({}, games[data.gameIndex].players)
        //var playersToLoad = games[data.gameIndex].players;
        for (var i = 0; i < playersToLoad.length; i++){
            if (i === data.ownPlayerIndex ){
                playersToLoad.splice(i, 1);
                break;
            }
        }
        console.log("Players to load: " + playersToLoad.length)
        socket.emit('PLAYERSLOADED', JSON.stringify([playersToLoad, playersToLoad.length]));
    })

    socket.on('playerHit', (data)=>{
        games[data.gameIndex].players[data.playerIndex].hp -= 40;
        if (games[data.gameIndex].players[data.playerIndex].hp <= 0){
            games[data.gameIndex].players[data.playerIndex].hp = 0;
            socketio.in(games[data.gameIndex].instanceName).emit('PLAYERDEAD', JSON.stringify([data.playerIndex, data.id]));
        }
        else {
            socketio.in(games[data.gameIndex].instanceName).emit('PLAYERHIT', JSON.stringify([data.playerIndex, games[data.gameIndex].players[data.playerIndex].hp, data.id]));
        }
    });

    socket.on('playerLeavingGame', (data) => {
        for (var i = games[data.gameIndex].players.length - 1; i >= 0; i--){
            if (games[data.gameIndex].players.index > data.playerIndex){
                games[data.gameIndex].players.index--;
            }
            else {
                break;
            }
        }
        socket.to(games[data.gameIndex].instanceName).emit('DISCONNECTPLAYER', JSON.stringify(games[data.gameIndex].players[data.playerIndex].index));
        for (var i = games[data.gameIndex].players.length - 1; i >= 0; i--){
            if (games[data.gameIndex].players.index > data.playerIndex){
                games[data.gameIndex].players.index--;
            }
            else {
                break;
            }
        }
        games[data.gameIndex].players.splice(data.playerIndex, 1);
        socket.leave(games[data.gameIndex].instanceName);
        socket.emit('DISCONNECTED');
    });

    socket.on('disconnect', (reason) => {
        console.log('[' + (new Date()).toUTCString() + '] unity disconnecting with SocketID ' + socket.id + ' Reason: ' + reason);
        games.forEach(game => {
            for (var i = game.players.length - 1; i >= 0; i--){
                if (game.players[i].socketId === socket.id){
                    socket.to(game.instanceName).emit('DISCONNECTPLAYER', JSON.stringify(game.players[i].index));
                    game.players.splice(i, 1);
                    return;
                }
                else {
                    game.players[i].index--;
                }
            }
        });
        
    });

    socket.on('playerPositionUpdate', (data)=>{
        getPositionUpdate(games[data.gameIndex].players[data.playerIndex], data.position, data.rotation);
    });

    socket.on('playerCasting', (data) => {
        socket.to(games[data.gameIndex].instanceName).emit('REMOTEPLAYERCASTING', data.playerIndex);
    });

    socket.on('projectileCast', (data) => {
        socket.to(games[data.gameIndex].instanceName).emit('REMOTEPROJECTILECAST', JSON.stringify([data.position, data.forward, rollingProjectileID]));
        socket.emit('IDFORPREVIOUSLYCASTPROJECTILE', rollingProjectileID);
        rollingProjectileID++;
    });

    socket.on('projectileBlocked', (data) => {
        socket.to(games[data.gameIndex].instanceName).emit('REMOTEPROJECTILEBLOCKED', JSON.stringify([data.position, data.forward, data.id]));
    });

    socket.on('playerBlocking', (data) =>{
        socket.to(games[data.gameIndex].instanceName).emit('REMOTEPLAYERBLOCKING', data.playerIndex);
    });
});



updatePositions();
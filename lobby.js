"use strict";

const UNIDENTIFIED = 0, UNNAMED = 1, IN_LOBBY = 2, IN_GAME = 3;

const T8 = require("./gameT8.js");
const CN = require("./gameCN.js");

const lobbyModule = {
	handleInit : (game) => game.handleInit(game)
};

const createLobby = (module, name, min, max) => {
	return {
		gameName : name,
		minPlayers : min,
		maxPlayers : max,
		id : 0,
		unnamedSockets : [],
		handleInit : module.handleInit,
		handleMessage : module.handleMessage,
		handleClose : module.handleClose
	}
}

const lobbies = {
	"T8" : createLobby(T8, "T8", 2, 5),
	"CN" : createLobby(CN, "CN", 2, 2)
};

const joinLobby  = (data, game, player) => {
	console.log(game.lobby.unnamedSockets.map(s => s.player));
	if (player.status == IN_LOBBY || typeof data.name != 'string') {
		player.close(1000, "Invalid message");
		return;
	}
	if (data.name.length > 20) {
		player.close(1000, "TMI");
		return;
	}
	if (game.players.length == game.lobby.maxPlayers) {
		player.close(1000, "Lobby is full");
		return;
	}
	if (player.status == UNNAMED) {
		game.lobby.unnamedSockets.splice(player.id, 1);
		for (let i = 0; i < game.lobby.unnamedSockets.length; i++) {
			game.lobby.unnamedSockets[i].player.id = i;
		}
	}
	player.id = game.players.length;
	player.name = data.name;
	player.status = IN_LOBBY;
	const toSend = JSON.stringify({event : "join", name : player.name, id : player.id});
	game.players.forEach((player) => {
		player.send(toSend);
	});
	game.lobby.unnamedSockets.forEach((socket) => {
		socket.player.send(toSend);
	});
	game.players.push(player);
}

const lobbyHandleMessage = (data, game, player) => {
	if (data.action == "Leave") {
		player.close(1000, "Left game");
	} else if (data.action == "Join") {
		joinLobby(data, game, player);
	} else if (data.action == "Start") {
		if (player.status != IN_LOBBY) {
			player.close(("Invalid message"));
			return;
		}
		if (game.players.length >= game.lobby.minPlayers) {
			//The previous lobby.game will be turned into the proper game by createGame.
			game.lobby.game = lobbyGame(game.lobby);
			game.lobby.unnamedSockets.forEach((socket) => {
				socket.player.send('{"event" : "unnamedStart"}');
				socket.game = game.lobby.game;
			});
			
			game.lobby.id += 1;
			//The player is no longer in a lobby.

			game.handleInit = game.lobby.handleInit;
			game.handleMessage = game.lobby.handleMessage;
			game.handleClose = game.lobby.handleClose;

			game.players.forEach((player) => {
				player.status = IN_GAME;
			});

			delete game.lobby;
			
			// testModule.handleInit or game.handleInit, depending.
			lobbyModule.handleInit(game);
		}
	} else {
		player.close(1000, "Invalid message");
	}
};

const lobbyHandleClose = (game, player) => {
	if (player.status == IN_LOBBY) {
		game.players.splice(player.id, 1);
		for (let i = 0; i < game.players.length; i++) {
			console.log(player.id, " left");
			game.players[i].send(`{"event" : "leave", "id" : ${player.id}}`);
			if (game.players[i].id != i) {
				game.players[i].id = i;
			}
		}
		for (let i = 0; i < game.lobby.unnamedSockets.length; i++) {
			game.lobby.unnamedSockets[i].player.send(`{"event" : "leave", "id" : ${player.id}}`);
		}
	} else {
		game.lobby.unnamedSockets.splice(player.id, 1);
		for (let i = 0; i < game.lobby.unnamedSockets.length; i++) {
			game.lobby.unnamedSockets[i].player.id = i;
		}
	}
}

const lobbyGame = (lobby) => {
	return {
		id : lobby.gameName + '_' + lobby.id,
		handleMessage : lobbyHandleMessage,
		handleClose : lobbyHandleClose,
		players : [],
		lobby : lobby
	}
}

for (const key in lobbies) {
	lobbies[key].game = lobbyGame(lobbies[key]);
}

const getLobby = (name) => {
	for (let gameName in lobbies) {
		if (gameName == name) {
			return lobbies[gameName];
		}
	}
	return undefined;
}

const join = (data, socket) => {
	if (typeof data.gameId != "string" || data.gameId.length != 2 || Object.keys(data).length > 2) {
		socket.close(1000, "Invalid message");
		return;
	}
	
	const lobby = getLobby(data.gameId);
	if (lobby == undefined) {
		socket.close(1000, "Invalid game");
		return;
	}
	const names = lobby.game.players.map(p => p.name);
	socket.game = lobby.game;
	if (Object.hasOwn(data, 'name')) {
		joinLobby(data, socket.game, socket.player);
		if (socket.player.status == IN_LOBBY) {
			socket.player.send(JSON.stringify({event : "joined", players : names}));
		}
	} else {
		socket.player.id = lobby.unnamedSockets.length;
		socket.player.status = UNNAMED;
		socket.player.send(JSON.stringify({event : "joined", players : names}));
		lobby.unnamedSockets.push(socket);
	}
}

lobbyModule.joinLobby = join;

module.exports = lobbyModule;
"use strict";

const UNIDENTIFIED = 0, UNNAMED = 1, IN_LOBBY = 2, IN_GAME = 3;

const T8 = require("./gameT8.js");
const CN = require("./gameCN.js");

const lobbyModule = {
	handleInit : (game) => game.handleInit(game)
};

const createGame = (module, name, min, max) => {
	return {
		gameName : name,
		minPlayers : min,
		maxPlayers : max,
		id : 0,
		unnamed_players : [],
		handleInit : module.handleInit,
		handleMessage : module.handleMessage,
		handleClose : module.handleClose
	}
}

const games = {
	"T8" : createGame(T8, "T8", 2, 5),
	"CN" : createGame(CN, "CN", 2, 2)
};

let runTests = false;

const joinLobby  = (data, game, player) => {
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
		game.lobby.unnamed_players.splice(player.id, 1);
	}
	player.id = game.players.length;
	player.name = data.name;
	player.status = IN_LOBBY;
	const toSend = JSON.stringify({event : "join", name : player.name, id : player.id});
	console.log(toSend);
	game.players.forEach((player) => {
		player.send(toSend);
	});
	game.lobby.unnamed_players.forEach((player) => {
		player.send(toSend);
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
			game.players[i].send(`{"event" : "leave", "id" : ${player.id}}`);
			if (game.players[i].id != i) {
				game.players[i].id = i;
			}
		}
	} else {
		game.lobby.unnamed_players.splice(player.id, 1);
		for (let i = 0; i < game.lobby.unnamed_players.length; i++) {
			game.lobby.unnamed_players[i].id = i;
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

for (const key in games) {
	games[key].game = lobbyGame(games[key]);
}

const getLobby = (name) => {
	for (let gameName in games) {
		if (gameName == name) {
			return games[gameName];
		}
	}
	return undefined;
}

const queryLobby = (data, socket) => {
	if (typeof data.gameId != 'string' || Object.keys(data).length != 2 || data.gameId.length != 2) {
		socket.close(1000, "Invalid message");
	}
	const lobby = getLobby(data.gameId);
	if (lobby == undefined) {
		socket.close(1000, "Invalid game");
		return;
	}
	const names = lobby.game.players.map(p => p.name);
	socket.send(JSON.stringify({event : "qeury", players : names}));
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
		socket.player.id = unnamed_players.length;
		socket.player.status = UNNAMED;
		socket.player.send(JSON.stringify({event : "joined", players : names}));
		lobby.unnamed_players.push(socket.player);
	}
}

/*
const joinLobby = (data, socket) => {
	if (
		typeof data.gameId != "string" || 
		typeof data.name != "string" || 
		data.gameId.length != 2 || 
		data.name.length > 20
	) {
		socket.close(1000, "TMI");
		return;
	}

	const lobby = getLobby(data.gameId);
	if (lobby == undefined) {
		socket.close(1000, "Invalid game");
		return;
	}
	if (lobby.game.players.length == lobby.maxPlayers) {
		socket.close(1000, "Lobby is full");
		return;
	}
	const game = lobby.game;

	socket.game = game;
	socket.player.id = game.players.length;
	socket.player.name = data.name;
	socket.player.status = IN_LOBBY;

	const toSend = JSON.stringify({event : "join", name : socket.player.name, id : socket.player.id});
	console.log(toSend);
	game.players.forEach((player) => {
		player.send(toSend);
	});
	const names = game.players.map(p => p.name);
	socket.player.send(JSON.stringify({event : "joined", "players" : names}));
	game.players.push(socket.player);
}*/

lobbyModule.joinLobby = join;

module.exports = lobbyModule;
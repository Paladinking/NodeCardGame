"use strict";

const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

const T8 = require("./gameT8.js");

const lobbyModule = {
	handleInit : (game) => game.handleInit(game)
};

const games = {
	"T8" : {
		gameName : "T8",
		minPlayers : 2,
		maxPlayers : 5,
		id : 0,
		handleInit : T8.handleInit,
		handleMessage : T8.handleMessage,
		handleClose : T8.handleClose
	}
};

let runTests = false;

const lobbyHandleMessage = (data, game, player) => {
	if (data.action == "Leave") {
		player.close(1000, "Left game");
		return;
	}
	if (data.action == "Start") {
		if (game.players.length >= game.lobby.minPlayers) {
			const gameName = game.lobby.gameName;
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
		return;
	}
	player.close(1000, "Invalid message");
};

const lobbyHandleClose = (game, player) => {
	game.players.splice(player.id, 1);
	for (let i = 0; i < game.players.length; i++) {
		game.players[i].send(`{"event" : "leave", "id" : ${player.id}}`);
		if (game.players[i].id != i) {
			game.players[i].id = i;
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


const joinLobby = (data, socket) => {
	if (data.gameId.length != 2 || data.name.length > 20) {
		socket.close(1000, "TMI");
		return;
	}

	let lobby = undefined;
	for (let gameName in games) {
		if (gameName == data.gameId) {
			lobby = games[gameName];
			break;
		}
	}
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

	const names = game.players.map(p => `"${p.name}"`);
	game.players.forEach((player) => {
		player.send(`{"event" : "join", "name" : "${socket.player.name}", "id" : ${socket.player.id}}`);
	});
	socket.player.send(`{"event" : "joined", "players" : [${names}]}`);
	game.players.push(socket.player);
}

lobbyModule.joinLobby = joinLobby;

module.exports = lobbyModule;
"use strict";

const http = require("http");
const ws = require("ws");

const fs = require("fs");
const gameModule = require("./game.js");

const hostname = "127.0.0.1";
const port = 3000;

const errors = {
	400 : "Bad Request",
	404 : "File Not Found",
	405 : "Method Not Allowed",
	500 : "Internal Server Error",
	501 : "Not Implemented"
};

const contentTypes = {
	html : {contentType : "text/html", plain : true},
	css :{contentType : "text/css", plain : true},
	js : {contentType : "text/javascript", plain : true},
	icon : {contentType : "image/x-icon", plain : false},
	svg : {contentType : "image/svg+xml", plain : true}
}


let folderContent = {
	"/index.html" : contentTypes.html,
	"/main.css" : contentTypes.css,
	"/index.js" : contentTypes.js,
	"/favicon.ico" : contentTypes.icon,
	"/lobby.html" : contentTypes.html,
	"/lobby.js" : contentTypes.js
};


for (const number of "A23456789JQK") {
	for (const color of "SCDH") {
		folderContent[`/2color/${number}${color}.svg`] = contentTypes.svg;
	}
}

const findFile = (url) => {
	url = url.split("?")[0];
	if (url == '/') {
		return {status : 200, url : "/index.html", contentType : "text/html", plain : true};
	}
	if (url.endsWith('/')) {
		return {status : 301, url : url.slice(0, -1)};
	}
	for (const key in folderContent) {
		if (key == url) {
			return {status : 200, url : key, ...folderContent[key]};
		}
	}
	return {status : 404};
};

const sendError = (res, code, msg = errors[code]) => {
	res.writeHead(code);
	res.write(msg);
	res.end();
};

const handleGet = (req, res) => {
	const resObj = findFile(req.url);
	if (resObj.status == 200) {
		if (resObj.plain) {
			fs.readFile("./content" + resObj.url, "utf8", (err, data) => {
				if (err) {
					sendError(res, 500);
				} else {
					res.writeHead(200, {'Content-Type' : resObj.contentType});
					res.write(data);
					res.end();
				}
			});
		} else {
			fs.createReadStream("./content" + resObj.url).pipe(res);
		}
	} else if (resObj.status == 301) {
		res.writeHead(301, {location : resObj.url});
		res.end();
	} else if (resObj.status == 404) {
		sendError(res, 404);
	} else {
		sendError(res, 500, "Unreachable");
	}
};

const isValidMsg = (msg, requiredKeys) => {
	for (const key of requiredKeys) {
		if (msg[key] == undefined) return false;
	}
	return true;
};

const server = http.createServer((req, res) => {
	console.log(req.url);
	if (req.method == "GET") {
		handleGet(req, res);
	} else {
		sendError(res, 501);
	}
});

/*
	//lobby object -- one per game type
	game[game] = {
		minPlayers : minimum number of players
		maxPlayers : maximum number of players
		players : list of sockets
	}

    socket.game = {
		status : UNIDENTIFIED or IN_LOBBY or IN_GAME
		id : index in lobby.players
		name : name string,
		lobby : lobby object for relevant game, undefined while IN_GAME
		
	//game object -- many per game (in theory)
	{
		players : list of sockets,
		handleMessage : function(data, socket), 
		handleClose : function(socket),
		..game data unique to each game
	}
 }
 */
server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});

const socketServer = new ws.WebSocketServer({server : server});

const games = {
	"T8" : {
		gameName : "T8",
		minPlayers : 2,
		maxPlayers : 5,
		players : []
	}
};

const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

socketServer.on("connection", (socket) => {
	socket.gameData = {status : UNIDENTIFIED};
	socket.on("message", (msg) => {
		const data = JSON.parse(msg);
		console.log(data);
		switch (socket.gameData.status) {
			case UNIDENTIFIED:
				if (!isValidMsg(data, ["gameId", "name"])) {
					socket.close(1000, "Invalid message");
					return;
				}
				if (data.gameId.length != 2 || data.gameId.name.length > 20) {
					socket.close(1000, "TMI");
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
				if (lobby.players.length == lobby.maxPlayers) {
					socket.close(1000, "Lobby is full");
					return;
				}

				socket.gameData.id = lobby.players.length;
				socket.gameData.name = data.name;
				socket.gameData.status = IN_LOBBY;
				socket.gameData.lobby = lobby;

				const names = lobby.players.map(s => `"${s.gameData.name}"`);
				for (let i = 0; i < lobby.players.length; i++) {
					lobby.players[i].send(`{"event" : "join", "name" : "${socket.gameData.name}", "id" : ${socket.gameData.id}}`);
				}
				socket.send(`{"event" : "joined", "players" : [${names}]}`);
				lobby.players.push(socket);
				break;
			case IN_LOBBY:
				if (!isValidMsg(data, ["action"])) {
					socket.close(1000, "Invalid message");
					return;
				}
				if (data.action == "Leave") {
					socket.close(1000, "Left game");
					return;
				}
				if (data.action == "Start") {
					if (socket.gameData.lobby.players.length >= socket.gameData.lobby.minPlayers) {
						gameModule.createGame(socket.gameData.lobby);
						for (let sock of socket.game.players) {
							sock.send(`{"event" : "start"}`);
						}
					} else {
						socket.close(1000, "Not enough players");
					}
					return;
				}
				socket.close(1000, "Invalid message");
				break;
			case IN_GAME:
				if (!isValidMsg(data, ["action"])) {
					socket.close(1000, "Invalid message");
				}
				socket.game.handleMessage(data, socket);
				break;
		}

	});
	socket.on("close", (code, reason) => {
		if (socket.gameData.status == IN_LOBBY) {
			socket.gameData.lobby.players.splice(socket.gameData.id, 1);
			for (let i = 0; i < socket.gameData.lobby.players.length; i++) {
				socket.gameData.lobby.players[i].send(`{"event" : "leave", "id" : ${socket.gameData.id}}`);
				if (socket.gameData.lobby.players[i].gameData.id != i) {
					socket.gameData.lobby.players[i].gameData.id = i;
				}
			}
		} else if (socket.gameData.status == In_GAME) {
			socket.game.handleClose(socket);
		}
		console.log(socket.gameData.name + " left");
	});
});
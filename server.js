"use strict";

const http = require("http");
const ws = require("ws");

const fs = require("fs");

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
	const obj = findFile(req.url);
	if (obj.status == 200) {
		if (obj.plain) {
			fs.readFile("./content" + obj.url, "utf8", (err, data) => {
				if (err) {
					sendError(res, 500);
				} else {
					res.writeHead(200, {'Content-Type' : obj.contentType});
					res.write(data);
					res.end();
				}
			});
		} else {
			fs.createReadStream("./content" + obj.url).pipe(res);
		}
	} else if (obj.status == 301) {
		res.writeHead(301, {location : obj.url});
		res.end();
	} else if (obj.status == 404) {
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

const kickLobbyPlayer = (socket, reason) => {
	socket.close(1000, reason);
	socket.game.lobby.players.splice(socket.game.id, 1);
	for (let i = 0; i < socket.game.lobby.players.length; i++) {
		socket.game.lobby.players[i].send(`{"event" : "leave", "id" : ${socket.game.id}}`);
		if (socket.game.lobby.players[i].game.id != i) {
			socket.game.lobby.players[i].game.id = i;
		}
	}
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

	//lobby object
	game[game] = {
		minPlayers : minimum number of players
		maxPlayers : maximum number of players
		players : list of sockets
	}

    socket.game = {
		status : UNIDENTIFIED or IN_LOBBY or IN_GAME
		id : index in lobby.players
		name : name string,
		lobby : lobby object for relevant game
 }
 */
server.listen(port, hostname, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});

const socketServer = new ws.WebSocketServer({server : server});

const games = {
	"T8" : {
		minPlayers : 2,
		maxPlayers : 5,
		players : []
	}
};

const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

socketServer.on("connection", (socket) => {
	socket.game = {status : UNIDENTIFIED};
	socket.on("message", (msg) => {
		const data = JSON.parse(msg);
		console.log(data);
		switch (socket.game.status) {
			case UNIDENTIFIED:
				if (!isValidMsg(data, ["gameId", "name"])) {
					socket.close(1000, "Invalid message");
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
				if (lobby.players.length == lobby.maxPlayers) {
					socket.close(1000, "Lobby is full");
					return;
				}

				socket.game.id = lobby.players.length;
				socket.game.name = data.name;
				socket.game.status = IN_LOBBY;
				socket.game.lobby = lobby;

				for (let i = 0; i < lobby.players.length; i++) {
					lobby.players[i].send(`{"event" : "join", "name" : "${socket.game.name}", "id" : ${socket.game.id}}`);
				}
				socket.send(`{"event" : "joined", "players" : [${lobby.players}], "minPlayers" : ${lobby.minPlayers}, "maxPlayers" : ${lobby.maxPlayers}}`);
				lobby.players.push(socket);
				break;
			case IN_LOBBY:
				if (!isValidMsg(data, ["action"])) {
					kickLobbyPlayer(socket, "Invalid message");
					return;
				}
				if (data.action == "Leave") {
					kickLobbyPlayer(socket, "Left game");
					return;
				}

				break;
		}

	});
	socket.on("close", (code, reason) => {

	});
});
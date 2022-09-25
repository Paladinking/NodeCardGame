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
	"/favicon.ico" : contentTypes.icon
};

let games = {
	"T8" : {
		minPlayers : 2,
		maxPlayers : 5,
		lobby : []
	}
};

for (const number of "A23456789JQK") {
	for (const color of "SCDH") {
		folderContent[`/2color/${number}${color}.svg`] = contentTypes.svg;
	}
}

const findFile = (url) => {

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

const handlePost = (req, res) => {
	const parts = req.url.split("/");
	if (parts.length < 2) {
		sendError(res, 405);
		return;
	} 
	switch (parts[1]) {
		case "play":
			if (parts.length != 3) {
				sendError(res, 405);
				return;
			}
			for (const gameName in games) {
				if (gameName == parts[2]) {
					let game = games[gameName];
					if (game.lobby.length == game.maxPlayers) {
						sendError(res, 405, "Lobby Is Full");
						return;
					}
					
					const id = gameName + game.lobby.length;
					game.lobby.push(id);
					res.writeHead(200, {'Content-Type' : "text/plain"});
					res.write(id);
					res.end();
					return;
				}
			}
			sendError(res, 405);
			return;
		case "start":
			console.log(req.headers);
			console.log(req.rawHeaders);
			const id = req.headers["GameId"];
			if (id == undefined) {
				sendError(res, 400);
				return;
			}
			
			console.log(id);
			res.writeHead(200);
			res.end();
	}
};

const server = http.createServer((req, res) => {
	console.log(req.url);
	if (req.method == "GET") {
		handleGet(req, res);
	} else if(req.method == "POST") {
		handlePost(req, res);
	} else {
		sendError(res, 501);
	}
});


server.listen(port, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});

let socketServer = new ws.WebSocketServer({server : server});

socketServer.on("connection", (socket) => {
	socket.on("message", (msg) => {

	});
	socket.on("close", (code, reason) => {

	});
});
"use strict";

const http = require("http");

const fs = require("fs");

const hostname = "127.0.0.1";
const port = 3000;

const errors = {
	404 : "File Not Found",
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

const server = http.createServer((req, res) => {
	console.log(req.url);
	if (req.method == "GET") {
		handleGet(req, res);
	} else {
		sendError(res, 501);
	}
});


server.listen(port, () => {
	console.log(`Server running at http://${hostname}:${port}/`);
});
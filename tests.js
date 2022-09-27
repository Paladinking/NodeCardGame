"use strict";

const ws = require("ws");

const openSocket = async (url) => {
	return new Promise((resolve, reject) => {
		try {
			const socket = new ws.WebSocket("ws://localhost:3000");
			socket.on("open", () => {
				resolve(socket);
			});
		} catch (error) {
			reject();
		}
	});
};

const closeSocket = async (socket) => {
	return new Promise(async (resolve, reject) => {
		const onClose = () => {
			socket.off("close", onClose);
			resolve();
		};
		socket.on("close", onClose);
		socket.close();
		await new Promise((resolve) => {setTimeout(resolve, 10)});
		reject("Socket already closed");
	});
};

const objEq = (a, b) => {
	return JSON.stringify(a) === JSON.stringify(b);
};


// socketData : [{toReceive : [{"event" : "something", etc}, {"event" : ...}, someOtherJsonObj...], closeStep : 2}, {socket2data} ...]
// actions : [{id: socketIndex, toSend : {...}}]
const wsTest = async (socketData, actions) => {
	return new Promise(async (resolve, reject) => {
		let returning = false;
		const doReject = (msg, reject) => {
			returning = true;
			for (const data of socketData) {
				if (!data.isClosed) {
					data.socket.close();
				}
			}
			reject(msg);
		}
		let currentStep = 0;
		for (let i = 0; i < socketData.length; i++) {
			const data = socketData[i];
			data.socket = await openSocket("ws://localhost:3000");
			data.msgNr = 0;
			data.isClosed = false;
			const msgFunction = (msgBytes) => {
				if (returning) return;
				const msg = JSON.parse(msgBytes);
				if (data.msgNr >= data.toReceive.length) {
					doReject(`Unexpected message to socket ${i}: ` + JSON.stringify(msg), reject);
					return;
				}
				if (msg == undefined) {
					doReject(`Invalid json data to socket ${i}, expected ${JSON.stringify(data.toReceive[data.msgNr])}`, reject);
					return;
				}
				if (!objEq(msg, data.toReceive[data.msgNr])) {
					doReject(`Wrong message to socket ${i}: ` + JSON.stringify(msg) + " expected: " + JSON.stringify(data.toReceive[data.msgNr]), reject);
					return;
				}
				data.msgNr++;
			}
			data.socket.on("message", msgFunction);
			data.socket.on("close", () => {
				if (returning) return;
				data.isClosed = true;
				if (data.closeStep != currentStep) {
					doReject(`Socket ${i} closed unexpectedly`, reject);
					return;
				};
				
			});
		}
		for (let i = 0; i < actions.length; i++) {
			if (actions[i] != undefined) {
				if (actions[i].close) {
					socketData[actions[i].id].socket.close();
				} else {
					socketData[actions[i].id].socket.send(JSON.stringify(actions[i].toSend));
				}
				await new Promise((resolve) => {setTimeout(resolve, 10)});
				for (let j = 0; j < socketData.length; j++) {
					const data = socketData[j];
					if (data.closeStep == currentStep && !data.isClosed) {
						doReject(`Socket ${j} did not close`, reject);
						return;
					}
				}
			}
			currentStep++;
		}
		returning = true;
		for (const data of socketData) {
			if (!data.isClosed) {
				data.socket.close();
			}
		}
		resolve();
	});
}; 

const runWsTest = async (socketData, actions, errorMsg = undefined) => {
	return new Promise((resolve, reject) => {
		wsTest(socketData, actions).then(() => {
			resolve(1);
		},
		(err) => {
			if (errorMsg == undefined) {
				console.log(err);
			} else {
				console.log(errorMsg + ", " + err);
			}
			resolve(0);
		});
	});
};


const lobbyValid = async () => {
	return runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []}, 
					{event : "join", name : "Anna", id : 1}, 
					{event : "join", name : "Beta", id : 2}, 
					{event : "leave", id : 1},
					{event : "join", name : "Ceta", id : 2}
				],
				closeStep : 5
			}, 
			{
				toReceive : [
					{event : "joined", players : ["Me"]},
					{event : "join", name : "Beta", id : 2},
				],
				closeStep : 3
			},
			{
				toReceive : [
					{event : "joined", players : ["Me", "Anna"]},
					{event : "leave", id : 1},
					{event : "join", name : "Ceta", id : 2},
					{event : "leave", id : 0}
				],
				closeStep : 6
			}, 
			{
				toReceive : [
					{event : "joined", players : ["Me", "Beta"]},
					{event : "leave", id : 0}
				],
				closeStep : 6
			}
		],
		[
			{id : 0, toSend : {gameId : "T8", name : "Me"}},
			{id : 1, toSend : {gameId : "T8", name : "Anna"}}, 
			{id : 2, toSend : {gameId : "T8", name : "Beta"}}, 
			{id : 1, toSend : {action : "Leave"}}, 
			{id : 3, toSend : {gameId : "T8", name : "Ceta"}},
			{id : 0, close : true}
		]
	);
};

const joinLobbyInvalid = async () => {
	let completedTests = 0;
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0}],
		[{id : 0, toSend : {gameId : "T8", name : "123456789123456789123"}}],
		"To long name was not closed"
	);
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0}],
		[{id : 0, toSend : {gameId : "Bad", name : "Hello"}}],
		"Bad gameId was not closed"
	);
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0}],
		[{id : 0, toSend : "Hello world"}],
		"Bad data was not closed"
	);
	return completedTests;
};

const inLobbyInvalid = async () => {
	let completedTests = 0;
	completedTests += await runWsTest(
		[{toReceive : [{event : "joined", players : []}], closeStep : 1}],
		[
			{id : 0, toSend : {gameId : "T8", name : "Good Name"}},
			{id : 0, toSend : "Not a valid message"}
		],
		"Bad lobby message was not closed"
	);
	completedTests += await runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []}, {event : "join", name : "b", id : 1}, {event : "join", name : "c", id : 2},
					{event : "join", name : "d", id : 3}, {event : "join", name : "e", id : 4}
				],
				closeStep : 6,
			},
			{
				toReceive : [
					{event : "joined", players : ["a"]}, {event : "join", name : "c", id : 2}, {event : "join", name : "d", id : 3},
					{event : "join", name : "e", id : 4}
				],
				closeStep : 6
			},
			{
				toReceive : [
					{event : "joined", players : ["a", "b"]}, {event : "join", name : "d", id : 3}, {event : "join", name : "e", id : 4}
				],
				closeStep : 6
			},
			{
				toReceive : [
					{event : "joined", players : ["a", "b", "c"]}, {event : "join", name : "e", id : 4}
				],
				closeStep : 6
			},
			{
				toReceive : [
					{event : "joined", players : ["a", "b", "c", "d"]}
				],
				closeStep : 6
			},
			{
				toReceive : [],
				closeStep : 5
			}
		],
		[	{id : 0, toSend : {gameId : "T8", name : "a"}}, 
			{id : 1, toSend : {gameId : "T8", name : "b"}}, {id : 2, toSend : {gameId : "T8", name : "c"}},
			{id : 3, toSend : {gameId : "T8", name : "d"}}, {id : 4, toSend : {gameId : "T8", name : "e"}},
			{id : 5, toSend : {gameId : "T8", name : "f"}},
			undefined
		]
		
	);
	return completedTests;
};


const tests = {
	general : async () => {
		let completedTests = 0;
		completedTests += await lobbyValid();
		completedTests += await joinLobbyInvalid();
		completedTests += await inLobbyInvalid();
		
		console.log(`Passed ${completedTests} tests out of 6`);
	},
	
	T8 : () => {
		let completedTests = 0;
		{
			

			
		}
	}
};

tests.general();
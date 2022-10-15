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
		await new Promise((resolve) => {setTimeout(resolve, 1000)});
		reject("Socket already closed");
	});
};

const getMessage = async (socket) => {
	return new Promise(async (resolve, reject) => {
		const onMessage = (msg) => {
			socket.off("message", onMessage);
			resolve(msg);
		};
		socket.on("message", onMessage);
		setTimeout(reject, 1000);
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
		let currentStep = 0;
		const doReject = (msg, reject) => {
			returning = true;
			for (const data of socketData) {
				if (!data.isClosed) {
					data.socket.close();
				}
			}
			reject(msg + ` at action ${currentStep}`);
		}
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
			data.socket.on("close", (a, b) => {
				if (returning) return;
				data.isClosed = true;
				const reason = String.fromCharCode(...b);
				if (data.closeStep != currentStep) {
					doReject(`Socket ${i} closed unexpectedly, reason : '${reason}'`, reject);
					return;
				}
				if (data.closeReason && data.closeReason != reason) {
					doReject(`Unexpected close reason to socket ${i}: '${reason}', expected '${data.closeReason}'`, reject);
					return;
				}
			});
		}
		for (let i = 0; i < actions.length; i++) {
			if (actions[i] != undefined) {
				if (actions[i].close) {
					socketData[actions[i].id].socket.close();
				} else {
					socketData[actions[i].id].socket.send(JSON.stringify(actions[i].toSend));
				}
				await new Promise((resolve) => {setTimeout(resolve, 100)});
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
		for(let i = 0; i < socketData.length; i++) {
			const data = socketData[i];
			if (data.toReceive.length != data.msgNr) {
				doReject(`Socket ${i} did not recieve all messages (${data.msgNr} / ${data.toReceive.length})`, reject);
				return;
			}
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

const runWsTest = async (socketData, actions, name) => {
	testOut("\nRunning test '" + name + "'");
	return new Promise((resolve, reject) => {
		wsTest(socketData, actions).then(() => {
			resolve(1);
		},
		(err) => {
			testOut("Test failded,", err);	
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
		],
		"Lobby valid"
	);
};

const joinLobbyInvalid = async () => {
	let completedTests = 0;
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0, closeReason : "TMI"}],
		[{id : 0, toSend : {gameId : "T8", name : "abcdefghijklmnopqrstuww"}}, undefined],
		"Too long name"
	);
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0}],
		[{id : 0, toSend : {gameId : "Bad", name : "Hello"}}, undefined],
		"Bad gameId"
	);
	completedTests += await runWsTest(
		[{toReceive : [], closeStep : 0}],
		[{id : 0, toSend : "Hello world"}],
		"Bad data"
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
		"Bad lobby message"
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
				closeStep : 5,
				closeReason : "Lobby is full"
			}
		],
		[	{id : 0, toSend : {gameId : "T8", name : "a"}}, 
			{id : 1, toSend : {gameId : "T8", name : "b"}}, {id : 2, toSend : {gameId : "T8", name : "c"}},
			{id : 3, toSend : {gameId : "T8", name : "d"}}, {id : 4, toSend : {gameId : "T8", name : "e"}},
			{id : 5, toSend : {gameId : "T8", name : "f"}},
			undefined
		],
		"Full lobby"
		
	);
	completedTests += await runWsTest(
		[
			{toReceive : [{event : "joined", players : []}], closeStep : 2}
		],
		[
			{id : 0 , toSend : {gameId : "T8", name : "Me"}},
			{id : 0 , toSend : {action : "Start"}},
			undefined
		],
		"Bad start"
	);
	return completedTests;
};
const testingDeck = [
	'AS', '2D', '8D', '2C', 'JH', 'KH',
	'3S', '9H', '3C', '6C', '8H', '9D',
	'JC', 'QC', '7S', '5H', 'AD', 'QD',
	'7C', '5C', '3D', '7H', '8S', '2H',
	'7D', 'QS', '9C', 'QH', 'KS', '8C',
	'AC', '6H', '5S', 'JS', '6S', '4H',
	'6D', 'JD', '2S', '4D', '9S', 'AH',
	'KC', '4S', 'KD', '4C', '5D', '3H'
  ];
  
const playStandardT8 = async () => {
	tests.handleInit = (game) => {
		game.handleInit(game, testingDeck.slice())
	}
	return await runWsTest(
		[{
			toReceive : [
				{event : "joined", players : []}, {event : "join", name : "Beta", id : 1},
				{event : "start", topCard : "2D", hand : ["3H", "5D", "4C", "KD", "4S", "KC", "AH"]},
				{event : "place", cards : ["KD", "KC"], newCards : []},
				{event : "drawOther", passed : false}, {event : "drawOther", passed : false}, {event : "drawOther", passed : true},
				{event : "place", cards : ["4C"], newCards : []},
				{event : "place", cards : ["4D", "4H"], newCards : []},
				{event : "place", cards : ["AH"], newCards : []},
				{event : "place", cards : ["3H"], newCards : []},
				{event : "place", cards : ["6H", "6D", "6S"], newCards : []},
				{event : "place", cards : ["4S"], newCards : []},
				{event : "place", cards : ["9S"], newCards : []},
				{event : "drawSelf", card : "8C"},
				{event : "place", cards : ["8C"], newCards : []},
				{event : "chooseColor", color : "S"},
				{event : "place", cards : ["5S"], newCards : []},
				{event : "place", cards : ["5D"], newCards : []}

			], closeStep : 18, closeReason : "Game is over"},
		{
			toReceive : [
				{event : "joined", players : ["Alpha"]},
				{event : "start", topCard : "2D", hand : ["9S", "4D", "2S", "JD", "6D", "4H", "6S"]},
				{event : "place", cards : ["KD", "KC"], newCards : []},
				{event : "drawSelf", card : "JS"}, {event : "drawSelf", card : "5S"}, {event : "drawSelf", card : "6H"},
				{event : "place", cards : ["4C"], newCards : []},
				{event : "place", cards : ["4D", "4H"], newCards : []},
				{event : "place", cards : ["AH"], newCards : ["AC"]},
				{event : "place", cards : ["3H"], newCards : []},
				{event : "place", cards : ["6H", "6D", "6S"], newCards : []},
				{event : "place", cards : ["4S"], newCards : []},
				{event : "place", cards : ["9S"], newCards : []},
				{event : "drawOther", passed : false},
				{event : "place", cards : ["8C"], newCards : []},
				{event : "chooseColor", color : "S"},
				{event : "place", cards : ["5S"], newCards : []},
				{event : "place", cards : ["5D"], newCards : []}
			], closeStep : 18, closeReason : "Game is over"}
		],
		[
			{id : 0, toSend : {gameId : "T8", name : "Alpha"}},
			{id : 1, toSend : {gameId : "T8", name : "Beta"}},
			{id : 0, toSend : {action : "Start"}},
			{id : 0, toSend : {action : "Place", cards : ["KD", "KC"]}},
			{id : 1, toSend : {action : "Draw"}}, {id : 1, toSend : {action : "Draw"}}, {id : 1, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["4C"]}},
			{id : 1, toSend : {action : "Place", cards : ["4D", "4H"]}},
			{id : 0, toSend : {action : "Place", cards : ["AH"]}},
			{id : 0, toSend : {action : "Place", cards : ["3H"]}},
			{id : 1, toSend : {action : "Place", cards : ["6H", "6D", "6S"]}},
			{id : 0, toSend : {action : "Place", cards : ["4S"]}},
			{id : 1, toSend : {action : "Place", cards : ["9S"]}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["8C"]}},
			{id : 0, toSend : {action : "ChooseColor", color : "S"}},
			{id : 1, toSend : {action : "Place", cards : ["5S"]}},
			{id : 0, toSend : {action : "Place", cards : ["5D"]}},
		],
		"Valid T8 Game"
	)
};

const invalidT8Playes = async () => {
	tests.handleInit = (game) => {
		game.handleInit(game, testingDeck.slice());
	}
	let completedTests = 0;
	completedTests += await runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []}, {event : "join", name : "Beta", id : 1}, {event : "join", name : "Ceta", id : 2},
					{event : "start", topCard : "2D", hand : ["3H", "5D", "4C", "KD", "4S", "KC", "AH"]},
					{event : "leave", id : 1},
					{event : "place", cards : ["5D"], newCards : []},
					{event : "leave", id : 1}
				],
				closeStep : 6, closeReason : "Game is over"
			},
			{
				toReceive : [
					{event : "joined", players : ["Alpha"]}, {event : "join", name : "Ceta", id : 2},
					{event : "start", topCard : "2D", hand :  ["9S", "4D", "2S", "JD", "6D", "4H", "6S"]}
				],
				closeStep : 4,
				closeReason : "Not your turn"
			}, 
			{
				toReceive : [
					{event : "joined", players : ["Alpha", "Beta"]},
					{event : "start", topCard : "2D", hand : ["JS", "5S", "6H", "AC", "8C", "KS", "QH"]},
					{event : "leave", id : 1},
					{event : "place", cards : ["5D"], newCards : []}
				],
				closeStep : 6,
				closeReason : "Played card not in hand"
			}
			
		],
		[
			{id : 0, toSend : {gameId : "T8", name : "Alpha"}},
			{id : 1, toSend : {gameId : "T8", name : "Beta"}},
			{id : 2, toSend : {gameId : "T8", name : "Ceta"}},
			{id : 2, toSend : {action : "Start"}},
			{id : 1, toSend : {action : "Place", cards : ["4D"]}},
			{id : 0, toSend : {action : "Place", cards : ["5D"]}},
			{id : 2, toSend : {action : "Place", cards : ["6D"]}},
			{id : 0, toSend : {action : "Leave"}}
			
		],
		"Play on not your turn + play not in hand"
	)
	return completedTests;
};


const aceT8Plays = async () => {
	tests.handleInit = (game) => {
		game.handleInit(game, [
			'AS', '2C', '8D', '2D', 'JH', 'KH',
			'KD', '9H', '5D', '6C', '8H', '9D',
			'JC', 'QC', '7S', '5H', '4S', 'QD',
			'7C', '5C', '7H', '7D', '4C', '2H',
			'8S', 'AH', 'QS', 'QH', 'KS', '8C',
			'AC', '6H', 'AD', '5S', '6S', '4H',
			'6D', 'JD', '2S', '4D', '9S', 'JS',
			'KC', '9C', '3S', '3D', '3C', '3H'
		]);
	};
	let completedTests = 0;
	completedTests = await runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []}, {event : "join", name : "Beta", id : 1}, {event : "join", name : "Ceta", id : 2},
					{event : "start", topCard : "2C", hand : ["3H", "3C", "3D", "3S", "9C", "KC", "JS"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "drawSelf", card : "QS"},
					{event : "drawSelf", card : "AH"},
					{event : "place", cards : ["AH"], newCards : []},
					{event : "drawSelf", card : "4C"},
					{event : "drawSelf", card : "7D"},
					{event : "drawSelf", card : "7H"},
					{event : "place", cards : ["7H"], newCards : []}
				]
			},				
			{
				toReceive : [
					{event : "joined", players : ["Alpha"]}, {event : "join", name : "Ceta", id : 2 },
					{event : "start", topCard : "2C", hand : ['9S', '4D', '2S', 'JD', '6D', '4H', "6S"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["AH"], newCards : ["8S"]},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["7H"], newCards : []}
				]
			}, 
			{
				toReceive : [
					{event : "joined", players : ["Alpha", "Beta"]},
					{event : "start", topCard : "2C", hand : ["5S", "AD", "6H", "AC", "8C", "KS", "QH"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["AH"], newCards : ["2H"]},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["7H"], newCards : []}
				]
			}
		], 
		[
			{id : 0, toSend : {gameId : "T8", name : "Alpha"}},
			{id : 1, toSend : {gameId : "T8", name : "Beta"}},
			{id : 2, toSend : {gameId : "T8", name : "Ceta"}},
			{id : 2, toSend : {action : "Start"}},
			{id : 0, toSend : {action : "Place", cards : ["3C", "3H", "3S", "3D"]}},
			{id : 1, toSend : {action : "Place", cards : ["4D", "4H"]}},
			{id : 2, toSend : {action : "Place", cards : ["6H"]}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["AH"]}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["7H"]}},
		], 
		"Ace draw Play");
	return completedTests;
}

const testOut = console.log;

const tests = {
	general : async () => {
		console.log = (msg) => {};
		let completedTests = 0;
		completedTests += await lobbyValid();
		completedTests += await joinLobbyInvalid();
		completedTests += await inLobbyInvalid();
		completedTests += await playStandardT8();
		completedTests += await invalidT8Playes();
		completedTests += await aceT8Plays();
		testOut(`Passed ${completedTests} tests out of 10`);
		console.log = testOut;
	},
	
	T8 : () => {
		let completedTests = 0;
		{
			

			
		}
	},
	
	handleInit : (game) => {}
};
module.exports = tests;
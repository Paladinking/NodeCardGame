"use strict";

const ws = require("ws");
const T8 = require("./gameT8.js");
const CN = require("./gameCN.js");

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
// actions : [{id : socketIndex, toSend : {...}}]
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
	totalTests += 1;
	return new Promise((resolve, reject) => {
		wsTest(socketData, actions).then(() => {
			resolve(1);
		},
		(err) => {
			testOut("Test failed,", err);	
			resolve(0);
		});
	});
};

const wsLobbyTest = async () => {
	let completedTests = 0;
	completedTests += await runWsTest(
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
	completedTests += await runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []},
					{event : "join", name : '{"name" : "A"}', id : 1},
				], closeStep : 2, closeReason : "Left game"
			},
			{
				toReceive : [
					{event : "joined", players : ['""This "is \" a\\']},
					{event : "leave", id : 0},
				], closeStep : 3
			}
		],
		[
			{id : 0, toSend : {gameId : "T8", name : '""This "is \" a\\'}},
			{id : 1, toSend : {gameId : "T8", name : '{"name" : "A"}'}},
			{id : 0, toSend : {action : "Leave"}}
		],
		"Name with quotes"
	);
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
  
const wsTestT8 = async () => {
	tests.handleInit = (game) => {
		game.deck = testingDeck.slice();
		game.handleInit(game)
	}
	let completedTests = 0;
	completedTests += await runWsTest(
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
	);
	tests.handleInit = (game) => {
		game.deck = testingDeck.slice();
		game.handleInit(game);
	};
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
	);
	tests.handleInit = (game) => {
		game.deck = [
			'KC', '2C', '8D', '2D', 'JD', 'KH',
			'KD', '9H', '6C', '8H', '9D', '9C',
		 	'QC', '2H', '5H', '4S', '8S', '7C',
			'5C', '7H', '7D', '7S', '4C', 'QD', 
			'AH', 'QS', '5D', 'QH', 'KS', '8C',
			'AC', '6H', 'AD', '5S', '6S', '4H',
			'6D', 'JC', '2S', '4D', '9S', 'JS',
			'AS', 'JH', '3S', '3D', '3C', '3H'
		];
		game.handleInit(game);
	};
	completedTests += await runWsTest(
		[
			{
				toReceive : [
					{event : "joined", players : []}, {event : "join", name : "Beta", id : 1}, {event : "join", name : "Ceta", id : 2},
					{event : "start", topCard : "KC", hand : ["3H", "3C", "3D", "3S", "JH", "AS", "JS"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "place", cards : ["JH", "JS"], newCards : []},
					{event : "place", cards : ["6S"], newCards : []},
					{event : "place", cards : ["KS"], newCards : []},
					{event : "drawSelf", card : "5D"},
					{event : "place", cards : ["AS"], newCards : []},
					{event : "drawSelf", card : "QD"},
					{event : "drawSelf", card : "4C"},
					{event : "drawSelf", card : "7S"},
					{event : "place", cards : ["7S"], newCards : []}

				]
			},			
			{
				toReceive : [
					{event : "joined", players : ["Alpha"]}, {event : "join", name : "Ceta", id : 2 },
					{event : "start", topCard : "KC", hand : ['9S', '4D', '2S', 'JC', '6D', '4H', "6S"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "place", cards : ["JH", "JS"], newCards : []},
					{event : "place", cards : ["6S"], newCards : []},
					{event : "place", cards : ["KS"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["AS"], newCards : ["QS"]},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["7S"], newCards : []}
				]
			},
			{
				toReceive : [
					{event : "joined", players : ["Alpha", "Beta"]},
					{event : "start", topCard : "KC", hand : ["5S", "AD", "6H", "AC", "8C", "KS", "QH"]},
					{event : "place", cards : ["3C", "3H", "3S", "3D"], newCards : []},
					{event : "place", cards : ["4D", "4H"], newCards : []},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "place", cards : ["JH", "JS"], newCards : []},
					{event : "place", cards : ["6S"], newCards : []},
					{event : "place", cards : ["KS"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["AS"], newCards : ["AH"]},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["7S"], newCards : []}
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
			{id : 0, toSend : {action : "Place", cards : ["JH", "JS"]}},
			{id : 1, toSend : {action : "Place", cards : ["6S"]}},
			{id : 2, toSend : {action : "Place", cards : ["KS"]}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["AS"]}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Draw"}},
			{id : 0, toSend : {action : "Place", cards : ["7S"]}},
		], 
		"Ace draw Play"
	);
	tests.handleInit = (game) => {
		game.deck = [
			'AC', '2S', '2D', '8D', 'QD', '7H',
			'KD', '3S', '9D', 'QH', '3C', '4S',
			'6D', 'QC', '4C', '3H', 'AD', '2C',
			'6S', 'JD', '9S', '8S', 'JH', '9C',
			'JC', 'KC', 'AH', '4H', '9H', '7D',
			'4D', '6C', '6H', '5C', 'KS', 'KH',
			'8H', '5D', 'AS', '7S', '7C', 'JS',
			'8C', '5S', '2H', '3D', 'QS', '5H'
		];
		game.handleInit(game);
	};
	completedTests += await runWsTest(
		[
			{
				toReceive : [
					{event: 'joined', players: []},
					{event: 'join', name: 'abc', id : 1},
					{event: 'start', topCard: '2S', hand: ["5H","QS","3D","2H","5S","8C","JS"]},
					{event: 'place', cards: ["5S"], newCards: []},
					{event: 'place', cards: ["AS"], newCards: ["5C"]},
					{event: 'place', cards: ["7S","7C"], newCards: []},
					{event: 'place', cards: ["5C","5H"], newCards: []},
					{event: 'place', cards: ["5D"], newCards: []},
					{event: 'place', cards: ["3D"], newCards: []},
					{event: 'place', cards: ["8H"], newCards: []},
					{event: 'chooseColor', color: 'D'},
					{event: 'place', cards: ["8C"], newCards: []},
					{event: 'chooseColor', color: 'C'},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: false},
					{event: 'place', cards: ["6C"], newCards: []},
					{event: 'drawSelf', card: '4D'},
					{event: 'drawSelf', card: '7D'},
					{event: 'drawSelf', card: '9H'},
					{event: 'place', cards: ["6H"], newCards: []},
					{event: 'place', cards: ["2H"], newCards: []},
					{event: 'place', cards: ["KH"], newCards: []},
					{event: 'place', cards: ["9H"], newCards: []},
					{event: 'drawOther', passed: false},
					{event: 'place', cards: ["4H"], newCards: []},
					{event: 'place', cards: ["4D"], newCards: []},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: true},
					{event: 'place', cards: ["7D"], newCards: []},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: false},
					{event: 'place', cards: ["8S"], newCards: []},
					{event: 'chooseColor', color: 'C'},
					{event: 'drawSelf', card: '9S'},
					{event: 'drawSelf', card: 'JD'},
					{event: 'drawSelf', card: '6S'},
					{event: 'place', cards: ["9C"], newCards: []},
					{event: 'place', cards: ["9S"], newCards: []},
					{event: 'place', cards: ["KS","KC"], newCards: []},
					{event: 'drawSelf', card: '2C'},
					{event: 'place', cards: ["2C"], newCards: []},
					{event: 'place', cards: ["JC"], newCards: []},
					{event: 'place', cards: ["JS"], newCards: []},
					{event: 'place', cards: ["JH"], newCards: []},
					{event: 'place', cards: ["JD"], newCards: []},
					{event: 'drawOther', passed: false},
					{event: 'place', cards: ["AD"], newCards: ["3H"]},
					{event: 'drawOther', passed: false},
					{event: 'place', cards: ["AH"], newCards: ["QC"]},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: false},
					{event: 'drawOther', passed: true}
				],
				closeStep : 60,
				closeReason : "Game ended"
			},
			{
				toReceive : [
					{event : "joined", players : ["123"]},
					{event : "start", topCard : "2S", hand : ["7C","7S","AS","5D","8H","KH","KS"]},
					{event : "place", cards : ["5S"], newCards : []},
					{event : "place", cards : ["AS"], newCards : []},
					{event : "place", cards : ["7S","7C"], newCards : []},
					{event : "place", cards : ["5C","5H"], newCards : []},
					{event : "place", cards : ["5D"], newCards : []},
					{event : "place", cards : ["3D"], newCards : []},
					{event : "place", cards : ["8H"], newCards : []},
					{event : "chooseColor", "color" : "D"},
					{event : "place", cards : ["8C"], newCards : []},
					{event : "chooseColor", "color" : "C"},
					{event : "drawSelf", card : "6H"},
					{event : "drawSelf", card : "6C"},
					{event : "place", cards : ["6C"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : true},
					{event : "place", cards : ["6H"], newCards : []},
					{event : "place", cards : ["2H"], newCards : []},
					{event : "place", cards : ["KH"], newCards : []},
					{event : "place", cards : ["9H"], newCards : []},
					{event : "drawSelf", card : "4H"},
					{event : "place", cards : ["4H"], newCards : []},
					{event : "place", cards : ["4D"], newCards : []},
					{event : "drawSelf", card : "AH"},
					{event : "drawSelf", card : "KC"},
					{event : "drawSelf", card : "JC"},
					{event : "place", cards : ["7D"], newCards : []},
					{event : "drawSelf", card : "9C"},
					{event : "drawSelf", card : "JH"},
					{event : "drawSelf", card : "8S"},
					{event : "place", cards : ["8S"], newCards : []},
					{event : "chooseColor", "color" : "C"},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : false},
					{event : "drawOther", passed : true},
					{event : "place", cards : ["9C"], newCards : []},
					{event : "place", cards : ["9S"], newCards : []},
					{event : "place", cards : ["KS","KC"], newCards : []},
					{event : "drawOther", passed : false},
					{event : "place", cards : ["2C"], newCards : []},
					{event : "place", cards : ["JC"], newCards : []},
					{event : "place", cards : ["JS"], newCards : []},
					{event : "place", cards : ["JH"], newCards : []},
					{event : "place", cards : ["JD"], newCards : []},
					{event : "drawSelf", card : "AD"},
					{event : "place", cards : ["AD"], newCards : []},
					{event : "drawSelf", card : "4C"},
					{event : "place", cards : ["AH"], newCards : []},
					{event : "drawSelf", card : "6D"},
					{event : "drawSelf", card : "4S"},
					{event : "drawSelf", card : "3C"}				
				],
				closeStep : 60,
				closeReason : "Game ended"
			}
		],
		[
			{id : 0, toSend: {gameId : "T8", name: "123"}},
			{id : 1, toSend: {gameId : "T8", name: "abc"}},
			{id : 1, toSend: {action : "Start"}},
			{id : 0, toSend: { action: 'Place', cards: [ '5S' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ 'AS' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ '7S', '7C' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '5C', '5H' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ '5D' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '3D' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ '8H' ] }},
			{id : 1, toSend: { action: 'ChooseColor', color: 'D' }},
			{id : 0, toSend: { action: 'Place', cards: [ '8C' ] }},
			{id : 0, toSend: { action: 'ChooseColor', color: 'C' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ '6C' ] }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ '6H' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '2H' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ 'KH' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '9H' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ '4H' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '4D' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Place', cards: [ '7D' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ '8S' ] }},
			{id : 1, toSend: { action: 'ChooseColor', color: 'C' }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ '9C' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ '9S' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ 'KS', 'KC' ] }},
			{id : 0, toSend: { action: 'Draw' }},
			{id : 0, toSend: { action: 'Place', cards: [ '2C' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ 'JC' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ 'JS' ] }},
			{id : 1, toSend: { action: 'Place', cards: [ 'JH' ] }},
			{id : 0, toSend: { action: 'Place', cards: [ 'JD' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ 'AD' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Place', cards: [ 'AH' ] }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }},
			{id : 1, toSend: { action: 'Draw' }}
		],
		"Long ace draw test"
	);
	return completedTests;
};

const wsTestCN = async () => {
	let completedTests = 0;
	tests.handleInit = (game) => {
		game.players[0].deck = [
			'AC', '2S', '2D', '8D', 'QD', '7H',
			'KD', '3S', '9D', 'QH', '3C', '4S', 'YR',
			'8H', 'QC', '4C', '3H', 'AD', '2C',
			'6C', 'JD', '9S', '8S', 'JH', '9C',
			'JC', 'KC', 'AH',' YD', '4H', '9H', '7D',
			'4D', '6S', '6H', '5C', 'KS', 'KH',
			'6D', '5D', 'AS', '7S', '7C', 'JS',
			'8C', '5S', '2H', '3D', 'QS', '5H'
		];
		game.players[1].deck = [
			'4H', '2C', '8D', '2D', 'JD', 'KH', 'YR',
			'KD', '9H', '6C', '8H', '9D', '9C',
		 	'QC', '2H', '5H', '4S', '8S', '7C',
			'5C', '7H', '7D', '7S', '4C', 'QD', 
			'AH', 'QS', '5D', 'QH', 'KS', '8C',
			'AC', '6H', 'AD', '5S', '6S', 'KC',
			'6D', 'JC', '2S', 'YD', '4D', '9S', 'JS',
			'AS', 'JH', '3S', '3D', '3C', '3H'
		];
		game.handleInit(game);
	}
	completedTests += await runWsTest(
		[{
			toReceive : [
				{event : "joined", players : []},
				{event : "join", name : "Beta", id : 1},
				{event : "start", hand : ["5H", "QS", "3D", "2H", "5S", "8C", "JS", "7C"]},
				{event : "place", card : "5H", side : 0, col : 0, pos : 0},
				{event : "place", card : "3S", side : 1, col : 0, pos : 0},
				{event : "place", card : "3D", side : 0, col : 1, pos : 0},
				{event : "place", card : "3D", side : 1, col : 1, pos : 0},
				{event : "place", card : "2H", side : 0, col : 2, pos : 0},
				{event : "place", card : "3C", side : 1, col : 2, pos : 0},
				{event : "place", card : "7C", newCard : "7S", side : 0, col : 0, pos : 1},
				{event : "place", card : "JH", side : 0, col : 1, pos : 0},
				{event : "place", card : "8C", newCard : "AS", side : 0, col : 0, pos : 2},
				{event : "place", card : "AS", side : 1, col : 2, pos : 1},
				{event : "place", card : "QS", newCard : "5D", side : 0, col : 0, pos : 2},
				{event : "place", card : "YD", side : 1, col : 1, pos : 0},
				{event : "place", card : "AS", newCard : "6D", side : 0, col : 0, pos : 3},
				{event : "place", card : "4D", side : 1, col : 0, pos : 0},
				{event : "place", card : "6D", newCard : "KH", side : 0, col : 1, pos : 0},
				{event : "dismissCard"},
				{event : "place", card : "KH", newCard : "KS", side : 0, col : 1, pos : 0},
				{event : "dismissLane", col : 1},
				{event : "place", card : "KS", newCard : "5C", side : 0, col : 1, pos : 0},
				{event : "place", card : "6D", side : 1, col : 1, pos : 0},
				{event : "place", card : "5C", newCard : "6H", side : 0, col : 2, pos : 1},
				{event : "place", card : "KC", side : 0, col : 2, pos : 1},
				{event : "place", card : "7S", newCard : "6S", side : 0, col : 2, pos : 2},
				{event : "place", card : "9S", side : 1, col : 1, pos : 1},
				{event : "place", card : "6S", newCard : "4D", side : 0, col : 2, pos : 3}
			],
			closeStep : 27,
			closeReason : "Game is over"
		}, {
			toReceive : [
				{event : "joined", players : ["Alpha"]},
				{event : "start", hand : ["3H", "3C", "3D", "3S", "JH", "AS", "JS", "9S"]},
				{event : "place", card : "5H", side : 0, col : 0, pos : 0},
				{event : "place", card : "3S", side : 1, col : 0, pos : 0},
				{event : "place", card : "3D", side : 0, col : 1, pos : 0},
				{event : "place", card : "3D", side : 1, col : 1, pos : 0},
				{event : "place", card : "2H", side : 0, col : 2, pos : 0},
				{event : "place", card : "3C", side : 1, col : 2, pos : 0},
				{event : "place", card : "7C", side : 0, col : 0, pos : 1},
				{event : "place", card : "JH", newCard : "4D", side : 0, col : 1, pos : 0},
				{event : "place", card : "8C", side : 0, col : 0, pos : 2},
				{event : "place", card : "AS", newCard : "YD", side : 1, col : 2, pos : 1},
				{event : "place", card : "QS", side : 0, col : 0, pos : 2},
				{event : "place", card : "YD", newCard : "2S", side : 1, col : 1, pos : 0},
				{event : "place", card : "AS", side : 0, col : 0, pos : 3},
				{event : "place", card : "4D", newCard : "JC", side : 1, col : 0, pos : 0},
				{event : "place", card : "6D", side : 0, col : 1, pos : 0},
				{event : "dismissCard", newCard : "6D"},
				{event : "place", card : "KH", side : 0, col : 1, pos : 0},
				{event : "dismissLane", col : 1},
				{event : "place", card : "KS", side : 0, col : 1, pos : 0},
				{event : "place", card : "6D", newCard : "KC", side : 1, col : 1, pos : 0},
				{event : "place", card : "5C", side : 0, col : 2, pos : 1},
				{event : "place", card : "KC", newCard : "6S", side : 0, col : 2, pos : 1},
				{event : "place", card : "7S", side : 0, col : 2, pos : 2},
				{event : "place", card : "9S", newCard : "5S", side : 1, col : 1, pos : 1},
				{event : "place", card : "6S", side : 0, col : 2, pos : 3}
			],
			closeStep : 27,
			closeReason : "Game is over"
		}],
		[
			{id : 0, toSend : {gameId : "CN", name : "Alpha"}},
			{id : 1, toSend : {gameId : "CN", name : "Beta"}},
			{id : 1, toSend : {action : "Start"}},
			{id : 0, toSend : {action : "Place", card : "5H", side : 0, col : 0, pos : 0}},
			{id : 1, toSend : {action : "Place", card : "3S", side : 1, col : 0, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "3D", side : 0, col : 1, pos : 0}},
			{id : 1, toSend : {action : "Place", card : "3D", side : 1, col : 1, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "2H", side : 0, col : 2, pos : 0}},
			{id : 1, toSend : {action : "Place", card : "3C", side : 1, col : 2, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "7C", side : 0, col : 0, pos : 1}},
			{id : 1, toSend : {action : "Place", card : "JH", side : 0, col : 1, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "8C", side : 0, col : 0, pos : 2}},
			{id : 1, toSend : {action : "Place", card : "AS", side : 1, col : 2, pos : 1}},
			{id : 0, toSend : {action : "Place", card : "QS", side : 0, col : 0, pos : 2}},
			{id : 1, toSend : {action : "Place", card : "YD", side : 1, col : 1, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "AS", side : 0, col : 0, pos : 3}},
			{id : 1, toSend : {action : "Place", card : "4D", side : 1, col : 0, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "6D", side : 0, col : 1, pos : 0}},
			{id : 1, toSend : {action : "DismissCard", card : "2S"}},
			{id : 0, toSend : {action : "Place", card : "KH", side : 0, col : 1, pos : 0}},
			{id : 1, toSend : {action : "DismissLane", col : 1}},
			{id : 0, toSend : {action : "Place", card : "KS", side : 0, col : 1, pos : 0}},
			{id : 1, toSend : {action : "Place", card : "6D", side : 1, col : 1, pos : 0}},
			{id : 0, toSend : {action : "Place", card : "5C", side : 0, col : 2, pos : 1}},
			{id : 1, toSend : {action : "Place", card : "KC", side : 0, col : 2, pos : 1}},
			{id : 0, toSend : {action : "Place", card : "7S", side : 0, col : 2, pos : 2}},
			{id : 1, toSend : {action : "Place", card : "9S", side : 1, col : 1, pos : 1}},
			{id : 0, toSend : {action : "Place", card : "6S", side : 0, col : 2, pos : 3}}
		],
		"Valid CN game"
	);
	tests.handleInit = (game) => {
		game.players[0].deck = [
			'2C', '2S', '2D', 'TD', '8D', 'QD', '7H',
			'9C', '8C', '9D', 'QH', '3C', '4S', 'AH',
			'8H', 'QC', '4C', '3H', 'AD', '5S', 'TC',
			'KH', 'JD', '9S', '8S', 'JH', 'JS', 'TS',
			'JC', '7C', '7S',' YD', '4H', '9H', '7D',
			'4D', '6S', '6H', 'QS', 'KS', '2H', 'TH',
			'6D', '5D', 'AS', '3D', 'KC', 'KD',
			'YR', 'AC', '4S', '6C', '5H', '5C', '3S'
		];
		game.players[1].deck = [
			'4H', 'AC', 'KD', '2D', 'JD', '6C', 'JS',
			'9S', '9H', '3S', '8H', '9D', 'KD', '5C',
		 	'QC', '2H', '3D', 'JH', '8S', '7C', 'TS',
			'3C', '7H', '7D', '7S', '4C', 'QD', '4S',
			'YR', 'QS', '5D', 'QH', 'KS', '5H', 'TH',
			'AS', '6H', 'AD', '5S', '6S', '4D',
			'6D', 'JC', '3H', 'YD', '8D', '9C', 'AH',
			'2C', 'TD', 'KH', '8C', 'TC', '2S'
		];
		game.handleInit(game);
	}
	completedTests += await runWsTest(
		[{
			toReceive : [
				{event : "joined", players : []},
				{event : "join", name : "Beta", id : 1},
				{event : "start", hand : ["3S", "5C", "5H", "6C", "4S", "AC", "YR", "KD"]},
				{event : "place", card: "3S", side: 0, col: 0, pos: 0},
				{event : "place", card: "2S", side: 1, col: 0, pos: 0},
				{event : "place", card: "5C", side: 0, col: 1, pos: 0},
				{event : "place", card: "TC", side: 1, col: 1, pos: 0},
				{event : "place", card: "5H", side: 0, col: 2, pos: 0},
				{event : "place", card: "8C", side: 1, col: 2, pos: 0},
				{event : "place", card: "6C", newCard : "KC", side: 0, col: 2, pos: 1},
				{event : "place", card: "KH", side: 1, col: 2, pos: 0},
				{event : "place", card: "4S", newCard : "3D", side: 0, col: 0, pos: 1},
				{event : "place", card: "TD", side: 1, col: 0, pos: 1},
				{event : "place", card: "AC", newCard : "AS", side: 0, col: 1, pos: 1},
				{event : "place", card: "2C", side: 1, col: 1, pos: 1},
				{event : "place", card: "YR", newCard : "5D", side: 0, col: 1, pos: 1},
				{event : "place", card: "AH", side: 1, col: 2, pos: 0},
				{event : "place", card: "KD", newCard : "6D", side: 0, col: 2, pos: 0},
				{event : "place", card: "9C", side: 1, col: 1, pos: 0},
				{event : "place", card: "KC", newCard : "TH", side: 0, col: 0, pos: 1},
				{event : "place", card: "8D", side: 1, col: 1, pos: 1},
				{event : "place", card: "3D", newCard : "2H", side: 0, col: 1, pos: 1}
			],
			closeStep : 22
		},
		{
			toReceive : [
				{event : "joined", players : ["Alpha"]},
				{event : "start", hand : ["2S", "TC", "8C", "KH", "TD", "2C", "AH", "9C"]},
				{event : "place", card: "3S", side: 0, col: 0, pos: 0},
				{event : "place", card: "2S", side: 1, col: 0, pos: 0},
				{event : "place", card: "5C", side: 0, col: 1, pos: 0},
				{event : "place", card: "TC", side: 1, col: 1, pos: 0},
				{event : "place", card: "5H", side: 0, col: 2, pos: 0},
				{event : "place", card: "8C", side: 1, col: 2, pos: 0},
				{event : "place", card: "6C", side: 0, col: 2, pos: 1},
				{event : "place", card: "KH", newCard : "8D", side: 1, col: 2, pos: 0},
				{event : "place", card: "4S", side: 0, col: 0, pos: 1},
				{event : "place", card: "TD", newCard : "YD", side: 1, col: 0, pos: 1},
				{event : "place", card: "AC", side: 0, col: 1, pos: 1},
				{event : "place", card: "2C", newCard : "3H", side: 1, col: 1, pos: 1},
				{event : "place", card: "YR", side: 0, col: 1, pos: 1},
				{event : "place", card: "AH", newCard : "JC", side: 1, col: 2, pos: 0},
				{event : "place", card: "KD", side: 0, col: 2, pos: 0},
				{event : "place", card: "9C", newCard : "6D", side: 1, col: 1, pos: 0},
				{event : "place", card: "KC", side: 0, col: 0, pos: 1},
				{event : "place", card: "8D", newCard : "4D", side: 1, col: 1, pos: 1},
				{event : "place", card: "3D", side: 0, col: 1, pos: 1}
			],
			closeStep : 22
		}],
		[
			{id : 0, toSend : {gameId : "CN", name : "Alpha"}},
			{id : 1, toSend : {gameId : "CN", name : "Beta"}},
			{id : 1, toSend : {action : "Start"}},
			{id : 0, toSend : { action: 'Place', card: '3S', side: 0, col: 0, pos: 0 }},
			{id : 1, toSend : { action: 'Place', card: '2S', side: 1, col: 0, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: '5C', side: 0, col: 1, pos: 0 }},
			{id : 1, toSend : { action: 'Place', card: 'TC', side: 1, col: 1, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: '5H', side: 0, col: 2, pos: 0 }},
			{id : 1, toSend : { action: 'Place', card: '8C', side: 1, col: 2, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: '6C', side: 0, col: 2, pos: 1 }},
			{id : 1, toSend : { action: 'Place', card: 'KH', side: 1, col: 2, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: '4S', side: 0, col: 0, pos: 1 }},
			{id : 1, toSend : { action: 'Place', card: 'TD', side: 1, col: 0, pos: 1 }},
			{id : 0, toSend : { action: 'Place', card: 'AC', side: 0, col: 1, pos: 1 }},
			{id : 1, toSend : { action: 'Place', card: '2C', side: 1, col: 1, pos: 1 }},
			{id : 0, toSend : { action: 'Place', card: 'YR', side: 0, col: 1, pos: 1 }},
			{id : 1, toSend : { action: 'Place', card: 'AH', side: 1, col: 2, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: 'KD', side: 0, col: 2, pos: 0 }},
			{id : 1, toSend : { action: 'Place', card: '9C', side: 1, col: 1, pos: 0 }},
			{id : 0, toSend : { action: 'Place', card: 'KC', side: 0, col: 0, pos: 1 }},
			{id : 1, toSend : { action: 'Place', card: '8D', side: 1, col: 1, pos: 1 }},
			{id : 0, toSend : { action: 'Place', card: '3D', side: 0, col: 1, pos: 1 }}
		],
		"Other CN game"
	);
	return completedTests;
}

const assertEq = (a, b) => {
	if (a != b) {
		throw `got ${a}, expected ${b}`;
	}
}

const assertJsonEq = (a, b) => {
	const ja = JSON.stringify(a);
	const jb = JSON.stringify(b);
	if (ja != jb) {
		throw `got ${ja}, expected ${jb}`;
	}
}

const fnEqTest = (f, args, expected) => {
	return (msg) => {
		try {
			const res = f(...args);
			assertEq(res, expected);
			return 1;
		} catch (err) {
			testOut("Test failed,", err + ",", msg);
		}
		return 0;
	};
}

const stateEqTest = (f, args, expected) => {
	return (msg) => {
		try {
			f(...args);
			args.forEach((arg, i) => {
				if (expected[i] != undefined) {
					assertJsonEq(arg, expected[i]);
				}
			});
		} catch (err) {
			testOut("Test failed,", err + ",", msg);
			return 0;
		}
		return 1;
	}
}

const runUnitTest = (tests, name)  => {
	testOut(`\nRunning test '${name}'`);
	let count = 0;
	tests.forEach((test, index) => {
		count += test(`test ${index}`);
	});
	totalTests += 1;
	return count == tests.length ? 1 : 0;
}


const unitTestsT8 = () => {
	let completedTests = 0;
	completedTests += runUnitTest(
		[
			fnEqTest(T8._hasMove, [["2S"] , {pile : ["3S"], color : "S"}], true),
			fnEqTest(T8._hasMove, [["2S", "3D", "KC"] , {pile : ["5D", "9D"], color : "D"}], true),
			fnEqTest(T8._hasMove, [["8C"] , {pile : ["8D"], color : "C"}], false),
			fnEqTest(T8._hasMove, [["AD"] , {pile : ["7D", "8D", "9D"], color : "D"}], false),
			fnEqTest(T8._hasMove, [["AD", "2C"] , {pile : ["7D", "8D", "9D"], color : "D"}], true),
			fnEqTest(T8._hasMove, [["AD", "2C"] , {pile : ["7D", "8D", "9H"], color : "H"}], false)
		],
		"T8.hasMove unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(T8._validateMove, [["7D"], "D", "5D", ["8C", "9S", "AD"]], true),
			fnEqTest(T8._validateMove, [["7D"], "D", "5D", []], true),
			fnEqTest(T8._validateMove, [["5C"], "C", "8S", ["TH"]], true),
			fnEqTest(T8._validateMove, [["KH"], "D", "8H", ["8C", "9S", "AD"]], false),
			fnEqTest(T8._validateMove, [["KH"], "D", "5D", ["8C", "9S", "AD"]], false),
			fnEqTest(T8._validateMove, [["9H", "9D"], "H", "5H", ["8C", "9S"]], true),
			fnEqTest(T8._validateMove, [["9D", "9H"], "H", "5H", ["8C", "9S"]], false),
			fnEqTest(T8._validateMove, [["TS", "TH", "TD", "TC"], "S", "2S", []], true),
			fnEqTest(T8._validateMove, [["TH", "TD", "TC"], "S", "TS", ["8S"]], true),
			fnEqTest(T8._validateMove, [["7D", "9D", "TD"], "D", "TD", ["8S"]], false)
		],
		"T8.validateMove standard move unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(T8._validateMove, [["AD"], "D", "5D", ["8C", "9S", "AD"]], true),
			fnEqTest(T8._validateMove, [["AC", "AS"], "C", "8S", ["TH"]], true),
			fnEqTest(T8._validateMove, [["AS", "AC"], "C", "8S", ["TH"]], false),
			fnEqTest(T8._validateMove, [["AH"], "S", "AS", ["8C", "9S", "AD"]], true),
			fnEqTest(T8._validateMove, [["AH", "AD"], "S", "AS", ["8C", "9S"]], true),
			fnEqTest(T8._validateMove, [["AH"], "S", "7S", ["8C", "9S"]], false),
			fnEqTest(T8._validateMove, [["AH"], "H", "7H", []], false)
		],
		"T8.validateMove ace unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(T8._validateMove, [["8D"], "D", "5D", ["7C", "9S", "AC"]], true),
			fnEqTest(T8._validateMove, [["8C"], "C", "8S", ["8D", "8H"]], true),
			fnEqTest(T8._validateMove, [["8C", "AC"], "C", "8S", ["TC"]], false),
			fnEqTest(T8._validateMove, [["8C", "8H"], "C", "8S", ["TC"]], false),
			fnEqTest(T8._validateMove, [["8D"], "D", "TD", ["AD"]], false),
			fnEqTest(T8._validateMove, [["8D", "8H"], "D", "TD", ["AC"]], false),
			fnEqTest(T8._validateMove, [["8D"], "D", "TD", []], false),
		],
		"T8.validateMove 8 unit test"
	);
	return completedTests;
};

const unitTestsCN = () => {
	let completedTests = 0;
	completedTests += runUnitTest(
		[
			fnEqTest(CN._getNumber, ["AS"], 1),
			fnEqTest(CN._getNumber, ["5D"], 5),
			fnEqTest(CN._getNumber, ["8S"], 8),
			fnEqTest(CN._getNumber, ["TS"], 10)
		],
		"CN.getNumber unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(CN._getValue, [{card : "8C", specials : []}], 8),
			fnEqTest(CN._getValue, [{card : "AD", specials : ["QC", "YR"]}], 1),
			fnEqTest(CN._getValue, [{card : "TD", specials : ["KH"]}], 20),
			fnEqTest(CN._getValue, [{card : "4D", specials : ["QS", "JD", "KD"]}], 8),
			fnEqTest(CN._getValue, [{card : "2D", specials : ["QS", "KD", "QD", "KD", "KS", "YB", "KS", "KC", "KC"]}], 128)
		],
		"CN.getValue unit test"
	);
	const card = (c, s = []) => {return {card : c, specials : s}};
	const pile = (color = "?", dir = 0, cards = [], value = 0) => {return {cards : cards, value : value, color : color, dir : dir}};
	completedTests += runUnitTest(
		[
			stateEqTest(CN._updatePile, [{cards : [], value : 13, color : "C", dir : -1}], [{cards : [], value : 13, color : "?", dir : 0}]),
			stateEqTest(CN._updatePile, 
				[{cards : [card("2C")], value : 2, color : "C", dir : 1}], 
				[{cards : [card("2C")], value : 2, color : "C", dir : 0}]
			),
			stateEqTest(CN._updatePile, 
				[{
					cards : [card("2C"), card("5D"), card("4D"), card("3S"), card("2D")],
					value : 16,
					color : "S",
					dir : -1
				}],
				[{
					cards : [card("2C"), card("5D"), card("4D"), card("3S"), card("2D")],
					value : 16,
					color : "D",
					dir : -1
				}]
			),
			stateEqTest(CN._updatePile,
				[{cards : [card("8D", ["KH", "KD"]),card("4S", ["QS"]),card("5S", ["QD"])], value : 39, color : "S", dir : -1}],
				[{cards : [card("8D", ["KH", "KD"]),card("4S", ["QS"]),card("5S", ["QD"])], value : 39, color : "D", dir : -1}]
			),
			stateEqTest(CN._updatePile,
				[{cards : [card("5C"), card("9D", ["QS", "QH"])], value : 14, color : "S", dir : -1}],
				[{cards : [card("5C"), card("9D", ["QS", "QH"])], value : 14, color : "H", dir : 1}]
			)
		],
		"CN.updatePile unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(CN._validateMove, [{card : "5D", side : 0, col : 1, pos : 0}, {setup : true, setupStep : 1},
					{id : 0},
					false
				], 
				true
			),	
			fnEqTest(CN._validateMove, [{card : "QD", side : 1, col : 0, pos : 0}, {setup : true, setupStep : 0},
					{id : 1},
					true
				], 
				false
			),
			fnEqTest(CN._validateMove, [{card : "AH", side : 1, col : 2, pos : 0}, {setup : true, setupStep : 1},
					{id : 1},
					false
				], 
				false
			),
			fnEqTest(CN._validateMove, [{card : "6H", side : 1, col : 0, pos : 0}, {setup : true, setupStep : 0},
					{id : 0},
					false
				], 
				false
			),
			fnEqTest(CN._validateMove, [{card : "8C", side : 1, col : 0, pos : 1}, {setup : true, setupStep : 0},
					{id : 1},
					false
				], 
				false
			)
		],
		"CN.validateMove setup unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(CN._validateMove, [{card : "AH", side : 1, col : 2, pos : 0},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile()]]},
				{id : 1},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "5C", side : 0, col : 1, pos : 2},
				{setup : false, caravans : [[pile("D", 1, [card("4H"), card("6D")]), pile("C", 1, [card("4D"), card("6C")]), pile()], [pile(), pile(), pile()]]},
				{id : 0},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "7H", side : 0, col : 0, pos : 2},
				{setup : false, caravans : [[pile("D", 1, [card("4H"), card("6D")]), pile("C", 1, [card("4D"), card("6C")]), pile()], [pile(), pile(), pile()]]},
				{id : 0},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "3H", side : 0, col : 0, pos : 2},
				{setup : false, caravans : [[pile("D", -1, [card("4H"), card("6D", ["QD"])]), pile("C", 1, [card("4D"), card("6C")]), pile()], [pile(), pile(), pile()]]},
				{id : 0},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "8D", side : 1, col : 0, pos : 2},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile("D", -1, [card("4H"), card("6S", ["QD"])]), pile("C", 1, [card("4D"), card("6C")]), pile()]]},
				{id : 1},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "TS", side : 1, col : 2, pos : 1},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 0, [card("4H")])]]},
				{id : 1},
				false
			], true),
			fnEqTest(CN._validateMove, [{card : "4S", side : 1, col : 2, pos : 1},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 0, [card("4H")])]]},
				{id : 0},
				false
			], false),
			fnEqTest(CN._validateMove, [{card : "5S", side : 1, col : 2, pos : 2},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 1, [card("4H"), card("6H")])]]},
				{id : 0},
				false
			], false),
			fnEqTest(CN._validateMove, [{card : "TS", side : 1, col : 2, pos : 0},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 0, [card("4H")])]]},
				{id : 1},
				false
			], false),
			fnEqTest(CN._validateMove, [{card : "TS", side : 1, col : 2, pos : 2},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 0, [card("4H")])]]},
				{id : 1},
				false
			], false),
			fnEqTest(CN._validateMove, [{card : "TS", side : 0, col : 2, pos : 1},
				{setup : false, caravans : [[pile(), pile(), pile()], [pile(), pile(), pile("H", 0, [card("4H")])]]},
				{id : 1},
				false
			], false)
		],
		"CN.validateMove non-specials unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(CN._validateMove, [
				{card : "QS", side : 0, col : 0, pos : 2}, 
				{setup : false, caravans : [
					[
						pile("S", 1, [card("3H"), card("5S"), card("9S")]),
						pile(),
						pile()
					], 
					[
						pile("H", 0, [card("2H")]),
						pile(),
						pile()
					]
				]},
				{id : 1},
				true
			], true),
			fnEqTest(CN._validateMove, [
				{card : "QS", side : 0, col : 0, pos : 1}, 
				{setup : false, caravans : [
					[
						pile("S", 1, [card("3H"), card("5S"), card("9S")]),
						pile(),
						pile()
					], 
					[
						pile("H", 0, [card("2H")]),
						pile(),
						pile()
					]
				]},
				{id : 1},
				true
			], false),
			fnEqTest(CN._validateMove, [
				{card : "KS", side : 1, col : 0, pos : 0}, 
				{setup : false, caravans : [
					[
						pile("D", -1, [card("3H"), card("5D"), card("4D")]),
						pile(),
						pile()
					], 
					[
						pile("H", 0, [card("2H")]),
						pile(),
						pile()
					]
				]},
				{id : 1},
				true
			], true),
			fnEqTest(CN._validateMove, [
				{card : "YR", side : 0, col : 1, pos : 0}, 
				{setup : false, caravans : [
					[
						pile("S", -1, [card("3H"), card("5S"), card("3S")]),
						pile(),
						pile()
					], 
					[
						pile("C", 0 [card("2C")]),
						pile(),
						pile()
					]
				]},
				{id : 1},
				true
			], false)
		],
		"CN.validateMove specials unit test"
	);
	completedTests += runUnitTest(
		[
			stateEqTest(CN._placeSpecial, 
				[{card : "QC", side : 1, col : 2, pos : 0}, ...(() => {
					const p1 = pile("D", 0, [card("5D")], 5);
					return [[[pile(), pile(), pile()], [pile(), pile(), p1]], p1];
					
				})()], 
				[undefined, [[pile(), pile(), pile()], [pile(), pile(), pile("C", 0, [card("5D", ["QC"])], 5)]], pile("C", 0, [card("5D", ["QC"])], 5)]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "QD", side : 0, col : 1, pos : 2}, ...(() => {
					const p1 = pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC")], 24);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("D", -1, [card("5D"), card("9S", ["YR"]), card("TC", ["QD"])], 24), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("D", -1, [card("5D"), card("9S", ["YR"]), card("TC", ["QD"])], 24)]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "QC", side : 0, col : 1, pos : 2}, ...(() => {
					const p1 = pile("D", -1, [card("5D"), card("9S", ["YR"]), card("TC", ["QD"])], 24);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC", ["QD", "QC"])], 24), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC", ["QD", "QC"])], 24)]
			)
		],
		"CN.placeSpecial queen unit test"
	);
	completedTests += runUnitTest(
		[
			stateEqTest(CN._placeSpecial, 
				[{card : "KC", side : 1, col : 2, pos : 0}, ...(() => {
					const p1 = pile("D", 0, [card("5D")], 5);
					return [[[pile(), pile(), pile()], [pile(), pile(), p1]], p1];
					
				})()], 
				[undefined, [[pile(), pile(), pile()], [pile(), pile(), pile("D", 0, [card("5D", ["KC"])], 10)]], pile("D", 0, [card("5D", ["KC"])], 10)]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "KD", side : 0, col : 1, pos : 1}, ...(() => {
					const p1 = pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC")], 24);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("C", 1, [card("5D"), card("9S", ["YR", "KD"]), card("TC")], 33), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("C", 1, [card("5D"), card("9S", ["YR", "KD"]), card("TC")], 33)]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "KC", side : 0, col : 1, pos : 2}, ...(() => {
					const p1 = pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC", ["KD"])], 34);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC", ["KD", "KC"])], 54), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC", ["KD", "KC"])], 54)]
			)
		],
		"CN.placeSpecial king unit test"
	);
	completedTests += runUnitTest(
		[
			stateEqTest(CN._placeSpecial, 
				[{card : "JC", side : 1, col : 2, pos : 0}, ...(() => {
					const p1 = pile("D", 0, [card("5D")], 5);
					return [[[pile(), pile(), pile()], [pile(), pile(), p1]], p1];
					
				})()], 
				[undefined, [[pile(), pile(), pile()], [pile(), pile(), pile()]], pile()]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "JD", side : 0, col : 1, pos : 1}, ...(() => {
					const p1 = pile("C", 1, [card("5D"), card("9S", ["YR"]), card("TC")], 24);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("C", 1, [card("5D"), card("TC")], 15), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("C", 1, [card("5D"), card("TC")], 15)]
			),
			stateEqTest(CN._placeSpecial,
				[{card : "JD", side : 0, col : 1, pos : 2}, ...(() => {
					const p1 = pile("C", 1, [card("TS"), card("9C", ["YR"]), card("TC", ["KD"])], 34);
					return [[[pile("D", 0, [card("6D")], 6), p1, pile()], [pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]], p1];
				})()],
				[undefined, [
					[pile("D", 0, [card("6D")], 6), pile("C", -1, [card("TS"), card("9C", ["YR"])], 14), pile()],
					[pile(), pile("S", 1, [card("TD"), card("4S"), card("6S")], 20), pile()]
				], pile("C", -1, [card("TS"), card("9C", ["YR"])], 14)]
			)
		],
		"CN.placeSpecial jack unit test"
	);
	completedTests += runUnitTest(
		[
			stateEqTest(CN._placeSpecial,
				[{card : "YR", side : 0, col : 1, pos : 2}, ...(() => {
					const p1 = pile("C", 1, [card("5S"), card("6D"), card("7C"), card("8C")], 26);
					return [
						[[pile("D", 0, [card("7D")], 7), p1, pile("D", -1, [card("7S"), card("5D")], 12)],
						[pile("S", 0, [card("5D", ["QH"]), card("7H", ["QS"])], 12), pile(), pile()]
					], p1];
				})()],
				[undefined, [[pile(), pile("C", 1, [card("5S"), card("6D"), card("7C", ["YR"]), card("8C")], 26), pile("D", 0, [card("5D")], 5)], 
				[pile("H", 0, [card("5D", ["QH"])], 5), pile(), pile()]], 
				pile("C", 1, [card("5S"), card("6D"), card("7C", ["YR"]), card("8C")], 26)]
			)
		],
		"CN.placeSpecial joker unit test"
	);
	completedTests += runUnitTest(
		[
			fnEqTest(CN._getWinner, 
				[[[{value : 5}, {value : 3}, {value : 20}], [{value : 21}, {value : 27}, {value : 20}]]], -1
			),
			fnEqTest(CN._getWinner,
				[[[{value : 26}, {value : 26}, {value : 26}], [{value : 19}, {value : 20}, {value : 20}]]], 0
			),
			fnEqTest(CN._getWinner, 
				[[[{value : 22}, {value : 23}, {value : 24}], [{value : 25}, {value : 26}, {value : 27}]]], 1
			),	
			fnEqTest(CN._getWinner, 
				[[[{value : 26}, {value : 26}, {value : 22}], [{value : 19}, {value : 20}, {value : 22}]]], -1
			)
		],
		"CN.getWinner unit test"
	);
	return completedTests;
};

const testOut = console.log;
let totalTests = 0;

const tests = {
	general : async () => {
		console.log = (msg) => {};
		let completedTests = 0;
		totalTests = 0;
		completedTests += unitTestsT8();
		completedTests += unitTestsCN();
		completedTests += await wsLobbyTest();
		completedTests += await wsTestT8();
		completedTests += await wsTestCN();
		testOut(`Passed ${completedTests} tests out of ${totalTests}`);
		console.log = testOut;
	},
	handleInit : (game) => {}
};
module.exports = tests;
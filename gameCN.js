"use strict";

const gameModule = require('./game.js');

const getNumber = (card) => {
	if (card[0] == "A") return 1;
	if (card[0] == "T") return 10;
	return Number(card[0]);
}

const getValue = (pileEntry) => {
	let num = getNumber(pileEntry.card);
	pileEntry.specials.forEach((card) => {
		if (card[0] == "K") {
			num += num;
		}
	});
	return num;
};

//Updates the color and direction of a pile.
const updatePile = (pile) => {
	if (pile.cards.length == 0) {
		pile.color = "?";
		pile.dir = 0;
		return;
	} 
	const topCard = pile.cards[pile.cards.length - 1];
	if (pile.cards.length == 1){
		pile.dir = 0;
	} else {
		const diff = getNumber(topCard.card) - getNumber(pile.cards[pile.cards.length - 2].card);
		if (diff == 0) {
			pile.dir = 0;
		} else if (diff > 0) {
			pile.dir = 1;
		} else {
			pile.dir = -1;
		}
	}
	pile.color = topCard.card[1];
	for (const card of topCard.specials) {
		if (card[0] == "Q") {
			pile.color = card[1];
			pile.dir *= -1;
		}
	}
}

const validateMove = (data, game, player, isSpecial) => {	
	if (game.setup) {
		if (isSpecial) {
			return false;
		}
		if (data.side != player.id) {
			return false;
		}
		if (data.col != game.setupStep) {
			return false;
		}
		if (data.pos != 0) {
			return false;
		}
		return true;
	}
	const pile = game.caravans[data.side][data.col];
	if (isSpecial) {
		if (data.card[0] == "Q" && data.pos != pile.cards.length - 1) {
			return false;
		}
		if (data.pos >= pile.cards.length) {
			return false;
		}
		return true;
	} else {
		if (data.pos != pile.cards.length || data.side != player.id) {
			return false;
		}
		if (pile.cards.length == 0) {
			return true;
		}

		const diff = getNumber(data.card) - getNumber(pile.cards[pile.cards.length - 1].card);

		if (diff == 0) {
			return false;
		}
		if (pile.color != data.card[1] && ((diff > 0 && pile.dir == -1) || (diff < 0 && pile.dir == 1) )) {
			return false;
		}
		return true;
	}
};


const placeSpecial = (data, caravans, pile) => {
	const targetCard = pile.cards[data.pos];
	switch (data.card[0]) {
		case "J":
			pile.value -= getValue(targetCard);
			pile.cards.splice(data.pos, 1);
			updatePile(pile);
			break;
		case "Q":
			pile.color = data.card[1];
			pile.dir *= -1;
			targetCard.specials.push(data.card);
			break;
		case "K":
			pile.value += getValue(targetCard);
			targetCard.specials.push(data.card);
			break;
		case "Y":
			const ace = targetCard.card[0] == "A";
			for (let i = 0; i < caravans.length; i++) {
				const side = caravans[i];
				for (let j = 0; j < side.length; j++) {
					const pile = side[j];
					for (let k = 0; k < pile.cards.length; k++) {
						if (i == data.side && j == data.col && k == data.pos) {
							continue;
						}
						const card = pile.cards[k];
						if ((ace && card.card[1] == targetCard.card[1]) || (!ace && card.card[0] == targetCard.card[0])) {
							pile.value -= getValue(card);
							pile.cards.splice(k, 1);
							k--;
						}
					}
					updatePile(pile);
				}
			}
			targetCard.specials.push(data.card);
			break;
	}	
};

const getWinner = (caravans) => {
	let p0Wins = 0, p1Wins = 0;
	for (let i = 0; i < 3; i++) {
		const s0 = caravans[0][i].value;
		const s1 = caravans[1][i].value;
		s0 = s0 >= 21 && s0 <= 26 ? s0 : 0;
		s1 = s1 >= 21 && s1 <= 26 ? s1 : 0;
		if (s0 > s1) p0Wins += 1;
		else if (s1 > s0) p1Wins += 1;
	}
	if (p1Wins + p2Wins == 3) {
		if (p1Wins > p2Wins) return 0;
		else return 1;
	} else {
		return -1;
	}
};

const handlePlace = (data, game, player) => {
	if(player.id != game.turn) {
		player.close(1000, "Not your turn");
		return;
	}
	if (
		Object.keys(data) != 4 ||
		typeof data.card != "string" ||
		!Number.isInteger(data.side) || 
		!Number.isInteger(data.col) || 
		!Number.isInteger(data.pos) ||
		!(data.side == 0 || data.side == 1) ||
		!(data.col >= 0 && data.col < 3)
	) {
		player.close(1000, "Bad message");
		return;
	}
	if (!player.hand.includes(data.card)) {
		player.close(1000, "Played card not in hand");
		return;
	}
	const isSpecial = "JQKY".includes(data.card[0]);

	if (!validateMove(data, game, player, isSpecial)) {
		player.close(1000, "Ilegal move");
		return;
	}
	const pile = game.caravans[data.side][data.col];
	if (isSpecial) {
		placeSpecial(data, game.caravans, pile);
	} else {
		pile.cards.push({card : data.card, specials : []});
		pile.value += getNumber(data.card); // New card wont have kings, so no need for getValue.
		updatePile(pile);
	}
	player.hand.splice(player.hand.indexOf(data.card), 1);
	const winner = getWinner(game.caravans);
	let newCard = undefined;
	if (player.deck.length > 0 && !game.setup) {
		newCard = player.deck.pop();
		player.hand.push(newCard);
	} else if (player.hand.length == 0 && winner != player.id) {
		winnder = (player.id + 1) % 2;
		return;
	}
	game.players.forEach((player, id) => {
		if (id == player.id && newCard) {
			player.send(`{"event" : "place", "card" : "${data.card}", "newCard" : "${newCard}"}`);
		} else {
			player.send(`{"event" : "place", "card" : "${data.card}"}`);
		}
		if (winner != -1) {
			player.close(1000, "Game is over");
		}
	});
	if (game.turn == 1) {
		game.turn = 0;
		if (game.setup) {
			game.setupStep += 1;
			if (game.setupStep > 2) {
				game.setup = false;
			}
		}
	} else {
		game.turn = 1;
	}
}

const handleDismissCard = (data, game, player) => {
	if (Object.keys(data) != 2 || typeof data.card != 'string') {
		player.close(1000, "Bad message");
		return;
	}
	if (game.turn != player.id) {
		player.close(1000, "Not your turn");
		return;
	}
	if (!player.hand.includes(data.card)) {
		player.close(1000, "Dismissed card not in hand");
		return;
	}
	player.hand.splice(player.hand.indexOf(data.card), 1);
	let newCard = undefined;
	if (player.deck.length > 0) {
		newCard = player.deck.pop();
		player.hand.push(newCard);
	}
	const otherId = (game.turn + 1) % 2;
	player.send(`{"event" : "dismissCard" ${newCard ? ', "newCard" : "' + newCard + '"' : ""}}`);
	game.players[otherId].send('{"event" : "dismissCard"}');
	if (!game.setup) {
		game.turn = otherId;
	}
};

const handleDismissLane = (data, game, player) => {
	if (Object.keys(data) != 2 || !Number.isInteger(data.col) || data.col < 0 || data.col > 2) {
		player.close(1000, "Bad message");
		return;
	}
	if (game.turn != player.id) {
		player.close(1000, "Not your turn");
		return;
	}
	const pile = game.caravans[player.id][data.col];
	pile.cards.length = 0;
	pile.value = 0;
	updatePile(pile);
	const winner = getWinner(game.caravans);
	for (const player of game.players) {
		player.send(`{"event" : "dismissLane", "col" : ${data.col}}`);
		if (winner != -1) {
			player.close(1000, "Game is over");
		}
	}
};


const handleCNMessage = (data, game, player) => {
	switch(data.action) {
		case "Start":
			break;
		case "Place":
			handlePlace(data, game, player);
			break;
		case "DismissCard":
			handleDismissCard(data, game, player);
			break;
		case "DismissLane":
			handleDismissLane(data, game, player);
			break;
		default:
			player.close(1000, "Bad message");
	}
};

const handleCNClose = (game, player) => {
	const otherPlayer = (player.id + 1) % 2;
	game.players[otherPlayer].send(`{"event" : "leave", "id" : ${player.id}}`);
	game.players[otherPlayer].close(1000, "Game is over");
}


const handleCNInit = (game) => {
	game.turn = 0;
	game.caravans = [
		[
			{cards : [], color : "?", dir : 0, value : 0}, {cards : [], color : "?", dir : 0, value : 0}, {cards : [], color : "?", dir : 0, value : 0}
		],
		[
			{cards : [], color : "?", dir : 0, value : 0}, {cards : [], color : "?", dir : 0, value : 0}, {cards : [], color : "?", dir : 0, value : 0}
		]
	];
	game.setup = true;
	game.setupStep = 0;
	game.players.forEach((player) => {
		player.deck = gameModule.createDeck(true);
		gameModule.shuffleDeck(player.deck);
		player.playing = true;
		player.hand = [];
		for (let i = 0; i < 8; i++) {
			player.hand.push(player.deck.pop());
		}
		player.send(`{"event" : "start", "hand" : [${player.hand.map((c) => '"' + c + '"')}]}`);
	});
};


const CN = {
	handleInit : handleCNInit,
	handleMessage : handleCNMessage,
	handleClose : handleCNClose,

	_getNumber : getNumber,
	_getValue : getValue,
	_updatePile : updatePile,
	_validateMove : validateMove,
	_placeSpecial : placeSpecial,
	_getWinner : getWinner,
	_handlePlace : handlePlace,
	_handleDismissCard : handleDismissCard,
	_handleDismissLane : handleDismissLane
};

module.exports = CN;
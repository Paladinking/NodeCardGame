"use strict";

const gameModule = require('./game.js');

const hasMove = (hand, game) => {
	if (hand.length == 1 &&(hand[0][0] == 'A' || hand[0][0] == '8')) {
		return false;
	}

	for (const card of hand) {
		if (card[0] == "8" || card[0] == game.pile[game.pile.length - 1][0] || card[1] == game.color) {
			return true;
		}
	} 
	return false;
}

const validateMove = (cards, color, topCard, hand) => {
	const cardNr = cards[0][0];
	if (cardNr == '8') {
		if (cards.length > 1) {
			return false;
		}
		if (hand.length == 0) {
			return false;
		}
		for (let i = 0; i < hand.length; i++) {
			if (hand[i][0] == '8') continue;
			if (hand[i][0] == topCard[0] || hand[i][1] == color) {
				return false;
			}
		}
		return true;
	} else {
		for (let i = 0; i < cards.length; i++) {
			if (cardNr != cards[i][0]) {
				return false;
			}
			if (cardNr != topCard[0] && cards[i][1] != color) {
				return false;
			} 
			topCard = cards[i];
			color = topCard[1];
		}
	}
	if (hand.length == 0 && cardNr == 'A') {
		return false;
	}
	return true;
};

const handlePlace = (data, game, player) => {
	if (player.chooseColor) {
		player.close(1000, "You should choose a color");
		return;
	}
	if (player.id != game.turn) {
		player.close(1000, "Not your turn");
		return;
	}

	if (!Array.isArray(data.cards)) {
		player.close(1000, "Bad message");
		return;
	}

	const cardNr = data.cards[0][0];

	for(let j = 0; j < data.cards.length; j++) {
		if (!player.hand.includes(data.cards[j])) {
			player.close(1000, "Played card not in hand");
			return;
		}
	}
	const hand = player.hand.filter((c) => !data.cards.includes(c));

	if (!validateMove(data.cards, game.color, game.pile[game.pile.length -1], hand)) {
		player.close(1000, "Invalid move");
		return;
	}

	if(cardNr == "8") {
		player.chooseColor = true;
	}
	player.draws = 0;
	for (let i = 0; i < data.cards.length; i++) {
		game.pile.push(data.cards[i]);
	}
	game.color = game.pile[game.pile.length -1][1];
	player.hand = hand;

	if (cardNr != 'A' && cardNr != '8') {
		gameModule.passTurn(game);
	}
	const playedCardsStr = `[${data.cards.map(c => '"' + c + '"')}]`;
	game.players.forEach((player, index) => {
		let newCards = [];
		if (cardNr == 'A' && index != game.turn) {
			for(let i = 0; i < data.cards.length; i++) {
				const card = gameModule.drawCard(game);
				player.hand.push(card);
				newCards.push(`"${card}"`);
			}
		}
		player.send(`{"event" : "place", "cards" : ${playedCardsStr}, "newCards" : [${newCards}]}`);
	});
	if (hand.length == 0) {
		game.remainingPlayers -= 1;
		if (game.remainingPlayers == 1) {
			game.players.forEach((player) => {
				player.close(1000, "Game is over");			
			});
		}
		player.playing = false;
	}
};

const handleDraw = (data, game, player) => {
	if (player.id != game.turn) {
		player.close(1000, "Not your turn");
		return;
	}
	player.draws++;
	const firstCard = player.hand[0];
	if (!(player.hand.length == 1 && (firstCard[0] == '8' || firstCard[0] == 'A'))) {
		if(hasMove(player.hand, game)) {
			player.close(1000, "Only draw when no legal move exists");
			return;
		}
	}

	const newCard = gameModule.drawCard(game);
	player.hand.push(newCard);

	const shouldPass = player.draws == 3 && !hasMove(player.hand, game);
	
	for (let i = 0; i < game.players.length; i++) {
		if (i == player.id) continue;
		game.players[i].send(`{"event" : "drawOther", "passed" : ${shouldPass}}`);
	}
	if (shouldPass) {
		player.draws = 0;
		gameModule.passTurn(game);
	}
	player.send(`{"event" : "drawSelf", "card" : "${newCard}"}`);
};

const handleChooseColor = (data, game, player) => {
	if (!player.chooseColor) {
		player.close(1000, "Not allowed to pick color");
		return;
	}
	if (!(data.color == "S" || data.color == "C" || data.color == "D" || data.color == "H")) {
		player.close(1000, "Not a valid color");
		return;
	} 
	player.chooseColor = false;
	game.color = data.color;
	gameModule.passTurn(game);
	game.players.forEach((player) => {
		player.send(`{"event" : "chooseColor", "color" : "${data.color}"}`);
	});
}


const handleT8Message = (data, game, player) => {
	switch (data.action) {
		case "Start" :
			break; // If several players start at the same time this event could get here.
		case "Place" : {
			handlePlace(data, game, player);
			break;
		}
		case "ChooseColor": {
			handleChooseColor(data, game, player);
			break;
		}
		case "Draw" : {
			handleDraw(data, game, player);
			break;
		}
		default : {
			socket.close(1000, "Invalid action");
			break;
		}
	}

};

let handleT8Init = (game) => {
	if (!game.deck) {
		game.deck = gameModule.createDeck();
		gameModule.shuffleDeck(deck);
	}
	game.turn = 0;
	let index = 0;
	while (game.deck[index][0] == 'A' || game.deck[index][0] == '8') {
		index++;
	}
	
	game.remainingPlayers = game.players.length;
	game.pile = game.deck.splice(index, 1);
	game.color = game.pile[0][1];
	game.players.forEach((player) => {
		player.hand = [];
		player.chooseColor = false;
		player.playing = true;
		player.draws = 0;
		for (let j =0 ; j < 7; j++) {
			player.hand.push(game.deck.pop());
		}
		player.send(`{"event" : "start", "topCard" : "${game.pile[0]}", "hand" : [${player.hand.map(c => '"'+ c + '"')}]}`);
	});
};

const handleT8Close = (game, player) => {
	if (game.remainingPlayers == 1) {
		return;
	}
	const topCard = game.pile.pop();
	game.pile.push(...player.hand, topCard);
	game.players.splice(player.id, 1);
	game.remainingPlayers -= 1;
	for (let i = 0; i < game.players.length; i++) {
		game.players[i].send(`{"event" : "leave", "id" : ${player.id}}`);
		if (game.remainingPlayers == 1) {
			game.players[i].close(1000, "Game is over");
		}
		if (game.players[i].id != i) {
			game.players[i].id = i;
		}
	}
	if (game.remainingPlayers == 1) {
		return;
	}

	gameModule.adjustTurn(game);
};

const T8 = {
	handleInit : handleT8Init,
	handleMessage : handleT8Message,
	handleClose : handleT8Close,
	
	_handleChooseColor : handleChooseColor,
	_handleDraw : handleDraw,
	_handlePlace : handlePlace,
	_hasMove : hasMove,
	_validateMove : validateMove
};

module.exports = T8;
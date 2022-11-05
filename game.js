"use strict";

const createDeck = (jokers = false) => {
	let deck = [];
	for (const number of "A23456789TJQK") {
		for (const color of "SCDH") {
			deck.push(number + color);
		}
	}
	if (jokers) {
		deck.push("YB");
		deck.push("YR");
	}
	return deck;
}

const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = deck[i];
        deck[i] = deck[j];
        deck[j] = temp;
    }
}

const drawCard = (game) => {
	const c = game.deck.pop();
	if (game.deck.length == 0) {
		const topCard = game.pile.pop();
		game.deck = game.pile;
		game.pile = [topCard];
		shuffleDeck(game.deck);
	}
	return c;
};

const passTurn = (game) => {
	game.turn++;
	adjustTurn(game);
}

const adjustTurn = (game) => {
	game.turn = game.turn % game.players.length;
	for (let i = 0; i < game.players.length; i++) {
		if (game.players[game.turn].playing) {
			return;
		}
		game.turn = (game.turn + 1) % game.players.length;
	}
	console.error("Nobody left playing...");
}

const game = {
	passTurn : passTurn,
	adjustTurn : adjustTurn,
	drawCard : drawCard,
	shuffleDeck : shuffleDeck,
	createDeck : createDeck
};

module.exports = game;
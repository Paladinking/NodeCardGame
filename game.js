"use strict";

const createDeck = () => {
	let deck = [];
	for (const number of "A23456789JQK") {
		for (const color of "SCDH") {
			deck.push(number + color);
		}
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
	for (let i = 0; i < game.players.length; i++) {
		game.turn = (game.turn + 1) % game.players.length;
		if (game.players[game.turn].playing) {
			return;
		}
	}
	console.err("Nobody left playing...");
}

const T8HasMove = (hand, game) => {
	if (hand.length == 1 &&(hand[0][0] == 'A' || hand[0][0] == '8')) {
		return false;
	}
	const topCard = game.pile[game.pile.length - 1];
	for (const card of hand) {
		if (card[0] == "8" || card[0] == topCard[0] || card[1] == game.color) {
			return true;
		}
	} 
	return false;
}

const handleT8Message = (data, game, player) => {
	switch (data.action) {
		case "Start" :
			break; // If several players start at the same time this event could get here.
		case "Place" : {
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
				if (data.cards[j][0] != cardNr) {
					player.close(1000, "Mismatching cards played");
				}
			}
			const hand = []; // Get remaining hand
			for (let i = 0; i < player.hand.length; i++) {
				if (!data.cards.includes(player.hand[i])) {
					hand.push(player.hand[i]);
				}
			}
			let topCard = game.pile[game.pile.length - 1];
			let color = game.color;		
			if (cardNr == '8') {
				if (data.cards.length > 1) {
					player.close(1000, "Multiple 8:s played");
					return;
				}
				if (hand.length == 0) {
					player.close(1000, "Cannot win on an 8");
					return;
				}
				for (let i = 0; i < hand.length; i++) {
					if (hand[i][0] == '8') continue;
					if (hand[i][0] == topCard[0] || hand[i][1] == color) {
						player.close(1000, "Not a valid 8 play");
						return;
					}
				}
				player.chooseColor = true;
			} else {
				for (let i = 0; i < data.cards.length; i++) {
					if (cardNr != topCard[0] && data.cards[i][1] != color) {
						player.close(1000, "Not a valid move");
						return;
					} 
					topCard = data.cards[i];
					color = topCard[1];
				}
			}
			if (hand.length == 0 && cardNr == 'A') {
				player.close(1000, "Cannot win on an Ace");
				return;
			}

			//Now the move is validated...
			//Now real changes to game can happen
			player.draws = 0;
			game.color = color;
			player.hand = hand;
			for (let i = 0; i < data.cards.length; i++) {
				game.pile.push(data.cards[i]);
			}

			if (cardNr != 'A' && cardNr != '8') {
				passTurn(game);
			}
			const playedCardsStr = `[${data.cards.map(c => '"' + c + '"')}]`;
			game.players.forEach((player, index) => {
				let newCards = [];
				if (cardNr == 'A' && index != game.turn) {
					for(let i = 0; i < data.cards.length; i++) {
						const card = drawCard(game);
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
			break;
		}
		case "ChooseColor": {
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
			passTurn(game);
			game.players.forEach((player) => {
				player.send(`{"event" : "chooseColor", "color" : "${data.color}"}`);
			});
			break;
		}
		case "Draw" : {
			if (player.id != game.turn) {
				player.close(1000, "Not your turn");
				return;
			}
			player.draws++;
			const firstCard = player.hand[0];
			if (!(player.hand.length == 1 && (firstCard[0] == '8' || firstCard[0] == 'A'))) {
				if(T8HasMove(player.hand, game)) {
					player.close(1000, "Only draw when no legal move exists");
					return;
				}
			}

			const newCard = drawCard(game);
			player.hand.push(newCard);

			const shouldPass = player.draws == 3 && !T8HasMove(player.hand, game);
	
			for (let i = 0; i < game.players.length; i++) {
				if (i == player.id) continue;
				game.players[i].send(`{"event" : "drawOther", "passed" : ${shouldPass}}`);
			}
			if (shouldPass) {
				player.draws = 0;
				passTurn(game);
			}
			player.send(`{"event" : "drawSelf", "card" : "${newCard}"}`);
			break;
		}
		default : {
			socket.close(1000, "Invalid action");
			break;
		}
	}

};

let handleT8Init = (game, deck) => {
	if (deck == undefined) {
		deck = createDeck();
		shuffleDeck(deck);
	}
	game.deck = deck;
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
	
	game.turn = game.turn % game.players.length;
	if(!game.players[game.turn].playing) {
		passTurn(game);
	}
};

const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

const game = {
	createGame : (game, gameName) => {
		switch (gameName) {
			case "T8":
				game.handleMessage = handleT8Message;
				game.handleClose = handleT8Close;
				game.handleInit = handleT8Init;
				break;
		}
		game.players.forEach((player) => {
			player.status = IN_GAME;
		});
	} 
};

module.exports = game;
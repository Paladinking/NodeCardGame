
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


const handleT8Message = (data, socket) => {
	switch (data.action) {
		case "Start" :
			break; // If several players start at the same time this event could get here.
		case "Place" :
			break;
			
	}

};

let handleT8Init = (game) => {
	game.deck = createDeck();
	game.turn = 0;
	game.players.forEach((player) => {
		player.gameData.hand = [];
		for (let j =0 ; j < 7; j++) {
			player.gameData.hand.push(game.deck.pop());
		}
		player.send(`{"event" : "start", "hand" : [${player.gameData.hand.map(c => '"'+ c + '"')}]}`);
	});
};

const handleT8Close = (socket) => {


};





const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

const game = {
	createGame : (lobby) => {
		let game = {players : lobby.players};
		lobby.players = [];
		switch (lobby.gameName) {
			case "T8":
				game.handleMessage = handleT8Message;
				game.handleClose = handleT8Close;
				game.handleInit = handleT8Init;
				break;
		}
		game.players.forEach((socket) => {
			socket.gameData.lobby = undefined;
			socket.game = game;
			socket.gameData.status = 2; //IN_GAME
		});
		game.handleInit(game);
	} 
};

module.exports = game;
const handleT8Message = (data, socket) => {
	

};



const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

const game = {
	createGame : (lobby) => {
		let game = {players : lobby.players};
		lobby.players = [];
		switch (lobby.name) {
			case "T8":
				game.handleMessage = handleT8Message;
				break;
		}
		game.players.forEach((socket) => {
			socket.game.lobby = undefined;
			socket.game.game = game;
			socket.game.status = 2; //IN_GAME
		});
	} 
};

module.exports = game;
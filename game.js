const handleT8Message = (data, socket) => {
	

};

const handleT8Close = (socket) => {


};



const UNIDENTIFIED = 0, IN_LOBBY = 1, IN_GAME = 2;

const game = {
	createGame : (lobby) => {
		let game = {players : lobby.players};
		lobby.players = [];
		switch (lobby.name) {
			case "T8":
				game.handleMessage = handleT8Message;
				game.handleClose = handleT8Close;
				break;
		}
		game.players.forEach((socket) => {
			socket.gameData.lobby = undefined;
			socket.game = game;
			socket.gameData.status = 2; //IN_GAME
		});
	} 
};

module.exports = game;
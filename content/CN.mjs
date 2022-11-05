const handleMessage = (msg, round) =>
{
    
};

const beginGame = (round) =>
/*The game begins with each player taking eight cards from their deck and placing 
either one numerical card or ace on each caravan. Players may not discard during this initial round. */

{
    //if isplayer först i arrayen 
    if(round.players[0].isPlayer)
    {
        //börja
    }
    //place my one card
    //send  message to server
    //receive message from server
    //repeat three times
};

export const game =
{
    startGame: (wsckt, msg, players, onGameEnd, onRestart) =>
    {
        document.querySelector('#content').innerHTML =
            `<main class = "lobby-main" id = "main">
                <div id = "pov-center-div" class = "CN-center"> <img src="/cards/YB.svg" width="80"/></div>
                <div id = "other-center-div" class = "CN-center"> <img src="/cards/YR.svg" width="80"/></div>
            </main>`;
        const round =
        {
            hand: msg.hand,
            players: players,
            restart: onRestart,
            gameEnd: onGameEnd
        };
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        beginGame(round);
    
    },    
    maxPlayers: 2,
    minPlayers: 2
};

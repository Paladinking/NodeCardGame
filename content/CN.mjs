const handleMessage = (msg, round) =>
{
    
};

const initGame = (round) =>
{
    
};

export const game =
{
    startGame: (wsckt, msg, players, startCards, restart) =>
    {
        document.querySelector('#content').innerHTML =
            `<main class = "lobby-main" id = "main">
                <div id = "center-div" class = "center"></div>
                <div id = "sidebar" class = "player-sidebar"></div>
            </main>`;
        const round =
        {
            wsckt: wsckt,
            hand: msg.hand,
            players: players,
            restart: restart,
            startVictoryCards: startCards
        };
        /*onResize = async () =>
        {
            smallScreen = window.innerWidth < 1700 || window.innerHeight < 1200;
            const allCardsElements = document.querySelectorAll('.card-wrapper');
            allCardsElements.forEach((card) =>
            {
                card.firstElementChild.width = smallScreen ? 120 : 160;
            });
            round.deckElement.style.top = `${window.innerHeight < 1200 ? -200 : -400}px`;
        };
        window.addEventListener('resize', onResize);*/
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        initGame(round);
    },
    maxPlayers: 2,
    minPlayers: 2
};

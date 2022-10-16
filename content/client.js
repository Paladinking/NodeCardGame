"use strict";
const CARD_NUMBERS = "A23456789JQK";
const CARD_COLORS = "SCDH";
const LOBBY = 0, IN_GAME = 1;
const gameId = window.location.pathname.substring(1, 3);
let noLeaveWarning = false;
let gameState;
let game;

const showErrorMessage = (error, longError, reason) =>
{
    document.querySelector('#content').innerHTML +=
        `<div class = "error-wrap">
        <div class = "error-box">
            <h2>${error}</h2>
            <p>${longError}</p>
            <p>${reason}</p>
            <br>
            <a href="/">Return to main page<a>
        </div>
    </div>`;
};

const init = (name) =>
{
    const players = [];
    const ul = document.querySelector('#playlist');
    ul.innerHTML = "";
    const playersSpan = document.querySelector('#players');


    const createPlayer = (name, newPlayer = true) =>
    {
        const li = document.createElement('li');
        li.classList.add('player-box');
        li.innerText = name;
        ul.append(li);
        const player = { name: name, cards: 7 };
        players.push(player);
        if (newPlayer)
        {
            li.classList.add('new');
            playersSpan.innerText = players.length;
        }
        return player;
    };

    let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
    wsckt.addEventListener('open', () =>
    {
        noLeaveWarning = false;
        gameState = LOBBY;
        wsckt.send(JSON.stringify({ "gameId": gameId, "name": name }));
        wsckt.addEventListener('message', (e) =>
        {
            console.log(e.data);
            const msg = JSON.parse(e.data);
            console.log(msg);
            if (gameState == LOBBY)
            {
                switch (msg.event)
                {
                    case 'joined':
                        {
                            for (const player of msg.players)
                            {
                                createPlayer(player, false);
                            }
                            createPlayer(name).isPlayer = true;
                            break;
                        }
                    case 'join':
                        {
                            createPlayer(msg.name);
                            break;
                        }
                    case 'leave':
                        {
                            ul.querySelectorAll('li')[msg.id].remove();
                            players.splice(msg.id, 1);
                            playersSpan.innerText = players.length;
                            break;
                        }
                    case 'start':
                        {
                            game.startGame(wsckt, msg, players, startBackgroundCards, async () => 
                            {
                                document.querySelector('#content').innerHTML = new DOMParser()
                                    .parseFromString(await (await fetch(`/${gameId}`)
                                        .catch(() =>
                                        {
                                            const close = new CloseEvent("close", { code: 1000, reason: 'Could not load new game' });
                                            round.wsckt.dispatchEvent(close);
                                        }
                                        ))
                                        .text(), 'text/html')
                                    .querySelector('#content').innerHTML;
                                init(name);
                                gameState = undefined;
                                startBackgroundCards(IN_GAME);
                            });
                            gameState = IN_GAME;
                            break;
                        }
                }
            }
            else if (gameState = IN_GAME)
            {
                game.handleMessage(msg);
            }

        });
        wsckt.addEventListener('close', (event) =>
        {
            noLeaveWarning = true;
            if (event.reason != "Game is over")
            {
                showErrorMessage("Connection closed", "The connection to the server was closed unexpectedly", `${event.reason.length != 0 ? `Reason: ${event.reason}` : "Thats all we know."}`);
            }
        });
        document.querySelector('#start-button').setAttribute('available', "true");
        document.querySelector('#start-button').addEventListener('click', () =>
        {
            if (players.length >= game.minPlayers)
            {
                let response = { action: "Start" };
                wsckt.send(JSON.stringify(response));
            }
            else
            {
                document.querySelector('#start-button').animate([{ left: "0px" }, { left: "7px" }, { left: "0px" }, { left: "-7px" }, { left: "0px" }], 150);
            }
        });
        window.addEventListener('beforeunload', (e) =>
        {
            if (!noLeaveWarning)
            {
                e.preventDefault();
                return e.returnValue = "Are you sure you want to exit?";
            }
        });
    });

};

const startBackgroundCards = (stopOnGameState = LOBBY) =>
{
    const main = document.querySelector('#background-wrapper');
    for (let i = 0; i < 15; i++)
    {
        const number = CARD_NUMBERS[Math.floor(Math.random() * CARD_NUMBERS.length)];
        const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
        const card = document.createElement('div');
        card.classList.add('card-wrapper');
        card.innerHTML = `<img src = "/cards/${number}${color}.svg" draggable = "false" width = 140>`;
        main.prepend(card);
        const animate = () =>
        {
            if (gameState != stopOnGameState)
            {
                const timing = 2000 + Math.floor(Math.random() * 10000);
                const x = Math.floor(Math.random() * main.offsetWidth + 200) - 400;
                const y = -200;
                const xOffset = (50 + Math.floor(Math.random() * 100)) * (Math.round(Math.random()) == 0 ? -1 : 1);
                const yOffset = (main.offsetHeight + 200);
                const rotation = Math.floor(Math.random() * 180) * (Math.round(Math.random()) == 0 ? -1 : 1);
                card.style.transform = `rotate(${rotation}deg)`;
                card.animate(
                    [{
                        left: `${x}px`,
                        top: `${y}px`
                    },
                    {
                        left: `${x + xOffset}px`,
                        top: `${y + yOffset}px`
                    }], timing);
                setTimeout((animate), timing);
            }
            else
            {
                card.remove();
            }
        };
        animate();
    }
};


document.querySelector('#join-button').addEventListener('click', () =>
{
    const name = document.querySelector('#join-input').value;
    if (name && name.length < 21)
    {
        init(name);
    }
});
startBackgroundCards(IN_GAME);
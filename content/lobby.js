"use strict";
const GAME_TYPES = { "T8": { name: "Vändåtta", minPlayers: 2, maxPlayers: 5 }, "CN": { name: "Caravan", minPlayers: 2, maxPlayers: 2 } };
const CARD_NUMBERS = "A23456789JQK";
const CARD_COLORS = "SCDH";
const LOBBY = 0, IN_GAME = 1;
const gameId = new URLSearchParams(window.location.search).get('game');
const playersSpan = document.querySelector('#players');
let kicked = false;
let gameState;
import { game } from "/game.mjs";



const init = (name) =>
{
    const players = [];

    const ul = document.querySelector('#playlist');
    ul.innerHTML = "";
    let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
    wsckt.addEventListener('open', () =>
    {
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
                                const li = document.createElement('li');
                                li.innerText = player;
                                ul.append(li);
                                players.push({ name: player, cards: 7 });
                            }
                            const li = document.createElement('li');
                            li.classList.add('new');
                            li.innerText = name;
                            ul.append(li);
                            players.push({ name: name, isPlayer: true, cards: 7 });

                            playersSpan.innerText = `${players.length}/${GAME_TYPES[gameId].minPlayers}`;
                            break;
                        }
                    case 'join':
                        {
                            const li = document.createElement('li');
                            li.classList.add('new');
                            li.innerText = msg.name;
                            ul.append(li);
                            players.push({ name: msg.name, cards: 7 });
                            playersSpan.innerText = `${players.length}/${GAME_TYPES[gameId].minPlayers}`;
                            break;
                        }
                    case 'leave':
                        {
                            ul.querySelectorAll('li')[msg.id].remove();
                            players.splice(msg.id, 1);
                            playersSpan.innerText = `${players.length}/${GAME_TYPES[gameId].minPlayers}`;
                            break;
                        }
                    case 'start':
                        {
                            document.querySelector('#content').innerHTML = `<main class = "lobby-main" id = "main"><div id = "center-div" class = "center"></div><div id = "sidebar" class = "player-sidebar"></div></main>`;
                            game.startGame(wsckt, msg.hand, players, msg.topCard);
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
            if (event.reason != "Game is over")
            {
                kicked = true;
                window.location.href = "/"; //should probably show a screen or something but whatevs
            }
        });
        document.querySelector('#start-button').setAttribute('available', "true");
        document.querySelector('#start-button').addEventListener('click', () =>
        {
            if (players.length >= GAME_TYPES[gameId].minPlayers)
            {
                let response = { action: "Start" };
                wsckt.send(JSON.stringify(response));
            }
            else
            {
                document.querySelector('#start-button').animate([{ left: "0px" }, { left: "3px" }, { left: "0px" }, { left: "-3px" }, { left: "0px" }], 150);
            }
        });
        window.addEventListener('beforeunload', (e) =>
        {
            if (!kicked)
            {
                e.preventDefault();
                return e.returnValue = "Are you sure you want to exit?";
            }
        });
    });

};

if (GAME_TYPES[gameId] != undefined)
{
    document.querySelector('#main-title').innerText = GAME_TYPES[gameId].name;
    playersSpan.innerText = `${GAME_TYPES[gameId].minPlayers}`;
    document.querySelector('#join-button').addEventListener('click', () =>
    {
        const name = document.querySelector('#join-input').value;
        if (name && name.length < 21)
        {
            init(name);
        }
    });
}
else 
{
    setTimeout(() =>
    {
        window.location.href = "/";
    }, 5000);
}

let startBackgroundCards = () =>
{
    const main = document.querySelector('#background-wrapper');
    for (let i = 0; i < 15; i++)
    {
        const number = CARD_NUMBERS[Math.floor(Math.random() * CARD_NUMBERS.length)];
        const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
        const card = document.createElement('div');
        card.classList.add('card-wrapper');
        card.innerHTML = `<img src = "/2color/${number}${color}.svg" draggable = "false" width = 140>`;
        main.prepend(card);
        const animate = () =>
        {
            if (gameState != IN_GAME)
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

startBackgroundCards();
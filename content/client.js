"use strict";
const CARD_NUMBERS = "A23456789TJQK";
const CARD_COLORS = "SCDH";
const LOBBY = 0, IN_GAME = 1;
const gameId = window.location.pathname.substring(1, 3);
let noLeaveWarning = false;
let darkmode = false;
let gameState;
let game;

const showErrorMessage = (error, longError, reason, swe = false) =>
{
    document.querySelector('#content').innerHTML +=
        `<div class = "error-wrap">
        <div class = "error-box">
            <h2>${error}</h2>
            <p>${longError}</p>
            <p>${reason}</p>
            <br>
            <a href="/">${swe ? "Tillbaka till huvudmenyn" : "Return to main page"}<a>
        </div>
    </div>`;
};

const setUpChat = (wsckt) =>
{
    const chat = {
        element: document.querySelector('#chat'),
        send: (msg) => { wsckt.send(`{"action": "Chat", "msg": "${msg}"}`); }
    };
    return chat;
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
        const player = { name: name };
        players.push(player);
        if (newPlayer)
        {
            li.classList.add('new');
            playersSpan.innerText = players.length;
        }
        return player;
    };

    const cover = document.createElement('div');
    cover.classList.add('error-wrap');
    setTimeout(() => //covers screen if connection takes more than 200ms, just to show that something is happening
    {
        if (gameState !== LOBBY)
        {
            document.body.append(cover);
            cover.animate([{ opacity: 0 }, {}], 200);
        }
    }, 200);


    let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
    wsckt.addEventListener('open', () =>
    {
        const chat = setUpChat(wsckt);
        cover.remove();
        noLeaveWarning = false;
        gameState = LOBBY;
        wsckt.send(JSON.stringify({ "gameId": gameId, "name": name }));
        wsckt.addEventListener('message', (e) =>
        {
            console.log(e.data);
            const msg = JSON.parse(e.data);
            console.log(msg);
            if (gameState === LOBBY)
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
                    case 'chat':
                        {
                            const li = ul.querySelectorAll('li')[msg.id];
                            break;
                        }
                    case 'start':
                        {
                            game.initGame(wsckt, msg, players, startBackgroundCards, async () => 
                            {
                                const rawFetch = await fetch(`/${gameId}`).catch(() => { });
                                if (rawFetch && rawFetch.ok)
                                {
                                    const parsed = new DOMParser().parseFromString(await rawFetch.text(), 'text/html');
                                    document.querySelector('#content').innerHTML = parsed.querySelector('#content').innerHTML;
                                    init(name);
                                    gameState = undefined;
                                    startBackgroundCards(IN_GAME);
                                }
                                else
                                {
                                    showErrorMessage("Could not load new game", "Something went wrong while fetching the new lobby", `${rawFetch ? `${rawFetch.status}: ${rawFetch.statusText}` : `No response from server`}`);
                                }
                            }, chat);
                            gameState = IN_GAME;
                            break;
                        }
                }
            }
            else if (gameState === IN_GAME)
            {
                game.handleMessage(msg);
            }

        });
        wsckt.addEventListener('close', (event) =>
        {
            noLeaveWarning = true;
            switch (event.reason)
            {
                case "Game is over":
                    {
                        break;
                    }
                case "Lobby is full":
                    {
                        showErrorMessage("Lobbyn är full!", `Den här lobbyn har redan ${game.maxPlayers} spelare`, "Försök igen senare!", true);
                        break;
                    };
                default:
                    {
                        showErrorMessage("Connection closed", "The connection to the server was closed unexpectedly", `${event.reason.length !== 0 ? `Reason: ${event.reason}` : "Thats all we know."}`);
                        break;
                    }
            };
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
    });
    wsckt.addEventListener('error', (e) =>
    {
        cover.classList.remove('error-wrap');
        showErrorMessage('Connection failed', "Failed to connect WebSocket to server", "Check that you are connected to the internet");
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
            if (gameState !== stopOnGameState)
            {
                const timing = 2000 + Math.floor(Math.random() * 10000);
                const x = Math.floor(Math.random() * main.offsetWidth + 200) - 400;
                const y = -200;
                const xOffset = (50 + Math.floor(Math.random() * 100)) * (Math.round(Math.random()) === 0 ? -1 : 1);
                const yOffset = (main.offsetHeight + 200);
                const rotation = Math.floor(Math.random() * 180) * (Math.round(Math.random()) === 0 ? -1 : 1);
                card.style.transform = `rotate(${rotation}deg)`;
                card.animate(
                    [{
                        left: `${x}px`,
                        top: `${y}px`
                    },
                    {
                        left: `${x + xOffset}px`,
                        top: `${y + yOffset}px`
                    }],
                    {
                        duration: timing,
                        fill: "forwards"
                    });
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


document.querySelector('.darkmode-button').addEventListener('click', () => {
	const root = document.querySelector(":root");
	darkmode = !darkmode;
	if (darkmode) {
		root.style.setProperty("--minor-button-color", "#313131");
		root.style.setProperty("--minor-button-color-hover", "#3f3f3f");
		root.style.setProperty("--start-button-color", "#483838");
		root.style.setProperty("--start-button-color-hover", "#584848");
		root.style.setProperty("--confirm-button-color", "#40ae40");
		root.style.setProperty("--confirm-button-color-hover", "#2f8e2f");
		root.style.setProperty("--discard-button-color", "#632626");
		root.style.setProperty("--discard-button-color-hover", "#9D5353");
		root.style.setProperty("--rules-button-color-hover", "#707070");
		root.style.setProperty("--page-color", "#525252");
		root.style.setProperty("--sidebar-color", "#414141");
		root.style.setProperty("--text-color", "#e0e0e0");
	} else {
		root.style.setProperty("--minor-button-color", "#c6e4f8");
		root.style.setProperty("--minor-button-color-hover", "#acd4f8");
		root.style.setProperty("--start-button-color", "#92acff");
		root.style.setProperty("--start-button-color-hover", "#7092ff");
		root.style.setProperty("--confirm-button-color", "#80ee80");
		root.style.setProperty("--confirm-button-color-hover", "#6fce6f");
		root.style.setProperty("--discard-button-color", "#ff4949");
		root.style.setProperty("--discard-button-color-hover", "#d34343");
		root.style.setProperty("--rules-button-color-hover", "#e0e0e0");
		root.style.setProperty("--page-color", "#eaf8ff");
		root.style.setProperty("--sidebar-color", "#ffffff");
		root.style.setProperty("--text-color", "#000000");
	}
	
});


document.querySelector('#join-button').addEventListener('click', () =>
{
    const name = document.querySelector('#join-input').value;
    if (name && name.length < 21)
    {
        window.addEventListener('beforeunload', (e) =>
        {
            if (!noLeaveWarning)
            {
                e.preventDefault();
                return e.returnValue = "Are you sure you want to exit?";
            }
        });
        init(name);
    }
});

let rulesOpen = false;
const rulesWrapper = document.querySelector('#rules');
const rules = rulesWrapper.firstElementChild;
document.querySelector('#rules').addEventListener('click', (e) =>
{
    if (!rulesOpen)
    {
        rulesOpen = true;
        rulesWrapper.setAttribute('open', true);
    }
    else
    {
        if (e.target.id === "rules-button")
        {
            rulesOpen = false;
            rulesWrapper.setAttribute('open', false);
        }
    }
});

startBackgroundCards(IN_GAME);

const statusDump = () =>
{
    return game.statusDump();
};
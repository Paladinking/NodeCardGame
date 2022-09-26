const GAME_TYPES = { "T8": { name: "Vändåtta", minPlayers: 2 }, "CN": { name: "Caravan", minPlayers: 2, maxPlayers: 2 } };
const CARD_NUMBERS = "A23456789JQK";
const CARD_COLORS = "SCDH";
const gameId = new URLSearchParams(window.location.search).get('game');
const playersSpan = document.querySelector('#players');


const init = (name) =>
{
    const ul = document.querySelector('#playlist');
    let playerCount = 0;
    ul.innerHTML = "";
    let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
    wsckt.addEventListener('open', () =>
    {
        wsckt.send(JSON.stringify({ "gameId": gameId, "name": name }));
        wsckt.addEventListener('message', (e) =>
        {
            const msg = JSON.parse(e.data);
            console.log(msg);
            if (msg.event == 'joined')
            {
                for (const player of msg.players)
                {
                    const li = document.createElement('li');
                    li.innerText = player;
                    ul.append(li);
                    playerCount++;
                }
                const li = document.createElement('li');
                li.classList.add('new');
                li.innerText = name;
                ul.append(li);
                playerCount++;
                playersSpan.innerText = `${playerCount}/${GAME_TYPES[gameId].minPlayers}`;
            }
            if (msg.event == 'join')
            {
                const li = document.createElement('li');
                li.classList.add('new');
                li.innerText = msg.name;
                ul.append(li);
            }
        });
        window.addEventListener('beforeunload', (e) =>
        {
            e.preventDefault();
            return e.returnValue = "Are you sure you want to exit?";

        });
    });

};

if (GAME_TYPES[gameId] != undefined)
{
    document.querySelector('#main-title').innerText = GAME_TYPES[gameId].name;
    playersSpan.innerText = `0/${GAME_TYPES[gameId].minPlayers}`;
    document.querySelector('#join-button').addEventListener('click', () =>
    {
        const name = document.querySelector('#join-input').value;
        if (name)
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
        card.classList.add('background-card-wrapper');
        card.innerHTML = `<img src = "./2color/${number}${color}.svg" draggable = "false" width = 140>`;
        main.prepend(card);
        const animate = () =>
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

        };
        animate();

    }
};

startBackgroundCards();
const allowedIds = { "T8": "Vändåtta", "CN": "Caravan" };

const init = (name) =>
{
    const ul = document.querySelector('#playlist');
    ul.innerHTML = "";
    let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
    wsckt.addEventListener('open', () =>
    {
        wsckt.send(JSON.stringify({ "gameId": id, "name": name }));
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
                }
                const li = document.createElement('li');
                li.classList.add('new');
                li.innerText = name;
                ul.append(li);
            }
            if (msg.event == 'join')
            {
                const li = document.createElement('li');
                li.classList.add('new');
                li.innerText = msg.name;
                ul.append(li);
            }
        });
    });

};


const params = new URLSearchParams(window.location.search);
const id = params.get('game');

if (allowedIds[id] != undefined)
{
    document.querySelector('#main-title').innerText = allowedIds[id];
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
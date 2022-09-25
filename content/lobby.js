const allowedIds = {"T8":"Vändåtta"};

const init = () =>
{
    const params = new URLSearchParams(window.location.search);
    const id = params.get('game');

    if (allowedIds[id]!=undefined)
    {
        document.querySelector('#main-title').innerText =allowedIds[id]
        let wsckt = new WebSocket("ws://" + window.location.href.split('//')[1].split('?')[0]);
        wsckt.addEventListener('open', () =>
        {
            wsckt.send(JSON.stringify({ "gameId": id, "name": "steve" }));
            wsckt.addEventListener('message', (e) =>
            {
                const msg = e.data;
                console.log(msg);
            });




        });
    }
    else 
    {
        setTimeout(() =>
        {
            window.location.href = "/";
        }, 5000);
    }
};

init();
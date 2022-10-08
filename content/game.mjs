"use strict";
const CARD_NUMBERS = "23456789JQKA";
const CARD_COLORS = "SCDH";
const smallScreen = window.innerWidth < 1700;
const sortHand = (hand) =>
{
    for (let i = 0; i < hand.length; i++)
    {
        for (let j = i + 1; j < hand.length; j++)
        {
            if (hand[i].name[0] == hand[j].name[0])
            {
                if (CARD_COLORS.indexOf(hand[i].name[1]) > CARD_COLORS.indexOf(hand[j].name[1]))
                {
                    const card = hand[i];
                    hand[i] = hand[j];
                    hand[j] = card;
                }
            }
            else if (CARD_NUMBERS.indexOf(hand[i].name[0]) > CARD_NUMBERS.indexOf(hand[j].name[0]))
            {
                const card = hand[i];
                hand[i] = hand[j];
                hand[j] = card;
            }
        }
    }
    return hand;
};


const animateCard = (card, from, to, time) =>
{
    card.animate([from, to], { duration: time, easing: 'ease' });
};

const createCardElement = (cardName) =>
{
    const card = document.createElement('div');
    card.classList.add('card-wrapper');
    card.classList.add('hoverable-card');
    const width = smallScreen ? 120 : 160;
    card.innerHTML = `<img src = "/2color/${cardName}.svg" draggable = "false" width = ${width}>`;
    card.style.top = "initial";
    return card;
};

const cloneHand = (round, hand) =>
{
    for (const card of hand)
    {
        const element = card.element.cloneNode(true);
        card.element.remove();
        card.element = element;
        round.centerElement.append(card.element);
    }
};

const updateHand = async (hand) =>
{
    hand = sortHand(hand);
    for (let i = 0; i < hand.length; i++)
    {
        const card = hand[i].element;
        const percentage = hand.length == 1 ? 0.5 : i / (hand.length - 1);
        const degrees = hand.length == 2 ? 20 : 38;
        const rotation = (percentage * degrees * 2) - degrees;
        card.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * 100 - 50);
        card.style.top = `${top}px`;
        await imageLoad(card.firstElementChild);
        const left = percentage * (350) - 175 - card.offsetWidth / 2;
        card.style.left = `${left}px`;
        card.style.zIndex = i;
        const img = card.firstElementChild;
        img.style.top = "0px"

        card.addEventListener('mouseover', () =>
        {
            img.style.top = `-90px`;

        });
        card.addEventListener('mouseout', () =>
        {
            img.style.top = "0px"
        });

    }
};

const createHand = (hand) =>
{
    const cards = [];
    for (let i = 0; i < hand.length; i++)
    {
        const cardName = hand[i];
        const card = createCardElement(cardName);
        document.querySelector('#center-div').append(card);

        cards.push({ element: card, name: cardName });
    }
    return cards;
};

const isClicked = (clickTarget, parentElement) =>
{
    return clickTarget == parentElement || parentElement.contains(clickTarget);
};

const drawDeck = (round) =>
{
    round.deckElement.classList.add('deck');
    round.centerElement.append(round.deckElement);
    round.deckElement.style.width = `${smallScreen ? 120 : 160}px`;
    round.deckElement.style.height = `${smallScreen ? 168 : 224}px`;
    round.deckElement.style.top = `${smallScreen ? -200 : -400}px`;
};

const makeTableCard = (card) =>
{
    const rotation = Math.floor(Math.random() * 25) * (Math.round(Math.random()) == 0 ? -1 : 1);
    card.style.transform = `rotate(${rotation}deg)`;
    card.style.top = `${smallScreen ? -200 : -400}px`;
    card.style.left = `${-1 * card.offsetWidth / 2}px`;
    card.style.zIndex = null;
    return card;
};

const validPlacement = (cardName, cardName2) =>
{
    return cardName[0] == cardName2[0] || cardName[1] == cardName2[1];
};

const getValidMoves = (round, placedCards) => 
{
    const moves = [];
    const topCard = round.tableCards[round.tableCards.length - 1].name;
    for (const card of round.hand)
    {
        if (card.name[0] != 8)
        {
            if ((placedCards.length == 0 && validPlacement(topCard, card.name)) || (placedCards.length > 0 && placedCards[0].name[0] == card.name[0]))
            {
                if (round.hand.length != 1 || card.name[0] != 'A')
                {
                    moves.push(card);
                }
            }
        }
    }

    if (moves.length == 0 /*this is against the rules but the server needs to cooperate*/ && placedCards.length == 0 && round.hand.length != 1)
    {
        for (const card of round.hand)
        {
            if (card.name[0] == 8)
            {
                moves.push(card);
            }
        }
    }
    return moves;
};

const wait = (time) =>
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, time);
    });
};

let turnClick;

const makeTurn = (round) =>
{
    console.log("Making turn");
    const placedCards = [];
    turnClick = async (e) =>
    {
        const validMoves = getValidMoves(round, placedCards);
        if (validMoves.length > 0)
        {
            for (const movedCard of validMoves)
            {
                if (isClicked(e.target, movedCard.element))
                {
                    round.hand.splice(round.hand.indexOf(movedCard), 1);
                    placedCards.push(movedCard);

                    const newMovedCardElement = movedCard.element.cloneNode(true);
                    const pos = { top: movedCard.element.style.top, left: movedCard.element.style.left };
                    movedCard.element.remove();
                    round.centerElement.append(newMovedCardElement);
                    movedCard.element = makeTableCard(newMovedCardElement);
                    animateCard(newMovedCardElement, { top: pos.top, left: pos.left }, { top: movedCard.element.style.top, left: movedCard.element.style.left }, 300);

                    cloneHand(round, round.hand);
                    await updateHand(round.hand);
                    movedCard.element.firstElementChild.style.top = "0px" //don't know why this is necessary
                    movedCard.element.addEventListener('click', async () =>
                    {
                        const returnedCard = placedCards.pop();
                        round.hand.push(returnedCard);
                        cloneHand(round, round.hand);
                        await updateHand(round.hand);
                    });
                    round.confirmButton.style.display = null;
                    break;
                }
            }
        }
        else if (placedCards.length == 0 && round.draws < 3)
        {
            if (isClicked(e.target, round.deckElement))
            {
                round.draws++;
                const msgObj = { action: "Draw" };
                round.wsckt.send(JSON.stringify(msgObj));
            }
        }
        if (placedCards.length > 0)
        {
            if (isClicked(e.target, round.confirmButton))
            {
                const cardNames = [];
                for (const card of placedCards)
                {
                    const newElement = card.element.cloneNode(true);
                    card.element.remove();
                    round.centerElement.append(newElement);
                    card.element = newElement;
                    cardNames.push(card.name);
                }
                const msgObj = { action: "Place", cards: cardNames };
                console.log(msgObj);
                round.confirmButton.style.display = "none";
                round.wsckt.send(JSON.stringify(msgObj));
                document.removeEventListener('click', turnClick);
                round.tableCards.push(...placedCards);
            }
        }
    };
    document.addEventListener('click', turnClick);
};

const initGraphics = async (round) =>
{
    drawDeck(round);
    await updateHand(round.hand);
    round.confirmButton.classList.add('confirm-button');
    round.centerElement.append(round.confirmButton);
    round.centerElement.append(round.tableCards[0].element);
    round.tableCards[0].element.style.left = `${-1 * round.tableCards[0].element.offsetWidth / 2}px`;
    round.confirmButton.style.display = "none";
    round.confirmButton.innerText = "OK";

    round.colorIndicator.classList.add('color-indicator');
    round.colorIndicator.src = "/suits/C.svg";
    round.colorIndicator.width = "40";
    round.colorIndicator.style.display = "none";
    round.centerElement.append(round.colorIndicator);

    const sidebar = document.querySelector('#sidebar');
    for (const player of round.players)
    {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player-div');
        let isPlayerString = "";
        if (player.isPlayer)
        {
            playerDiv.classList.add('current-player');
            isPlayerString = " (You)";
        }
        playerDiv.innerHTML = `<h2>${player.name}${isPlayerString}</h2><br><h3>7<h3>`;
        sidebar.append(playerDiv);
        player.playerDiv = playerDiv;
    }
    round.players[round.currentTurn].playerDiv.classList.add('current-round');
};

const initGame = async (round) =>
{
    await initGraphics(round);

    if (round.players[round.currentTurn].isPlayer)
    {
        makeTurn(round);
    }
    else
    {
        console.log("Not my turn");
    }
};

const imageLoad = (image) =>
{
    return new Promise((resolve) =>
    {
        if (image.naturalWidth == 0 || !image.complete)
        {
            const load = () =>
            {
                image.removeEventListener('load', load);
                resolve();
            };
            image.addEventListener('load', load);
        }
        else
        {
            resolve();
        }
    });
};

const chooseColorPopup = (round) =>
{
    return new Promise((resolve) =>
    {
        const container = document.createElement('div');
        container.classList.add('color-pick-container');
        round.centerElement.append(container);
        const colors = ['S', 'H', 'D', 'C'];
        for (let i = 0; i < 4; i++)
        {
            const element = document.createElement('img');
            element.src = `/suits/${colors[i]}.svg`;
            element.draggable = false;
            container.append(element);
        }
        const colorClick = (e) =>
        {
            for (let i = 0; i < container.querySelectorAll('img').length; i++)
            {
                const element = container.querySelectorAll('img')[i];
                if (isClicked(e.target, element))
                {
                    document.removeEventListener('click', colorClick);
                    container.remove();
                    resolve(colors[i]);
                    break;
                }
            }
        };
        document.addEventListener('click', colorClick);
    });
};

const nextTurn = (round) => //does not start the next round for the relevant player
{
    round.players[round.currentTurn].playerDiv.classList.remove('current-round');
    round.currentTurn = (round.currentTurn + 1) % round.players.length;
    round.players[round.currentTurn].playerDiv.classList.add('current-round');
    round.draws = 0;
    if (round.players[round.currentTurn].won)
    {
        let allPlayersWon = true;
        const sums = round.players.reduce((sum, cur) =>
        {
            sum + (cur.won ? 1 : 0);
        });
        console.log(sums);
        for (const player of round.players)
        {
            if (!player.won)
            {
                allPlayersWon = false;
            }
        }
        if (!allPlayersWon)
        {
            nextTurn(round);
        }
        else
        {
            console.log("Game finished!");
        }
    }
};

const drawSelfAnimate = async (round, newCardNames) =>
{
    const newCards = createHand(newCardNames);
    round.hand.push(...newCards);
    cloneHand(round, round.hand);
    await updateHand(round.hand);
    for (const newCard of newCards)
    {
        animateCard(newCard.element, { top: round.deckElement.style.top, left: "-20rem" }, { top: newCard.element.style.top, left: newCard.element.style.left }, 300);
    }
};

const changePlayerCards = (player, amount) =>
{
    player.cards += amount;
    player.playerDiv.querySelector('h3').innerText = player.cards;
    console.log(player.name, player.cards);
    if (player.cards <= 0)
    {
        player.won = true;
        player.playerDiv.classList.add('won');
        console.log(`${player.name} won!`);
    }
};

const handleMessage = async (msg, round) =>
{
    switch (msg.event)
    {
        case 'place':
            {
                round.colorIndicator.style.display = "none";
                const currentTurnPlayer = round.players[round.currentTurn];
                changePlayerCards(currentTurnPlayer, -msg.cards.length);
                if (!currentTurnPlayer.isPlayer)
                {
                    for (const cardName of msg.cards)
                    {
                        const card = createCardElement(cardName);
                        round.centerElement.append(card);
                        card.style.top = null;
                        await imageLoad(card.firstElementChild); //so that image is loaded when card is animated
                        makeTableCard(card);
                        animateCard(card, { top: `${smallScreen ? -400 : -600}px` }, { top: card.style.top }, 300);
                        round.tableCards.push({ element: card, name: cardName });
                        await wait(500);
                    }
                }

                const cardNr = msg.cards[0][0];
                if (cardNr == '8')
                {
                    if (currentTurnPlayer.isPlayer)
                    {
                        const color = await chooseColorPopup(round);
                        const msgObj = { action: "ChooseColor", color: color };
                        round.wsckt.send(JSON.stringify(msgObj));
                    }
                }
                else
                {
                    if (cardNr == 'A')
                    {

                        for (const player of round.players)
                        {
                            if (player != currentTurnPlayer)
                            {
                                changePlayerCards(player, msg.cards.length);
                            }
                        }

                        if (!(currentTurnPlayer.isPlayer))
                        {

                            await drawSelfAnimate(round, msg.newCards);
                        }
                        round.draws = 0;
                    }
                    else
                    {
                        nextTurn(round);
                    }
                    if (round.players[round.currentTurn].isPlayer)
                    {
                        makeTurn(round);
                    }

                }
                break;
            }
        case 'chooseColor':
            {
                const topCard = round.tableCards[round.tableCards.length - 1];
                topCard.name = `${topCard.name[0]}${msg.color}`;
                round.colorIndicator.src = `/suits/${msg.color}.svg`;
                round.colorIndicator.style.display = null;
                nextTurn(round);
                if (round.players[round.currentTurn].isPlayer)
                {
                    makeTurn(round);
                }

                break;
            }
        case 'drawSelf':
            {
                await drawSelfAnimate(round, [msg.card]);
                changePlayerCards(round.players[round.currentTurn], 1);
                if (round.draws == 3 && getValidMoves(round, []).length == 0)
                {
                    document.removeEventListener('click', turnClick);
                    nextTurn(round);
                }
                break;
            }
        case 'drawOther':
            {
                round.draws++;
                changePlayerCards(round.players[round.currentTurn], 1);
                if (msg.passed)
                {
                    round.draws = 0;
                    nextTurn(round);
                    if (round.players[round.currentTurn].isPlayer)
                    {
                        makeTurn(round);
                    }
                }

                break;
            }
        case 'leave':
            {
                round.players[msg.id].playerDiv.remove();
                round.players.splice(msg.id, 1);
                if (round.currentTurn >= msg.id)
                {
                    nextTurn(round);
                    if (round.players[round.currentTurn].isPlayer)
                    {
                        makeTurn(round);
                    }
                }
            }
    }
};


export const game =
{
    startGame: (wsckt, hand, players, topCard) =>
    {
        console.log("Starting game");
        const round =
        {
            wsckt: wsckt,
            hand: createHand(hand),
            players: players,
            currentTurn: 0,
            draws: 0,
            deckElement: document.createElement('div'),
            tableCards: [{ element: makeTableCard(createCardElement(topCard)), name: topCard }],
            confirmButton: document.createElement('div'),
            centerElement: document.querySelector('#center-div'),
            colorIndicator: document.createElement('img')
        };
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        initGame(round);
    }
};;

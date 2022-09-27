"use strict";
const CARD_NUMBERS = "23456789JQKA";
const sizeFactor = window.innerHeight / 1300; //bad solution
const sortHand = (hand) =>
{
    for (let i = 0; i < hand.length; i++)
    {
        for (let j = i + 1; j < hand.length; j++)
        {
            if (CARD_NUMBERS.indexOf(hand[i][0]) > CARD_NUMBERS.indexOf(hand[j][0]))
            {
                let card = hand[i];
                hand[i] = hand[j];
                hand[j] = card;
            }
        }
    }
    return hand;
};


const createCardElement = (cardName) =>
{
    const card = document.createElement('div');
    card.classList.add('card-wrapper');
    card.classList.add('hoverable-card');
    card.innerHTML = `<img src = "/2color/${cardName}.svg" draggable = "false" width = ${sizeFactor * 160}>`;
    card.style.top = "initial";
    return card;
};

const cloneHand = (round, hand) =>
{
    for (let card of hand)
    {
        const element = card.element.cloneNode(true);
        card.element.remove();
        card.element = element;
        round.centerElement.append(card.element);
    }
};

const updateHand = (hand) =>
{
    for (let i = 0; i < hand.length; i++)
    {
        const card = hand[i].element;
        const percentage = i / (hand.length - 1);
        const rotation = (percentage * 76) - 38;
        card.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * 100 - 50);
        card.style.top = `${sizeFactor * top}px`;
        const left = percentage * (350) - 175 - card.offsetWidth / 2;
        card.style.left = `${left}px`;

        card.addEventListener('mouseover', () =>
        {
            card.style.top = `${sizeFactor * (top - Math.cos(rotation * Math.PI / 180) * 90)}px`;
            card.style.left = `${left + sizeFactor * (Math.sin(rotation * Math.PI / 180) * 90)}px`;

        });
        card.addEventListener('mouseout', () =>
        {
            card.style.top = `${sizeFactor * top}px`;
            card.style.left = `${left}px`;
        });
    }

};

const createHand = (hand) =>
{
    const cards = [];
    hand = sortHand(hand);
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


//empty until texture for back of cards exists
const drawDeck = (round) =>
{

};

const makeTableCard = (card) =>
{
    const rotation = Math.floor(Math.random() * 25) * (Math.round(Math.random()) == 0 ? -1 : 1) + ((Math.round(Math.random()) == 0) ? 180 : 0);
    card.style.transform = `rotate(${rotation}deg)`;
    card.style.top = `${sizeFactor * -400}px`;
    card.style.left = "0px";
    return card;
};

const validPlacement = (cardName, cardName2) =>
{
    return cardName[0] == cardName2[0] || cardName[1] == cardName2[1];
};


//only returns strictly valid moves according to actual color of top card or matching with placed cards
//does not account for special rules around 8s or aces
const getValidMoves = (round, placedCards) => 
{
    const moves = [];
    for (let card of round.hand)
    {
        const topCard = round.tableCards[round.tableCards.length - 1].name;
        if ((placedCards.length == 0 && validPlacement(topCard, card.name)) || (placedCards.length > 0 && placedCards[0].name[0] == card.name[0]))
        {
            moves.push(card);
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

const makeTurn = async (round) =>
{
    console.log("Making turn");
    const placedCards = [];
    let turnClick = async (e) =>
    {
        const validMoves = getValidMoves(round, placedCards);
        if (validMoves.length > 0)
        {
            for (let movedCard of validMoves)
            {
                if (isClicked(e.target, movedCard.element))
                {
                    round.hand.splice(round.hand.indexOf(movedCard), 1);
                    placedCards.push(movedCard);
                    const element = movedCard.element.cloneNode(true);
                    movedCard.element.remove();
                    round.centerElement.append(element);
                    cloneHand(round, round.hand);
                    await wait(0); //requestAnimationFrame is probably to be prefered
                    movedCard.element = makeTableCard(element);
                    updateHand(round.hand);
                    round.confirmButton.style.display = null;
                    break;
                }
            }
        }
        if (placedCards.length > 0)
        {
            if (isClicked(e.target, round.confirmButton))
            {
                const cardNames = [];
                for (let card of placedCards)
                {
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

const initGame = (round) =>
{
    drawDeck(round);
    updateHand(round.hand);
    round.confirmButton.classList.add('confirm-button');
    round.centerElement.append(round.confirmButton);
    round.centerElement.append(round.tableCards[0].element);
    round.confirmButton.style.display = "none";
    round.confirmButton.innerText = "OK";

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
        const load = () =>
        {
            image.removeEventListener('load', load);
            resolve();
        };
        image.addEventListener('load', load);
    });
};

const handleMessage = async (msg, round) =>
{
    switch (msg.event)
    {
        case 'Place':
            {
                if (!round.players[round.currentTurn].isPlayer)
                {
                    for (let cardName of msg.Cards)
                    {
                        const card = createCardElement(cardName);
                        round.centerElement.append(card);
                        card.style.top = `${sizeFactor * -600}px`;
                        await imageLoad(card.firstElementChild); //so that image is in loaded while card is being animated
                        makeTableCard(card);
                        round.tableCards.push({ element: card, name: cardName });
                        await wait(500);
                    }
                }

                //rest of handleMessage is <u>untested</u>
                const cardNr = msg.Cards[0][0];
                if (cardNr == '8')
                {
                    //choose color
                    //makeTurn will be blocked and game will wait for ChooseColor event
                }
                else
                {
                    if (cardNr == 'A')
                    {
                        round.hand.push(...createHand(msg.newCards));
                        cloneHand(round, round.hand);
                        await wait(0);
                        updateHand(round.hand);
                    }
                    else
                    {
                        round.currentTurn++;
                        if (round.currentTurn == round.players.length)
                        {
                            round.currentTurn = 0;
                        }
                    }
                    if (round.players[round.currentTurn].isPlayer && cardNr != '8')
                    {
                        makeTurn(round);
                    }

                }
                break;
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
            deckElement: document.createElement('div'),
            tableCards: [{ element: makeTableCard(createCardElement(topCard)), name: topCard }],
            confirmButton: document.createElement('div'),
            centerElement: document.querySelector('#center-div')
        };
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        initGame(round);
    }
};

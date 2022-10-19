"use strict";
const CARD_NUMBERS = "23456789JQKA";
const CARD_COLORS = "SCDH";
let smallScreen = window.innerWidth < 1700 || window.innerHeight < 1200;
let onResize;

const sortHand = (hand) =>
{
    for (let i = 0; i < hand.length; i++)
    {
        for (let j = i + 1; j < hand.length; j++)
        {
            if (hand[i].name[0] === hand[j].name[0])
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


const animateCard = (card, from, time) =>
{
    card.animate([from, {}], { duration: time, easing: 'ease' });
};

const createCardElement = (cardName) =>
{
    const card = document.createElement('div');
    card.classList.add('playing-card', 'card-wrapper');
    const width = smallScreen ? 120 : 160;
    card.innerHTML = `<img src = "/cards/${cardName}.svg" draggable = "false" width = ${width}>`;
    card.style.top = "initial";
    return card;
};

const updateHand = (hand) =>
{
    hand = sortHand(hand);
    const width = hand.length <= 2 ? 150 : 350;
    for (let i = 0; i < hand.length; i++)
    {
        const card = hand[i].element;
        card.classList.add('hoverable-card');
        const percentage = hand.length === 1 ? 0.5 : i / (hand.length - 1);
        const degrees = hand.length === 2 ? 20 : 38;
        const rotation = (percentage * degrees * 2) - degrees;
        card.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * 100 - 50);
        card.style.top = `${top}px`;
        const left = percentage * width - width / 2 - card.offsetWidth / 2;
        card.style.left = `${left}px`;
        card.style.zIndex = `${i + 10}`;
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
    return clickTarget === parentElement || parentElement.contains(clickTarget);
};

const drawDeck = (round) =>
{
    round.deckElement.classList.add('deck');
    round.centerElement.append(round.deckElement);
    round.deckElement.style.top = `${window.innerHeight < 1200 ? -200 : -400}px`;
};

const makeTableCard = (card, zIndex) =>
{
    const rotation = Math.floor(Math.random() * 25) * (Math.round(Math.random()) === 0 ? -1 : 1);
    card.style.transform = `rotate(${rotation}deg)`;
    card.style.top = null;//`${smallScreen ? -200 : -400}px`;
    card.classList.add('table-card');
    card.classList.remove('hoverable-card');
    card.style.left = `${-1 * card.offsetWidth / 2}px`;
    card.style.zIndex = zIndex;
    return card;
};

const validPlacement = (cardName, cardName2) =>
{
    return cardName[0] === cardName2[0] || cardName[1] === cardName2[1];
};

const getValidMoves = (round, placedCards) => 
{
    const moves = [];
    const eights = [];
    const topCard = round.tableCards[round.tableCards.length - 1].name;
    for (const card of round.hand)
    {
        if (card.name[0] !== 8)//card is not an eight
        {
            if (((placedCards.length === 0 && validPlacement(topCard, card.name))  //card can either be placed on the top card or on a previusly placed card
                || (placedCards.length > 0 && placedCards[0].name[0] === card.name[0]))
                && (card.name[0] !== 'A' //card is not last card or card is not an ace
                    || round.hand.length !== 1))
            {
                moves.push(card);
            }
        }
        else
        {
            eights.push(card);
        }

    }

    if (moves.length === 0 /*this is against the rules but the server needs to cooperate*/ && placedCards.length === 0 && round.hand.length !== 1)
    {
        moves.push(...eights);
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
    if (round.finishedPlayers.length >= round.players.length - 1)
    {
        return;
    }
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
                    makeTableCard(movedCard.element, round.tableCards.length);
                    round.tableCards.push(movedCard);
                    updateHand(round.hand);
                    round.confirmButton.style.display = null;
                    return;
                }
            }
        }
        else if (placedCards.length === 0 && round.draws < 3)
        {
            if (isClicked(e.target, round.deckElement))
            {
                round.draws++;
                round.wsckt.send(`{"action":"Draw"}`);
                return;
            }
        }
        if (placedCards.length > 0)
        {
            for (const card of round.tableCards)
            {
                if (isClicked(e.target, card.element))
                {
                    const returnedCard = placedCards.pop();
                    round.tableCards.pop();
                    returnedCard.element.style.top = `${window.innerHeight < 1200 ? -200 : -400}px`;
                    returnedCard.element.classList.remove('table-card');
                    round.hand.push(returnedCard);
                    updateHand(round.hand);
                    if (placedCards.length === 0)
                    {
                        round.confirmButton.style.display = "none";
                    }

                    return;
                }
            }
            if (isClicked(e.target, round.confirmButton))
            {
                const cardNames = placedCards.map(card => card.name);
                const msgObj = { action: "Place", cards: cardNames };
                round.confirmButton.style.display = "none";
                round.wsckt.send(JSON.stringify(msgObj));
                document.removeEventListener('click', turnClick);
            }
        }
    };
    document.addEventListener('click', turnClick);
};

const initGraphics = async (round) =>
{
    drawDeck(round);
    updateHand(round.hand);
    round.confirmButton.classList.add('confirm-button');
    round.centerElement.append(round.confirmButton);
    round.centerElement.append(round.tableCards[0].element);
    round.tableCards[0].element.style.left = `${-1 * round.tableCards[0].element.offsetWidth / 2}px`;
    round.confirmButton.style.display = "none";
    round.confirmButton.innerText = "OK";

    round.colorIndicator.classList.add('color-indicator');
    round.colorIndicator.src = "/cards/C.svg";
    round.colorIndicator.width = 40;
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
};

const imageLoad = (image) =>
{
    return new Promise((resolve) =>
    {
        if (image.naturalWidth === 0 || !image.complete)
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
            element.src = `/cards/${colors[i]}.svg`;
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
const toVictory = (round) =>
{
    for (const player of round.players)
    {
        if (!round.finishedPlayers.includes(player))
        {
            round.finishedPlayers.push(player);
        }
    }
    document.querySelector('#content').innerHTML = '<main class = "lobby-main" id = "background-wrapper"></main>';
    const main = document.querySelector('#background-wrapper');
    main.innerHTML =
        `<div class="win-screen">
            <div class="winner">
                1. ${round.finishedPlayers[0].name}
            </div>
            <div class="podium" id = "podium"></div>
            <div class="remaining-players" id = "remaining"></div>
        </div>
        <div class="restart-button" id="restart">Restart</div>`;
    const podium = document.querySelector('#podium');
    for (let i = 1; i < Math.min(round.finishedPlayers.length, 3); i++)
    {
        const element = document.createElement('div');
        element.innerText = `${i + 1}. ${round.finishedPlayers[i].name}`;
        podium.append(element);
    }

    const remaining = document.querySelector('#remaining');
    for (let i = 3; i < round.finishedPlayers.length; i++)
    {
        const element = document.createElement('span');
        element.innerHTML = `${i + 1}. ${round.finishedPlayers[i].name}`;
        remaining.append(element);
    }
    round.startVictoryCards();
    window.removeEventListener('resize', onResize);
    document.querySelector('#restart').addEventListener('click', round.restart);

};

const nextTurn = (round) => //does not start the next round for the relevant player
{
    round.players[round.currentTurn].playerDiv.classList.remove('current-round');
    round.currentTurn = (round.currentTurn + 1) % round.players.length;
    round.players[round.currentTurn].playerDiv.classList.add('current-round');
    round.draws = 0;
    if (round.finishedPlayers.length >= round.players.length - 1)
    {
        toVictory(round);
    }
    else if (round.finishedPlayers.includes(round.players[round.currentTurn]))
    {
        nextTurn(round);
    }

};

const drawSelf = async (round, newCardNames) =>
{
    const newCards = createHand(newCardNames);
    round.hand.push(...newCards);
    updateHand(round.hand);
    for (const newCard of newCards)
    {
        newCard.element.style.opacity = "0";
        await imageLoad(newCard.element.firstElementChild);
        newCard.element.style.opacity = null;
        animateCard(newCard.element, { top: round.deckElement.style.top, left: "-20rem" }, 300);
    }
};

const drawOtherAnimate = async (round, player) =>
{
    return new Promise(async (resolve) =>
    {
        const animatedCard = createCardElement('Card_back');
        round.centerElement.append(animatedCard);
        const top = player.playerDiv.offsetTop + animatedCard.offsetHeight / 2;
        await imageLoad(animatedCard.firstElementChild);
        animatedCard.animate([
            {
                top: round.deckElement.style.top, left: "-20vw", zIndex: 100
            },
            {
                top: `${top - round.centerElement.parentElement.offsetHeight / 2}px`, left: `${window.innerWidth / 2 + 200}px`, zIndex: 100
            }],
            {
                duration: 700, easing: "ease", fill: "forwards"
            });
        setTimeout(() =>
        {
            animatedCard.remove();
            resolve();
        }, 750);
    });
};

const animateShuffle = (round) =>
{
    return new Promise((resolve) =>
    {
        const cardsToRemove = round.tableCards.splice(0, round.tableCards.length);
        const animations = [];
        for (const card of cardsToRemove)
        {
            animations.push(card.element.animate([
                {

                },
                {
                    top: `${-window.innerHeight}px`
                }],
                {
                    duration: 700, easing: "ease", fill: "forwards"
                }));
        }
        setTimeout(() =>
        {
            const topCard = cardsToRemove.pop();
            round.tableCards.push(topCard);
            topCard.element.style.zIndex = "0";
            for (const animation of animations)
            {
                animation.cancel();
            }
            topCard.element.animate([
                {
                    top: `${-window.innerHeight}px`
                },
                {
                    top: `${window.innerHeight < 1200 ? "-200px" : "-400px"}`
                }],
                {
                    duration: 700, easing: "ease"
                });
            cardsToRemove.forEach((card) =>
            {
                card.element.remove();
            });
            setTimeout(() =>
            {
                resolve();
            }, 750);
        }, 750);
    });
};

const changePlayerCards = async (round, player, amount) =>
{
    if (amount > 0)
    {
        round.totalCards -= amount;
        if (round.totalCards <= 0)
        {
            await animateShuffle(round);
            const sumOfHands = round.players.reduce((sum, cur) => sum + cur.cards, 0);
            round.totalCards = 51 - sumOfHands + round.totalCards;
        }
        console.log(round.totalCards);
    }
    player.cards += amount;
    player.playerDiv.querySelector('h3').innerText = player.cards;
    if (player.cards <= 0)
    {
        round.finishedPlayers.push(player);
        player.playerDiv.classList.add('won');
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
                await changePlayerCards(round, currentTurnPlayer, -msg.cards.length);
                if (!currentTurnPlayer.isPlayer)
                {
                    for (const cardName of msg.cards)
                    {
                        const card = createCardElement(cardName);
                        round.centerElement.append(card);
                        card.style.top = null;
                        await imageLoad(card.firstElementChild);
                        makeTableCard(card, round.tableCards.length);
                        animateCard(card, { top: `${window.innerHeight < 1200 ? -400 : -600}px` }, 300);
                        round.tableCards.push({ element: card, name: cardName });
                        await wait(500);
                    }
                }

                const cardNr = msg.cards[0][0];
                if (cardNr === '8')
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
                    if (cardNr === 'A')
                    {
                        for (const player of round.players)
                        {
                            if (player !== currentTurnPlayer && !round.finishedPlayers.includes(player))
                            {
                                if (!player.isPlayer)
                                {
                                    for (let i = 0; i < msg.cards.length; i++)
                                    {
                                        await drawOtherAnimate(round, player);
                                    }
                                }
                                await changePlayerCards(round, player, msg.cards.length);
                            }
                        }

                        if (!(currentTurnPlayer.isPlayer || round.hand.length === 0))
                        {
                            await drawSelf(round, msg.newCards);
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
                round.colorIndicator.src = `/cards/${msg.color}.svg`;
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
                await drawSelf(round, [msg.card]);
                await changePlayerCards(round, round.players[round.currentTurn], 1);
                if (round.draws === 3 && getValidMoves(round, []).length === 0)
                {
                    document.removeEventListener('click', turnClick);
                    nextTurn(round);
                }
                break;
            }
        case 'drawOther':
            {
                round.draws++;
                await drawOtherAnimate(round, round.players[round.currentTurn]);
                await changePlayerCards(round, round.players[round.currentTurn], 1);
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
                if (round.players.length === 1)
                {
                    toVictory(round);
                }
                else if (round.currentTurn === msg.id)
                {
                    nextTurn(round);
                    if (round.players[round.currentTurn].isPlayer)
                    {
                        makeTurn(round);
                    }
                }
                else if (round.currentTurn > msg.id)
                {
                    round.currentTurn -= 1;
                }
            }
    }
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
            hand: createHand(msg.hand),
            players: players,
            currentTurn: 0,
            draws: 0,
            deckElement: createCardElement('Card_back'),
            tableCards: [{ element: makeTableCard(createCardElement(msg.topCard), 0), name: msg.topCard }],
            confirmButton: document.createElement('div'),
            centerElement: document.querySelector('#center-div'),
            colorIndicator: document.createElement('img'),
            finishedPlayers: [],
            restart: restart,
            totalCards: 51 - 7 * players.length,
            startVictoryCards: startCards
        };
        onResize = async () =>
        {
            smallScreen = window.innerWidth < 1700 || window.innerHeight < 1200;
            const allCardsElements = document.querySelectorAll('.card-wrapper');
            allCardsElements.forEach((card) =>
            {
                card.firstElementChild.width = smallScreen ? 120 : 160;
            });
            round.deckElement.style.top = `${window.innerHeight < 1200 ? -200 : -400}px`;
        };
        window.addEventListener('resize', onResize);
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        initGame(round);
    },
    maxPlayers: 5,
    minPlayers: 2
};

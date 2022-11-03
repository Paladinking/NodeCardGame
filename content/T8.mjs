"use strict";
const CARD_NUMBERS = "23456789TJQKA";
const CARD_COLORS = "SCDH";

const SMALL_WIDTH = 1700, SMALL_HEIGHT = 1200, SHORT_HEIGHT = 700, PLAYER_DIV_SMALL = 130;
let smallScreen = window.innerWidth < SMALL_WIDTH || window.innerHeight < SMALL_HEIGHT;
let shortHeight = window.innerHeight < SHORT_HEIGHT;

let onResize;
const toAnimate = [];
let animating = false;

const startAnimationQueue = async () =>
{
    animating = true;
    while (toAnimate.length > 0)
    {
        const [animation] = toAnimate.splice(0, 1);
        await animation();
    }
    animating = false;
};

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
    return card;
};

const updateHand = (hand, width, height = 100, hoverable = true) =>
{
    const autoSortCheck = document.querySelector('#auto-sort');
    if (!autoSortCheck || autoSortCheck.checked)
    {
        hand = sortHand(hand);
    }
    if (!width)
    {
        width = hand.length <= 2 ? 150 : 350;
    }
    for (let i = 0; i < hand.length; i++)
    {
        const card = hand[i].element;

        if (hoverable && hand[i] !== hand.movedCard)
        {
            card.classList.add('hoverable-card');
        }
        else
        {
            card.classList.remove('hoverable-card');
        }
        const percentage = hand.length === 1 ? 0.5 : i / (hand.length - 1);
        let left;


        if (hand.movedCard)
        {
            left = 1.3 * percentage * width - 1.3 * width / 2 - card.firstElementChild.width / 2;
        }
        else
        {
            left = percentage * width - width / 2 - card.firstElementChild.width / 2;
        }

        const degrees = hand.length === 2 ? 20 : 38;
        const rotation = hand[i] === hand.movedCard ? 0 : ((percentage * degrees * 2) - degrees);
        card.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * height - height / 2);
        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
        card.style.zIndex = hand[i] === hand.movedCard ? 80 : `${i + 10}`;
    }
};

const createHand = (hand, append = false) =>
{
    const cards = [];
    for (let i = 0; i < hand.length; i++)
    {
        const cardName = hand[i];
        const card = createCardElement(cardName);
        if (append)
        {
            document.querySelector('#center-div').append(card);
        }
        cards.push({ element: card, name: cardName });
    }
    return cards;
};

const isClicked = (clickTarget, parentElement) =>
{
    return clickTarget === parentElement || parentElement.contains(clickTarget);
};

const makeTableCard = (card, zIndex) =>
{
    const rotation = Math.floor(Math.random() * 25) * (Math.round(Math.random()) === 0 ? -1 : 1);
    card.style.transform = `rotate(${rotation}deg)`;
    card.style.top = null;//`${smallScreen ? -200 : -400}px`;
    card.classList.add('table-card');
    card.classList.remove('hoverable-card');
    card.style.left = `${-1 * card.firstElementChild.width / 2}px`;
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
        if (card.name[0] !== "8")//card is not an eight
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

const makeTurn = (round) =>
{
    const placedCards = [];
    const turnClick = (e) =>
    {
        if (animating || round.blockNextClick)
        {
            return;
        }
        const validMoves = getValidMoves(round, placedCards);
        if (validMoves.length > 0)
        {
            for (const movedCard of validMoves)
            {
                if (isClicked(e.target, movedCard.element))
                {
                    const i = round.hand.indexOf(movedCard);
                    round.hand.splice(i, 1);
                    placedCards.push(movedCard);
                    movedCard.prevI = i;
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
                document.removeEventListener('click', turnClick);
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
                    returnedCard.element.style.top = `${window.innerHeight < SMALL_HEIGHT ? -200 : -400}px`;
                    returnedCard.element.classList.remove('table-card');
                    round.hand.splice(returnedCard.prevI, 0, returnedCard);
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
                const msgObj = { action: "ChooseColor", color: colors[i] };
                round.wsckt.send(JSON.stringify(msgObj));
                break;
            }
        }
    };
    document.addEventListener('click', colorClick);
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
        <div class="restart-button" id="restart">Nytt spel</div>`;
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
    const prevTurn = round.currentTurn;
    const currentTurn = (round.currentTurn + 1) % round.players.length;
    toAnimate.push(async () => 
    {
        if (round.players[prevTurn])
        {
            if (round.players[prevTurn].isPlayer)
            {
                const msg = document.querySelector('#turn-msg');
                msg.animate([{}, { top: "-4rem" }], { duration: 300, easing: "ease", fill: "forwards" });
                setTimeout(() =>
                {
                    msg.remove();
                }, 300);

            }
            else
            {
                round.players[prevTurn].playerDiv.classList.remove('current-round');
                const msg = document.querySelector('#start-turn-msg');
                if (msg)
                {
                    msg.animate([{}, { top: "-4rem" }], { duration: 300, easing: "ease", fill: "forwards" });
                    setTimeout(() =>
                    {
                        msg.remove();
                    }, 300);
                }
            }
        }

        if (!round.players[currentTurn].isPlayer)
        {
            round.players[currentTurn].playerDiv.classList.add('current-round');
        }
        else
        {
            await yourTurnAnimate(round);
        }
    });
    round.currentTurn = currentTurn;
    round.draws = 0;
    if (round.finishedPlayers.includes(round.players[round.currentTurn]))
    {
        nextTurn(round);
    }

};

const drawSelf = (round, newCardNames) =>
{
    const newCards = createHand(newCardNames);
    round.hand.push(...newCards);
    updateHand(round.hand);
    for (const newCard of newCards)
    {
        toAnimate.push(async () =>
        {
            await imageLoad(newCard.element.firstElementChild);
            const top = `${window.innerHeight < SMALL_HEIGHT ? -200 : -400}px`;
            animateCard(newCard.element, { top: top, left: "-20rem" }, 300);
            round.centerElement.append(newCard.element);
            await wait(300);
        });
    }
};

const drawOtherAnimate = async (player) =>
{
    return new Promise(async (resolve) =>
    {
        const [card] = createHand(["Card_back"], false);
        player.hand.push(card);
        card.element.firstElementChild.width = shortHeight ? 45 : 70;
        const sidebar = document.querySelector('#sidebar');
        updateHand(player.hand, sidebar.offsetWidth / (shortHeight ? 3 : 2), (shortHeight ? 30 : 40), false);
        await imageLoad(card.element.firstElementChild);
        const top = (window.innerHeight < SMALL_HEIGHT ? -200 : -400)
            + (sidebar.offsetHeight / 2 - (player.playerDiv.offsetTop + player.playerDiv.hand.offsetTop + 40));
        card.element.animate([
            {
                top: `${top}px`,
                left: "calc(-70vw + 7.5rem)",
                zIndex: 100,
            },
            {
                zIndex: 100
            }],
            {
                duration: 500, easing: "ease"
            });
        const width = `${smallScreen ? 120 : 160}px`;
        card.element.firstElementChild.animate([
            {
                width: width
            },
            {

            }],
            {
                duration: 500, easing: "ease"
            });
        player.playerDiv.hand.append(card.element);
        setTimeout(() =>
        {
            resolve();
        }, 750);
    });
};

const shuffle = (round) =>
{
    return new Promise((resolve) =>
    {
        const cardsToRemove = round.tableCards.splice(0, round.tableCards.length - 1);
        const topCard = round.tableCards[0];
        const sumOfHands = round.players.reduce((sum, cur) => sum + cur.cards, 0);
        round.deckCards = 51 - sumOfHands + round.deckCards;
        for (const card of cardsToRemove)
        {
            card.element.animate([
                {},
                {
                    top: `${-window.innerHeight}px`
                }],
                {
                    duration: 700, easing: "ease", fill: "forwards"
                });
        }
        topCard.element.animate([
            {},
            {
                top: `${-window.innerHeight}px`
            }],
            {
                duration: 700, easing: "ease", direction: "alternate", iterations: 2
            });
        setTimeout(() =>
        {
            topCard.element.style.zIndex = "0";
            cardsToRemove.forEach((card) =>
            {
                card.element.remove();
            });
            setTimeout(() =>
            {
                resolve();
            }, 750);
        }, 700);
    });
};

const yourTurnAnimate = async (round) =>
{
    const msg = document.createElement('div');
    msg.classList.add('your-turn-message', 'turn-message');
    msg.id = "turn-msg";
    msg.innerText = "Din tur!";
    round.centerElement.parentElement.append(msg);
};

const changePlayerCards = (round, player, amount) =>
{
    if (amount > 0)
    {
        round.deckCards -= amount;
    }
    player.cards += amount;
    if (!player.isPlayer)
    {
        player.playerDiv.querySelector('h3').innerText = player.cards;
    }
    if (player.cards <= 0)
    {
        round.finishedPlayers.push(player);
        if (player.playerDiv)
        {
            player.playerDiv.classList.add('won');
        }
    }
};

const placeCardAnimate = (round, player, card) =>
{
    return new Promise(async (resolve) =>
    {
        if (player && player.playerDiv)
        {
            const cardToMove = player.hand.pop();
            const sidebar = document.querySelector('#sidebar');
            updateHand(player.hand, sidebar.offsetWidth / (shortHeight ? 3 : 2), (shortHeight ? 30 : 40), false);
            await imageLoad(card.element.firstElementChild);
            const top = -(sidebar.offsetHeight / 2 - (player.playerDiv.offsetTop + player.playerDiv.hand.offsetTop + 40));
            const left = `calc(50vw - 7.5rem + ${cardToMove.element.style.left})`;
            card.element.animate([
                {
                    top: `${top}px`,
                    left: left,
                    transform: cardToMove.element.style.transform,
                    zIndex: 100,
                },
                {
                    zIndex: 100
                }],
                {
                    duration: 600, easing: "ease"
                });
            const width = `${shortHeight ? 45 : 70}px`;
            card.element.firstElementChild.animate([
                {
                    width: width
                },
                {

                }],
                {
                    duration: 600, easing: "ease"
                });
            cardToMove.element.remove();
        }
        round.centerElement.append(card.element);
        setTimeout(() =>
        {
            resolve();
        }, 750);
    });
};

const handlePlace = (msg, round) =>
{
    round.colorIndicator.style.display = "none";
    const prevTurn = round.currentTurn;
    const currentTurnPlayer = round.players[round.currentTurn];
    changePlayerCards(round, currentTurnPlayer, -msg.cards.length);
    const remainingPlayers = round.players.reduce((sum, cur) => sum + (round.finishedPlayers.includes(cur) ? 0 : 1), 0);
    if (!currentTurnPlayer.isPlayer)
    {
        for (const cardName of msg.cards)
        {
            const card = createCardElement(cardName);
            card.style.top = null;
            makeTableCard(card, round.tableCards.length);
            round.tableCards.push({ element: card, name: cardName });
            toAnimate.push(async () =>
            {
                await placeCardAnimate(round, round.players[prevTurn], { element: card, name: cardName });
                await wait(300);
            });
        }
    }

    const cardNr = msg.cards[0][0];
    if (cardNr === '8')
    {
        if (currentTurnPlayer.isPlayer)
        {
            chooseColorPopup(round);
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
                            toAnimate.push(async () =>
                            {
                                await drawOtherAnimate(player);
                                await wait(300);
                            });
                        }
                    }
                    changePlayerCards(round, player, msg.cards.length);
                }
            }

            if (!(currentTurnPlayer.isPlayer || round.hand.length === 0))
            {
                drawSelf(round, msg.newCards);
            }
            round.draws = 0;
        }
        else
        {
            if (remainingPlayers <= 1)
            {
                toAnimate.push(async () =>
                {
                    toVictory(round);
                });
            }
            else
            {
                nextTurn(round);
            }
        }
        if (round.players[round.currentTurn].isPlayer && remainingPlayers > 1)
        {
            makeTurn(round);
        }

    }
};

const handleMessage = async (msg, round) =>
{
    switch (msg.event)
    {
        case 'place':
            {
                handlePlace(msg, round);
                break;
            }
        case 'chooseColor':
            {
                const topCard = round.tableCards[round.tableCards.length - 1];
                topCard.name = `${topCard.name[0]}${msg.color}`;
                toAnimate.push(async () =>
                {
                    round.colorIndicator.src = `/cards/${msg.color}.svg`;
                    await imageLoad(round.colorIndicator);
                    round.colorIndicator.style.display = null;
                });
                nextTurn(round);
                if (round.players[round.currentTurn].isPlayer)
                {
                    makeTurn(round);
                }

                break;
            }
        case 'drawSelf':
            {
                drawSelf(round, [msg.card]);
                changePlayerCards(round, round.players[round.currentTurn], 1);
                if (round.draws === 3 && getValidMoves(round, []).length === 0)
                {
                    nextTurn(round);
                }
                else
                {
                    makeTurn(round);
                }
                break;
            }
        case 'drawOther':
            {
                round.draws++;
                const currentTurnPlayer = round.players[round.currentTurn];
                toAnimate.push(async () =>
                {
                    await drawOtherAnimate(currentTurnPlayer);
                });
                changePlayerCards(round, round.players[round.currentTurn], 1);
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
                const playerDiv = round.players[msg.id].playerDiv;
                toAnimate.push(async () =>
                {
                    playerDiv.remove();
                });
                round.players.splice(msg.id, 1);
                if (round.players.length === 1)
                {
                    toAnimate.push(async () =>
                    {
                        toVictory(round);
                    });
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
    if (round.deckCards <= 0)
    {
        toAnimate.push(async () =>
        {
            await shuffle(round);
        });
    }
    if (!animating)
    {
        startAnimationQueue();
    }
};

const initPlayers = async (round) =>
{
    const sidebar = document.querySelector('#sidebar');
    const playerIndex = round.players.findIndex((player) => player.isPlayer);
    const playerBasedOrder = [round.players[playerIndex]];
    for (let i = playerIndex + 1; i < round.players.length; i++)
    {
        playerBasedOrder.push(round.players[i]);
    }
    for (let i = 0; i < playerIndex; i++)
    {
        playerBasedOrder.push(round.players[i]);
    }

    playerBasedOrder.forEach((player, i) =>
    {
        if (!player.isPlayer)
        {
            const playerDiv = document.createElement('div');
            playerDiv.classList.add('player-div');
            playerDiv.innerHTML = `<h2></h2> <h3>${player.cards}</h3> ${player.isPlayer ? `` : `<div class = "other-hand-wrapper"></div>`}`;
            playerDiv.firstElementChild.innerText = player.name;
            if (playerIndex < i)
            {

            }
            sidebar.append(playerDiv);
            player.hand = createHand(new Array(player.cards).fill("Card_back"), false);
            playerDiv.hand = playerDiv.lastElementChild;

            for (const card of player.hand)
            {
                card.element.firstElementChild.width = shortHeight ? 45 : 70;
                playerDiv.hand.append(card.element);
            }
            updateHand(player.hand, sidebar.offsetWidth / (shortHeight ? 3 : 2), (shortHeight ? 30 : 40), false);
            const noOtherHand = playerDiv.offsetHeight < PLAYER_DIV_SMALL;
            if (noOtherHand)
            {
                playerDiv.hand.style.display = "none";
            }
            else
            {
                playerDiv.querySelector('h3').style.display = "none";
            }
            player.playerDiv = playerDiv;
        }
    });

    if (!round.players[round.currentTurn].isPlayer)
    {
        round.players[round.currentTurn].playerDiv.classList.add('current-round');
    }
};

const initGraphics = ({ deckElement, centerElement, confirmButton, tableCards, colorIndicator, hand }) =>
{
    deckElement.classList.add('deck');
    centerElement.append(deckElement);

    updateHand(hand);

    confirmButton.classList.add('confirm-button');
    confirmButton.style.display = "none";
    confirmButton.innerText = "OK";
    centerElement.append(confirmButton);

    tableCards[0].element.style.left = `${-1 * tableCards[0].element.firstElementChild.width / 2}px`;
    centerElement.append(tableCards[0].element);

    colorIndicator.classList.add('color-indicator');
    colorIndicator.src = "/cards/C.svg";
    colorIndicator.width = 40;
    colorIndicator.style.display = "none";
    centerElement.append(colorIndicator);

    const autoSortCheckCont = document.createElement('div');
    const autoSortCheck = document.createElement('input');
    autoSortCheck.type = "checkbox";
    autoSortCheck.checked = true;
    autoSortCheck.id = "auto-sort";
    autoSortCheckCont.classList.add('auto-sort');
    autoSortCheckCont.innerText = "Autosortera?";
    autoSortCheckCont.append(autoSortCheck);
    autoSortCheck.addEventListener('click', () =>
    {
        if (autoSortCheck.checked)
        {
            updateHand(hand);
        }
    });


    centerElement.parentElement.append(autoSortCheckCont);
};

const addSortCardsListeners = (round) =>
{
    const handleMoveCard = ({ target }) =>
    {
        if (document.querySelector('#auto-sort').checked)
        {
            return;
        }
        for (const card of round.hand)
        {
            if (isClicked(target, card.element))
            {
                let hasMoved = false;
                round.hand.movedCard = card;
                updateHand(round.hand);
                const onMouseMove = (e) =>
                {
                    let x;
                    if (!e.pageX)
                    {
                        x = e.targetTouches[0].pageX;
                    }
                    else
                    {
                        x = e.pageX;
                    }
                    for (let i = 0; i < round.hand.length; i++)
                    {
                        const checkCard = round.hand[i];
                        const xPos = parseInt(checkCard.element.style.left.split('px')[0]) + round.centerElement.parentElement.offsetWidth / 2 + card.element.firstElementChild.width / 2;
                        if (xPos > x)
                        {
                            round.hand.splice(round.hand.indexOf(card), 1);
                            round.hand.splice(i, 0, card);
                            updateHand(round.hand);
                            hasMoved = true;
                            break;
                        }
                    }

                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('touchmove', onMouseMove);
                const onRelease = () =>
                {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('touchmove', onMouseMove);
                    document.removeEventListener('mouseup', onRelease);
                    document.removeEventListener('touchend', onRelease);
                    round.hand.movedCard = undefined;
                    round.blockNextClick = hasMoved;
                    updateHand(round.hand);
                };
                document.addEventListener('mouseup', onRelease);
                document.addEventListener('touchend', onRelease);
                break;
            }
        }
    };

    round.centerElement.addEventListener('mousedown', handleMoveCard);
    round.centerElement.addEventListener('touchstart', (e) =>
    {
        if (!round.movedCard)
        {
            handleMoveCard(e.targetTouches[0]);
        }
    });
};

const initGame = async (round) =>
{
    initGraphics(round);
    initPlayers(round);
    addSortCardsListeners(round);

    if (round.players[round.currentTurn].isPlayer)
    {
        toAnimate.push(async () =>
        {
            yourTurnAnimate(round);
        });
        makeTurn(round);
        if (!animating)
        {
            startAnimationQueue();
        }
    }
    else
    {
        const msg = document.createElement('div');
        msg.classList.add('start-turn-message', 'turn-message');
        msg.id = "start-turn-msg";
        msg.innerText = `${round.players[round.currentTurn].name} börjar!`;
        document.querySelector('#sidebar').append(msg);
    }
};


export const game =
{
    startGame: (wsckt, msg, players, onGameEnd, onRestart) =>
    {
        document.querySelector('#content').innerHTML =
            `<main class = "lobby-main" id = "main">
                <div id = "center-div" class = "center"></div>
                <div id = "sidebar" class = "player-sidebar"></div>
            </main>`;
        const round =
        {
            wsckt: wsckt,
            hand: createHand(msg.hand, true),
            players: players,
            currentTurn: 0,
            draws: 0,
            deckElement: createCardElement('Card_back'),
            tableCards: [{ element: makeTableCard(createCardElement(msg.topCard), 0), name: msg.topCard }],
            confirmButton: document.createElement('div'),
            centerElement: document.querySelector('#center-div'),
            colorIndicator: document.createElement('img'),
            finishedPlayers: [],
            restart: onRestart,
            deckCards: 51 - 7 * players.length,
            startVictoryCards: onGameEnd
        };
        onResize = async () =>
        {
            smallScreen = window.innerWidth < SMALL_WIDTH || window.innerHeight < SMALL_HEIGHT;
            shortHeight = window.innerHeight < SHORT_HEIGHT;
            const playingCardElements = round.centerElement.querySelectorAll('.card-wrapper');
            playingCardElements.forEach((card) =>
            {
                card.firstElementChild.width = smallScreen ? 120 : 160;
            });
            updateHand(round.hand);

            const sideBarCardElements = document.querySelector('#sidebar').querySelectorAll('.card-wrapper');
            sideBarCardElements.forEach((card) =>
            {
                card.firstElementChild.width = shortHeight ? 45 : 70;
            });
            const sidebar = document.querySelector('#sidebar');
            round.players.forEach((player) =>
            {
                if (!player.isPlayer)
                {
                    const noOtherHand = player.playerDiv.offsetHeight < PLAYER_DIV_SMALL;
                    updateHand(player.hand, sidebar.offsetWidth / (shortHeight ? 3 : 2), (shortHeight ? 30 : 40), false);
                    player.playerDiv.hand.style.display = noOtherHand ? "none" : null;
                    player.playerDiv.querySelector('h3').style.display = noOtherHand ? null : "none";
                }
            });
        };
        window.addEventListener('resize', onResize);
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, round);
        };
        game.statusDump = () =>
        {
            console.log(round);
        };
        initGame(round);
    },
    maxPlayers: 5,
    minPlayers: 2
};

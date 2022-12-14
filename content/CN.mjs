const ANIMATION_DURATION = parseInt(getComputedStyle(document.querySelector(':root')).getPropertyValue('--base-animation-duration-unitless'));
const CARD_RATIO = parseInt(getComputedStyle(document.querySelector(':root')).getPropertyValue('--CN-card-ratio'));
let cardWidth = parseInt(getComputedStyle(document.querySelector(':root')).getPropertyValue('--CN-card-width-unitless'));

//TODO: konvertera min pseudodokumentation till nåt vettigt
export const game =
{
    /*
        This function is called from client.js when all players have joined and the game is starting 
    */
    initGame: (wsckt, msg, players, onGameEnd, onRestart) =>
    {

        /*
            Adds all static parts of the game HTML 
        */
        document.querySelector('#content').innerHTML =
            `<main class = "lobby-main" id = "main">
                <div id = "other-center-div" class = "CN-center flipped">
                    <div class = "CN-indicator-container">
                        <div class="caravan-indicator">                        
                        </div>
                        <span class = "CN-score"><span>0</span> BONEYARD</span>
                        <div class="caravan-indicator">
                        </div>
                        <span class = "CN-score"><span>0</span> REDDING</span>
                        <div class="caravan-indicator">
                        </div>
                        <span class = "CN-score"><span>0</span> SHADY SANDS</span>
                    </div>
                </div>
                <div class = "CN-scoreboard" id = "scoreboard">
                </div>
                <div id = "pov-center-div"  class = "CN-center">
                    <div class = "CN-indicator-container">
                        <div class="caravan-indicator">
                        </div>
                        <span class = "CN-score"><span>0</span> DAYGLOW</span>
                        <div class="caravan-indicator">   
                        </div>
                        <span class = "CN-score"><span>0</span> NEW RENO</span>
                        <div class="caravan-indicator">
                        </div>
                        <span class = "CN-score"><span>0</span> THE HUB</span>
                    </div>
                    <div class = "confirm-button" id = "confirm-button" style = "display: none; top: 10%;">
                        OK
                    </div>
                    <div class = "discard-button" id = "discard-button" style = "display: none;">
                        Släng
                    </div>
                </div>
            </main>`;
        /*
            The round object is used to store global variables
            that are specific to this instance of the game
            + the parameters that the client provides
        */
        const round =
        {
            wsckt: wsckt,
            hand: msg.hand,
            players: players,
            restart: onRestart,
            gameEnd: onGameEnd,
            sides: [[[], [], []], [[], [], []]],
            confirmButton: document.querySelector('#confirm-button'),
            discardButton: document.querySelector('#discard-button'),
            currentTurn: 0,
            inSetUp: true,
            isFirstPlayer: players[0].isPlayer
        };
        game.statusDump = () =>
        {
            return round;
        };
        setUpGame(round);
        if (round.players[round.currentTurn].isPlayer)
        {
            makeTurn(round);
        }

    },
    maxPlayers: 2,
    minPlayers: 2
};

/*
    This needs to be declared here so that it can be removed on game end
    (A consequence of the round object not being a global variable)
    (Which it probably should be but ¯\_(ツ)_/¯)
*/
let onResize;

const FACE_CARDS = "JQKY";
const ALLOWED_FIRST_CARDS = "123456789TA";

/*
    Initializes player hands and caravans
*/
const setUpGame = (round) =>
{
    /*
        Refreshes relevant parts of graphics to adapt to new screen sizes
    */
    onResize = () => 
    {
        cardWidth = parseInt(getComputedStyle(document.querySelector(':root')).getPropertyValue('--CN-card-width-unitless'));
        round.players.forEach((player) =>
        {
            updateHand(player.hand);
        });
        round.sides.forEach((side) => side.forEach((caravan) =>
        {
            updateCaravan(caravan);
        }));
    };
    window.addEventListener('resize', onResize);


    /*
        game.handleMessage is called from client.js when 
        the client recieves a message and the game has started
        
        Is assigned after game start to utilize the round object,
        which is not a global variable
    */
    game.handleMessage = (msg) =>
    {
        handleMessage(msg, round);
    };

    round.players.forEach((player) =>
    {
        player.div = document.querySelector(player.isPlayer ? '#pov-center-div' : '#other-center-div');
        player.cards = 8;
        player.hand = player.isPlayer ?
            round.hand = round.hand.map((cardName) => createCard(cardName, player.div)) :
            Array(player.cards).fill('Card_back').map((cardName) => createCard(cardName, player.div));
        updateHand(player.hand);
        round.sides[player.isPlayer ? 0 : 1].div = player.div;
    });
    round.hand.forEach((card) =>
    {
        card.element.classList.add('hoverable-card');
    });

    round.sides.forEach((side) =>
    {
        side.forEach((caravan, caravanIndex) =>
        {
            caravan.indicator = side.div.querySelectorAll('.caravan-indicator')[caravanIndex];
            caravan.score = 0;
            caravan.scoreSpan = side.div.querySelectorAll(`span>span`)[caravanIndex];
            caravan.scoreSpan.innerText = caravan.score;
        });
    });
};

/*
    This function should be called once
    every time it is the player's turn

    It has local variables for things 
    that only need to be saved during 
    the turn and adds a click event 
    listener which is not removed until 
    the turn is over 
*/
const makeTurn = (round) =>
{
    let activeSide;
    let activeCaravan;
    let placedCard;
    let onCard;
    let discarding = false;
    yourTurnAnimate(round);
    const turnClick = (e) =>
    {
        /*
            If no card from the hand has been chosen and 
            a  hand card has been clicked, move it to the 
            bottom of the screen and remove it from the hand
            
            Validation is only done here for placing during
            setup, otherwise it is done when placing on a 
            caravan
        */
        let handClicked = false;
        for (let i = 0; i < round.hand.length; i++)
        {
            const card = round.hand[i];
            if (isClicked(e.target, card.element))
            {
                if (round.inSetUp)
                {
                    if (!placedCard && ALLOWED_FIRST_CARDS.includes(card.name[0]))
                    {
                        placedCard = card;
                        round.hand.splice(i, 1);
                        updateHand(round.hand);
                        const caravan = round.sides[0].find((caravan) => caravan.length === 0);
                        addToCaravan(caravan, card);
                        updateCaravan(caravan);
                        card.element.style.transform = null;
                        card.element.classList.remove('hoverable-card');
                        activeCaravan = caravan;
                        activeSide = round.sides[0];
                        round.confirmButton.style.display = null;
                        handClicked = true;
                        break;
                    }
                }
                else if (discarding)
                {
                    const msgObj =
                    {
                        action: "DismissCard",
                        card: card.name
                    };
                    discardCardAnimate(round.hand, i);
                    round.discardButton.style = null;
                    round.discardButton.style.display = "none";
                    round.wsckt.send(JSON.stringify(msgObj));
                    round.removeTurnClick();
                    handClicked = true;
                    break;
                }
                if (!activeCaravan && !round.inSetUp)
                {
                    round.hand.splice(i, 1);
                    animateToBottom(card.element);
                    if (placedCard)
                    {
                        round.hand.push(placedCard);
                        updateHand(round.hand);
                        round.confirmButton.style.display = "none";
                        round.discardButton.style.display = null;

                    }
                    updateHand(round.hand);
                    placedCard = card;
                    round.discardButton.style.display = "none";
                    handClicked = true;
                    break;
                }
                if (activeCaravan)
                {
                    const validReplacement = (validatePlacementCaravan(card, activeCaravan.slice(0, -1), 0) && !onCard)
                        || (onCard && validatePlacementFaceCard(card, activeCaravan, onCard, onCard.faceCards.slice(0, -1)));
                    if (validReplacement || !round.inSetUp)
                    {
                        round.hand.splice(i, 1);
                        returnCardToHand(placedCard, activeCaravan, onCard, activeSide, round);
                        placedCard = card;
                        if (validReplacement)
                        {
                            if (onCard)
                            {
                                placeCard(round, activeCaravan, placedCard, undefined, activeSide, 0, activeSide, onCard, onCard, activeCaravan.indexOf(onCard));
                            }
                            else
                            {
                                placeCard(round, activeCaravan, placedCard, undefined, activeSide, 0, activeSide);
                                onCard = undefined;
                            }
                        }
                        else
                        {
                            updateCaravan(activeCaravan);
                            animateToBottom(card.element);
                            activeCaravan = undefined;
                            activeSide = undefined;
                            onCard = undefined;
                            round.confirmButton.style.display = "none";
                            round.discardButton.style.display = null;
                        }
                        updateHand(round.hand);
                        handClicked = true;
                        break;
                    }
                }
                handClicked = true;
                break;
            }
        }
        if (!placedCard && isClicked(e.target, round.discardButton))
        {
            discarding = !discarding;
            round.discardButton.style.backgroundColor = discarding ? "#a03939" : null;
        }
        else if (discarding)
        {
            const side = round.sides[0];
            for (let j = 0; j < side.length; j++)
            {
                const caravan = side[j];
                let discard = false;
                if (isClicked(e.target, caravan.indicator))
                {
                    discard = true;
                }
                else
                {
                    for (let k = 0; k < caravan.length; k++)
                    {
                        const card = caravan[k];
                        if (isClicked(e.target, card.element))
                        {
                            discard = true;
                        }
                        else
                        {
                            for (let l = 0; l < card.faceCards.length; l++)
                            {
                                const faceCard = card.faceCards[l];
                                if (isClicked(e.target, faceCard.element))
                                {
                                    discard = true;
                                }
                            }
                        }
                    }
                }
                if (discard)
                {
                    const msgObj =
                    {
                        action: "DismissLane",
                        col: j
                    };
                    round.discardButton.style = null;
                    round.discardButton.style.display = "none";
                    round.wsckt.send(JSON.stringify(msgObj));
                    round.removeTurnClick();
                    handClicked = true;
                    break;
                }
            }

        }

        if (placedCard && !handClicked)
        {
            /*
                Returns card to hand if it is clicked
                while pending placement
            */
            if (isClicked(e.target, placedCard.element))
            {
                [placedCard, activeCaravan, onCard, activeSide] = returnCardToHand(placedCard, activeCaravan, onCard, activeSide, round);
            }

            /*
                Confirms placement and sends to server without
                validation which should be done when the card
                is originally placed
                
                Also does some final styling on placed cards
            */
            else if (isClicked(e.target, round.confirmButton))
            {
                const caravanIndex = activeSide.indexOf(activeCaravan);
                const pos = activeCaravan.includes(placedCard) ? activeCaravan.length - 1 : activeCaravan.indexOf(onCard);
                const msgObj =
                {
                    action: "Place",
                    card: placedCard.name,
                    side: sideFlip(round.isFirstPlayer, round.sides.indexOf(activeSide)),
                    col: caravanIndex,
                    pos: pos
                };
                if (!onCard)
                {
                    makeCaravanCard(placedCard);
                }
                else
                {
                    makeFaceCard(placedCard);
                }
                round.confirmButton.style.display = "none";
                round.wsckt.send(JSON.stringify(msgObj));
                round.removeTurnClick();
            }
            else if (!round.inSetUp)
            {
                for (const side of round.sides)
                {
                    for (let i = 0; i < side.length; i++)
                    {
                        const caravan = side[i];
                        let indicatorClicked = false;
                        let faceCardClicked = false;
                        let cardClicked = false;
                        if (isClicked(e.target, caravan.indicator))
                        {
                            indicatorClicked = true;
                        }
                        else
                        {
                            for (let j = 0; j < caravan.length; j++)
                            {
                                const card = caravan[j];
                                if (card === placedCard)
                                {
                                    continue;
                                }
                                card.faceCards.forEach((faceCard) =>
                                {
                                    if (isClicked(e.target, faceCard.element))
                                    {
                                        faceCardClicked = true;
                                        return;
                                    }
                                });
                                if (!faceCardClicked && isClicked(e.target, card.element))
                                {
                                    cardClicked = true;
                                }
                                if (faceCardClicked || cardClicked)
                                {
                                    if (validatePlacementFaceCard(placedCard, caravan, card, card.faceCards))
                                    {
                                        const place = placeCard(round, caravan, placedCard, activeCaravan, side, round.sides.indexOf(side), activeSide, onCard, card, j);
                                        activeCaravan = place.activeCaravan;
                                        onCard = place.onCard;
                                        activeSide = side;
                                        break;
                                    }
                                }
                            }
                        }
                        if ((indicatorClicked || cardClicked || faceCardClicked) && validatePlacementCaravan(placedCard, caravan, round.sides.indexOf(side)))
                        {
                            const place = placeCard(round, caravan, placedCard, activeCaravan, side, round.sides.indexOf(side), activeSide);
                            activeCaravan = place.activeCaravan;
                            activeSide = side;
                            break;
                        }
                    }
                }
            }
        }
        if (!animating)
        {
            startAnimationQueue();
        }

    };
    document.addEventListener('click', turnClick);
    round.removeTurnClick = () =>
    {
        document.removeEventListener('click', turnClick);
    };
};

const returnCardToHand = (placedCard, activeCaravan, onCard, activeSide, round) =>
{
    round.hand.push(placedCard);
    updateHand(round.hand);
    if (activeCaravan)
    {
        placedCard.element.classList.add('hoverable-card');
        popCaravan(activeCaravan, onCard);
        updateCaravan(activeCaravan);
        if (round.sides.indexOf(activeSide) === 1)
        {
            const pos = getReversePosition(placedCard);
            round.sides[0].div.append(placedCard.element);
            placedCard.element.animate([
                {
                    left: `${pos.left}px`,
                    top: `${pos.top}px`,
                    transform: "rotate(0deg)"
                }, {}], { duration: ANIMATION_DURATION, easing: "ease" });
        }
        activeCaravan = undefined;
        onCard = undefined;
        activeSide = undefined;
    }
    round.confirmButton.style.display = "none";
    if (!round.inSetUp)
    {
        round.discardButton.style.display = null;
    }
    placedCard = undefined;
    return [placedCard, activeCaravan, onCard, activeSide];
};

/*
    Does the actual moving of cards that 
    are placed after setup, both in regard
    to animation and game data.
*/
const placeCard = (round, caravan, placedCard, activeCaravan, side, sideIndex, activeSide, onCard, newOnCard, newOnCardIndex) =>
{
    let activeCaravanExists = false;
    if (activeCaravan)
    {
        activeCaravanExists = true;
        popCaravan(activeCaravan, onCard);
        updateCaravan(activeCaravan);
    }
    if ((activeSide ? round.sides.indexOf(activeSide) : 0) !== sideIndex)
    {
        const pos = getReversePosition(placedCard);
        addToCaravan(caravan, placedCard, newOnCardIndex);
        toAnimate.push(async () =>
        {
            await new Promise((resolve) =>
            {
                side.div.append(placedCard.element);
                updateCaravan(caravan);
                let transform = `rotate(${pos.angle}deg)`;
                if (!activeCaravanExists)
                {
                    transform += " scale(1.6)";
                    animateToCaravans(placedCard.element);
                }
                placedCard.element.animate([{ left: `${pos.left}px`, top: `${pos.top}px`, transform: transform }, { transform: `rotate(0deg)` }], { duration: ANIMATION_DURATION, easing: "ease" }).addEventListener('finish', resolve);
            });
        });
    }
    else 
    {
        addToCaravan(caravan, placedCard, newOnCardIndex);
        toAnimate.push(async () =>
        {
            await new Promise((resolve) =>
            {
                updateCaravan(caravan);
                if (!activeCaravanExists)
                {
                    animateToCaravans(placedCard.element);
                }
                resolve();

            });
        });
    }
    activeCaravan = caravan;
    onCard = newOnCard;
    round.confirmButton.style.display = null;
    round.discardButton.style.display = "none";
    return { activeCaravan: activeCaravan, onCard: onCard };
};

const isClicked = (clickTarget, parentElement) =>
{
    return clickTarget === parentElement || parentElement.contains(clickTarget);
};

/*
    Returns true if a given card is 
    allowed to be placed at the bottom
    of a given caravan and false if it
    is not allowed
*/
const validatePlacementCaravan = (card, caravan, sideIndex) =>
{
    if (sideIndex === 1)
    {
        return false;
    }

    if (FACE_CARDS.includes(card.name[0]))
    {
        return false;
    }

    if (caravan.length === 0)
    {
        return true;
    }

    if (caravan[caravan.length - 1].name[0] === card.name[0])
    {
        return false;
    }

    if (caravan.length < 2)
    {
        return true;
    }
    if (colorMatch(caravan[caravan.length - 1], card) || followsPlacementDirection(caravan, card))
    {
        return true;
    }

    return false;
};

/*
    Returns true if a given card is 
    allowed to be placed on top of
    another given card and false
    if it is not allowed 
*/
const validatePlacementFaceCard = (card, caravan, onCard, faceCards) =>
{
    if (!FACE_CARDS.includes(card.name[0]))
    {
        return false;
    }

    if (onCard.dead)
    {
        return false;
    }

    if (faceCards.length == 3)
    {
        return false;
    }

    if (card.name[0] !== 'Q' || onCard === caravan[caravan.length - 1])
    {
        return true;
    }

    return false;
};

/*
    Moves a card to the bottom of the screen with an animation
*/
const animateToBottom = (cardElement) =>
{
    cardElement.style.top = "80%";
    cardElement.style.transform = "scale(1.6)";
    cardElement.style.zIndex = 50;
    cardElement.style.left = `-${cardWidth / 2}px`;
};

/*
    Animates a card from the bottom of the screen to the caravan area
*/
const animateToCaravans = (cardElement) =>
{
    cardElement.classList.remove('hoverable-card');
    cardElement.style.transform = null;
};

/*
    Animates a card moving from the 
    opponent player's hand to a caravan
*/
const otherPlaceCardAnimate = (caravan, sideId, card, currentTurnPlayer, round) =>
{
    return new Promise(async (resolve) =>
    {
        const randomCardIndex = Math.floor(Math.random() * currentTurnPlayer.hand.length);
        const [cardToMove] = currentTurnPlayer.hand.splice(randomCardIndex, 1);
        await imageLoad(card.element.firstElementChild);
        updateHand(currentTurnPlayer.hand);
        let top;
        let transform;
        if (sideId === 1)
        {
            top = cardToMove.element.style.top;
            transform = cardToMove.element.style.transform;
        }
        else
        {
            const pos = getReversePosition(cardToMove);
            top = `${pos.top}px`;
            transform = `rotate(${pos.angle}deg)`;
        }
        card.element.animate([
            {
                top: top,
                left: cardToMove.element.style.left,
                transform: transform,
                zIndex: 100,
            }, { zIndex: 100 }], { duration: 2 * ANIMATION_DURATION, easing: "ease" });
        cardToMove.element.remove();
        round.sides[sideId].div.append(card.element);
        updateCaravan(caravan);
        setTimeout(resolve, 2 * ANIMATION_DURATION + 100);
    });
};

const discardCardAnimate = (hand, i = -1) =>
{
    return new Promise(async (resolve) =>
    {
        const cardIndex = i !== -1 ? i : Math.floor(Math.random() * hand.length);
        const [cardToMove] = hand.splice(cardIndex, 1);
        updateHand(hand);
        cardToMove.element.animate([{}, { top: "55vh" }], { duration: 2 * ANIMATION_DURATION, easing: "ease", fill: "forwards" });
        setTimeout(() =>
        {
            cardToMove.element.remove();
            resolve();
        }, 750);
    });
};

/*
    Animates a card from a player's
    deck to their hand
*/
const newCardAnimate = async (player, newCard) =>
{
    await imageLoad(newCard.element.firstElementChild);
    if (player.isPlayer) 
    {
        newCard.element.classList.add('hoverable-card');
    }
    player.div.append(newCard.element);
    updateHand(player.hand);
    newCard.element.animate([
        {
            left: `${newCard.element.offsetLeft + 100}px`,
            transform: 'rotate(0deg)',
            zIndex: 100,
        }, { zIndex: 100 }], { duration: 2 * ANIMATION_DURATION, easing: "ease" });
};

const yourTurnAnimate = (round) =>
{
    const msg = document.createElement('div');
    msg.classList.add('your-turn-message', 'turn-message');
    msg.id = "turn-msg";
    msg.innerText = "Din tur!";
    document.querySelector('#main').append(msg);
    if (!round.inSetUp)
    {
        round.discardButton.style.display = null;
    }
};

/*
    Creates a standard card HTML element without positioning or appending 
*/
const createCardElement = (cardName) =>
{
    const card = document.createElement('div');
    card.classList.add('playing-card', 'card-wrapper');
    card.innerHTML = `<img src = "/cards/${cardName}.svg" class = "CN-responsive" draggable = "false">`;
    return card;
};

/*
    Creates a card object,
    {
        name: the two-letter code of the value of the card,
        element: the HTML element which represents the card
    }

    If the second parameter is given the function will also add 
    the card to the HTML document by appending to given parent element
*/
const createCard = (cardName, parent) =>
{
    const cardElement = createCardElement(cardName);
    if (parent)
    {
        parent.append(cardElement);
    }
    return { name: cardName, element: cardElement };
};

/*
    Adds properties to a placed caravan card
    that can no longer be modified
*/
const makeCaravanCard = (card) =>
{
    card.element.classList.add('caravan-card');
    card.element.style.transform = `rotate(0deg)`;
    card.faceCards = [];
    card.element.addEventListener('mouseover', () =>
    {
        card.faceCards.forEach((faceCard) =>
        {
            faceCard.element.style.opacity = 0.6;
        });
    });
    card.element.addEventListener('mouseleave', () =>
    {
        card.faceCards.forEach((faceCard) =>
        {
            faceCard.element.style.opacity = null;
        });
    });
};

/*
    Rotates the face cards slightly
    to make them stick out
*/
const makeFaceCard = (card) =>
{
    const rotation = Math.floor(Math.random() * 5) * (Math.round(Math.random()) === 0 ? -1 : 1);
    card.element.style.transform = `rotate(${rotation}deg)`;
};

/*
    Resolves if the provided img element
    has loaded fully or, if it is not
    loaded, when that occurs
*/
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

/*
    Updates the hand graphics by recalculating 
    the position of each card depending on how many 
    cards are in the hand
    (!) Uses JS for positioning (!)
*/
const HAND_SIZE_FACTOR = 0.25; //just a magic number that happened to work well
const MAX_HAND_ANGLE = 20;
const updateHand = (hand) =>
{
    for (let i = 0; i < hand.length; i++)
    {
        const cardElement = hand[i].element;
        const height = cardWidth * CARD_RATIO * HAND_SIZE_FACTOR;
        const width = cardWidth * hand.length * HAND_SIZE_FACTOR;
        const percentage = hand.length === 1 ? 0.5 : i / (hand.length - 1);
        const left = -width + percentage * width - width / 2 - cardWidth / 2;
        const degrees = hand.length === 2 ? MAX_HAND_ANGLE / 2 : MAX_HAND_ANGLE;
        const rotation = ((percentage * degrees * 2) - degrees);
        cardElement.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * height - height / 2);
        cardElement.style.top = `calc(${top}px)`;
        cardElement.style.left = `calc(50vw + ${left}px - 1rem)`;
        cardElement.style.zIndex = `${i + 62}`;
    }
};

/*
    Updates the caravan graphics by recalculating 
    the position of each card depending on where 
    it is in the caravan
    (!) Uses JS for positioning (!)
*/
const updateCaravan = (caravan) =>
{
    let pos = 0;
    let zIndex = 50;
    caravan.forEach((card) =>
    {
        card.element.style.top = `calc(1rem + ${pos}px)`;
        const left = caravan.indicator.offsetLeft + caravan.indicator.parentElement.offsetLeft;
        card.element.style.left = `${left}px`;
        card.element.style.zIndex = zIndex;
        zIndex += 1;

        if (card.faceCards)
        {
            let leftPosFactor = Array.from(document.querySelectorAll('.flipped div')).includes(card.element) ? -1 : 1;
            let leftPos = cardWidth / 5;
            card.faceCards.forEach((faceCard) =>
            {
                faceCard.element.style.top = `calc(1.1rem + ${pos}px)`;
                const left = caravan.indicator.offsetLeft + caravan.indicator.parentElement.offsetLeft + (leftPos * leftPosFactor);
                leftPos += cardWidth / 5;
                faceCard.element.style.left = `${left}px`;
                faceCard.element.style.zIndex = zIndex;
                zIndex += 1;
            });
        }
        pos += (cardWidth * CARD_RATIO) / 5;
    });
    caravan.indicator.style.top = `${pos}px`;
};

/*
    Messages from the server are sent here by the client
    The animation queue is then started if not already going

    See handlePlace, handleDismissLane, handleDismissCard and handleLeave
    for what actually happens
*/
const handleMessage = (msg, round) =>
{
    msg.side = sideFlip(round.isFirstPlayer, msg.side);
    switch (msg.event)
    {
        case 'place':
            handlePlace(msg, round);
            break;
        case 'dismissLane':
            handleDismissLane(msg, round);
            break;
        case 'dismissCard':
            handleDismissCard(msg, round);
            break;
        case 'leave':
            handleLeave(msg, round);
            break;
    }
    startNextTurn(round);
    if (!animating)
    {
        startAnimationQueue();
    }
};


/*
    Handles a place event, when 
    any player places a card

    msg object contains
    {
        event: 'place',
        card: two-letter code for card value,
        side: which side the card is placed on -- 0 is the player side,
        col: which caravan the card is placed on, numbered 0 to 2 from left to right
        pos: which position on the caravan the card is placed on, numbered from 0,
        ?newCard: card code, if card placement occurs after setup and the recieving player placed the card
    }
*/
const handlePlace = (msg, round) =>
{
    const currentTurnPlayer = round.players[round.currentTurn];
    if (currentTurnPlayer.cards > 5)
    {
        currentTurnPlayer.cards -= 1;
    }
    else
    {
        const newCard = createCard(currentTurnPlayer.isPlayer ? msg.newCard : "Card_back");
        currentTurnPlayer.hand.push(newCard);
        toAnimate.push(async () =>
        {
            await newCardAnimate(currentTurnPlayer, newCard);
        });
    }
    const caravan = round.sides[msg.side][msg.col];
    if (!currentTurnPlayer.isPlayer)
    {
        const card = { name: msg.card, element: createCardElement(msg.card) };
        addToCaravan(caravan, card, msg.pos);
        if (!FACE_CARDS.includes(card.name[0]))
        {
            makeCaravanCard(card);
        }
        else
        {
            makeFaceCard(card);
        }
        toAnimate.push(async () =>
        {
            updateCaravan(caravan);
            await otherPlaceCardAnimate(caravan, msg.side, card, currentTurnPlayer, round);
        });
    }

    if (round.inSetUp && round.currentTurn === 1 && msg.col === 2)
    {
        round.inSetUp = false;
    }

    if (msg.card[0] === 'Q')
    {
        caravan[caravan.length - 1].customColor = msg.card[1];
    }
    else if (msg.card[0] === 'J')
    {
        const card = caravan[msg.pos];
        card.dead = true;
        updateCaravanScore(caravan);
        toAnimate.push(async () =>
        {
            killCard(card, caravan);
            updateCaravan(caravan);
        });
    }
    else if (msg.card[0] === 'Y')
    {
        const onCard = caravan[msg.pos];
        if (onCard.name[0] === 'A')
        {
            removeAllOf(1, onCard, round);
        }
        else
        {
            removeAllOf(0, onCard, round);
        }
    }
};


/*
    Handles when a player chooses to
    dismiss an entire lane


    msg object contains
    {
        event: 'dismissLane',
        col: which lane to dismiss, 
        numbered 0 to 2 from left to right
    }
*/
const handleDismissLane = (msg, round) =>
{
    const currentTurnPlayer = round.players[round.currentTurn];
    const caravan = round.sides[currentTurnPlayer.isPlayer ? 0 : 1][msg.col];
    caravan.forEach((card) =>
    {
        card.dead = true;
        toAnimate.push(async () =>
        {
            killCard(card, caravan);
        });

    });
    toAnimate.push(async () =>
    {
        updateCaravan(caravan);
    });
    updateCaravanScore(caravan);
};

/*
    Handles when a player chooses to
    dismiss a card (from their hand?)

    msg object contains
    {
        event: 'dismissCard',
        ?newCard: if this player is the one who dismissed the card, new card which appears in its place 
    }
*/
const handleDismissCard = (msg, round) =>
{
    const currentTurnPlayer = round.players[round.currentTurn];
    const newCard = createCard(currentTurnPlayer.isPlayer ? msg.newCard : "Card_back");
    currentTurnPlayer.hand.push(newCard);
    toAnimate.push(async () =>
    {
        await newCardAnimate(currentTurnPlayer, newCard);
    });
    if (!currentTurnPlayer.isPlayer)
    {
        toAnimate.push(async () =>
        {
            await discardCardAnimate(currentTurnPlayer.hand);
        });
    }
};


/*
    Handles when a player leaves the game
    In CN this immediately ends the game

    msg object contains
    {
        event: 'leave',
        id: id of player leaving the game 
    }
*/
const handleLeave = (msg, round) =>
{
    toAnimate.push(async () =>
    {
        toVictory(round);
    });
};

const startNextTurn = (round) =>
{
    const wonColumns = [undefined, undefined, undefined];
    round.sides.forEach((side, id) =>
    {
        side.forEach((caravan, i) =>
        {
            if (caravan.score >= 21 && caravan.score <= 26)
            {
                caravan.sideId = id;
                if (wonColumns[i])
                {
                    if (wonColumns[i].score === caravan.score)
                    {
                        wonColumns[i] = undefined;
                    }
                    else
                    {
                        wonColumns[i] = wonColumns[i].score > caravan.score ? wonColumns[i] : caravan;
                    }
                }
                else
                {
                    wonColumns[i] = caravan;
                }
            }
        });
    });

    if (!wonColumns.includes(undefined))
    {
        toAnimate.push(async () =>
        {
            toVictory(round, wonColumns);
        });
    }
    else
    {
        round.currentTurn = (round.currentTurn + 1) % 2;
        if (round.players[round.currentTurn].isPlayer)
        {
            makeTurn(round);
        }
        else
        {
            toAnimate.push(async () =>
            {
                const msg = document.querySelector('#turn-msg');
                if (msg)
                {
                    msg.animate([{}, { top: "-4rem" }], { duration: ANIMATION_DURATION, easing: "ease", fill: "forwards" });
                    setTimeout(() =>
                    {
                        msg.remove();
                    }, ANIMATION_DURATION);
                }
            });
        }
    }
};

const toVictory = (round, wonColumns) =>
{
    let winnerI;
    let loserI;
    if (wonColumns)
    {
        wonColumns = wonColumns.map(value => value.sideId);
        const playerWon = wonColumns.reduce((prev, cur) => prev += cur === 0 ? 1 : 0, 0) >= 2;
        winnerI = playerWon ? (round.isFirstPlayer ? 0 : 1) : (round.isFirstPlayer ? 1 : 0);
        loserI = playerWon ? (round.isFirstPlayer ? 1 : 0) : (round.isFirstPlayer ? 0 : 1);
    }
    else
    {
        winnerI = (round.isFirstPlayer ? 0 : 1);
        loserI = (round.isFirstPlayer ? 1 : 0);
    }
    document.querySelector('#content').innerHTML = '<main class = "lobby-main" id = "background-wrapper"></main>';
    const main = document.querySelector('#background-wrapper');
    main.innerHTML =
        `<div class="win-screen">
            <div class="winner">
                ${round.players[winnerI].name}
            </div>
            <div class="podium"><div>${round.players[loserI].name}</div></div>
        </div>
        <div class="restart-button" id="restart">Nytt spel</div>`;
    round.gameEnd();
    round.removeTurnClick();
    window.removeEventListener('resize', onResize);
    document.querySelector('#restart').addEventListener('click', round.restart);

};

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

/*
    Converts between the server's player id
    based numbering of the sides and the
    client's numbering of the sides
*/
const sideFlip = (noFlip, side) =>
{
    if (noFlip)
    {
        return side;
    }
    else
    {
        return (side + 1) % 2;
    }
};

/*
    Returns the numerical value of a given card
    If a card is dead but has not yet been
    removed by the animation queue, the
    function will return 0
*/
const getValueOfCard = ({ name, dead }) =>
{
    return dead ? 0 : name[0] === "A" ? 1 : name[0] === 'T' ? 10 : parseInt(name[0]);
};

/*
    Returns whether a card would follow the
    placement direction of a given caravan

    Returns true if a card has been removed so that no
    apparent direction exists
*/
const followsPlacementDirection = (caravan, card) =>
{
    const topCard = caravan[caravan.length - 1];
    const secondCard = caravan[caravan.length - 2];
    const queenFactor = (-1) ** topCard.faceCards.reduce((prev, cur) => prev + (cur.name[0] === 'Q' ? 1 : 0), 0);
    const placeDirSign = Math.sign((getValueOfCard(topCard) - getValueOfCard(secondCard)) * queenFactor);
    const newDirSign = Math.sign(getValueOfCard(card) - getValueOfCard(topCard));
    return placeDirSign === newDirSign || secondCard.name[0] === topCard.name[0];
};

/*
*/
const colorMatch = (card1, card2) => 
{
    return (card1.customColor && card1.customColor === card2.name[1]) || (!card1.customColor && card1.name[1] === card2.name[1]);
};

/*
    Logic for adding cards to caravans 
    is handled here. If the pos param is
    on another card the placement will
    be treated as a face card
*/
const addToCaravan = (caravan, card, pos = caravan.length) =>
{
    if (pos !== caravan.length)
    {
        caravan[pos].faceCards.push(card);
    }
    else
    {
        caravan.push(card);
    }
    updateCaravanScore(caravan);
};

/*
    Removes a card, either from its caravan
    or, if the second parameter is given,
    from the card it is placed on

    This function does not change any graphics
    expect for the scoreboard
*/
const popCaravan = (caravan, onCard) =>
{
    const card = onCard ? onCard.faceCards.pop() : caravan.pop();
    updateCaravanScore(caravan);
    return card;
};

/*
    Calculates the total score of given function
    and updates the caravan.score function as
    well as the scoreboard span element
*/
const updateCaravanScore = (caravan) =>
{
    let score = 0;
    caravan.forEach((card) =>
    {
        let cardScore = getValueOfCard(card);
        if (card.faceCards)
        {
            const kingCount = card.faceCards.reduce((prev, cur) => prev += cur.name[0] === 'K', 0);
            cardScore *= 2 ** kingCount;
        }
        score += cardScore;
    });
    caravan.score = score;
    caravan.scoreSpan.innerText = caravan.score;
    caravan.scoreSpan.style.color = caravan.score >= 21 && caravan.score <= 26 ? "green" : caravan.score > 26 ? "red" : null;
};

/*
    Returns the position of a card as if 
    placed on the opposite side of the table

    Used for animating across the table

    (!) Only for card elements
*/
const getReversePosition = ({ element }) =>
{
    const top = -element.offsetTop - document.querySelector('#scoreboard').offsetHeight - (cardWidth * CARD_RATIO);
    const left = element.offsetLeft;
    const angleExists = element.style.transform && element.style.transform.includes('rotates');
    const angle = angleExists ? -(element.style.transform.split('rotate(')[1].split('deg)')[0]) : 0;
    return { top: top, left: left, angle: angle };
};

/*
    Removes all cards in all caravans that
    match the given ofCard in either value (0)
    or color (1) expect the actual ofCard
    card itself
*/
const removeAllOf = (type, ofCard, round) =>
{
    round.sides.forEach((side) =>
    {
        side.forEach((caravan) =>
        {
            caravan.forEach((card) =>
            {
                if (card.name[type] === ofCard.name[type] && card !== ofCard)
                {
                    card.dead = true;
                    toAnimate.push(async () =>
                    {
                        killCard(card, caravan);
                    });
                }
            });
            toAnimate.push(async () =>
            {
                updateCaravan(caravan);
            });
            updateCaravanScore(caravan);

        });
    });
};

/*
    Removes a card from the board by lifting 
    it out of frame
*/
const killCard = (card, caravan) =>
{
    caravan.splice(caravan.indexOf(card), 1);
    const keyFrames = [{}, { top: "calc(50vh + 100px)" }];
    const settings = { duration: 2 * ANIMATION_DURATION, easing: "ease", fill: "forwards" };

    card.element.animate(keyFrames, settings);
    setTimeout(() =>
    {
        card.element.remove();
    }, 2 * ANIMATION_DURATION + 100);
    if (card.faceCards)
    {
        card.faceCards.forEach((faceCard) =>
        {
            faceCard.element.animate(keyFrames, settings);
            setTimeout(() =>
            {
                faceCard.element.remove();
            }, 2 * ANIMATION_DURATION + 100);
        });
    }
};

"use strict";
const CARD_NUMBERS = "23456789JQKA";

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


const createDeckT8 = (hand) =>
{
    const centerElement = document.querySelector('#center-div');
    hand = sortHand(hand);
    for (let cardName of hand)
    {
        const card = document.createElement('div');
        card.classList.add('card-wrapper');
        card.classList.add('hoverable-card');
        card.innerHTML = `<img src = "/2color/${cardName}.svg" draggable = "false" width = 200>`;
        centerElement.append(card);
        const percentage = hand.indexOf(cardName) / (hand.length - 1);
        const rotation = (percentage * 76) - 38;
        card.style.transform = `rotate(${rotation}deg)`;
        const top = Math.abs(percentage * 60 - 30);
        card.style.top = `${top}px`;
        const left = percentage * (250) - 125 - card.offsetWidth / 2;
        card.style.left = `${left}px`;
    }
};

const handleMessage = (msg, wsckt, hand, players) =>
{
};



export const game =
{
    startGame: (wsckt, hand, players, gameId) =>
    {
        game.handleMessage = (msg) =>
        {
            handleMessage(msg, wsckt, hand, players);
        };
        switch (gameId)
        {
            case 'T8':
                {
                    createDeckT8(hand);
                    break;
                }
        }
    }
};

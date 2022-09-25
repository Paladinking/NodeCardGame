"use strict";

/*for (const number of "A23456789JQK") {
    for (const color of "SCDH") {
        let wrapper = document.createElement("div");
        wrapper.innerHTML = `<img src=2color/${number}${color}.svg alt="Playing card" draggable="false">`;
        let img = wrapper.firstChild;
        document.body.append(img);
    }
}*/

const isClicked = (target, id) =>
{
    let idDoc = document.querySelector(`#${id}`);
    return target == idDoc || idDoc.contains(target);
};

const ids = ["T8"];

document.addEventListener('click', async (e) =>
{
    for (const id of ids)
    {
        if (isClicked(e.target, id))
        {
            
        }
    }
});
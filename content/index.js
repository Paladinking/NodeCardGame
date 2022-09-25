for (const number of "A23456789JQK") {
	for (const color of "SCDH") {
		let wrapper = document.createElement("div");
        wrapper.innerHTML = `<img src=2color/${number}${color}.svg alt="Playing card" draggable="false">`;
        let img = wrapper.firstChild;
        document.body.append(img);
	}
}
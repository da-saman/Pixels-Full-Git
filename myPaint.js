var Picture = class Picture {
    constructor(width, height, pixels) {
        this.width = width;
        this.height = height;
        this.pixels = pixels;
    }
    static empty(width, height, color) {
        let pixels = new Array(width * height).fill(color);
        return new Picture(width, height, pixels);
    }
    pixel(x, y) {
        return this.pixels[x + y * this.width];
    }
    draw(pixels) {
        let copy = this.pixels.slice();
        for (let { x, y, color } of pixels) {
            copy[x + y * this.width] = color;
        }
        return new Picture(this.width, this.height, copy);
    }
}

function elt(type, props, ...children) {
    let dom = document.createElement(type);
    if (props) Object.assign(dom, props);
    for (let child of children) {
        if (typeof child != "string") dom.appendChild(child);
        else dom.appendChild(document.createTextNode(child));
    }
    return dom;
}

var scale = 10;

var PictureCanvas = class PictureCanvas {
    constructor(picture, pointerDown) {
        this.dom = elt("canvas", { onmousedown: event => this.mouse(event, pointerDown) });
        this.syncState(picture);
    }
    syncState(picture) {
        if (this.picture == picture) return;
        drawPicture(picture, this.picture, this.dom, scale);
        this.picture = picture;
    }
}

function drawPicture(newPicture, oldPicture, canvas, scale) {
    if (!oldPicture) {
        canvas.width = newPicture.width * scale;
        canvas.height = newPicture.height * scale;
    }
    let cx = canvas.getContext("2d");

    for (let y = 0; y < newPicture.height; y++) {
        for (let x = 0; x < newPicture.width; x++) {
            if (!oldPicture || !oldPicture.pixel(x, y) || newPicture.pixel(x, y) != oldPicture.pixel(x, y)) {
                cx.fillStyle = newPicture.pixel(x, y);
                cx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
}

PictureCanvas.prototype.mouse = function (downEvent, onDown) {
    if (downEvent.button != 0) return;
    let pos = pointerPosition(downEvent, this.dom);
    let onMove = onDown(pos);
    if (!onMove) return;

    let move = (moveEvent) => {
        if (moveEvent.buttons == 0) {
            this.dom.removeEventListener("mousemove", move);
        } else {
            let newPos = pointerPosition(moveEvent, this.dom);
            if (newPos.x == pos.x && newPos.y == pos.y) return;
            pos = newPos;
            onMove(newPos);
        }
    };
    this.dom.addEventListener("mousemove", move);
};

function pointerPosition(moveEvent, domNode) {
    let rect = domNode.getBoundingClientRect();
    return {
        x: Math.floor((moveEvent.clientX - rect.left) / scale),
        y: Math.floor((moveEvent.clientY - rect.top) / scale)
    };
}


var PixelEditor = class PixelEditor {
    constructor(state, config) {
        let { tools, controls, dispatch } = config;
        this.state = state;

        this.canvas = new PictureCanvas(state.picture, pos => {
            let tool = tools[this.state.tool];
            let onMove = tool(pos, this.state, dispatch);
            if (onMove) return pos => onMove(pos, this.state);
        });
        this.controls = controls.map(Control => new Control(state, config));
        this.dom = elt("div", {}, this.canvas.dom, elt("br"),
            ...this.controls.reduce((a, c) => a.concat(" ", c.dom), []));
    }
    syncState(state) {
        this.state = state;
        this.canvas.syncState(state.picture);
        for (let ctrl of this.controls) ctrl.syncState(state);
    }
}

var ToolSelect = class ToolSelect {
    constructor(state, { tools, dispatch }) {
        this.select = elt("select", {
            onchange: () => dispatch({ tool: this.select.value })
        }, ...Object.keys(tools).map(name => elt("option", {
            selected: name == state.tool
        }, name)));
        this.dom = elt("label", null, "🖌 Tool: ", this.select);
    }
    syncState(state) { this.select.value = state.tool; }
}


function draw(pos, state, dispatch) {
    function drawPixel({ x, y }, state) {
        let drawn = { x, y, color: state.color };
        dispatch({ picture: state.picture.draw([drawn]) });
    }
    drawPixel(pos, state);
    return drawPixel;
}


function historyUpdateState(state, action) {

    return Object.assign({}, state, action);

}

var startState = {
    tool: "draw",
    color: "#000000",
    picture: Picture.empty(60, 30, "#f0f0f0"),
};

var baseTools = { draw };

var baseControls = [ToolSelect];

function startPixelEditor({ state = startState, tools = baseTools, controls = baseControls }) {
    let app = new PixelEditor(state, {
        tools,
        controls,
        dispatch(action) {
            state = historyUpdateState(state, action);
            app.syncState(state);
        }
    });
    return app.dom;
}
// =====================================================
// USB Gamepad
// =====================================================

let socket = null;

let editMode = false;

const gamepad = document.getElementById("gamepad");

const status = document.getElementById("status");

const editButton =
    document.getElementById("editButton");

const resetButton =
    document.getElementById("resetButton");


// =====================================================
// WebSocket
// =====================================================

function connect() {

    const protocol =
        location.protocol === "https:"
            ? "wss:"
            : "ws:";

    socket = new WebSocket(
        protocol +
        "//" +
        location.host +
        "/ws"
    );


    socket.onopen = () => {

        status.textContent =
            "متصل";

        status.classList.add(
            "connected"
        );
    };


    socket.onclose = () => {

        status.textContent =
            "غير متصل";

        status.classList.remove(
            "connected"
        );

        setTimeout(
            connect,
            1000
        );
    };


    socket.onerror = () => {

        status.textContent =
            "خطأ في الاتصال";

        status.classList.remove(
            "connected"
        );
    };
}


function send(data) {

    if (
        socket &&
        socket.readyState ===
        WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(data)
        );
    }
}


connect();


// =====================================================
// Buttons
// =====================================================

document
    .querySelectorAll("[data-button]")
    .forEach(button => {

        let pressed = false;


        function down(event) {

            if (editMode)
                return;

            event.preventDefault();

            if (pressed)
                return;

            pressed = true;

            button.setPointerCapture(
                event.pointerId
            );

            send({

                event: "button",

                name:
                    button.dataset.button,

                pressed: true
            });
        }


        function up(event) {

            if (editMode)
                return;

            event.preventDefault();

            if (!pressed)
                return;

            pressed = false;

            send({

                event: "button",

                name:
                    button.dataset.button,

                pressed: false
            });
        }


        button.addEventListener(
            "pointerdown",
            down
        );

        button.addEventListener(
            "pointerup",
            up
        );

        button.addEventListener(
            "pointercancel",
            up
        );

        button.addEventListener(
            "pointerleave",
            event => {

                if (
                    event.buttons === 0
                ) {
                    up(event);
                }
            }
        );
    });


// =====================================================
// D-Pad
// =====================================================

const dpadButtons =
    document.querySelectorAll(
        ".dpad-button"
    );


const dpadState = {

    up: false,
    down: false,
    left: false,
    right: false
};


function updateDpad() {

    let x = 0;
    let y = 0;


    if (dpadState.left)
        x = -1;

    if (dpadState.right)
        x = 1;

    if (dpadState.up)
        y = -1;

    if (dpadState.down)
        y = 1;


    send({

        event: "dpad",

        x: x,
        y: y
    });
}


dpadButtons.forEach(button => {

    const direction =
        button.dataset.dir;


    button.addEventListener(
        "pointerdown",
        event => {

            if (editMode)
                return;

            event.preventDefault();

            dpadState[
                direction
            ] = true;

            button.setPointerCapture(
                event.pointerId
            );

            updateDpad();
        }
    );


    function release(event) {

        if (editMode)
            return;

        event.preventDefault();

        dpadState[
            direction
        ] = false;

        updateDpad();
    }


    button.addEventListener(
        "pointerup",
        release
    );

    button.addEventListener(
        "pointercancel",
        release
    );
});


// =====================================================
// Analog sticks
// =====================================================

function setupStick(element) {

    const ring =
        element.querySelector(
            ".stick-ring"
        );

    const knob =
        element.querySelector(
            ".stick-knob"
        );


    const stick =
        element.dataset.stick;


    let active = false;


    function move(event) {

        if (!active)
            return;

        const rect =
            ring.getBoundingClientRect();


        const centerX =
            rect.left +
            rect.width / 2;

        const centerY =
            rect.top +
            rect.height / 2;


        let dx =
            event.clientX -
            centerX;

        let dy =
            event.clientY -
            centerY;


        const radius =
            rect.width / 2 -
            knob.offsetWidth / 2;


        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy
            );


        if (distance > radius) {

            dx =
                dx / distance *
                radius;

            dy =
                dy / distance *
                radius;
        }


        knob.style.left =
            `calc(50% + ${dx}px)`;

        knob.style.top =
            `calc(50% + ${dy}px)`;


        const normalizedX =
            dx / radius;

        const normalizedY =
            dy / radius;


        const valueX =
            Math.round(
                normalizedX *
                32767
            );

        const valueY =
            Math.round(
                normalizedY *
                32767
            );


        send({

            event: "stick",

            stick: stick,

            x: valueX,

            y: valueY
        });
    }


    function release(event) {

        if (!active)
            return;

        active = false;


        knob.style.left =
            "50%";

        knob.style.top =
            "50%";


        send({

            event: "stick",

            stick: stick,

            x: 0,

            y: 0
        });
    }


    ring.addEventListener(
        "pointerdown",
        event => {

            if (editMode)
                return;

            event.preventDefault();

            active = true;

            ring.setPointerCapture(
                event.pointerId
            );

            move(event);
        }
    );


    ring.addEventListener(
        "pointermove",
        move
    );


    ring.addEventListener(
        "pointerup",
        release
    );


    ring.addEventListener(
        "pointercancel",
        release
    );
}


setupStick(
    document.getElementById(
        "leftStick"
    )
);


setupStick(
    document.getElementById(
        "rightStick"
    )
);


// =====================================================
// Triggers
// =====================================================

function setupTrigger(element) {

    const trigger =
        element.dataset.trigger;

    let active = false;


    function update(event) {

        if (!active)
            return;


        const rect =
            element.getBoundingClientRect();


        let percentage =
            (event.clientY -
             rect.top) /
            rect.height;


        percentage =
            Math.max(
                0,
                Math.min(
                    1,
                    percentage
                )
            );


        const value =
            Math.round(
                percentage * 255
            );


        send({

            event: "trigger",

            trigger: trigger,

            value: value
        });
    }


    function release() {

        active = false;

        element.classList.remove(
            "active"
        );


        send({

            event: "trigger",

            trigger: trigger,

            value: 0
        });
    }


    element.addEventListener(
        "pointerdown",
        event => {

            if (editMode)
                return;

            event.preventDefault();

            active = true;

            element.classList.add(
                "active"
            );

            element.setPointerCapture(
                event.pointerId
            );

            update(event);
        }
    );


    element.addEventListener(
        "pointermove",
        update
    );


    element.addEventListener(
        "pointerup",
        release
    );


    element.addEventListener(
        "pointercancel",
        release
    );
}


document
    .querySelectorAll(".trigger")
    .forEach(setupTrigger);


// =====================================================
// Layout system
// =====================================================

const controls =
    document.querySelectorAll(
        ".control"
    );


function saveLayout() {

    const layout = {};


    controls.forEach(
        element => {

            const id =
                element.id;

            if (!id)
                return;


            layout[id] = {

                left:
                    element.style.left,

                top:
                    element.style.top,

                right:
                    element.style.right,

                bottom:
                    element.style.bottom
            };
        }
    );


    localStorage.setItem(
        "usbGamepadLayout",
        JSON.stringify(layout)
    );
}


function loadLayout() {

    const raw =
        localStorage.getItem(
            "usbGamepadLayout"
        );


    if (!raw)
        return;


    try {

        const layout =
            JSON.parse(raw);


        controls.forEach(
            element => {

                const data =
                    layout[
                        element.id
                    ];


                if (!data)
                    return;


                if (data.left)
                    element.style.left =
                        data.left;

                if (data.top)
                    element.style.top =
                        data.top;

                if (data.right)
                    element.style.right =
                        data.right;

                if (data.bottom)
                    element.style.bottom =
                        data.bottom;
            }
        );

    } catch (e) {

        console.log(
            "Invalid layout"
        );
    }
}


loadLayout();


// =====================================================
// Drag controls in edit mode
// =====================================================

controls.forEach(element => {

    let dragging = false;

    let startX = 0;
    let startY = 0;

    let originalLeft = 0;
    let originalTop = 0;


    element.addEventListener(
        "pointerdown",
        event => {

            if (!editMode)
                return;

            event.preventDefault();

            dragging = true;


            const rect =
                element.getBoundingClientRect();


            startX =
                event.clientX;

            startY =
                event.clientY;


            originalLeft =
                rect.left;

            originalTop =
                rect.top;


            element.setPointerCapture(
                event.pointerId
            );
        }
    );


    element.addEventListener(
        "pointermove",
        event => {

            if (!dragging)
                return;


            const dx =
                event.clientX -
                startX;

            const dy =
                event.clientY -
                startY;


            const parent =
                gamepad.getBoundingClientRect();


            const newLeft =
                originalLeft -
                parent.left +
                dx;


            const newTop =
                originalTop -
                parent.top +
                dy;


            element.style.left =
                `${newLeft}px`;

            element.style.top =
                `${newTop}px`;

            element.style.right =
                "auto";

            element.style.bottom =
                "auto";
        }
    );


    element.addEventListener(
        "pointerup",
        () => {

            dragging = false;

            saveLayout();
        }
    );


    element.addEventListener(
        "pointercancel",
        () => {

            dragging = false;
        }
    );
});


// =====================================================
// Edit button
// =====================================================

editButton.addEventListener(
    "click",
    () => {

        editMode =
            !editMode;


        if (editMode) {

            gamepad.classList.add(
                "edit-mode"
            );

            editButton.textContent =
                "حفظ";

        } else {

            gamepad.classList.remove(
                "edit-mode"
            );

            editButton.textContent =
                "تعديل";

            saveLayout();
        }
    }
);


// =====================================================
// Reset
// =====================================================

resetButton.addEventListener(
    "click",
    () => {

        if (
            !confirm(
                "إعادة التخطيط الافتراضي؟"
            )
        )
            return;


        localStorage.removeItem(
            "usbGamepadLayout"
        );


        location.reload();
    }
);

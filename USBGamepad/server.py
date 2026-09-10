#!/usr/bin/env python3

import asyncio
import json
import os
from pathlib import Path

from aiohttp import web, WSMsgType
from evdev import UInput, ecodes, AbsInfo


BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

HOST = "0.0.0.0"
PORT = 8080


# ---------------------------------------------------------
# Virtual Gamepad
# ---------------------------------------------------------

class VirtualGamepad:
    def __init__(self):
        events = {
            ecodes.EV_KEY: [
                ecodes.BTN_SOUTH,       # A
                ecodes.BTN_EAST,        # B
                ecodes.BTN_NORTH,       # Y
                ecodes.BTN_WEST,        # X

                ecodes.BTN_TL,          # LB
                ecodes.BTN_TR,          # RB

                ecodes.BTN_SELECT,
                ecodes.BTN_START,

                ecodes.BTN_THUMBL,      # L3
                ecodes.BTN_THUMBR,      # R3
            ],

            ecodes.EV_ABS: [
                (
                    ecodes.ABS_X,
                    AbsInfo(
                        0,
                        -32768,
                        32767,
                        0,
                        0,
                        0
                    )
                ),

                (
                    ecodes.ABS_Y,
                    AbsInfo(
                        0,
                        -32768,
                        32767,
                        0,
                        0,
                        0
                    )
                ),

                (
                    ecodes.ABS_RX,
                    AbsInfo(
                        0,
                        -32768,
                        32767,
                        0,
                        0,
                        0
                    )
                ),

                (
                    ecodes.ABS_RY,
                    AbsInfo(
                        0,
                        -32768,
                        32767,
                        0,
                        0,
                        0
                    )
                ),

                # Left / Right triggers
                (
                    ecodes.ABS_Z,
                    AbsInfo(
                        0,
                        0,
                        255,
                        0,
                        0,
                        0
                    )
                ),

                (
                    ecodes.ABS_RZ,
                    AbsInfo(
                        0,
                        0,
                        255,
                        0,
                        0,
                        0
                    )
                ),

                # D-pad
                (
                    ecodes.ABS_HAT0X,
                    AbsInfo(
                        0,
                        -1,
                        1,
                        0,
                        0,
                        0
                    )
                ),

                (
                    ecodes.ABS_HAT0Y,
                    AbsInfo(
                        0,
                        -1,
                        1,
                        0,
                        0,
                        0
                    )
                ),
            ]
        }

        self.ui = UInput(
            events,
            name="USB Gamepad Virtual Controller",
            vendor=0x1234,
            product=0x5678,
            version=1,
            bustype=ecodes.BUS_USB
        )

        print("Virtual Gamepad created.")

    # -----------------------------------------------------

    def button(self, name, pressed):

        mapping = {
            "A": ecodes.BTN_SOUTH,
            "B": ecodes.BTN_EAST,
            "X": ecodes.BTN_WEST,
            "Y": ecodes.BTN_NORTH,

            "LB": ecodes.BTN_TL,
            "RB": ecodes.BTN_TR,

            "START": ecodes.BTN_START,
            "SELECT": ecodes.BTN_SELECT,

            "L3": ecodes.BTN_THUMBL,
            "R3": ecodes.BTN_THUMBR,
        }

        code = mapping.get(name)

        if code is None:
            return

        self.ui.write(
            ecodes.EV_KEY,
            code,
            1 if pressed else 0
        )

        self.ui.syn()

    # -----------------------------------------------------

    def dpad(self, x, y):

        x = max(-1, min(1, int(x)))
        y = max(-1, min(1, int(y)))

        self.ui.write(
            ecodes.EV_ABS,
            ecodes.ABS_HAT0X,
            x
        )

        self.ui.write(
            ecodes.EV_ABS,
            ecodes.ABS_HAT0Y,
            y
        )

        self.ui.syn()

    # -----------------------------------------------------

    def stick(self, stick, x, y):

        x = max(-32768, min(32767, int(x)))
        y = max(-32768, min(32767, int(y)))

        if stick == "left":
            xcode = ecodes.ABS_X
            ycode = ecodes.ABS_Y

        elif stick == "right":
            xcode = ecodes.ABS_RX
            ycode = ecodes.ABS_RY

        else:
            return

        self.ui.write(
            ecodes.EV_ABS,
            xcode,
            x
        )

        self.ui.write(
            ecodes.EV_ABS,
            ycode,
            y
        )

        self.ui.syn()

    # -----------------------------------------------------

    def trigger(self, trigger, value):

        value = max(0, min(255, int(value)))

        if trigger == "LT":
            code = ecodes.ABS_Z

        elif trigger == "RT":
            code = ecodes.ABS_RZ

        else:
            return

        self.ui.write(
            ecodes.EV_ABS,
            code,
            value
        )

        self.ui.syn()

    # -----------------------------------------------------

    def close(self):
        self.ui.close()


gamepad = None


# ---------------------------------------------------------
# WebSocket
# ---------------------------------------------------------

async def websocket_handler(request):

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    peer = request.remote

    print(f"[+] Phone connected: {peer}")

    try:

        async for msg in ws:

            if msg.type != WSMsgType.TEXT:
                continue

            try:
                data = json.loads(msg.data)
            except json.JSONDecodeError:
                continue

            event = data.get("event")

            # ---------------------------------------------
            # Button
            # ---------------------------------------------

            if event == "button":

                name = data.get("name")
                pressed = bool(data.get("pressed"))

                gamepad.button(
                    name,
                    pressed
                )

            # ---------------------------------------------
            # D-pad
            # ---------------------------------------------

            elif event == "dpad":

                x = data.get("x", 0)
                y = data.get("y", 0)

                gamepad.dpad(
                    x,
                    y
                )

            # ---------------------------------------------
            # Analog stick
            # ---------------------------------------------

            elif event == "stick":

                stick = data.get("stick")

                x = data.get("x", 0)
                y = data.get("y", 0)

                gamepad.stick(
                    stick,
                    x,
                    y
                )

            # ---------------------------------------------
            # Trigger
            # ---------------------------------------------

            elif event == "trigger":

                trigger = data.get("trigger")
                value = data.get("value", 0)

                gamepad.trigger(
                    trigger,
                    value
                )

            # ---------------------------------------------
            # Ping
            # ---------------------------------------------

            elif event == "ping":

                await ws.send_json({
                    "event": "pong"
                })

    except Exception as e:

        print(
            f"[!] WebSocket error: {e}"
        )

    finally:

        print(
            f"[-] Phone disconnected: {peer}"
        )

        # Reset controls when phone disconnects
        gamepad.dpad(0, 0)

        gamepad.stick(
            "left",
            0,
            0
        )

        gamepad.stick(
            "right",
            0,
            0
        )

        gamepad.trigger(
            "LT",
            0
        )

        gamepad.trigger(
            "RT",
            0
        )

    return ws


# ---------------------------------------------------------
# HTTP
# ---------------------------------------------------------

async def index(request):
    return web.FileResponse(
        WEB_DIR / "index.html"
    )


async def create_app():

    app = web.Application()

    app.router.add_get(
        "/",
        index
    )

    app.router.add_get(
        "/ws",
        websocket_handler
    )

    app.router.add_static(
        "/",
        WEB_DIR
    )

    return app


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main():

    global gamepad

    if os.geteuid() != 0:

        print(
            "[-] This program must run as root."
        )

        print(
            "    Run:"
        )

        print(
            "    sudo python3 server.py"
        )

        return

    gamepad = VirtualGamepad()

    print()
    print(
        "=========================================="
    )
    print(
        "        USB Gamepad Server"
    )
    print(
        "=========================================="
    )

    print(
        f"Listening on port {PORT}"
    )

    print(
        f"Open on phone:"
    )

    print(
        f"http://<DEBIAN-IP>:{PORT}"
    )

    print(
        "=========================================="
    )
    print()

    app = asyncio.new_event_loop()

    asyncio.set_event_loop(app)

    application = app.run_until_complete(
        create_app()
    )

    try:

        web.run_app(
            application,
            host=HOST,
            port=PORT
        )

    finally:

        gamepad.close()


if __name__ == "__main__":
    main()


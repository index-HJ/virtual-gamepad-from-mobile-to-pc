#!/bin/bash

set -e

echo "======================================"
echo " USB Gamepad Installer"
echo "======================================"

echo "[1/3] Installing Debian packages..."

sudo apt update

sudo apt install -y \
    python3 \
    python3-aiohttp \
    python3-evdev \
    evtest


echo "[2/3] Checking uinput..."

if [ ! -e /dev/uinput ]; then

    echo "Loading uinput..."

    sudo modprobe uinput

fi


if [ ! -e /dev/uinput ]; then

    echo
    echo "ERROR: /dev/uinput does not exist."
    echo
    exit 1

fi


echo "[3/3] Making server executable..."

chmod +x server.py

echo
echo "======================================"
echo " Installation complete"
echo "======================================"

echo
echo "Start with:"
echo
echo "sudo ./server.py"
echo

# Arduino LED Cube

An Arduino class and example sketch to control an LED cube.

## Hardware

This software accompanies an [Instructable for building an LED Cube](http://www.instructables.com/id/LED-Cube-and-Arduino-Lib/). Read through it before proceeding.

## Install

Download the library and unzip `LedCube` your `sketchbook/libraries` folder. If the `libraries` folder doesn't exist already then create it first. When set up correctly you should find an example in the Arduino software under `File > Examples > LedCube > ledcube`.

## Background

I found a few code examples on the web for controlling an LED cube but they all required large arrays of binary or hex data to control the LEDs. I figured there must be a more user friendly way so I set out to write my own software.

I decided to make the software mirror the hardware. That meant addressing each LED by column and level rather than use raw port data or the traditional x, y, z. I also decided to start with basic functions, like turning a single light on or off, or lighting a single column, and build up from there.

There are two features which are useful for more interesting effects. One is a buffer which allows the basic functions to build up more complex patterns. The other is a sequence function which lights an array of LEDs one at a time, or all at once.

More recently I've introduced [a web based UI](./ui/) to build up new animations in case code isn't your strong suit.

## License

MIT License. See the accompanying LICENSE file for terms.

The UI is licensed under CC BY-SA. See [it's readme](./ui/README.md) for more info.


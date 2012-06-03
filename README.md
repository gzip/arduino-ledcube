# Arduino LED Cube

An Arduino class and example sketch to control an LED cube.

## Hardware

This software accompanies an [Instructable for building an LED Cube](http://www.instructables.com/id/LED-Cube-and-Arduino-Lib/). Read through it before proceeding.

## Install

Download the library and unzip `LedCube` your `sketchbook/libraries` folder. If the `libraries` folder doesn't exist already then create it first. When set up correctly you should find an example in the Arduino software under `File > Examples > LedCube > ledcube`.

## Background

I found a few code examples floating around the 'net for controlling an LED cube. They all required large arrays of binary or hex data to control the LEDs. I figured there must be a more user friendly way so I set out to write my own software.

My first decision was to make the software mirror the hardware. That meant addressing each LED by column and level instead rather than use raw port data or the traditional x, y, z. The second decision was to start with basic functions, like turning a single light on or off, or lighting a single column, and building up from there.

Lastly I decided to introduce two features which are useful for more interesting effects. One is a buffer which allows the basic functions to build up more complex patterns. The other is a sequence function which lights an array of LEDs one at a time, or all at once.

## License

MIT License. See the accompanying LICENSE file for terms.


/*
    LedCube.cpp - Library for controlling an LED cube
    Created by Gamaiel Zavala (gzip), 2009-2012
    MIT License. See accompanying LICENSE file for terms.
*/

#include <new.h>
#include "newfix.h"
#include "LedCube.h"

LedCube::LedCube(byte size, byte lp[], byte cp[]) :
    levels(size), cols(size*size), num(size*size*size),
    bufferEnabled(false), bufferInverted(false)
{
    randomSeed(analogRead(0));
    
    // allocate memory for dynamic members
    buffer = new byte*[levels];
    levelPins = new byte[levels];
    colPins = new byte[cols];
    
    // configure level pins and finish allocation for buffer
    for (byte i = 0; i < levels; i++)
    {
        levelPins[i] = lp[i];
        pinMode(levelPins[i], OUTPUT);
        
        buffer[i] = new byte[cols];
    }
    
    // configure column pins
    for (byte i = 0; i < cols; i++)
    {
        colPins[i] = cp[i];
        pinMode(colPins[i], OUTPUT);
    }
    
    clearBuffer();
    
    //Serial.begin(9600);
}

// destructor frees dynamically allocated memory
LedCube::~LedCube()
{
    for (byte i = 0; i < levels; i++)
    {
        delete buffer[i];
    }
    delete buffer;
    delete levelPins;
    delete colPins;
}

// low level methods, zero based

void LedCube::light(byte lv, byte col, byte val)
{
    if(lv < levels && col < cols)
    {
        if(bufferEnabled)
        {
            buffer[lv][col] = val;
        }
        else
        {
            digitalWrite(colPins[col], val);
            digitalWrite(levelPins[lv], val);
        }
    }
}

void LedCube::lightOff(byte level, byte col)
{
    light(level,col,(bufferInverted ? HIGH : LOW));
}

void LedCube::lightOn(byte lv, byte col)
{
    light(lv,col,(bufferInverted ? LOW : HIGH));
}

void LedCube::lightPulse(byte lv, byte col, unsigned int wait)
{
    lightOn(lv, col);
    if(!bufferEnabled)
    {
        delay(wait);
        lightOff(lv, col);
    }
}

// basic effects

void LedCube::randomLight(byte numLights, unsigned int wait)
{
    for (byte l=0; l<numLights; l++)
    {
        lightPulse(random(0,levels), random(0,cols), wait);
    } 
}

void LedCube::lightDrop(byte col, unsigned int wait)
{
     for(byte r=levels; r; r--)
     {
         lightPulse(r-1, col-1, wait);
     }
}

// sequence effects

// time is overall, gap is in between individual lights
void LedCube::lightSequence(byte seq[], byte length, unsigned int time, byte gap)
{
    // should be pairs of coords
    if(length%2){ return; }
    
    if(bufferEnabled){ time = 1; }
    
    //Serial.print('{');
    for (unsigned int d=0; d<time; d++)
    {
        for (byte s=0; s<length; s+=2)
        {
            if(bufferEnabled){
                 lightOn(seq[s], seq[s+1]);
            } else {
                 lightPulse(seq[s],seq[s+1], gap);
            }
            //Serial.print(seq[s],DEC); if(s < length-1) Serial.print(', ');
        } 
    }
    //Serial.println('}');
}

cubeFrame* LedCube::createFrame(byte sequence[], unsigned int size, unsigned int delay)
{
    // allocate memory which will be reclaimed in lightFrames
    struct cubeFrame *f = (cubeFrame*) malloc(sizeof(struct cubeFrame));
    f->sequence = (byte*) malloc(sizeof(byte) * size);
    memcpy((void*) f->sequence , (void*) sequence, sizeof(byte) * size);
    f->size = size;
    f->delay = delay;
    return f;
}

void LedCube::destroyFrame(cubeFrame* frame)
{
    free(frame->sequence);
    free(frame);
}

void LedCube::lightFrames(cubeFrame* frames[], unsigned int length)
{
    for(byte f=0; f<length; f++)
    {
        lightSequence(frames[f]->sequence, frames[f]->size, frames[f]->delay);
        // reclaim memory allocated in createFrame to prevent a leak
        destroyFrame(frames[f]);
    }
}

void LedCube::lightLevel(byte lv, unsigned int delay)
{
    if(lv && lv<=levels)
    {
        byte seq[cols*2];
        for(byte c=0, i=0; c<cols; c++, i+=2)
        {
             seq[i] = lv-1;
             seq[i+1] = c;
        }
        lightSequence(seq,sizeof(seq),delay);
    }
}

void LedCube::lightRow(byte r, byte level, unsigned int wait)
{
    if(r && level && r<=cols*2 && level<=levels)
    {
        byte start = r<=levels ? r-1 : (r - levels - 1) * levels;
        byte inc = r<=levels ? levels : 1;
        
        byte seq[] = {level-1,start, level-1,start+inc, level-1,start+inc*2};
        
        lightSequence(seq, sizeof(seq), wait);
    }
}

void LedCube::lightPlane(byte r, unsigned int wait)
{
    if(r && r<=cols*2)
    {
        byte start = r<=levels ? r-1 : (r - levels - 1) * levels;
        byte inc = r<=levels ? levels : 1;
        byte seq[cols*2];
        byte index = 0;
        
        for(byte level=0; level<levels; level++)
        {
            for(byte i=0; i<3; i++)
            {
                seq[index] = level;
                seq[index+1] = start + inc*i;
                index += 2;
            }
        }
        
        lightSequence(seq, sizeof(seq), wait);
    }
}

void LedCube::lightColumn(byte col, unsigned int wait)
{
    if(col && col<=cols)
    {
        byte seq[] = {0,col-1,1,col-1,2,col-1};
        lightSequence(seq,sizeof(seq),wait);
    }
}

void LedCube::lightPerimeter(byte level, byte rotations, unsigned int wait)
{
    byte seq[] = {level,0,level,1,level,2,level,5,level,8,level,7,level,6,level,3};
    lightSequence(seq, sizeof(seq), rotations, wait);
}

void LedCube::randomColumn(byte numColumns, unsigned int wait)
{
    for (byte c=0; c < numColumns; c++) {
        lightColumn(random(1,cols+1), wait);
    } 
}

// buffer methods

void LedCube::enableBuffer(boolean enable)
{
    bufferEnabled = enable;
    if(!bufferEnabled) invertBuffer(false);
}

void LedCube::invertBuffer(boolean invert)
{
    bufferInverted = invert;
}
    
void LedCube::clearBuffer()
{
     setBuffer(0);
}

void LedCube::fillBuffer()
{
     setBuffer(1);
}

void LedCube::setBuffer(byte val)
{
    for(byte lv=0; lv < levels; lv++)
        for(byte col=0; col < cols; col++)
            buffer[lv][col] = val;
}

byte LedCube::getBufferAt(byte lv, byte col)
{
    return buffer[lv][col];
}

void LedCube::drawBuffer(unsigned int wait)
{
    byte seq[num*2];
    byte n = 0;
    
    for(byte lv=0; lv<levels; lv++)
    {
        for(byte col=0; col<cols; col++)
        {
            if(buffer[lv][col])
            {
                //Serial.print(buffer[r][c],DEC); Serial.print(': ');
                //Serial.print(r,DEC); Serial.print(','); Serial.print(c,DEC); Serial.print(' ');
                seq[n] = lv;
                seq[n+1] = col;
                n += 2;
            }
        } 
    }
    // Serial.print('('); Serial.println(num,DEC); Serial.print(')');
    
    enableBuffer(false);
    lightSequence(seq, sizeof(seq), wait);
    enableBuffer();
}

void LedCube::lightsOut(unsigned int wait)
{
    enableBuffer();
    fillBuffer();
    drawBuffer(25);
    for(byte w=0, l, c, max = num; w<max; )
    {
        // lower bound is inclusive, upper is exclusive
        l = random(0, levels);
        c = random(0, cols);
        
        if(getBufferAt(l,c) == HIGH)
        {
            lightOff(l,c);
            drawBuffer(wait);
            w++;
        }
    }
    enableBuffer(false);
}


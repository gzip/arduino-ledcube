#if !defined(ARDUINO) || ARDUINO < 104

#ifndef NEWFIX_H
#define NEWFIX_H

#include <stdlib.h>

void* operator new[](size_t size)
{
    return malloc(size);
}

void operator delete[](void * ptr)
{
    free(ptr);
}

#endif

#endif


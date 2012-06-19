#ifndef NEWFIX_H
#define NEWFIX_H

#include <stdlib.h>

// not needed when this pull request is merged
// https://github.com/arduino/Arduino/pull/73

void* operator new[](size_t size)
{
    return malloc(size);
}

void operator delete[](void * ptr)
{
    free(ptr);
}

#endif


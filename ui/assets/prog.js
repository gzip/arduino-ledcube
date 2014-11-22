// Index of currently selected frame
var currentFrame = 0;
// Are we in "playback" or "edit" mode?
var inEditMode = true; 
// The minimum time that can be spent on a single LED
// (derived from 90ms minimum for 27, aka 3x3x3, LEDs)
// TODO: tweak TIME_PER_LED count
var TIME_PER_LED = Math.ceil(90.0/27.0);

function Frame(width, height, depth)
{    
    // Store width, height, depth.
    // TODO: figure out if we can store this in a better way,
    // currently we're storing it for each frame (which isn't great)
    this.width = width;
    this.height = height;
    this.depth = depth;
    
    // Initialize a duration (in ms)
    this.duration = TIME_PER_LED*width*height*depth;
    
    // Initialize the cells in the frame...
    this.cells = [];

    // ...and clear all of them
    for(var i=0;i<width*height*depth;i++)
    {
        this.cells[i] = 0;
    }
    /*
    // Initialize the cells in the frame...
    this.cells = [[[]]];

    // ...and clear all of them
    for(var x=0;x<width;x++)
    {
        for(var y=0;y<height;y++)
        {
            for(var z=0;z<depth;z++)
            {
                this.cells[i] = 0;
            }
        }
    }
    */
}

// Returns the one-dimensional index for a 3-dimensional array.
//
// Parameters:
// x - The x-coordinate of the cell (0 is leftmost)
// y - The y-coordinate of the cell (0 is topmost)
// z - The z-coordinate of the cell (0 is in front)
Frame.prototype.getIndex = function(x, y, z)
{
    // Least significant part of this coord is x (because it goes left to right first)
    // Next least significant part of this coord is y (because it goes top to bottom next)
    // Most significant part of this coord is z (because it goes front to back last)
    var i = x + (y*this.width) + (z*this.width*this.height);
    return i;
}

// Set a value at a particular cell.
//
// Parameters:
// x - The x-coordinate of the cell (0 is leftmost)
// y - The y-coordinate of the cell (0 is topmost)
// z - The z-coordinate of the cell (0 is in front)
// value - Whether the cell is "lit" or not (either 1 or 0)
Frame.prototype.setCell = function(x, y, z, value)
{
    this.cells[this.getIndex(x,y,z)] = value;
}

// Convert the given frame to a set of table items suitable for use in the LED cube's firmware.
// This method is a bit hard to read because it's hacked to work w/ the cube's structure
// while staying compatible the rest of the code
Frame.prototype.toCode = function()
{
    var str = '', count = 0, light, x, y, z;
    
    for(z=0;z<this.depth;z++)
    {
        for(y=this.height-1;y>=0;y--)
        {
            for(x=0;x<this.width;x++)
            {
                light = this.cells[this.getIndex(x,y,z)];
                if(light)
                {
                    str += (str ? ', ' : '') + (z) + ',' + (Math.abs(y-this.height+1) * this.width + x);
                    count += 2;
                }
            }
        }
    }
    
    return 'cube.createFrame((const byte[]) {' + str + '}, ' + count + ', ' + this.duration + ')';
}

// This is a wrapper for all of our globals (such as dimensions and the frame
// collection) so we can easily serialize/deserialize everything at once.
function progData(width, height, depth)
{
    this.cubeWidth = width;
    this.cubeHeight = height;
    this.cubeDepth = depth;
    this.frameCollection = new Array();
}

var globals;

// Update the list of frames in the dialog
function updateFrameList()
{
    // Destroy buttonset status if it exists
    if( $("#lstFrames").buttonset != null )
    {
        $("#lstFrames").buttonset("destroy");
    }

    // Set the currentFrame to be within the bounds of the frameCollection
    if( currentFrame >= globals.frameCollection.length )
    {
        currentFrame = globals.frameCollection.length - 1;
    }

    // Regenerate contents of frame list
    var i;
    $("#lstFrames").empty();
    for(i=0;i<globals.frameCollection.length;i++)
    {
        // We have to apply "left" otherwise Chrome won't work for some reason.
        // See http://forum.jquery.com/topic/radio-button-grouping-not-working-cross-browser-jquery-ui regarding
        $("#lstFrames").append('<input type="radio" name="radFrames" id="radFrame'+i+'" value="'+i+'" onclick="javascript:selFrame('+i+')"/><label for="radFrame'+i+'">'+(i+1)+'</label>');
    }
    
    // Make selectable again
    $("#lstFrames").buttonset();
                            
};

function selFrame(i)
{
    currentFrame = i;
    loadCurFrame();
}

// Sets all the light input elements to match the currently selected frame
function loadCurFrame()
{
    // Select this radio button
    $("input[name=radFrames]").val(currentFrame);
    $("#radFrame"+currentFrame).attr("checked", "checked");
    
    // Refresh the UI
    $("#lstFrames > input").button("refresh");
    
    // Set state of all the checkboxes 
    var i;

    for(i=0;i<globals.frameCollection[currentFrame].cells.length;i++)
    {
        if(globals.frameCollection[currentFrame].cells[i]==0)
        {
            // Not checked, so set that
            $("#chk"+i).attr("checked", false);
        }
        else
        {
            // Set as checked, and display as such
            $("#chk"+i).attr("checked", true);
        }

        // State probably changed, so refresh
        $("#chk"+i).button("refresh");
    }
    
    // Render preview dialog
    renderCanvas();
    
    // Set duration value for textbox
    $("#txtDuration").val(globals.frameCollection[currentFrame].duration);
}

// Function for advancing the frame in playback mode.
// Adds an event timer to call itself after the current frame's duration is up.
function advancePlayback()
{
    // Only advance frame playback if we're in playback mode
    if( inEditMode == false )
    {
        // Advance the frame
        nextFrame();
        
        // Set the event timer to advance to the next frame 
        setTimeout("advancePlayback();", globals.frameCollection[currentFrame].duration);
    }
}

// Render the canvas element.  Note that this will only go through
// the rendering process if the preview dialog is open.
function renderCanvas()
{
    // Skip over this if the preview dialog isn't visible
    if( $("#dlgPreview").dialog("isOpen") )
    {
        // jQuery doesn't natively support canvas stuff right now,
        // so we have to use plain 'ol Javascript for manipulating that.
        // Oh well.
        var canvas = document.getElementById('cvsPreview'); 
        
        // Only proceed if we support the canvas tag in our browser
        if( canvas.getContext )
        {
            var ctx = canvas.getContext('2d');
            
            // Initialize vars
            var canvasHeight = 200; // TODO: change if the canvas dimensions change
            var canvasWidth = 220; // TODO: change if the canvas dimensions change
            var canvasX; // Current X pos
            var canvasY; // Current Y pos
            var onRadius = 4; // Radius for "on" LEDs
            var offRadius = 2; // Radius for "off" LEDs
            var i; // current horiz-pos
            var j; // current vert-pos
            var k; // current depth-pos
            
            // TODO: modify vGridSep/vSep and hGridSep/hSep based on dimensions 
            var vGridSep=20; // Vertical separation between grids
            var hGridSep=30; // Horizontal separation between grids
            var vSep=10; // Vertical separation between rows in a grid
            var hSep=15; // Horizontal separation between columns in a grid
            
            // Calculate initial offsets by determining the dimensions of the cube to render,
            // subtracting them from the available space, and dividing by 2
            // Initial offset for X
            var startX = (canvasWidth - (hGridSep*(globals.cubeDepth-1)) - (hSep*globals.cubeWidth)) 
                                / 2;
                                
            // Initial offset for Y
            var startY = (canvasHeight - (vGridSep*(globals.cubeDepth-1)) - (vSep*globals.cubeHeight))
                                / 2;
            
            var curFrame = globals.frameCollection[currentFrame];
            var fullCircleRad = 2*Math.PI;
            
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0,0,canvasWidth,canvasHeight);
            
            // We need to draw back-to-front
            for(k=globals.cubeDepth-1;k>=0;k--)
            {
                for(j=0;j<globals.cubeHeight;j++)
                {
                    // The starting Y is going to increase with every iteration
                    canvasY = startY + vGridSep*(globals.cubeDepth-k-1) + vSep*j;
                    // The starting X is going to decrease with every iteration
                    canvasX = startX + hGridSep*k;
                
                    for(i=0;i<globals.cubeWidth;i++)
                    {
                        ctx.beginPath();
                        
                        if( curFrame.cells[curFrame.getIndex(i,j,k)] == 1)
                        {
                            // Lit
                            ctx.arc(canvasX, canvasY, onRadius, 0, fullCircleRad, false);
                            ctx.fillStyle = "#F39814";
                        }
                        else
                        {
                            // Not lit
                            ctx.arc(canvasX, canvasY, offRadius, 0, fullCircleRad, false);
                            ctx.fillStyle = "#AAAAAA";
                        }
                    
                        ctx.closePath();
                        ctx.fill();
                    
                        canvasX = canvasX + hSep;
                        canvasY = canvasY + vSep;
                    }
                }
            }
        }
    }
}

// Do an entire refresh of the UI.
function refreshUi()
{
    // Regenerate the checkbox elements
    var i; // X-position
    var j; // Y-position
    var k; // Z-position
    var index = 0;

    // Clear contents of divGrid
    $("#divGrid").html("");
    
    for(k=0;k<globals.cubeDepth;k++)
    {
        var gridText = '<div id="grid'+k+'" class="gridBlk">';
        
        for(j=0;j<globals.cubeHeight;j++)
        {
            // Add div for this row
            gridText = gridText + '<div id="row'+k+'-'+j+'">';
            for(i=0;i<globals.cubeWidth;i++)
            {
                // Add checkbox item for this square
                gridText = gridText + '<input type="checkbox" class="gridSqr" id="chk'+index+'" onclick="javascript:toggleLED('+index+');"/><label for="chk'+index+'"><span class="noselect">&nbsp;</span></label>';
                index++; // Increment the index
            }

            // Add row closing tag
            gridText = gridText + '</div>';
        }
        
        // Add grid fill
        gridText = gridText + '<br><div><div class="left"><input type="button" class="grdFillBtn" id="btnFill'+k+'" onclick="javascript:setGrid('+k+',1);" value="F"/></div>';
        gridText = gridText + '<div class="right"><input type="button" class="grdFillBtn" id="btnEmpty'+k+'" onclick="javascript:setGrid('+k+',0);" value="C"/></div>';
        
        // Add guideline depth text
        if(k==0)
        {
            gridText = gridText + '<div class="desc">Bot</div>';
        }
        else if (k == globals.cubeDepth - 1)
        {
            gridText = gridText + '<div class="desc">Top</div>';
        }
        else
        {
            // HACK: figure out a better way of aligning
            gridText= gridText + '<div class="desc">&nbsp;</div>';
        }
        
        // Add grid closing tag
        gridText = gridText + "</div>\n";
        
        // Add div to DOM
        $("#divGrid").append(gridText);
    }

    // Make jQuery buttons
    $(".gridSqr").button();
    $(".grdFillBtn").button();
    
    // Update the frame list
    updateFrameList();

    // Load current frame
    loadCurFrame();
};

// Generate table code for the program memory
function toCode()
{
    // Close the dialog
    //$("#dlgGenerateCodeAs").dialog("close");

    var codeString,
        frames = [],
        i;

    for(i=0;i<globals.frameCollection.length;i++)
    {
        frames.push(globals.frameCollection[i].toCode());
    }
    
    // finish code
    codeString = "    cubeFrame* f[] = {\n        " + frames.join(",\n        ") + "\n    };\n";
    codeString += "    cube.lightFrames(f, " + frames.length + ");";
    
    // And set for the textarea!
    $("#genCode").val(codeString);
    
    // Finally, pop up the dialog
    $("#dlgGenerateCode").dialog("open");
}

// Show the "Save Data" dialog
function toObj()
{
    // Since we stored everything as a single object, we just need to serialize this
    // to JSON.
    var serGlob = JSON.stringify(globals);
    
    // Set for the textarea
    $("#genObj").val(serGlob);
    
    // Finally, pop up dialog
    $("#dlgGenerateObj").dialog("open");
}

// Load in object data from the "Load Data" dialog
function fromObj()
{
    // Make sure non-whitespace was provided before doing anything else
    if( $("#loadObj").val().replace(/^\s*/, "").replace(/\s*$/, "") == "" )
    {
        alert("No object data provided.");
        return;
    }

    try
    {
        // Load in from JSON
        globals = JSON.parse($("#loadObj").val());
        
        // We need to re-add in function definitions because the're not stored in JSON
        var i;
        for(i=0;i<globals.frameCollection.length;i++)
        {
            globals.frameCollection[i].getIndex = Frame.prototype.getIndex;
            globals.frameCollection[i].setCell = Frame.prototype.setCell;
            globals.frameCollection[i].toCode = Frame.prototype.toCode;
        }
        
        // Close the load dialog
        $("#dlgLoadObj").dialog("close");
        
        // Refresh the UI
        refreshUi();
    }
    catch(e)
    {
        // An error happened, reset the globals object
        initGlobals(3,3,3);

        alert("An error occurred when attempting to load your data.  Please ensure that it is formatted correctly.");
    }
    
}
        
// Insert a frame at the current position
function insertFrame()
{
    // Disable editing in playback mode
    if( inEditMode == false )
        return;

    // Insert new frame into array
    if( currentFrame >= globals.frameCollection.length - 1)
    {
        // If we're at the very end, just add it on to the array
        globals.frameCollection.push(new Frame(globals.cubeWidth,globals.cubeHeight,globals.cubeDepth));
    }
    else
    {
        // Splice new element into array
        globals.frameCollection.splice(currentFrame + 1, 0, new Frame(globals.cubeWidth,globals.cubeHeight,globals.cubeDepth));
    }
    
    // Switch to new frame
    currentFrame++;
    
    // Refresh everything, since we inserted a new frame
    refreshUi();
}

// Delete the currently-selecte frame
function deleteFrame()
{
    // Disable editing in playback mode
    if( inEditMode == false )
        return;
        
    // Disable deleting the last frame
    if( globals.frameCollection.length == 1 )
        return;
        
    // Remove one element
    globals.frameCollection.splice(currentFrame, 1);
    
    // Sanity check.
    if( currentFrame >= globals.frameCollection.length )
        currentFrame = globals.frameCollection.length - 1;
        
    // Refresh everything
    refreshUi();
}

// Move to the previous frame
function prevFrame()
{
    // Decrement the current frame
    currentFrame--;
    
    // Wrap around
    if( currentFrame < 0 )
        currentFrame = globals.frameCollection.length - 1;
        
    // Update the UI to match the newly selected frame
    loadCurFrame();    
}

// Move to the next frame
function nextFrame()
{
    // Increment the current frame
    currentFrame++;
    
    // Wrap around
    if( currentFrame >= globals.frameCollection.length )
        currentFrame = 0;
        
    // Update the UI to match the newly selected frame
    loadCurFrame();        
}

// Apply a duration change
function editDuration()
{
    // Disable editing in playback mode
    if( inEditMode == false )
        return;
        
    try
    {
        // Attempt to parse the duration value
        var durationVal = parseInt($("#txtDuration").val());
        // Minimum duration: time per LED const * # of LEDs
        var minDuration = Math.ceil(TIME_PER_LED * globals.frameCollection[currentFrame].cells.length);
        
        // Figure out if this duration is too small, and display a message if that's the case
        if( durationVal < minDuration)
        {
            alert("Your specified duration of "+durationVal+"ms is too small. The minimum requirement is "+minDuration+"ms.");
            return;
        }
        
        // Now set on the frame
        globals.frameCollection[currentFrame].duration = durationVal;
        // Update the UI to match
        $("#txtDuration").val(durationVal);
        
    }
    catch(e)
    {
        alert("There was an error attempting to set this duration.  Make sure you have input the value correctly.");
    }
}

// Show/hide the preview dialog
function previewToggle()
{
    if($("#dlgPreview").dialog("isOpen"))
    {
        $("#dlgPreview").dialog("close");
    }
    else
    {
        $("#dlgPreview").dialog("open");
        renderCanvas();                
    }
}

// Play/pause button
function playToggle()
{
    if( inEditMode == true )
    {
        // Currently editing, begin playback
        inEditMode = false;
        
        // Disable editing fields and other such buttons
        $(".btnDisableOnPlayback").button("disable");
        $("#txtDuration").attr("disabled", true);
        
        // Make the playback button say "Pause"
        $("#btnPlay").val("Pause");
        
        // Set the event timer to advance to the next frame 
        setTimeout("advancePlayback();", globals.frameCollection[currentFrame].duration);
    
    }
    else
    {
        // Currently in playback mode, go back to edit
        inEditMode = true;

        // Re-enable all editing controls
        $(":button").button("enable");
        $("#txtDuration").removeAttr("disabled");

        // Make the playback button say "Play"
        $("#btnPlay").val("Play");
    }
}

// Toggle the value of an individual cell
function toggleLED(i)
{
    // Disable editing in playback mode
    if( inEditMode == false )
    {
        // Make sure the actual input element matches the underlying cell value
        if(globals.frameCollection[currentFrame].cells[i]==0)
        {
            $("#chk"+i).attr("checked", false);
        }
        else
        {
            $("#chk"+i).attr("checked", true);
        }
        return;
    }
    
    if( globals.frameCollection[currentFrame].cells[i] == 0 )
    {
        // Toggling from off to on
        globals.frameCollection[currentFrame].cells[i] = 1;
    }
    else
    {
        // Toggling from on to off
        globals.frameCollection[currentFrame].cells[i] = 0;
    }
    
    // Update the canvas
    renderCanvas();
}

// Set all cells in a particular grid (i.e. one depth level) to a certain value
function setGrid(grid, val)
{
    // Disable editing in playback mode
    if( inEditMode == false )
        return;

    var i;
    
    // We're only setting one grid (i.e. one particular depth level), so let's find
    // the range in the array that corresponds with it
    var gridDim = (globals.frameCollection[currentFrame].height*globals.frameCollection[currentFrame].width);
    var minIndex = grid*gridDim;
    var maxIndex = minIndex+gridDim;
        
    for(i=minIndex;i<maxIndex;i++)
    {
        globals.frameCollection[currentFrame].cells[i] = val;
    }
    
    // Refresh the UI elements
    loadCurFrame();        
}

// Set all cells in a frame to a certain value
function setFrame(val)
{
    // Disable editing in playback mode
    if( inEditMode == false )
        return;

    var i;
    
    for(i=0;i<globals.frameCollection[currentFrame].cells.length;i++)
    {
        globals.frameCollection[currentFrame].cells[i] = val;
    }
    
    // Refresh the UI elements
    loadCurFrame();
}

// Show a given dialog (referred to by ID)
function showDlg(dialog)
{
    $("#"+dialog).dialog("open");
}

// Show a given menu (referred to by ID)
function showMenu(menu)
{
    // Only proceed if the menu isn't already being shown
    if( $("#"+menu).is(':visible') == false )
    {
        $(".submenu").css("display", "none");
        $("#"+menu).css("display", "inline");
    }
    else
    {
        // Treat as a toggle and hide
        $("#"+menu).css("display", "none");            
    }
}

function createNew()
{
    var width = parseInt($("#txtWidth").val());
    var height = parseInt($("#txtHeight").val());
    var depth = parseInt($("#txtDepth").val());

    // Sanity check.
    if( width < 1 || height < 1 || depth < 1)
    {
        alert("All dimensions must be at least 1 cell in length.");
        return;
    }
    
    // Re-init everything
    initGlobals(width, height, depth);
    refreshUi();
                
    // Close the dialog
    $("#dlgNew").dialog("close");
}

// Init data model for an animation with the given width, height, and depth
function initGlobals(width, height, depth)
{
    globals = new progData(width,height,depth);
    globals.frameCollection[0] = new Frame(globals.cubeWidth,globals.cubeHeight,globals.cubeDepth);
}
        
$(document).ready(function() {
    
    // Change the no JS warning to say "Loading..."
    $("#divWarning").html("Loading...");
    
    // Init data model
    initGlobals(3,3,3);
    
    // Create the generate dialog, and make modal
    $("#dlgGenerateCode").dialog({ 
        title: 'Generated Code', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });

    // Create the generate as (i.e. the code format) dialog, and make modal
    $("#dlgGenerateCodeAs").dialog({ 
        title: 'Choose Code Format', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });
    
    // Create the load dialog, and make modal
    $("#dlgLoadObj").dialog({ 
        title: 'Load Data', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });

    // Create the save dialog, and make modal
    $("#dlgGenerateObj").dialog({ 
        title: 'Save Data', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });
    
    // Create the new dialog, and make modal
    $("#dlgNew").dialog({ 
        title: 'New Animation', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });

    // Create the about dialog, and make modal
    $("#dlgAbout").dialog({ 
        title: 'About', 
        width: 470, 
        height: 300, 
        resizable: false,
        position: ['center', 'middle'],
        modal: true,
        autoOpen: false,
    });
    
    // Generate the preview dialog
    $("#dlgPreview").dialog({ 
        title: 'Preview', 
        width: 270, 
        height: 270, 
        resizable: false,
        position: ['right', 'top'],
        autoOpen: true,
    });
    
    // Create the frame list dialog, also hiding the close button
    $("#dlgFrameList").dialog({ 
        title: 'Frames', 
        width: 600, 
        height: 160, 
        minHeight: 160,
        minWidth: 550,
        maxHeight: 160,
        position: ['center', 'bottom'],
        closeOnEscape: false,
        open: function(event, ui) { 
            // Hide the close button
            $(this).parent().children().children('.ui-dialog-titlebar-close').hide();        
        }
    });
    
    // Initialize buttons
    $(":button").button();

    // Close warning div
    $("#divWarning").hide();

    // Show UI
    $("#divHasJs").show();

    // Finally, refresh the entire UI
    refreshUi();
});

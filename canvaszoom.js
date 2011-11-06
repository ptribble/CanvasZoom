/*
The MIT License

Copyright (c) 2011 Matthew Wilcoxson (www.akademy.co.uk)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
/*
CanvasZoom
By Matthew Wilcoxson

Description:    Zooming of very large images with Javascript, HTML5 and the canvas element (based on DeepZoom format).
Website:        http://www.akademy.co.uk/software/canvaszoom/canvaszoom.php
Version:        1.0.2

global ImageLoader, window  (for JSLint) 
*/
function CanvasZoom( _canvas, _tilesFolder, _imageWidth, _imageHeight )
{
	//var t = this; // make "this" accessible when out of "this" scope and minify
	
	//var _tileOverlap = 1; // assumed
	var _tileSize = 256; // assumed
    var _fileType = "jpg"; // assumed
    
    // Additional settings:
    var _drawBorder = true;
    
	var _debug = false;
	var _debugShowRectangle = (_debug===false) ? _debug : false; // Paint a rectangle rather than an image
	
	var _zoomLevelMin = 0;
	var _zoomLevelMax = 0;
	var _zoomLevelFull = -1; // For painting a background image for all missing tiles.
	var _zoomLevel = -1;
	
	var _mouseX = 0;
	var _mouseY = 0;
	var _mouseDownX = 0;
	var _mouseDownY = 0;
	var _mouseMoveX = 0;
	var _mouseMoveY = 0;

	var _mouseIsDown = false;
	var _mouseLeftWhileDown = false;

	var _offsetX = 0;
	var _offsetY = 0;

	var _aGetWidth = 'w';
	var _aGetHeight = 'h';
	var _aGetTile = 't';
	var _aGetWaiting = 'wt';
	
	var _tileZoomArray = null;
	var _imageLoader = null;

	var _ctx = null;

	var getTileFile, getEvent, 
		zoom, 
            zoomIn, zoomOut, 
            zoomInMouse, zoomOutMouse,
		mousePosX, mousePosY, 
			mouseUp, mouseMove, mouseUpWindow, mouseMoveWindow,
			mouseDown, mouseOut, mouseOver,mouseWheel,
		initialTilesLoaded, calculateNeededTiles, getTiles, tileLoaded,
		paint;
            
	getTileFile = function( zoom, column, row ) {
		return _tilesFolder + "/" + zoom + "/" + column + "_" + row + "." + _fileType;
	};

	initialTilesLoaded = function() {
		
		var tileZoomLevel = _tileZoomArray[_zoomLevel];
		
		var columns = tileZoomLevel.length;
		var rows = tileZoomLevel[0].length;
 
		var iColumn = 0, iRow = 0;
		var imageId = 0;
		for( iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( iRow = 0; iRow < rows; iRow++ )
			{
				tileZoomLevel[iColumn][iRow][_aGetTile] = _imageLoader.getImageById( imageId++ );
			}
		}
		
		_tileZoomArray[_zoomLevelFull][0][0][_aGetTile] = _imageLoader.getImageById( imageId );
		
		//
		// Centre image
		//
		_offsetX = (_canvas.width - tileZoomLevel[_aGetWidth]) / 2;
		_offsetY = (_canvas.height - tileZoomLevel[_aGetHeight]) / 2;
		
		// 
		// Add mouse listener events
		//
        var mouse = 'mouse'; // minify!
		_canvas.addEventListener( mouse+'move', function (e) { mouseMove( getEvent(e) ); }, true);
		_canvas.addEventListener(mouse+'down', function (e) { mouseDown( getEvent(e) ); }, true);
		_canvas.addEventListener(mouse+'up', function (e) { mouseUp( getEvent(e) ); }, true);
		
		_canvas.addEventListener(mouse+'out', function (e) { mouseOut( getEvent(e) ); }, true);
		_canvas.addEventListener(mouse+'over', function (e) { mouseOver( getEvent(e) ); }, true);
		_canvas.addEventListener('DOMMouseScroll', function (e) { mouseWheel( getEvent(e) ); }, true);
		_canvas.addEventListener(mouse+'wheel', function (e) { mouseWheel( getEvent(e) ); }, true);
		
		// Keep track even if mouse is outside of canvas while dragging image
		window.addEventListener(mouse+'up', function (e) { mouseUpWindow( getEvent(e) ); }, false);
		window.addEventListener(mouse+'move', function (e) { mouseMoveWindow( getEvent(e) ); }, false);
		
		_ctx = _canvas.getContext('2d');
		
		paint();
	};
    
	// Helper function
	getEvent = function( event ) {
		if( !event ) // IE
		{   event = window.event;   }
		
		return event;
	};
    
	mouseDown = function( event ) {
		_mouseIsDown = true;
		_mouseLeftWhileDown = false;
		
		_mouseDownX = mousePosX(event);
		_mouseDownY = mousePosY(event); 
		
		_mouseMoveX = _mouseDownX;
		_mouseMoveY = _mouseDownY;
	};
	
	mouseUp = function( event ) {
		_mouseIsDown = false;
		_mouseLeftWhileDown = false;
		
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event); 
		
		if( _mouseX === _mouseDownX &&
			 _mouseY === _mouseDownY )
		{
			// Didn't drag so assume a click.
			zoomInMouse();
		}
	};
	
	mouseMove = function(event) {
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event); 

		if( _mouseIsDown )
		{
			var newOffsetX = _offsetX + (_mouseX - _mouseMoveX);
			var newOffsetY = _offsetY + (_mouseY - _mouseMoveY);
			
			calculateNeededTiles( _zoomLevel, newOffsetX, newOffsetY );
			
			_mouseMoveX = _mouseX;
			_mouseMoveY = _mouseY;
			
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;
			
			paint();
		}
	};
	
    mousePosX = function( event ) {
		// Get the mouse position relative to the canvas element.
		var x = 0;
		
		if (event.layerX || event.layerX === 0) { // Firefox
			x = event.layerX - _canvas.offsetLeft;
		} else if (event.offsetX || event.offsetX === 0) { // Opera
			x = event.offsetX;
		}
		
		return x;
	};
	
	mousePosY = function( event ) {
		var y = 0;
		
		if (event.layerY || event.layerY === 0) { // Firefox
			y = event.layerY - _canvas.offsetTop;
		} else if (event.offsetY || event.offsetY === 0) { // Opera
			y = event.offsetY;
		}
		
		return y;
	};
    
	mouseOut = function( event ) {
		if( _mouseIsDown )
		{
			_mouseLeftWhileDown = true;
		}
	};
	
	mouseOver = function( event ) {
		// (Should be called mouseEnter IMO...)
		_mouseLeftWhileDown = false;
	};
	
	mouseWheel = function( event ) {
		var delta = 0;
				 
		if (event.wheelDelta) { /* IE/Opera. */
			delta = -(event.wheelDelta/120);
		} else if (event.detail) { /* Mozilla */
			delta = event.detail/3;
		}

		if (delta)  {
			if (delta < 0)
			{	zoomInMouse();   }
			else
			{	zoomOutMouse();  }
		}
				 
		if (event.preventDefault)
		{	event.preventDefault(); }
				    
		event.returnValue = false;
	};
	
	// If mouseUp occurs outside of canvas while moving, cancel movement.
	mouseUpWindow = function( event ) {
		if( _mouseIsDown && _mouseLeftWhileDown )
		{
			mouseUp( event );
		}
	};
	
	// keep track of mouse outside of canvas so movement continues.
	mouseMoveWindow = function(event) {
		if( _mouseIsDown && _mouseLeftWhileDown )
		{
			mouseMove(event);
		}
	};
    
	// Zoom in a single level
	zoomIn = function ( x, y) {
		zoom( _zoomLevel + 1, x, y );
		paint();
	};
	
	// Zoom out a single level
	zoomOut = function ( x, y) {
		zoom( _zoomLevel - 1, x, y );
		paint();
	};
	
    // Zoom in at mouse co-ordinates
	zoomInMouse = function () {
		zoomIn( _mouseX, _mouseY );
	};
	
	// Zoom out at mouse co-ordinates
	zoomOutMouse = function () {
		zoomOut( _mouseX, _mouseY );
	};
    
	//Zoom in at the centre of the canvas
	this.zoomInCentre = function () {
		zoomIn( _canvas.width / 2, _canvas.height / 2 );
	};
	
	//Zoom out at the centre of the canvas
	this.zoomOutCentre = function () {
		zoomOut( _canvas.width / 2, _canvas.height / 2);
	};
	
	// Change the zoom level and update.
	zoom = function( zoomLevel, zoomX, zoomY ) {
		if( zoomLevel >= _zoomLevelMin && zoomLevel <= _zoomLevelMax ) {
			// TODO: restrict zoom position to within (close?) area of image.
            
			var newZoom = zoomLevel,
					currentZoom = _zoomLevel,										
                    currentImageX = zoomX - _offsetX,
					currentImageY = zoomY - _offsetY;
			
			var scale = _tileZoomArray[newZoom][_aGetWidth] / _tileZoomArray[currentZoom][_aGetWidth];
			
			var newImageX = currentImageX * scale,
					newImageY = currentImageY * scale;
			
			var newOffsetX = _offsetX - (newImageX - currentImageX),
					newOffsetY = _offsetY - (newImageY - currentImageY);
					
			calculateNeededTiles( newZoom, newOffsetX, newOffsetY );
			
			
			_zoomLevel = newZoom;
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;
		}
	};
	
	// Work out which of the tiles we need to download 
	calculateNeededTiles = function( zoom, offsetX, offsetY ) {
		//
		// Calculate needed tiles
		//
		var tileZoomLevelArray = _tileZoomArray[zoom];
		
		var canvasLeft = -offsetX, 
				canvasTop = -offsetY; 
		var canvasRight = canvasLeft + _canvas.width,
				canvasBottom = canvasTop + _canvas.height;
	
		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0;
		var tile = null;
	
		var zoomWidth = tileZoomLevelArray[_aGetWidth],
				zoomHeight = tileZoomLevelArray[_aGetHeight];
		
		var columns = tileZoomLevelArray.length,
			rows = tileZoomLevelArray[0].length;
		
        var iColumn = 0, iRow = 0;
		var tileList = []; //new Array();
		for( iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( iRow = 0; iRow < rows; iRow++ )
			{
				tile = tileZoomLevelArray[iColumn][iRow];
				
				if( tile[_aGetTile] === null && tile[_aGetWaiting] === false )
				{
					tileLeft = iColumn * _tileSize;
					tileRight = tileLeft + Math.min( _tileSize, zoomWidth - tileLeft );
					tileTop = iRow * _tileSize;
					tileBottom = tileTop + Math.min( _tileSize, zoomHeight - tileTop );
			
					if( !( tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop ) )
					{
						// request tile!
						tile[_aGetWaiting] = true;
						tileList.push( { "name" : zoom + "_" + iColumn + "_" + iRow, "file" : getTileFile( zoom, iColumn, iRow ) } );
					}
				}
			}
		}
		
		getTiles( tileList );
	};
	
	// Load the tiles we need with ImageLoader
	getTiles = function( tileList ) {
		if( tileList.length > 0 )
		{
			_imageLoader = new ImageLoader( {
				"images": tileList,
				"onImageLoaded":function( name, tile ) { tileLoaded( name, tile ); }
			} );
		}
	};
	
	// Tile loaded, save it.
	tileLoaded = function ( name, tile ) {
		var tileDetails = name.split("_");
		
		if( tileDetails.length === 3 )
		{
			var tileInfo = _tileZoomArray[tileDetails[0]][tileDetails[1]][tileDetails[2]];
			tileInfo[_aGetTile] = tile;
			tileInfo[_aGetWaiting] = false;
			
			paint();
		}
	};
	
	paint = function () {
		var canvasWidth = _canvas.width,
				canvasHeight = _canvas.height,	   
                tileZoomLevelArray = _tileZoomArray[_zoomLevel];
		
		var columns = tileZoomLevelArray.length,
				rows = tileZoomLevelArray[0].length,
                canvasLeft = -_offsetX,
				canvasTop = -_offsetY;
                
		var canvasRight = canvasLeft + canvasWidth,
				canvasBottom = canvasTop + canvasHeight;

		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0, 
                tileCount = 0, 
                tile = null;
		
		var zoomWidth = tileZoomLevelArray[_aGetWidth],
                zoomHeight = tileZoomLevelArray[_aGetHeight];
        
        
		//
		// Clear area
		//
        
        var imageTop = _offsetY,
                imageLeft = _offsetX,
                imageBottom = _offsetY + zoomHeight,
                imageRight = _offsetX + zoomWidth;
        
		_ctx.clearRect( 0, 0, canvasWidth, imageTop+1 );
		_ctx.clearRect( 0, imageTop, imageLeft+1, canvasHeight-imageTop );
		_ctx.clearRect( imageLeft + zoomWidth-1, imageTop, canvasWidth - imageLeft - zoomWidth, canvasHeight - imageTop );
		_ctx.clearRect( imageLeft, imageTop + zoomHeight, zoomWidth, canvasHeight - imageTop - zoomHeight );
        
        //
		// Show images
		//
        
		// TODO: This pastes a low resolution copy on the background (It's a bit of a hack, a better solution might be to find a nearer zoom (if one is downloaded))
		var fullTile = _tileZoomArray[_zoomLevelFull][0][0][_aGetTile];
        
        var iColumn = 0, iRow = 0 ;
		// TODO: Improve this by working out the start / end column and row using the image position instead of looping through them all (still pretty fast though!)
		for( iColumn = 0; iColumn < columns; iColumn++ )
		{
			for( iRow = 0; iRow < rows; iRow++ )
			{
				tileLeft = iColumn * _tileSize;
				tileRight = tileLeft + Math.min( _tileSize, zoomWidth - tileLeft );
				tileTop = iRow * _tileSize;
				tileBottom = tileTop + Math.min( _tileSize, zoomHeight - tileTop ); 
				
				if( !( tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop ) )
				{
					tile = tileZoomLevelArray[iColumn][iRow][_aGetTile];
					
					tileLeft += _offsetX;
					tileRight += _offsetX;
					tileTop += _offsetY;
					tileBottom += _offsetY;
					
					if( tile !== null )
					{
						// Draw tile
						_ctx.drawImage( tile, tileLeft, tileTop );

						if( _debug )
						{
							_ctx.strokeRect( tileLeft, tileTop, _tileSize, _tileSize );
							tileCount++;
						}
					}
					else
					{
						//
						// Tile still loading
						//
						if( !_debug || !_debugShowRectangle )
						{
							_ctx.save();
							_ctx.beginPath();
						
							_ctx.moveTo( tileLeft, tileTop );
							_ctx.lineTo( tileRight, tileTop );
							_ctx.lineTo( tileRight, tileBottom );
							_ctx.lineTo( tileLeft, tileBottom );
							_ctx.closePath();

							_ctx.clip();
						
							// TODO: Fill with a lower zoom image. (or possible use combination of higher zooms??)
							// but scaling images in canvas still VERY SLOW.
							// THIS NOTABLY SLOWS DOWN PANNING WHEN IMAGES ARE NOT YET LOADED ON SOME BROWSERS.
							_ctx.drawImage( fullTile, _offsetX, _offsetY, zoomWidth, zoomHeight );
							
							_ctx.restore();
						}
						else
						{
							_ctx.fillStyle = "#999";
							_ctx.fillRect( tileLeft, tileTop, tileRight - tileLeft, tileBottom - tileTop );
						}
					}
				}
			}
		}
		
        if( _drawBorder ) {
            //
            // Canvas area
            //
            _ctx.strokeStyle = "#000";
            _ctx.strokeRect( 0, 0, canvasWidth, canvasHeight );
        }
        
		if( _debug )
		{
			// 
			// DEBUG!
			//
            _ctx.strokeStyle = "#ff0";
            _ctx.strokeRect( canvasLeft, canvasTop, canvasRight - canvasLeft, canvasBottom - canvasTop );
            _ctx.strokeStyle = "#f0f";
            _ctx.strokeRect( imageLeft, imageTop, imageRight - imageLeft, imageBottom - imageTop );
            
			_ctx.fillStyle = "#0f0";
			_ctx.font = "normal 12px Arial";
			
			// Text
			_ctx.fillText( _mouseX + "," + _mouseY + " | " + _offsetX + "," + _offsetY + " | " + tileCount, 0, 20 );
	
			// Grid
			_ctx.strokeStyle = "#f00";
			var x,y;
			for( y = 0; y < canvasHeight; y += _tileSize )
			{
				for( x = 0; x < canvasWidth; x += _tileSize )
				{	_ctx.strokeRect( x, y, _tileSize, _tileSize );  }
			}
		}
	};

    (function() { // setup
		_zoomLevelMax = Math.ceil( Math.log( Math.max( _imageWidth, _imageHeight ))/Math.LN2 );
		_tileZoomArray = [];    //new Array( _zoomLevelMax );

		var reducingWidth = _imageWidth;
		var reducingHeight = _imageHeight;
		var zoomLevelStart = -1;
		var iZoom = 0, iColumn = 0, iRow = 0;
        var columns = -1, rows = -1;
        
		for( iZoom = _zoomLevelMax;  iZoom >= _zoomLevelMin; iZoom-- ) {
		
			columns = Math.ceil( reducingWidth / _tileSize );
			rows = Math.ceil( reducingHeight / _tileSize );

			if( _zoomLevelFull === -1 && 
					reducingWidth <= _tileSize && reducingHeight <= _tileSize ) {
				// Largest full image inside single tile.
				_zoomLevelFull = iZoom;
			}
			
			if( zoomLevelStart === -1 && 
					reducingWidth <= _canvas.width && reducingHeight <= _canvas.height ) {
				// Largest full image inside single tile.
				zoomLevelStart = iZoom;
			}

			// Create array for tiles
			_tileZoomArray[iZoom] = [];
			for( iColumn = 0; iColumn < columns; iColumn++ ) {
				_tileZoomArray[iZoom][iColumn] = []; 
			}
			
			// Set defaults
			// TODO: Test width - possibly to short, maybe not including last tile width...
			_tileZoomArray[iZoom][_aGetWidth] = reducingWidth;
			_tileZoomArray[iZoom][_aGetHeight] = reducingHeight;
			
			for( iColumn = 0; iColumn < columns; iColumn++ ) {
			
				for( iRow = 0; iRow < rows; iRow++ ) {
				
					_tileZoomArray[iZoom][iColumn][iRow] = [];
					
					_tileZoomArray[iZoom][iColumn][iRow][_aGetTile] = null;
					_tileZoomArray[iZoom][iColumn][iRow][_aGetWaiting] = false;
				}
			}
			
			reducingWidth /= 2;
			reducingHeight /= 2;
		}
		
		_zoomLevel = zoomLevelStart;
		
		//
		// Initial tile load
		//
		var imageList = []; //new Array();	
		var imageId = 0;
		
		columns = _tileZoomArray[_zoomLevel].length;
		rows = _tileZoomArray[_zoomLevel][0].length;
		
		for( iColumn = 0; iColumn < columns; iColumn++ ) {
		
			for( iRow = 0; iRow < rows; iRow++ ) {
			
				imageList.push( { "id" : imageId++, "file": getTileFile( _zoomLevel, iColumn, iRow  ) } );
			}
		}
		
		imageList.push( { "id" : imageId, "file": getTileFile( _zoomLevelFull, 0, 0  ) } );

		_imageLoader = new ImageLoader( {
			"images": imageList,
			"onAllLoaded":function() { initialTilesLoaded(); },
		} );
        
	}());
}

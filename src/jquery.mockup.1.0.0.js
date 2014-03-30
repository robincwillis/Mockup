(function( $ ){

	$.fn.mockup = function(options){

		var el = $(this);

		var settings = {
			images : el.find('img'),
			opacity : 0.5,
			valign : "center",
			halign : "center",
			width : 1200,
			offsetX : 0,
			offsetY : 0,
			visible : true
		};



		el.css({
			'position':'absolute',
			'top':0,
			'left':0,
			'z-index':10000,
			'width':'100%',
			'height':'100%'
		});

		var img = $(settings.images[0]);
		var imgOffset = img.offset();
		var isDragging=false;
		var xPos = 0;
		var yPos = 0;
		var canMouseX, canMouseY;
		var imageXPos = xPos;
		var imageYPos = yPos;
		var offsetX=imgOffset.left;
		var offsetY=imgOffset.top;
		var index = 0;


		return this.each(function(){
			//if options exist, lets merge them with our default settings
			if (options){
				$.extend( settings, options);
			}

			init();

			$(window).keydown(function(e){
				//resize //T
				if(e.keyCode === 84){
					window.resizeTo(settings.width,window.innerHeight);
				}
				//show / hide //space
				if(e.keyCode === 32){

					if(el.is(":visible")){
						el.hide();
					}else{
						el.show();
					}
				}
				//increase opacity //up arrow
				if(e.keyCode === 38){

					var o = parseFloat(img.css('opacity'));

					if(o <= 1){
						o += 0.1;

						img.css({'opacity': o})
					}
				}
				//decrease opacity //down arrow
				if(e.keyCode === 40){

					var o = parseFloat(img.css('opacity'));
					if(o >= 0){
						o -= 0.1
						img.css({'opacity': o })
					}
				}
				//next image //left arrow
				if(e.keyCode === 37){
					img.hide();
					index --;
					if(index == -1){
						index = settings.images.length-1;
					}
					reset(settings.images[index]);
				}
				//prev image //right arrow
				if(e.keyCode === 39){
					img.hide();
					index ++;
					if(index == settings.images.length){
						index = 0;
					}
					reset(settings.images[index]);
				}
			});

			function init(){

				$.each(settings.images, function(i, img){

					$(img).css({
						'border' : '1px solid #fff',
						'position' : 'absolute',
						'width' : settings.width,
						'height' : 'auto',
						'opacity' : settings.opacity
					});

					switch (settings.valign) {
						case "top":

							$(img).css({top:settings.offsetY});

							break;
						case "center":

							$(img).css({
								top:($(window).height()-$(img).height())/2
							});
							break;
						case "bottom":

							$(img).css({bottom:settings.offsetY});

							break;
						default:
							//
							break;
					}

					switch (settings.halign) {
							case "left":
									$(img).css({left:settings.offsetX});
								break;
							case "center":
								$(img).css({
									left:($(window).width()-$(img).width())/2
								});
								break;
							case "right":
									$(img).css({right:settings.offsetX});
								break;
							default:
								//
								break;
					}
					if(i !== 0){
						$(img).hide();
					}



				});

				imgOffset = img.offset();


				if(!settings.visible){
						$(img[0]).hide();
				}
				var imgPosition = img.position();
				xPos = imgPosition.left;
				yPos = imgPosition.top;
			}

			function reset(selector){
				img = $(selector);
				img.show();
				imgOffset = img.offset();
				isDragging=false;
				var imgPosition = img.position();
				xPos = imgPosition.left;
				yPos = imgPosition.top;
				canMouseX, canMouseY;
				imageXPos = xPos;
				imageYPos = yPos;
				offsetX=imgOffset.left;
				offsetY=imgOffset.top;

			}

			function handleMouseDown(e){
				e.preventDefault();
				canMouseX=parseInt(e.clientX-offsetX);
				canMouseY=parseInt(e.clientY-offsetY);

				imageXPos = canMouseX - xPos;
				imageYPos = canMouseY - yPos;

				isDragging=true;
			}

			function handleMouseUp(e){
				e.preventDefault();
				canMouseX=parseInt(e.clientX-offsetX);
				canMouseY=parseInt(e.clientY-offsetY);

				xPos = canMouseX-imageXPos;
				yPos = canMouseY-imageYPos;

				isDragging=false;
			}

			function handleMouseOut(e){
				e.preventDefault();
				canMouseX=parseInt(e.clientX-offsetX);
				canMouseY=parseInt(e.clientY-offsetY);
				// user has left the canvas, so clear the drag flag
				isDragging=false;
			}

			function handleMouseMove(e){
				e.preventDefault();
				canMouseX=parseInt(e.clientX-offsetX);
				canMouseY=parseInt(e.clientY-offsetY);

				if(isDragging){
					img.offset({ top: (imageYPos-canMouseY) *-1, left: (imageXPos-canMouseX) *-1 });
				}
			}


			el.mousedown(function(e){handleMouseDown(e);});
			el.mousemove(function(e){handleMouseMove(e);});
			el.mouseup(function(e){handleMouseUp(e);});
			el.mouseout(function(e){handleMouseOut(e);});
		});

	};

	})( jQuery );

//---------------------------------------------
//$('#mockup').mockup();
//---------------------------------------------


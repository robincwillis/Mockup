/************************************************************************
*************************************************************************
@Name :       Clock
@Revison :    0.0.1
@Date :       09/1/2013
@Author:      Robin Willis
@License :    Open Source - MIT License : http://www.opensource.org/licenses/mit-license.php
**************************************************************************
*************************************************************************/
(function( $ ){

	var methods = {
	
		init : function( options ) {
		
			return this.each(function() {
	 
				$(this).data('settings',{
					el			: $(this)
				});
			
				$.extend($(this).data('settings'), options);
				var data = $(this).data('settings');


				window.setInterval(function(){
				var time = methods.getTime().split(" "); //setTimeout(,1000);
				data.el.html('<div class="centered">'+time[0]+'<span class="ampm"> '+time[1]+'</span>'+'</div>');
					}, 1000);
	
			});

		},


		getTime : function(){
				var now = new Date();
				var ofst = now.getTimezoneOffset()/60;
				mins = now.getMinutes();

				var zone=0;
				var isitlocal=true;
				var ampm='';

				secs=now.getSeconds();
			 	sec=-1.57+Math.PI*secs/30;

				min=-1.57+Math.PI*mins/30;
				hr=(isitlocal)?now.getHours():(now.getHours() + parseInt(ofst)) + parseInt(zone);
				hrs=-1.575+Math.PI*hr/6+Math.PI*parseInt(now.getMinutes())/360;
				if (hr < 0) hr+=24;
				if (hr > 23) hr-=24;
				ampm = (hr > 11)?"PM":"AM";
				statusampm = ampm.toLowerCase();

				hr2 = hr;
				if (hr2 == 0) hr2=12;
				(hr2 < 13)?hr2:hr2 %= 12;
				if (hr2<10) hr2="0"+hr2

				var finaltime=hr2+':'+((mins < 10)?"0"+mins:mins)+' '+statusampm;
				return finaltime;
				//console.log(finaltime);
				//$(this).
		}

		// updateclock: function(z){
		// 	zone=z.options[z.selectedIndex].value;
		// 	isitlocal=(z.options[0].selected)?true:false;
		// },

		// WorldClock: function(){
		// 	now=new Date();
		// 	ofst=now.getTimezoneOffset()/60;
		// 	secs=now.getSeconds();
		// 	sec=-1.57+Math.PI*secs/30;
		// 	mins=now.getMinutes();
		// 	min=-1.57+Math.PI*mins/30;
		// 	hr=(isitlocal)?now.getHours():(now.getHours() + parseInt(ofst)) + parseInt(zone);
		// 	hrs=-1.575+Math.PI*hr/6+Math.PI*parseInt(now.getMinutes())/360;
		// 	if (hr < 0) hr+=24;
		// 	if (hr > 23) hr-=24;
		// 	ampm = (hr > 11)?"PM":"AM";
		// 	statusampm = ampm.toLowerCase();

		// 	hr2 = hr;
		// 	if (hr2 == 0) hr2=12;
		// 	(hr2 < 13)?hr2:hr2 %= 12;
		// 	if (hr2<10) hr2="0"+hr2

		// 	var finaltime=hr2+':'+((mins < 10)?"0"+mins:mins)+':'+((secs < 10)?"0"+secs:secs)+' '+statusampm;

		// 	if (document.all)
		// 	worldclock.innerHTML=finaltime
		// 	else if (document.getElementById)
		// 	document.getElementById("worldclock").innerHTML=finaltime
		// 	else if (document.layers){
		// 	document.worldclockns.document.worldclockns2.document.write(finaltime)
		// 	document.worldclockns.document.worldclockns2.document.close()
		// }

	};

  $.fn.clock = function( method ) {
	
	// Method calling logic
	if ( methods[method] ) {
		return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
	} else if ( typeof method === 'object' || ! method ) {
		return methods.init.apply( this, arguments );
	} else {
		$.error( 'Method ' +  method + ' does not exist on jQuery.clock' );
	}
  
  };

})( jQuery );


(function() {

	$('#clock-widget').clock();

	//$('#weather-widget').

	//http://simpleweatherjs.com/

	 $.simpleWeather({
    zipcode: '',
    woeid: '12589335',
    location: '',
    unit: 'f',
    success: function(weather) {
      html = '<h2>'+weather.temp+'&deg;'+weather.units.temp+'</h2>';


      // html += '<ul><li>'+weather.city+', '+weather.region+'</li>';
       html += '<p class="currently">'+weather.currently+'</p>';
      // html += '<li>'+weather.tempAlt+'&deg;C</li></ul>';
  
      $("#weather-widget").html(html);
    },
    error: function(error) {
      $("#weather").html('<p>'+error+'</p>');
    }
  });



	var today = new Date();
	var dayOfMonth = today.getDate();
	var weekday = new Array('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
    var dayOfWeek = weekday[today.getDay()];
    var months = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December');
    var curMonth = months[today.getMonth()];

	var curYear = today.getFullYear();
	console.log(dayOfWeek);
	console.log(curMonth);
	console.log();
	console.log(curYear);

	var date_html = '';
	date_html += '<h2>'+dayOfWeek+'</h2>';
	date_html += '<p class="date">'+dayOfMonth +' '+curMonth+' '+curYear+'</p>';

	$('#calendar-widget').html(date_html);

})();
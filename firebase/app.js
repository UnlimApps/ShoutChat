/*
	Copyright 2015, Google, Inc.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

var FirebaseConnection = {

	//Data is a object that contains a function to display new messages (displayNewMessages) and a object with two divs:
	//one to show after auth, and one to hide after auth
	init: function(data) {

		var firebase_app_name = "YOUR APP NAME HERE";

		this.ref = new Firebase("https://" + firebase_app_name + ".firebaseio.com/");

		//Function to call when the user logs in
		data.divs.beforeLogin.show();
		var that = this;
		this.ref.onAuth(function(authData) {
			if (authData) {
				that.ref.child("users").child(authData.uid).set({
					name: authData[authData.provider].displayName
				});
				that.uid = authData.uid;
				data.divs.afterLogin.show();
				data.divs.beforeLogin.hide();
			}
		});

		//listen for new messages and display them
		this.ref.child("messages").limitToLast(1000).on("child_added", function(snapshot) {
			var msg = snapshot.val();
			msg.id = snapshot.key();
			msg.sender = "";
			data.displayNewMessage(msg);
			that.ref.child("users").child(msg.uid).child("name").once("value", function(snapshot) {
				$("#" + msg.id).text(snapshot.val() + ": ");
			});
		});

	},
	sendMessage: function(data) {
		data.uid = this.uid;
		this.ref.child("messages").push(data);
	},
	googleAuth: function() {
		this.ref.authWithOAuthPopup("google", function(error, authData) {
			if (error) {
				console.log("Login Failed!", error);
			}
		});
	}
}

google.maps.event.addDomListener(window, 'load', function() {
	initialize(FirebaseConnection);
});


//Shared Scaffolding Code for both Firebase and SocketIO 

function initialize(connection) {

	var center = new google.maps.LatLng(0, 0),
		radius = 2e2,
		mapOptions = {
			zoom: 7
		},
		map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions),
		circleOptions = {
			strokeColor: '#00CC99',
			strokeOpacity: 0.8,
			strokeWeight: 2,
			fillColor: '#00CC99',
			fillOpacity: 0.35,
			map: map,
			center: center,
			radius: radius,
		},
		circle = new google.maps.Circle(circleOptions),
		geocoder = new google.maps.Geocoder(),
		location = "";

	// Try HTML5 geolocation
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(
			function(position) {
				//success getting position
				setPosition({
					lat: position.coords.latitude,
					lng: position.coords.longitude
				});
			}, function() {
				//failure getting position
				handleNoGeolocation(true);
			});
	} else {
		// Browser doesn't support Geolocation
		handleNoGeolocation(false);
	}

	function handleNoGeolocation(errorFlag) {
		setPosition({
			lat: 60,
			lng: 105
		});
	}

	//Reset map to the center
	//If data is set, it will use data.lat as the new latitude and data.lng as the new longitude

	function setPosition(data) {
		if (data) {
			if (data.lat && data.lng) {
				center = new google.maps.LatLng(data.lat, data.lng);
			}
		}
		drawCircle({
			center: center
		});
		map.setCenter(center);

		//get address
		geocoder.geocode({
			'latLng': center
		}, function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				if (results[2]) {
					location = results[2].formatted_address;
				} else if (results[4]) {
					location = results[4].formatted_address;
				}
			}
		});
	}


	//Draw a circle on the map
	//If set, data.center is the new center of the circle
	//If set, data.radius is the new size of the circle
	//If set, data.color is the new color of the circle

	function drawCircle(data) {
		if (data) {
			if (data.center) {
				circleOptions.center = data.center;
			}
			if (data.radius) {
				circleOptions.radius = data.radius;
			}
			if (data.color) {
				circleOptions.fillColor = data.color;
				circleOptions.strokeColor = data.color;
			}
		}
		circle.setOptions(circleOptions);
		map.fitBounds(circle.getBounds());
	}

	//Wait for map to load, then add click listners

	google.maps.event.addListenerOnce(map, 'tilesloaded', function() {

		google.maps.event.trigger(map, "resize");
		setPosition();

		//http://stackoverflow.com/questions/846221/logarithmic-slider

		function logslider(position) {
			//the slider position will be between 0 and 1000
			var minp = 0,
				maxp = 1e3;

			// The result should be between 200 an 20000000
			var minv = Math.log(2e2) + 1,
				maxv = Math.log(2e7);

			// calculate adjustment factor
			var scale = (maxv - minv) / (maxp - minp);

			return Math.exp(minv + scale * (position - minp));
		}

		$("#slider").change(function() {
			var val = $("#slider").val(),
				msg = "Shout to ";
			if (val < 20) {
				msg += "your Neighborhood!"
			} else if (val < 200) {
				msg += "your City District!"
			} else if (val < 300) {
				msg += "your City!"
			} else if (val < 400) {
				msg += "people in and around your City!"
			} else if (val < 500) {
				msg += "people in and around your County!"
			} else if (val < 800) {
				msg += "people in and around your State or Country!"
			} else if (val < 900) {
				msg += "your Continent!"
			} else if (val < 999) {
				msg += "your Continent and its neighbors!"
			} else {
				msg += "the World!"
			}
			$("#message").attr("placeholder", msg);
			drawCircle({
				radius: logslider(val)
			});
		});

		//Pass in a function to display new messages and the divs to hide and show after auth
		connection.init({
			displayNewMessage: function(message) {
				//Check the distance to the message's origin
				var mypos = new google.maps.LatLng(center.lat(), center.lng()),
					messagepos = new google.maps.LatLng(message.lat, message.lng),
					distance = google.maps.geometry.spherical.computeDistanceBetween(mypos, messagepos);

				//If we are withing the message's radius, display the message
				if (distance < message.radius) {
					var marker = new google.maps.Marker({
						position: messagepos,
					});

					//Make sure we prevent potential XSS
					var line = $('<li>'),
						username = $('<b id=' + message.id + '>').text(message.sender + ": "),
						messagetext = $('<span>').text(message.message),
						loc = $('<small>').text(" - " + message.location).addClass("text-muted"),
						prevZoom = map.getZoom();

					line.append(username).append(messagetext).append(loc);

					//Cool little functions to jump on the map to where the person wrote the message
					line.mouseenter(function() {
						prevZoom = map.getZoom();
						map.setZoom(7);
						map.setCenter(messagepos);
						marker.setMap(map);
					});
					line.mouseleave(function() {
						marker.setMap(null);
						map.setZoom(prevZoom);
						map.setCenter(center);
					});

					$("#text").append(line);

					$("#chat-panel").scrollTop($("#chat-panel")[0].scrollHeight);
				}
			},
			divs: {
				afterLogin: $("#afterLogin"),
				beforeLogin: $("#beforeLogin")
			}
		});

		//Send a new message when we click send

		$("#message").keypress(function(e) {
			if (e.which == 13) {
				$("#send").click()
			}
		});

		$("#send").click(function() {
			connection.sendMessage({
				message: $("#message").val().substring(0, 140),
				radius: circleOptions.radius,
				lat: center.lat(),
				lng: center.lng(),
				location: location
			})
		})

		//Google Auth

		$("#google-login").click(function() {
			connection.googleAuth();
		})

	});
}

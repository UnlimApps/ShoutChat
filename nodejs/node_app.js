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
var express = require('express'),
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	redis = require('redis').createClient(),
	session = require('express-session'),
	sharedsession = require("express-socket.io-session"),
	RedisStore = require('connect-redis')(session),
	google = require('googleapis'),
	OAuth2 = google.auth.OAuth2,
	user = google.oauth2('v2');


//Set up Google OAuth
var GOOGLE_CLIENT_ID = "PASTE YOUR CLIENT ID HERE", //See Readme to learn how to get this
	GOOGLE_CLIENT_SECRET = "PASTE YOUR CLIENT SECRET HERE", //See Readme to learn how to get this
	GOOGLE_REDIRECT_URL = "http://localhost:3000/auth/google/callback",
	oauth2Client = new OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL),
	url = oauth2Client.generateAuthUrl({
		access_type: 'online',
		scope: 'https://www.googleapis.com/auth/userinfo.profile'
	});

//Treat the public directory as the root directory, and statically serve them
app.use('/', express.static(__dirname + '/public'));
app.set('views', __dirname + '/public');

//Use session to store user data with Redis
var ShoutChatSession = session({
	store: new RedisStore({
		client: redis
	}),
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true
});

//Set up sessions for both http and sockets
app.use(ShoutChatSession);
io.use(sharedsession(ShoutChatSession));

//Callback function after the Google Auth is done
app.get('/auth/google/callback', function(req, res) {
	if (req.query.code) {
		oauth2Client.getToken(req.query.code, function(err, tokens) {
			if (err) {
				console.log("Auth Error - " + err);
				res.redirect('/');
			} else {
				//Use the returned token to authenticate the user
				oauth2Client.setCredentials(tokens);
				//Get the user's name and store it in the session
				user.userinfo.get({
					userId: 'me',
					auth: oauth2Client
				}, function(err, profile) {
					if (err) {
						console.log("Auth Error - " + err);
					} else {
						//If everything was successful, then store the user's name in session
						req.session.sender = profile.name;
					}
					res.redirect('/');
				});
			}
		});
	} else {
		console.log("Auth Error" - req.query)
	}
})

io.on('connection', function(socket) {

	//If user has a valid session, then tell them they are allowed to send messages
	if (socket.handshake.session) {
		if (socket.handshake.session.sender) {
			socket.emit('auth_set');
		}
	}

	//Enable the Google Auth button click
	//A different way to do this may be to use a template and inject the url into the template
	//However, I want to keep both implementations the same
	socket.on('get_google_auth', function(msg) {
		socket.emit('google_auth', url);
	});

	//Get the last 1000 messages and send them to the client
	redis.lrange('messages', 0, 1000, function(error, msgs) {
		msgs.forEach(function(msg) {
			socket.emit('child_added', JSON.parse(msg));
		});
	});

	//If the client sends us a new message, process it
	socket.on('new_message', function(msg) {
		//Make sure the client has a valid session
		if (socket.handshake.session) {
			if (socket.handshake.session.sender) {
				//Update the sender name using our session variable
				msg.sender = socket.handshake.session.sender;
				//Push the message to everyone else
				io.sockets.emit('child_added', msg);
				//Add the message to Redis
				redis.rpush('messages', JSON.stringify(msg));
				//Trim Redis so we only store the last 1000 messages (optional)
				redis.ltrim('messages', 0, 1000);
			}
		} else {
			//If the session is invalid, decline the message
			socket.emit('child_added', {
				sender: "",
				msg: "Failed to send message, please log in",
				lat: 0,
				lng: 0,
				location: ""
			})
		}
	})
});

http.listen(3000, '127.0.0.1');

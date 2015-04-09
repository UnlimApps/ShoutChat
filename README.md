Firebase and Node.js apps that allow users to chat with users in their area. The louder they chat, the more people hear them!

Firebase Prerequisites:

	1) Sign up for a Firebase account at www.firebase.com
	2) Create a new Firebase App (mine is shoutchat.firbaseio.com)
	3) You can host everything you need here, no need for a dedicated server!
	4) Use https://www.firebase.com/docs/hosting/guide/deploying.html to deploy!
	5) Note: In the firebase.json file, change "shoutchat" to the name of your firebase app

Node.js Prerequisites:

It is highly recommend you run your app on a dedicated server, such as a Google Compute Engine instance.

	1) Install Node.js https://nodejs.org/
	2) Install Redis http://redis.io/
	3) Run `npm install .` in the nodjs folder to install the required modules
	4) Once you enable Google Auth (see below), paste in your Client ID and Client Secret into the appropriate places in node_app.js
	5) Make sure your Redis server is running using `redis-cli ping` (see: http://redis.io/topics/quickstart)
	6) Note: The app will run on port 3000. If you want to run the app on the standard port 80, stackoverflow.com has some great solutions. Please do NOT run node as root or admin!

You need to enable Google Auth for your users to log in:

	Follow the steps here:
	https://www.firebase.com/docs/web/guide/login/google.html

For the Node.js version, the directions are the same except instead of using Firebase, put your website's url in the Authorized JavaScript origins and your website's url + /auth/google/callback in the Authorized redirect URIs

Example:

	Authorized JavaScript origins
	https://auth.firebase.com <- Firebase
	http://localhost:3000 <- Nodejs running on your local machine (for testing)
	
	Authorized redirect URIs
	https://auth.firebase.com/v2/{Your App}/auth/google/callback <- Firebase
	http://localhost:3000/auth/google/callback <- Nodejs running on your local machine (for testing)

Notes:
This is not an official Google product.

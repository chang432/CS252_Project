//database connection stuff
var mongojs = require("mongojs");
var db = mongojs('localhost:27017/attack-on-purdue',['accounts']);
//basic commands you can run for mongo. 
//db.accounts.insert({username:"test",password:"password"});
//db.accounts.find({username:”bob”});
//db.accounts.update({username:”bob”},{$set:{password:”123”}});

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var PORT = process.env.PORT || 5000

//default opens index.html
app.get("/", function(req, res) {
	const path = require('path');
	//res.sendFile(__dirname + '/../Client/index.html');
	res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

server.listen(PORT, function() {
	console.log('listening...');
});

//list of instances
var SOCKET_LIST = {};
//list of players
var PLAYER_LIST = {};

//init one player
var Player = function(id) {
	var self = {
		x:250,
		y:250,
		id:id,
		number:"" + Math.floor(10 * Math.random()),
		pressingRight:false,
		pressingLeft:false,
		pressingUp:false,
		pressingDown:false,
		maxSpd:10,
	}
	self.updatePosition = function() {
		if(self.pressingRight) {
			self.x += self.maxSpd;
		} 
		if (self.pressingLeft) {
			self.x -= self.maxSpd;
		} 
		if (self.pressingUp) {
			self.y -= self.maxSpd;
		}
		if (self.pressingDown) {
			self.y += self.maxSpd;
		}
	}
	return self;
}

io.on('connection', function(socket) {
	console.log('SOCKET CONNECTION');
	//unique identifier for each player
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	var player = Player(socket.id);
	PLAYER_LIST[socket.id] = player;

	//if user exits make sure to errase everything associated w/ user
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});
	//on keypress
	socket.on('keyPress', function(data) {
		if (data.inputId === 'left') {
			player.pressingLeft = data.state;
		} else if (data.inputId === 'right') {
			player.pressingRight = data.state;
		} else if (data.inputId === 'up') {
			player.pressingUp = data.state;
		} else if (data.inputId === 'down') {
			player.pressingDown = data.state;
		}
	});
	/*socket.on('happy', function(data){
		console.log('I hope your happy because ' + data.reason);
	});*/
});

setInterval(function() {
	//this pack of info will contain all the users location
	var pack = [];

	//loop through to update each users position to pack
	for (var i in PLAYER_LIST) {
		var player = PLAYER_LIST[i];
		//player.x++;
		//player.y++;
		player.updatePosition();
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
	}

	//loop through again to give each user the pack of info
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPosition', pack);
	}
	
},1000/25);


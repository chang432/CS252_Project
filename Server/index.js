var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var PORT = process.env.PORT || 5000

//default opens index.html
app.get("/", function(req, res) {
	const path = require('path');
	//res.sendFile(__dirname + '/../Client/index.html');
	res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

http.listen(PORT, function() {
	console.log('listening...');
});

//keeps track of number of players
var SOCKET_LIST = {};

io.on('connection', function(socket) {
	console.log('SOCKET CONNECTION');
	socket.id = Math.random();
	socket.x = 0;
	socket.y = 0;
	socket.number = "" + Math.floor(10 * Math.random());
	SOCKET_LIST[socket.id] = socket;

	//if user exits make sure to errase everything associated w/ user
	socket.on('disconnect', function() {
		delete SOCKET_LIST[socket.id];
	});
	/*socket.on('happy', function(data){
		console.log('I hope your happy because ' + data.reason);
	});*/
});

setInterval(function() {
	//this pack of info will contain all the users location
	var pack = [];

	//loop through to update each users position to pack
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.x++;
		socket.y++;
		pack.push({
			x:socket.x,
			y:socket.y,
			number:socket.number
		});
	}

	//loop through again to give each user the pack of info
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('newPosition', pack);
	}
	
},1000/25);


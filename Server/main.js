var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var PORT = process.env.PORT || 5000

var playerSpeed = 2;
var missileSpeed = 4;
var enemySpeed = 1.5;

var activeGames = [];
var allPlayers = []; /////[Player, Socket];

var playerConstructor = {
	name: "Guest",
	id: "",
	socketId: -1,
	playing: false,
	gameId: "",
	game: undefined, ////game object here
	
	lastUpdated: 0, ////update every time player sends something
	kills: 0,
	roundKills: 0,
	deaths: 0,
	health: 100,
	size: 4,
	x: -1,
	y: -1,
	rotation: [0, 1],
	moveVector: [false, false, false, false] ///up, down, left, right
}

var enemyConstructor = {
	id: "",
	size: 4,
	health: 50,
	x: -1,
	y: -1,
	rotation: [0, 1],
	enemyType: "Normal"
}

var missileConstructor = {
	id: "",
	sentBy: undefined, ///so you can track kills
	size: 1,
	x: -1,
	y: -1,
	rotation: [0, 1]
}

var baseConstructor = {
	id: "",
	size: 10,
	health: 100,
	x: -1,
	y: -1
}

var gameConstructor = {
	id: "",
	started: false,
	host: undefined,
	players: [],
	
	enemies: [],
	bases: [],
	bullets: [],
	deadEnemies: [], ////to show explosions or whatever effect for the missile hitting the enemy
	round: 1,
	enemiesLeft: 0,
	message: "" ////i.e. 3, 2, 1 or Player has left the game
}


function getMagnitude(uno, dos)
{
	return Math.sqrt(Math.pow(uno.x - dos.x, 2) + Math.pow(uno.y - dos.y, 2));
}

function generateId(length)
{
	var possibleChars = "abcdefghijklmnopqurtuvwxyz0123456789";
	var str = "";
	for (var i = 0; i < length; i++)
	{
		var cha = possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
		if (Math.random() < .5) { str = str + cha; }
		else { str = str + cha.toUpperCase(); }
	}
	return str;
}

function createGame(host)
{
	var game = Object.create(gameConstructor);
	game.id = generateId(9);
	game.host = host;
	host.game = game;
	host.gameId = game.id;
	
	activeGames[game.id] = game;
}

function addPlayerToGame(gameId, player)
{
	if (activeGames[gameId] == undefined) { return "Game with id: " + gameId + " could not be found."; }
	var game = activeGames[gameId];
	if (game.started == true)
	{
		return "Game has already started."
	}
	/*var player = undefined;
	for (var i in allPlayers)
	{
		if (allPlayers[i].id == playerId)
		{
			player = allPlayers[i];
			break;
		}
	}
	if (player != undefined)
	{*/
		player.game = game;
		player.gameId = gameId;
		game.players.push(player);
	/*}
	else { return "Player with id: " + playerId + " not found"; }*/
	return "Success";
}

function removePlayerFromGame(gameId, playerId)
{
	if (activeGames[gameId] == undefined) { return "Game with id: " + gameId + " could not be found."; }
	var game = activeGames[gameId];
	var players = game.players;
	for (var i = 0; i < players.length; i++)
	{
		if (players[i].id == playerId)
		{
			var player = players[i];
			player.game = undefined;
			player.gameId = "";
			if (game.host != undefined && game.host.gameId == game.id && game.host.id == player.id)
			{
				if (players.length == 1)
				{
					//////////no players left in game/////////////
					delete activeGames[gameId];
				}
				else
				{
					if (i == 0) { game.host = players[1]; }
					else { game.host = players[0]; }
				}
			}
			players.splice(i, 1);
		}
	}
	return "Success";
}

function getPlayersInGame(gameId)
{
	if (activeGames[gameId] == undefined) { return "Game with id: " + gameId + " could not be found."; }
	var game = activeGames[gameId];
	var players = game.players;
	
	var returnTable = [];
	for (var i = 0; i < players.length; i++)
	{
		var player = players[i];
		var hostString = "Player";
		if (game.host != undefined && game.host.id == players[i].id) { hostString = "Host"; }
		returnTable.push({
			name: player.name,
			id: player.id,
			hosting: hostString
		});
	}

	return returnTable;
}

function getWaitingGames()
{
	var returnTable = [];
	for (var i in activeGames)
	{
		var game = activeGames[i];
		if (game.started == false)
		{
			returnTable.push({
				id: game.id,
				host: game.host,
				numPlayers: game.players.length
			});
		}
	}
	return returnTable;
}


app.get("/", function(req, res) 
{
	const path = require('path');
	//res.sendFile(__dirname + '/../Client/index.html');
	res.sendFile(path.join(__dirname, "..", "Client", "index.html"));
});

app.get(/^(.+)$/, function(req, res)
{ 
     console.log('static file request : ' + req.params);
     res.sendfile( __dirname + req.params[0]); 
});

server.listen(PORT, function() 
{
	console.log('listening...');
});

io.on('connection', function(socket) 
{
	console.log('SOCKET CONNECTION');
	//unique identifier for each player
	socket.id = Math.random();
	socket.emit('socketId', {socketId: socket.id});
	
	var player = Object.create(playerConstructor);
	allPlayers[socket.id] = [player, socket];
	
	player = undefined;
	player = allPlayers[socket.id][0];

	var loggedIn = false;

	//if user exits make sure to errase everything associated w/ user
	socket.on('disconnect', function() 
	{
		loggedIn = false;
		var game = player.game;
		if (game != undefined && player.gameId.length > 1)
		{
			var players = game.players;
			for (var i = 0; i < players.length; i++)
			{
				if (players[i].id == player.id)
				{
					players.splice(i, 1);
				}
			}
		}
		//////////disconnect player from game lists and everything else//////////
		console.log(player.name + " left the site.");
		delete allPlayers[socket.id];
	});

	socket.on('signup', function(data) ////data.username, data.password
	{
		if (data.username == undefined || data.password == undefined) { return; }
		loggedIn = true;
		console.log("Username: " + data.username + "\nPassword: " + data.password);
		
		if (data.username.length < 1) { socket.emit('signupResponse', {success: false, state: "The username you entered is blank."}); return; }
		if (data.password.length < 1) { socket.emit('signupResponse', {success: false, state: "The password you entered is blank."}); return; }
		if (data.username.length > 25) { socket.emit('signupResponse', {success: false, state: "The username you entered is too long."}); return; }
		if (data.password.length > 50) { socket.emit('signupResponse', {success: false, state: "The password you entered is too long."}); return; }
		////////do stuff with the database/////////
		var usernameExists = false;
		Object.keys(allPlayers).forEach(function(key)
		{
			var val = allPlayers[key][0];
			if (val.name == data.username)
			{
				console.log("Username: " + data.username + " already exists!");
				socket.emit('signupResponse', {success: false, state: "The username you chose is already taken."});
				usernameExists = true;
				return;
			}
		});
		if (usernameExists == true) { return; }
		player.name = data.username;
		socket.emit('signupResponse', {success: true, state: "Success"});
	});

	socket.on('login', function(data) ////data.username, data.password
	{
		if (data.username == undefined || data.password == undefined) { return; }
		if (data.username.length < 1) { socket.emit('loginResponse', {success: false, state: "The username you entered is blank."}); return; }
		if (data.password.length < 1) { socket.emit('loginResponse', {success: false, state: "The password you entered is blank."}); return; }
		if (data.username.length > 25) { socket.emit('loginResponse', {success: false, state: "The username you entered is too long."}); return; }
		if (data.password.length > 50) { socket.emit('loginResponse', {success: false, state: "The password you entered is too long."}); return; }
		
		loggedIn = true;
		console.log("Username: " + data.username + "\nPassword: " + data.password);
		////////do stuff with the database/////////
		var usernameExists = false;
		Object.keys(allPlayers).forEach(function(key)
		{
			var val = allPlayers[key][0];
			if (val.name == data.username && val.socketId != socket.id)
			{
				console.log("Username: " + data.username + " already exists!");
				socket.emit('loginResponse', {success: false, state: "That account is already logged in."});
				usernameExists = true;
				return;
			}
		});
		if (usernameExists == true) { return; }
		player.name = data.username;
		socket.emit('loginResponse', {success: true, state: "Success"});
	});
	
	socket.on('logout', function(data)
	{
		loggedIn = false;
		allPlayers[socket.id][0] = Object.create(playerConstructor);
		allPlayers[socket.id][0].socketId = socket.id;
		socket.emit('logoutResponse', {success: true, state: "Success"});
	});

	socket.on('createGame', function(data)
	{
		if (loggedIn == false) { socket.emit('createGameResponse', {success: false, state: "Failed- user is not logged in"}); return; }
		if (player.game != undefined) { socket.emit('createGameResponse', {success: false, state: "Failed- user is already in a game"}); return; }
		createGame(player);
		socket.emit('createGameResponse', {success: true, state: "Success"});
	});

	socket.on('joinGame', function(data)
	{
		if (loggedIn == false) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is not logged in"}); }
		if (player.game != undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is already in a game"}); return; }
		if (data.gameId == undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- data.gameId is undefined"}); return; }
		if (activeGames[data.gameId] == undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- Game does not exist"}); return; }
		
		addPlayerToGame(data.gameId, player);
		socket.emit('joinGameResponse', {success: true, state: "Success"});
	});

	socket.on('leaveGame', function(data)
	{
		if (loggedIn == false) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is not logged in"}); }
		if (player.game == undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is not in a game"}); return; }
		
		removePlayerFromGame(player.gameId, player.id);
		socket.emit('leaveGameResponse', {success: true, state: "Success"});
	});

	socket.on('getCreatedGames', function(data)
	{
		socket.emit('getCreatesGamesResponse', {games: getWaitingGames()});
	});

	socket.on('getPlayersInGame', function(data)
	{
		var gameId = data.gameId;
		socket.emit('getPlayersInGameResponse', {players: getPlayersInGame(gameId)});
	});

	

	//on keypress
	socket.on('keyPress', function(data) 
	{
		if (data.inputId === 'left') 
		{
			player.moveVector[2] = data.state;
		} 
		else if (data.inputId === 'right') 
		{
			player.moveVector[3] = data.state;
		} 
		else if (data.inputId === 'up') 
		{
			player.moveVector[0] = data.state;
		} 
		else if (data.inputId === 'down') 
		{
			player.moveVector[1] = data.state;
		}
	});
});

setInterval(function()
{
	var resp = {games: getWaitingGames()};
	for (i in allPlayers)
	{
		if (allPlayers[i][1] != undefined)
		{
			allPlayers[i][1].emit('getCreatesGamesResponse', {games: getWaitingGames()});
		}	
	}
}, 2000);
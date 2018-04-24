var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var PORT = process.env.PORT || 5000

var playerSpeed = 2;
var missileSpeed = 4;
var enemySpeed = 1.5;

var activeGames = [];
var allPlayers = []; /////[Player, Socket];

var radianToDegree = 180 / 3.141592;

var playerConstructor = {
	name: "Guest",
	id: "",
	socketId: -1,
	socket: undefined,
	playing: false,
	gameId: "",
	game: undefined, ////game object here
	
	lastUpdated: 0, ////update every time player sends something
	kills: 0,
	roundKills: 0,
	deaths: 0,
	health: 100,
	size: 6,
	x: -1,
	y: -1,	
	rotationX: 0,
	rotationY: 0,
	rotationDegrees: 0,
	up: false,
	down: false,
	left: false,
	right: false
}

var enemyConstructor = {
	id: "",
	size: 50,
	health: 50,
	x: -1,
	y: -1,
	rotationX: 0,
	rotationY: 0,
	rotationDegrees: 0,
	enemyType: "Normal",
	direction: "up"
}

var missileConstructor = {
	id: "",
	sentBy: undefined, ///so you can track kills
	size: 10,
	x: -1,
	y: -1,
	rotationX: 0,
	rotationY: 0,
	rotationDegrees: 0
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
	removeThings: [], ///the ids of things that were destroyed (bullets, enemies) that need to be removed
	round: 1,
	enemiesLeft: 0,
	enemyKills: 0,
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
	game.players.push(host);
	host.game = game;
	host.gameId = game.id;
	
	activeGames[game.id] = game;
	return game.id;
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
				host: game.host.name,
				numPlayers: game.players.length
			});
		}
	}
	return returnTable;
}

function startGame(game)
{
	var players = game.players;
	var prePickedPositions = [[10, 10], [35, 75], [80, 26]];
	for (var i = 0; i < 3; i++)
	{
		var base = Object.create(baseConstructor);
		base.id = generateId(6);
		base.x = prePickedPositions[i][0];
		base.y = prePickedPositions[i][1];
		game.bases.push(base);
	}
	for (var i = 0; i < players.length; i++)
	{
		players[i].health = 100;
		players[i].x = Math.floor(Math.random() * 90) + 5;
		players[i].y = Math.floor(Math.random() * 90) + 5;
	}

	game.started = true;
}

function advancePositions(game)
{
	var players = game.players;
	var enemies = game.enemies;
	var bullets = game.bullets;

	for (var i = 0; i < players.length; i++)
	{
		if (players[i].health > 0)
		{
			if (players[i].health < 100 && players[i].health > 0) { players[i].health = players[i].health + .05; }
			var player = players[i];
			var actualVector = [0, 0];
			
			if (player.up == true) { actualVector[1] = -10; }
			else if (player.down == true) { actualVector[1] = 10; }
			if (player.left == true) { actualVector[0] = -10; }
			else if (player.right == true) { actualVector[0] = 10; }
			
			//if (actualVector[0] == 0 && actualVector[1] == 0) { actualVector = [0, -1]; }
			//if (actualVector[0] != 0 && actualVector[1] != 0) { actualVector = [actualVector[0] * Math.sqrt(2), actualVector[1] * Math.sqrt(2)]; }
			
			if (player.x + actualVector[0] + player.size < 1845 && player.x + actualVector[0] > 0) { player.x = player.x + actualVector[0]; }
			if (player.y + actualVector[1] + player.size < 945 && player.y + actualVector[1] > 0) { player.y = player.y + actualVector[1]; }
			/*
			if (Math.abs(player.y) > 0 && Math.abs(player.x) > 0)
			{
				player.rotationDegrees = Math.floor(Math.atan(player.y / player.x) * radianToDegree + .01);
			}*/
			if (player.up == false && player.down == false && player.left == false && player.right == true) {
				player.rotationDegrees = 90;
			} else if (player.up == false && player.down == false && player.left == true && player.right == false) {
				player.rotationDegrees = 270;
			} else if (player.up == true && player.down == false && player.left == false && player.right == false) {
				player.rotationDegrees = 0;
			} else if (player.up == false && player.down == true && player.left == false && player.right == false) {
				player.rotationDegrees = 180;
			} else if (player.up == true && player.down == false && player.left == false && player.right == true) {
				player.rotationDegrees = 45;
			} else if (player.up == false && player.down == true && player.left == false && player.right == true) {
				player.rotationDegrees = 135;
			} else if (player.up == false && player.down == true && player.left == true && player.right == false) {
				player.rotationDegrees = 225;
			} else if (player.up == true && player.down == false && player.left == true && player.right == false) {
				player.rotationDegrees = 315;
			} 
			
		}
	}
	
	for (var i = bullets.length - 1; i > -1; i--)
	{
		var bullet = bullets[i];

		if (bullet.x > 1845 || bullet.x < 0 || bullet.y > 945 || bullet.y < 0) {
			game.removeThings.push(bullet.id);
			bullets.splice(i, 1);
		} else if (bullet.rotationDegrees == 0) {
			bullet.y -= 20;	
		} else if (bullet.rotationDegrees == 45) {
			bullet.x += 20;
			bullet.y -= 20;
		} else if (bullet.rotationDegrees == 90) {
			bullet.x += 20;
		} else if (bullet.rotationDegrees == 135) {
			bullet.x += 20;
			bullet.y += 20;
		} else if (bullet.rotationDegrees == 180) {
			bullet.y += 20;
		} else if (bullet.rotationDegrees == 225) {
			bullet.x -= 20;
			bullet.y += 20;
		} else if (bullet.rotationDegrees == 270) {
			bullet.x -= 20;
		} else if (bullet.rotationDegrees == 315) {
			bullet.x -= 20;
			bullet.y -= 20;
		}

		/*
		if (bullet.x + bullet.rotationX < 150 && bullet.x + bullet.rotationX > 0) { bullet.x = bullet.x + bullet.rotationX; }
		else //////destroy bullet, outside of bounds
		{
			game.removeThings.push(bullet.id);
			bullets.splice(i, 1);
		}
		
		if (bullet.y + bullet.rotationY < 100 && bullet.y + bullet.rotationY > 0) { bullet.y = bullet.y + bullet.rotationY; }
		else //////destroy bullet, outside of bounds
		{
			game.removeThings.push(bullet.id);
			bullets.splice(i, 1);
		}*/
	}
	
	for (var i = enemies.length - 1; i > -1; i--)
	{
		var enemy = enemies[i];

		//random num from 1 to 3
		var rand = Math.floor(Math.random() * 3 + 1);

		if (enemy.x > 1845 || enemy.x < 0 || enemy.y > 945 || enemy.y < 0) {
			game.removeThings.push(enemy.id);
			game.enemies.splice(i, 1);
		} else if (enemy.direction == "up") {
			switch(rand) {
				case 1:
					enemy.rotationDegrees = 45;
					enemy.x += 8;
					enemy.y -= 8;
					break;
				case 2:
					enemy.rotationDegrees = 0;
					enemy.y -= 8;
					break;
				case 3:
					enemy.rotationDegrees = 315;
					enemy.x -= 8;
					enemy.y -= 8;
					break;
			}
		} else if (enemy.direction == "right") {
			switch(rand) {
				case 1:
					enemy.rotationDegrees = 135;
					enemy.x += 8;
					enemy.y += 8;
					break;
				case 2:
					enemy.rotationDegrees = 90;
					enemy.x += 8;
					break;
				case 3:
					enemy.rotationDegrees = 45;
					enemy.x += 8;
					enemy.y -= 8;
					break;
			}
		} else if (enemy.direction == "down") {
			switch(rand) {
				case 1:
					enemy.rotationDegrees = 225;
					enemy.x -= 8;
					enemy.y += 8;
					break;
				case 2:
					enemy.rotationDegrees = 180;
					enemy.y += 8;
					break;
				case 3:
					enemy.rotationDegrees = 135;
					enemy.x += 8;
					enemy.y += 8;
					break;
			}
		} else if (enemy.direction == "left") {
			switch(rand) {
				case 1:
					enemy.rotationDegrees = 315;
					enemy.x -= 8;
					enemy.y -= 8;
					break;
				case 2:
					enemy.rotationDegrees = 270;
					enemy.x -= 8;
					break;
				case 3:
					enemy.rotationDegrees = 225;
					enemy.x -= 8;
					enemy.y += 8;
					break;
			}
		}
		/*
		if (enemy.x + enemy.rotationX < 150 && enemy.x + enemy.rotationX > 0) { enemy.x = enemy.x + enemy.rotationX; }
		else //////destroy bullet, outside of bounds
		{
			enemy.rotationX = enemy.rotationX * -1;
		}
		
		if (enemy.y + enemy.rotationY < 100 && enemy.y + enemy.rotationY > 0) { enemy.y = enemy.y + enemy.rotationY; }
		else //////destroy bullet, outside of bounds
		{
			enemy.rotationY = enemy.rotationY * -1;
		}
		
		if (Math.random() * 6 < 1) ///change angle slightly
		{
			enemy.rotationX = enemy.rotationX + (Math.random() / 10 - .05);
			enemy.rotationY = enemy.rotationY + (Math.random() / 10 - .05);
			var mag = Math.sqrt(Math.pow(enemy.rotationX, 2) + Math.pow(enemy.rotationY, 2));
			enemy.rotationX = enemy.rotationX / mag;
			enemy.rotationY = enemy.rotationY / mag;
			enemy.rotationDegrees = Math.floor(Math.atan(enemy.rotationY / enemy.rotationX) * radianToDegree + .01);
		}
		*/
	}
}

function fireBullet(player)
{
	if (player.health <= 0) { return; }
	var game = player.game;
	var bullets = game.bullets;
	
	var newBullet = Object.create(missileConstructor);
	newBullet.id = generateId(6);
	newBullet.sentBy = player;
	//newBullet.x = player.x + ((player.size * player.rotationX) / 2);
	//newBullet.y = player.y + ((player.size * player.rotationY) / 2);
	//newBullet.rotation = [player.rotationX * 2, player.rotationY * 2];
	//newBullet.rotationDegrees = player.rotationDegrees;
	if (player.rotationDegrees == 0) {
		newBullet.x = player.x;
		newBullet.y = player.y - 30;
		newBullet.rotationDegrees = 0;
	} else if (player.rotationDegrees == 45) {
		newBullet.x = player.x + 30;
		newBullet.y = player.y - 30;
		newBullet.rotationDegrees = 45;
	} else if (player.rotationDegrees == 90) {
		newBullet.x = player.x + 30;
		newBullet.y = player.y;
		newBullet.rotationDegrees = 90;
	} else if (player.rotationDegrees == 135) {
		newBullet.x = player.x + 30;
		newBullet.y = player.y + 30;
		newBullet.rotationDegrees = 135;
	} else if (player.rotationDegrees == 180) {
		newBullet.x = player.x;
		newBullet.y = player.y + 30;
		newBullet.rotationDegrees = 180;
	} else if (player.rotationDegrees == 225) {
		newBullet.x = player.x - 30;
		newBullet.y = player.y + 30;
		newBullet.rotationDegrees = 225;
	} else if (player.rotationDegrees == 270) {
		newBullet.x = player.x - 30;
		newBullet.y = player.y;
		newBullet.rotationDegrees = 270;
	} else if (player.rotationDegrees == 315) {
		newBullet.x = player.x - 30;
		newBullet.y = player.y - 30;
		newBullet.rotationDegrees = 315;
	}

	bullets.push(newBullet);
}

function getAllPositions(game)
{
	var players = game.players;
	var enemies = game.enemies;
	var bullets = game.bullets;
	var bases = game.bases;
	var removeThings = game.removeThings;
	
	var returnTable = [];

	for (var i = 0; i < players.length; i++)
	{
		if (players[i].health > 0)
		{
			returnTable.push({
				className: "Player", 
				id: players[i].id, 
				name: players[i].name,
				x: players[i].x, 
				y: players[i].y, 
				rotation: players[i].rotationDegrees,
				health: players[i].health,
				kills: players[i].kills
			});
		}
	}
	for (var i = 0; i < enemies.length; i++)
	{
		returnTable.push({
			className: "Enemy",
			id: enemies[i].id,
			x: enemies[i].x,
			y: enemies[i].y,
			rotation: enemies[i].rotationDegrees,
			health: enemies[i].health
		});
	}
	for (var i = 0; i < bullets.length; i++)
	{
		returnTable.push({
			className: "Bullet",
			id: bullets[i].id,
			x: bullets[i].x, 
			y: bullets[i].y,
			rotation: bullets[i].rotationDegrees
		});
	}
	for (var i = 0; i < bases.length; i++)
	{
		returnTable.push({
			className: "Base",
			id: bases[i].id,
			x: bases[i].x,
			y: bases[i].y,
			health: bases[i].health
		});
	}
	for (var i = 0; i < removeThings; i++)
	{
		returnTable.push({
			className: "Remove",
			id: removeThings[i]
		});
	}
	returnTable.push({totalKills: game.enemyKills});
	game.removeThings.splice(0, game.removeThings.length);
	return returnTable;
}

function checkBulletEnemyCollisions(game)
{
	var enemies = game.enemies;
	var bullets = game.bullets;
	for (var i = enemies.length - 1; i > -1; i--)
	{
		var enemy = enemies[i];
		for (var a = bullets.length - 1; a > -1; a--)
		{
			var bullet = bullets[a];
			if (getMagnitude(enemy, bullet) < ((enemy.size + bullet.size) / 2))
			{
				var playerWhoShot = bullet.sentBy;
				game.removeThings.push(bullet.id);
				game.bullets.splice(a, 1);
				
				enemy.health = enemy.health - 40;
				if (enemy.health <= 0)
				{
					playerWhoShot.kills++;
					game.enemyKills++;
					
					game.removeThings.push(enemy.id);
					game.enemies.splice(i, 1);
					break;
				}
			}
		}	
	}
}

function checkEnemyPlayerCollisions(game)
{
	var enemies = game.enemies;
	var players = game.players;
	for (var i = enemies.length - 1; i > -1; i--)
	{
		var enemy = enemies[i];
		for (var a = players.length - 1; a > -1; a--)
		{
			var player = players[a];
			if (player.health > 0 && getMagnitude(enemy, player) < ((enemy.size + player.size) / 2))
			{
				player.kills++;
				game.enemyKills++;
				
				game.removeThings.push(enemy.id);
				game.enemies.splice(i, 1);
				player.health = player.health - 40;
				if (player.health <= 0)
				{
					game.removeThings.push(player.id);
				}
				break;
			}
		}	
	}
}

function createEnemy(game)
{
	var enemy = Object.create(enemyConstructor);
	enemy.id = generateId(6);
	if (Math.random() < .5) ////do it on x axis
	{
		if (Math.random() < .5)///bottom x axis
		{
			enemy.x = Math.floor(Math.random() * 1840) + 5;
			enemy.y = 945;
			enemy.rotationDegrees = 0;
			enemy.direction = "up";
		}
		else
		{
			enemy.x = Math.floor(Math.random() * 1840) + 5;
			enemy.y = 1;
			enemy.rotationDegrees = 180;
			enemy.direction = "down";
		}
	}
	else
	{
		if (Math.random() < .5)///bottom y axis
		{
			enemy.x = 1;
			enemy.y = Math.floor(Math.random() * 940) + 5;
			enemy.rotationDegrees = 90;
			enemy.direction = "right";
		}
		else
		{
			enemy.x = 1845;
			enemy.y = Math.floor(Math.random() * 940) + 5;
			enemy.rotationDegrees = 270;
			enemy.direction = "left";
		}
	}

	/*
	enemy.rotation = [50 - enemy.x, 50 - enemy.y];
	var rotMag = Math.sqrt(Math.pow(enemy.rotation[0], 2) + Math.pow(enemy.rotation[1], 2));
	enemy.rotation = [enemy.rotation[0] / rotMag, enemy.rotation[1] / rotMag];
	enemy.rotationDegrees = Math.floor(Math.atan(enemy.rotation[1] / enemy.rotation[0]) * radianToDegree + .1);
	*/
	game.enemies.push(enemy);
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
	player.id = generateId(8);
	player.socket = socket;
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
			if (game.host.id == player.id)
			{
				if (game.players.length > 1)
				{
					if (game.players[0].id == player.id) { game.host = game.players[1]; }
					else { game.host = game.players[1]; }
				}
				else //close game
				{
					delete activeGames[game.id];
				}
			}
			
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
		socket.emit('loginResponse', {success: true, state: "Success", socketId: socket.id});
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

		var serverId = createGame(player);
		socket.emit('createGameResponse', {success: true, state: "Success", gameId: serverId});

	});

	socket.on('joinGame', function(data)
	{
		if (loggedIn == false) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is not logged in"}); }
		if (player.game != undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- user is already in a game"}); return; }
		if (data.gameId == undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- data.gameId is undefined"}); return; }
		if (activeGames[data.gameId] == undefined) { socket.emit('joinGameResponse', {success: false, state: "Failed- Game does not exist"}); return; }
		
		addPlayerToGame(data.gameId, player);
		socket.emit('joinGameResponse', {success: true, state: "Success", gameId: data.gameId});
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

	socket.on('startGame', function(data)
	{
		if (player.game != undefined && player.game.host.id == player.id && player.game.started == false)
		{
			var game = player.game;
			startGame(game);
			game.message = "The game is starting in 5";
			var countDown = 5;
			for (var i = 1; i < 6; i++)
			{
				setTimeout(function() { countDown--; game.message = "The game is starting in " + countDown; }, i * 1000);
			}
			setTimeout(function()
			{
				
			}, 5000);
		}
		else { socket.emit('startGameResponse', {success: false, state: "Failed- Either you are not in a game or you are not the host."}); }
	});
	
	socket.on('keyPress', function(data)
	{
		if (data.socketid == undefined || data.socketid != socket.id) { console.log(data.socketId); return; }
		var plr = undefined;
		for (var i in allPlayers)
		{
			if (allPlayers[i][0].socketId == socket.id || allPlayers[i][0].name == player.name) { plr = allPlayers[i][0]; }
		}
		if (plr == undefined) { console.log("Could not find"); return; }
		if (data.inputId === 'left') 
		{
			plr.left = data.state;
			if (data.state == true) { plr.right = false; }
		}
		else if (data.inputId === 'right')
		{
			plr.right = data.state;	
			if (data.state == true) { plr.left = false; }
		}
		else if (data.inputId === 'up')
		{
			plr.up = data.state;	
			if (data.state == true) { plr.down = false; }
		}
		else if (data.inputId === 'down')
		{
			plr.down = data.state;	
			if (data.state == true) { plr.up = false; }
		}
		else if (data.inputId === 'fire')
		{
			//plr.down = data.state;	
			if (data.state == true) { fireBullet(player);console.log("pew pew") }
		}
	});
});

setInterval(function()
{
	//var resp = {games: getWaitingGames()};
	for (i in allPlayers)
	{
		if (allPlayers[i][1] != undefined)
		{
			if (allPlayers[i][0].game != undefined && allPlayers[i][0].game.started == false) /////player is in a game
			{
				allPlayers[i][1].emit('getPlayersInGameResponse', {players: getPlayersInGame(allPlayers[i][0].gameId)});
			}
			else
			{
				allPlayers[i][1].emit('getCreatedGamesResponse', {games: getWaitingGames()});
			}
		}	
	}
}, 2000);

setInterval(function()
{
	for (var i in activeGames)
	{
		var game = activeGames[i];
		if (game.started == true)
		{
			advancePositions(game);
			checkBulletEnemyCollisions(game);
			checkEnemyPlayerCollisions(game);
			
			if (game.enemies.length < Math.floor(game.players.length * 4) + 1)
			{
				createEnemy(game);
			}
			
			var positions = getAllPositions(game);
			for (var a = 0; a < game.players.length; a++)
			{
				game.players[a].socket.emit('positionUpdate', {objectPositions: positions});
			}
		}	
	}
}, 50);

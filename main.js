const request = require('request');

const playerConstructor = {
	name: "",
	id: -1,
	playing: false,
	gameId: -1,
	game: undefined, ////game object here
	lastUpdated = 0, ////update every time player sends a request
	kills: 0,
	roundKills: 0,
	deaths: 0,
	size: 4,
	x: -1,
	y: -1,
	rotation: [x: 0, y: 1]
}

const enemyConstructor = {
	size: 4,
	health: 50,
	x: -1,
	y: -1,
	rotation: [x: 0, y: 1]
	enemyType: "Normal"
}

const missileConstructor = {
	sentBy: undefined, ///so you can track kills
	size: 1,
	x: -1,
	y: -1,
	rotation: [x: 0, y: 1]
}

const baseConstructor = {
	size: 10,
	health: 100,
	x: -1,
	y: -1
}

const gameConstructor = {
	id: -1,
	players: [],
	enemies: [],
	bases: [],
	bullets: [],
	deadEnemies: [], ////to show explosions or whatever effect for the missile hitting the enemy
	round: 1,
	enemiesLeft: 0
}



function getMagnitude(uno, dos)
{
	return Math.sqrt(Math.pow(uno.x - dos.x), 2) + Math.pow(uno.y - dos.y), 2));
}

function checkForBulletHits(game)
{
	var enemies = game.enemies;
	var bullets = game.bullets;
	for (var i = 0; i < bullets.length; i++)
	{
		for (var a = 0; a < enemies.length; a++)
		{
			if (getMagnitude(bullets[i], enemies[a]) < (bullets[i].size / 2 + enemies[a].size / 2))
			{
				var player = bullets[i].sentBy;
				player.roundKills = player.roundKills + 1;
				player.kills = player.kills + 1;
				
				game.deadEnemies.push(enemies[a]);
				enemies.splice(a, 1);
				bullets.splice(i, 1);
				i--;
				break;
			}
		}
	}
}

function checkForEnemyHitBase(game)
{
	var bases = game.bases;
	var enemies = game.enemies;
	for (var i = 0; i < bases.length; i++)
	{
		if (bases[i].health > 0)
		{
			for (var a = 0; a < enemies.length; a++)
			{
				if (getMagnitude(bases[i], enemies[a]) < (bases[i].size / 2 + enemies[a].size / 2))
				{
					enemies.splice(a, 1);
					bases[i].health = bases[i].health - 40; //////-40% per hit, maybe base heals?
					if (bases[i].health <= 0) { bases[i].health = 0; break; }
				}
			}
		}
	}
	
	var allDead = true;
	for (var i = 0; i < bases.length; i++)
	{
		if (bases[i].health > 0) { allDead = false; break; }
	}
	if (allDead == true) ///all bases are destroyed, game over
	{
		
	}
}

function checkForEnemyPlayerCollision(game)
{
	var players = game.players;
	var enemies = game.enemies;
	for (var i = 0; i < players.length; i++)
	{
		if (players[i].health > 0 && players[i].playing == true)
		{
			for (var a = 0; a < enemies.length; a++)
			{
				if (getMagnitude(players[i], enemies[a]) < (players[i].size / 2 + enemies[a].size / 2))
				{
					enemies.splice(a, 1);
					players[i].health = players[i].health - 40; //////-40% per hit, maybe base heals?
					if (players[i].health <= 0) { players[i].health = 0; break; }
				}
			}
		}
	}
}

function fireBullet(player)
{
	var bullets = player.game.bullets;
	var bullet = Object.create(missileConstructor);
	bullet.sentBy = player;
	
	var mag = Math.sqrt(Math.pow(player.rotation.x, 2) + Math.pow(player.rotation.y, 2));
	var newX = player.rotation.x / mag; ///normalize so bullet faces correct way
	var newY = player.rotation.y / mag;
	bullet.rotation = [newX, newY];
	
	var posX = player.x + (newX * player.size / 2);
	var posY = player.y + (newY * player.size / 2);
	bullet.x = posX;
	bullet.y = posY;

	bullets.push(bullet);
}

function addPlayer(game, playerStuff)
{
	var players = game.players;
	var enemies = game.enemies;
	var player = Object.create(playerConstructor);
	
	player.name = playerStuff.name;
	player.id = playerStuff.id;
	player.playing = true;
	player.gameId = game.id;
	player.game = game;
	player.kills = playerStuff.kills;
	player.roundKills = 0;
	player.deaths = 0;
	player.rotation = [0, 1];
	
	while (true)
	{
		var xPos = Math.floor(Math.random() * (100 - player.size / 2)) + player.size / 2;
		var yPos = Math.floor(Math.random() * (100 - player.size / 2)) + player.size / 2;
		player.x = xPos;
		player.y = yPos;
		
		var canSpawn = true;
		for (var i = 0; i < enemies.length; i++)
		{
			if (getMagnitude(enemies[i], player) < (enemies[i].size + player.size))
			{
				canSpawn = false;
			}
		}
		if (canSpawn == true) { break; }
	}

	players.add(player);
}


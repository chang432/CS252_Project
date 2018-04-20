var socket = io();

		//BEGGINING STUFF
		function login() {
			console.log("Logging in...");
			document.getElementById("lobby_div").style.display = "block";
			document.getElementById("init_div").style.display = "none";
		}

		function signOut() {
			document.getElementById("init_div").style.display = "block";
			document.getElementById("lobby_div").style.display = "none";
		}

		//GAME STUFF
		/*
		var ctx = document.getElementById("ctx").
		getContext("2d");
		ctx.font = '30px Arial';
		socket.on('newPosition', function(data){
			//console.log("The new x position is " + data.x);
			//console.log("\nThe new y position is " + data.y);
			ctx.clearRect(0,0,500,500);
			for (var i = 0;i<data.length;i++) {
				ctx.fillText(data[i].number,data[i].x,data[i].y);
			}
		})

		//when key is pressed send signal to server
		document.onkeydown = function(event) {
			if (event.keyCode === 68) { 
				//d
				socket.emit('keyPress', {inputId:'right',state:true});
			} else if (event.keyCode === 83) {
				//s
				socket.emit('keyPress', {inputId:'down',state:true});
			} else if (event.keyCode === 65) {
				//a
				socket.emit('keyPress', {inputId:'left',state:true});
			} else if (event.keyCode === 87) {
				//w
				socket.emit('keyPress', {inputId:'up',state:true});
			}
		}

		//when key is released send signal to server
		document.onkeyup = function(event) {
			if (event.keyCode === 68) { 
				//d
				socket.emit('keyPress', {inputId:'right',state:false});
			} else if (event.keyCode === 83) {
				//s
				socket.emit('keyPress', {inputId:'down',state:false});
			} else if (event.keyCode === 65) {
				//a
				socket.emit('keyPress', {inputId:'left',state:false});
			} else if (event.keyCode === 87) {
				//w
				socket.emit('keyPress', {inputId:'up',state:false});
			}
		}*/
var express = require('express')
var app = express();
var PORT = process.env.PORT || 5000

app.get("/", function(req, res) {
	//res.send("I HATE MY LIFE");
	res.sendFile(__dirname + '/client/index.html');
});

app.listen(PORT);
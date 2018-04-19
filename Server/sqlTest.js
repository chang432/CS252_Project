var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "Guest",
  password: "hippo1336"
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});
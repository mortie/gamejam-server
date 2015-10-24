let SockSugar = require("socksugar");
let Game = require("./js/game");
let log = require("mlogger");
let fs = require("fs");

let conf = JSON.parse(fs.readFileSync("conf.json", "utf8"));

let server = new SockSugar({
	port: conf.port
});

let game = new Game();
game.start();

server.on("connection", (sock) => {
	game.newPlayer(sock);
	log.info("New connection!");
});

log.info("Server started on port "+conf.port+".");
log.info("PID: "+process.pid);

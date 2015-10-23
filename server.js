var SockSugar = require("socksugar");

var server = new SockSugar({
	port: 8081
});

server.on("connection", (socket) => {
	console.log("Connection");

	socket.on("request", (req) => {
		console.log("request for "+req.url);

		req.reply({
			msg: "hi."
		});
	});
});

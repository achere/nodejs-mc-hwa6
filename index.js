const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const cluster = require('cluster');
const os = require('os');

//Read the certificates
const httpsServerOptions = {
	'key' : fs.readFileSync('./cert/key.pem'),
	'cert' : fs.readFileSync('./cert/cert.pem')
};

//Instantiate servers
const httpsServer = https.createServer(httpsServerOptions, (req, res) => {
	unifiedServer(req, res);
});

const httpServer = http.createServer((req, res) => {
  unifiedServer(req, res);
});

//Create a unified function used to serve content
const unifiedServer = (req, res) => {
	const parsedUrl = url.parse(req.url, true);
	const path = parsedUrl.pathname;
	const trimmedPath = path.replace(/^\/+|\/+$/g, '');
	const method = req.method.toLowerCase();
	const query = parsedUrl.query;
	const headers = JSON.stringify(req.headers);
	const decoder = new StringDecoder('utf-8');
	let buffer = '';
	req.on('data', (data) => {
		buffer += decoder.write(data);
	});
	req.on('end', () => {
		buffer +=decoder.end();
		const chosenHandler = typeof router[trimmedPath] !== 'undefined' ?
			router[trimmedPath] : handlers.notFound;
		const data = {
			'trimmedPath' : trimmedPath,
			'queryStringObject' : query,
			'method' : method,
			'headers' : headers,
			'payload' : buffer
		};
		chosenHandler(data, (statusCode=200, payload={}) => {
			const payloadString = JSON.stringify(payload);
			res.setHeader('Content-Type', 'application/json');
			res.writeHead(statusCode);
			res.end(payloadString);
			console.log(statusCode, payloadString);
		});
	});
};

//Create a container for handlers
const handlers = {};

//Handlers themselves
handlers.ping = (data, callback) => {
	callback(200);
};

handlers.hello = (data, callback) => {
	callback(200, {'msg' : 'Welcome to this site!'})
};

handlers.notFound = (data, callback) => {
	callback(404);
};

//A route to determine which handler to use
const router = {
	'ping' : handlers.ping,
	'hello' : handlers.hello
};

//Logic to branch out to utilize all the CPU cores
if (cluster.isMaster) {
  let i;
  for (i = 0; i < os.cpus().length; i++) {
    cluster.fork();
  }
} else {
  //Spawn listeners on all the cores
  httpsServer.listen(config.httpsPort, err => {
    if (err) {
      return console.error(err);
    }
    console.log('\x1b[36m%s\x1b[0m', `Listineing on port ${config.httpsPort}`);
  });
  httpServer.listen(config.httpPort, err => {
    if (err) {
      return console.error(err);
    }
    console.log('\x1b[35m%s\x1b[0m', `Listineing on port ${config.httpPort}`);
  });
};
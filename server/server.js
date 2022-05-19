var WebSocketServer = require('ws').Server

const wss = new WebSocketServer({
  port: 8989,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024 // Size (in bytes) below which messages
    // should not be compressed if context takeover is disabled.
  }
});

let timer;
let itemsOnScanner = false;
let wsInstance;
const sleepBeforeToggling = 1000;
const interval = 7000;

const checkedoutStatuses = [
  'Activated',
  'Deactivated'
];

function sendMessage(jsonData) {
  const stringData = JSON.stringify(jsonData);
  console.info("TX: " + stringData);
  wsInstance.send(stringData);
}

const toggleItemsOnScanner = () => {
  if (!itemsOnScanner) {
    sendMessage({"cmd":"tag","id":"1234567890","type":"Item","reason":"Firsttime new complete","reader":"1"});
    sendMessage({"cmd":"tag","id":"3333333333","type":"Item","reason":"Firsttime new complete","reader":"1"});
    sendMessage({"cmd":"tag","id":"7777777777","type":"Item","reason":"Firsttime new complete","reader":"1"});
    itemsOnScanner = true;
  } else {
    sendMessage({"cmd":"tag", "reason": "Reader empty"});
    itemsOnScanner = false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

wss.on('connection', function connection(ws) {
  wsInstance = ws;
  ws.on('message', function message(data) {
    console.log('RX: %s', data);
    const message = JSON.parse(data);
    switch (message.cmd) {
      case 'value':
        switch (message.fields) {
          case "checkedout":
            const randomStatus = checkedoutStatuses[Math.floor(Math.random() * checkedoutStatuses.length)];
            sendMessage({"cmd":"value","id":message.id,"index":"","fields":{"checkedout":randomStatus}});
            break;
          default:
            console.error("Unknown fields value: " + message.fields);
        }
        break;
      default:
        console.error("Unknown command: " + message.cmd);
        break;
    }
  });

  console.info("LOG: client connected, sending readerStatus");
  sendMessage({"cmd": "readerStatus", "status": "online"});

  console.info(`LOG: In ${sleepBeforeToggling}ms - starting to send/remove items each ${interval}ms.`);
  sleep(sleepBeforeToggling).then(function() {
    timer = setInterval(toggleItemsOnScanner, interval);
  });
  ws.on('close', () => {
    console.info("LOG: client disconnected");
    clearInterval(timer)
  });
});
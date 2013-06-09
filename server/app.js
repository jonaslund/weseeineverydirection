/*
 * In Every Direction Server
 * (cl) Jonas Lund, 2013
 */

var express = require('express'),
    http = require("http"),
    path = require('path'),
    pool = require("./lib/db"),
    common = require("./lib/common"),
    app = express(),
    server = http.createServer(app),
    io = require('socket.io').listen(1338);    

app.configure('development', function(){  
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');  
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, 'public')));    
  app.set('port', 4000);  
});

app.configure('production', function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('port', 4000);
});

io.configure("development", function() { 
  io.set('log level', 2);
});

io.configure('production', function(){
  io.enable('browser client minification');
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.set('log level', 1);
  io.set('transports', [
      'websocket',
      'flashsocket',
      'htmlfile',
      'xhr-polling',
      'jsonp-polling'
  ]);
});

var users = 0, currentURL = "", prevURL = "", rooms = [];

app.get("/", function(req, res) {
  var ua = req.headers['user-agent'],
      os = {};

  if (/mobile/i.test(ua))
      os.Mobile = true;

  if (/like Mac OS X/.test(ua)) {
      os.iOS = /CPU( iPhone)? OS ([0-9\._]+) like Mac OS X/.exec(ua)[2].replace(/_/g, '.');
      os.iPhone = /iPhone/.test(ua);
      os.iPad = /iPad/.test(ua);
  }

  if (/Android/.test(ua))
      os.Android = /Android ([0-9\.]+)[\);]/.exec(ua)[1];

  if (/webOS\//.test(ua))
      os.webOS = /webOS\/([0-9\.]+)[\);]/.exec(ua)[1];

  if (/(Intel|PPC) Mac OS X/.test(ua))
      os.Mac = /(Intel|PPC) Mac OS X ?([0-9\._]*)[\)\;]/.exec(ua)[2].replace(/_/g, '.') || true;

  if (/Windows NT/.test(ua))
      os.Windows = /Windows NT ([0-9\._]+)[\);]/.exec(ua)[1];
    
  pool.query("SELECT * FROM urls ORDER BY id DESC LIMIT 20", [], function(results) {
    res.render("home", {
      res: results,
      type: os
    });    
  });
});

//master message
app.post("/sendMessage", function(req, res) {
  var message = req.body.message;
  var key = req.body.key;

  if(key === "key") {
    io.sockets.emit('masterMessage', {message: message});
    res.json("success");
  } else {
    res.json("invalid key");
  }  
});

io.sockets.on('connection', function (socket) {  
  users++;

  //join room
  getFreeRoom(socket.id, function(room) {
    socket.join(room);
    socket["weseeroom"] = room;
  
    //init send URL from the correct room
    pool.query("SELECT * FROM urls WHERE room = ? ORDER BY id DESC LIMIT 1", [parseInt(room.replace("room", ""), 10)], function(res) { 
      if(res) {
        var url = res[0].url;
        currentURL = url;
        socket.emit("sendURL", {url: url});        
      } else {

        //default url when alone in a room
        socket.emit("sendURL", {url: "http://ineverydirection.net"});
      }
    });
  
  });

  //set users id
  socket.emit("setID", {id: socket.id});  
  io.sockets.in(socket["weseeroom"]).emit('updateUsers', {users: rooms[parseInt(socket["weseeroom"].replace("room", ""))].length});

  //handle url
  socket.on("currentURL", function(data) {     
    var address = socket.handshake.address.address;    
        url = data.url,
        date = new Date(),
        roomint = parseInt(socket["weseeroom"].replace("room", ""), 10);
        
        //fixing constant dullaart's death of the url  
        if(!(url.match(/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.x/g))) {
    
          pool.query("SELECT * FROM urls WHERE room = ? ORDER BY id DESC LIMIT 2", [roomint], function(res) { 
            
            if(res) {
              if(res[0].url !== url && res[1].url !== url) {

                pool.query("INSERT INTO urls SET url=?, date=?, ip=?, room=?", [url, date, address, roomint], function(res) { 

                  currentURL = url;
                  socket.broadcast.to(socket["weseeroom"]).emit("sendURL", {url: url});    
                  
                });
              }

            } else {
              pool.query("INSERT INTO urls SET url=?, date=?, ip=?, room=?", [url, date, address, roomint], function(res) { 
                socket.broadcast.to(socket["weseeroom"]).emit("sendURL", {url: url});  
              });            
            }
          });
    
        }

  });

  socket.on("sendingcursor", function(data) {    
    socket.broadcast.to(socket["weseeroom"]).emit("cursor", {id: data.id, type: data.type, x: data.x, y: data.y});
  });

  socket.on("sendingScroll", function(data) {
    socket.broadcast.to(socket["weseeroom"]).emit("scrollTop", {scrolltop: data.scrolltop});    
  });

  socket.on("text", function(data) {
    socket.broadcast.to(socket["weseeroom"]).emit("sendText", {id: data.id, content: data.content});
  });

  socket.on("disconnect", function() {
    console.log("user disconnected...");
    
    users--;
    var roomint = parseInt(socket["weseeroom"].replace("room", ""), 10);

    //remove cursor...
    io.sockets.in(socket["weseeroom"]).emit('updateUsers', {users: rooms[roomint].length});
    io.sockets.in(socket["weseeroom"]).emit('removeCursor', {id: socket.id});

    //remove user from room array
    rooms[roomint].pop(socket.id);
    console.log(rooms);

  });
});

//find empty spot in room arry
function getFreeRoom(socket, callback) {
  if(rooms.length > 0) {
    (function p(i) {
      if(i < rooms.length) {
        
        //10 people per room
        if(rooms[i].length < 100) {
          rooms[i].push(socket);
          callback("room"+ i);
        } else {      
          p(i+1);
        }  
      } else {
        rooms.push([socket]);
        callback("room" + i);
      }

    })(0);

  } else {
    rooms.push([socket]);
    callback("room0");
  }
}

//start & listen, listen, listen, listen | shit girls say
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port') + " in " + app.get('env'));
});
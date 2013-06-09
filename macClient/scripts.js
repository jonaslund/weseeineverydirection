  var sockethost = 'ineverydirection.net:443';
  var socket = io.connect(sockethost);
  var relurl = "", incurl = "", scrolltop = "", id = "", x = "", y = "", dontscroll = 0, cursorType = 1, checkConn = "";

  //connection status
  var checkConn = setTimeout(function() {
    $("#status").text("There seems to be a problem with your connection, please restart or go to ineverydirection.net to debug");
  }, 15000);

  window.require = function() {return 0;};

  socket.on('connect', function() {   
    clearTimeout(checkConn);

    $("#status").text("Connected");
    
    setTimeout(function() {
      $("#status").text("Loading URL...");
    });

    setTimeout(function() {
      $("#loading").fadeOut();      
      $("#loadicn").hide();
    }, 5000);

  });

  socket.on("setID", function(data) {
    id = data.id;
  });

  $(document).bind("mousemove", throttle(function(cursor) {
    x = cursor.clientX;
    y = cursor.clientY;

    socket.emit("sendingcursor", {
      id: id,
      type: cursorType,
      x: x, 
      y:y
    });       

  }, 50));


  $('#urlbar').keydown(function (e) {      
    if(e.keyCode == 13) {
      $("#loadicn").show();           
      var typedurl = validateUrl($("#urlbar").val());                 
      process.mainModule.exports.checkResponse(typedurl, function(header) {

       if(header === 1) {
        $("#iframe").attr("src", typedurl);  
        socket.emit("currentURL", {url: typedurl});
        //updateLinks($("#iframe")[0].contentWindow.document);
       } else {
        $("#iframe").attr("src", "404.html");
       }

      });
    }
  });


  $("#iframe").load(function() {
    $("#loading").fadeOut();      
    $("#loadicn").hide();

    var iframeContents = $("#iframe").contents();
    iframeContents.find("body").bind("mousemove", throttle(function(cursor) {

      x = cursor.clientX;
      y = cursor.clientY;

      socket.emit("sendingcursor", {
        id: id,
        type: cursorType, 
        x: x, 
        y:y+39
      });       

    }, 50));

    //scrolling
    $(iframeContents.get(0)).scroll(throttle_two(function(){
      if(dontscroll === 0) {
        socket.emit("sendingScroll", {
          scrolltop: iframeContents.scrollTop()
        });
      }
    }, 100));

    //set attr targets to self
    $(iframeContents).find("a").attr("target", "_self");
    
    $("#urlbar").bind("keydown", function(e) {
      var content = $("#urlbar").val();
      socket.emit("text", {id: "urlbar", content:content});
    });

    $(iframeContents).find("input[type=text], textarea").bind("keydown", function() {
      var textInput = $(this);
      if(textInput.id) {
        socket.emit("text", {id: textInput.id, content: $(textInput).val()});
      } else {
        socket.emit("text", {id: "none", content: $(textInput).val()});
      }
    });

    //keyboard shortcuts
    $(iframeContents).find("body").bind('keydown', 'ctrl+l', function() { 
      cmdL();
    });
    $(iframeContents).find("body").bind('keydown', 'command+l', function() { 
      cmdL();
    });

    var loadurl = validateUrl($("#iframe")[0].contentWindow.location.href);          
      
    if(loadurl !== "") {
      if(incurl !== loadurl) {
        socket.emit("currentURL", {url: loadurl});  
      }

      $("#urlbar").val(loadurl);
    }

    if(loadurl !== $("#urlbar").val()) {                
      if(loadurl.match(/404.html/)) {
        $("#urlbar").val("");
      } 
    }

  });

  setInterval(function() {
    $("#iframe").contents().find("a").attr("target", "_self");
  }, 1000);

  //incoming url
  socket.on("sendURL", function(data) {              
    $("#loadicn").show();          
    var incurl = data.url;
    $("#iframe").attr("src", incurl);  
    $("#urlbar").val(incurl);
  });      

  socket.on("updateUsers", function(data) {
    $("#count").text(data.users);
  });

  socket.on("cursor", function(data) {
    var cursorID = data.id,
        ctype = data.type, csrc = "",
        posx = data.x,
        posy = data.y;

    var cursor = $("#cursor" + cursorID);

    if(cursor.size() > 0) {
      cursor.css({
        left: posx, 
        top: posy
      });

    } else {

      if(ctype === 2) {
        csrc = "cursor_win.png";
      } else {
        csrc = "cursor.png";
      }

      var newcursor = "<img src='"+csrc+"' id='cursor"+cursorID+"' class='cursor' />";
      $(newcursor).appendTo($("#cursors"));
    }
  });

  socket.on("removeCursor", function(data) {
    $("#cursor" + data.id).remove();
  });    

  socket.on("scrollTop", function(data) {
    if(dontscroll === 0) {
      dontscroll = 1;
      $("#iframe").contents().scrollTop(data.scrolltop);

      setTimeout(function(){
        dontscroll = 0;
      }, 100);
    }
    
  });

  socket.on("sendText", function(data) {
    var id = data.id;

    if(id == "urlbar" && data.content !== $("#urlbar").val() && data.content !== "") {
      $("#urlbar").val(data.content);
    
    } else if (id !== "urlbar" && data.content !== "" && id !== "") {
      var textField = [];

      if(id === "none") {
        textField = $("#iframe").contents().find("input[type=text]:first");
      } else {
        textField = $("#iframe").contents().find("#"+id);
      }

      if(textField.length > 0) {
        $(textField).val(data.content);
      }
    }
  });

  socket.on("masterMessage", function(data) {
    var message = data.message;
    $("#messagecontent").html(message);
    $("#message").fadeIn(400);    
  });

  $("#closemessage").click(function() {
    $("#message").fadeOut(400); 
    return false;
  });
  
  function validateUrl(url) {
    if(url.indexOf(' ') >= 0) {
      return "http://www.google.com/#output=search&sclient=psy-ab&q="+encodeURIComponent(url)+"&oq="+encodeURIComponent(url);
    }

    if(url.substr(0,7) !== "http://" && url.substr(0,8) !== "https://") {
      url = "http://" + url;
    }

    if(url.match(/file:/) || url.match(/data:/) || url.match(/blob:file/)) {
      return "";
    }

    return url;
  }

  //insert into document
  $(document).bind('keydown', 'ctrl+l', function() {
    cmdL();
  });
  $(document).bind('keydown', 'cmd+l', function() {
    cmdL();
  });

  function cmdL() {
    $("#urlbar").focus().select();
  }

  function updateLinks(document) {
    if(document !== undefined) {

      if(document.getElementById("fixingAhrefsSuperID")) {
      } else {
        var script= document.createElement('script');
        var head = document.getElementsByTagName("head")[0];
        script.type= 'text/javascript';
        script.id = "fixingAhrefsSuperID";
        script.innerHTML = "window.alert = function() {};var a = document.getElementsByTagName('a');for (var i = 0; i < a.length; i++) {a[i].target='_self';};";
        head.appendChild(script);
      }
    }
  }

  function GUID() {
    var now = new Date();
    var d = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    return d;    
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  function throttle(fn, threshhold, scope) {
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
      var context = scope || this;

      var now = +new Date,
          args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
  }

  function throttle_two(fn, threshhold, scope) {
    threshhold || (threshhold = 250);
    var last,
        deferTimer;
    return function () {
      var context = scope || this;

      var now = +new Date,
          args = arguments;
      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
  }
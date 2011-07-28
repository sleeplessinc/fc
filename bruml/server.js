var express = require('express');
var fs = require('fs');
var app = express.createServer();
var io = require('socket.io').listen(app);

app.configure(function() {
  app.use(express.static(__dirname+'/static'));
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});


var posts = {};

app.listen('8080');

io.sockets.on('connection', function(socket) {
  socket.on('lectureID', function(id) {
    socket.set('lectureID', id);
    if (!posts[id]) {
      posts[id] = [];
    }
    socket.json.send({posts: posts[id]});
  })
  socket.on('post', function(post) {
    socket.get('lectureID', function(err, id) {
      post.postid = posts[id].length + 1;
      post.meetingid = id;
      console.log("POST " + post.postid + " received from client: " + socket.id);
      posts[id].push(post);
      console.log("Now have " + posts[id].length + " posts in all");
      io.sockets.emit('post', post);
    });
  });

  socket.on('vote', function(vote) {
    socket.get('lectureID', function(err, id) {
      _posts = posts[id].map(function(post) {
        if(post.postid == vote.postid) {
          switch (vote.direction) {
            case 'up': 
              post.posvotes++;
              break;
            case 'down':
              post.negvotes++;
              break;
          }
        }
        return post;
      });
      posts[id] = _posts;
      io.sockets.emit('vote', vote);
    })
  })
});

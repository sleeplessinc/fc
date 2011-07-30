var express = require('express');
var fs = require('fs');
var app = express.createServer();
var io = require('socket.io').listen(app);

app.configure(function() {
  app.use(express.static(__dirname+'/static'));
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

var clients = {};

var posts = {};

app.listen('8080');

io.sockets.on('connection', function(socket) {
  /*
  socket.on('lectureID', function(id) {
    console.log('lectureID', id)
    socket.set('lectureID', id);
    if (!posts[id]) {
      posts[id] = [];
    }
    socket.json.send({posts: posts[id]});
  })
  */
  socket.on('subscribe', function(lecture) {
    var id = socket.id;
    clients[id] = {
      socket: socket,
      lecture: lecture
    }
    if (!posts[lecture]) {
      posts[lecture] = [];
    }
    socket.json.send({posts: posts[lecture]});
  })
  socket.on('post', function(post, id) {
    if (!posts[id]) posts[id] = [];
    post.postid = posts[id].length + 1;
    post.meetingid = id;
    post.comments = [];
    posts[id].push(post);
    publish({post: post}, id);
    //io.sockets.emit('post', post, id);
  });

  socket.on('vote', function(vote, id) {
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
    publish({vote: vote}, id);
    //io.sockets.emit('vote', vote, id);
  })

  socket.on('comment', function(comment, id) {
    _posts = posts[id].map(function(post) {
      if(post.postid == comment.postid) {
        if (!post.comments) {
          post.comments = [];
        }
        post.comments.push(comment);
      }
      return post;
    });
    posts[id] = _posts;
    publish({comment: comment}, id);
  })
  
  socket.on('disconnect', function() {
    delete clients[socket.id];
  })
});

function publish(data, lecture) {
  Object.getOwnPropertyNames(clients).forEach(function(id) {
    if (clients[id].lecture === lecture) {
      clients[id].socket.json.send(data)
    }
  })
}

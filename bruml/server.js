var express  = require('express');
var fs       = require('fs');
var app      = express.createServer();
var io       = require('socket.io').listen(app);
var mongoose = require('../db.js').mongoose;

app.configure(function() {
  app.use(express.static(__dirname+'/static'));
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
  app.set('dbUri', 'mongodb://localhost/fc');
});

mongoose.connect(app.set('dbUri'));
mongoose.connection.db.serverConfig.connection.autoReconnect = true;

var Comment = mongoose.model('Comment');

var clients = {};

var comments = {};

app.listen('8080');

io.sockets.on('connection', function(socket) {
  socket.on('subscribe', function(lecture) {
    var id = socket.id;
    clients[id] = {
      socket: socket,
      lecture: lecture
    }
    Comment.find({'lecture': lecture}, function(err, res) {
      console.log(res)
      comments[lecture] = res ? res : [];
      socket.json.send({comments: res});
    })
  })
  socket.on('comment', function(res) {
    var comment = new Comment;
    var _comment = res.comment;
    var lecture = res.lecture;
    console.log(comment, _comment, lecture)
    comment.lecture = lecture;
    comment.userName = _comment.userName;
    comment.userAffil = _comment.userAffil;
    comment.date = new Date();
    comment.body = _comment.body;
    comment.votes = 0;
    comment.save(function(err) {
      if (err) {
        // XXX some error handling
        console.log(err)
      } else {
        comments[lecture].push(comment);
        publish({comment: comment}, lecture);
      }
    })
  });

  socket.on('vote', function(res) {
    var vote = res.vote;
    var lecture = res.lecture;
    comments[lecture] = comments[lecture].map(function(comment) {
      if(comment._id == vote.parentid) {
        comment.votes++;
        comment.save(function(err) {
          if (err) {
            // XXX error handling
          } else {
            publish({vote: vote}, lecture);
          }
        })
      }
      return comment;
    });
  })

  socket.on('reply', function(res) {
    console.log(comments)
    var reply = res.reply;
    var lecture = res.lecture;
    comments[lecture] = comments[lecture].map(function(comment) {
      if(comment._id == reply.parentid) {
        comment.replies.push(reply);
        comment.save(function(err) {
          if (err) {
            console.log(err)
          } else {
            publish({reply: reply}, lecture);
          }
        })
      }
      return comment;
    });
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

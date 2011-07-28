var express = require('express')
var app = express.createServer();
var io = require('socket.io').listen(app);

app.configure(function() {
  app.use(express.static(__dirname+'/static'));
  app.use(express.errorHandler({dumpExceptions: true, showStack: true}));
});

var GLOBALS = { "meetingID": "888", "nextPostID": 1, "username": "notyetset" };

var dummyPosts = [ { 
  objtype: "post",
  meetingid: GLOBALS["meetingID"],
  userid: 12345,
  username: "Bill Jones",
  useraffil: "student",
  postid: getNextUniquePostID(),
  body: "This is dummy post one: 1111111.",
  posvotes: 1,
  negvotes: 1,
  isdeleted: false,
  ispromoted: false,
  isdemoted: false,
  created: (new Date).getTime() 
}, {
  objtype: "post",
  meetingid: GLOBALS["meetingID"],
  userid: 12345,
  username: "George Smith",
  useraffil: "student",
  postid: getNextUniquePostID(),
  body: "This is dummy post two: 2222222.",
  posvotes: 5,
  negvotes: 2,
  isdeleted: false,
  ispromoted: false,
  isdemoted: false,
  created: (new Date).getTime() + 10000
} ];

var posts = dummyPosts;

function getNextUniquePostID() {
  var nextID = GLOBALS["nextPostID"];
  GLOBALS["nextPostID"] += 1;
  return GLOBALS["meetingID"] + "-" + nextID;
}

app.listen('8080');

io.sockets.on('connection', function(socket) {
  socket.json.send({posts: posts});

  socket.on('post', function(post) {
    post.postid = getNextUniquePostID();
    console.log("POST " + post.postid + " received from client: " + socket.id);
    posts.push(post);
    console.log("Now have " + posts.length + " posts in all");
    io.sockets.emit('post', post);
  });

  socket.on('vote', function(vote) {
    console.log("VOTE received from client: " + socket.id);
    console.log(vote);
    posts = posts.map(function(post) {
      if(post.postid === vote.postid) {
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
    io.sockets.emit('vote', vote);
  })
});

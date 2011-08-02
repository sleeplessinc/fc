var MAXPOSTS = 10;
var posts = [];
var sortedBy = 'votes';
var socket;
// note that this array applies only to this browser session!
//  ==> could vote twice on same post during different sessions.
// use local storage??
var postsVoted = [];
var userObj = { userID: null, userName: null, userAffil: null };
var loggedIn = false;
// the Post object is modelled on EtherPad:
//  [the schoolid and courseid are implied in the meetingid];
function assembleNewPostObj(msgBody) {
  // the postid is assigned at the server;
  var postObj = {};
  postObj.userid    = userObj.userID;
  postObj.username  = userObj.userName;
  postObj.useraffil = userObj.userAffil;
  postObj.body = msgBody;
  return postObj;
}
function renderPosts(fresh) {
  //$('#posts .postContainer').remove();
  //$('#total_posts').text(posts.length);
  // truncate long array of Posts;
  var sortedPosts = sortedBy == 'created' ? posts.sort(createdDesc) : posts.sort(votesDesc);
  var displayPosts = sortedPosts.slice(0, MAXPOSTS - 1);
  if (fresh) $("#postTemplate").tmpl(displayPosts).appendTo("#posts");
  else $('#posts').reOrder(displayPosts, 'post-')
  $('#posts .postVoteContainer').each(function(idx, container) {
    var postid = $(container).attr("data-postid");
    renderComments(postid)
    if (postsVoted.indexOf(postid) != -1) {
      //console.log("For " + postid + ": voted");
    } else {
      //console.log("For " + postid + ": NOT voted");
      $(container).addClass("unvoted");
    }
  });    
}

function renderComments(id) {
  var replies = [];
  $.each(posts, function(i, post) {
    if (post._id == id) {
      replies = post.replies;
      if (replies.length >= 1) {
        $('#post-'+id+' .commentContainer').empty();
        $('#post-'+id+' .commentAmt').text(replies.length);
        $('#commentTemplate').tmpl(replies).appendTo('#post-'+id+' .commentContainer');
        //console.log(loggedIn)
      }
    }
  })
  if (loggedIn) {
    $('.commentForm [type=submit]').removeAttr('disabled');
    $('.commentForm textarea').removeAttr('disabled');
  }
}

$.fn.reOrder = function(array, prefix) {
  return this.each(function() {
    prefix = prefix || "";
    
    if (array) {    
      for(var i=0; i < array.length; i++) {
        var sel = '#' + prefix + array[i]._id;
        array[i] = $(sel);
      }
      $(this).find('.postContainer').remove();  
    
      for(var i=0; i < array.length; i++) {
        $(this).append(array[i]);
      }
    }
  });    
}

function assembleVoteObj(postid, upOrDown) {
  return { "parentid": postid, "direction": upOrDown };
}
function votesDesc(a, b) {
  //aRank = a.posvotes - (a.negvotes * 0.5);
  //bRank = b.posvotes - (b.negvotes * 0.5);
  // for descending, reverse usual order; 
  return b.votes - a.votes;
}
function createdDesc(a, b) {
  // for descending, reverse usual order; 
  return new Date(b.date).valueOf() - new Date(a.date).valueOf();
}
$(document).ready(function(){
  // fill in holes;
  //setUserNameAndAffil();
  $('#loginForm').submit(function(e) {
    e.preventDefault();
    userObj.userName = $(this).find('#userName').val();
    userObj.userAffil = $(this).find('#userAffiliation').val();
    userObj.userID = 1234;
    loggedIn = true;
    $('#userHeader .userName').text(userObj['userName']);
    $('#userHeader .userAffil').text(userObj['userAffil']);
    $(this).addClass('hidden');
    $('#userBox').removeClass('hidden');
    $('.commentForm [type=submit]').removeAttr('disabled');
    $('.commentForm textarea').removeAttr('disabled');
  });
  // add event handlers;
  $('#backchatHeader input[type="button"]').click(function() {
    $('#backchatHeaderInstructions').toggle(500);
  });
  $('#enterPostTextarea').keyup(function() {
    var charLimit = 250;
    var charsUsed = $(this).val().length;
    if (charsUsed > 25) {
      $('#charsLeftMsg').text("characters left: " + 
                              (charLimit - charsUsed).toString());
    } else {
      $('#charsLeftMsg').text(" ");

    }
  });
  $('#submitPost').click(function() {
    var body = $('#enterPostTextarea').val();
    if (body !== '') {
      var newPost = assembleNewPostObj($('#enterPostTextarea').val());
      socket.emit('comment', {comment: newPost, lecture: lectureID});
      $('#enterPostTextarea').val('');
    }
  });
  $('.vote-tally-rect').live("click", function() {
    var postid = $(this).parent().attr('data-postid');
    var direction = $(this).hasClass("vote-up") ? "up" : "down";
    //console.log("NEW VOTE: PostID is " + postid + "; Direction is " + direction);
    if (postsVoted.indexOf(postid) != -1) {
      // already voted on this post;
      console.log("You already voted on this post!");
      // allow for now;
      // eventually: show dialog for 2 seconds; return;
    }
    // unnecessary: $(this).parent().removeClass("unvoted");
    postsVoted.push(postid);
    var newVoteObj = assembleVoteObj(postid, direction);
    socket.emit('vote', {vote: newVoteObj, lecture: lectureID});
  });
  $('#amountPosts').change(function() {
    MAXPOSTS = $(this).val();
    renderPosts();
  });
  $('#sortPosts').change(function() {
    var sort = $(this).val();
    sortedBy = sortedBy !== sort ? sort : sortedBy;
    renderPosts();
  });
  $('.commentForm').live('submit', function(e) {
    e.preventDefault();
    var body = $(this).find('#commentText').val();
    if (body !== '') {
      var comment = {
        username: userObj.userName,
        useraffil: userObj.userAffil,
        body: body,
        parentid: $(this).find('[name=postid]').val()
      }
      socket.emit('reply', {reply: comment, lecture: lectureID});
      $(this).find('#commentText').val('');
    }
  })

  $('.commentAmt').live('click', function(e) {
    e.preventDefault();
    var id = $(this).parent().parent().parent().attr('id').replace('post-', '');
    $('#post-'+id+' .commentContainer').toggleClass('hidden');
    $('#post-'+id+' .commentForm').toggleClass('hidden');
  })

  //=====================================================================
  // create socket to server; note that we only permit websocket transport
  // for this demo;
  var loc = document.location;
  var port = loc.port == '' ? (loc.protocol == 'https:' ? 443 : 80) : loc.port;
  var url = loc.protocol + '//' + loc.hostname + ':' + port;
  socket = io.connect(url);
  // incoming messages are objects with one property whose value is the
  // type of message:
  //   { "posts":    [ <array of Post objects> ] }
  //   { "recentPosts": [ <array of Post objects> ] }
  //   { "vote":        [ "postid": <string>, "direction": <"up"|"down"> ] }
  // Unresolved: whether to send vote messages for local change of display
  // or new arrays of posts with updated vote counts.  Vote message would not
  // be adequate if it changed order of posts.  For now, send two new
  // arrays with updated vote counts and refrain from sending vote message.
  var messagesArrived = 0;
  socket.on('connect', function(){
    lectureID = window.location.hash.substring(1);
    socket.emit('subscribe', lectureID);
    $(window).bind('hashchange', function() {
      lectureID = window.location.hash.substring(1);
      socket.emit('subscribe', lectureID);
    });
  });
  socket.on('message', function(obj) {
    if ('comments' in obj) {
      posts = obj.comments;
      renderPosts(true);
    } else if ('comment' in obj) {
      var post = obj.comment;
      posts.push(post);
      renderPosts();
    } else if ('vote' in obj) {
      var vote = obj.vote;
      posts = posts.map(function(post) {
        if(post._id == vote.parentid) {
          post.votes++;
          $('#post-'+vote.parentid).find('.vote-tally-rect').text(post.votes);
        }
        return post;
      });
      renderPosts();
    } else if ('reply' in obj) {
      var reply = obj.reply;
      posts = posts.map(function(post) {
        if (post._id == reply.parentid) {
          if (!post.replies) {
            post.replies = [];
          }
          post.replies.push(reply);
        }
        return post;
      });
      renderComments(reply.parentid);
    }
  });
  socket.on('disconnect', function(){ 
    // XXX something here
  });

  $('#enterPostTextarea').val("");
});

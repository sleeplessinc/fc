var MAXPOSTS = 10;
var posts = [];
var sortedBy = 'votes';
var socket;
var mobile = (/iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(navigator.userAgent.toLowerCase()));
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
  postObj.userName  = userObj.userName;
  postObj.userAffil = userObj.userAffil;
  postObj.body = msgBody;
  postObj.reports = 0;
  return postObj;
}
function renderPosts(fresh, post) {
  if (fresh) $('#posts .postContainer').remove();
  //$('#total_posts').text(posts.length);
  // truncate long array of Posts;
  var sortedPosts = sortedBy == 'created' ? posts.sort(createdDesc) : posts.sort(votesDesc);
  var displayPosts = sortedPosts//.slice(0, MAXPOSTS - 1);
  if (post) $("#postTemplate").tmpl(post).appendTo("#posts");
  if (fresh) $("#postTemplate").tmpl(displayPosts).appendTo("#posts");
  else $('#posts').reOrder(displayPosts, 'post-')
  posts.forEach(function(post) {
    renderComments(post._id)
    var $post = $('#post-'+post._id);
    if ($post !== []) {
      if (post.reports.length >= 2) {
        if ($('#reportedContainer').length === 0) {
          $('#posts').append('<div id="reportedContainer">Flagged Posts<div class="reportedPosts hidden"></div></div>')
          $('#reportedContainer').click(function() {
            $(this).find('.reportedPosts').toggleClass('hidden')
          })
        }
        $post.addClass('flagged');
        $('#reportedContainer .reportedPosts').append($post)
      }
      if (post.votes.indexOf(userID) == -1) {
        $post.find('.postVoteContainer').addClass('unvoted')
      } else {
        $post.find('.vote-tally-rect').die()
        $post.find('.vote-tally-rect').css('cursor', 'default')
      }

      if (post.reports.indexOf(userID) !== -1) {
        $post.find('.voteFlag').css('cursor', 'default')
        $post.find('.voteFlag').css('background', '#888')
      } 

      if (post.userAffil === 'Instructor') {
        $post.addClass('instructor');
      }
    }
  })
}

function renderComments(id) {
  var comments = [];
  $.each(posts, function(i, post) {
    if (post._id == id) {
      comments = post.comments;
      if (comments.length >= 1) {
        $('#post-'+id+' .commentContainer').empty();
        $('#post-'+id+' .commentAmt').text(comments.length+' ');
        $('#commentTemplate').tmpl(comments).appendTo('#post-'+id+' .commentContainer');
      }
    }
  })
  if (loggedIn) {
    $( '.commentForm :input' ).removeAttr( 'disabled' );
  }
}

$.fn.reOrder = function(_array, prefix) {
  var array = $.extend([], _array, true);
  return this.each(function() {
    prefix = prefix || "";
    
    if (array) {    
      var reported = $('#reportedContainer');
      for(var i=0; i < array.length; i++) {
        var sel = '#' + prefix + array[i]._id;
        if ($(sel).length === 0)
          array[i] = $("#postTemplate").tmpl(array[i])
        else
          array[i] = $(sel);
      }
      $(this).find('.postContainer').remove();  
    
      for(var i=0; i < array.length; i++) {
        $(this).append(array[i]);
      }
      $(this).append(reported)
    }
  });    
}

function assembleVoteObj(postid, upOrDown) {
  return { "parentid": postid, "direction": upOrDown };
}
function votesDesc(a, b) {
  if (a.reports >= 2) {
    return 1;
  } else if (b.reports >= 2) {
    return -1;
  } else {
  // for descending, reverse usual order; 
  return b.votes.length - a.votes.length;
  }
}
function createdDesc(a, b) {
  if (a.reports >= 2) {
    return 1;
  } else if (b.reports >= 2) {
    return -1;
  } else {
    // for descending, reverse usual order; 
    return new Date(b.date).valueOf() - new Date(a.date).valueOf();
  }
}
$(document).ready(function(){

  userObj.userName  = userName;
  userObj.userAffil = userAffil;
  userObj.userID    = userID;

  loggedIn = true;

  $('#userBox').removeClass('hidden');

  $( '.commentForm :input' ).removeAttr( 'disabled' );

  // add event handlers;
  $('#backchatHeader input[type="button"]').click(function() {
    $('#backchatHeaderInstructions').toggle();
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
    var form = $( this );

    var body = $('#enterPostTextarea').val();
    if (body !== '') {
      var newPost = assembleNewPostObj(body);

      var anonymous = $('#enterPostForm').find( 'input[name=anonymous]' ).is(':checked') ? true : false;
      newPost.anonymous = anonymous;
      socket.emit('post', {post: newPost, lecture: lectureID});
      $('#enterPostTextarea').val('');
    }
  });
  $('.vote-tally-rect').live("click", function() {
    var that = this;
    var postid = $(this).parent().attr('data-postid');
    posts.forEach(function(post) {
      if (post._id === postid) {
        if (post.votes.indexOf(userID) == -1) {
          var newVoteObj = {parentid: postid, userid: userID};
          socket.emit('vote', {vote: newVoteObj, lecture: lectureID});
          $(that).die()
          $(that).css('cursor', 'default')
          $(that).parent().removeClass('unvoted');
        } 
      }
    })
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

		var anonymous = $( this ).find( 'input[name=anonymous]' ).is(':checked') ? true : false;

    if (body !== '') {
      var comment = {
        userName: userObj.userName,
        userAffil: userObj.userAffil,
        body: body,
        anonymous: anonymous,
        parentid: $(this).find('[name=postid]').val()
      }
      socket.emit('comment', {comment: comment, lecture: lectureID});
      $(this).find('#commentText').val('');
    }
  })

  $('.comments').live('click', function(e) {
    e.preventDefault();
    var id = $(this).attr('id').replace('post-', '');
    $('#post-'+id+' .commentContainer').toggleClass('hidden');
    $('#post-'+id+' .commentForm').toggleClass('hidden');
  })

  $('.voteFlag').live('click', function() {
    var that = this;
    var id = $(this).parent().parent().attr('id').replace('post-', '');
    $.each(posts, function(i, post){
      if (post._id == id) {
        if (post.reports.indexOf(userID) == -1) {
          if(confirm('By flagging a comment, you are identifying it as a violation of the FinalsClub Code of Conduct: Keep it academic.')) {
            socket.emit('report', {report: {parentid: id, userid: userID}, lecture: lectureID});
            $(that).die()
            $(that).css('cursor', 'default')
            $(that).css('background', '#888')
          }
        } 
      }
    })
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
    //lectureID = window.location.hash.substring(1);
    socket.emit('subscribe', lectureID);
    /*$(window).bind('hashchange', function() {
      lectureID = window.location.hash.substring(1);
      socket.emit('subscribe', lectureID);
    });*/
  });
  socket.on('message', function(obj) {
    if ('posts' in obj) {
      posts = obj.posts;
      renderPosts(true);
    } else if ('post' in obj) {
      var post = obj.post;
      posts.push(post);
      renderPosts(false, post);
    } else if ('vote' in obj) {
      var vote = obj.vote;
      posts = posts.map(function(post) {
        if(post._id == vote.parentid) {
          post.votes.push(vote.userid);
          $('#post-'+vote.parentid).find('.vote-tally-rect').text(post.votes.length);
        }
        return post;
      });
      renderPosts();
    } else if ('report' in obj) {
      var report = obj.report;
      posts = posts.map(function(post) {
        if(post._id == report.parentid) {
          post.reports.push(report.userid);
          if (post.reports.length >= 2) {
            $('#post-'+post._id).addClass('flagged');
          }
        }
        return post;
      });
      renderPosts();
    } else if ('comment' in obj) {
      var comment = obj.comment;
      posts = posts.map(function(post) {
        if (post._id == comment.parentid) {
          if (!post.comments) {
            post.comments = [];
          }
          post.comments.push(comment);
          post.date = new Date();
        }
        return post;
      });
      if (sortedBy == 'created') renderPosts();
      renderComments(comment.parentid);
    }
  });
  socket.on('disconnect', function(){ 
    // XXX something here
  });

  $('#enterPostTextarea').val("");
});

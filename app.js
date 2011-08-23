/* vim: set ts=2: */

// Prerequisites

var sys					= require( 'sys' );
var os					= require( 'os' );
var url					= require( 'url' );

var express			= require( 'express' );
var mongoStore	= require( 'connect-mongo' );
var async				= require( 'async' );

var db					= require( './db.js' );
var mongoose		= require( './models.js' ).mongoose;

var Mailer			= require( './mailer.js' );

var hat					= require('hat');

var connect			= require( 'connect' );
var Session			= connect.middleware.session.Session;
var parseCookie = connect.utils.parseCookie;

var log3 = function() {}

var app = module.exports = express.createServer();

// Database

var User		= mongoose.model( 'User' );
var School	= mongoose.model( 'School' );
var Course	= mongoose.model( 'Course' );
var Lecture	= mongoose.model( 'Lecture' );
var Note		= mongoose.model( 'Note' );

// Configuration

var serverHost = process.env.SERVER_HOST;

if( serverHost ) {
	console.log( 'Using server hostname defined in environment: %s', serverHost );
} else {
	serverHost = os.hostname();

	console.log( 'No hostname defined, defaulting to os.hostname(): %s', serverHost );
}

app.configure( 'development', function() { 
	app.set( 'errorHandler', express.errorHandler( { dumpExceptions: true, showStack: true } ) );

	app.set( 'dbHost', 'localhost' );
	app.set( 'dbUri', 'mongodb://' + app.set( 'dbHost' ) + '/fc' );

	app.set( 'awsAccessKey', process.env.AWS_ACCESS_KEY );
	app.set( 'awsSecretKey', process.env.AWS_SECRET_KEY );
});

app.configure( 'production', function() {
	app.set( 'errorHandler', express.errorHandler() );

	app.set( 'dbHost', 'localhost' );
	app.set( 'dbUri', 'mongodb://' + app.set( 'dbHost' ) + '/fc' );

	app.set( 'awsAccessKey', process.env.AWS_ACCESS_KEY );
	app.set( 'awsSecretKey', process.env.AWS_SECRET_KEY );
});

app.configure(function(){
	app.set( 'views', __dirname + '/views' );
	app.set( 'view engine', 'jade' );
	app.use( express.bodyParser() );

	app.use( express.cookieParser() );

	// sessions
	app.set( 'sessionStore', new mongoStore( {
		'url' : app.set( 'dbUri' )
	}));

	app.use( express.session( {
		'secret'	: 'finalsclub',
		'maxAge'	: new Date(Date.now() + (60 * 60 * 24 * 30 * 1000)),
		'store'		: app.set( 'sessionStore' )
	}));

  app.use( express.methodOverride() );
  app.use( app.router );
  app.use( express.static( __dirname + '/public' ) );

	// use the error handler defined earlier
	var errorHandler = app.set( 'errorHandler' );

	app.use( errorHandler );
});

// Middleware

function loggedIn( req, res, next ) {
	var sid = req.sessionID;
	log3("logged in ...")

	console.log( 'got request from session ID: %s', sid );

	User.findOne( { session : sid }, function( err, user ) {
		log3(err);
		log3(user);
		if( user ) {
			req.user = user;

			log3( 'authenticated user: '+user._id+' / '+user.email+'');

      if ( user.activated ) {
        next();
      } else {
        var path = url.parse( req.url ).pathname;
        req.session.redirect = path;

        if (path === '/activate') {
          next();
        } else {
          res.redirect( '/activate' );
        }
      }

		} else {
			// stash the original request so we can redirect
			var path = url.parse( req.url ).pathname;
			req.session.redirect = path;

			res.redirect( '/login' );
		}
	});
}

function loadCourse( req, res, next ) {
	var userId		= req.user._id;
	var courseId	= req.params.id;

	Course.findById( courseId, function( err, course ) {
		if( course ) {
			if( course.authorize( userId ) ) {
					console.log( 'authorized' );
	
					req.course = course;

					next();
			} else {
				req.flash( 'error', 'You do not have permission to access that course.' );

				res.redirect( '/' );
			}
		} else {
			req.flash( 'error', 'Invalid course specified!' );

			res.redirect( '/' );
		}
	});
}

function loadLecture( req, res, next ) {
	var userId = req.user._id;
	var lectureId	= req.params.id;

	Lecture.findById( lectureId, function( err, lecture ) {
		if( lecture ) {
			if( lecture.authorize( userId ) ) {
				req.lecture = lecture;

				next();
			} else {
				req.flash( 'error', 'You do not have permission to access that lecture.' );

				res.redirect( '/' );
			}
		} else {
			req.flash( 'error', 'Invalid lecture specified!' );

			res.redirect( '/' );
		}
	});
}

function loadNote( req, res, next ) {
	var userId = req.user._id;
	var noteId = req.params.id;

	Note.findById( noteId, function( err, note ) {
		if( note ) {
			if( note.public || note.authorize( userId ) ) {
				req.note = note;

				next();
			} else {
				req.flash( 'You do not have permission to access that note.' );

				next();
			}
		} else {
			req.flash( 'error', 'Invalid note specified!' );

			res.direct( '/' );
		}
	});
}

app.dynamicHelpers( {
	// flash messages from express-messages
	'messages' : require( 'express-messages' ),

	'user' : function( req, res ) {
		return req.user;
	},

	'session' : function( req, res ) {
		return req.session;
	}
});

// Routes
app.get( '/schools', loggedIn, function( req, res ) {
	var userId = req.user._id;

	log3("get /schools page");

	// mongoose's documentation on sort is extremely poor, tread carefully
	School.find( { 'users' : userId } ).sort( 'name', '1' ).run( function( err, schools ) {
		if( schools ) {
			async.forEach(
				schools,
				function( school, callback ) {
					Course.find( { 'school' : school._id } ).sort( 'name', '1' ).run( function( err, courses ) {
						if( courses.length > 0 ) {
	            school.courses = courses;
						} else {
	            school.courses = [];
  	        }
						callback();
					});
				},
				function( err ) {
					res.render( 'schools', { 'schools' : schools } );
				}
			);
		} else {
			res.render( 'schools', { 'schools' : [] } );
		}
	});
});

app.get( '/', loggedIn, function( req, res ) {
	var userId = req.user._id;

	log3("get / page");

	res.render( 'index', {} );
});

app.get( '/activate', loggedIn, function( req, res ) {
  res.render( 'activate', { 'user': req.user });
});

app.post( '/activate', loggedIn, function( req, res ) {
  var user = req.user;
  var activateCode = req.body.code;

  if ( user.affil === 'Instructor' ) {
    user.password = req.body.password;
    user.name = req.body.name;
    if ( user.name === '' ) {
      req.flash('error', 'Please enter your name');
      return req.redirect('/activate')
    }
  }

  if (activateCode === user.activateCode) {
    user.activated = true;
    user.save(function( err ) {
      if ( err ) {
        req.flash('error', 'Invalid parameters!');
        res.redirect('/activate');
      } else {
				var redirect = req.session.redirect;
        if ( redirect === '/activate' ) {
          redirect = '/';
        }
        req.flash('info', 'Account has been activated');
				res.redirect( redirect || '/' );
      }
    })
  } else {
    req.flash('error', 'The activation code you entered was invalid');

    res.redirect( '/activate' );
  }
});

app.get( '/:id/course/new', loggedIn, function( req, res ) {
  var schoolId = req.params.id;

  School.findById( schoolId, function( err, school ) {
		if( school ) {
      res.render( 'course/new', { 'school': school } );
		} else {
			req.flash( 'error', 'Invalid note specified!' );

			res.direct( '/' );
		}
  })
});

app.post( '/:id/course/new', loggedIn, function( req, res ) {
	var schoolId	= req.params.id;
	var course = new Course;
  var instructorEmail = req.body.email;

  if (!instructorEmail) {
    req.flash( 'error', 'Invalid parameters!' )
    return res.render( 'course/new' );
  }
	course.name		= req.body.name;
	course.description		= req.body.description;
	course.school	= schoolId;
  course.instructor = instructorEmail;

  User.findOne( { 'email': instructorEmail }, function( err, user ) {
    if ( !user ) {
      var user          = new User;

      var password      = hat(32);
      var activateCode  = hat(64);

      user.email        = instructorEmail;
      user.name         = '';
      user.password     = password;
      user.activated    = false;
      user.activateCode = activateCode;
      user.affil        = 'Instructor';
      // XXX Put mailchimp integration here

      user.save(function( err ) {
        if ( err ) {
          req.flash( 'error', 'Invalid parameters!' )
          res.render( 'course/new' );
        } else {
					var message = {
						to					: user.email,

						'subject'		: 'You have been registered as a course instructor on FinalsClub.org',
	
						'template'	: 'instructorInvite',
						'locals'		: {
							'course'		: course,
							'user'			: user,
							'password'	: password
						}
					};

					mailer.send( message, function( result ) {
						if( result instanceof Error ) {
							console.log( 'Error inviting instructor to course!' );
						} else {
							console.log( 'Successfully invited instructor to course.' );
						}
					});

          course.save( function( err ) {
            if( err ) {
              // XXX: better validation
              req.flash( 'error', 'Invalid parameters!' );

              res.render( 'course/new' );
            } else {
              res.redirect( '/' );
            }
          });
        }
      })
    } else {
      if (user.affil === 'Instructor') {
        course.save( function( err ) {
          if( err ) {
            // XXX: better validation
            req.flash( 'error', 'Invalid parameters!' );

            res.render( 'course/new' );
          } else {
            res.redirect( '/' );
          }
        });
      } else {
        req.flash( 'error', 'The existing user\'s email you entered is not an instructor' );
        res.render( 'course/new' );
      }
    }
  })
});

app.get( '/course/:id', loggedIn, loadCourse, function( req, res ) {
	var userId = req.user._id;
	var course = req.course;

	// are we subscribed to this course?
	var subscribed = course.subscribed( userId );

	// pull out our lectures
	Lecture.find( { 'course' : course._id } ).sort( 'name', '1' ).run( function( err, lectures ) {
		res.render( 'course/index', { 'course' : course, 'subscribed' : subscribed, 'lectures' : lectures } );
	});
});

// subscribe and unsubscribe to course networks
app.get( '/course/:id/subscribe', loggedIn, loadCourse, function( req, res ) {
	var course = req.course;
	var userId = req.user._id;

	course.subscribe( userId, function( err ) {
		if( err ) {
			req.flash( 'error', 'Error subscribing to course!' );
		}

		res.redirect( '/course/' + course._id );
	});
});

app.get( '/course/:id/unsubscribe', loggedIn, loadCourse, function( req, res ) {
	var course = req.course;
	var userId = req.user._id;

	course.unsubscribe( userId, function( err ) {
		if( err ) {
			req.flash( 'error', 'Error unsubscribing from course!' );
		}

		res.redirect( '/course/' + course._id );
	});
});

app.get( '/course/:id/lecture/new', loggedIn, loadCourse, function( req, res ) {
	var lecture = {};

	res.render( 'lecture/new', { 'lecture' : lecture } );
});

app.post( '/course/:id/lecture/new', loggedIn, loadCourse, function( req, res ) {
	var course	= req.course;
	var lecture = new Lecture;

	lecture.name		= req.body.name;
	lecture.date		= req.body.date;
	lecture.course	= course._id;

	lecture.save( function( err ) {
		if( err ) {
			// XXX: better validation
			req.flash( 'error', 'Invalid parameters!' );

			res.render( 'lecture/new', { 'lecture' : lecture } );
		} else {
			res.redirect( '/course/' + course._id );
		}
	});
});

// lecture

app.get( '/lecture/:id', loggedIn, loadLecture, function( req, res ) {
	var lecture	= req.lecture;

	// pull out our notes
	Note.find( { 'lecture' : lecture._id } ).sort( 'name', '1' ).run( function( err, notes ) {
		res.render( 'lecture/index', {
			'lecture'			: lecture,
			'notes'				: notes,
			'counts'			: counts,

			'javascripts'	: [ 'counts.js' ]
		});
	});
});

app.get( '/lecture/:id/notes/new', loggedIn, loadLecture, function( req, res ) {
	var note = {};

	res.render( 'notes/new', { 'note' : note } );
});

app.post( '/lecture/:id/notes/new', loggedIn, loadLecture, function( req, res ) {
	var lecture = req.lecture;
	var note		= new Note;

	note.name			= req.body.name;
	note.date			= req.body.date;
	note.lecture	= lecture._id;
  note.public   = req.body.public ? true : false;

	note.save( function( err ) {
		if( err ) {
			// XXX: better validation
			req.flash( 'error', 'Invalid parameters!' );

			res.render( 'notes/new', { 'note' : note } );
		} else {
			res.redirect( '/lecture/' + lecture._id );
		}
	});
});

// notes

app.get( '/note/:id', loadNote, function( req, res ) {
	var note = req.note;
  var roID = note.roID || false;

	var lectureId = note.lecture;

	var sid = req.sessionID;

  if (roID) {
    processReq();
  } else {
    db.open('mongodb://' + app.set( 'dbHost' ) + '/etherpad/etherpad', function( err, epl ) {
      epl.findOne( { key: 'pad2readonly:' + note._id }, function(err, record) {
        if ( record ) {
          roID = record.value.replace(/"/g, '');
        } else {
          roID = false;
        }
        processReq();
      })
    })
  }

  function processReq() {
    Lecture.findById( lectureId, function( err, lecture ) {
      if( ! lecture ) {
        req.flash( 'error', 'That notes page is orphaned!' );

        res.redirect( '/' );
      }
      Note.find( { 'lecture' : lecture._id }, function( err, otherNotes ) {
        User.findOne( { session : sid }, function( err, user ) {
          if( user ) {
            // XXX User is logged in and sees full notepad
            req.user = user;

            if ( !user.activated ) {
              return res.redirect( '/activate' );
            }

            res.render( 'notes/index', {
              'layout'      : 'noteLayout',
              'host'				: serverHost,
              'note'				: note,
              'lecture'			: lecture,
              'otherNotes'  : otherNotes,
              'RO'          : false,
              'roID'        : roID,
              'stylesheets' : [ 'dropdown.css', 'fc.css' ],
              'javascripts'	: [ 'dropdown.js', 'counts.js', 'backchannel.js', 'jquery.tmpl.min.js' ]
            });
          } else {
            if (note.public) {
              // XXX User is not logged in and sees notepad that is public
              res.render( 'notes/public', {
                'layout'      : 'noteLayout',
                'host'				: serverHost,
                'note'				: note,
                'otherNotes'  : otherNotes,
                'roID'        : roID,
                'lecture'			: lecture,
                'stylesheets' : [ 'dropdown.css', 'fc.css' ],
                'javascripts'	: [ 'dropdown.js', 'counts.js', 'backchannel.js', 'jquery.tmpl.min.js' ]
              });
            } else {
              // XXX User is not logged in and is redirected to login because notepad is private
              req.session.redirect = '/note/' + note._id;
              req.flash( 'error', 'You must be logged in to view this notepad' );
              res.redirect( '/login' );
            }
          }
        });
      })
    });
  }
});

// authentication

app.get( '/login', function( req, res ) {
  log3("get login page")

	res.render( 'login' );	
});

app.post( '/login', function( req, res ) {
	var email		 = req.body.email;
	var password = req.body.password;
  log3("post login ...")

	User.findOne( { 'email' : email }, function( err, user ) {
		log3(err) 
		log3(user) 
		if( user && user.authenticate( password ) ) {
			log3("pass ok") 
			var sid = req.sessionID;

			user.session = sid;

			user.save( function() {
				var redirect = req.session.redirect;

				// login complete, remember the user's email for next time
				req.session.email = email;

				// redirect to root if we don't have a stashed request
				res.redirect( redirect || '/' );
			});
		} else {
			log3("bad login")
			req.flash( 'error', 'Invalid login!' );

			res.render( 'login' );
		}
	});
});

app.get( '/register', function( req, res ) {
  log3("get reg page");
	res.render( 'register' );
});

app.post( '/register', function( req, res ) {
	var sid = req.sessionId;

	var user = new User;
  log3("post reg ");
	log3(user)
  
	user.email        = req.body.email;
	user.password     = req.body.password;
	user.session      = sid;
  user.name         = req.body.name;
  user.affil        = req.body.affil;
  user.activated    = false;
  user.activateCode = hat(64);
	log3('register '+user.email+"/"+user.password+" "+user.session) 
	log3(user)

	user.save( function( err ) {
		var hostname = user.email.split( '@' ).pop();
		log3('save '+user.email);

		var message = {
			'to'				: user.email,

			'subject'		: 'Welcome to FinalsClub.org!',

			'template'	: 'userActivation',
				'locals'		: {
					'user'			: user
			}
		};

		mailer.send( message, function( result ) {
			if( result instanceof Error ) {
				// XXX: Add route to resend this email

				console.log( 'Error sending user activation email!' );
			} else {
				console.log( 'Successfully sent user activation email.' );
			}
		});

		School.findOne( { 'hostnames' : hostname }, function( err, school ) {
			if( school ) {
				log3('school recognized '+school.name);
				school.users.push( user._id );

				school.save( function( err ) {
				  log3('school.save() done');
					req.flash( 'info', 'You have automatically been added to the ' + school.name + ' network.' );
				});
			}

			res.redirect( '/' );
		});
	});
});

app.get( '/logout', function( req, res ) {
	var sid = req.sessionID;

	User.findOne( { 'session' : sid }, function( err, user ) {
		if( user ) {
			user.session = '';

			user.save( function( err ) {
				res.redirect( '/' );
			});
		} else {
			res.redirect( '/' );
		}
	});

/*
	req.session.destroy();

	res.redirect( '/' );
*/
});

// socket.io server

var io = require( 'socket.io' ).listen( app );

var Post = mongoose.model( 'Post' );

io.set('authorization', function ( handshake, next ) {
  var rawCookie = handshake.headers.cookie;
  if (rawCookie) {
    handshake.cookie = parseCookie(rawCookie);
    handshake.sid = handshake.cookie['connect.sid'];

    if ( handshake.sid ) {
      app.set( 'sessionStore' ).get( handshake.sid, function( err, session ) {
        if( err ) {
          handshake.user = false;
          return next(null, true);
        } else {
          // bake a new session object for full r/w
          handshake.session = new Session( handshake, session );

          User.findOne( { session : handshake.sid }, function( err, user ) {
            if( user ) {
              handshake.user = user;
              return next(null, true);
            } else {
              handshake.user = false;
              return next(null, true);
            }
          });
        }
      })
    }
  } else {
    data.user = false;
    return next(null, true);
  }
});


var backchannel = io
  .of( '/backchannel' )
  .on( 'connection', function( socket ) {

    socket.on('subscribe', function(lecture, cb) {
      socket.join(lecture);
      Post.find({'lecture': lecture}, function(err, posts) {
        if (socket.handshake.user) {
          cb(posts);
        } else {
          var posts = posts.filter(
            function(post) {
            if (post.public)
              return post;
          }
          )
          cb(posts)
        }
      });
    });

    socket.on('post', function(res) {
      var post = new Post;
      var _post = res.post;
      var lecture = res.lecture;
      post.lecture = lecture;
      if ( _post.anonymous ) {
        post.userid		= 0;
        post.userName	= 'Anonymous';
        post.userAffil = 'N/A';
      } else {
        post.userName = _post.userName;
        post.userAffil = _post.userAffil;
      }

      post.public = _post.public;
      post.date = new Date();
      post.body = _post.body;
      post.votes = [];
      post.reports = [];
      post.save(function(err) {
        if (err) {
          // XXX some error handling
          console.log(err);
        } else {
          if (post.public) {
            backchannel.in(lecture).emit('post', post);
          } else {
            privateEmit(lecture, 'post', post);
          }
        }
      });
    });

    socket.on('vote', function(res) {
      var vote = res.vote;
      var lecture = res.lecture;
      Post.findById(vote.parentid, function( err, post ) {
        if (!err) {
          if (post.votes.indexOf(vote.userid) == -1) {
            post.votes.push(vote.userid);
            post.save(function(err) {
              if (err) {
                // XXX error handling
              } else {
                if (post.public) {
                  backchannel.in(lecture).emit('vote', vote);
                } else {
                  privteEmit(lecture, 'vote', vote);
                }
              }
            });
          }
        }
      })
    });

    socket.on('report', function(res) {
      var report = res.report;
      var lecture = res.lecture;
      Post.findById(report.parentid, function( err, post ){
        if (!err) {
          if (post.reports.indexOf(report.userid) == -1) {
            post.reports.push(report.userid);
            post.save(function(err) {
              if (err) {
                // XXX error handling
              } else {
                if (post.public) {
                  backchannel.in(lecture).emit('report', report);
                } else {
                  privateEmit(lecture, 'report', report);
                }
              }
            });
          }
        }
      })
    });

    socket.on('comment', function(res) {
      var comment = res.comment;
      var lecture = res.lecture;
      console.log('anon', comment.anonymous);
      if ( comment.anonymous ) {
        comment.userid		= 0;
        comment.userName	= 'Anonymous';
        comment.userAffil = 'N/A';
      }
      Post.findById(comment.parentid, function( err, post ) {
        if (!err) {
          post.comments.push(comment);
          post.date = new Date();
          post.save(function(err) {
            if (err) {
              console.log(err);
            } else {
              if (post.public) {
                backchannel.in(lecture).emit('comment', comment);
              } else {
                privateEmit(lecture, 'comment', comment);
              }
            }
          })
        }
      })
    });

    function privateEmit(lecture, event, data) {
      backchannel.clients(lecture).forEach(function(socket) {
        if (socket.handshake.user)
          socket.emit(event, data);
      })
    }

    socket.on('disconnect', function() {
      //delete clients[socket.id];
    });
  });


var counters = {};

var counts = io
.of( '/counts' )
.on( 'connection', function( socket ) {
  // pull out user/session information etc.
  var handshake = socket.handshake;
  var userID		= handshake.user._id;

  var watched		= [];
  var noteID		= null;

  var timer			= null;

  socket.on( 'join', function( note ) {
    if (handshake.user === false) {
      noteID			= note;
      // XXX: replace by addToSet (once it's implemented in mongoose)
      Note.findById( noteID, function( err, note ) {
        if( note ) {
          if( note.collaborators.indexOf( userID ) == -1 ) {
            note.collaborators.push( userID );
            note.save();
          }
        }
      });
    }
  });

  socket.on( 'watch', function( l ) {
    var sendCounts = function() {
      var send = {};

      Note.find( { '_id' : { '$in' : watched } }, function( err, notes ) {
        async.forEach(
          notes,
          function( note, callback ) {
            var id		= note._id;
            var count	= note.collaborators.length;

            send[ id ] = count;

            callback();
          }, function() {
            socket.emit( 'counts', send );

            timer = setTimeout( sendCounts, 5000 );
          }
        );
      });
    }

    Note.find( { 'lecture' : l }, [ '_id' ], function( err, notes ) {
      notes.forEach( function( note ) {
        watched.push( note._id );
      });
    });

    sendCounts();
  });

  socket.on( 'disconnect', function() {
    clearTimeout( timer );

    if (handshake.user === false) {
      // XXX: replace with $pull once it's available
      if( noteID ) {
        Note.findById( noteID, function( err, note ) {
          if( note ) {
            var index = note.collaborators.indexOf( userID );

            if( index != -1 ) {
              note.collaborators.splice( index, 1 );
            }

            note.save();
          }
        });
      }
    }
  });
});

// Launch

mongoose.connect( app.set( 'dbUri' ) );
mongoose.connection.db.serverConfig.connection.autoReconnect = true

var mailer = new Mailer( app.set( 'awsAccessKey' ), app.set( 'awsSecretKey' ) );

console.log( mailer );


app.listen( 3000 );
console.log( "Express server listening on port %d in %s mode", app.address().port, app.settings.env );

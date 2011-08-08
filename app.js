/* vim: set ts=2: */

var sys				= require( 'sys' );
var os				= require( 'os' );

var express		= require( 'express' );
var mongoose	= require( './db.js' ).mongoose;
var async			= require( 'async' );

var app = module.exports = express.createServer();

// Configuration

var serverHost = process.env.SERVER_HOST;

if( serverHost ) {
	console.log( 'Using server hostname defined in environment: %s', serverHost );
} else {
	serverHost = os.hostname();

	console.log( 'No hostname defined, defaulting to os.hostname(): %s', serverHost );
}

app.configure(function(){
  app.set( 'views', __dirname + '/views' );
  app.set( 'view engine', 'jade' );
  app.use( express.bodyParser() );

	app.use( express.cookieParser() );
	app.use( express.session( { 'secret' : 'finalsclub' } ) );

  app.use( express.methodOverride() );
  app.use( app.router );
  app.use( express.static( __dirname + '/public' ) );
});

app.configure( 'development', function() { 
	app.use( express.errorHandler( { dumpExceptions: true, showStack: true } ) ); 

	// still using local mongo instances for now; this may change
	app.set( 'dbUri', 'mongodb://localhost/fc' );
});

app.configure( 'production', function() {
	app.use( express.errorHandler() ); 

	app.set( 'dbUri', 'mongodb://localhost/fc' );
});

// db connect

mongoose.connect( app.set( 'dbUri' ) );
mongoose.connection.db.serverConfig.connection.autoReconnect = true

// Models

var User		= mongoose.model( 'User' );
var School	= mongoose.model( 'School' );
var Course	= mongoose.model( 'Course' );
var Lecture	= mongoose.model( 'Lecture' );
var Note		= mongoose.model( 'Note' );

// Middleware

function loggedIn( req, res, next ) {
	var sid = req.sessionID;

	console.log( 'got request from session ID: %s', sid );

	User.findOne( { session : sid }, function( err, user ) {
		if( user ) {
			req.user = user;

			console.log( 'authenticated user: %s / %s', user._id, user.email );

			next();
		} else {
			res.redirect( '/login' );
		}
	});
}

function loadCourse( req, res, next ) {
	var userId		= req.user._id;
	var courseId	= req.params.id;

	Course.findById( courseId, function( err, course ) {
		if( course ) {

/*
			var schoolId = course.school;

			// verify that the user is a member of the correct network
			School.findOne( { '_id' : schoolId, 'users' : userId }, function( err, school ) {
				if( school ) {
					req.course = course;

					next();
				} else {
					req.flash( 'error', 'You do not have permission to access that course.' );

					res.redirect( '/' );
				}
			});
*/

			req.course = course;
			next();

		} else {
			req.flash( 'error', 'Invalid course specified!' );

			res.redirect( '/' );
		}
	});
}

function loadLecture( req, res, next ) {
	/* XXX: AUTHENTICATION */

	var lectureId	= req.params.id;

	Lecture.findById( lectureId, function( err, lecture ) {
		if( lecture ) {
			req.lecture = lecture;

			next();
		} else {
			req.flash( 'error', 'Invalid lecture specified!' );

			res.redirect( '/' );
		}
	});
}

function loadNote( req, res, next ) {
	/* XXX: AUTHENTICATION */

	var noteId = req.params.id;

	Note.findById( noteId, function( err, note ) {
		if( note ) {
			req.note = note;

			next();
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
	}
});

// Routes

app.get( '/', loggedIn, function( req, res ) {
	var userId = req.user._id;

	var schools = {};

//	School.find( { 'users' : userId }, function( err, results ) {
	School.find( {}, function( err, results ) {
		async.forEach(
			results,
			function( school, callback ) {
//				Course.find( { 'school' : school._id, 'users' : userId }, function( err, courses ) {
					Course.find( { 'school' : school._id }, function( err, courses ) {
					if( courses.length > 0 ) {
						schools[ school.name ] = courses;
					}

					callback();
				});
			},
			function( err ) {
				res.render( 'index', { 'schools' : schools } );
			}
		);
	});
});

app.get( '/course/:id', loggedIn, loadCourse, function( req, res ) {
	var userId = req.user._id;
	var course = req.course;

	// are we subscribed to this course?
	var subscribed = ( course.users.indexOf( userId ) > -1 );

	// pull out our lectures
	Lecture.find( { 'course' : course._id }, function( err, lectures ) {
		res.render( 'course/index', { 'course' : course, 'subscribed' : subscribed, 'lectures' : lectures } );
	});
});

// subscribe and unsubscribe to course networks
app.get( '/course/:id/subscribe', loggedIn, loadCourse, function( req, res ) {
	var courseId = req.course._id;
	var userId = req.user._id;

	// mongoose issue #404
	Course.collection.update( { '_id' : courseId }, { '$push' : { 'users' : userId } }, function( err ) {
		res.redirect( '/course/' + courseId );
	});
});

app.get( '/course/:id/unsubscribe', loggedIn, loadCourse, function( req, res ) {
	var courseId = req.course._id;
	var userId = req.user._id;

	// mongoose issue #404
	Course.collection.update( { '_id' : courseId }, { '$pull' : { 'users' : userId } }, function( err ) {
		res.redirect( '/course/' + courseId );
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
	Note.find( { 'lecture' : lecture._id }, function( err, notes ) {
		res.render( 'lecture/index', {
			'lecture'			: lecture,
			'notes'				: notes
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

app.get( '/note/:id', loggedIn, loadNote, function( req, res ) {
	var note = req.note;

	var lectureId = note.lecture;

	Lecture.findById( lectureId, function( err, lecture ) {
		if( ! lecture ) {
			req.flash( 'error', 'That notes page is orphaned!' );

			res.redirect( '/' );
		}

		res.render( 'notes/index', {
      'layout'      : 'noteLayout',
			'host'				: serverHost,
			'note'				: note,
			'lecture'			: lecture,
			'stylesheets' : [ 'fc.css' ],
			'javascripts'	: [ 'backchannel.js', 'jquery.tmpl.min.js' ]
		});
	});
});

// authentication

app.get( '/login', function( req, res ) {
	res.render( 'login' );	
});

app.post( '/login', function( req, res ) {
	var email		 = req.body.email;
	var password = req.body.password;

	User.findOne( { 'email' : email }, function( err, user ) {
		if( user && user.authenticate( password ) ) {
			var sid = req.sessionID;

			user.session = sid;

			user.save( function() {
				res.redirect( '/' );
			});
		} else {
			req.flash( 'error', 'Invalid login!' );

			res.render( 'login' );
		}
	});
});

app.get( '/register', function( req, res ) {
	res.render( 'register' );
});

app.post( '/register', function( req, res ) {
	var sid = req.sessionId;

	var user = new User;

	user.email    = req.body.email;
	user.password = req.body.password;
	user.session  = sid;
  user.name     = req.body.name;
  user.affil    = req.body.affil;

	user.save( function( err ) {
		var hostname = user.email.split( '@' ).pop();

		School.findOne( { 'hostnames' : hostname }, function( err, school ) {
			if( school ) {
				school.users.push( user._id );

				school.save( function( err ) {
					req.flash( 'info', 'You have automatically been added to the ' + school.name + ' network.' );
				});
			}

			res.redirect( '/' );
		});
	});
});

app.get( '/logout', function( req, res ) {
	req.session.destroy();

	res.redirect( '/' );
});

// socket.io server

var io = require( 'socket.io' ).listen( app );

var Post = mongoose.model( 'Post' );

var clients = posts = {};

io.sockets.on('connection', function(socket) {
	socket.on('subscribe', function(lecture) {
		var id = socket.id;
		clients[id] = {
			socket: socket,
			lecture: lecture
		}
		Post.find({'lecture': lecture}, function(err, res) {
			posts[lecture] = res ? res : [];
			socket.json.send({posts: res});
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
		post.date = new Date();
		post.body = _post.body;
		post.votes = [];
    post.reports = 0;
		post.save(function(err) {
			if (err) {
				// XXX some error handling
				console.log(err);
			} else {
				posts[lecture].push(post);
				publish({post: post}, lecture);
			}
		});
	});

	socket.on('vote', function(res) {
		var vote = res.vote;
		var lecture = res.lecture;
		posts[lecture] = posts[lecture].map(function(post) {
			if(post._id == vote.parentid) {
        if (post.votes.indexOf(vote.userid) == -1) {
          post.votes.push(vote.userid);
          post.save(function(err) {
            if (err) {
              // XXX error handling
            } else {
              publish({vote: vote}, lecture);
            }
          });
        }
			}
			return post;
		});
	});

	socket.on('report', function(res) {
		var report = res.report;
		var lecture = res.lecture;
		posts[lecture] = posts[lecture].map(function(post) {
			if(post._id == report.parentid) {
        if (!post.reports) post.reports = 0;
				post.reports++;
				post.save(function(err) {
					if (err) {
						// XXX error handling
					} else {
						publish({report: report}, lecture);
					}
				});
			}
			return post;
		});
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
		posts[lecture] = posts[lecture].map(function(post) {
			if(post._id == comment.parentid) {
				post.comments.push(comment);
				post.date = new Date();
				post.save(function(err) {
					if (err) {
						console.log(err);
					} else {
						publish({comment: comment}, lecture);
					}
				})
			}
			return post;
		});
	});
	
	socket.on('disconnect', function() {
		delete clients[socket.id];
	});
});

function publish(data, lecture) {
	Object.getOwnPropertyNames(clients).forEach(function(id) {
		if (clients[id].lecture === lecture) {
			clients[id].socket.json.send(data)
		}
	});
}

app.listen( 3000 );
console.log( "Express server listening on port %d in %s mode", app.address().port, app.settings.env );

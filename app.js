/* vim: set ts=2: */

var express		= require( 'express' );
var mongoose	= require( './db.js' ).mongoose;
var async			= require( 'async' );
var sys				= require( 'sys' );
require( './log.js' ); logLevel = 5;


var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set( 'views', __dirname + '/views' );
  app.set( 'view engine', 'jade' );
  app.use( express.bodyParser() );

	app.use( express.cookieParser() );
	app.use( express.session( {
		'secret' : 'finalsclub',
		'maxAge' : new Date(Date.now() + (60 * 60 * 24 * 30 * 1000))
		//'maxAge' : new Date(Date.now())
		} ) );

  app.use( express.methodOverride() );
  app.use( app.router );
  app.use( express.static( __dirname + '/public' ) );
});

app.configure( 'development', function() { 
	app.use( express.errorHandler( { dumpExceptions: true, showStack: true } ) ); 

	mongoose.connect( 'mongodb://localhost/fc' );
});

app.configure( 'production', function() {
	//app.use( express.errorHandler() ); 
	app.use( express.errorHandler( { dumpExceptions: true, showStack: true } ) ); 

	mongoose.connect( 'mongodb://localhost/fc' );
});

// Models

var User		= mongoose.model( 'User' );
var School	= mongoose.model( 'School' );
var Course	= mongoose.model( 'Course' );
var Lecture	= mongoose.model( 'Lecture' );
var Note		= mongoose.model( 'Note' );

// Middleware

function loggedIn( req, res, next ) {
	var sid = req.sessionID;
	log3("logged in ...")

	User.findOne( { session : sid }, function( err, user ) {
		log3(err);
		log3(user);
		if( user ) {
			req.user = user;

			log3( 'authenticated user: '+user._id+' / '+user.email+'');

			next();
		} else {
			log3("no user, redirect to login page");
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

	log3("get / page");

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
		res.render( 'lecture/index', { 'lecture' : lecture, 'notes' : notes } );
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

//	res.render( 'notes/index', { 'note' : note, 'layout' : false } );
	res.redirect( 'http://fc.sleepless.com:9001/p/' + note._id );
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
			  log3("user.save() done") 
				res.redirect( '/' );
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

	user.email		= req.body.email;
	user.password	= req.body.password;
	user.session	= sid;
	log3('register '+user.email+"/"+user.password+" "+user.session) 
	log3(user)

	user.save( function( err ) {
		var hostname = user.email.split( '@' ).pop();
		log3('save '+user.email);

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
	log3('logout') 
	req.session.destroy();

	res.redirect( '/' );
});

app.listen( 3000 );
log2( "Express server listening on port %d in %s mode", app.address().port, app.settings.env );

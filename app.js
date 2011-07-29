/* vim: set ts=2: */

var express		= require( 'express' );
var mongoose	= require( './db.js' ).mongoose;
var async			= require( 'async' );
var sys				= require( 'sys' );

var app = module.exports = express.createServer();

// Configuration

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

	mongoose.connect( 'mongodb://fc:finalsclub@staff.mongohq.com:10048/fc' );
});

app.configure( 'production', function() {
	app.use( express.errorHandler() ); 

	//mongoose.connect( 'mongodb://localhost/fc' );
	mongoose.connect( 'mongodb://fc:finalsclub@staff.mongohq.com:10048/fc' );
});

// Models

var User		= mongoose.model( 'User' );
var School	= mongoose.model( 'School' );
var Course	= mongoose.model( 'Course' );

// Middleware

function loggedIn( req, res, next ) {
	var sid = req.sessionID;

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
		} else {
			req.flash( 'error', 'Invalid course specified!' );

			res.redirect( '/' );
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

	School.find( { 'users' : userId }, function( err, results ) {
		async.forEach(
			results,
			function( school, callback ) {
				Course.find( { 'school' : school._id, 'users' : userId }, function( err, courses ) {
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

	res.render( 'course/index', { 'course' : course, 'subscribed' : subscribed } );
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

	Course.collection.update( { '_id' : courseId }, { '$pull' : { 'users' : userId } }, function( err ) {
		res.redirect( '/course/' + courseId );
	});
});

// lecture

app.get( '/course/:id/lecture/:lid/', loggedIn, loadCourse, function( req, res ) {
	var course	= req.course;
	var lecture	= req.lectures.id( req.params.lid );

	if( lecture ) {
		res.render( 'lecture/index', { 'lecture' : lecture } );
	} else {
		req.flash( 'error', 'Invalid lecture specified!' );

		res.redirect( '/course/' + course._id );
	}
});

app.get( '/course/:id/lecture/new', loggedIn, loadCourse, function( req, res ) {
	var lecture = {};

	res.render( 'lecture/new', { 'lecture' : lecture } );
});

app.post( '/course/:id/lecture/new', loggedIn, loadCourse, function( req, res ) {
	var course	= req.course;

	var lecture = {
		'name' : req.body.name,
	  'date' : req.body.date
	};

	course.lectures.push( lecture );

	course.save( function( err ) {
		if( err ) {
			// XXX: better validation
			req.flash( 'error', 'Invalid parameters!' );

			res.render( 'lecture/new', { 'lecture' : lecture } );
		} else {
			res.redirect( '/course/' + course._id );
		}
	});
});

// notes

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

	user.email		= req.body.email;
	user.password	= req.body.password;
	user.session	= sid;

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

app.listen( 3000 );
console.log( "Express server listening on port %d in %s mode", app.address().port, app.settings.env );

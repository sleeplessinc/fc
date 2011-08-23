/* vim: set ts=2: */

// DEPENDENCIES

var crypto = require( 'crypto' );

var mongoose	= require( 'mongoose' );

var Schema		= mongoose.Schema;
var ObjectId	= mongoose.SchemaTypes.ObjectId;

// SUPPORT FUNCTIONS

function salt() {
	return Math.round( ( new Date().valueOf() * Math.random() ) ).toString();
}

// MODELS

// user

var UserSchema = new Schema( {
	email					: { type : String, index : { unique : true } },
  name          : String,
  affil         : String,
	hashed				: String,
  activated     : Boolean,
  activateCode  : String,
	salt					: String,
	session				: String
});

UserSchema.virtual( 'password' )
	.set( function( password ) {
		this.salt				= salt();
		this.hashed			= this.encrypt( password );
	});

UserSchema.method( 'encrypt', function( password ) {
	var hmac = crypto.createHmac( 'sha1', this.salt );

	return hmac.update( password ).digest( 'hex' );
});

UserSchema.method( 'authenticate', function( plaintext ) {
	return ( this.encrypt( plaintext ) === this.hashed );
});

var User = mongoose.model( 'User', UserSchema );

// schools

var SchoolSchema = new Schema( {
	name				: String,
	description	: String,
	url					: String,

	hostnames		: Array,

	users				: Array
});

SchoolSchema.method( 'authorize', function( user ) {
	return ( this.users.indexOf( user._id ) != -1 ) ? true : false;
});

var School = mongoose.model( 'School', SchoolSchema );

// courses

var CourseSchema = new Schema( {
	name				: String,
	description	: String,
  instructor  : String,
	// courses are tied to one school
	school			: ObjectId,

	// XXX: room for additional resources

	// many users may subscribe to a course
	users				: Array
});

CourseSchema.method( 'authorize', function( user ) {
	School.findById( this.school, function( err, school ) {
		return school ? school.authorize( user ) : false;
	});
});

CourseSchema.method( 'subscribed', function( user ) {
	return ( this.users.indexOf( user ) > -1 ) ;
});

CourseSchema.method( 'subscribe', function( user, callback ) {
	var id = this._id;

	// mongoose issue #404
	Course.collection.update( { '_id' : id }, { '$addToSet' : { 'users' : user } }, function( err ) {
		callback( err );
	});
});

CourseSchema.method( 'unsubscribe', function( user, callback ) {
	var id = this._id;

	// mongoose issue #404
	Course.collection.update( { '_id' : id }, { '$pull' : { 'users' : user } }, function( err ) {
		callback( err );
	});
});

var Course = mongoose.model( 'Course', CourseSchema );

// lectures

var LectureSchema	= new Schema( {
	name					: String,
	date					: Date,
	live					: Boolean,

	course				: ObjectId
});

LectureSchema.method( 'authorize', function( user ) {
	Course.findById( this.course, function( err, course ) {
		return course ? course.authorize( user ) : false;
	});
});

var Lecture = mongoose.model( 'Lecture', LectureSchema );

// notes

var NoteSchema = new Schema( {
	name					: String,
	path					: String,
  public        : Boolean,
  roID          : String,

	lecture				: ObjectId,

	collaborators : Array
});

NoteSchema.method( 'authorize', function( user ) {
	if( ! this.public ) {
		Lecture.findById( this.lecture, function( err, lecture ) {
			return lecture ? lecture.authorize( user ) : false;
		});
	} else {
		return true;
	}
});

var Note = mongoose.model( 'Note', NoteSchema );

// comments

var Post = new Schema({
  date      : Date,
  body      : String,
  votes     : Array,
  reports   : Array,
  public    : Boolean,

  userid    : String,//ObjectId,
  userName  : String,
  userAffil : String,

  comments   : Array,

  lecture   : String//ObjectId
})

mongoose.model( 'Post', Post );

module.exports.mongoose = mongoose;

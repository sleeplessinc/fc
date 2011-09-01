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
	email						: { type : String, require: true, index : { unique : true } },
	school					: String,
	name						: String,
	affil						: String,
	hashed					: String,
	activated				: Boolean,
	activateCode		: String,
	resetPassCode		: String,
	resetPassDate		: Date,
	salt						: String,
	session					: String,
	showName				: { 'type' : Boolean, 'default' : true },
	admin						: { 'type' : Boolean, 'default' : false }
});

UserSchema.virtual( 'displayName' )
	.get( function() {
		if( this.showName ) {
			return this.name;
		} else {
			return this.email;
		}
	});

UserSchema.virtual( 'password' )
	.set( function( password ) {
		this.salt				= salt();
		this.hashed			= this.encrypt( password );
	});

UserSchema.virtual( 'isComplete' )
	.get( function() {
		// build on this as the schema develops

		return ( this.name && this.affil && this.hashed );
	});

UserSchema.method( 'encrypt', function( password ) {
	var hmac = crypto.createHmac( 'sha1', this.salt );

	return hmac.update( password ).digest( 'hex' );
});

UserSchema.method( 'authenticate', function( plaintext ) {
	return ( this.encrypt( plaintext ) === this.hashed );
});

UserSchema.method('genRandomPassword', function () {
	// this function generates the random password, it does not keep or save it.
	var plaintext = '';

	var len = 8;
	var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (var i = 0; i < len; i++) {
		var randomPoz = Math.floor(Math.random() * charSet.length);
		plaintext += charSet.substring(randomPoz, randomPoz + 1);
	}

	return plaintext;
});

UserSchema.method( 'setResetPassCode', function ( code ) {
	this.resetPassCode = code;
	this.resetPassDate = new Date();
	return this.resetPassCode;
});

UserSchema.method( 'canResetPassword', function ( code ) {
	// ensure the passCode is valid, matches and the date has not yet expired, lets say 2 weeks for good measure.
	var value = false;

	var expDate = new Date();
	expDate.setDate(expDate.getDate() - 14);

	// we have a valid code and date
	if (this.resetPassCode != null && this.resetPassDate != null && this.resetPassDate >= expDate && this.resetPassCode == code) {
		value = true;
	}

	return value;
});

UserSchema.method( 'resetPassword', function ( code, newPass1,  newPass2) {
	// ensure the date has not expired, lets say 2 weeks for good measure.

	var success = false;
	if (this.canResetPassword(code) && newPass1 != null && newPass1.length > 0 && newPass1 == newPass2) {
		this.password = newPass1;
		this.resetPassCode = null;
		this.resetPassDate = null;
		success = true;
	}

	return success;
});

var User = mongoose.model( 'User', UserSchema );

// schools

var SchoolSchema = new Schema( {
	name				: { type : String, required : true },
	description	: String,
	url					: String,

	hostnames		: Array,

	users				: Array
});

SchoolSchema.method( 'authorize', function( user, cb ) {
	return cb(user.admin || ( this.users.indexOf( user._id ) !== -1 ));
});

var School = mongoose.model( 'School', SchoolSchema );

// courses

var CourseSchema = new Schema( {
	name				: { type : String, required : true },
	description	: String,
  instructor  : String,
	// courses are tied to one school
	school			: ObjectId,

	// XXX: room for additional resources

	// many users may subscribe to a course
	users				: Array
});

CourseSchema.method( 'authorize', function( user, cb ) {
	School.findById( this.school, function( err, school ) {
		if ( school ) {
			school.authorize( user, function( result ) {
							return cb( result );
			})
		}
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
	name					: { type : String, required : true },
	date					: { type : Date, default: Date.now },
	live					: Boolean,

	course				: ObjectId
});

LectureSchema.method( 'authorize', function( user, cb ) {
	Course.findById( this.course, function( err, course ) {
		if (course) {
			course.authorize( user, function( res ) {
				return cb( res );
			})
		} else {
		 return cb( false );
		}
	});
});

var Lecture = mongoose.model( 'Lecture', LectureSchema );

// notes

var NoteSchema = new Schema( {
	name					: { type : String, required : true },
	path					: String,
  public        : Boolean,
  roID          : String,
	visits				: Number,

	lecture				: ObjectId,

	collaborators : [String]
});

NoteSchema.method( 'authorize', function( user, cb ) {
	Lecture.findById( this.lecture, function( err, lecture ) {
		if (lecture) {
			lecture.authorize( user, function( res ) {
				return cb( res );
			})
		} else {
			return cb( false );
		}
	});
});

NoteSchema.method( 'addVisit', function() {
	var id = this._id;

	Note.collection.update( { '_id' : id }, { '$inc' : { 'visits' : 1 } } );
});

var Note = mongoose.model( 'Note', NoteSchema );

// comments

var PostSchema = new Schema({
  date      : { type : Date, default : Date.now },
  body      : String,
  votes     : [String],
  reports   : [String],
  public    : Boolean,

  userid    : String, // ObjectId,
  userName  : String,
  userAffil : String,

  comments   : Array,

  lecture   : String // ObjectId
})

mongoose.model( 'Post', PostSchema );

module.exports.mongoose = mongoose;

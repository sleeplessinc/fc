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

var User = new Schema( {
	email					: { type : String, index : { unique : true } },
	hashed				: String,
	salt					: String,
	session				: String
});

User.virtual( 'password' )
	.set( function( password ) {
		this.salt				= salt();
		this.hashed			= this.encrypt( password );
	});

User.method( 'encrypt', function( password ) {
	var hmac = crypto.createHmac( 'sha1', this.salt );

	return hmac.update( password ).digest( 'hex' );
});

User.method( 'authenticate', function( plaintext ) {
	return ( this.encrypt( plaintext ) === this.hashed );
});

mongoose.model( 'User', User );

// schools

var School = new Schema( {
	name				: String,
	description	: String,
	url					: String,

	hostnames		: Array,

	users				: Array
});

mongoose.model( 'School', School );

// courses

var Course = new Schema( {
	name				: String,
	description	: String,

	// courses are tied to one school
	school			: ObjectId,

	// XXX: room for additional resources

	// many users may subscribe to a course
	users				: Array
});

mongoose.model( 'Course', Course );

// lectures

var Lecture	= new Schema( {
	name					: String,
	date					: Date,
	live					: Boolean,

	course				: ObjectId
});

mongoose.model( 'Lecture', Lecture );

// notes

var Note = new Schema( {
	name					: String,
	path					: String,

	lecture				: ObjectId,

	collaborators : Array
});

mongoose.model( 'Note', Note );

// comments

var Comment = new Schema({
  date    : Date,
  body    : String,
  votes   : Number,

  user    : ObjectId,

  anon    : Boolean,
  replies : Array,

  lecture : String//ObjectId
})

mongoose.model( 'Comment', Comment );

module.exports.mongoose = mongoose;

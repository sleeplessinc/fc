/* vim: set ts=2: */

var url		= require( 'url' );
var async	= require( 'async' );

var mongo	= require( 'mongodb' );

var open = module.exports.open = function( spec, db, collection, callback ) {
	if( ! spec ) {
		throw new Error( 'No connection specification defined!' );
	}

	if( typeof db === 'function' ) {
		callback = db;

		db = undefined;
	}

	if( typeof collection === 'function' ) {
		callback = collection;

		collection = undefined;
	}

	var uris				= spec.split( ',' );
	var servers			= [];

	async.forEachSeries(
		uris,

		function( uri, next ) {
			var parsed			= url.parse( uri );
			var path				= parsed.pathname.split( '/' );

			var port				= parsed.port			|| 27017;
			var host				= parsed.hostname;

			if( path[ 1 ] ) {
				db = path[ 1 ];
			}

			if( path[ 2 ] ) {
				collection = path[ 2 ];
			}

			if( ! host ) {
				next( new Error( 'No host defined!' ) );
			} else {
				servers.push( new mongo.Server( host, port, { auto_reconnect : true } ) );

				next();
			}
		},

		function( err ) {
			if( err ) {
				throw( err );
			}

			if( ! db ) {
				throw new Error( 'Unable to parse database name!' );
			}

			if( servers.count > 1 ) {
				var serverSpec = new ReplSetServers( servers );
			} else {
				var serverSpec = servers.shift();
			}

			var database	= new mongo.Db( db, serverSpec );

			database.open( function( err, database ) {
				// XXX: add authentication

				if( err ) {
					callback( err );
				} else {
					// do we want to open a specific collection? otherwise just return DB
					if( ! collection ) {
						callback( null, database );
					} else {
						database.createCollection( collection, function( err, c ) {	
							if( err ) {
								callback( err );
							} else {
								callback( null, c );
							}
						});
					}
				}	
			});
		}
	);
}
